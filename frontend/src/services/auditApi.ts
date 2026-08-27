const API_BASE = "/api";

export interface AuditLogItem {
    id: string;
    userId?: string;
    workspaceId?: string;
    projectId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    details?: any;
    metadata?: any;
    ipAddress?: string;
    createdAt: string;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        avatar?: string;
    };
}

export interface FetchAuditLogsParams {
    workspaceId: string;
    action?: string;
    userId?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

export const fetchAuditLogs = async (
    workspaceId: string,
    action?: string,
    page = 1,
    limit = 30
): Promise<{ data: AuditLogItem[]; pagination: any }> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (action) params.append("action", action);

    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/audit-logs?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to fetch audit logs");
    }
    return json;
};
