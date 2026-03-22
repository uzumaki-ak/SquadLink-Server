// validates every environment variable at startup
// if anything is missing the server refuses to start - better than a cryptic runtime crash later

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),

  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid url"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  SUPABASE_JWT_SECRET: z.string().min(1, "SUPABASE_JWT_SECRET is required"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  MYMEMORY_EMAIL: z.string().email().optional(),

  ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((val) => val.split(",").map((o) => o.trim())),
});

// parse and throw immediately if invalid - no silent failures
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
