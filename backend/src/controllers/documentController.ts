import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { DocumentType, NotificationType, AuditAction } from "../../generated/prisma/enums";
import { createAndSendNotification } from "../services/notificationService";
import { logAuditAction } from "../services/auditService";

/**
 * Helper to format document object if needed.
 */
function formatDocument(doc: any) {
    return {
        id: doc.id,
        name: doc.name,
        description: doc.description,
        content: doc.content,
        type: doc.type,
        owner: doc.owner,
        size: doc.size,
        projectId: doc.projectId,
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

        const formatted = documents.map((doc: any) => ({
            id: doc.id,
            name: doc.name,
            description: doc.description,
            type: doc.type,
            owner: doc.owner,
            size: doc.size,
            content: doc.content,
            projectId: doc.projectId,
            projectName: doc.project?.name,
            projectCode: doc.project?.code,
            projectStatus: doc.project?.status,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        }));

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

