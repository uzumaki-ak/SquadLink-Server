// users routes
// PATCH  /users/me          → update display name or avatar
// GET    /users/me/rooms    → room history for home screen "rejoin" list

import { Router } from "express";
import { usersController } from "./users.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { updateProfileSchema } from "./users.types.js";

const router: Router = Router();

router.patch("/me", requireAuth, validate(updateProfileSchema), usersController.updateProfile);
router.get("/me/rooms", requireAuth, usersController.getRoomHistory);

export default router;
