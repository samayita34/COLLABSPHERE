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

        socket.on("joinProject", (projectId) => {
            socket.join(projectId);
            console.log(`Socket ${socket.id} joined project ${projectId}`);
        });

        socket.on("leaveProject", (projectId) => {
            socket.leave(projectId);
            console.log(`Socket ${socket.id} left project ${projectId}`);
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
