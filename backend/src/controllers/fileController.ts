import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { FileType, NotificationType, AuditAction } from "../../generated/prisma/enums";
import { createAndSendNotification } from "../services/notificationService";
import { logAuditAction } from "../services/auditService";
import { storageService } from "../services/storageService";

function formatFile(file: any) {
    return {
        id: file.id,
        name: file.name,
        type: file.type,
        description: file.description,
        projectId: file.projectId,
        folderId: file.folderId,
        isLocked: file.isLocked,
        lockedBy: file.lockedBy,
        versions: file.versions?.map((v: any) => ({
            id: v.id,
            versionNum: v.versionNum,
            s3Key: v.s3Key,
            sizeBytes: v.sizeBytes.toString(),
            uploadedBy: v.uploadedBy,
            createdAt: v.createdAt
        })),
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
    };
}

export const getFilesByProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const projectId = req.params.projectId as string;
        const folderId = req.query.folderId as string | undefined;

        const files = await prisma.file.findMany({
            where: { 
                projectId,
                folderId: folderId ? String(folderId) : null
            },
            include: {
                versions: {
                    include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
                    orderBy: { versionNum: 'desc' }
                },
                lockedBy: { select: { id: true, firstName: true, lastName: true } }
            },
            orderBy: { createdAt: "desc" },
        });

        res.status(200).json({
            success: true,
            count: files.length,
            data: files.map(formatFile),
        });
    } catch (error) {
        console.error("Error fetching files:", error);
        res.status(500).json({ success: false, error: "Failed to fetch files" });
    }
};

export const createFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const projectId = req.params.projectId as string;
        const { name, folderId, description } = req.body;
        const uploadedFile = req.file;

        if (!uploadedFile) {
            res.status(400).json({ success: false, error: "File buffer is required" });
            return;
        }

        if (!name || typeof name !== "string" || name.trim() === "") {
            res.status(400).json({ success: false, error: "File name is required" });
            return;
        }

        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        // Check workspace storage quota
        const workspace = await prisma.workspace.findUnique({
            where: { id: req.workspace?.id }
        });
        
        const newSize = BigInt(uploadedFile.size);
        if (workspace && workspace.storageUsed + newSize > workspace.storageQuota) {
            res.status(403).json({ success: false, error: "Storage quota exceeded" });
            return;
        }

        // Check if file with same name exists in same folder to create a new version
        let file = await prisma.file.findFirst({
            where: {
                projectId,
                folderId: folderId || null,
                name: name.trim()
            },
            include: { versions: { orderBy: { versionNum: 'desc' }, take: 1 } }
        });

        if (file && file.isLocked && file.lockedById !== userId) {
            res.status(403).json({ success: false, error: "File is locked by another user" });
            return;
        }

        // Upload to Storage
        const s3Key = `projects/${projectId}/${Date.now()}-${name}`;
        await storageService.uploadFile(s3Key, uploadedFile.buffer, uploadedFile.mimetype);

        let newVersionNum = 1;
        
        if (!file) {
            // Create new file
            let fileType: FileType = FileType.PDF;
            // determine type logic could be enhanced based on mimetype
            if (uploadedFile.mimetype.includes('image')) fileType = FileType.PNG;
            else if (uploadedFile.mimetype.includes('video')) fileType = FileType.MP4;
            else if (uploadedFile.mimetype.includes('zip')) fileType = FileType.ZIP;

            file = await prisma.file.create({
                data: {
                    name: name.trim(),
                    description: description || null,
                    projectId,
                    folderId: folderId || null,
                    type: fileType
                },
                include: { versions: true } // just for type compatibility below
            });
        } else {
            newVersionNum = file.versions.length > 0 ? file.versions[0].versionNum + 1 : 1;
        }

        // Create new version
        const newVersion = await prisma.fileVersion.create({
            data: {
                versionNum: newVersionNum,
                s3Key,
                sizeBytes: newSize,
                fileId: file.id,
                uploadedById: userId
            }
        });

        // Update workspace quota
        if (workspace) {
            await prisma.workspace.update({
                where: { id: workspace.id },
                data: { storageUsed: workspace.storageUsed + newSize }
            });
        }

        // Audit Log
        logAuditAction({
            userId,
            workspaceId: req.workspace?.id,
            projectId,
            action: file.versions ? AuditAction.FILE_UPLOADED : AuditAction.FILE_UPLOADED,
            entityType: "File",
            entityId: file.id,
            details: { name: file.name, version: newVersionNum },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        // Trigger Notification if file uploaded by someone other than project owner
        if (req.project?.ownerId && req.project.ownerId !== userId) {
            createAndSendNotification({
                userId: req.project.ownerId,
                workspaceId: req.workspace?.id,
                type: NotificationType.FILE_UPLOADED,
                title: "File Uploaded",
                message: `File "${file.name}" was uploaded in project "${req.project.name}".`,
                link: `/projects/${projectId}`,
            }).catch((err) => console.error("Notification error:", err));
        }

        const updatedFile = await prisma.file.findUnique({
            where: { id: file.id },
            include: {
                versions: {
                    include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
                    orderBy: { versionNum: 'desc' }
                },
                lockedBy: { select: { id: true, firstName: true, lastName: true } }
            }
        });

        res.status(201).json({
            success: true,
            data: formatFile(updatedFile),
        });
    } catch (error) {
        console.error("Error creating file:", error);
        res.status(500).json({ success: false, error: "Failed to create/upload file" });
    }
};

