import prisma from "../lib/prisma";
import { getIO } from "../lib/socket";
import { sendEmail } from "./emailService";
import { NotificationType } from "../../generated/prisma/enums";

export interface CreateNotificationInput {
    userId: string;
    workspaceId?: string;
    projectId?: string;
    taskId?: string;
    documentId?: string;
    fileId?: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    sendEmailNotification?: boolean;
}

export const createAndSendNotification = async (input: CreateNotificationInput) => {
    try {
        const { userId, workspaceId, projectId, taskId, documentId, fileId, type, title, message, link, sendEmailNotification = true } = input;

        // 1. Create In-App Notification in Database
        const notification = await prisma.notification.create({
            data: {
                userId,
                workspaceId,
                projectId,
                taskId,
                documentId,
                fileId,
                type,
                title,
                message,
                link,
                isRead: false,
                read: false,
            },
        });

        // 2. Emit real-time Socket.IO notification event to dedicated user room (user:${userId})
        try {
            const io = getIO();
            const roomName = `user:${userId}`;
            io.to(roomName).emit("notification:new", notification);
            io.to(roomName).emit("notification", notification);
        } catch (socketError) {
            console.error("[NotificationService] Socket.IO emit warning:", socketError);
        }

        // 3. Send Email Notification (Async / non-blocking)
        if (sendEmailNotification) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, firstName: true },
            });

            if (user && user.email) {
                const actionUrl = link ? `${process.env.FRONTEND_URL || "http://localhost:5173"}${link}` : undefined;
                const html = `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
                        <h2 style="color: #6366f1;">${title}</h2>
                        <p>Hi <strong>${user.firstName}</strong>,</p>
                        <p>${message}</p>
                        ${actionUrl ? `
                            <p style="margin-top: 20px;">
                                <a href="${actionUrl}" style="background-color: #6366f1; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold;">View in COLLABSPHERE</a>
                            </p>
                        ` : ""}
                        <hr style="margin-top: 30px; border: none; border-top: 1px solid #e2e8f0;" />
                        <p style="font-size: 12px; color: #94a3b8;">This is an automated notification from COLLABSPHERE.</p>
                    </div>
                `;
                
                // Fire and forget
                sendEmail(user.email, `[COLLABSPHERE] ${title}`, message, html).catch((err) => {
                    console.error("[NotificationService] Email delivery error:", err);
                });
            }
        }

        return notification;
    } catch (error) {
        console.error("[NotificationService] Failed to create notification:", error);
        return null;
    }
};

/**
 * Periodically checks tasks due within 24 hours and sends reminders without duplication.
 */
export const checkAndSendDueDateReminders = async () => {
    try {
        const now = new Date();
        const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Find tasks due within 24 hours that are not completed
        const dueSoonTasks = await prisma.task.findMany({
            where: {
                dueDate: {
                    gte: now,
                    lte: next24h,
                },
                status: { not: "DONE" },
                assigneeId: { not: null },
            },
            include: {
                project: { select: { id: true, name: true, workspaceId: true } },
            },
        });

        for (const task of dueSoonTasks) {
            if (!task.assigneeId) continue;

            // Check if reminder was already sent today for this task
            const existing = await prisma.notification.findFirst({
                where: {
                    userId: task.assigneeId,
                    taskId: task.id,
                    type: NotificationType.DUE_DATE_REMINDER,
                    createdAt: { gte: startOfDay },
                },
            });

            if (!existing) {
                await createAndSendNotification({
                    userId: task.assigneeId,
                    workspaceId: task.project.workspaceId,
                    projectId: task.projectId,
                    taskId: task.id,
                    type: NotificationType.DUE_DATE_REMINDER,
                    title: "Due Date Reminder",
                    message: `Task "${task.title}" in ${task.project.name} is due within 24 hours!`,
                    link: `/projects/${task.projectId}`,
                    sendEmailNotification: true,
                });
            }
        }
    } catch (error) {
        console.error("[NotificationService] Error checking due date reminders:", error);
    }
};
