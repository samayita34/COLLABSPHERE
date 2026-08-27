import { Request, Response } from "express";
import prisma from "../lib/prisma";

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

        const item = await prisma.taskChecklistItem.update({
            where: { id: itemId },
            data: { isCompleted }
        });

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
