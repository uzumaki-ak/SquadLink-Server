// types and schemas for the chat module

import { z } from "zod";
import { MessageType } from "@prisma/client";

// valid quick command strings - same list rendered as buttons in the android app
export const QUICK_COMMANDS = [
  "enemy here",
  "rush now",
  "cover me",
  "wait",
  "fall back",
  "need heal",
  "i got it",
  "nice",
] as const;

export type QuickCommand = (typeof QUICK_COMMANDS)[number];

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(500).trim(),
  type: z.nativeEnum(MessageType).default(MessageType.TEXT),
});

export const sendQuickCommandSchema = z.object({
  command: z.enum(QUICK_COMMANDS),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SendQuickCommandInput = z.infer<typeof sendQuickCommandSchema>;
