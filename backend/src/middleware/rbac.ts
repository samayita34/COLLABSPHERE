import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

// Extended Express Request types are declared in auth.ts

/**
 * Validates that the authenticated user belongs to the specified organization.
 * Extracts orgId from req.params.orgId or req.params.id.
 */
export const requireOrganizationAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "Authentication required" });
            return;
        }

        const orgId = req.params.orgId || req.params.id || req.body.organizationId;
        if (!orgId) {
            res.status(400).json({ success: false, error: "Organization ID is required" });
            return;
        }

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
        });

        if (!org) {
            res.status(404).json({ success: false, error: "Organization not found" });
            return;
        }

        const member = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: orgId, userId: req.user.id } },
        });

        if (!member) {
            res.status(403).json({ success: false, error: "Forbidden: You do not have access to this organization" });
            return;
        }

        req.organization = org;
        req.orgRole = member.role;
        next();
    } catch (error) {
        console.error("requireOrganizationAccess error:", error);
        res.status(500).json({ success: false, error: "Authorization error" });
    }
};

/**
 * Validates that the authenticated user belongs to the specified workspace.
 * Extracts workspaceId from req.params.workspaceId or req.params.id.
 * Implicitly validates organization access.
 */
export const requireWorkspaceAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "Authentication required" });
            return;
        }

        const workspaceId = req.params.workspaceId || req.params.id || req.body.workspaceId;
        if (!workspaceId) {
            res.status(400).json({ success: false, error: "Workspace ID is required" });
            return;
        }

        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
        });

        if (!workspace) {
            res.status(404).json({ success: false, error: "Workspace not found" });
            return;
        }

        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
        });

        if (!member) {
            res.status(403).json({ success: false, error: "Forbidden: You do not have access to this workspace" });
            return;
        }

        req.workspace = workspace;
        req.workspaceRole = member.role;
        next();
    } catch (error) {
        console.error("requireWorkspaceAccess error:", error);
        res.status(500).json({ success: false, error: "Authorization error" });
    }
};

/**
 * Validates that the authenticated user has access to the specified project.
 * Extracts projectId from req.params.projectId or req.params.id.
 * Implicitly validates workspace access.
 * Grants implicit ADMIN access if the user is a WORKSPACE_ADMIN.
 */
export const requireProjectAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "Authentication required" });
            return;
        }

        const rawProjectId = req.params.projectId || req.params.id || req.body.projectId;
        if (!rawProjectId) {
            res.status(400).json({ success: false, error: "Project ID is required" });
            return;
        }

        const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { workspace: true },
        });

        if (!project) {
            res.status(404).json({ success: false, error: "Project not found" });
            return;
        }

        if (!project.workspaceId) {
            res.status(500).json({ success: false, error: "Project is not associated with a workspace" });
            return;
        }

        // 1. Verify workspace access
        const wsMember = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: req.user.id } },
        });

        if (!wsMember) {
            res.status(403).json({ success: false, error: "Forbidden: You do not have access to the project's workspace" });
            return;
        }

        // 2. Verify project access
        let projectRole = "NONE";
        let hasAccess = false;

        if (wsMember.role === "WORKSPACE_ADMIN" || project.ownerId === req.user.id) {
            hasAccess = true;
            projectRole = "ADMIN";
        } else {
            const projectMember = await prisma.projectMember.findUnique({
                where: { projectId_userId: { projectId, userId: req.user.id } },
            });
            if (projectMember) {
                hasAccess = true;
                projectRole = projectMember.role;
            }
        }

        if (!hasAccess) {
            res.status(403).json({ success: false, error: "Forbidden: You do not have access to this project" });
            return;
        }

        req.workspace = project.workspace;
        req.workspaceRole = wsMember.role;
        req.project = project;
        req.projectRole = projectRole;
        next();
    } catch (error) {
        console.error("requireProjectAccess error:", error);
        res.status(500).json({ success: false, error: "Authorization error" });
    }
};

import { Permission, hasPermission } from "../lib/permissions";

/**
 * Middleware to require a specific permission.
 * Must be used AFTER context middlewares like requireProjectAccess or requireWorkspaceAccess.
 */
export const requirePermission = (permission: Permission) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!hasPermission(req, permission)) {
            res.status(403).json({ success: false, error: `Forbidden: Missing required permission (${permission})` });
            return;
        }

        next();
    };
};

/**
 * Helper to validate access to a top-level Task resource.
 * Fetches the Task, injects its projectId into req.params, and delegates to requireProjectAccess.
 */
export const requireTaskAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const id = req.params.id || req.params.taskId;
        const task = await prisma.task.findUnique({ where: { id }, select: { projectId: true } });
        if (!task) {
            res.status(404).json({ success: false, error: "Task not found" });
            return;
        }
        req.params.projectId = task.projectId;
        return requireProjectAccess(req, res, next);
    } catch (error) {
        res.status(500).json({ success: false, error: "Authorization error" });
    }
};

/**
 * Helper to validate access to a top-level Document resource.
 */
export const requireDocumentAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const id = req.params.id;
        const doc = await prisma.document.findUnique({ where: { id }, select: { projectId: true } });
        if (!doc) {
            res.status(404).json({ success: false, error: "Document not found" });
            return;
        }
        req.params.projectId = doc.projectId;
        return requireProjectAccess(req, res, next);
    } catch (error) {
        res.status(500).json({ success: false, error: "Authorization error" });
    }
};

/**
 * Helper to validate access to a top-level File resource.
 */
export const requireFileAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const id = req.params.id;
        const file = await prisma.file.findUnique({ where: { id }, select: { projectId: true } });
        if (!file) {
            res.status(404).json({ success: false, error: "File not found" });
            return;
        }
        req.params.projectId = file.projectId;
        return requireProjectAccess(req, res, next);
    } catch (error) {
        res.status(500).json({ success: false, error: "Authorization error" });
    }
};

/**
 * Helper to validate access to a top-level Team resource.
 */
export const requireTeamAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const id = req.params.id;
        const team = await prisma.team.findUnique({ where: { id }, select: { workspaceId: true } });
        if (!team) {
            res.status(404).json({ success: false, error: "Team not found" });
            return;
        }
        req.params.workspaceId = team.workspaceId;
        return requireWorkspaceAccess(req, res, next);
    } catch (error) {
        res.status(500).json({ success: false, error: "Authorization error" });
    }
};
