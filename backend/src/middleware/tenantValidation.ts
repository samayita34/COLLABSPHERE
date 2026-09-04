import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

/**
 * Validates tenant context passed via x-workspace-id or x-org-id headers.
 * Ensures the requesting user belongs to the specified tenant and that
 * any workspaceId parameter matches the tenant header context.
 */
export const validateTenantContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user) {
            next();
            return;
        }

        const headerWorkspaceId = req.headers["x-workspace-id"] as string | undefined;
        const headerOrgId = req.headers["x-org-id"] as string | undefined;
        const paramWorkspaceId = req.params.workspaceId || req.body?.workspaceId;

        // 1. Cross-tenant param vs header validation
        if (headerWorkspaceId && paramWorkspaceId && headerWorkspaceId !== paramWorkspaceId) {
            res.status(403).json({
                success: false,
                error: "Tenant Mismatch: Target workspace ID does not match active tenant context header.",
            });
            return;
        }

        const activeWorkspaceId = headerWorkspaceId || paramWorkspaceId;

        if (activeWorkspaceId) {
            const member = await prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId: activeWorkspaceId,
                        userId: req.user.id,
                    },
                },
                include: { workspace: true },
            });

            if (!member) {
                res.status(403).json({
                    success: false,
                    error: "Forbidden: You do not have access to the specified tenant workspace.",
                });
                return;
            }

            // Verify organization alignment if x-org-id header is provided
            if (headerOrgId && member.workspace.organizationId !== headerOrgId) {
                res.status(403).json({
                    success: false,
                    error: "Tenant Mismatch: Workspace does not belong to specified organization header.",
                });
                return;
            }

            req.workspace = member.workspace;
            req.workspaceRole = member.role;
        }

        next();
    } catch (error: any) {
        console.error("Tenant validation error:", error);
        res.status(500).json({ success: false, error: "Internal tenant validation error" });
    }
};
