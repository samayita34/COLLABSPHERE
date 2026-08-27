import { Request, Response } from "express";
import prisma from "../lib/prisma";

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
        const page = parseInt(req.query.page as string || "1", 10);
        const limit = parseInt(req.query.limit as string || "20", 10);
        const skip = (page - 1) * limit;

        const whereCondition: any = { userId };
        if (workspaceId) {
            whereCondition.workspaceId = workspaceId;
        }
        if (unreadOnly) {
            whereCondition.isRead = false;
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
            data: { isRead: true, read: true },
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
            data: { isRead: true, read: true },
        });

        res.status(200).json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
        console.error("markAllAsRead error:", error);
        res.status(500).json({ success: false, error: "Failed to mark all as read" });
    }
};
