import { Router } from "express";
import { 
    getChannels, 
    createDirectMessage, 
    getMessages, 
    sendMessage, 
    toggleReaction 
} from "../controllers/chatController";

import { authenticate } from "../middleware/auth";

const router = Router();

// Base path: /api/chat
router.use(authenticate);

router.get("/channels", getChannels);
router.post("/channels/dm", createDirectMessage);

router.get("/channels/:channelId/messages", getMessages);
router.post("/channels/:channelId/messages", sendMessage);
router.post("/messages/:messageId/reactions", toggleReaction);

export default router;
