// handles all real-time chat events over socket.io
// text messages, quick commands, and subtitle lines all flow through here
// each event persists to db then broadcasts to the room

import type { Server as SocketServer, Socket } from "socket.io";
import { chatService } from "../modules/chat/chat.service.js";
import { translateService } from "../modules/translate/translate.service.js";
import { prisma } from "../config/prisma.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/response.js";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
  SendChatPayload,
  SendSubtitlePayload,
  SendMusicSyncPayload,
  AckCallback,
} from "./socket.types.js";

type IoServer = SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// validates that the user is still an active member of a room
// checked before every event that requires room membership
async function assertSocketMembership(userId: string, roomId: string): Promise<void> {
  const membership = await prisma.roomMember.findFirst({
    where: { userId, roomId, leftAt: null },
    select: { id: true },
  });
  if (!membership) {
    throw new AppError("you are not an active member of this room", 403, "NOT_IN_ROOM");
  }
}

// safe ack wrapper - catches errors and sends them back via the ack callback
// prevents unhandled promise rejections from crashing the event loop
function withAck<T>(
  handler: () => Promise<T>,
  ack?: AckCallback<T>
): void {
  handler()
    .then((data) => {
      if (!ack) return;
      if (data === undefined) {
        ack({ ok: true });
      } else {
        ack({ ok: true, data: data as T });
      }
    })
    .catch((err) => {
      const message = err instanceof AppError ? err.message : "something went wrong";
      const code = err instanceof AppError ? err.code : "INTERNAL_ERROR";
      logger.warn("socket event error", { message, code });
      if (ack) {
        ack({ ok: false, error: message });
      } else {
        logger.warn("socket event error (no ack callback)", { message, code });
      }
    });
}

