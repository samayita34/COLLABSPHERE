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
    /** Broad category filter: LOGINS | TASKS | DOCUMENTS | FILES | WORKSPACE | ROLES | MEMBERS */
    category?: string;
    /** Specific AuditAction enum value */
    action?: string;
    userId?: string;
    entityType?: string;
    projectId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export const AUDIT_CATEGORIES = [
    { key: "LOGINS",    label: "Logins",     emoji: "🔐" },
    { key: "TASKS",     label: "Tasks",      emoji: "✅" },
    { key: "DOCUMENTS", label: "Documents",  emoji: "📄" },
    { key: "FILES",     label: "Files",      emoji: "📁" },
    { key: "WORKSPACE", label: "Workspace",  emoji: "🏠" },
    { key: "ROLES",     label: "Roles",      emoji: "🛡️" },
    { key: "MEMBERS",   label: "Members",    emoji: "👥" },
] as const;

export type AuditCategory = typeof AUDIT_CATEGORIES[number]["key"] | "ALL";

export const fetchAuditLogs = async (
    params: FetchAuditLogsParams
): Promise<{ data: AuditLogItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const qs = new URLSearchParams();
    qs.set("page", String(params.page ?? 1));
    qs.set("limit", String(params.limit ?? 30));
    if (params.category && params.category !== "ALL") qs.set("category", params.category);
    if (params.action) qs.set("action", params.action);
    if (params.userId) qs.set("userId", params.userId);
    if (params.entityType) qs.set("entityType", params.entityType);
    if (params.projectId) qs.set("projectId", params.projectId);
    if (params.startDate) qs.set("startDate", params.startDate);
    if (params.endDate) qs.set("endDate", params.endDate);
    if (params.search) qs.set("search", params.search);

    const res = await fetch(`${API_BASE}/workspaces/${params.workspaceId}/audit-logs?${qs.toString()}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to fetch audit logs");
    }
    return json;
};

// ─── Action display helpers ───────────────────────────────────────────────────

export function getActionLabel(action: string): string {
    return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/** Returns a CSS color token / class key for the action category */
export function getActionCategory(action: string): AuditCategory {
    const A = action.toUpperCase();
    if (A.startsWith("USER_") || A === "PASSWORD_RESET" || A === "EMAIL_VERIFIED") return "LOGINS";
    if (A.startsWith("TASK_")) return "TASKS";
    if (A.startsWith("DOCUMENT_")) return "DOCUMENTS";
    if (A.startsWith("FILE_")) return "FILES";
    if (A.startsWith("WORKSPACE_") || A.startsWith("PROJECT_")) return "WORKSPACE";
    if (A.startsWith("ROLE_") || A.startsWith("PERMISSION_")) return "ROLES";
    if (A.startsWith("MEMBER_") || A.includes("MEMBER_")) return "MEMBERS";
    return "ALL";
}

export const ACTION_CATEGORY_COLORS: Record<AuditCategory | string, { bg: string; text: string; border: string }> = {
    LOGINS:    { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
    TASKS:     { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    DOCUMENTS: { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
    FILES:     { bg: "#fdf4ff", text: "#7e22ce", border: "#e9d5ff" },
    WORKSPACE: { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    ROLES:     { bg: "#fff1f2", text: "#9f1239", border: "#fecdd3" },
    MEMBERS:   { bg: "#ecfeff", text: "#155e75", border: "#a5f3fc" },
    ALL:       { bg: "#f5f5f4", text: "#57534e", border: "#e7e5e4" },
};

export function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)  return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    if (days < 7)  return `${days}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
