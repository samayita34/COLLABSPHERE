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
        fileUrl: file.fileUrl,
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

        // requireProjectAccess has verified access and project existence.

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

        // requireProjectAccess has verified access and project existence.

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
        
        let finalSize = size;
        let fileUrl = null;
        if (req.file) {
            finalSize = (req.file.size / 1024 / 1024).toFixed(2) + " MB";
            fileUrl = "/uploads/" + req.file.filename;
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
                size: finalSize ? finalSize.trim() : "Unknown",
                uploadedBy: uploadedBy.trim(),
                description: description ? String(description).trim() : null,
                fileUrl: fileUrl,
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

        // requireFileAccess has verified access and file existence.

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

/**
 * GET /api/files?workspaceId=...
 * Fetch all files for projects within a workspace.
 * Strictly scoped to the specified workspace and user's project access.
 */
export const getFilesByWorkspace = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Authentication required" });
            return;
        }

        const workspaceId = req.query.workspaceId as string;
        if (!workspaceId) {
            res.status(400).json({ success: false, error: "workspaceId query parameter is required" });
            return;
        }

        // Verify the user is a member of the workspace
        const wsMember = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
        });

        if (!wsMember) {
            res.status(403).json({ success: false, error: "Forbidden: You do not have access to this workspace" });
            return;
        }

        const whereClause: any = {
            project: {
                workspaceId,
            },
        };

        // If not a workspace admin, org admin, or super admin, restrict to projects the user owns or belongs to
        if (wsMember.role !== "WORKSPACE_ADMIN" && req.user?.role !== "SUPER_ADMIN" && req.orgRole !== "ORG_ADMIN") {
            whereClause.project.OR = [
                { ownerId: userId },
                { members: { some: { userId } } },
            ];
        }

        const files = await prisma.file.findMany({
            where: whereClause,
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        status: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const formatted = files.map((file: any) => ({
            id: file.id,
            name: file.name,
            type: file.type,
            size: file.size,
            uploadedBy: file.uploadedBy,
            description: file.description,
            fileUrl: file.fileUrl,
            projectId: file.projectId,
            projectName: file.project?.name,
            projectCode: file.project?.code,
            projectStatus: file.project?.status,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
        }));

        res.status(200).json({
            success: true,
            count: formatted.length,
            data: formatted,
        });
    } catch (error) {
        console.error("Error fetching workspace files:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch workspace files",
        });
    }
};

