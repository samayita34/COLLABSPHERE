import { Request } from "express";
import prisma from "../lib/prisma";
import { AuditAction } from "../../generated/prisma/enums";

export interface CreateAuditLogInput {
    userId?: string;
    organizationId?: string;
    workspaceId?: string;
    projectId?: string;
    action: AuditAction | string;
    entityType: string;
    entityId?: string;
    details?: any;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Creates an audit log record asynchronously.
 * Fails safely so audit log errors do not break primary business logic.
 */
export const createAuditLog = async (input: CreateAuditLogInput) => {
    try {
        if (!(prisma as any).auditLog) return null;
        const auditLog = await (prisma as any).auditLog.create({
            data: {
                userId: input.userId,
                organizationId: input.organizationId,
                workspaceId: input.workspaceId,
                projectId: input.projectId,
                action: input.action as AuditAction,
                entityType: input.entityType,
                entityId: input.entityId,
                details: input.details ? input.details : undefined,
                metadata: input.metadata ? input.metadata : input.details,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
            },
        });
        return auditLog;
    } catch (error) {
        return null;
    }
};

/**
 * Alias for createAuditLog for backward compatibility
 */
export const logAuditAction = createAuditLog;

/**
 * Express helper to extract user, IP, and User-Agent directly from Request context.
 */
export const createAuditLogFromReq = async (
    req: Request,
    input: Omit<CreateAuditLogInput, "userId" | "ipAddress" | "userAgent">
) => {
    const userId = req.user?.id;
    const workspaceId = input.workspaceId || req.workspace?.id;
    const projectId = input.projectId || req.project?.id;
    const organizationId = input.organizationId || req.organization?.id;
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.ip || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"] as string;

    return createAuditLog({
        userId,
        organizationId,
        workspaceId,
        projectId,
        ipAddress,
        userAgent,
        ...input,
    });
};

/**
 * Creates an audit log within an existing Prisma transaction.
 * Used for critical operations requiring transactional enforcement.
 */
export const createAuditLogTransactional = async (
    tx: any,
    input: CreateAuditLogInput
) => {
    return tx.auditLog.create({
        data: {
            userId: input.userId,
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
            projectId: input.projectId,
            action: input.action as AuditAction,
            entityType: input.entityType,
            entityId: input.entityId,
            details: input.details ? input.details : undefined,
            metadata: input.metadata ? input.metadata : input.details,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        },
    });
};
