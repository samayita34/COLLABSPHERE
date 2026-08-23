import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import projectRoutes from "./routes/projectRoutes";
import taskRoutes from "./routes/taskRoutes";
import memberRoutes from "./routes/memberRoutes";
import documentRoutes from "./routes/documentRoutes";
import fileRoutes from "./routes/fileRoutes";
import chatRoutes from "./routes/chatRoutes";
import authRoutes from "./routes/authRoutes";
import { authenticate, authorizeProjectAccess } from "./middleware/auth";
import { updateTask, deleteTask } from "./controllers/taskController";
import { deleteDocument } from "./controllers/documentController";
import { deleteFile } from "./controllers/fileController";

dotenv.config();

const app = express();

app.use(
    cors({
        origin: "http://localhost:5174",
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);

app.get("/api/health", (_req, res) => {
    res.json({
        success: true,
        message: "COLLABSPHERE backend is running",
    });
});

// Protect all project workspace data APIs with authenticate middleware
app.use("/api/projects", authenticate, projectRoutes);

// Nested: GET /api/projects/:projectId/tasks  POST /api/projects/:projectId/tasks
app.use("/api/projects/:projectId/tasks", authenticate, authorizeProjectAccess, taskRoutes);

// Top-level: PATCH /api/tasks/:id  DELETE /api/tasks/:id
app.patch("/api/tasks/:id", authenticate, updateTask);
app.delete("/api/tasks/:id", authenticate, deleteTask);

// Nested: GET/POST/DELETE /api/projects/:projectId/members[/:memberId]
app.use("/api/projects/:projectId/members", authenticate, authorizeProjectAccess, memberRoutes);

// Nested: GET/POST /api/projects/:projectId/documents
app.use("/api/projects/:projectId/documents", authenticate, authorizeProjectAccess, documentRoutes);
app.delete("/api/documents/:id", authenticate, deleteDocument);

// Nested: GET/POST /api/projects/:projectId/files
app.use("/api/projects/:projectId/files", authenticate, authorizeProjectAccess, fileRoutes);
app.delete("/api/files/:id", authenticate, deleteFile);

// Nested: GET/POST /api/projects/:projectId/messages
app.use("/api/projects/:projectId/messages", authenticate, authorizeProjectAccess, chatRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`COLLABSPHERE backend running on http://localhost:${PORT}`);
});