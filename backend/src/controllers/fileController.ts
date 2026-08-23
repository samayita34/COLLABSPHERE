import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { FileType } from "../../generated/prisma/enums";

function formatFile(file: any) {
    return {
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedBy: file.uploadedBy,
        description: file.description,
        projectId: file.projectId,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
    };
}

/**
 * GET /api/projects/:projectId/files
 * Fetch all files associated with a given project.
 */
export const getFilesByProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            res.status(404).json({
                success: false,
                error: "Project not found",
            });
            return;
        }

        const files = await prisma.file.findMany({
            where: { projectId },
            orderBy: { createdAt: "desc" },
        });

        res.status(200).json({
            success: true,
            count: files.length,
            data: files.map(formatFile),
        });
    } catch (error) {
        console.error("Error fetching files:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch files",
        });
    }
};

/**
 * POST /api/projects/:projectId/files
 * Create/upload a new file asset record for a project.
 */
export const createFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { name, type, size, uploadedBy, description } = req.body;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            res.status(404).json({
                success: false,
                error: "Project not found",
            });
            return;
        }

        if (!name || typeof name !== "string" || name.trim() === "") {
            res.status(400).json({
                success: false,
                error: "File name is required and must be a non-empty string",
            });
            return;
        }

        if (!size || typeof size !== "string" || size.trim() === "") {
            res.status(400).json({
                success: false,
                error: "File size is required and must be a non-empty string",
            });
            return;
        }

        if (!uploadedBy || typeof uploadedBy !== "string" || uploadedBy.trim() === "") {
            res.status(400).json({
                success: false,
                error: "uploadedBy is required and must be a non-empty string",
            });
            return;
        }

        let fileType: FileType = FileType.PDF;
        if (type !== undefined) {
            if (!Object.values(FileType).includes(type)) {
                res.status(400).json({
                    success: false,
                    error: `Invalid file type. Allowed values are: ${Object.values(FileType).join(", ")}`,
                });
                return;
            }
            fileType = type as FileType;
        }

        const newFile = await prisma.file.create({
            data: {
                name: name.trim(),
                type: fileType,
                size: size.trim(),
                uploadedBy: uploadedBy.trim(),
                description: description ? String(description).trim() : null,
                projectId,
            },
        });

        res.status(201).json({
            success: true,
            message: "File created successfully",
            data: formatFile(newFile),
        });
    } catch (error) {
        console.error("Error creating file:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create file",
        });
    }
};

/**
 * DELETE /api/files/:id
 * Delete a file record by ID.
 */
export const deleteFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const existingFile = await prisma.file.findUnique({
            where: { id },
        });

        if (!existingFile) {
            res.status(404).json({
                success: false,
                error: "File not found",
            });
            return;
        }

        await prisma.file.delete({
            where: { id },
        });

        res.status(200).json({
            success: true,
            message: "File deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting file:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete file",
        });
    }
};
