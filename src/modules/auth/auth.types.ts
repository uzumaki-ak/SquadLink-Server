// types for auth module request/response shapes

import { z } from "zod";

// what the android app sends when creating a profile after supabase signup
export const createProfileSchema = z.object({
  username: z
    .string()
    .min(3, "username must be at least 3 characters")
    .max(30, "username can be at most 30 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "username can only contain letters, numbers, underscores, hyphens"),
  languageCode: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
    .default("en"),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
