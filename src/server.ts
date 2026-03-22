// entry point - boots the http server and attaches socket.io
// handles graceful shutdown so in-flight requests finish before process exits

import { createServer } from "http";
import { createApp } from "./app.js";
import { createSocketServer } from "./socket/socket.server.js";
import { prisma } from "./config/prisma.js";
import { logger } from "./utils/logger.js";
import { env } from "./config/env.js";

async function bootstrap() {
  // verify db connection before accepting traffic
  try {
    await prisma.$connect();
    logger.info("database connected");
  } catch (err) {
    logger.error("failed to connect to database", { error: (err as Error).message });
    process.exit(1);
  }

  const app = createApp();
  const httpServer = createServer(app);

  // attach socket.io to the same http server
  const io = createSocketServer(httpServer);

  httpServer.listen(env.PORT, "0.0.0.0", () => {
    logger.info(`squadlink-server running`, {
      port: env.PORT,
      host: "0.0.0.0",
      env: env.NODE_ENV,
    });
  });

  // ─── graceful shutdown ────────────────────────────────────────────────────
  // give active connections up to 10 seconds to finish before forcing close
  async function shutdown(signal: string) {
    logger.info(`${signal} received - shutting down gracefully`);

    // stop accepting new socket connections
    io.close(() => logger.info("socket.io closed"));

    // stop accepting new http connections
    httpServer.close(async () => {
      logger.info("http server closed");

      try {
        await prisma.$disconnect();
        logger.info("database disconnected");
      } catch (err) {
        logger.error("error disconnecting database", { error: (err as Error).message });
      }

      process.exit(0);
    });

    // force exit after 10s if something hangs
    setTimeout(() => {
      logger.error("graceful shutdown timed out - forcing exit");
      process.exit(1);
    }, 10_000);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // log unhandled promise rejections instead of crashing silently
  process.on("unhandledRejection", (reason) => {
    logger.error("unhandled promise rejection", { reason });
  });

  process.on("uncaughtException", (err) => {
    logger.error("uncaught exception", { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

bootstrap();
