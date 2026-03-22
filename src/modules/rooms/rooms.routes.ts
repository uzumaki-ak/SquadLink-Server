// rooms routes
// POST   /rooms                    → create a room (returns code + room details)
// POST   /rooms/join               → join by code
// GET    /rooms/:roomId            → get room details + members list
// DELETE /rooms/:roomId/leave      → leave a room
// DELETE /rooms/:roomId            → close room (host only)

import { Router } from "express";
import { roomsController } from "./rooms.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { createRoomSchema, joinRoomSchema } from "./rooms.types.js";
import { roomCreateRateLimiter } from "../../middleware/rateLimiter.middleware.js";
import { z } from "zod";

const router = Router();

// all room routes require auth
router.use(requireAuth);

router.post("/", roomCreateRateLimiter, validate(createRoomSchema), roomsController.createRoom);
router.post("/join", validate(joinRoomSchema), roomsController.joinRoom);
router.get("/:roomId", roomsController.getRoomDetails);
router.delete("/:roomId/leave", roomsController.leaveRoom);
router.delete("/:roomId", roomsController.closeRoom);

export default router;
