import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { getIO } from "../lib/socket";
import { createAndSendNotification } from "../services/notificationService";
import { NotificationType } from "../../generated/prisma/enums";
import { storageService } from "../services/storageService";
import crypto from "crypto";
import xss from "xss";

/**
 * Helper to ensure a user is a member of the project channel if they have access to the project.
 */
async function ensureProjectChannelsForWorkspace(userId: string, workspaceId: string) {
    try {
        const accessibleProjects = await prisma.project.findMany({
            where: {
                workspaceId,
                OR: [
                    { ownerId: userId },
                    { members: { some: { userId } } }
                ]
            },
            select: { id: true, name: true }
        });

        for (const p of accessibleProjects) {
            let channel = await prisma.channel.findFirst({
                where: { projectId: p.id, type: "PROJECT" }
            });

            if (!channel) {
                channel = await prisma.channel.create({
                    data: {
                        projectId: p.id,
                        workspaceId,
                        type: "PROJECT",
                        name: `${p.name} Chat`
                    }
                });
            }

            // Ensure membership
            await prisma.channelMember.upsert({
                where: { channelId_userId: { channelId: channel.id, userId } },
                update: {},
                create: { channelId: channel.id, userId }
            });
        }
    } catch (err) {
        console.error("Error ensuring project channels:", err);
    }
}

/**
 * GET /api/chat/channels
 * Returns all channels (DMs, Groups, Project channels) accessible to the current user.
 * Includes unread message counts, latest message preview, and member details.
 */
export const getChannels = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const workspaceId = req.query.workspaceId as string | undefined;

        if (workspaceId) {
            await ensureProjectChannelsForWorkspace(userId, workspaceId);
        }

        // Fetch all channel memberships for current user
        const memberships = await prisma.channelMember.findMany({
            where: {
                userId,
                ...(workspaceId
                    ? {
                          channel: {
                              OR: [
                                  { workspaceId },
                                  { workspaceId: null }
                              ]
                          }
                      }
                    : {})
            },
            include: {
                channel: {
                    include: {
                        project: { select: { id: true, name: true, code: true, status: true } },
                        members: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                        avatar: true,
                                        role: true
                                    }
                                }
                            }
                        },
                        messages: {
                            orderBy: { createdAt: "desc" },
                            take: 1,
                            include: {
                                sender: { select: { id: true, firstName: true, lastName: true, email: true } },
                                reactions: true
                            }
                        }
                    }
                }
            }
        });

        // Compute unread counts and format
        const channels = await Promise.all(
            memberships.map(async (m: any) => {
                const ch = m.channel;
                const lastRead = m.lastReadAt ? new Date(m.lastReadAt) : new Date(0);

                const unreadCount = await prisma.chatMessage.count({
                    where: {
                        channelId: ch.id,
                        senderId: { not: userId },
                        createdAt: { gt: lastRead }
                    }
                });

                const lastMsg = ch.messages[0] || null;

                return {
                    id: ch.id,
                    name: ch.name,
                    type: ch.type,
                    workspaceId: ch.workspaceId,
                    projectId: ch.projectId,
                    project: ch.project,
                    members: ch.members,
                    myLastReadAt: m.lastReadAt,
                    unreadCount,
                    lastMessage: lastMsg
                        ? {
                              id: lastMsg.id,
                              text: lastMsg.text,
                              createdAt: lastMsg.createdAt,
                              sender: lastMsg.sender,
                              hasAttachment: !!lastMsg.fileId || (lastMsg.text && lastMsg.text.includes("[ATTACHMENT:"))
                          }
                        : null,
                    updatedAt: lastMsg?.createdAt || ch.updatedAt || ch.createdAt
                };
            })
        );

        // Sort by most recent activity
        channels.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        res.status(200).json({ success: true, channels });
    } catch (error: any) {
        console.error("getChannels error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch channels" });
    }
};

/**
 * POST /api/chat/channels/dm
 * Creates or retrieves a Direct Message conversation between two users.
 */
