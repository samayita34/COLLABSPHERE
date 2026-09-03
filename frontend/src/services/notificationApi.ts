import { getCsrfToken } from "./apiUtils";

const API_BASE = "/api";

export type NotificationType =
    | "TASK_ASSIGNED"
    | "TASK_UPDATED"
    | "TASK_STATUS_CHANGED"
    | "TASK_OVERDUE"
    | "TASK_PRIORITY_CHANGED"
    | "TASK_COMMENT"
    | "TASK_MENTION"
    | "MENTION"
    | "DOCUMENT_EDITED"
    | "FILE_UPLOADED"
    | "CHAT_MESSAGE"
    | "WORKSPACE_INVITATION"
    | "PROJECT_MEMBER_ADDED"
    | "PROJECT_MEMBER_REMOVED"
    | "SUBTASK_COMPLETED"
    | "DUE_DATE_REMINDER";

export interface NotificationItem {
    id: string;
    userId: string;
    workspaceId?: string;
    projectId?: string;
    taskId?: string;
    documentId?: string;
    fileId?: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
    read?: boolean;
    createdAt: string;
}

const getHeaders = () => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    const csrfToken = getCsrfToken();
    if (csrfToken) {
        headers["x-csrf-token"] = csrfToken;
    }
    return headers;
};

export const fetchNotifications = async (
    workspaceId?: string,
    page = 1,
    limit = 30,
    unreadOnly = false
): Promise<{ data: NotificationItem[]; unreadCount: number; pagination: any }> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (workspaceId && workspaceId !== "all") {
        params.append("workspaceId", workspaceId);
    }
    if (unreadOnly) {
        params.append("unreadOnly", "true");
    }

    const res = await fetch(`${API_BASE}/notifications?${params.toString()}`, {
        headers: getHeaders(),
        credentials: "include",
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch notifications (${res.status})`);
    }
    const json = await res.json();
    if (!json.success) {
        throw new Error(json.error || "Failed to fetch notifications");
    }
    return json;
};

export const getUnreadNotificationCount = async (workspaceId?: string): Promise<number> => {
    const params = new URLSearchParams();
    if (workspaceId && workspaceId !== "all") {
        params.append("workspaceId", workspaceId);
    }
    const queryString = params.toString() ? `?${params.toString()}` : "";

    const res = await fetch(`${API_BASE}/notifications/unread-count${queryString}`, {
        headers: getHeaders(),
        credentials: "include",
    });
    if (!res.ok) {
        return 0;
    }
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        return 0;
    }
    const json = await res.json();
    if (!json.success) {
        return 0;
    }
    return json.count || 0;
};

export const fetchUnreadCount = getUnreadNotificationCount;

export const markNotificationAsRead = async (id: string): Promise<NotificationItem> => {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: "PATCH",
        headers: getHeaders(),
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to mark notification as read");
    }
    return json.data;
};

export const markNotificationRead = markNotificationAsRead;

export const markNotificationAsUnread = async (id: string): Promise<NotificationItem> => {
    const res = await fetch(`${API_BASE}/notifications/${id}/unread`, {
        method: "PATCH",
        headers: getHeaders(),
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to mark notification as unread");
    }
    return json.data;
};

export const markAllNotificationsAsRead = async (workspaceId?: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: "PATCH",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({ workspaceId: workspaceId && workspaceId !== "all" ? workspaceId : undefined }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to mark all as read");
    }
};

export const markAllNotificationsRead = markAllNotificationsAsRead;

export const deleteNotification = async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/notifications/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete notification");
    }
};

export const clearReadNotifications = async (workspaceId?: string): Promise<void> => {
    const params = new URLSearchParams();
    if (workspaceId && workspaceId !== "all") {
        params.append("workspaceId", workspaceId);
    }
    const queryString = params.toString() ? `?${params.toString()}` : "";

    const res = await fetch(`${API_BASE}/notifications/clear-read${queryString}`, {
        method: "DELETE",
        headers: getHeaders(),
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to clear read notifications");
    }
};

