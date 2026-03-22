// sets up the socket.io server
// attaches jwt auth to every connection before any gateway handles events
// namespaced so we can add more namespaces later without refactoring

import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../config/supabase.js";
import { logger } from "../utils/logger.js";
import { registerChatGateway } from "./chat.gateway.js";
import { registerSignalingGateway } from "./signaling.gateway.js";
import type { ServerToClientEvents, ClientToServerEvents, SocketData } from "./socket.types.js";

export type AppSocket = ReturnType<typeof createSocketServer> extends SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>
  ? InstanceType<
      typeof SocketServer<
        ClientToServerEvents,
        ServerToClientEvents,
        Record<string, never>,
        SocketData
      >
    >["sockets"]["sockets"] extends Map<string, infer S>
    ? S
    : never
  : never;

export function createSocketServer(httpServer: HttpServer) {
  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    httpServer,
    {
      cors: {
        origin: (origin, callback) => {
          // Native Android clients often send no Origin.
          if (!origin || env.ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error(`origin ${origin} not in allowlist`), false);
        },
        methods: ["GET", "POST"],
        credentials: true,
      },
      // ping every 25s, disconnect if no pong within 5s
      // keeps connections clean without being aggressive
      pingInterval: 25000,
      pingTimeout: 5000,
      // limit per-message size to prevent abuse
      maxHttpBufferSize: 1e5, // 100kb
    }
  );

  // ─── socket auth middleware ───────────────────────────────────────────────
  // runs before any event handler - verifies jwt and loads user profile
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth as { token?: string }).token ??
        socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("missing auth token"));
      }

      let userId: string | undefined;
      try {
        const decoded = jwt.verify(token, env.SUPABASE_JWT_SECRET) as jwt.JwtPayload;
        userId = typeof decoded.sub === "string" ? decoded.sub : undefined;
      } catch {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !data?.user?.id) {
          return next(new Error("invalid or expired token"));
        }
        userId = data.user.id;
      }

      if (!userId) {
        return next(new Error("token missing subject"));
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, languageCode: true },
      });

      if (!user) {
        return next(new Error("user profile not found"));
      }

      // attach to socket data - available in all event handlers as socket.data
      socket.data.userId = user.id;
      socket.data.username = user.username;
      socket.data.languageCode = user.languageCode;

      next();
    } catch (err) {
      logger.error("socket auth error", { error: (err as Error).message });
      next(new Error("internal auth error"));
    }
  });

  // ─── connection handler ───────────────────────────────────────────────────
  io.on("connection", (socket) => {
    logger.debug("socket connected", { userId: socket.data.userId, socketId: socket.id });

    // register all event handlers from gateways
    registerChatGateway(io, socket);
    registerSignalingGateway(io, socket);

    socket.on("disconnect", (reason) => {
      logger.debug("socket disconnected", {
        userId: socket.data.userId,
        reason,
      });
    });
  });

  return io;
}
