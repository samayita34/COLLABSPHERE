import { Request, Response } from "express";
import prisma from "../lib/prisma";

const safeUserSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true,
};

/**
 * Category → AuditAction mapping for the Activity Timeline UI.
 * Allows the frontend to filter by broad category instead of individual actions.
 */
const CATEGORY_ACTIONS: Record<string, string[]> = {
    LOGINS: ["USER_LOGIN", "USER_LOGOUT", "USER_SIGNUP", "PASSWORD_RESET", "EMAIL_VERIFIED"],
    TASKS: [
        "TASK_CREATED", "TASK_UPDATED", "TASK_DELETED", "TASK_ASSIGNED", "TASK_STATUS_CHANGED",
        "TASK_CREATE", "TASK_UPDATE", "TASK_DELETE",
        "TASK_COMMENT", "TASK_MENTION", "TASK_COMMENT_CREATED", "TASK_COMMENT_DELETED",
    ],
    DOCUMENTS: [
        "DOCUMENT_CREATED", "DOCUMENT_UPDATED", "DOCUMENT_DELETED", "DOCUMENT_RESTORED",
        "DOCUMENT_CREATE", "DOCUMENT_UPDATE", "DOCUMENT_RESTORE",
    ],
    FILES: ["FILE_UPLOADED", "FILE_DELETED", "FILE_UPLOAD"],
    WORKSPACE: [
        "WORKSPACE_CREATED", "WORKSPACE_UPDATED", "WORKSPACE_CREATE",
        "PROJECT_CREATED", "PROJECT_UPDATED", "PROJECT_DELETED", "PROJECT_ARCHIVED",
    ],
    ROLES: ["ROLE_UPDATED", "ROLE_UPDATE", "PERMISSION_CHANGED", "PERMISSION_CHANGE"],
    MEMBERS: [
        "MEMBER_INVITED", "MEMBER_REMOVED",
        "WORKSPACE_MEMBER_ADDED", "WORKSPACE_MEMBER_REMOVED",
        "PROJECT_MEMBER_ADD", "PROJECT_MEMBER_REMOVE",
    ],
};

/**
 * GET /api/workspaces/:id/audit-logs
 * GET /api/audit-logs
 *
 * Requirements:
 * - Authentication required
 * - Workspace membership & RBAC permission check (via requireWorkspaceAccess & requirePermission)
 * - Strict workspace filtering
 * - Pagination (newest first)
 * - Optional filtering by: action, category, userId, entityType, projectId, startDate, endDate, search
 */
export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
    try {
        const rawWorkspaceId = req.params.id || req.params.workspaceId || (req.query.workspaceId as string);
        const workspaceId = Array.isArray(rawWorkspaceId) ? rawWorkspaceId[0] : rawWorkspaceId;

        // Strict Workspace authorization check if workspaceId is provided or verified in req.workspace
        const targetWorkspaceId = req.workspace?.id || workspaceId;
        if (!targetWorkspaceId) {
            res.status(400).json({ success: false, error: "Workspace ID is required" });
            return;
        }

        const action = req.query.action as string | undefined;
        const category = req.query.category as string | undefined;
        const userIdFilter = req.query.userId as string | undefined;
        const entityTypeFilter = req.query.entityType as string | undefined;
        const projectIdFilter = req.query.projectId as string | undefined;
        const startDateParam = req.query.startDate as string | undefined;
        const endDateParam = req.query.endDate as string | undefined;
        const searchParam = req.query.search as string | undefined;

        const page = parseInt((req.query.page as string) || "1", 10);
        const limit = Math.min(100, parseInt((req.query.limit as string) || "30", 10));
        const skip = (page - 1) * limit;

        const whereCondition: any = {
            workspaceId: targetWorkspaceId,
        };

        // Category-group filtering (LOGINS, TASKS, DOCUMENTS, FILES, WORKSPACE, ROLES, MEMBERS)
        if (category && CATEGORY_ACTIONS[category.toUpperCase()]) {
            whereCondition.action = { in: CATEGORY_ACTIONS[category.toUpperCase()] };
        } else if (action) {
            whereCondition.action = action;
        }

        if (userIdFilter) {
            whereCondition.userId = userIdFilter;
        }
        if (entityTypeFilter) {
            whereCondition.entityType = entityTypeFilter;
        }
        if (projectIdFilter) {
            whereCondition.projectId = projectIdFilter;
        }

        if (startDateParam || endDateParam) {
            whereCondition.createdAt = {};
            if (startDateParam) {
                whereCondition.createdAt.gte = new Date(startDateParam);
            }
            if (endDateParam) {
                // Include everything up to end of the end date
                const endDate = new Date(endDateParam);
                endDate.setHours(23, 59, 59, 999);
                whereCondition.createdAt.lte = endDate;
            }
        }

        // Entity-type search or entity-id match
        if (searchParam) {
            whereCondition.OR = [
                { entityType: { contains: searchParam, mode: "insensitive" } },
                { entityId: { contains: searchParam, mode: "insensitive" } },
            ];
        }

        if (!(prisma as any).auditLog) {
            res.status(200).json({
                success: true,
                data: [],
                pagination: { page, limit, total: 0, totalPages: 0 },
            });
            return;
        }

        const [logs, total] = await Promise.all([
            (prisma as any).auditLog.findMany({
                where: whereCondition,
                include: {
                    user: { select: safeUserSelect },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            (prisma as any).auditLog.count({ where: whereCondition }),
        ]);

        res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            meta: { categories: Object.keys(CATEGORY_ACTIONS) },
        });
    } catch (error) {
        console.error("getAuditLogs error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch audit logs" });
    }
};
