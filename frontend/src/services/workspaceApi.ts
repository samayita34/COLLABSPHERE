import type { Member, WorkspaceDocument, WorkspaceFile } from "./projectApi";
import { mapApiMemberToFrontend, mapApiDocumentToFrontend, mapApiFileToFrontend } from "./projectApi";
import { getCsrfHeaders } from "./apiUtils";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export interface Workspace {
    id: string;
    organizationId: string;
    name: string;
    slug: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    organization?: {
        id: string;
        name: string;
        slug: string;
        [key: string]: any;
    };
    role?: string;
}

export interface WorkspaceOverviewData {
    metrics: {
        totalProjects: number;
        activeProjects: number;
        completedProjects: number;
        totalTasks: number;
        completedTasks: number;
        inProgressTasks: number;
        todoTasks: number;
    };
    recentProjects: Array<{
        id: string;
        name: string;
        category: string;
        status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
        progress: number;
        tasksCompleted: number;
        tasksTotal: number;
        members: Array<{
            id: string;
            name: string;
            initials: string;
            role: string;
        }>;
        updatedAt: string;
    }>;
    recentTasks: Array<{
        id: string;
        title: string;
        status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
        priority: "LOW" | "MEDIUM" | "HIGH";
        dueDate?: string | null;
        projectName: string;
        projectId: string;
        assignee?: {
            id: string;
            firstName: string;
            lastName: string;
            email: string;
        } | null;
        updatedAt: string;
    }>;
    pendingTasks: Array<{
        id: string;
        title: string;
        status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
        priority: "LOW" | "MEDIUM" | "HIGH";
        dueDate?: string | null;
        projectName: string;
        projectId: string;
        assignee?: {
            id: string;
            firstName: string;
            lastName: string;
            email: string;
        } | null;
        updatedAt: string;
    }>;
    dueTodayTasks: Array<{
        id: string;
        title: string;
        status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
        priority: "LOW" | "MEDIUM" | "HIGH";
        dueDate?: string | null;
        projectName: string;
        projectId: string;
        assignee?: {
            id: string;
            firstName: string;
            lastName: string;
            email: string;
        } | null;
        updatedAt: string;
    }>;
    upcomingDeadlineTasks: Array<{
        id: string;
        title: string;
        status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
        priority: "LOW" | "MEDIUM" | "HIGH";
        dueDate?: string | null;
        projectName: string;
        projectId: string;
        assignee?: {
            id: string;
            firstName: string;
            lastName: string;
            email: string;
        } | null;
        updatedAt: string;
    }>;
    recentDocuments: Array<{
        id: string;
        title: string;
        updatedAt: string;
        project: {
            id: string;
            name: string;
        };
    }>;
    recentActivity: Array<{
        id: string;
        action: string;
        entityType: string;
        createdAt: string;
        details?: any;
        user: {
            id: string;
            firstName: string;
            lastName: string;
            email: string;
        };
    }>;
}

/**
 * GET /api/workspaces/:id/overview
 */
