// global error handler - last middleware in the chain
// catches both AppError (intentional) and unexpected errors
// never exposes stack traces or internal details in production

import type { Request, Response, NextFunction } from "express";
import { AppError, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

// handles errors from all routes
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // zod validation errors
  if (err instanceof ZodError) {
    const details = env.NODE_ENV === "development"
      ? err.flatten().fieldErrors
      : undefined;
    sendError(res, "validation failed", 400, "VALIDATION_ERROR", details);
    return;
  }

  // our own operational errors - expected failures we threw intentionally
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error("non-operational app error", { error: err.message, stack: err.stack, path: req.path });
    }
    sendError(res, err.message, err.statusCode, err.code);
    return;
  }

  // prisma known request errors (constraint violations, not found, etc)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn("prisma known error", { code: err.code, meta: err.meta });

    switch (err.code) {
      case "P2002": // unique constraint
        sendError(res, "a record with that value already exists", 409, "DUPLICATE_ENTRY");
        return;
      case "P2025": // record not found
        sendError(res, "record not found", 404, "NOT_FOUND");
        return;
      case "P2003": // foreign key constraint
        sendError(res, "referenced record does not exist", 400, "INVALID_REFERENCE");
        return;
      default:
        sendError(res, "database error", 500, "DB_ERROR");
        return;
    }
  }

  // prisma validation errors (wrong data types etc)
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.warn("prisma validation error", { message: (err as Error).message });
    sendError(res, "invalid data format", 400, "VALIDATION_ERROR");
    return;
  }

  // anything else is unexpected - log it fully, hide details from client
  logger.error("unhandled error", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  sendError(
    res,
    env.NODE_ENV === "development"
      ? (err instanceof Error ? err.message : "unknown error")
      : "something went wrong on our end",
    500,
    "INTERNAL_ERROR"
  );
}
