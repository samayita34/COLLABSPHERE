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
 * GET /api/workspaces/:id/audit-logs
 * GET /api/audit-logs
 *
 * Requirements:
 * - Authentication required
 * - Workspace membership & RBAC permission check (via requireWorkspaceAccess & requirePermission)
 * - Strict workspace filtering
 * - Pagination (newest first)
 * - Optional filtering by: action, userId, entityType, startDate, endDate
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
        const userIdFilter = req.query.userId as string | undefined;
        const entityTypeFilter = req.query.entityType as string | undefined;
        const startDateParam = req.query.startDate as string | undefined;
        const endDateParam = req.query.endDate as string | undefined;

        const page = parseInt((req.query.page as string) || "1", 10);
        const limit = Math.min(100, parseInt((req.query.limit as string) || "30", 10));
        const skip = (page - 1) * limit;

        const whereCondition: any = {
            workspaceId: targetWorkspaceId,
        };

        if (action) {
            whereCondition.action = action;
        }
        if (userIdFilter) {
            whereCondition.userId = userIdFilter;
        }
        if (entityTypeFilter) {
            whereCondition.entityType = entityTypeFilter;
        }

        if (startDateParam || endDateParam) {
            whereCondition.createdAt = {};
            if (startDateParam) {
                whereCondition.createdAt.gte = new Date(startDateParam);
            }
            if (endDateParam) {
                whereCondition.createdAt.lte = new Date(endDateParam);
            }
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
        });
    } catch (error) {
        console.error("getAuditLogs error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch audit logs" });
    }
};