export const createDirectMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { targetUserId, workspaceId } = req.body;

        if (!userId || !targetUserId) {
            res.status(400).json({ success: false, error: "Missing required user IDs" });
            return;
        }

        // Check if an existing DM channel already has both users
        const existingChannels = await prisma.channel.findMany({
            where: {
                type: "DIRECT_MESSAGE",
                ...(workspaceId ? { OR: [{ workspaceId }, { workspaceId: null }] } : {}),
                members: {
                    some: { userId }
                }
            },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } }
                    }
                },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: {
                        sender: { select: { id: true, firstName: true, lastName: true, email: true } }
                    }
                }
            }
        });

        const existingDm = existingChannels.find((c: any) =>
            c.members.some((m: any) => m.userId === targetUserId)
        );

        if (existingDm) {
            res.status(200).json({ success: true, channel: existingDm });
            return;
        }

        // Create new DM channel
        const newDm = await prisma.channel.create({
            data: {
                type: "DIRECT_MESSAGE",
                workspaceId: workspaceId || null,
                members: {
                    create: [{ userId }, { userId: targetUserId }]
                }
            },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } }
                    }
                }
            }
        });

        try {
            const io = getIO();
            io.to(`user:${userId}`).emit("new_channel", newDm);
            io.to(`user:${targetUserId}`).emit("new_channel", newDm);
        } catch (socketErr) {}

        res.status(201).json({ success: true, channel: newDm });
    } catch (error: any) {
        console.error("createDirectMessage error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to create direct message" });
    }
};

/**
 * POST /api/chat/channels/group
 * Creates a new Group conversation with multiple members.
 */
export const createGroupChannel = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { name, workspaceId, memberUserIds = [] } = req.body;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        if (!name || typeof name !== "string" || !name.trim()) {
            res.status(400).json({ success: false, error: "Group name is required" });
            return;
        }

        // Deduplicate member IDs and ensure current user is included
        const uniqueMembers = Array.from(new Set([userId, ...memberUserIds]));

        const newGroup = await prisma.channel.create({
            data: {
                name: name.trim(),
                type: "GROUP",
                workspaceId: workspaceId || null,
                members: {
                    create: uniqueMembers.map((mId) => ({ userId: mId }))
                }
            },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } }
                    }
                }
            }
        });

        try {
            const io = getIO();
            uniqueMembers.forEach((mId) => {
                io.to(`user:${mId}`).emit("new_channel", newGroup);
            });
        } catch (socketErr) {}

        res.status(201).json({ success: true, channel: newGroup });
    } catch (error: any) {
        console.error("createGroupChannel error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to create group" });
    }
};

/**
 * GET /api/chat/channels/:channelId/messages
 * Returns all messages for a channel with full sender, reactions, mentions, and read receipt metadata.
 */
