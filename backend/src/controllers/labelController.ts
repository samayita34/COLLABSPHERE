import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { getIO } from "../lib/socket";
import { logAuditAction } from "../services/auditService";
import xss from "xss";

export const getProjectLabels = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;

        const labels = await prisma.label.findMany({
            where: { projectId },
            orderBy: { createdAt: "asc" },
        });

        res.status(200).json({ success: true, data: labels });
    } catch (error: any) {
        console.error("Error fetching project labels:", error);
        res.status(500).json({ success: false, error: "Failed to fetch project labels" });
    }
};

export const createProjectLabel = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { name, color } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
            res.status(400).json({ success: false, error: "Label name is required" });
            return;
        }

        const cleanName = xss(name.trim());
        const cleanColor = color && typeof color === "string" ? xss(color.trim()) : "#3b82f6";

        // Check if label with same name already exists in project
        const existing = await prisma.label.findFirst({
            where: {
                projectId,
                name: { equals: cleanName, mode: "insensitive" },
            },
        });

        if (existing) {
            res.status(409).json({ success: false, error: "A label with this name already exists in this project", data: existing });
            return;
        }

        const label = await prisma.label.create({
            data: {
                name: cleanName,
                color: cleanColor,
                projectId,
            },
        });

        try {
            getIO().to(projectId).emit("labelCreated", label);
        } catch (e) {
            console.error("Failed to emit labelCreated", e);
        }

        logAuditAction({
            userId: req.user?.id,
            workspaceId: req.workspace?.id,
            projectId: projectId as string,
            action: "TASK_UPDATED",
            entityType: "Label",
            entityId: label.id,
            details: { name: label.name, color: label.color },
            ipAddress: req.ip,
            userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(201).json({ success: true, data: label });
    } catch (error: any) {
        console.error("Error creating label:", error);
        res.status(500).json({ success: false, error: "Failed to create label" });
    }
};

export const updateProjectLabel = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, labelId } = req.params;
        const { name, color } = req.body;

        const existing = await prisma.label.findUnique({ where: { id: labelId } });
        if (!existing || existing.projectId !== projectId) {
            res.status(404).json({ success: false, error: "Label not found" });
            return;
        }

        const updateData: any = {};
        if (name && typeof name === "string") updateData.name = xss(name.trim());
        if (color && typeof color === "string") updateData.color = xss(color.trim());

        const updated = await prisma.label.update({
            where: { id: labelId },
            data: updateData,
        });

        try {
            getIO().to(projectId).emit("labelUpdated", updated);
        } catch (e) {
            console.error("Failed to emit labelUpdated", e);
        }

        res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
        console.error("Error updating label:", error);
        res.status(500).json({ success: false, error: "Failed to update label" });
    }
};

export const deleteProjectLabel = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, labelId } = req.params;

        const existing = await prisma.label.findUnique({ where: { id: labelId } });
        if (!existing || existing.projectId !== projectId) {
            res.status(404).json({ success: false, error: "Label not found" });
            return;
        }

        await prisma.label.delete({ where: { id: labelId } });

        try {
            getIO().to(projectId).emit("labelDeleted", labelId);
        } catch (e) {
            console.error("Failed to emit labelDeleted", e);
        }

        res.status(200).json({ success: true, message: "Label deleted successfully" });
    } catch (error: any) {
        console.error("Error deleting label:", error);
        res.status(500).json({ success: false, error: "Failed to delete label" });
    }
};

export const addLabelToTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;
        const { labelId } = req.body;

        if (!labelId) {
            res.status(400).json({ success: false, error: "labelId is required" });
            return;
        }

        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
            res.status(404).json({ success: false, error: "Task not found" });
            return;
        }

        const taskLabel = await prisma.taskLabel.upsert({
            where: {
                taskId_labelId: { taskId, labelId },
            },
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
