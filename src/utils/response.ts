// standard api response wrappers
// every endpoint returns { success, data } or { success, error }
// consistent shape means the android app never has to guess the format

import type { Response } from "express";

interface SuccessResponse<T> {
  success: true;
  data: T;
}
// sends a 200 success response
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const body: SuccessResponse<T> = { success: true, data };
  res.status(statusCode).json(body);
}

// sends an error response - never leaks stack traces in production
export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  code = "INTERNAL_SERVER_ERROR",
  details?: any
): void => {
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      ...(details && { details }),
    },
  });
};

// typed app error class so we can throw structured errors from anywhere
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // operational = expected, non-operational = crash

    // needed for instanceof checks when extending Error in typescript
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
