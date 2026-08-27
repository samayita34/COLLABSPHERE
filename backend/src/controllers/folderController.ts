import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const getFolders = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const folders = await prisma.folder.findMany({
            where: { projectId },
            include: {
                _count: {
                    select: { files: true, children: true }
                }
            },
            orderBy: { name: 'asc' }
        });
        res.status(200).json({ success: true, data: folders });
    } catch (error) {
        console.error("Error fetching folders:", error);
        res.status(500).json({ success: false, error: "Failed to fetch folders" });
    }
};

export const createFolder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { name, parentId } = req.body;

        if (!name || typeof name !== 'string') {
            res.status(400).json({ success: false, error: "Valid folder name is required" });
            return;
        }

        const folder = await prisma.folder.create({
            data: {
                name,
                projectId,
                parentId: parentId || null
            }
        });
        res.status(201).json({ success: true, data: folder });
    } catch (error) {
        console.error("Error creating folder:", error);
        res.status(500).json({ success: false, error: "Failed to create folder" });
    }
};

export const renameFolder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, folderId } = req.params;
        const { name } = req.body;

        if (!name || typeof name !== 'string') {
            res.status(400).json({ success: false, error: "Valid folder name is required" });
            return;
        }

        const folder = await prisma.folder.update({
            where: { id: folderId },
            data: { name }
        });
        res.status(200).json({ success: true, data: folder });
    } catch (error) {
        console.error("Error renaming folder:", error);
        res.status(500).json({ success: false, error: "Failed to rename folder" });
    }
};

export const moveFolder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, folderId } = req.params;
        const { parentId } = req.body;

        if (parentId === folderId) {
            res.status(400).json({ success: false, error: "Cannot move folder into itself" });
            return;
        }

        const folder = await prisma.folder.update({
            where: { id: folderId },
            data: { parentId: parentId || null }
        });
        res.status(200).json({ success: true, data: folder });
    } catch (error) {
        console.error("Error moving folder:", error);
        res.status(500).json({ success: false, error: "Failed to move folder" });
    }
};

export const deleteFolder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, folderId } = req.params;
        await prisma.folder.delete({
            where: { id: folderId }
        });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error deleting folder:", error);
        res.status(500).json({ success: false, error: "Failed to delete folder" });
    }
};
