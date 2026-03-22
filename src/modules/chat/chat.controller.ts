// chat controller
// only exposes the history endpoint over http
// actual live message sending/receiving goes through socket.io (see socket/chat.gateway.ts)

import type { Request, Response, NextFunction } from "express";
import { chatService } from "./chat.service.js";
import { sendSuccess } from "../../utils/response.js";
import { z } from "zod";

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  beforeId: z.string().optional(),
});

// GET /chat/:roomId/history
// called when a user opens a room or scrolls up to load older messages
async function getChatHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { limit, beforeId } = historyQuerySchema.parse(req.query);
    const messages = await chatService.getRoomChatHistory(
      req.params.roomId as string,
      limit,
      beforeId
    );
    sendSuccess(res, messages);
  } catch (err) {
    next(err);
  }
}

export const chatController = { getChatHistory };
