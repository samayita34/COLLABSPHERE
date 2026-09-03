import { getCsrfHeaders } from "./apiUtils";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export interface ChatUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string | null;
    role?: string;
}

export interface ChatAttachment {
    url: string;
    name: string;
    size: number;
    type: string;
}

export interface MessageReaction {
    id: string;
    emoji: string;
    messageId: string;
    userId: string;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
    };
}

export interface MessageMention {
    id: string;
    userId: string;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
}

export interface ChannelMessage {
    id: string;
    text: string | null;
    channelId: string;
    senderId: string;
    sender: ChatUser;
    fileId?: string | null;
    parentId?: string | null;
    isEdited?: boolean;
    createdAt: string;
    updatedAt?: string;
    reactions?: MessageReaction[];
    mentions?: MessageMention[];
    isOwn?: boolean;
    isDelivered?: boolean;
    isRead?: boolean;
    readCount?: number;
    attachment?: ChatAttachment | null;
}

export interface ChannelMember {
    id: string;
    channelId: string;
    userId: string;
    lastReadAt?: string | null;
    user: ChatUser;
}

export interface Channel {
    id: string;
    name: string | null;
    type: "DIRECT_MESSAGE" | "GROUP" | "PROJECT" | "WORKSPACE_GLOBAL";
    workspaceId: string | null;
    projectId: string | null;
    project?: {
        id: string;
        name: string;
        code?: string | null;
        status: string;
    } | null;
    members: ChannelMember[];
    unreadCount: number;
    lastMessage?: {
        id: string;
        text: string | null;
        createdAt: string;
        sender: { id: string; firstName: string; lastName: string };
        hasAttachment?: boolean;
    } | null;
    myLastReadAt?: string | null;
    updatedAt: string;
}

/**
 * Helper to parse [ATTACHMENT:{...}] metadata from message text.
 */
export function parseMessageAttachment(text: string | null): { cleanText: string; attachment: ChatAttachment | null } {
    if (!text) return { cleanText: "", attachment: null };

    const match = text.match(/\[ATTACHMENT:(.*?)\]/s);
    if (!match) return { cleanText: text, attachment: null };

    try {
        const attachment = JSON.parse(match[1]) as ChatAttachment;
        const cleanText = text.replace(/\[ATTACHMENT:.*?\]/s, "").trim();
        return { cleanText, attachment };
    } catch {
        return { cleanText: text, attachment: null };
    }
}

/**
 * GET /api/chat/channels?workspaceId=...
 */
export async function fetchChannels(workspaceId?: string): Promise<Channel[]> {
    const url = workspaceId
        ? `${API_BASE_URL}/chat/channels?workspaceId=${encodeURIComponent(workspaceId)}`
        : `${API_BASE_URL}/chat/channels`;

    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch channels (HTTP ${res.status})`);
    }
    const json = await res.json();
    return json.channels || [];
}

/**
 * POST /api/chat/channels/dm
 */
export async function createDirectMessageApi(targetUserId: string, workspaceId?: string): Promise<Channel> {
    const res = await fetch(`${API_BASE_URL}/chat/channels/dm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        credentials: "include",
        body: JSON.stringify({ targetUserId, workspaceId })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to create DM (HTTP ${res.status})`);
    }
    const json = await res.json();
    return json.channel;
}

/**
 * POST /api/chat/channels/group
 */
export async function createGroupApi(name: string, memberUserIds: string[], workspaceId?: string): Promise<Channel> {
    const res = await fetch(`${API_BASE_URL}/chat/channels/group`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        credentials: "include",
        body: JSON.stringify({ name, memberUserIds, workspaceId })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to create group (HTTP ${res.status})`);
    }
    const json = await res.json();
    return json.channel;
}

/**
 * GET /api/chat/channels/:channelId/messages
 */
export async function fetchChannelMessages(channelId: string): Promise<{ messages: ChannelMessage[]; members: ChannelMember[] }> {
    const res = await fetch(`${API_BASE_URL}/chat/channels/${channelId}/messages`, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch messages (HTTP ${res.status})`);
    }
    const json = await res.json();

    const messages: ChannelMessage[] = (json.messages || []).map((m: any) => {
        const { cleanText, attachment } = parseMessageAttachment(m.text);
        return {
            ...m,
            text: cleanText,
            attachment
        };
    });

    return {
        messages,
        members: json.members || []
    };
}

/**
 * POST /api/chat/channels/:channelId/messages
 */
export async function sendChannelMessage(
    channelId: string,
    payload: {
        text?: string;
        fileId?: string;
        parentId?: string;
        mentions?: string[];
        attachment?: ChatAttachment;
    }
): Promise<ChannelMessage> {
    const res = await fetch(`${API_BASE_URL}/chat/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        credentials: "include",
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to send message (HTTP ${res.status})`);
    }
    const json = await res.json();
    const { cleanText, attachment } = parseMessageAttachment(json.message.text);
    return {
        ...json.message,
        text: cleanText,
        attachment
    };
}

/**
 * POST /api/chat/messages/:messageId/reactions
 */
export async function toggleReactionApi(messageId: string, emoji: string): Promise<MessageReaction[]> {
    const res = await fetch(`${API_BASE_URL}/chat/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        credentials: "include",
        body: JSON.stringify({ emoji })
    });
    if (!res.ok) {
        throw new Error(`Failed to toggle reaction (HTTP ${res.status})`);
    }
    const json = await res.json();
    return json.reactions || [];
}

/**
 * POST /api/chat/channels/:channelId/read
 */
export async function markChannelAsReadApi(channelId: string): Promise<void> {
    await fetch(`${API_BASE_URL}/chat/channels/${channelId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        credentials: "include"
    }).catch(() => {});
}

/**
 * POST /api/chat/upload
 */
export async function uploadChatFileApi(file: File): Promise<ChatAttachment> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE_URL}/chat/upload`, {
        method: "POST",
        headers: { ...getCsrfHeaders() },
        credentials: "include",
        body: formData
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to upload file (HTTP ${res.status})`);
    }
    const json = await res.json();
    return json.file;
}

/**
 * GET /api/chat/channels/:channelId/search?q=...
 */
export async function searchChannelMessagesApi(channelId: string, query: string): Promise<ChannelMessage[]> {
    const res = await fetch(`${API_BASE_URL}/chat/channels/${channelId}/search?q=${encodeURIComponent(query)}`, {
        credentials: "include"
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.messages || [];
}

/**
 * GET /api/chat/users?workspaceId=...
 */
export async function fetchWorkspaceChatUsers(workspaceId?: string): Promise<ChatUser[]> {
    const url = workspaceId
        ? `${API_BASE_URL}/chat/users?workspaceId=${encodeURIComponent(workspaceId)}`
        : `${API_BASE_URL}/chat/users`;

    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return [];
    const json = await res.json();
    return json.users || [];
}
