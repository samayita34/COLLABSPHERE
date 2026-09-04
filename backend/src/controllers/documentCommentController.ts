import { Request, Response } from "express";
import prisma from "../lib/prisma";

export async function getDocumentComments(req: Request, res: Response) {
    try {
        const { documentId } = req.params;

        const comments = await prisma.documentComment.findMany({
            where: { documentId },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                    },
                },
                replies: {
                    include: {
                        author: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatar: true,
                            },
                        },
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        return res.json(comments);
    } catch (error: any) {
        console.error("Error fetching document comments:", error);
        return res.status(500).json({ error: "Failed to fetch document comments" });
    }
}

export async function createDocumentComment(req: Request, res: Response) {
    try {
        const { documentId } = req.params;
        const { content, highlightedText, fromPos, toPos } = req.body;
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Comment content is required" });
        }

        const comment = await prisma.documentComment.create({
            data: {
                documentId,
                authorId: userId,
                content: content.trim(),
                highlightedText: highlightedText || null,
                fromPos: typeof fromPos === "number" ? fromPos : null,
                toPos: typeof toPos === "number" ? toPos : null,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                    },
                },
                replies: [],
            },
        });

        return res.status(201).json(comment);
    } catch (error: any) {
        console.error("Error creating document comment:", error);
        return res.status(500).json({ error: "Failed to create document comment" });
    }
}

export async function replyToDocumentComment(req: Request, res: Response) {
    try {
        const { commentId } = req.params;
        const { content } = req.body;
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Reply content is required" });
        }

        const reply = await prisma.documentCommentReply.create({
            data: {
                commentId,
                authorId: userId,
                content: content.trim(),
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                    },
                },
            },
        });

        return res.status(201).json(reply);
    } catch (error: any) {
        console.error("Error creating comment reply:", error);
        return res.status(500).json({ error: "Failed to create comment reply" });
    }
}

export async function toggleResolveDocumentComment(req: Request, res: Response) {
    try {
        const { commentId } = req.params;
        const { isResolved } = req.body;

        const updated = await prisma.documentComment.update({
            where: { id: commentId },
            data: { isResolved: Boolean(isResolved) },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                    },
                },
                replies: {
                    include: {
                        author: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatar: true,
                            },
                        },
                    },
                },
            },
        });

        return res.json(updated);
    } catch (error: any) {
        console.error("Error updating comment status:", error);
        return res.status(500).json({ error: "Failed to update comment status" });
    }
}

export async function deleteDocumentComment(req: Request, res: Response) {
    try {
        const { commentId } = req.params;

        await prisma.documentComment.delete({
            where: { id: commentId },
        });

        return res.json({ success: true, message: "Comment deleted successfully" });
    } catch (error: any) {
        console.error("Error deleting comment:", error);
        return res.status(500).json({ error: "Failed to delete comment" });
    }
}
