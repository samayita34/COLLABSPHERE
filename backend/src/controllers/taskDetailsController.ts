import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { createAndSendNotification } from "../services/notificationService";
import { NotificationType } from "../../generated/prisma/enums";
import { getIO } from "../lib/socket";
import { logAuditAction } from "../services/auditService";
import { storageService } from "../services/storageService";
import path from "path";
import crypto from "crypto";
import xss from "xss";

const safeUserSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true,
};

/* =========================================================
   LABELS (TASK-LEVEL)
========================================================= */

export const addLabelToTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;
        const { labelId } = req.body;

        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
            res.status(404).json({ success: false, error: "Task not found" });
            return;
        }

        const taskLabel = await prisma.taskLabel.upsert({
            where: { taskId_labelId: { taskId, labelId } },
            create: { taskId, labelId },
            update: {},
            include: { label: true },
        });

        try {
            getIO().to(task.projectId).emit("taskLabelAdded", { taskId, label: taskLabel.label });
        } catch (e) {
            console.error("Failed to emit taskLabelAdded", e);
        }

        res.status(201).json({ success: true, data: taskLabel });
    } catch (error: any) {
        console.error("Error adding label to task:", error);
        res.status(500).json({ success: false, error: "Failed to add label to task" });
    }
};

export const removeLabelFromTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId, labelId } = req.params;

        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
            res.status(404).json({ success: false, error: "Task not found" });
            return;
        }

        await prisma.taskLabel.deleteMany({
            where: { taskId, labelId },
        });

        try {
            getIO().to(task.projectId).emit("taskLabelRemoved", { taskId, labelId });
        } catch (e) {
            console.error("Failed to emit taskLabelRemoved", e);
        }

        res.status(200).json({ success: true, message: "Label removed from task" });
    } catch (error: any) {
        console.error("Error removing label from task:", error);
        res.status(500).json({ success: false, error: "Failed to remove label from task" });
    }
};

/* =========================================================
   CHECKLISTS
========================================================= */

export const getTaskChecklists = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;

        const checklists = await prisma.taskChecklist.findMany({
            where: { taskId },
            include: {
                items: { orderBy: { createdAt: "asc" } },
            },
            orderBy: { createdAt: "asc" },
        });

        res.status(200).json({ success: true, data: checklists });
    } catch (error: any) {
        console.error("Error fetching checklists:", error);
        res.status(500).json({ success: false, error: "Failed to fetch checklists" });
    }
};

export const createChecklist = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;
        const { title } = req.body;

        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
            res.status(404).json({ success: false, error: "Task not found" });
            return;
        }

        const checklist = await prisma.taskChecklist.create({
            data: {
                title: title && typeof title === "string" ? xss(title.trim()) : "Checklist",
                taskId,
            },
            include: {
                items: true,
            },
        });

        try {
            getIO().to(task.projectId).emit("checklistCreated", { taskId, checklist });
        } catch (e) {
            console.error("Failed to emit checklistCreated", e);
        }

        res.status(201).json({ success: true, data: checklist });
    } catch (error: any) {
        console.error("Error creating checklist:", error);
        res.status(500).json({ success: false, error: "Failed to create checklist" });
    }
};

export const deleteChecklist = async (req: Request, res: Response): Promise<void> => {
    try {
        const { checklistId } = req.params;

        const checklist = await prisma.taskChecklist.findUnique({
            where: { id: checklistId },
            include: { task: true },
        });

        if (!checklist) {
            res.status(404).json({ success: false, error: "Checklist not found" });
            return;
        }

        const taskId = checklist.taskId;
        const projectId = checklist.task.projectId;

        await prisma.taskChecklist.delete({ where: { id: checklistId } });

        try {
            getIO().to(projectId).emit("checklistDeleted", { taskId, checklistId });
        } catch (e) {
            console.error("Failed to emit checklistDeleted", e);
        }

        res.status(200).json({ success: true, message: "Checklist deleted" });
    } catch (error: any) {
        console.error("Error deleting checklist:", error);
        res.status(500).json({ success: false, error: "Failed to delete checklist" });
    }
};

export const addChecklistItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { checklistId } = req.params;
        const { content } = req.body;

        if (!content || typeof content !== "string" || !content.trim()) {
            res.status(400).json({ success: false, error: "Item content is required" });
            return;
        }

        const checklist = await prisma.taskChecklist.findUnique({
            where: { id: checklistId },
            include: { task: true },
        });

        if (!checklist) {
            res.status(404).json({ success: false, error: "Checklist not found" });
            return;
        }

        const item = await prisma.taskChecklistItem.create({
            data: {
                content: xss(content.trim()),
                checklistId,
                isCompleted: false,
            },
        });

        try {
            getIO().to(checklist.task.projectId).emit("checklistItemAdded", {
                taskId: checklist.taskId,
                checklistId,
                item,
            });
        } catch (e) {
            console.error("Failed to emit checklistItemAdded", e);
        }

        res.status(201).json({ success: true, data: item });
    } catch (error: any) {
        console.error("Error adding checklist item:", error);
        res.status(500).json({ success: false, error: "Failed to add checklist item" });
    }
};

