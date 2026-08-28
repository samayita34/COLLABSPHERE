import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const getBoards = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;

        const boards = await prisma.board.findMany({
            where: { projectId },
            include: {
                columns: {
                    orderBy: { order: "asc" }
                },
                swimlanes: {
                    orderBy: { order: "asc" }
                }
            },
            orderBy: { createdAt: "asc" }
        });

        res.status(200).json({ success: true, data: boards });
    } catch (error: any) {
        console.error("Error fetching boards:", error);
        res.status(500).json({ success: false, error: "Failed to fetch boards" });
    }
};

export const createBoard = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { name, description } = req.body;

        if (!name || typeof name !== "string") {
            res.status(400).json({ success: false, error: "name is required" });
            return;
        }

        const board = await prisma.board.create({
            data: {
                name: name.trim(),
                description: description ? String(description).trim() : null,
                projectId
            }
        });

        res.status(201).json({ success: true, data: board });
    } catch (error: any) {
        console.error("Error creating board:", error);
        res.status(500).json({ success: false, error: "Failed to create board" });
    }
};

export const createColumn = async (req: Request, res: Response): Promise<void> => {
    try {
        const { boardId } = req.params;
        const { name, order } = req.body;

        if (!name || typeof name !== "string") {
            res.status(400).json({ success: false, error: "name is required" });
            return;
        }

        const board = await prisma.board.findUnique({ where: { id: boardId } });
        if (!board || board.projectId !== req.params.projectId) {
            res.status(404).json({ success: false, error: "Board not found" });
            return;
        }

        const column = await prisma.column.create({
            data: {
                name: name.trim(),
                order: typeof order === "number" ? order : 0,
                boardId
            }
        });

        res.status(201).json({ success: true, data: column });
    } catch (error: any) {
        console.error("Error creating column:", error);
        res.status(500).json({ success: false, error: "Failed to create column" });
    }
};

export const updateColumn = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, order } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = String(name).trim();
        if (order !== undefined && typeof order === "number") updateData.order = order;

        const columnToUpdate = await prisma.column.findUnique({ 
            where: { id },
            include: { board: true }
        });
        
        if (!columnToUpdate || columnToUpdate.board.projectId !== req.params.projectId) {
            res.status(404).json({ success: false, error: "Column not found" });
            return;
        }

        const column = await prisma.column.update({
            where: { id },
            data: updateData
        });

        res.status(200).json({ success: true, data: column });
    } catch (error: any) {
        console.error("Error updating column:", error);
        res.status(500).json({ success: false, error: "Failed to update column" });
    }
};
