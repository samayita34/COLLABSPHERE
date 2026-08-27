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

        socket.on("typing_start", (data) => {
            // data: { channelId, userId, userName }
            socket.to(`channel_${data.channelId}`).emit("user_typing", data);
        });

        socket.on("typing_end", (data) => {
            socket.to(`channel_${data.channelId}`).emit("user_stopped_typing", data);
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
