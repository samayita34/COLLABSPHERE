import prisma from "../lib/prisma";
import { AuditAction } from "../../generated/prisma/enums";

export interface LogAuditActionInput {
    userId?: string;
    workspaceId?: string;
    projectId?: string;
    action: AuditAction;
    entityType: string;
    entityId?: string;
    details?: any;
    ipAddress?: string;
}

export const logAuditAction = async (input: LogAuditActionInput) => {
    try {
        const auditLog = await prisma.auditLog.create({
            data: {
                userId: input.userId,
                workspaceId: input.workspaceId,
                projectId: input.projectId,
                action: input.action,
                entityType: input.entityType,
                entityId: input.entityId,
                details: input.details ? input.details : undefined,
                ipAddress: input.ipAddress,
            },
        });
        return auditLog;
    } catch (error) {
        console.error("[AuditService] Failed to create audit log:", error);
        return null;
    }
};