export async function fetchWorkspaceOverviewApi(workspaceId: string): Promise<WorkspaceOverviewData> {
    const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/overview`, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch workspace overview (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !json.data) {
        throw new Error(json.error || "Invalid response format from workspace overview API");
    }
    return json.data;
}

/**
 * GET /api/workspaces/org/:orgId or GET /api/workspaces
 * Fetch workspaces for a specific organization or all accessible workspaces.
 */
export async function fetchWorkspaces(orgId?: string): Promise<Workspace[]> {
    const url = orgId ? `${API_BASE_URL}/workspaces/org/${orgId}` : `${API_BASE_URL}/workspaces`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch workspaces (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !Array.isArray(json.workspaces)) {
        throw new Error(json.error || "Invalid response format from workspaces API");
    }
    return json.workspaces;
}

/**
 * GET /api/workspaces
 * Fetch all workspaces the authenticated user belongs to via WorkspaceMember.
 */
export async function fetchUserWorkspaces(): Promise<Workspace[]> {
    const res = await fetch(`${API_BASE_URL}/workspaces`, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch workspaces (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !Array.isArray(json.workspaces)) {
        throw new Error(json.error || "Invalid response format from workspaces API");
    }
    return json.workspaces;
}

/**
 * POST /api/workspaces
 * Create a new workspace under an organization.
 */
export async function createWorkspaceApi(
    organizationId: string,
    name: string,
    slug: string,
    description?: string
): Promise<Workspace> {
    const res = await fetch(`${API_BASE_URL}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        credentials: "include",
        body: JSON.stringify({ organizationId, name, slug, description }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to create workspace (HTTP ${res.status})`);
    }
    return json.workspace;
}

/**
 * PUT /api/workspaces/:id
 * Update a workspace's settings.
 */
export async function updateWorkspaceApi(
    id: string,
    payload: { name?: string; description?: string }
): Promise<Workspace> {
    const res = await fetch(`${API_BASE_URL}/workspaces/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to update workspace (HTTP ${res.status})`);
    }
    return json.workspace;
}

/**
 * GET /api/workspaces/:id (to fetch members)
 * The backend getWorkspace includes members. We map them.
 */
export async function fetchWorkspaceMembers(id: string): Promise<Member[]> {
    const res = await fetch(`${API_BASE_URL}/workspaces/${id}`, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch workspace (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !json.workspace) {
        throw new Error(json.error || "Invalid response format");
    }
    return (json.workspace.members || []).map(mapApiMemberToFrontend);
}

/**
 * POST /api/workspaces/:id/members
 */
export async function addWorkspaceMemberApi(
    id: string,
    email: string,
    role: string = "MEMBER"
): Promise<Member> {
    const res = await fetch(`${API_BASE_URL}/workspaces/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, role }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to add member (HTTP ${res.status})`);
    }
    return mapApiMemberToFrontend(json.member);
}

/**
 * DELETE /api/workspaces/:id/members/:userId
 */
export async function removeWorkspaceMemberApi(
    id: string,
    targetUserId: string
): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/workspaces/${id}/members/${targetUserId}`, {
        method: "DELETE",
        credentials: "include",
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to remove member (HTTP ${res.status})`);
    }
}

/**
 * PUT /api/workspaces/:id/members/:targetUserId/role
 */
export async function updateWorkspaceMemberRoleApi(
    id: string,
    targetUserId: string,
    role: string
): Promise<Member> {
    const res = await fetch(`${API_BASE_URL}/workspaces/${id}/members/${targetUserId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to update member role (HTTP ${res.status})`);
    }
    return mapApiMemberToFrontend(json.member);
}

/**
 * GET /api/workspaces/:id/documents
 */
export async function fetchWorkspaceDocuments(workspaceId: string): Promise<WorkspaceDocument[]> {
    const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/documents`, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch workspace documents (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
        throw new Error(json.error || "Invalid response format from workspace documents API");
    }
    return json.data.map((apiDoc: any) => {
        const base = mapApiDocumentToFrontend(apiDoc);
        return {
            ...base,
            projectId: apiDoc.projectId,
            projectName: apiDoc.projectName,
            projectCode: apiDoc.projectCode,
            projectStatus: apiDoc.projectStatus,
        };
    });
}

/**
 * GET /api/workspaces/:id/files
 */
export async function fetchWorkspaceFiles(workspaceId: string): Promise<WorkspaceFile[]> {
    const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/files`, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch workspace files (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
        throw new Error(json.error || "Invalid response format from workspace files API");
    }
    return json.data.map((apiFile: any) => {
        const base = mapApiFileToFrontend(apiFile);
        return {
            ...base,
            projectId: apiFile.projectId,
            projectName: apiFile.projectName,
            projectCode: apiFile.projectCode,
            projectStatus: apiFile.projectStatus,
        };
    });
}

export interface WorkspaceMessage {
    id: string;
    text: string;
    senderInitials: string;
    senderName?: string;
    createdAt: string;
    updatedAt?: string;
    projectId: string;
    projectName: string;
    projectCode?: string | null;
    projectStatus?: string;
}

export interface FetchWorkspaceMessagesResult {
    messages: WorkspaceMessage[];
    accessibleProjectIds: string[];
}

/**
 * GET /api/workspaces/:id/messages
 */
export async function fetchWorkspaceMessages(workspaceId: string): Promise<FetchWorkspaceMessagesResult> {
    const res = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/messages`, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch workspace messages (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
        throw new Error(json.error || "Invalid response format from workspace messages API");
    }
    const messages = json.data.map((msg: any) => ({
        id: msg.id,
        text: msg.text,
        senderInitials: msg.senderInitials,
        senderName: msg.senderName || undefined,
        createdAt: msg.createdAt ? new Date(msg.createdAt).toISOString() : (msg.timestamp || new Date().toISOString()),
        updatedAt: msg.updatedAt ? new Date(msg.updatedAt).toISOString() : undefined,
        projectId: msg.projectId,
        projectName: msg.projectName || msg.project?.name || "",
        projectCode: msg.projectCode ?? msg.project?.code ?? null,
        projectStatus: msg.projectStatus || msg.project?.status,
    }));

    const accessibleProjectIds: string[] = Array.isArray(json.accessibleProjectIds)
        ? json.accessibleProjectIds
        : Array.from(new Set(messages.map((m: WorkspaceMessage) => m.projectId).filter((pid: string) => Boolean(pid))));

    return { messages, accessibleProjectIds };
}

export interface WorkspaceAnalyticsData {
    period?: string;
    days?: number;
    taskCompletionRate: number;
    rateChange?: number;
    taskMetrics?: {
        totalTasks: number;
        completedTasks: number;
        inProgressTasks: number;
        todoTasks: number;
        overdueTasks: number;
        byPriority: {
            low: number;
            medium: number;
            high: number;
        };
    };
    productivityTrends: Array<{
        date: string;
        completed: number;
        created?: number;
    }>;
    velocitySummary?: {
        totalCompletedInPeriod: number;
        totalCreatedInPeriod: number;
        avgCompletionVelocity: number;
        peakDay: { date: string; count: number };
    };
    teamPerformance: Array<{
        userId: string;
        name: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        avatar?: string | null;
        role?: string;
        completedTasks: number;
        assignedTasks?: number;
        completionRate?: number;
        commentsCount?: number;
        productivityScore?: number;
    }>;
    activeUsers: number | {
        count: number;
        totalMembers: number;
        activityRate: number;
        recentActiveMembers: Array<{
            id: string;
            user: { id: string; name: string; avatar?: string | null } | null;
            action: string;
            entityType: string;
            timestamp: string;
        }>;
    };
    documentActivity: number | {
        totalDocuments: number;
        editsInPeriod: number;
        versionsCreated: number;
        commentsCount: number;
        byType: Record<string, number>;
        topActiveDocuments: Array<{
            id: string;
            name: string;
            type: string;
            projectName: string;
            projectId: string;
            updatedAt: string;
            versionsCount: number;
            commentsCount: number;
        }>;
    };
    storageUsage: {
        used: number;
        quota: number;
        percentage?: number;
        totalFiles?: number;
        byType?: Record<string, number>;
    };
    chatStatistics: number | {
        totalMessages: number;
        messagesInPeriod: number;
        channelsCount: number;
        reactionsCount: number;
        topChannels: Array<{
            id: string;
            name: string;
            type: string;
            messageCount: number;
        }>;
    };
    workspaceGrowth: {
        totalUsers: number;
        newUsersInPeriod?: number;
        totalProjects: number;
        newProjectsInPeriod?: number;
        completedProjects?: number;
        totalTasks: number;
        newTasksInPeriod?: number;
        healthScore?: number;
    };
}

/**
 * GET /api/workspaces/:id/analytics?period=7d|30d|90d|1y
 */
export async function fetchWorkspaceAnalyticsApi(workspaceId: string, period: string = "30d"): Promise<WorkspaceAnalyticsData> {
    const url = new URL(`${API_BASE_URL}/workspaces/${workspaceId}/analytics`);
    if (period) url.searchParams.append("period", period);

    const res = await fetch(url.toString(), { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch workspace analytics (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !json.data) {
        throw new Error(json.error || "Invalid response format from workspace analytics API");
    }
    return json.data;
}