export const updateChecklistItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { itemId } = req.params;
        const { isCompleted, content } = req.body;

        const itemToUpdate = await prisma.taskChecklistItem.findUnique({
            where: { id: itemId },
            include: { checklist: { include: { task: true } } },
        });

        if (!itemToUpdate) {
            res.status(404).json({ success: false, error: "Item not found" });
            return;
        }

        const updateData: any = {};
        if (isCompleted !== undefined) updateData.isCompleted = Boolean(isCompleted);
        if (content !== undefined && typeof content === "string") updateData.content = xss(content.trim());

        const item = await prisma.taskChecklistItem.update({
            where: { id: itemId },
            data: updateData,
        });

        const task = itemToUpdate.checklist.task;

        try {
            getIO().to(task.projectId).emit("checklistItemUpdated", {
                taskId: task.id,
                checklistId: itemToUpdate.checklistId,
                item,
            });
        } catch (e) {
            console.error("Failed to emit checklistItemUpdated", e);
        }

        // Trigger Notification: Subtask Completed
        if (isCompleted && !itemToUpdate.isCompleted) {
            if (task.assigneeId && task.assigneeId !== req.user!.id) {
                createAndSendNotification({
                    userId: task.assigneeId,
                    projectId: task.projectId,
                    taskId: task.id,
                    type: NotificationType.SUBTASK_COMPLETED,
                    title: "Subtask Completed",
                    message: `Checklist item "${itemToUpdate.content}" in task "${task.title}" was completed by ${req.user!.firstName || "a team member"}`,
                    link: `/projects/${task.projectId}`,
                }).catch((err) => console.error("Notification error:", err));
            }

            logAuditAction({
                userId: req.user?.id,
                workspaceId: req.workspace?.id,
                projectId: task.projectId,
                action: "TASK_UPDATED",
                entityType: "Task",
                entityId: task.id,
                details: { itemContent: item.content, status: "completed" },
                ipAddress: req.ip,
                userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
            }).catch((err) => console.error("Audit log error:", err));
        }

        res.status(200).json({ success: true, data: item });
    } catch (error: any) {
        console.error("Error updating checklist item:", error);
        res.status(500).json({ success: false, error: "Failed to update checklist item" });
    }
};

export const deleteChecklistItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { itemId } = req.params;

        const item = await prisma.taskChecklistItem.findUnique({
            where: { id: itemId },
            include: { checklist: { include: { task: true } } },
        });

        if (!item) {
            res.status(404).json({ success: false, error: "Item not found" });
            return;
        }

        const taskId = item.checklist.taskId;
        const checklistId = item.checklistId;
        const projectId = item.checklist.task.projectId;

        await prisma.taskChecklistItem.delete({ where: { id: itemId } });

        try {
            getIO().to(projectId).emit("checklistItemDeleted", { taskId, checklistId, itemId });
        } catch (e) {
            console.error("Failed to emit checklistItemDeleted", e);
        }

        res.status(200).json({ success: true, message: "Checklist item deleted" });
    } catch (error: any) {
        console.error("Error deleting checklist item:", error);
        res.status(500).json({ success: false, error: "Failed to delete checklist item" });
    }
};

/* =========================================================
   TIME TRACKING
========================================================= */

export const getTimeEntries = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;

        const entries = await prisma.timeEntry.findMany({
            where: { taskId },
            include: {
                user: { select: safeUserSelect },
            },
            orderBy: { date: "desc" },
        });

        const totalMinutes = entries.reduce((acc: number, curr: any) => acc + (curr.duration || 0), 0);

        res.status(200).json({
            success: true,
            totalMinutes,
            data: entries,
        });
    } catch (error: any) {
        console.error("Error fetching time entries:", error);
        res.status(500).json({ success: false, error: "Failed to fetch time entries" });
    }
};

export const addTimeEntry = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;
        const { duration, description, date } = req.body;

        const numDuration = Number(duration);
        if (isNaN(numDuration) || numDuration <= 0) {
            res.status(400).json({ success: false, error: "Duration must be a positive number of minutes" });
            return;
        }

        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
            res.status(404).json({ success: false, error: "Task not found" });
            return;
        }

        const entry = await prisma.timeEntry.create({
            data: {
                duration: Math.round(numDuration),
                description: description ? xss(String(description).trim()) : null,
                date: date ? new Date(date) : new Date(),
                taskId,
                userId: req.user!.id,
            },
            include: {
                user: { select: safeUserSelect },
            },
        });

        try {
            getIO().to(task.projectId).emit("timeEntryAdded", { taskId, entry });
        } catch (e) {
            console.error("Failed to emit timeEntryAdded", e);
        }

        logAuditAction({
            userId: req.user?.id,
            workspaceId: req.workspace?.id,
            projectId: task.projectId,
            action: "TASK_UPDATED",
            entityType: "TimeEntry",
            entityId: entry.id,
            details: { taskId, duration: entry.duration, description: entry.description },
            ipAddress: req.ip,
            userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(201).json({ success: true, data: entry });
    } catch (error: any) {
        console.error("Error adding time entry:", error);
        res.status(500).json({ success: false, error: "Failed to add time entry" });
    }
};