export function registerChatGateway(io: IoServer, socket: AppSocket): void {
  const { userId, username, languageCode } = socket.data;

  // ─── room:join ──────────────────────────────────────────────────────────
  // called after http join succeeds - subscribes to the socket.io room channel
  socket.on("room:join", ({ roomId }, ack) => {
    withAck(async () => {
      await assertSocketMembership(userId, roomId);
      await socket.join(roomId);

      // tell others in the room this user connected
      socket.to(roomId).emit("room:member_joined", { userId, username, languageCode });

      logger.debug("socket joined room channel", { userId, roomId });
    }, ack);
  });

  // ─── room:leave ─────────────────────────────────────────────────────────
  socket.on("room:leave", ({ roomId }, ack) => {
    withAck(async () => {
      await socket.leave(roomId);
      socket.to(roomId).emit("room:member_left", { userId, username });
      logger.debug("socket left room channel", { userId, roomId });
    }, ack);
  });

  // ─── chat:send ──────────────────────────────────────────────────────────
  // persist + broadcast a text or quick command message
  socket.on("chat:send", (payload: SendChatPayload, ack) => {
    withAck(async () => {
      const { roomId, content, type } = payload;

      // basic length guard at socket level (zod validates on http but sockets bypass that)
      if (!content || content.trim().length === 0 || content.length > 500) {
        throw new AppError("message content is invalid", 400, "INVALID_CONTENT");
      }

      const message = await chatService.persistMessage(userId, roomId, {
        content: content.trim(),
        type: type === "QUICK_CMD" ? "QUICK_CMD" : "TEXT",
      });

      const broadcastPayload = {
        id: message.id,
        type: message.type as "TEXT" | "QUICK_CMD",
        content: message.content,
        translatedContent: null,
        originalLang: null,
        createdAt: message.createdAt.toISOString(),
        sender: message.sender,
      };

      // send to everyone in the room including the sender
      io.to(roomId).emit("chat:message", broadcastPayload);

      return broadcastPayload;
    }, ack);
  });

  // ─── subtitle:send ──────────────────────────────────────────────────────
  // client sends vosk-transcribed text, server translates per-member and broadcasts
  socket.on("subtitle:send", (payload: SendSubtitlePayload, ack) => {
    withAck(async () => {
      const { roomId, originalText, originalLang } = payload;

      if (!originalText || originalText.trim().length === 0 || originalText.length > 500) {
        throw new AppError("subtitle text is invalid", 400, "INVALID_CONTENT");
      }

      await assertSocketMembership(userId, roomId);

      // get active members to know which languages are in the room
      const members = await prisma.roomMember.findMany({
        where: { roomId, leftAt: null, NOT: { userId } },
        select: { user: { select: { languageCode: true } } },
      });

      // unique target languages, skip if same as speaker's language
      const targetLangs = [...new Set(
        members
          .map((m) => m.user.languageCode)
          .filter((lang) => lang !== originalLang)
      )];

      // translate into each unique language in parallel
      // if a translation fails we fall back to original - never drop the subtitle
      const translationMap = new Map<string, string>();
      await Promise.allSettled(
        targetLangs.map(async (targetLang) => {
          try {
            const translated = await translateService.translateText({
              text: originalText,
              sourceLang: originalLang,
              targetLang,
            });
            translationMap.set(targetLang, translated);
          } catch (err) {
            logger.warn("subtitle translation failed, falling back to original", {
              originalLang,
              targetLang,
              error: (err as Error).message,
            });
            translationMap.set(targetLang, originalText);
          }
        })
      );

      const firstTranslation = translationMap.size > 0
        ? (translationMap.values().next().value ?? null)
        : null;

      const message = await chatService.persistSubtitle(
        userId, roomId, originalText, firstTranslation, originalLang
      );

      // send each member their own language version
      const roomSockets = await io.in(roomId).fetchSockets();
      for (const memberSocket of roomSockets) {
        if (memberSocket.data.userId === userId) continue;

        const memberLang = memberSocket.data.languageCode;
        const translatedText = translationMap.get(memberLang) ?? originalText;

        memberSocket.emit("subtitle:line", {
          messageId: message.id,
          senderId: userId,
          senderUsername: username,
          originalText,
          translatedText: memberLang !== originalLang ? translatedText : null,
          originalLang,
          timestamp: message.createdAt.toISOString(),
        });
      }

      return { messageId: message.id };
    }, ack);
  });

  // ─── voice:set_mute ─────────────────────────────────────────────────────
  socket.on("voice:set_mute", ({ roomId, isMuted }, ack) => {
    withAck(async () => {
      await assertSocketMembership(userId, roomId);

      await prisma.roomMember.updateMany({
        where: { roomId, userId, leftAt: null },
        data: { isMuted },
      });

      io.to(roomId).emit("voice:mute_state", { roomId, userId, isMuted });
    }, ack);
  });

  socket.on("music:sync", (payload: SendMusicSyncPayload, ack) => {
    withAck(async () => {
      const { roomId, action } = payload;
      await assertSocketMembership(userId, roomId);

      const validActions = new Set(["LOAD", "PLAY", "PAUSE", "SEEK", "STOP"]);
      if (!validActions.has(action)) {
        throw new AppError("invalid music sync action", 400, "INVALID_MUSIC_ACTION");
      }

      if ((action === "LOAD" || action === "PLAY") && payload.trackUrl) {
        const isHttpUrl = /^https?:\/\//i.test(payload.trackUrl);
        if (!isHttpUrl) {
          throw new AppError("shared track URL must be http/https", 400, "INVALID_TRACK_URL");
        }
      }

      const positionMs = typeof payload.positionMs === "number"
        ? Math.max(0, Math.floor(payload.positionMs))
        : null;

      io.to(roomId).emit("music:sync", {
        roomId,
        action,
        trackUrl: payload.trackUrl ?? null,
        trackTitle: payload.trackTitle ?? null,
        positionMs,
        byUserId: userId,
        byUsername: username,
        issuedAt: new Date().toISOString(),
      });
    }, ack);
  });

  // ─── ungraceful disconnect cleanup ──────────────────────────────────────
  socket.on("disconnect", async () => {
    const joinedRooms = Array.from(socket.rooms).filter((r) => r !== socket.id);

    for (const roomId of joinedRooms) {
      socket.to(roomId).emit("room:member_left", { userId, username });
    }
  });
}
