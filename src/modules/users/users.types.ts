// types for the users module

import { z } from "zod";

export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  avatarUrl: z.string().url("must be a valid url").optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "at least one field must be provided" }
);

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
