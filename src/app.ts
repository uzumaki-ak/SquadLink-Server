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

  // Render uses a reverse proxy. This is required for express-rate-limit
  // to see the real client IP instead of the proxy IP.
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === "production",
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Android app and tools like Postman usually send no Origin header.
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

  app.use(express.json({ limit: "50kb" }));
  app.use(express.urlencoded({ extended: true, limit: "50kb" }));
  app.use(compression());

  app.use("/api", apiRateLimiter);

  // Root page for direct visits and Supabase redirect landings.
  // It only shows "Email verified" when a real auth hash contains access_token.
  app.get("/", (_req, res) => {
    res.send(`
      <!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SquadLink API</title>
        <style>
          body {
            margin: 0;
            padding: 24px;
            background: #0a0a0a;
            color: #f5f5f5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          #msg { white-space: pre-wrap; line-height: 1.5; }
        </style>
      </head>
      <body>
        <p id="msg">SquadLink API is running. Use /health for status.</p>
        <script>
          const hash = window.location.hash.startsWith("#")
            ? window.location.hash.slice(1)
            : "";

          if (hash) {
            const params = new URLSearchParams(hash);
            const msg = document.getElementById("msg");

            if (params.has("access_token")) {
              msg.innerText = "Email verified. Return to the SquadLink app and sign in.";
            } else if (params.has("error_description")) {
              const errorText = decodeURIComponent(params.get("error_description") || "unknown error")
                .replace(/\+/g, " ");
              msg.innerText = "Verification failed: " + errorText;
            } else {
              msg.innerText = "Authentication redirect received. Return to the SquadLink app.";
            }
          }
        </script>
      </body>
      </html>
    `);
  });

  app.get("/health", (_req, res) => {
    sendSuccess(res, {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/rooms", roomsRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/translate", translateRoutes);

  app.use((req, res) => {
    sendError(res, `${req.method} ${req.path} not found`, 404, "NOT_FOUND");
  });

  app.use(globalErrorHandler);

  return app;
}
