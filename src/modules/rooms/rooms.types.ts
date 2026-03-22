// zod schemas for rooms module

import { z } from "zod";

export const createRoomSchema = z.object({
  maxMembers: z.coerce.number().int().min(2).max(8).default(8),
});

export const joinRoomSchema = z.object({
  code: z
    .string()
    .toUpperCase()
    .length(6)
    .regex(/^[A-Z2-9]{6}$/, "invalid room code"),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
