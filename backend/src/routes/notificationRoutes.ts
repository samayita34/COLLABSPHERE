import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    clearReadNotifications,
    triggerTestNotification,
    checkDueDates,
} from "../controllers/notificationController";

const router = Router();

router.use(authenticate);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.post("/test", triggerTestNotification);
router.post("/check-due-dates", checkDueDates);
router.patch("/read-all", markAllAsRead);
router.delete("/clear-read", clearReadNotifications);
router.patch("/:id/read", markAsRead);
router.patch("/:id/unread", markAsUnread);
router.delete("/:id", deleteNotification);

export default router;


