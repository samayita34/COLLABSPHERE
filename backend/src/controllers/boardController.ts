import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { getIO } from "../lib/socket";
import { logAuditAction } from "../services/auditService";
import xss from "xss";

export const getBoards = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;

        let boards = await prisma.board.findMany({
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

        // If project has no boards yet, create a default board with standard columns
        if (boards.length === 0) {
            const defaultBoard = await prisma.board.create({
                data: {
                    name: "Main Board",
                    description: "Default project board",
                    projectId,
                    columns: {
                        create: [
                            { name: "To Do", order: 1000 },
                            { name: "In Progress", order: 2000 },
                            { name: "Review", order: 3000 },
                            { name: "Done", order: 4000 },
                        ]
                    }
                },
                include: {
                    columns: { orderBy: { order: "asc" } },
                    swimlanes: { orderBy: { order: "asc" } }
                }
            });
            boards = [defaultBoard];
        }

        res.status(200).json({ success: true, data: boards });
    } catch (error: any) {
        console.error("Error fetching boards:", error);
        res.status(500).json({ success: false, error: "Failed to fetch boards" });
    }
};

export const createBoard = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { name, description, template } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
            res.status(400).json({ success: false, error: "Board name is required" });
            return;
        }

        // Setup default columns based on template
        let columnsToCreate = [
            { name: "To Do", order: 1000 },
            { name: "In Progress", order: 2000 },
            { name: "Done", order: 3000 },
        ];

        if (template === "scrum") {
            columnsToCreate = [
                { name: "Sprint Backlog", order: 1000 },
                { name: "In Progress", order: 2000 },
                { name: "Code Review", order: 3000 },
                { name: "QA / Testing", order: 4000 },
                { name: "Done", order: 5000 },
            ];
        } else if (template === "bug-tracker") {
            columnsToCreate = [
                { name: "Reported", order: 1000 },
                { name: "Investigating", order: 2000 },
                { name: "Fix in Progress", order: 3000 },
                { name: "Verified", order: 4000 },
                { name: "Resolved", order: 5000 },
            ];
        } else if (template === "custom" && Array.isArray(req.body.columns) && req.body.columns.length > 0) {
            columnsToCreate = req.body.columns.map((c: any, idx: number) => ({
                name: String(c.name || `Column ${idx + 1}`).trim(),
                order: (idx + 1) * 1000,
            }));
        }

        const board = await prisma.board.create({
            data: {
                name: xss(name.trim()),
                description: description ? xss(String(description).trim()) : null,
                projectId,
                columns: {
                    create: columnsToCreate,
                },
            },
            include: {
                columns: { orderBy: { order: "asc" } },
                swimlanes: { orderBy: { order: "asc" } },
            },
        });

        try {
            getIO().to(projectId).emit("boardCreated", board);
        } catch (e) {
            console.error("Failed to emit boardCreated", e);
        }

        logAuditAction({
            userId: req.user?.id,
            workspaceId: req.workspace?.id,
            projectId: projectId as string,
            action: "PROJECT_UPDATED",
            entityType: "Board",
            entityId: board.id,
            details: { name: board.name, columnsCount: board.columns.length },
            ipAddress: req.ip,
            userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(201).json({ success: true, data: board });
    } catch (error: any) {
        console.error("Error creating board:", error);
        res.status(500).json({ success: false, error: "Failed to create board" });
    }
};

export const updateBoard = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, boardId } = req.params;
        const { name, description } = req.body;

        const existing = await prisma.board.findUnique({ where: { id: boardId } });
        if (!existing || existing.projectId !== projectId) {
            res.status(404).json({ success: false, error: "Board not found" });
            return;
        }

        const updateData: any = {};
        if (name && typeof name === "string") updateData.name = xss(name.trim());
        if (description !== undefined) updateData.description = description ? xss(String(description).trim()) : null;

        const board = await prisma.board.update({
            where: { id: boardId },
            data: updateData,
            include: {
                columns: { orderBy: { order: "asc" } },
                swimlanes: { orderBy: { order: "asc" } },
            },
        });

        try {
            getIO().to(projectId).emit("boardUpdated", board);
        } catch (e) {
            console.error("Failed to emit boardUpdated", e);
        }

        res.status(200).json({ success: true, data: board });
    } catch (error: any) {
        console.error("Error updating board:", error);
        res.status(500).json({ success: false, error: "Failed to update board" });
    }
};

