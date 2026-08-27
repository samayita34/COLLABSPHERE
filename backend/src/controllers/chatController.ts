import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { getIO } from "../lib/socket";
import { createAndSendNotification } from "../services/notificationService";
import { NotificationType } from "../../generated/prisma/enums";

function formatMessage(msg: any) {
    let senderName: string | undefined = undefined;
    if (msg.project) {
        const getInitials = (fn?: string | null, ln?: string | null, email?: string) => {
            const f = (fn || "").trim()[0] || "";
            const l = (ln || "").trim()[0] || "";
            if (f || l) return (f + l).toUpperCase();
            return (email || "").slice(0, 2).toUpperCase();
        };

        const owner = msg.project.owner;
        if (owner && getInitials(owner.firstName, owner.lastName, owner.email) === msg.senderInitials) {
            senderName = `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || owner.email;
        } else if (Array.isArray(msg.project.members)) {
            const match = msg.project.members.find((m: any) => 
                m.user && getInitials(m.user.firstName, m.user.lastName, m.user.email) === msg.senderInitials
            );
            if (match?.user) {
                senderName = `${match.user.firstName || ""} ${match.user.lastName || ""}`.trim() || match.user.email;
            }
        }
    }

    return {
        id: msg.id,
        senderInitials: msg.senderInitials,
        senderName,
        text: msg.text,
        timestamp: msg.createdAt.toISOString(),
        projectId: msg.projectId,
        projectName: msg.project?.name || "",
        projectCode: msg.project?.code || null,
        projectStatus: msg.project?.status || "",
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
    };
}

/**
 * GET /api/projects/:projectId/messages
 * Fetch all chat messages for a project ordered chronologically (asc).
 */
export const getProjectMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;

        // requireProjectAccess has verified access and project existence.

        const messages = await prisma.chatMessage.findMany({
            where: { projectId },
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        status: true,
                        owner: { select: { firstName: true, lastName: true, email: true } },
                        members: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        res.status(200).json({
            success: true,
            count: messages.length,
            data: messages.map(formatMessage),
        });
    } catch (error) {
        console.error("Error fetching project messages:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch project messages",
        });
    }
};

/**
 * POST /api/projects/:projectId/messages
 * Post a new chat message to a project.
 */
export const sendProjectMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { text, senderInitials } = req.body;

        // requireProjectAccess has verified access and project existence.

        if (!text || typeof text !== "string" || text.trim() === "") {
            res.status(400).json({
                success: false,
                error: "Message text is required and must be a non-empty string",
            });
            return;
        }

        if (!senderInitials || typeof senderInitials !== "string" || senderInitials.trim() === "") {
            res.status(400).json({
                success: false,
                error: "senderInitials is required and must be a non-empty string",
            });
            return;
        }

        const newMessage = await prisma.chatMessage.create({
            data: {
                text: text.trim(),
                senderInitials: senderInitials.trim().toUpperCase(),
                projectId,
            },
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        status: true,
                        owner: { select: { firstName: true, lastName: true, email: true } },
                        members: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
                    },
                },
            },
        });

        const formattedMessage = formatMessage(newMessage);

        try {
            getIO().to(projectId).emit("newMessage", formattedMessage);
        } catch (e) {
            console.error("Failed to emit socket event", e);
        }

        // Trigger Notifications for @mentions or project members
        try {
            const projectMembers = await prisma.projectMember.findMany({
                where: { projectId },
                select: { userId: true, user: { select: { email: true, firstName: true } } },
            });
            const projectOwnerId = req.project?.ownerId;
            const allUserIds = new Set<string>();
            if (projectOwnerId) allUserIds.add(projectOwnerId);
            projectMembers.forEach((pm: any) => allUserIds.add(pm.userId));
            allUserIds.delete(req.user?.id || "");

            // Detect @mentions in text
            const lowerText = text.toLowerCase();
            for (const userId of allUserIds) {
                const memberUser = projectMembers.find((m: any) => m.userId === userId)?.user;
                const isMentioned = memberUser && (
                    lowerText.includes(`@${memberUser.firstName.toLowerCase()}`) ||
                    lowerText.includes(`@${memberUser.email.toLowerCase()}`)
                );

                if (isMentioned) {
                    createAndSendNotification({
                        userId,
                        workspaceId: req.workspace?.id,
                        type: NotificationType.MENTION,
                        title: "You were mentioned in chat",
                        message: `${formattedMessage.senderName || senderInitials} mentioned you in project ${req.project?.name || ""}: "${text.slice(0, 60)}"`,
                        link: `/projects/${projectId}`,
                    }).catch(console.error);
                }
            }
        } catch (notifErr) {
            console.error("Chat notification error:", notifErr);
        }

        res.status(201).json({
            success: true,
            message: "Message sent successfully",
            data: formattedMessage,
        });
    } catch (error) {
        console.error("Error sending project message:", error);
        res.status(500).json({
            success: false,
            error: "Failed to send message",
        });
    }
};
