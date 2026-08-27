import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import projectRoutes from "./routes/projectRoutes";
import taskRoutes from "./routes/taskRoutes";
import memberRoutes from "./routes/memberRoutes";
import documentRoutes from "./routes/documentRoutes";
import fileRoutes, { globalRouter as globalFileRouter } from "./routes/fileRoutes";
import folderRoutes from "./routes/folderRoutes";
import chatRoutes from "./routes/chatRoutes";
import documentVersionRoutes from "./routes/documentVersionRoutes";
import authRoutes from "./routes/authRoutes";
import orgRoutes from "./routes/orgRoutes";
import workspaceRoutes from "./routes/workspaceRoutes";
import teamRoutes from "./routes/teamRoutes";
import boardRoutes from "./routes/boardRoutes";
import taskDetailsRoutes from "./routes/taskDetailsRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import auditRoutes from "./routes/auditRoutes";
import { authenticate } from "./middleware/auth";
import { requireProjectAccess, requireTaskAccess, requireDocumentAccess, requireFileAccess, requirePermission } from "./middleware/rbac";
import { Permission } from "./lib/permissions";
import { getMyTasks, updateTask, deleteTask } from "./controllers/taskController";
import { getDocumentsByWorkspace, updateDocument, deleteDocument } from "./controllers/documentController";
import { deleteFile } from "./controllers/fileController";
import { connectRedis } from "./lib/redis";
import { checkAndSendDueDateReminders } from "./services/notificationService";
import { initSocket } from "./lib/socket";
import { initCollaborationServer } from "./collaborationServer";

import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Security Headers
app.use(helmet());

const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:5174",
].filter(Boolean) as string[];

app.use(
    cors({
        origin: (origin, callback) => {
            // Only allow explicitly defined origins (no regex bypass)
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
    })
);

// Global Rate Limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 150, // Limit each IP to 150 requests per window
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: "Too many requests, please try again later." }
});
app.use(globalLimiter);

// Auth Rate Limiting (Stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: process.env.NODE_ENV === "test" ? 1000 : 50, // Higher limit in test mode
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: "Too many authentication attempts, please try again later." }
});

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "../../uploads")));

// Unprotected or Custom Auth Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/files", globalFileRouter);

app.get("/api/health", (_req, res) => {
    res.json({
        success: true,
        message: "COLLABSPHERE backend is running",
    });
});

// Protected Org/Workspace/Team APIs
app.use("/api/organizations", orgRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/teams", teamRoutes);

// Protected Notifications & Audit Logs
app.use("/api/notifications", notificationRoutes);
app.use("/api/audit-logs", auditRoutes);

// Protect all project workspace data APIs with authenticate middleware
app.use("/api/projects", authenticate, projectRoutes);
app.use("/api/projects/:projectId/boards", authenticate, requireProjectAccess, boardRoutes);

// Nested: GET /api/projects/:projectId/tasks  POST /api/projects/:projectId/tasks
app.use("/api/projects/:projectId/tasks", authenticate, requireProjectAccess, taskRoutes);

// Top-level: GET /api/tasks/my-tasks  PATCH /api/tasks/:id  DELETE /api/tasks/:id
app.get("/api/tasks/my-tasks", authenticate, getMyTasks);
app.use("/api/tasks", authenticate, taskDetailsRoutes);
app.patch("/api/tasks/:id", authenticate, requireTaskAccess, requirePermission(Permission.EDIT_TASK), updateTask);
app.delete("/api/tasks/:id", authenticate, requireTaskAccess, requirePermission(Permission.DELETE_TASK), deleteTask);

// Nested: GET/POST/DELETE /api/projects/:projectId/members[/:memberId]
app.use("/api/projects/:projectId/members", authenticate, requireProjectAccess, memberRoutes);

// Nested: GET/POST /api/projects/:projectId/documents
app.use("/api/projects/:projectId/documents", authenticate, requireProjectAccess, documentRoutes);
app.get("/api/documents", authenticate, getDocumentsByWorkspace);
app.use("/api/documents/:documentId/versions", authenticate, requireDocumentAccess, documentVersionRoutes);
app.patch("/api/documents/:id", authenticate, requireDocumentAccess, requirePermission(Permission.EDIT_DOCUMENT), updateDocument);
app.delete("/api/documents/:id", authenticate, requireDocumentAccess, requirePermission(Permission.DELETE_DOCUMENT), deleteDocument);

// Nested: GET/POST /api/projects/:projectId/files
app.use("/api/projects/:projectId/files", authenticate, requireProjectAccess, fileRoutes);
app.use("/api/projects/:projectId/folders", authenticate, requireProjectAccess, folderRoutes);
// NOTE: /api/files/:id DELETE route is handled by fileRoutes now nested under project. We can comment or keep if workspace-level deletion is needed.
// app.delete("/api/files/:id", authenticate, requireFileAccess, requirePermission(Permission.DELETE_FILES), deleteFile);

// Chat API
app.use("/api/chat", chatRoutes);
const PORT = process.env.PORT || 3000;

initSocket(server);
initCollaborationServer(server);
server.listen(PORT, () => {
    console.log(`COLLABSPHERE backend running on http://localhost:${PORT}`);
    
    // Initial check and hourly due-date reminder interval
    checkAndSendDueDateReminders();
    setInterval(() => {
        checkAndSendDueDateReminders();
    }, 60 * 60 * 1000);
});

connectRedis().catch((err) => {
    console.log("Redis optional connection note:", err.message || err);
});