export const deleteBoard = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, boardId } = req.params;

        const existing = await prisma.board.findUnique({ where: { id: boardId } });
        if (!existing || existing.projectId !== projectId) {
            res.status(404).json({ success: false, error: "Board not found" });
            return;
        }

        // Count total boards in project - prevent deleting the last board
        const count = await prisma.board.count({ where: { projectId } });
        if (count <= 1) {
            res.status(400).json({ success: false, error: "Cannot delete the only board in a project" });
            return;
        }

        await prisma.board.delete({ where: { id: boardId } });

        try {
            getIO().to(projectId).emit("boardDeleted", boardId);
        } catch (e) {
            console.error("Failed to emit boardDeleted", e);
        }

        res.status(200).json({ success: true, message: "Board deleted successfully" });
    } catch (error: any) {
        console.error("Error deleting board:", error);
        res.status(500).json({ success: false, error: "Failed to delete board" });
    }
};

/* =========================================================
   COLUMNS
========================================================= */

export const createColumn = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, boardId } = req.params;
        const { name, order } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
            res.status(400).json({ success: false, error: "Column name is required" });
            return;
        }

        const board = await prisma.board.findUnique({ where: { id: boardId } });
        if (!board || board.projectId !== projectId) {
            res.status(404).json({ success: false, error: "Board not found" });
            return;
        }

        let columnOrder = typeof order === "number" ? order : 0;
        if (order === undefined) {
            const lastCol = await prisma.column.findFirst({
                where: { boardId },
                orderBy: { order: "desc" },
            });
            columnOrder = lastCol ? lastCol.order + 1000 : 1000;
        }

        const column = await prisma.column.create({
            data: {
                name: xss(name.trim()),
                order: columnOrder,
                boardId,
            },
        });

        try {
            getIO().to(projectId).emit("columnCreated", { boardId, column });
        } catch (e) {
            console.error("Failed to emit columnCreated", e);
        }

        res.status(201).json({ success: true, data: column });
    } catch (error: any) {
        console.error("Error creating column:", error);
        res.status(500).json({ success: false, error: "Failed to create column" });
    }
};

export const updateColumn = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, columnId } = req.params;
        const { name, order } = req.body;

        const columnToUpdate = await prisma.column.findUnique({
            where: { id: columnId },
            include: { board: true },
        });

        if (!columnToUpdate || columnToUpdate.board.projectId !== projectId) {
            res.status(404).json({ success: false, error: "Column not found" });
            return;
        }

        const updateData: any = {};
        if (name !== undefined && typeof name === "string") updateData.name = xss(name.trim());
        if (order !== undefined && typeof order === "number") updateData.order = order;

        const column = await prisma.column.update({
            where: { id: columnId },
            data: updateData,
        });

        try {
            getIO().to(projectId).emit("columnUpdated", { boardId: columnToUpdate.boardId, column });
        } catch (e) {
            console.error("Failed to emit columnUpdated", e);
        }

        res.status(200).json({ success: true, data: column });
    } catch (error: any) {
        console.error("Error updating column:", error);
        res.status(500).json({ success: false, error: "Failed to update column" });
    }
};

export const deleteColumn = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, columnId } = req.params;

        const column = await prisma.column.findUnique({
            where: { id: columnId },
            include: { board: true },
        });

        if (!column || column.board.projectId !== projectId) {
            res.status(404).json({ success: false, error: "Column not found" });
            return;
        }

        const boardId = column.boardId;

        // Set columnId to null for tasks in this column before deleting
        await prisma.task.updateMany({
            where: { columnId },
            data: { columnId: null },
        });

        await prisma.column.delete({ where: { id: columnId } });

        try {
            getIO().to(projectId).emit("columnDeleted", { boardId, columnId });
        } catch (e) {
            console.error("Failed to emit columnDeleted", e);
        }

        res.status(200).json({ success: true, message: "Column deleted successfully" });
    } catch (error: any) {
        console.error("Error deleting column:", error);
        res.status(500).json({ success: false, error: "Failed to delete column" });
    }
};

export const reorderColumns = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, boardId } = req.params;
        const { columnIds } = req.body; // array of column ids in new order

        if (!Array.isArray(columnIds)) {
            res.status(400).json({ success: false, error: "columnIds must be an array" });
            return;
        }

        const updates = columnIds.map((id: string, index: number) =>
            prisma.column.update({
                where: { id },
                data: { order: (index + 1) * 1000 },
            })
        );

        await prisma.$transaction(updates);

        const updatedColumns = await prisma.column.findMany({
            where: { boardId },
            orderBy: { order: "asc" },
        });

        try {
            getIO().to(projectId).emit("columnsReordered", { boardId, columns: updatedColumns });
        } catch (e) {
            console.error("Failed to emit columnsReordered", e);
        }

        res.status(200).json({ success: true, data: updatedColumns });
    } catch (error: any) {
        console.error("Error reordering columns:", error);
        res.status(500).json({ success: false, error: "Failed to reorder columns" });
    }
};