export const getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const { channelId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        // Verify or ensure membership
        let membership = await prisma.channelMember.findUnique({
            where: { channelId_userId: { channelId, userId } }
        });

        if (!membership) {
            // If it's a project channel or group, check if user has access to project/workspace
            const channel = await prisma.channel.findUnique({ where: { id: channelId } });
            if (channel?.projectId) {
                const hasProjectAccess = await prisma.projectMember.findFirst({
                    where: { projectId: channel.projectId, userId }
                });
                const isOwner = await prisma.project.findFirst({
                    where: { id: channel.projectId, ownerId: userId }
                });
                if (hasProjectAccess || isOwner) {
                    membership = await prisma.channelMember.create({
                        data: { channelId, userId }
                    });
                }
            }
        }

        if (!membership) {
            res.status(403).json({ success: false, error: "Forbidden: Not a member of this channel" });
            return;
        }

        // Fetch channel members to calculate read receipts
        const channelMembers = await prisma.channelMember.findMany({
            where: { channelId },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } }
            }
        });

        const messages = await prisma.chatMessage.findMany({
            where: { channelId, parentId: null },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
                file: true,
                reactions: {
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true } }
                    }
                },
                mentions: {
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true, email: true } }
                    }
                },
                replies: {
                    include: {
                        sender: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
                        reactions: {
                            include: {
                                user: { select: { id: true, firstName: true, lastName: true } }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: "asc" }
        });

        // Compute read receipt status for each message
        // WhatsApp style:
        // - Single tick (sent)
        // - Double tick (delivered to channel)
        // - Double blue tick (read by other participants)
        const otherMembers = channelMembers.filter((m: any) => m.userId !== userId);

        const formattedMessages = messages.map((m: any) => {
            const isOwn = m.senderId === userId;
            const createdAtTime = new Date(m.createdAt).getTime();

            // Check if all other members have read this message
            let isReadByAll = false;
            let readByCount = 0;
            if (otherMembers.length > 0) {
                const readMembers = otherMembers.filter(
                    (om: any) => om.lastReadAt && new Date(om.lastReadAt).getTime() >= createdAtTime
                );
                readByCount = readMembers.length;
                isReadByAll = readByCount === otherMembers.length;
            }

            return {
                ...m,
                isOwn,
                isDelivered: true,
                isRead: isReadByAll,
                readCount: readByCount
            };
        });

        // Mark channel as read for this user
        const now = new Date();
        await prisma.channelMember.update({
            where: { id: membership.id },
            data: { lastReadAt: now }
        });

        try {
            const io = getIO();
            io.to(`channel_${channelId}`).emit("channel_read", {
                channelId,
                userId,
                readAt: now.toISOString()
            });
        } catch (e) {}

        res.status(200).json({
            success: true,
            messages: formattedMessages,
            members: channelMembers
        });
    } catch (error: any) {
        console.error("getMessages error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch messages" });
    }
};

/**
 * POST /api/chat/channels/:channelId/messages
 * Sends a message in a channel (with optional file, mentions, and reply parent).
 */
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { channelId } = req.params;
        const { text, fileId, parentId, mentions = [], attachment } = req.body;
        const userId = req.user?.id;

        if (!userId || (!text && !fileId && !attachment)) {
            res.status(400).json({ success: false, error: "Message must contain text or an attachment" });
            return;
        }

        const membership = await prisma.channelMember.findUnique({
            where: { channelId_userId: { channelId, userId } }
        });

        if (!membership) {
            res.status(403).json({ success: false, error: "Not a member of this channel" });
            return;
        }

        // Construct text with embedded attachment metadata if provided
        let messageText = text ? xss(text) : null;
        if (attachment) {
            const attachmentMeta = `[ATTACHMENT:${JSON.stringify(attachment)}]`;
            messageText = messageText ? `${messageText}\n${attachmentMeta}` : attachmentMeta;
        }

        const message = await prisma.chatMessage.create({
            data: {
                channelId,
                senderId: userId,
                text: messageText,
                fileId: fileId || null,
                parentId: parentId || null
            },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
                file: true,
                reactions: {
                    include: { user: { select: { id: true, firstName: true, lastName: true } } }
                },
                mentions: {
                    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }
                }
            }
        });

        // Handle @mentions
        if (Array.isArray(mentions) && mentions.length > 0) {
            for (const mentionUserId of mentions) {
                if (typeof mentionUserId === "string" && mentionUserId !== userId) {
                    try {
                        await prisma.messageMention.create({
                            data: {
                                messageId: message.id,
                                userId: mentionUserId
                            }
                        });

                        await createAndSendNotification({
                            userId: mentionUserId,
                            type: NotificationType.MENTION,
                            title: "You were mentioned in chat",
                            message: `${message.sender.firstName} mentioned you in a chat.`,
                            link: `/messages`
                        });
                    } catch (err) {}
                }
            }
        }

        // Notify non-sender channel members
        const channelMembers = await prisma.channelMember.findMany({
            where: { channelId }
        });

        for (const m of channelMembers) {
            if (m.userId !== userId) {
                createAndSendNotification({
                    userId: m.userId,
                    type: NotificationType.CHAT_MESSAGE,
                    title: "New Chat Message",
                    message: `${message.sender.firstName}: ${text ? text.slice(0, 80) : "Sent an attachment"}`,
                    link: `/messages`
                }).catch(() => {});
            }
        }

        // Broadcast to channel room
        try {
            const io = getIO();
            io.to(`channel_${channelId}`).emit("new_message", message);
        } catch (socketErr) {}

        res.status(201).json({ success: true, message });
    } catch (error: any) {
        console.error("sendMessage error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to send message" });
    }
};

