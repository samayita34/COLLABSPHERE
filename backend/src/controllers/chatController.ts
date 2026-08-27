import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { getIO } from "../lib/socket";

export const getChannels = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const members = await prisma.channelMember.findMany({
            where: { userId },
            include: {
                channel: {
                    include: {
                        members: {
                            include: {
                                user: { select: { id: true, firstName: true, lastName: true, email: true } }
                            }
                        }
                    }
                }
            }
        });

        const channels = members.map(m => m.channel);
        res.status(200).json({ success: true, channels });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const createDirectMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { targetUserId, workspaceId } = req.body;
        
        if (!userId || !targetUserId) {
            res.status(400).json({ success: false, error: "Missing users" });
            return;
        }

        // Check if DM already exists
        const existingChannels = await prisma.channel.findMany({
            where: { type: "DIRECT_MESSAGE", workspaceId },
            include: { members: true }
        });

        const dm = existingChannels.find(c => 
            c.members.length === 2 && 
            c.members.some(m => m.userId === userId) && 
            c.members.some(m => m.userId === targetUserId)
        );

        if (dm) {
            res.status(200).json({ success: true, channel: dm });
            return;
        }

        // Create new DM
        const newDm = await prisma.channel.create({
            data: {
                type: "DIRECT_MESSAGE",
                workspaceId,
                members: {
                    create: [{ userId }, { userId: targetUserId }]
                }
            },
            include: {
                members: {
                    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }
                }
            }
        });

        res.status(201).json({ success: true, channel: newDm });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const { channelId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        // Verify membership
        const membership = await prisma.channelMember.findUnique({
            where: { channelId_userId: { channelId, userId } }
        });

        if (!membership) {
            res.status(403).json({ success: false, error: "Not a member of this channel" });
            return;
        }

        const messages = await prisma.chatMessage.findMany({
            where: { channelId, parentId: null },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, email: true } },
                file: true,
                reactions: true,
                replies: {
                    include: { sender: { select: { id: true, firstName: true, lastName: true, email: true } } }
                }
            },
            orderBy: { createdAt: "asc" }
        });

        // Update lastReadAt
        await prisma.channelMember.update({
            where: { id: membership.id },
            data: { lastReadAt: new Date() }
        });

        res.status(200).json({ success: true, messages });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { channelId } = req.params;
        const { text, fileId, parentId } = req.body;
        const userId = req.user?.id;

        if (!userId || (!text && !fileId)) {
            res.status(400).json({ success: false, error: "Invalid payload" });
            return;
        }

        const membership = await prisma.channelMember.findUnique({
            where: { channelId_userId: { channelId, userId } }
        });

        if (!membership) {
            res.status(403).json({ success: false, error: "Not a member" });
            return;
        }

        const message = await prisma.chatMessage.create({
            data: {
                channelId,
                senderId: userId,
                text,
                fileId,
                parentId
            },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, email: true } },
                file: true,
                reactions: true,
                replies: true
            }
        });

        const io = getIO();
        io.to(`channel_${channelId}`).emit("new_message", message);

        res.status(201).json({ success: true, message });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const toggleReaction = async (req: Request, res: Response): Promise<void> => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.user?.id;

        if (!userId || !emoji) {
            res.status(400).json({ success: false, error: "Invalid payload" });
            return;
        }

        const existing = await prisma.messageReaction.findUnique({
            where: { messageId_userId_emoji: { messageId, userId, emoji } },
            include: { message: true }
        });

        if (existing) {
            await prisma.messageReaction.delete({ where: { id: existing.id } });
            getIO().to(`channel_${existing.message.channelId}`).emit("reaction_removed", { messageId, userId, emoji });
        } else {
            const reaction = await prisma.messageReaction.create({
                data: { messageId, userId, emoji },
                include: { message: true }
            });
            getIO().to(`channel_${reaction.message.channelId}`).emit("reaction_added", { messageId, userId, emoji });
        }

        res.status(200).json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
