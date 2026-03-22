// auth controller - handles http layer only
// no business logic here, that lives in auth.service.ts
// every handler is async and errors bubble to globalErrorHandler via next()

import type { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service.js";
import { createProfileSchema } from "./auth.types.js";
import { sendSuccess } from "../../utils/response.js";

// POST /auth/profile
// called once after supabase signup to create the in-app profile
async function createProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createProfileSchema.parse(req.body);
    const profile = await authService.createUserProfile(req.user.id, input);
    sendSuccess(res, profile, 201);
  } catch (err) {
    next(err);
  }
}

// GET /auth/profile
// app calls this on launch to check if profile exists and get user info
async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await authService.getUserProfile(req.user.id);
    sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
}

// PATCH /auth/profile/language
// user changes their preferred language from app settings
async function updateLanguage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { languageCode } = req.body as { languageCode: string };
    const updated = await authService.updateLanguagePreference(req.user.id, languageCode);
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
}

export const authController = { createProfile, getProfile, updateLanguage };