/**
 * POST /api/chat/messages/:messageId/reactions
 * Toggles an emoji reaction on a message.
 */
export const toggleReaction = async (req: Request, res: Response): Promise<void> => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.user?.id;

        if (!userId || !emoji) {
            res.status(400).json({ success: false, error: "Message ID and emoji are required" });
            return;
        }

        const message = await prisma.chatMessage.findUnique({
            where: { id: messageId },
            select: { id: true, channelId: true }
        });

        if (!message) {
            res.status(404).json({ success: false, error: "Message not found" });
            return;
        }

        const existing = await prisma.messageReaction.findUnique({
            where: { messageId_userId_emoji: { messageId, userId, emoji } }
        });

        if (existing) {
            await prisma.messageReaction.delete({ where: { id: existing.id } });
        } else {
            await prisma.messageReaction.create({
                data: { messageId, userId, emoji }
            });
        }

        const allReactions = await prisma.messageReaction.findMany({
            where: { messageId },
            include: {
                user: { select: { id: true, firstName: true, lastName: true } }
            }
        });

        try {
            const io = getIO();
            io.to(`channel_${message.channelId}`).emit("reaction_updated", {
                messageId,
                channelId: message.channelId,
                reactions: allReactions
            });
        } catch (socketErr) {}

        res.status(200).json({ success: true, reactions: allReactions });
    } catch (error: any) {
        console.error("toggleReaction error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to toggle reaction" });
    }
};

/**
 * POST /api/chat/channels/:channelId/read
 * Marks channel as read for the current user and broadcasts read receipt.
 */
export const markChannelAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { channelId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const now = new Date();

        await prisma.channelMember.updateMany({
            where: { channelId, userId },
            data: { lastReadAt: now }
        });

        try {
            const io = getIO();
            io.to(`channel_${channelId}`).emit("channel_read", {
                channelId,
                userId,
                readAt: now.toISOString()
            });
        } catch (socketErr) {}

        res.status(200).json({ success: true, lastReadAt: now.toISOString() });
    } catch (error: any) {
        console.error("markChannelAsRead error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to mark read" });
    }
};

/**
 * POST /api/chat/upload
 * Uploads a file/image attachment for chat sharing.
 */
export const uploadChatFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const uploadedFile = req.file;
        if (!uploadedFile) {
            res.status(400).json({ success: false, error: "File is required for upload" });
            return;
        }

        const originalName = uploadedFile.originalname || "attachment";
        const cleanName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const safeKey = `chat_${Date.now()}_${crypto.randomBytes(4).toString("hex")}_${cleanName}`;

        await storageService.uploadFile(safeKey, uploadedFile.buffer, uploadedFile.mimetype);

        const fileUrl = `/uploads/${safeKey}`;

        res.status(200).json({
            success: true,
            file: {
                url: fileUrl,
                name: originalName,
                size: uploadedFile.size,
                type: uploadedFile.mimetype
            }
        });
    } catch (error: any) {
        console.error("uploadChatFile error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to upload file" });
    }
};

/**
 * GET /api/chat/channels/:channelId/search
 * Searches messages within a channel.
 */
export const searchMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const { channelId } = req.params;
        const q = (req.query.q as string) || "";
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        if (!q.trim()) {
            res.status(200).json({ success: true, messages: [] });
            return;
        }

        const messages = await prisma.chatMessage.findMany({
            where: {
                channelId,
                text: { contains: q.trim(), mode: "insensitive" }
            },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 50
        });

        res.status(200).json({ success: true, messages });
    } catch (error: any) {
        console.error("searchMessages error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to search messages" });
    }
};