export const deleteFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const projectId = req.params.projectId as string;
        const fileId = req.params.fileId as string;

        const file = await prisma.file.findUnique({
            where: { id: fileId },
            include: { versions: true }
        });

        if (!file) {
            res.status(404).json({ success: false, error: "File not found" });
            return;
        }

        if (file.isLocked && file.lockedById !== req.user?.id) {
            res.status(403).json({ success: false, error: "File is locked by another user" });
            return;
        }

        // Delete from Storage
        let freedStorage = BigInt(0);
        for (const version of file.versions) {
            await storageService.deleteFile(version.s3Key);
            freedStorage += version.sizeBytes;
        }

        await prisma.file.delete({ where: { id: fileId } });

        // Update workspace quota
        if (req.workspace?.id) {
            const workspace = await prisma.workspace.findUnique({ where: { id: req.workspace.id } });
            if (workspace) {
                await prisma.workspace.update({
                    where: { id: workspace.id },
                    data: { storageUsed: workspace.storageUsed - freedStorage > 0 ? workspace.storageUsed - freedStorage : 0 }
                });
            }
        }

        res.status(200).json({ success: true, message: "File deleted successfully" });
    } catch (error) {
        console.error("Error deleting file:", error);
        res.status(500).json({ success: false, error: "Failed to delete file" });
    }
};

export const downloadFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { fileId } = req.params;
        const versionId = req.query.versionId as string | undefined;

        const file = await prisma.file.findUnique({ where: { id: fileId } });
        if (!file) {
            res.status(404).json({ success: false, error: "File not found" });
            return;
        }

        let version;
        if (versionId) {
            version = await prisma.fileVersion.findUnique({ where: { id: String(versionId) } });
        } else {
            version = await prisma.fileVersion.findFirst({
                where: { fileId },
                orderBy: { versionNum: 'desc' }
            });
        }

        if (!version) {
            res.status(404).json({ success: false, error: "File version not found" });
            return;
        }

        // Track download
        if (req.user?.id) {
            await prisma.fileDownload.create({
                data: {
                    fileId: file.id,
                    downloadedById: req.user.id
                }
            });
        }

        // Fetch URL or Buffer from storage service
        // We'll redirect to a pre-signed URL or download endpoint
        const url = await storageService.getFileUrl(version.s3Key);
        res.redirect(url);
    } catch (error) {
        console.error("Error downloading file:", error);
        res.status(500).json({ success: false, error: "Failed to download file" });
    }
};

export const toggleLockFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { fileId } = req.params;
        const file = await prisma.file.findUnique({ where: { id: fileId } });

        if (!file) {
            res.status(404).json({ success: false, error: "File not found" });
            return;
        }

        if (file.isLocked && file.lockedById !== req.user?.id) {
            res.status(403).json({ success: false, error: "File is locked by another user" });
            return;
        }

        const updatedFile = await prisma.file.update({
            where: { id: fileId },
            data: {
                isLocked: !file.isLocked,
                lockedById: !file.isLocked ? req.user?.id : null
            },
            include: {
                versions: {
                    include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
                    orderBy: { versionNum: 'desc' }
                },
                lockedBy: { select: { id: true, firstName: true, lastName: true } }
            }
        });

        res.status(200).json({ success: true, data: formatFile(updatedFile) });
    } catch (error) {
        console.error("Error locking/unlocking file:", error);
        res.status(500).json({ success: false, error: "Failed to toggle file lock" });
    }
};

// Also we need an actual download raw endpoint if using local storage
export const downloadRawFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const key = req.params.key as string;
        const buffer = await storageService.getFileBuffer(key);
        res.setHeader('Content-Disposition', `attachment; filename="${key.split('-').pop()}"`);
        res.send(buffer);
    } catch (error) {
        res.status(404).send("File not found");
    }
};
