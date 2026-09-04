import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { DocumentType, FileType, NotificationType, AuditAction } from "../../generated/prisma/enums";
import { createAndSendNotification } from "../services/notificationService";
import { logAuditAction } from "../services/auditService";
import { storageService } from "../services/storageService";
import { getMimeType, determineFileTypeToDocType } from "./fileController";
import fs from "fs";

function formatBytes(bytes: number | bigint): string {
    const b = Number(bytes);
    if (isNaN(b) || b === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function determineDocTypeToFileType(fileName: string): FileType {
    const ext = fileName.split(".").pop()?.toUpperCase() || "";
    if (["PNG", "WEBP", "SVG"].includes(ext)) return FileType.PNG;
    if (["JPG", "JPEG", "GIF"].includes(ext)) return FileType.JPG;
    if (["DOC", "DOCX", "TXT", "MD", "RTF"].includes(ext)) return FileType.DOC;
    if (["XLS", "XLSX", "CSV"].includes(ext)) return FileType.XLS;
    if (["PPT", "PPTX"].includes(ext)) return FileType.PPT;
    if (["ZIP", "TAR", "GZ", "RAR", "7Z"].includes(ext)) return FileType.ZIP;
    if (["MP4", "MOV", "AVI", "WEBM", "MKV"].includes(ext)) return FileType.MP4;
    return FileType.PDF;
}

/**
 * Generates a valid minimal PDF 1.4 binary stream as a fallback preview
 */
export function generateFallbackPdf(title: string, subtitle?: string): Buffer {
    const safeTitle = (title || "Document Preview").replace(/[()\\]/g, "");
    const safeSubtitle = (subtitle || "CollabSphere Document Viewer").replace(/[()\\]/g, "");
    const content = 
`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>
endobj
4 0 obj
<< /Length 260 >>
stream
BT
/F1 20 Tf
50 720 Td
(${safeTitle}) Tj
ET
BT
/F2 12 Tf
50 690 Td
(${safeSubtitle}) Tj
ET
BT
/F2 10 Tf
50 650 Td
(CollabSphere Document Preview - Live Viewer) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000556 00000 n 
0000000632 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
703
%%EOF`;
    return Buffer.from(content, "utf-8");
}

/**
 * Helper to format document object if needed.
 */
function formatDocument(doc: any) {
    const fileId = doc.fileId || doc.file?.id || null;
    const fileUrl = fileId
        ? `/api/projects/${doc.projectId}/files/${fileId}/download`
        : (doc.type !== DocumentType.DOC ? `/api/documents/${doc.id}/raw` : null);

    return {
        id: doc.id,
        name: doc.name,
        description: doc.description,
        content: doc.content,
        type: doc.type,
        owner: doc.owner,
        size: doc.size,
        projectId: doc.projectId,
        fileId,
        fileUrl,
        file: doc.file ? {
            id: doc.file.id,
            name: doc.file.name,
            type: doc.file.type,
            versions: doc.file.versions?.map((v: any) => ({
                id: v.id,
                versionNum: v.versionNum,
                s3Key: v.s3Key,
                sizeBytes: v.sizeBytes.toString(),
                createdAt: v.createdAt,
            })),
        } : undefined,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

/**
 * GET /api/projects/:projectId/documents
 * Get all documents for a given project.
 */
export const getDocumentsByProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;

        // requireProjectAccess has verified access and project existence.

        const documents = await prisma.document.findMany({
            where: { projectId },
            include: {
                file: {
                    include: {
                        versions: { orderBy: { versionNum: "desc" }, take: 1 }
                    }
                }
            },
            orderBy: { createdAt: "desc" },
        });

        res.status(200).json({
            success: true,
            count: documents.length,
            data: documents.map(formatDocument),
        });
    } catch (error) {
        console.error("Error fetching documents:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch documents",
        });
    }
};

/**
 * POST /api/projects/:projectId/documents
 * Create a new document in a project.
 */
export const createDocument = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { name, description, content, type, owner, size } = req.body;

        // requireProjectAccess has verified access and project existence.

        if (!name || typeof name !== "string" || name.trim() === "") {
            res.status(400).json({
                success: false,
                error: "Document name is required and must be a non-empty string",
            });
            return;
        }

        let docType: DocumentType = DocumentType.DOC;
        if (type !== undefined) {
            if (!Object.values(DocumentType).includes(type)) {
                res.status(400).json({
                    success: false,
                    error: `Invalid document type. Allowed values are: ${Object.values(DocumentType).join(", ")}`,
                });
                return;
            }
            docType = type as DocumentType;
        }

        const newDocument = await prisma.document.create({
            data: {
                name: name.trim(),
                description: description ? String(description).trim() : null,
                content: content ? String(content).trim() : null,
                type: docType,
                owner: owner ? String(owner).trim() : null,
                size: size ? String(size).trim() : null,
                projectId,
            },
        });

        // Audit Log: DOCUMENT_CREATED
        logAuditAction({
            userId: req.user?.id,
            workspaceId: req.workspace?.id,
            projectId: projectId as string,
            action: "DOCUMENT_CREATED",
            entityType: "Document",
            entityId: newDocument.id,
            details: { name: newDocument.name },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(201).json({
            success: true,
            message: "Document created successfully",
            data: formatDocument(newDocument),
        });
    } catch (error) {
        console.error("Error creating document:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create document",
        });
    }
};

