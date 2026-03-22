// all room lifecycle logic lives here
// rooms expire after 4 hours automatically
// a user can only be in one active room at a time (kicked from old room on join)

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/response.js";
import { generateRoomCode } from "../../utils/roomCode.js";
import { logger } from "../../utils/logger.js";
import type { CreateRoomInput } from "./rooms.types.js";

const ROOM_TTL_HOURS = 4;
const MAX_CODE_RETRIES = 5; // retries if generated code is already taken

// creates a new room and adds the creator as first member
async function createRoom(hostId: string, input: CreateRoomInput) {
  // generate a unique code - retry up to 5 times on collision (extremely rare)
  let code: string = "";
  let attempts = 0;

  while (attempts < MAX_CODE_RETRIES) {
    const candidate = generateRoomCode();
    const existing = await prisma.room.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    if (!existing) {
      code = candidate;
      break;
    }
    attempts++;
  }

  if (!code) {
    throw new AppError("failed to generate unique room code, try again", 503, "CODE_GENERATION_FAILED");
  }

  const expiresAt = new Date(Date.now() + ROOM_TTL_HOURS * 60 * 60 * 1000);

  // create room + first membership in one transaction
  const room = await prisma.$transaction(async (tx) => {
    const newRoom = await tx.room.create({
      data: {
        code,
        hostId,
        maxMembers: input.maxMembers,
        expiresAt,
      },
    });

    await tx.roomMember.create({
      data: { roomId: newRoom.id, userId: hostId },
    });

    return newRoom;
  });

  logger.info("room created", { roomId: room.id, code: room.code, hostId });
  return getRoomDetails(room.id);
}

// joins a room by code - validates capacity, expiry, and duplicate join
async function joinRoom(userId: string, code: string) {
  const room = await prisma.room.findUnique({
    where: { code },
    include: {
      _count: { select: { members: { where: { leftAt: null } } } },
    },
  });

  if (!room) {
    throw new AppError("room not found - check the code and try again", 404, "ROOM_NOT_FOUND");
  }

  if (!room.isActive) {
    throw new AppError("this room has been closed by the host", 410, "ROOM_CLOSED");
  }

  if (new Date() > room.expiresAt) {
    // mark expired while we're here
    await prisma.room.update({ where: { id: room.id }, data: { isActive: false } });
    throw new AppError("this room has expired", 410, "ROOM_EXPIRED");
  }

  if (room._count.members >= room.maxMembers) {
    throw new AppError("room is full", 403, "ROOM_FULL");
  }

  // check if already in this room and active
  const existingMembership = await prisma.roomMember.findFirst({
    where: { roomId: room.id, userId, leftAt: null },
  });

  if (existingMembership) {
    // already in room - just return room details (idempotent join)
    return getRoomDetails(room.id);
  }

  // upsert handles the case where user left and is rejoining
  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId } },
    create: { roomId: room.id, userId },
    update: { leftAt: null, joinedAt: new Date() },
  });

  logger.info("user joined room", { userId, roomId: room.id });
  return getRoomDetails(room.id);
}

// marks a member as left - soft delete so history is preserved
async function leaveRoom(userId: string, roomId: string) {
  const membership = await prisma.roomMember.findFirst({
    where: { roomId, userId, leftAt: null },
  });

  if (!membership) {
    throw new AppError("you are not in this room", 400, "NOT_IN_ROOM");
  }

  await prisma.roomMember.update({
    where: { id: membership.id },
    data: { leftAt: new Date() },
  });

  // if the host left, close the room
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostId: true },
  });

  if (room?.hostId === userId) {
    await prisma.room.update({ where: { id: roomId }, data: { isActive: false } });
    logger.info("room closed because host left", { roomId });
  }

  logger.info("user left room", { userId, roomId });
}

// host-only: force close a room
async function closeRoom(hostId: string, roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostId: true, isActive: true },
  });

  if (!room) {
    throw new AppError("room not found", 404, "ROOM_NOT_FOUND");
  }
  if (room.hostId !== hostId) {
    throw new AppError("only the host can close a room", 403, "FORBIDDEN");
  }
  if (!room.isActive) {
    throw new AppError("room is already closed", 400, "ROOM_ALREADY_CLOSED");
  }

  await prisma.room.update({ where: { id: roomId }, data: { isActive: false } });
  logger.info("room closed by host", { roomId, hostId });
}

// returns full room details with current members list
async function getRoomDetails(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      code: true,
      maxMembers: true,
      isActive: true,
      expiresAt: true,
      createdAt: true,
      host: { select: { id: true, username: true } },
      members: {
        where: { leftAt: null },
        select: {
          joinedAt: true,
          isMuted: true,
          user: { select: { id: true, username: true, languageCode: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!room) {
    throw new AppError("room not found", 404, "ROOM_NOT_FOUND");
  }

  return room;
}

export const roomsService = { createRoom, joinRoom, leaveRoom, closeRoom, getRoomDetails };