/**
 * GET /api/chat/users?workspaceId=...
 * Lists available workspace members to start DMs or create Groups with.
 */
export const getWorkspaceChatUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const workspaceId = req.query.workspaceId as string | undefined;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const whereClause: any = {};
        if (workspaceId) {
            whereClause.workspaces = { some: { workspaceId } };
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                role: true
            },
            orderBy: { firstName: "asc" }
        });

        res.status(200).json({ success: true, users });
    } catch (error: any) {
        console.error("getWorkspaceChatUsers error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to list chat users" });
    }
};

/**
 * Legacy support for project workspace Chat tab
 */
export const getProjectMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id, projectId } = req.params;
        const targetProjectId = projectId || id;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const project = await prisma.project.findUnique({ where: { id: targetProjectId } });
        if (!project) {
            res.status(404).json({ success: false, error: "Project not found" });
            return;
        }

        let channel = await prisma.channel.findFirst({
            where: { projectId: targetProjectId, type: "PROJECT" }
        });

        if (!channel) {
            channel = await prisma.channel.create({
                data: {
                    projectId: targetProjectId,
                    workspaceId: project.workspaceId,
                    type: "PROJECT",
                    name: `${project.name} Chat`
                }
            });
        }

        // Ensure user membership
        await prisma.channelMember.upsert({
            where: { channelId_userId: { channelId: channel.id, userId } },
            update: { lastReadAt: new Date() },
            create: { channelId: channel.id, userId, lastReadAt: new Date() }
        });

        const messages = await prisma.chatMessage.findMany({
            where: { channelId: channel.id, parentId: null },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
                reactions: {
                    include: { user: { select: { id: true, firstName: true, lastName: true } } }
                }
            },
            orderBy: { createdAt: "asc" }
        });

        const formatted = messages.map((m: any) => {
            const fn = m.sender.firstName || "";
            const ln = m.sender.lastName || "";
            const initials = (fn[0] || "") + (ln[0] || "") || m.sender.email.slice(0, 2);
            return {
                id: m.id,
                text: m.text || "",
                senderInitials: initials.toUpperCase(),
                senderName: `${fn} ${ln}`.trim() || m.sender.email,
                timestamp: m.createdAt.toISOString(),
                createdAt: m.createdAt,
                reactions: m.reactions
            };
        });

        res.status(200).json({ success: true, data: formatted });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const sendProjectMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id, projectId } = req.params;
        const targetProjectId = projectId || id;
        const { text } = req.body;
        const userId = req.user?.id;

        if (!userId || !text) {
            res.status(400).json({ success: false, error: "Missing message text" });
            return;
        }

        const project = await prisma.project.findUnique({ where: { id: targetProjectId } });
        if (!project) {
            res.status(404).json({ success: false, error: "Project not found" });
            return;
        }

        let channel = await prisma.channel.findFirst({
            where: { projectId: targetProjectId, type: "PROJECT" }
        });

        if (!channel) {
            channel = await prisma.channel.create({
                data: {
                    projectId: targetProjectId,
                    workspaceId: project.workspaceId,
                    type: "PROJECT",
                    name: `${project.name} Chat`
                }
            });
        }

        const message = await prisma.chatMessage.create({
            data: {
                channelId: channel.id,
                senderId: userId,
                text: xss(text)
            },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } }
            }
        });

        const fn = message.sender.firstName || "";
        const ln = message.sender.lastName || "";
        const initials = (fn[0] || "") + (ln[0] || "") || message.sender.email.slice(0, 2);
        const formatted = {
            id: message.id,
            text: message.text || "",
            senderInitials: initials.toUpperCase(),
            senderName: `${fn} ${ln}`.trim() || message.sender.email,
            timestamp: message.createdAt.toISOString(),
            createdAt: message.createdAt
        };

        try {
            const io = getIO();
            io.to(`channel_${channel.id}`).emit("new_message", formatted);
            io.to(`project_${targetProjectId}`).emit("project_message", formatted);
        } catch (e) {}

        res.status(201).json({ success: true, data: formatted });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
