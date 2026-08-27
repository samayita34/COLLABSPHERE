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
 * GET /api/audit-logs
 * Fetch workspace-scoped or system audit logs.
 * Protected by requireWorkspaceAccess middleware when workspaceId is passed.
 */
export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = (req.query.workspaceId as string) || req.params.workspaceId;
        const action = req.query.action as string | undefined;
        const page = parseInt(req.query.page as string || "1", 10);
        const limit = parseInt(req.query.limit as string || "30", 10);
        const skip = (page - 1) * limit;

        const whereCondition: any = {};
        if (workspaceId) {
            whereCondition.workspaceId = workspaceId;
        }
        if (action) {
            whereCondition.action = action;
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where: whereCondition,
                include: {
                    user: { select: safeUserSelect },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.auditLog.count({ where: whereCondition }),
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