/**
 * PATCH /api/documents/:id
 * Update an existing document (e.g. saving TipTap content or restoring version)
 */
export const updateDocument = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, description, content, isRestore } = req.body;

        // requireDocumentAccess has verified access and document existence.

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description ? String(description).trim() : null;
        if (content !== undefined) updateData.content = content ? String(content).trim() : null;

        const updatedDocument = await prisma.document.update({
            where: { id },
            data: updateData,
        });

        // Audit Log: DOCUMENT_RESTORED / DOCUMENT_UPDATED
        const auditAction = isRestore ? "DOCUMENT_RESTORED" : "DOCUMENT_UPDATED";
        logAuditAction({
            userId: req.user?.id,
            workspaceId: req.workspace?.id,
            projectId: req.project?.id,
            action: auditAction,
            entityType: "Document",
            entityId: updatedDocument.id,
            details: { name: updatedDocument.name, isRestore: Boolean(isRestore) },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        // Trigger Notification if doc edited/restored by another user
        if (req.project?.ownerId && req.project.ownerId !== req.user?.id) {
            createAndSendNotification({
                userId: req.project.ownerId,
                workspaceId: req.workspace?.id,
                type: NotificationType.DOCUMENT_EDITED,
                title: isRestore ? "Document Restored" : "Document Edited",
                message: `Document "${updatedDocument.name}" in project "${req.project.name}" was ${isRestore ? "restored" : "edited"}.`,
                link: `/projects/${updatedDocument.projectId}`,
            }).catch((err) => console.error("Notification error:", err));
        }

        res.status(200).json({
            success: true,
            message: isRestore ? "Document restored successfully" : "Document updated successfully",
            data: formatDocument(updatedDocument),
        });
    } catch (error) {
        console.error("Error updating document:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update document",
        });
    }
};

/**
 * DELETE /api/documents/:id
 * Delete a document by ID.
 */
export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        // requireDocumentAccess has verified access and document existence.
        const docToDelete = (req as any).document;

        await prisma.document.delete({
            where: { id },
        });

        // Audit Log: DOCUMENT_DELETED
        logAuditAction({
            userId: req.user?.id,
            workspaceId: req.workspace?.id,
            projectId: req.project?.id,
            action: "DOCUMENT_DELETED",
            entityType: "Document",
            entityId: (Array.isArray(id) ? id[0] : id) as string,
            details: { name: docToDelete?.name || id },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(200).json({
            success: true,
            message: "Document deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting document:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete document",
        });
    }
};

