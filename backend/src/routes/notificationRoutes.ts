import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
} from "../controllers/notificationController";

const router = Router();

router.use(authenticate);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", markAsRead);

export default router;
