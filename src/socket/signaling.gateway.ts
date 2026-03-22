// webrtc signaling gateway
// the server is a pure relay here - it never parses or processes sdp/ice data
// it just forwards signals between the right peers using their userId as the address

import type { Server as SocketServer, Socket } from "socket.io";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/response.js";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
  WebRtcSignalPayload,
  IceCandidatePayload,
  AckCallback,
} from "./socket.types.js";

type IoServer = SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// finds the socket for a given userId in a room
// needed because webrtc signals are addressed by userId not socketId
async function findSocketByUserId(
  io: IoServer,
  roomId: string,
  targetUserId: string
): Promise<string | null> {
  const sockets = await io.in(roomId).fetchSockets();
  const target = sockets.find((s) => s.data.userId === targetUserId);
  return target?.id ?? null;
}

// safe ack wrapper
function withAck<T>(handler: () => Promise<T>, ack: AckCallback<T>): void {
  handler()
    .then((data) => ack({ ok: true, data: data ?? undefined }))
    .catch((err) => {
      const message = err instanceof AppError ? err.message : "relay failed";
      ack({ ok: false, error: message });
    });
}

export function registerSignalingGateway(io: IoServer, socket: AppSocket): void {
  const { userId } = socket.data;

  // ─── webrtc:offer ───────────────────────────────────────────────────────
  // peer A sends offer to peer B to initiate the p2p connection
  socket.on("webrtc:offer", (payload: WebRtcSignalPayload, ack) => {
    withAck(async () => {
      const targetSocketId = await findSocketByUserId(io, payload.roomId, payload.targetUserId);
      if (!targetSocketId) {
        throw new AppError("target peer is not connected", 404, "PEER_NOT_FOUND");
      }
      io.to(targetSocketId).emit("webrtc:offer", { ...payload, fromUserId: userId });
      logger.debug("webrtc offer relayed", { from: userId, to: payload.targetUserId });
    }, ack);
  });

  // ─── webrtc:answer ──────────────────────────────────────────────────────
  // peer B sends answer back to peer A after receiving the offer
  socket.on("webrtc:answer", (payload: WebRtcSignalPayload, ack) => {
    withAck(async () => {
      const targetSocketId = await findSocketByUserId(io, payload.roomId, payload.targetUserId);
      if (!targetSocketId) {
        throw new AppError("target peer is not connected", 404, "PEER_NOT_FOUND");
      }
      io.to(targetSocketId).emit("webrtc:answer", { ...payload, fromUserId: userId });
      logger.debug("webrtc answer relayed", { from: userId, to: payload.targetUserId });
    }, ack);
  });

  // ─── webrtc:ice_candidate ───────────────────────────────────────────────
  // ice candidates trickle in during and after negotiation - relay each one immediately
  // trickle ice is critical for fast connection establishment
  socket.on("webrtc:ice_candidate", (payload: IceCandidatePayload, ack) => {
    withAck(async () => {
      const targetSocketId = await findSocketByUserId(io, payload.roomId, payload.targetUserId);
      if (!targetSocketId) {
        // silently drop - target may have briefly disconnected, this is normal
        logger.debug("ice candidate dropped - target not found", {
          from: userId,
          to: payload.targetUserId,
        });
        return;
      }
      io.to(targetSocketId).emit("webrtc:ice_candidate", { ...payload, fromUserId: userId });
    }, ack);
  });
}
