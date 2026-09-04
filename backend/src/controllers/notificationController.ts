import { Request, Response } from "express";
import prisma from "../lib/prisma";
import {
    createAndSendNotification,
    checkAndSendDueDateReminders,
    checkAndSendOverdueAlerts,
} from "../services/notificationService";
import { NotificationType } from "../../generated/prisma/enums";

/**
 * GET /api/notifications
 * Get paginated list of notifications for the authenticated user.
 */
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Authentication required" });
            return;
        }

        const workspaceId = req.query.workspaceId as string | undefined;
        const unreadOnly = req.query.unreadOnly === "true";
        const type = req.query.type as string | undefined;
        const category = req.query.category as string | undefined;
        const page = parseInt(req.query.page as string || "1", 10);
        const limit = parseInt(req.query.limit as string || "30", 10);
        const skip = (page - 1) * limit;

        const whereCondition: any = { userId };
        if (workspaceId) {
            whereCondition.workspaceId = workspaceId;
        }
        if (unreadOnly) {
            whereCondition.isRead = false;
        }

        if (type) {
            whereCondition.type = type;
        } else if (category) {
            const cat = category.toUpperCase();
            if (cat === "TASKS") {
                whereCondition.type = {
                    in: [
                        NotificationType.TASK_ASSIGNED,
                        NotificationType.TASK_UPDATED,
                        NotificationType.TASK_STATUS_CHANGED,
                        NotificationType.TASK_PRIORITY_CHANGED,
                        NotificationType.DUE_DATE_REMINDER,
                        NotificationType.TASK_OVERDUE,
                        NotificationType.TASK_COMMENT,
                        NotificationType.SUBTASK_COMPLETED,
                    ],
                };
            } else if (cat === "MENTIONS") {
                whereCondition.type = {
                    in: [NotificationType.MENTION, NotificationType.TASK_MENTION],
                };
            } else if (cat === "DOCUMENTS") {
                whereCondition.type = NotificationType.DOCUMENT_EDITED;
            } else if (cat === "FILES") {
                whereCondition.type = NotificationType.FILE_UPLOADED;
            } else if (cat === "CHAT") {
                whereCondition.type = NotificationType.CHAT_MESSAGE;
            } else if (cat === "INVITATIONS" || cat === "INVITES") {
                whereCondition.type = {
                    in: [
                        NotificationType.WORKSPACE_INVITATION,
                        NotificationType.PROJECT_MEMBER_ADDED,
                        NotificationType.PROJECT_MEMBER_REMOVED,
                    ],
                };
            }
        }

        const [notifications, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where: whereCondition,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.notification.count({ where: whereCondition }),
            prisma.notification.count({ where: { userId, isRead: false } }),
        ]);

        res.status(200).json({
            success: true,
            data: notifications,
            unreadCount,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        console.error("getNotifications error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch notifications" });
    }
};

/**
 * GET /api/notifications/unread-count
 * Quick fetch for the unread badge count.
 */
export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Authentication required" });
            return;
        }

        const count = await prisma.notification.count({
            where: { userId, isRead: false },
        });

        res.status(200).json({ success: true, count });
    } catch (error) {
        console.error("getUnreadCount error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch unread count" });
    }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
            res.status(401).json({ success: false, error: "Authentication required" });
            return;
        }

        const notification = await prisma.notification.findUnique({
            where: { id },
        });

        if (!notification || notification.userId !== userId) {
            res.status(404).json({ success: false, error: "Notification not found" });
            return;
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });

        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error("markAsRead error:", error);
        res.status(500).json({ success: false, error: "Failed to mark notification as read" });
    }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications for the authenticated user as read.
 */
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Authentication required" });
            return;
        }

        const workspaceId = req.body?.workspaceId as string | undefined;
        const whereCondition: any = { userId, isRead: false };
        if (workspaceId) {
            whereCondition.workspaceId = workspaceId;
        }

        await prisma.notification.updateMany({
            where: whereCondition,
            data: { isRead: true },
        });

        res.status(200).json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
        console.error("markAllAsRead error:", error);
        res.status(500).json({ success: false, error: "Failed to mark all as read" });
    }
};

/**
 * PATCH /api/notifications/:id/unread
 * Mark a single notification as unread.
 */
export const markAsUnread = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
            res.status(401).json({ success: false, error: "Authentication required" });
            return;
        }

        const notification = await prisma.notification.findUnique({
            where: { id },
        });

        if (!notification || notification.userId !== userId) {
            res.status(404).json({ success: false, error: "Notification not found" });
            return;
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: { isRead: false },
        });

        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error("markAsUnread error:", error);
        res.status(500).json({ success: false, error: "Failed to mark notification as unread" });
    }
};

/**
 * DELETE /api/notifications/:id
 * Delete a single notification.
 */
export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
            res.status(401).json({ success: false, error: "Authentication required" });
            return;
        }

        const notification = await prisma.notification.findUnique({
            where: { id },
        });

        if (!notification || notification.userId !== userId) {
            res.status(404).json({ success: false, error: "Notification not found" });
            return;
        }

        await prisma.notification.delete({
            where: { id },
        });

        res.status(200).json({ success: true, message: "Notification deleted" });
    } catch (error) {
        console.error("deleteNotification error:", error);
        res.status(500).json({ success: false, error: "Failed to delete notification" });
    }
};

/**
 * DELETE /api/notifications/clear-read
 * Delete all read notifications for the authenticated user.
 */
export const clearReadNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Authentication required" });
            return;
        }

        const workspaceId = req.query.workspaceId as string | undefined;
        const whereCondition: any = { userId, isRead: true };
        if (workspaceId) {
            whereCondition.workspaceId = workspaceId;
        }

        const result = await prisma.notification.deleteMany({
            where: whereCondition,
        });

        res.status(200).json({ success: true, message: "Read notifications cleared", count: result.count });
    } catch (error) {
        console.error("clearReadNotifications error:", error);
        res.status(500).json({ success: false, error: "Failed to clear read notifications" });
    }
};

/**
 * POST /api/notifications/test
 * Trigger a live test notification for the authenticated user (or target user).
 */
export const triggerTestNotification = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.body?.userId || req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Authentication required" });
            return;
        }

        const {
            type = NotificationType.TASK_ASSIGNED,
            title = "New Task Assigned",
            message = "You have been assigned to 'Design System & Notification Hub'.",
            link = "/projects",
            workspaceId,
        } = req.body || {};

        const notification = await createAndSendNotification({
            userId,
            workspaceId,
            type: type as NotificationType,
            title,
            message,
            link,
            sendEmailNotification: false,
        });

        res.status(201).json({
            success: true,
            message: "Test notification triggered successfully",
            data: notification,
        });
    } catch (error: any) {
        console.error("triggerTestNotification error:", error);
        res.status(500).json({ success: false, error: "Failed to trigger test notification" });
    }
};

/**
 * POST /api/notifications/check-due-dates
 * Check and send due date reminders and overdue alerts.
 */
export const checkDueDates = async (_req: Request, res: Response): Promise<void> => {
    try {
        await checkAndSendDueDateReminders();
        await checkAndSendOverdueAlerts();
        res.status(200).json({ success: true, message: "Due date and overdue alerts checked and dispatched" });
    } catch (error: any) {
        console.error("checkDueDates error:", error);
        res.status(500).json({ success: false, error: "Failed to check due date reminders" });
    }
};


