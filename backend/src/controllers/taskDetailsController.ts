import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { createAndSendNotification } from "../services/notificationService";
import { NotificationType } from "../../generated/prisma/enums";

export const addLabelToTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;
        const { labelId } = req.body;

        const taskLabel = await prisma.taskLabel.create({
            data: { taskId, labelId }
        });

        res.status(201).json({ success: true, data: taskLabel });
    } catch (error: any) {
        res.status(500).json({ success: false, error: "Failed to add label to task" });
    }
};

export const createChecklist = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;
        const { title } = req.body;

        const checklist = await prisma.taskChecklist.create({
            data: { title, taskId }
        });

        res.status(201).json({ success: true, data: checklist });
    } catch (error: any) {
        res.status(500).json({ success: false, error: "Failed to create checklist" });
    }
};

export const addChecklistItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { checklistId } = req.params;
        const { content } = req.body;

        const checklist = await prisma.taskChecklist.findUnique({
            where: { id: checklistId },
            include: { task: true }
        });

        if (!checklist) {
            res.status(404).json({ success: false, error: "Checklist not found" });
            return;
        }

        // Verify user has access to the task's project
        const member = await prisma.projectMember.findUnique({
            where: { projectId_userId: { projectId: checklist.task.projectId, userId: req.user!.id } }
        });
        const wsMember = await prisma.workspaceMember.findFirst({
            where: {
                userId: req.user!.id,
                workspace: { projects: { some: { id: checklist.task.projectId } } }
            }
        });

        const project = await prisma.project.findUnique({ where: { id: checklist.task.projectId } });

        if (!member && (!wsMember || wsMember.role !== "WORKSPACE_ADMIN") && project?.ownerId !== req.user!.id) {
            res.status(404).json({ success: false, error: "Access denied or checklist not found" });
            return;
        }

        const item = await prisma.taskChecklistItem.create({
            data: { content, checklistId }
        });

        res.status(201).json({ success: true, data: item });
    } catch (error: any) {
        res.status(500).json({ success: false, error: "Failed to add checklist item" });
    }
};

export const updateChecklistItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { itemId } = req.params;
        const { isCompleted } = req.body;

        const itemToUpdate = await prisma.taskChecklistItem.findUnique({
            where: { id: itemId },
            include: { checklist: { include: { task: true } } }
        });

        if (!itemToUpdate) {
            res.status(404).json({ success: false, error: "Item not found" });
            return;
        }

        const projectId = itemToUpdate.checklist.task.projectId;

        // Verify user has access to the task's project
        const member = await prisma.projectMember.findUnique({
            where: { projectId_userId: { projectId, userId: req.user!.id } }
        });
        const wsMember = await prisma.workspaceMember.findFirst({
            where: {
                userId: req.user!.id,
                workspace: { projects: { some: { id: projectId } } }
            }
        });
        const project = await prisma.project.findUnique({ where: { id: projectId } });

        if (!member && (!wsMember || wsMember.role !== "WORKSPACE_ADMIN") && project?.ownerId !== req.user!.id) {
            res.status(404).json({ success: false, error: "Access denied or item not found" });
            return;
        }

        const item = await prisma.taskChecklistItem.update({
            where: { id: itemId },
            data: { isCompleted }
        });

        // Trigger Notification: Subtask Completed
        if (isCompleted && !itemToUpdate.isCompleted) {
            const task = itemToUpdate.checklist.task;
            if (task.assigneeId && task.assigneeId !== req.user!.id) {
                createAndSendNotification({
                    userId: task.assigneeId,
                    projectId,
                    taskId: task.id,
                    type: NotificationType.SUBTASK_COMPLETED,
                    title: "Subtask Completed",
                    message: `Checklist item "${itemToUpdate.content}" in task "${task.title}" was completed by ${req.user!.firstName || "a team member"}`,
                    link: `/projects/${projectId}`,
                }).catch((err) => console.error("Notification error:", err));
            }
        }

        res.status(200).json({ success: true, data: item });
    } catch (error: any) {
        res.status(500).json({ success: false, error: "Failed to update checklist item" });
    }
};

export const addTimeEntry = async (req: Request, res: Response): Promise<void> => {
    try {
        const { taskId } = req.params;
        const { duration, description } = req.body;

        const entry = await prisma.timeEntry.create({
            data: {
                duration,
                description,
                taskId,
                userId: req.user!.id
            }
        });

        res.status(201).json({ success: true, data: entry });
    } catch (error: any) {
        res.status(500).json({ success: false, error: "Failed to add time entry" });
    }
};
