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
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
    read?: boolean;
    createdAt: string;
}

export const fetchNotifications = async (workspaceId?: string, page = 1, limit = 20): Promise<{ data: NotificationItem[]; unreadCount: number; pagination: any }> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (workspaceId) params.append("workspaceId", workspaceId);

    const res = await fetch(`${API_BASE}/notifications?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
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

export const getUnreadNotificationCount = async (): Promise<number> => {
    const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: { "Content-Type": "application/json" },
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

export const markNotificationRead = async (id: string): Promise<NotificationItem> => {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to mark notification as read");
    }
    return json.data;
};

export const markNotificationAsRead = markNotificationRead;

export const markAllNotificationsRead = async (workspaceId?: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workspaceId }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to mark all as read");
    }
};

export const markAllNotificationsAsRead = markAllNotificationsRead;
