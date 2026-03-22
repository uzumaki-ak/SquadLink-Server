// handles user profile reads and updates
// also exposes room history so android can show "recently joined rooms" on home screen

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/response.js";
import type { UpdateProfileInput } from "./users.types.js";

// updates display name or avatar - only the fields passed in get changed
async function updateUserProfile(userId: string, input: UpdateProfileInput) {
  // if username is being changed, check it's not taken by someone else
  if (input.username) {
    const conflict = await prisma.user.findFirst({
      where: { username: input.username, NOT: { id: userId } },
      select: { id: true },
    });
    if (conflict) {
      throw new AppError("username is already taken", 409, "USERNAME_TAKEN");
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.username && { username: input.username }),
      ...(input.avatarUrl && { avatarUrl: input.avatarUrl }),
    },
    select: { id: true, username: true, languageCode: true, avatarUrl: true },
  });

  return updated;
}

// returns the last 10 rooms this user was in - for the "rejoin" quick list on home screen
async function getUserRoomHistory(userId: string) {
  const memberships = await prisma.roomMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "desc" },
    take: 10,
    include: {
      room: {
        select: {
          id: true,
          code: true,
          isActive: true,
          expiresAt: true,
          host: { select: { username: true } },
          _count: { select: { members: true } },
        },
      },
    },
  });

  // filter out expired rooms from the result but keep them in db for analytics
  return memberships.map((m) => ({
    roomId: m.room.id,
    roomCode: m.room.code,
    hostUsername: m.room.host.username,
    memberCount: m.room._count.members,
    isActive: m.room.isActive && new Date() < m.room.expiresAt,
    joinedAt: m.joinedAt,
  }));
}

export const usersService = { updateUserProfile, getUserRoomHistory };
