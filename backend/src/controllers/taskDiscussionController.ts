import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { createAndSendNotification } from "../services/notificationService";
import { logAuditAction } from "../services/auditService";
import { NotificationType } from "../../generated/prisma/enums";
import { getIO } from "../lib/socket";
import xss from "xss";

const safeUserSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true,
};

function formatAuthor(u: any) {
    if (!u) return { id: "", fullName: "Anonymous", initials: "AN" };
    const fn = u.firstName || "";
    const ln = u.lastName || "";
    const fullName = `${fn} ${ln}`.trim() || u.email || "Member";
    const initials = ((fn[0] || "") + (ln[0] || "")).toUpperCase() || (u.email ? u.email.slice(0, 2).toUpperCase() : "MB");
    return {
        id: u.id,
        fullName,
        initials,
        firstName: fn,
        lastName: ln,
        email: u.email,
        avatar: u.avatar || null,
    };
}

function formatComment(c: any): any {
    return {
        id: c.id,
        text: c.text,
        taskId: c.taskId,
        authorId: c.authorId,
        author: formatAuthor(c.author),
        parentId: c.parentId,
        attachments: c.attachments || [],
        mentions: (c.mentions || []).map((m: any) => ({
            id: m.id,
            userId: m.userId,
            user: formatAuthor(m.user),
        })),
        replies: (c.replies || []).map(formatComment),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
    };
}

export const getComments = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;

        const comments = await prisma.taskComment.findMany({
            where: { taskId, parentId: null },
            orderBy: { createdAt: "asc" },
            include: {
                author: { select: safeUserSelect },
                mentions: {
                    include: { user: { select: safeUserSelect } }
                },
                attachments: true,
                replies: {
                    orderBy: { createdAt: "asc" },
                    include: {
                        author: { select: safeUserSelect },
                        mentions: {
                            include: { user: { select: safeUserSelect } }
                        },
                        attachments: true,
                    }
                }
            }
        });

        res.status(200).json({ success: true, data: comments.map(formatComment) });
    } catch (error: any) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch comments" });
    }
};

export const createComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;
        const { text, parentId, mentions = [], attachments = [] } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        if (!text || typeof text !== "string" || text.trim() === "") {
            res.status(400).json({ success: false, error: "Comment text is required" });
            return;
        }

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { project: true }
        });

        if (!task) {
            res.status(404).json({ success: false, error: "Task not found" });
            return;
        }

        const comment = await prisma.taskComment.create({
            data: {
                text: xss(text.trim()),
                taskId,
                authorId: userId,
                parentId: parentId || null,
                attachments: {
                    connect: Array.isArray(attachments) ? attachments.map((id: string) => ({ id })) : []
                },
                mentions: {
                    create: Array.isArray(mentions) ? mentions.map((mentionedUserId: string) => ({
                        userId: mentionedUserId
                    })) : []
                }
            },
            include: {
                author: { select: safeUserSelect },
                mentions: { include: { user: { select: safeUserSelect } } },
                attachments: true,
                replies: {
                    include: { author: { select: safeUserSelect } }
                }
            }
        });

        const formatted = formatComment(comment);

        // Notifications
        if (task.assigneeId && task.assigneeId !== userId) {
            createAndSendNotification({
                userId: task.assigneeId,
                workspaceId: req.workspace?.id,
                projectId: task.projectId,
                taskId: task.id,
                type: NotificationType.TASK_COMMENT,
                title: "New comment on your task",
                message: `${formatted.author.fullName} commented on "${task.title}"`,
                link: `/projects/${task.projectId}`
            }).catch((err) => console.error("Notification error:", err));
        }

        if (Array.isArray(comment.mentions)) {
            for (const mention of comment.mentions) {
                if (mention.userId !== userId) {
                    createAndSendNotification({
                        userId: mention.userId,
                        workspaceId: req.workspace?.id,
                        projectId: task.projectId,
                        taskId: task.id,
                        type: NotificationType.TASK_MENTION,
                        title: "You were mentioned",
                        message: `${formatted.author.fullName} mentioned you in a comment on "${task.title}"`,
                        link: `/projects/${task.projectId}`
                    }).catch((err) => console.error("Notification error:", err));
                }
            }
        }

        // Audit Logging
        logAuditAction({
            userId,
            workspaceId: req.workspace?.id,
            projectId: task.projectId,
            action: "TASK_COMMENT_CREATED",
            entityType: "TaskComment",
            entityId: comment.id,
            details: { taskId: task.id, hasMentions: mentions.length > 0 }
        }).catch((err) => console.error("Audit log error:", err));

        // Emit real-time Socket event to project room
        try {
            getIO().to(task.projectId).emit("task_comment_created", {
                taskId,
                comment: formatted,
            });
        } catch (socketErr) {
            console.error("Socket emit task_comment_created error:", socketErr);
        }

        res.status(201).json({ success: true, data: formatted });
    } catch (error: any) {
        console.error("Error creating comment:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to create comment" });
    }
};

export const deleteComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const { commentId } = req.params;
        const userId = req.user?.id;

        const comment = await prisma.taskComment.findUnique({
            where: { id: commentId },
            include: { task: true }
        });

        if (!comment) {
            res.status(404).json({ success: false, error: "Comment not found" });
            return;
        }

        if (comment.authorId !== userId) {
            res.status(403).json({ success: false, error: "You can only delete your own comments" });
            return;
        }

        await prisma.taskComment.delete({
            where: { id: commentId }
        });

        logAuditAction({
            userId,
            workspaceId: req.workspace?.id,
            projectId: comment.task.projectId,
            action: "TASK_COMMENT_DELETED",
            entityType: "TaskComment",
            entityId: commentId as string,
            details: { taskId: comment.taskId }
        }).catch((err) => console.error("Audit log error:", err));

        // Emit real-time Socket event
        try {
            getIO().to(comment.task.projectId).emit("task_comment_deleted", {
                taskId: comment.taskId,
                commentId,
            });
        } catch (socketErr) {
            console.error("Socket emit task_comment_deleted error:", socketErr);
        }

        res.status(200).json({ success: true, message: "Comment deleted" });
    } catch (error: any) {
        console.error("Error deleting comment:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to delete comment" });
    }
};

