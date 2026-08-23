import { Request, Response } from "express";
import prisma from "../lib/prisma";

function formatMessage(msg: any) {
    return {
        id: msg.id,
        senderInitials: msg.senderInitials,
        text: msg.text,
        timestamp: msg.createdAt.toISOString(),
        projectId: msg.projectId,
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

        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            res.status(404).json({
                success: false,
                error: "Project not found",
            });
            return;
        }

        const messages = await prisma.chatMessage.findMany({
            where: { projectId },
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

        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            res.status(404).json({
                success: false,
                error: "Project not found",
            });
            return;
        }

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
        });

        res.status(201).json({
            success: true,
            message: "Message sent successfully",
            data: formatMessage(newMessage),
        });
    } catch (error) {
        console.error("Error sending project message:", error);
        res.status(500).json({
            success: false,
            error: "Failed to send message",
        });
    }
};
