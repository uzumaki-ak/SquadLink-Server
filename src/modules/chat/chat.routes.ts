// chat routes (http only - real-time is via socket.io)
// GET  /chat/:roomId/history   → paginated message history for a room

import { Router } from "express";
import { chatController } from "./chat.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";

const router: Router = Router();

router.get("/:roomId/history", requireAuth, chatController.getChatHistory);

export default router;