/* =========================================================
   SWIMLANES
========================================================= */

export const createSwimlane = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, boardId } = req.params;
        const { name, order } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
            res.status(400).json({ success: false, error: "Swimlane name is required" });
            return;
        }

        const board = await prisma.board.findUnique({ where: { id: boardId } });
        if (!board || board.projectId !== projectId) {
            res.status(404).json({ success: false, error: "Board not found" });
            return;
        }

        let laneOrder = typeof order === "number" ? order : 0;
        if (order === undefined) {
            const lastLane = await prisma.swimlane.findFirst({
                where: { boardId },
                orderBy: { order: "desc" },
            });
            laneOrder = lastLane ? lastLane.order + 1000 : 1000;
        }

        const swimlane = await prisma.swimlane.create({
            data: {
                name: xss(name.trim()),
                order: laneOrder,
                boardId,
            },
        });

        try {
            getIO().to(projectId).emit("swimlaneCreated", { boardId, swimlane });
        } catch (e) {
            console.error("Failed to emit swimlaneCreated", e);
        }

        res.status(201).json({ success: true, data: swimlane });
    } catch (error: any) {
        console.error("Error creating swimlane:", error);
        res.status(500).json({ success: false, error: "Failed to create swimlane" });
    }
};

export const updateSwimlane = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, swimlaneId } = req.params;
        const { name, order } = req.body;

        const swimlane = await prisma.swimlane.findUnique({
            where: { id: swimlaneId },
            include: { board: true },
        });

        if (!swimlane || swimlane.board.projectId !== projectId) {
            res.status(404).json({ success: false, error: "Swimlane not found" });
            return;
        }

        const updateData: any = {};
        if (name !== undefined && typeof name === "string") updateData.name = xss(name.trim());
        if (order !== undefined && typeof order === "number") updateData.order = order;

        const updated = await prisma.swimlane.update({
            where: { id: swimlaneId },
            data: updateData,
        });

        try {
            getIO().to(projectId).emit("swimlaneUpdated", { boardId: swimlane.boardId, swimlane: updated });
        } catch (e) {
            console.error("Failed to emit swimlaneUpdated", e);
        }

        res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
        console.error("Error updating swimlane:", error);
        res.status(500).json({ success: false, error: "Failed to update swimlane" });
    }
};

export const deleteSwimlane = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, swimlaneId } = req.params;

        const swimlane = await prisma.swimlane.findUnique({
            where: { id: swimlaneId },
            include: { board: true },
        });

        if (!swimlane || swimlane.board.projectId !== projectId) {
            res.status(404).json({ success: false, error: "Swimlane not found" });
            return;
        }

        const boardId = swimlane.boardId;

        // Reset tasks in this swimlane to null
        await prisma.task.updateMany({
            where: { swimlaneId },
            data: { swimlaneId: null },
        });

        await prisma.swimlane.delete({ where: { id: swimlaneId } });

        try {
            getIO().to(projectId).emit("swimlaneDeleted", { boardId, swimlaneId });
        } catch (e) {
            console.error("Failed to emit swimlaneDeleted", e);
        }

        res.status(200).json({ success: true, message: "Swimlane deleted successfully" });
    } catch (error: any) {
        console.error("Error deleting swimlane:", error);
        res.status(500).json({ success: false, error: "Failed to delete swimlane" });
    }
};

export const reorderSwimlanes = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, boardId } = req.params;
        const { swimlaneIds } = req.body;

        if (!Array.isArray(swimlaneIds)) {
            res.status(400).json({ success: false, error: "swimlaneIds must be an array" });
            return;
        }

        const updates = swimlaneIds.map((id: string, index: number) =>
            prisma.swimlane.update({
                where: { id },
                data: { order: (index + 1) * 1000 },
            })
        );

        await prisma.$transaction(updates);

        const updatedSwimlanes = await prisma.swimlane.findMany({
            where: { boardId },
            orderBy: { order: "asc" },
        });

        try {
            getIO().to(projectId).emit("swimlanesReordered", { boardId, swimlanes: updatedSwimlanes });
        } catch (e) {
            console.error("Failed to emit swimlanesReordered", e);
        }

        res.status(200).json({ success: true, data: updatedSwimlanes });
    } catch (error: any) {
        console.error("Error reordering swimlanes:", error);
        res.status(500).json({ success: false, error: "Failed to reorder swimlanes" });
    }
};
