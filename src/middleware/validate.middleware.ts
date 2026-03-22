// generic validation middleware factory
// pass a zod schema and it validates req.body, req.params, or req.query automatically
// if validation fails it throws to the global error handler - no duplicate try/catches in controllers

import type { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";

type RequestPart = "body" | "params" | "query";

// validates a specific part of the request against a zod schema
export function validate<T extends ZodSchema>(
  schema: T,
  part: RequestPart = "body"
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // parse and overwrite so downstream handlers get the typed + coerced version
      (req as any)[part] = schema.parse(req[part]);
      next();
    } catch (err) {
      next(err); // zod error bubbles to globalErrorHandler
    }
  };
}

// ─────────────────────────────────────────────
// reusable validation schemas
// ─────────────────────────────────────────────

export const roomCodeParamSchema = z.object({
  code: z.string().length(6).regex(/^[A-Z2-9]{6}$/, "invalid room code format"),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const langCodeSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "language code must be like 'en' or 'en-US'");
