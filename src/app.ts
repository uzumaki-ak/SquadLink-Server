import express, { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { env } from "./config/env.js";
import { apiRateLimiter } from "./middleware/rateLimiter.middleware.js";
import { globalErrorHandler } from "./middleware/errorHandler.middleware.js";
import { logger } from "./utils/logger.js";
import { sendSuccess, sendError } from "./utils/response.js";

import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import roomsRoutes from "./modules/rooms/rooms.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
import translateRoutes from "./modules/translate/translate.routes.js";

export function createApp(): Express {
  const app = express();

  // ─── security headers ─────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === "production",
    })
  );

  // ─── cors ─────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: (origin, callback) => {
        // allow requests with no origin - android app and postman have no origin header
        if (!origin || env.ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn("cors blocked request from unlisted origin", { origin });
          callback(new Error(`origin ${origin} not in allowlist`));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // ─── body + compression ───────────────────────────────────────────────────
  app.use(express.json({ limit: "50kb" }));
  app.use(express.urlencoded({ extended: true, limit: "50kb" }));
  app.use(compression());

  // ─── global rate limit on all /api routes ─────────────────────────────────
  app.use("/api", apiRateLimiter);

  // ─── health check ─────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    sendSuccess(res, { status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // ─── routes ───────────────────────────────────────────────────────────────
  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/rooms", roomsRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/translate", translateRoutes);

  // ─── 404 ──────────────────────────────────────────────────────────────────
  app.use((req, res) => {
    sendError(res, `${req.method} ${req.path} not found`, 404, "NOT_FOUND");
  });

  // ─── error handler (must be last middleware) ──────────────────────────────
  app.use(globalErrorHandler);

  return app;
}
