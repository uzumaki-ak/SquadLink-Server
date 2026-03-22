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
  
  // ─── environment settings ─────────────────────────────────────────────────
  // render uses a reverse proxy, required for express-rate-limit to get the real ip
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

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

  // ─── landing page ────────────────────────────────────────────────────────
  // shown when users click supabase confirmation links
  app.get("/", (_req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SquadLink | Verified</title>
          <style>
              body { font-family: sans-serif; background: #0a0a0a; color: #00ff41; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .card { border: 1px solid #00ff41; padding: 40px; border-radius: 12px; box-shadow: 0 0 20px rgba(0,255,65,0.2); }
              h1 { margin-bottom: 8px; }
              p { color: #888; }
          </style>
      </head>
      <body>
          <div class="card">
              <h1>Email Verified!</h1>
              <p>You can now return to the SquadLink app.</p>
          </div>
      </body>
      </html>
    `);
  });

  // ─── dynamic landing page ────────────────────────────────────────────────
  // handles supabase auth redirects and shows state based on url hash
  app.get("/", (_req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SquadLink | Auth</title>
          <style>
              body { font-family: -apple-system, blinkmacsystemfont, \"Segoe UI\", roboto, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .card { border: 1px solid #333; padding: 40px; border-radius: 16px; background: #111; max-width: 400px; width: 90%; }
              h1 { margin-bottom: 12px; font-size: 24px; }
              #status.success { color: #00ff41; }
              #status.error { color: #ff4b2b; }
              p { color: #888; line-height: 1.5; }
              .hidden { display: none; }
          </style>
      </head>
      <body>
          <div id=\"content\" class=\"card hidden\">
              <h1 id=\"status\">Verifying...</h1>
              <p id=\"msg\">Please wait while we check your credentials.</p>
          </div>

          <script>
              const hash = window.location.hash;
              const params = new URLSearchParams(hash.substring(1));
              const content = document.getElementById('content');
              const status = document.getElementById('status');
              const msg = document.getElementById('msg');

              if (params.has('access_token')) {
                  content.classList.remove('hidden');
                  status.innerText = 'Email Verified!';
                  status.className = 'success';
                  msg.innerText = 'Your account is now confirmed. You can return to the app and sign in.';
              } else if (params.has('error_description')) {
                  content.classList.remove('hidden');
                  status.innerText = 'Verification Error';
                  status.className = 'error';
                  msg.innerText = decodeURIComponent(params.get('error_description')).replace(/\\+/g, ' ');
              } else {
                  window.location.href = '/health';
              }
          </script>
      </body>
      </html>
    `);
  });

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
