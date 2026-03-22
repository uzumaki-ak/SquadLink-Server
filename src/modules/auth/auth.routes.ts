// auth routes
// POST   /auth/profile         → create profile (runs once after supabase signup)
// GET    /auth/profile         → get own profile
// PATCH  /auth/profile/language → update language preference

import { Router } from "express";
import { authController } from "./auth.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate, langCodeSchema } from "../../middleware/validate.middleware.js";
import { z } from "zod";

const router = Router();

router.post("/profile", requireAuth, authController.createProfile);
router.get("/profile", requireAuth, authController.getProfile);
router.patch(
  "/profile/language",
  requireAuth,
  validate(z.object({ languageCode: langCodeSchema })),
  authController.updateLanguage
);

export default router;
