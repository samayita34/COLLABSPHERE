import { Server } from "socket.io";
import { Server as HttpServer } from "http";

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5174",
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        console.log("Client connected", socket.id);

        socket.on("joinUser", (userId) => {
            socket.join(`user:${userId}`);
            console.log(`Socket ${socket.id} joined user room user:${userId}`);
        });

        socket.on("leaveUser", (userId) => {
            socket.leave(`user:${userId}`);
            console.log(`Socket ${socket.id} left user room user:${userId}`);
        });

        socket.on("joinProject", (projectId) => {
            socket.join(projectId);
            console.log(`Socket ${socket.id} joined project ${projectId}`);
        });

        socket.on("leaveProject", (projectId) => {
            socket.leave(projectId);
            console.log(`Socket ${socket.id} left project ${projectId}`);
        });

        // Chat Channels
        socket.on("join_channel", (channelId) => {
            socket.join(`channel_${channelId}`);
            console.log(`Socket ${socket.id} joined channel channel_${channelId}`);
        });

        socket.on("leave_channel", (channelId) => {
            socket.leave(`channel_${channelId}`);
            console.log(`Socket ${socket.id} left channel channel_${channelId}`);
        });

        // Typing Indicators
        // Payload: { projectId, channelId (optional), userId, userName }
        socket.on("typing_start", (data) => {
            if (!data) return;

            const { projectId, channelId, userId, userName } = data;
            const payload = { projectId, channelId, userId, userName };

            // Broadcast to the project room (used by ProjectChat)
            if (projectId) {
                socket.to(projectId).emit("user_typing", payload);
            }

            // Also broadcast to the channel room if a real channelId was provided
            if (channelId && channelId !== projectId) {
                socket.to(`channel_${channelId}`).emit("user_typing", payload);
            }
        });

        socket.on("typing_end", (data) => {
            if (!data) return;

            const { projectId, channelId, userId, userName } = data;
            const payload = { projectId, channelId, userId, userName };

            if (projectId) {
                socket.to(projectId).emit("user_stopped_typing", payload);
            }

            if (channelId && channelId !== projectId) {
                socket.to(`channel_${channelId}`).emit("user_stopped_typing", payload);
            }
        });

        // Read Receipts
        socket.on("mark_read", (data) => {
            if (!data) return;
            const { channelId, userId, readAt } = data;
            if (channelId) {
                socket.to(`channel_${channelId}`).emit("channel_read", {
                    channelId,
                    userId,
                    readAt: readAt || new Date().toISOString(),
                });
            }
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected", socket.id);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};