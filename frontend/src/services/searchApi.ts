import { getCsrfHeaders } from "./apiUtils";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export type SearchCategory =
    | "all"
    | "tasks"
    | "users"
    | "documents"
    | "chats"
    | "files"
    | "comments"
    | "workspaces";

export interface SearchParams {
    q?: string;
    type?: SearchCategory;
    category?: SearchCategory;
    workspaceId?: string;
    projectId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    page?: number;
}

export interface TaskSearchResult {
    id: string;
    type: "task";
    title: string;
    description?: string | null;
    snippet?: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    status: string;
    column?: { id: string; name: string } | null;
    dueDate?: string | null;
    projectId: string;
    project?: { id: string; name: string; code?: string | null; workspaceId: string };
    assignee?: { id: string; firstName: string; lastName: string; avatar?: string | null } | null;
    labels?: Array<{ id: string; name: string; color: string }>;
    createdAt: string;
    updatedAt: string;
}

export interface UserSearchResult {
    id: string;
    type: "user";
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string | null;
    role: string;
    snippet?: string;
    createdAt?: string;
}

export interface DocumentSearchResult {
    id: string;
    type: "document";
    title: string;
    name: string;
    description?: string | null;
    snippet?: string;
    docType: string;
    owner?: string | null;
    size?: string | null;
    projectId: string;
    project?: { id: string; name: string; workspaceId: string };
    createdAt: string;
    updatedAt: string;
}

export interface ChatSearchResult {
    id: string;
    type: "chat";
    title: string;
    text?: string | null;
    snippet?: string;
    channelId: string;
    channel?: { id: string; name?: string | null; type: string; workspaceId?: string | null; projectId?: string | null };
    sender?: { id: string; firstName: string; lastName: string; avatar?: string | null; email?: string } | null;
    senderName: string;
    fileId?: string | null;
    createdAt: string;
}

export interface FileSearchResult {
    id: string;
    type: "file";
    title: string;
    name: string;
    fileType: string;
    description?: string | null;
    snippet?: string;
    projectId: string;
    project?: { id: string; name: string; workspaceId: string };
    folder?: { id: string; name: string } | null;
    isLocked?: boolean;
    latestVersion?: any;
    createdAt: string;
    updatedAt: string;
}

export interface CommentSearchResult {
    id: string;
    type: "comment";
    commentType: "task" | "document";
    title: string;
    text: string;
    snippet?: string;
    targetId: string;
    targetTitle?: string;
    highlightedText?: string | null;
    projectId?: string;
    project?: { id: string; name: string; workspaceId?: string };
    author?: { id: string; firstName: string; lastName: string; avatar?: string | null; email?: string };
    authorName: string;
    createdAt: string;
}

export interface WorkspaceSearchResult {
    id: string;
    type: "workspace";
    title: string;
    name: string;
    slug: string;
    description?: string | null;
    snippet?: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
}

export type AnySearchResultItem =
    | TaskSearchResult
    | UserSearchResult
    | DocumentSearchResult
    | ChatSearchResult
    | FileSearchResult
    | CommentSearchResult
    | WorkspaceSearchResult;

export interface SearchCounts {
    all: number;
    tasks: number;
    users: number;
    documents: number;
    chats: number;
    files: number;
    comments: number;
    workspaces: number;
}

export interface SearchResponse {
    success: boolean;
    query: string;
    category: SearchCategory;
    counts: SearchCounts;
    results: {
        tasks: TaskSearchResult[];
        users: UserSearchResult[];
        documents: DocumentSearchResult[];
        chats: ChatSearchResult[];
        files: FileSearchResult[];
        comments: CommentSearchResult[];
        workspaces: WorkspaceSearchResult[];
    };
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
}

export async function globalSearchApi(params: SearchParams): Promise<SearchResponse> {
    const url = new URL(`${API_BASE_URL}/search`);
    if (params.q !== undefined) url.searchParams.append("q", params.q);
    if (params.type) url.searchParams.append("type", params.type);
    if (params.workspaceId) url.searchParams.append("workspaceId", params.workspaceId);
    if (params.projectId) url.searchParams.append("projectId", params.projectId);
    if (params.userId) url.searchParams.append("userId", params.userId);
    if (params.startDate) url.searchParams.append("startDate", params.startDate);
    if (params.endDate) url.searchParams.append("endDate", params.endDate);
    if (params.limit) url.searchParams.append("limit", String(params.limit));
    if (params.page) url.searchParams.append("page", String(params.page));

    const res = await fetch(url.toString(), {
        headers: {
            "Content-Type": "application/json",
            ...getCsrfHeaders(),
        },
        credentials: "include",
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Search failed with status ${res.status}`);
    }

    return res.json();
}

export async function searchUsersApi(q?: string, workspaceId?: string): Promise<UserSearchResult[]> {
    const url = new URL(`${API_BASE_URL}/search/users`);
    if (q) url.searchParams.append("q", q);
    if (workspaceId) url.searchParams.append("workspaceId", workspaceId);

    const res = await fetch(url.toString(), {
        headers: {
            "Content-Type": "application/json",
            ...getCsrfHeaders(),
        },
        credentials: "include",
    });

    if (!res.ok) {
        return [];
    }

    const data = await res.json();
    return data.users || [];
}