export const deleteTimeEntry = async (req: Request, res: Response): Promise<void> => {
    try {
        const { entryId } = req.params;

        const entry = await prisma.timeEntry.findUnique({
            where: { id: entryId },
            include: { task: true },
        });

        if (!entry) {
            res.status(404).json({ success: false, error: "Time entry not found" });
            return;
        }

        const taskId = entry.taskId;
        const projectId = entry.task.projectId;

        await prisma.timeEntry.delete({ where: { id: entryId } });

        try {
            getIO().to(projectId).emit("timeEntryDeleted", { taskId, entryId });
        } catch (e) {
            console.error("Failed to emit timeEntryDeleted", e);
        }

        res.status(200).json({ success: true, message: "Time entry deleted" });
    } catch (error: any) {
        console.error("Error deleting time entry:", error);
        res.status(500).json({ success: false, error: "Failed to delete time entry" });
    }
};

/* =========================================================
   ATTACHMENTS
========================================================= */

export const getTaskAttachments = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;

        const attachments = await prisma.taskAttachment.findMany({
            where: { taskId },
            include: {
                uploadedBy: { select: safeUserSelect },
            },
            orderBy: { createdAt: "desc" },
        });

        res.status(200).json({ success: true, data: attachments });
    } catch (error: any) {
        console.error("Error fetching task attachments:", error);
        res.status(500).json({ success: false, error: "Failed to fetch task attachments" });
    }
};

export const uploadTaskAttachment = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;
        const file = req.file;

        if (!file) {
            res.status(400).json({ success: false, error: "File is required" });
            return;
        }

        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
            res.status(404).json({ success: false, error: "Task not found" });
            return;
        }

        const ext = path.extname(file.originalname);
        const randomName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
        const key = `task-attachments/${taskId}/${randomName}`;

        await storageService.uploadFile(key, file.buffer, file.mimetype);
        const fileUrl = `/uploads/${key}`;

        const attachment = await prisma.taskAttachment.create({
            data: {
                fileName: xss(file.originalname),
                fileUrl,
                fileType: file.mimetype || ext.replace('.', ''),
                fileSize: file.size,
                taskId,
                uploadedById: req.user!.id,
            },
            include: {
                uploadedBy: { select: safeUserSelect },
            },
        });

        try {
            getIO().to(task.projectId).emit("taskAttachmentAdded", { taskId, attachment });
        } catch (e) {
            console.error("Failed to emit taskAttachmentAdded", e);
        }

        logAuditAction({
            userId: req.user?.id,
            workspaceId: req.workspace?.id,
            projectId: task.projectId,
            action: "TASK_UPDATED",
            entityType: "Attachment",
            entityId: attachment.id,
            details: { taskId, fileName: attachment.fileName, size: attachment.fileSize },
            ipAddress: req.ip,
            userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(201).json({ success: true, data: attachment });
    } catch (error: any) {
        console.error("Error uploading task attachment:", error);
        res.status(500).json({ success: false, error: "Failed to upload task attachment" });
    }
};

export const deleteTaskAttachment = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId, attachmentId } = req.params;

        const attachment = await prisma.taskAttachment.findUnique({
            where: { id: attachmentId },
            include: { task: true },
        });

        if (!attachment || attachment.taskId !== taskId) {
            res.status(404).json({ success: false, error: "Attachment not found" });
            return;
        }

        // Try deleting file from storage
        try {
            const key = attachment.fileUrl.replace('/uploads/', '');
            await storageService.deleteFile(key);
        } catch (e) {
            console.error("Failed to delete physical file:", e);
        }

        await prisma.taskAttachment.delete({ where: { id: attachmentId } });

        try {
            getIO().to(attachment.task.projectId).emit("taskAttachmentDeleted", { taskId, attachmentId });
        } catch (e) {
            console.error("Failed to emit taskAttachmentDeleted", e);
        }

        res.status(200).json({ success: true, message: "Attachment deleted successfully" });
    } catch (error: any) {
        console.error("Error deleting task attachment:", error);
        res.status(500).json({ success: false, error: "Failed to delete task attachment" });
    }
};

/* =========================================================
   TASK ACTIVITY / AUDIT TRAIL
========================================================= */

export const getTaskActivity = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;

        const logs = await prisma.auditLog.findMany({
            where: {
                OR: [
                    { entityId: taskId },
                    { details: { path: ["taskId"], equals: taskId } }
                ]
            },
            include: {
                user: { select: safeUserSelect },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        res.status(200).json({ success: true, data: logs });
    } catch (error: any) {
        console.error("Error fetching task activity:", error);
        res.status(500).json({ success: false, error: "Failed to fetch task activity" });
    }
};
