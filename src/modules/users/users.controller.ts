// users controller

import type { Request, Response, NextFunction } from "express";
import { usersService } from "./users.service.js";
import { updateProfileSchema } from "./users.types.js";
import { sendSuccess } from "../../utils/response.js";

// PATCH /users/me
async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateProfileSchema.parse(req.body);
    const updated = await usersService.updateUserProfile(req.user.id, input);
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
}

// GET /users/me/rooms
async function getRoomHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await usersService.getUserRoomHistory(req.user.id);
    sendSuccess(res, history);
  } catch (err) {
    next(err);
  }
}

export const usersController = { updateProfile, getRoomHistory };