/**
 * GET /api/documents?workspaceId=...
 * Fetch all documents for projects within a workspace.
 * Strictly scoped to the specified workspace and user's project access.
 */
export const getDocumentsByWorkspace = async (req: Request, res: Response): Promise<void> => {
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

        const documents = await prisma.document.findMany({
            where: whereClause,
            include: {
                file: {
                    include: {
                        versions: { orderBy: { versionNum: "desc" }, take: 1 }
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        status: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        const formatted = documents.map((doc: any) => {
            const formattedDoc = formatDocument(doc);
            return {
                ...formattedDoc,
                projectName: doc.project?.name,
                projectCode: doc.project?.code,
                projectStatus: doc.project?.status,
            };
        });

        res.status(200).json({
            success: true,
            count: formatted.length,
            data: formatted,
        });
    } catch (error) {
        console.error("Error fetching workspace documents:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch workspace documents",
        });
    }
};

/**
 * GET /api/documents/:id
 * Fetch a single document by ID with project and member details.
 */
export const getDocumentById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const document = await prisma.document.findUnique({
            where: { id },
            include: {
                file: {
                    include: {
                        versions: { orderBy: { versionNum: "desc" }, take: 1 }
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        workspaceId: true,
                        members: {
                            select: {
                                userId: true,
                                role: true,
                                user: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                        avatar: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!document) {
            res.status(404).json({ success: false, error: "Document not found" });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                ...formatDocument(document),
                project: document.project,
            },
        });
    } catch (error: any) {
        console.error("Error fetching document by ID:", error?.message || error);
        res.status(500).json({
            success: false,
            error: error?.message || "Failed to fetch document",
        });
    }
};

/**
 * POST /api/projects/:projectId/documents/upload
 * Uploads a physical file (PDF, DOCX, XLS, PPT, etc.) and creates both File and Document records.
 */
export const uploadDocumentFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { name, description } = req.body;
        const uploadedFile = req.file;

        if (!uploadedFile) {
            res.status(400).json({ success: false, error: "File is required for upload" });
            return;
        }

        const fileName = (name && typeof name === "string" && name.trim()) ? name.trim() : uploadedFile.originalname;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        let fileBuffer: Buffer | null = (uploadedFile as any).buffer || null;
        if (!fileBuffer && (uploadedFile as any).path) {
            try {
                fileBuffer = await fs.promises.readFile((uploadedFile as any).path);
            } catch (readErr) {
                console.error("Error reading temp file:", readErr);
            }
        }

        if (!fileBuffer) {
            res.status(400).json({ success: false, error: "Unable to read uploaded file data" });
            return;
        }

        // Workspace storage quota
        const workspaceId = req.workspace?.id || req.project?.workspaceId;
        const workspace = workspaceId ? await prisma.workspace.findUnique({ where: { id: workspaceId } }) : null;
        const newSize = BigInt(uploadedFile.size || fileBuffer.length);
        if (workspace && workspace.storageUsed + newSize > workspace.storageQuota) {
            res.status(403).json({ success: false, error: "Storage quota exceeded" });
            return;
        }

        // Upload to Storage
        const s3Key = `projects/${projectId}/${Date.now()}-${fileName}`;
        await storageService.uploadFile(s3Key, fileBuffer, uploadedFile.mimetype);

        // Find or create File
        let file = await prisma.file.findFirst({
            where: {
                projectId,
                name: fileName
            },
            include: { versions: { orderBy: { versionNum: "desc" }, take: 1 } }
        });

        let newVersionNum = 1;
        const fileType = determineDocTypeToFileType(fileName);

        if (!file) {
            file = await prisma.file.create({
                data: {
                    name: fileName,
                    description: description ? String(description).trim() : null,
                    projectId,
                    type: fileType,
                },
                include: { versions: true }
            });
        } else {
            newVersionNum = file.versions.length > 0 ? file.versions[0].versionNum + 1 : 1;
        }

        // Create FileVersion
        await prisma.fileVersion.create({
            data: {
                versionNum: newVersionNum,
                s3Key,
                sizeBytes: newSize,
                fileId: file.id,
                uploadedById: userId,
            }
        });

        // Update workspace quota
        if (workspace) {
            await prisma.workspace.update({
                where: { id: workspace.id },
                data: { storageUsed: workspace.storageUsed + newSize }
            });
        }

        // Clean up temp file if present
        if ((uploadedFile as any).path) {
            fs.promises.unlink((uploadedFile as any).path).catch(() => {});
        }

        const docType = determineFileTypeToDocType(fileName);
        const ownerUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { firstName: true, lastName: true, email: true }
        });
        const ownerName = ownerUser ? `${ownerUser.firstName} ${ownerUser.lastName}`.trim() || ownerUser.email : "Workspace Member";

        // Create Document record linked to this file
        const newDocument = await prisma.document.create({
            data: {
                name: fileName,
                description: description ? String(description).trim() : null,
                type: docType,
                size: formatBytes(newSize),
                owner: ownerName,
                fileId: file.id,
                projectId,
            },
            include: { file: { include: { versions: true } } }
        });

        // Audit log
        logAuditAction({
            userId,
            workspaceId,
            projectId: projectId as string,
            action: AuditAction.DOCUMENT_CREATED,
            entityType: "Document",
            entityId: newDocument.id,
            details: { name: newDocument.name, fileId: file.id },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(201).json({
            success: true,
            message: "Document uploaded successfully",
            data: formatDocument(newDocument),
        });
    } catch (error: any) {
        console.error("Error uploading document file:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to upload document file" });
    }
};

/**
 * GET /api/documents/:id/raw or /api/projects/:projectId/documents/:id/raw
 * Streams the physical document content (or generated fallback PDF) with proper Content-Type.
 */
export const getDocumentRawFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const isDownload = req.query.download === "true" || req.query.download === "1";

        const doc = await prisma.document.findUnique({
            where: { id },
            include: {
                file: {
                    include: {
                        versions: { orderBy: { versionNum: "desc" }, take: 1 }
                    }
                }
            }
        });

        if (!doc) {
            res.status(404).send("Document not found");
            return;
        }

        // If fileId is present and has versions
        if (doc.file && doc.file.versions && doc.file.versions.length > 0) {
            const version = doc.file.versions[0];
            try {
                const buffer = await storageService.getFileBuffer(version.s3Key);
                const mimeType = getMimeType(doc.file.name || doc.name);
                res.setHeader("Content-Type", mimeType);
                res.setHeader(
                    "Content-Disposition",
                    `${isDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(doc.file.name || doc.name)}"`
                );
                res.setHeader("Content-Length", buffer.length);
                res.send(buffer);
                return;
            } catch (err) {
                console.error("Storage read fallback:", err);
            }
        }

        // If it's a PDF type without a stored disk file yet (e.g. existing sample/imported PDF)
        if (doc.type === DocumentType.PDF) {
            const pdfBuffer = generateFallbackPdf(doc.name, doc.description || "CollabSphere Document");
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `${isDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(doc.name.endsWith(".pdf") ? doc.name : doc.name + ".pdf")}`
            );
            res.setHeader("Content-Length", pdfBuffer.length);
            res.send(pdfBuffer);
            return;
        }

        // For other text/document content
        if (doc.content) {
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.setHeader(
                "Content-Disposition",
                `${isDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(doc.name)}"`
            );
            res.send(doc.content);
            return;
        }

        res.status(404).send("File content not available");
    } catch (error: any) {
        console.error("Error retrieving raw document file:", error);
        res.status(500).send("Failed to retrieve file");
    }
};


