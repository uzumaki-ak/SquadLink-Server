// rate limiters tuned for each type of endpoint
// auth = strict (prevents brute force), api = moderate, translate = controlled (mymemory quota)
// using sliding window to be fair to bursty-but-not-abusive users

import rateLimit from "express-rate-limit";
import { sendError } from "../utils/response.js";

// shared handler so the response shape stays consistent with the rest of the api
const rateLimitHandler = (
  _req: Parameters<typeof rateLimit>[0] extends { handler: infer H } ? never : never,
  res: Parameters<ReturnType<typeof rateLimit>>[1],
  _next: Parameters<ReturnType<typeof rateLimit>>[2],
  options: { message: string }
) => {
  sendError(res as any, options.message, 429, "RATE_LIMITED");
};

// auth endpoints: login, register - strict to prevent brute force
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "too many attempts, please wait 15 minutes",
  handler: (req, res) => sendError(res, "too many auth attempts, wait 15 minutes", 429, "RATE_LIMITED"),
});

// general api endpoints - generous for normal use, still blocks abuse
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 2 requests/second sustained - plenty for a game overlay
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => sendError(res, "request rate too high, slow down", 429, "RATE_LIMITED"),
});

// room creation - prevent someone spinning up hundreds of rooms
export const roomCreateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => sendError(res, "room creation limit reached for this hour", 429, "RATE_LIMITED"),
});

// translate - limited because mymemory has a daily quota
// 30 per minute per ip keeps us well within free limits even with many users
export const translateRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => sendError(res, "translation rate limit hit, wait a moment", 429, "RATE_LIMITED"),
});
