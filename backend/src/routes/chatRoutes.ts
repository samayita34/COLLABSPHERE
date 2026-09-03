import { Router } from "express";
import { 
    getChannels, 
    createDirectMessage, 
    createGroupChannel,
    getMessages, 
    sendMessage, 
    toggleReaction,
    markChannelAsRead,
    uploadChatFile,
    searchMessages,
    getWorkspaceChatUsers
} from "../controllers/chatController";
import { authenticate } from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = Router();

// Base path: /api/chat
router.use(authenticate);

// Channel operations
router.get("/channels", getChannels);
router.post("/channels/dm", createDirectMessage);
router.post("/channels/group", createGroupChannel);

// Messages in channel
router.get("/channels/:channelId/messages", getMessages);
router.post("/channels/:channelId/messages", sendMessage);
router.post("/channels/:channelId/read", markChannelAsRead);
router.get("/channels/:channelId/search", searchMessages);

// Emoji Reactions
router.post("/messages/:messageId/reactions", toggleReaction);

// File upload for chat
router.post("/upload", upload.single("file"), uploadChatFile);

// Workspace users for starting DMs / creating Groups
router.get("/users", getWorkspaceChatUsers);

export default router;
