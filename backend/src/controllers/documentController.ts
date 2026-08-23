import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { DocumentType } from "../../generated/prisma/enums";

/**
 * Helper to format document object if needed.
 */
function formatDocument(doc: any) {
    return {
        id: doc.id,
        name: doc.name,
        description: doc.description,
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
        const { name, description, type, owner, size } = req.body;

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
                type: docType,
                owner: owner ? String(owner).trim() : null,
                size: size ? String(size).trim() : null,
                projectId,
            },
        });

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
 * DELETE /api/documents/:id
 * Delete a document by ID.
 */
export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const existingDocument = await prisma.document.findUnique({
            where: { id },
        });

        if (!existingDocument) {
            res.status(404).json({
                success: false,
                error: "Document not found",
            });
            return;
        }

        await prisma.document.delete({
            where: { id },
        });

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
