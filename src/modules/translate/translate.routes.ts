// translate routes
// POST /translate   → translate text, proxied to mymemory (free, no key needed)

import { Router } from "express";
import { translateController } from "./translate.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { translateTextSchema } from "./translate.types.js";
import { translateRateLimiter } from "../../middleware/rateLimiter.middleware.js";

const router: Router = Router();

router.post(
  "/",
  requireAuth,
  translateRateLimiter,
  validate(translateTextSchema),
  translateController.translate
);

export default router;
