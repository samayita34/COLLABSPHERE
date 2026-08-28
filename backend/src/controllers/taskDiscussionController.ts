import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { createAndSendNotification } from "../services/notificationService";
import { createAuditLog } from "../services/auditService";
import { NotificationType, AuditAction } from "../../generated/prisma/enums";
import xss from "xss";

export const getComments = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;

        // Fetch comments and include author details, mentions, and nested replies (1 level deep is usually enough for a standard task discussion, or flat list sorted by created)
        const comments = await prisma.taskComment.findMany({
            where: { taskId, parentId: null },
            orderBy: { createdAt: "asc" },
            include: {
                author: { select: { id: true, fullName: true, initials: true } },
                mentions: {
                    include: { user: { select: { id: true, fullName: true, initials: true } } }
                },
                attachments: true,
                replies: {
                    orderBy: { createdAt: "asc" },
                    include: {
                        author: { select: { id: true, fullName: true, initials: true } },
                        mentions: {
                            include: { user: { select: { id: true, fullName: true, initials: true } } }
                        },
                        attachments: true,
                    }
                }
            }
        });

        res.status(200).json({ success: true, data: comments });
    } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ success: false, error: "Failed to fetch comments" });
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

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { project: true }
        });

        if (!task) {
            res.status(404).json({ success: false, error: "Task not found" });
            return;
        }

        // Create comment
        const comment = await prisma.taskComment.create({
            data: {
                text: xss(text),
                taskId,
                authorId: userId,
                parentId: parentId || null,
                // Connect existing attachments if provided
                attachments: {
                    connect: attachments.map((id: string) => ({ id }))
                },
                // Create mentions
                mentions: {
                    create: mentions.map((mentionedUserId: string) => ({
                        userId: mentionedUserId
                    }))
                }
            },
            include: {
                author: { select: { id: true, fullName: true, initials: true } },
                mentions: { include: { user: { select: { id: true, fullName: true, initials: true } } } },
                attachments: true,
                replies: true
            }
        });

        // Notifications
        if (task.assigneeId && task.assigneeId !== userId) {
            await createAndSendNotification({
                userId: task.assigneeId,
                projectId: task.projectId,
                taskId: task.id,
                type: NotificationType.TASK_COMMENT,
                title: "New comment on your task",
                message: `${comment.author.fullName} commented on "${task.title}"`,
                link: `/app/projects/${task.projectId}/tasks`
            });
        }

        for (const mention of comment.mentions) {
            if (mention.userId !== userId) {
                await createAndSendNotification({
                    userId: mention.userId,
                    projectId: task.projectId,
                    taskId: task.id,
                    type: NotificationType.TASK_MENTION,
                    title: "You were mentioned",
                    message: `${comment.author.fullName} mentioned you in a comment on "${task.title}"`,
                    link: `/app/projects/${task.projectId}/tasks`
                });
            }
        }

        // Audit Logging
        await createAuditLog({
            userId,
            projectId: task.projectId,
            action: AuditAction.TASK_COMMENT_CREATED,
            entityType: "TASK_COMMENT",
            entityId: comment.id,
            details: { taskId: task.id, hasMentions: mentions.length > 0 }
        });

        res.status(201).json({ success: true, data: comment });
    } catch (error) {
        console.error("Error creating comment:", error);
        res.status(500).json({ success: false, error: "Failed to create comment" });
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
            // Need org admin or project admin, but for simplicity we'll just check author here,
            // or rely on middleware if needed.
            res.status(403).json({ success: false, error: "You can only delete your own comments" });
            return;
        }

        await prisma.taskComment.delete({
            where: { id: commentId }
        });

        await createAuditLog({
            userId,
            projectId: comment.task.projectId,
            action: AuditAction.TASK_COMMENT_DELETED,
            entityType: "TASK_COMMENT",
            entityId: commentId as string,
            details: { taskId: comment.taskId }
        });

        res.status(200).json({ success: true, message: "Comment deleted" });
    } catch (error) {
        console.error("Error deleting comment:", error);
        res.status(500).json({ success: false, error: "Failed to delete comment" });
    }
};
