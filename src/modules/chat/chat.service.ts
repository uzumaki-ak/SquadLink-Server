// chat service
// persists text messages and quick commands to the db
// socket.io handles the real-time delivery, this service handles persistence and history

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/response.js";
import { MessageType } from "@prisma/client";
import type { SendMessageInput } from "./chat.types.js";

// verifies the user is an active member of the room before allowing them to send
async function assertActiveMembership(userId: string, roomId: string): Promise<void> {
  const membership = await prisma.roomMember.findFirst({
    where: { userId, roomId, leftAt: null },
    select: { id: true },
  });

  if (!membership) {
    throw new AppError("you must be an active room member to send messages", 403, "NOT_IN_ROOM");
  }
}

// saves a text or quick command message and returns the full message with sender info
async function persistMessage(
  senderId: string,
  roomId: string,
  input: SendMessageInput
) {
  await assertActiveMembership(senderId, roomId);

  const message = await prisma.message.create({
    data: {
      roomId,
      senderId,
      type: input.type,
      content: input.content,
    },
    select: {
      id: true,
      type: true,
      content: true,
      translatedContent: true,
      originalLang: true,
      createdAt: true,
      sender: { select: { id: true, username: true } },
    },
  });

  return message;
}

// saves a subtitle log entry (transcribed + translated voice)
// called from the socket gateway when a client sends a subtitle event
async function persistSubtitle(
  senderId: string,
  roomId: string,
  originalText: string,
  translatedText: string | null,
  originalLang: string
) {
  const message = await prisma.message.create({
    data: {
      roomId,
      senderId,
      type: MessageType.SUBTITLE,
      content: originalText,
      translatedContent: translatedText,
      originalLang,
    },
    select: {
      id: true,
      type: true,
      content: true,
      translatedContent: true,
      originalLang: true,
      createdAt: true,
      sender: { select: { id: true, username: true } },
    },
  });

  return message;
}

// loads last N messages for a room - used when a user joins mid-session
async function getRoomChatHistory(
  roomId: string,
  limit = 50,
  beforeId?: string
) {
  const messages = await prisma.message.findMany({
    where: {
      roomId,
      // cursor-based pagination: if beforeId given, load messages older than that
      ...(beforeId && { id: { lt: beforeId } }),
    },
    select: {
      id: true,
      type: true,
      content: true,
      translatedContent: true,
      originalLang: true,
      createdAt: true,
      sender: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // return in ascending order so the app can render oldest-first
  return messages.reverse();
}

export const chatService = { persistMessage, persistSubtitle, getRoomChatHistory };
