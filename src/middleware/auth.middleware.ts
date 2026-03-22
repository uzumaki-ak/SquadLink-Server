// verifies supabase jwt tokens and attaches the user to req.user
// every protected route runs this before its controller

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/response.js";
import { logger } from "../utils/logger.js";

// checks authorization header, verifies the jwt, loads user from db
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("missing or malformed authorization header", 401, "UNAUTHORIZED");
    }

    const token = authHeader.slice(7); // strip "Bearer "

    // verify signature - throws if expired or tampered
    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, env.SUPABASE_JWT_SECRET) as jwt.JwtPayload;
    } catch {
      throw new AppError("invalid or expired token", 401, "TOKEN_INVALID");
    }

    const userId = decoded.sub;
    if (!userId) {
      throw new AppError("token has no subject claim", 401, "TOKEN_INVALID");
    }

    // load user profile - prisma result is typed so we never accidentally
    // pass undefined fields to downstream handlers
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, languageCode: true },
    });

    if (!user) {
      // user authenticated with supabase but hasn't completed their squadlink profile
      throw new AppError("user profile not found - please complete onboarding", 404, "PROFILE_NOT_FOUND");
    }

    req.user = user;
    next();
  } catch (err) {
    logger.debug("auth middleware rejected request", { error: (err as Error).message });
    next(err);
  }
}
