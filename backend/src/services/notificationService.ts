import prisma from "../lib/prisma";
import { getIO } from "../lib/socket";
import { sendEmail } from "./emailService";
import { NotificationType } from "../../generated/prisma/enums";

export interface CreateNotificationInput {
    userId: string;
    workspaceId?: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    sendEmailNotification?: boolean;
}

export const createAndSendNotification = async (input: CreateNotificationInput) => {
    try {
        const { userId, workspaceId, type, title, message, link, sendEmailNotification = true } = input;

        // 1. Create In-App Notification in Database
        const notification = await prisma.notification.create({
            data: {
                userId,
                workspaceId,
                type,
                title,
                message,
                link,
            },
        });

        // 2. Emit real-time Socket.IO notification event to user room
        try {
            const io = getIO();
            io.to(`user:${userId}`).emit("notification", notification);
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
