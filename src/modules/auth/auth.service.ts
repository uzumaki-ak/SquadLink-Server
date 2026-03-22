// handles the user profile lifecycle
// supabase manages login/signup/sessions
// we only manage the game-specific profile (username, language preference)

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/response.js";
import type { CreateProfileInput } from "./auth.types.js";

// creates the squadlink profile after supabase has already created the auth user
// userId comes from the verified jwt - not from request body
async function createUserProfile(userId: string, input: CreateProfileInput) {
  // check username availability before creating - better error than a constraint violation
  const existingUsername = await prisma.user.findUnique({
    where: { username: input.username },
    select: { id: true },
  });

  if (existingUsername) {
    throw new AppError("username is already taken", 409, "USERNAME_TAKEN");
  }

  const user = await prisma.user.create({
    data: {
      id: userId,
      username: input.username,
      languageCode: input.languageCode,
    },
    select: {
      id: true,
      username: true,
      languageCode: true,
      createdAt: true,
    },
  });

  return user;
}

// loads the current user's profile - used on app launch to check if profile is set up
async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      languageCode: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError("profile not found", 404, "PROFILE_NOT_FOUND");
  }

  return user;
}

// updates language preference - called from app settings
async function updateLanguagePreference(userId: string, languageCode: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { languageCode },
    select: { id: true, username: true, languageCode: true },
  });

  return user;
}

export const authService = {
  createUserProfile,
  getUserProfile,
  updateLanguagePreference,
};
