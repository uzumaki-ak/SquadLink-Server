// single prisma instance for the whole server
// prisma already manages a connection pool internally
// creating multiple instances = connection leak

import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// in dev, hot reload would create multiple instances without this guard
if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
