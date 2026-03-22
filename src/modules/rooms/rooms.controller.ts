// rooms controller

import type { Request, Response, NextFunction } from "express";
import { roomsService } from "./rooms.service.js";
import { createRoomSchema, joinRoomSchema } from "./rooms.types.js";
import { sendSuccess } from "../../utils/response.js";

// POST /rooms
async function createRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createRoomSchema.parse(req.body);
    const room = await roomsService.createRoom(req.user.id, input);
    sendSuccess(res, room, 201);
  } catch (err) {
    next(err);
  }
}

// POST /rooms/join
async function joinRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = joinRoomSchema.parse(req.body);
    const room = await roomsService.joinRoom(req.user.id, code);
    sendSuccess(res, room);
  } catch (err) {
    next(err);
  }
}

// DELETE /rooms/:roomId/leave
async function leaveRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await roomsService.leaveRoom(req.user.id, req.params.roomId as string);
    sendSuccess(res, { message: "left room successfully" });
  } catch (err) {
    next(err);
  }
}

// DELETE /rooms/:roomId
async function closeRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await roomsService.closeRoom(req.user.id, req.params.roomId as string);
    sendSuccess(res, { message: "room closed" });
  } catch (err) {
    next(err);
  }
}

// GET /rooms/:roomId
async function getRoomDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const room = await roomsService.getRoomDetails(req.params.roomId as string);
    sendSuccess(res, room);
  } catch (err) {
    next(err);
  }
}

export const roomsController = { createRoom, joinRoom, leaveRoom, closeRoom, getRoomDetails };
