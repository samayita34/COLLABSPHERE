/* =========================================================
   PROJECT API SERVICE
   Provides API calls to COLLABSPHERE backend and transforms
   PostgreSQL API responses into existing frontend types.
========================================================= */

export type TaskStatus = "todo" | "progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type DocType = "DOC" | "PDF" | "XLS" | "PPT";

export interface ProjectDocument {
    id: string;
    name: string;
    description: string;
    type: DocType;
    owner: string;
    createdAt: string;
    updatedAt: string;
    size?: string;
}

export type FileType = "PDF" | "PNG" | "JPG" | "FIG" | "ZIP" | "PPT" | "DOC" | "MP4" | "XLS";
export type FileCategory = "images" | "documents" | "design" | "archives" | "videos";

export const FILE_CATEGORY: Record<FileType, FileCategory> = {
    PNG: "images",
    JPG: "images",
    PDF: "documents",
    DOC: "documents",
    XLS: "documents",
    PPT: "documents",
    FIG: "design",
    ZIP: "archives",
    MP4: "videos",
};

export interface ProjectFile {
    id: string;
    name: string;
    type: FileType;
    size: string;
    uploadedBy: string;
    uploadedAt: string;
    modifiedAt?: string;
    description?: string;
}

export interface ChatMessage {
    id: string;
    senderInitials: string;
    text: string;
    timestamp: string;
}

export interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    due: string;
    assignee: string;
}

export interface Member {
    initials: string;
    name: string;
    role: string;
    email: string;
    /** Real DB user ID — used when writing to the tasks API. Optional so
     *  locally-added members (AddMemberModal) still type-check. */
    userId?: string;
}

export interface MappedProject {
    id: string;
    slug: string;
    initials: string;
    name: string;
    category: string;
    description: string;
    status: "ACTIVE" | "COMPLETED";
    progress: number;
    tasksDone: number;
    tasksTotal: number;
    tasksFormatted: string; // for Projects.tsx "18/23"
    date: string;
    members: Member[];
    memberInitials: string[];
    tasks: Task[];
}

const API_BASE_URL = "http://localhost:3000/api";

/**
 * Derive 2-letter uppercase initials from code or name.
 */
function deriveInitials(code?: string | null, name?: string): string {
    if (code && code.trim()) {
        const cleanCode = code.trim().replace(/[^a-zA-Z]/g, "");
        if (cleanCode.length >= 2) return cleanCode.slice(0, 2).toUpperCase();
        if (cleanCode.length === 1) return cleanCode.toUpperCase();
    }
    if (name && name.trim()) {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase();
        }
    }
    return "PR";
}

/**
 * Derive member initials from first and last name.
 */
function deriveMemberInitials(firstName?: string, lastName?: string, email?: string): string {
    const f = (firstName || "").trim()[0] || "";
    const l = (lastName || "").trim()[0] || "";
    if (f || l) return (f + l).toUpperCase();
    if (email && email.trim()) return email.trim().slice(0, 2).toUpperCase();
    return "MB";
}

/**
 * Format ISO date string into display date e.g. "Aug 28, 2026"
 */
function formatDisplayDate(dateStr?: string | null, status?: string): string {
    if (!dateStr) return "No due date";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "No due date";
    const formatted = date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
    });
    return status === "COMPLETED" ? `Done ${formatted}` : formatted;
}

/**
 * Format ISO date string into short display date e.g. "Aug 19"
 */
function formatShortDate(dateStr?: string | null): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
    });
}

/**
 * Map backend task status (TODO, IN_PROGRESS, REVIEW, DONE) to frontend task status.
 */
function mapTaskStatus(status?: string): TaskStatus {
    switch (status) {
        case "IN_PROGRESS":
            return "progress";
        case "REVIEW":
            return "review";
        case "DONE":
            return "done";
        case "TODO":
        default:
            return "todo";
    }
}

/**
 * Map backend task priority (LOW, MEDIUM, HIGH) to frontend task priority.
 */
function mapTaskPriority(priority?: string): TaskPriority {
    switch (priority) {
        case "LOW":
            return "low";
        case "HIGH":
            return "high";
        case "MEDIUM":
        default:
            return "medium";
    }
}

/**
 * Map backend member to frontend Member type.
 */
export function mapApiMemberToFrontend(apiMember: any): Member {
    const user = apiMember.user || {};
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    const name = `${firstName} ${lastName}`.trim() || user.email || "Member";
    const initials = deriveMemberInitials(firstName, lastName, user.email);

    let roleDisplay = "Team Member";
    if (apiMember.role === "ADMIN") {
        roleDisplay = "Project Admin";
    } else if (user.role) {
        roleDisplay = user.role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
    }

    return {
        initials,
        name,
        role: roleDisplay,
        email: user.email || "",
        userId: user.id || undefined,
    };
}

/**
 * Map backend task to frontend Task type.
 */
export function mapApiTaskToFrontend(apiTask: any): Task {
    let assigneeInitials = "UN";
    if (apiTask.assignee) {
        assigneeInitials = deriveMemberInitials(apiTask.assignee.firstName, apiTask.assignee.lastName, apiTask.assignee.email);
    }

    return {
        id: apiTask.id,
        title: apiTask.title,
        description: apiTask.description || undefined,
        status: mapTaskStatus(apiTask.status),
        priority: mapTaskPriority(apiTask.priority),
        due: formatShortDate(apiTask.dueDate),
        assignee: assigneeInitials,
    };
}

/**
 * Map backend project API response item to frontend MappedProject type.
 */
export function mapApiProjectToFrontend(apiProject: any): MappedProject {
    const members: Member[] = (apiProject.members || []).map(mapApiMemberToFrontend);
    const tasks: Task[] = (apiProject.tasks || []).map(mapApiTaskToFrontend);

    const tasksDone = apiProject.tasksCompleted ?? 0;
    const tasksTotal = apiProject.tasksTotal ?? 0;
    const progress = apiProject.progress ?? 0;

    const initials = deriveInitials(apiProject.code, apiProject.name);
    const date = formatDisplayDate(apiProject.dueDate || apiProject.createdAt, apiProject.status);

    return {
        id: apiProject.id,
        slug: apiProject.id,
        initials,
        name: apiProject.name,
        category: apiProject.category || "General",
        description: apiProject.description || "",
        status: apiProject.status === "COMPLETED" ? "COMPLETED" : "ACTIVE",
        progress,
        tasksDone,
        tasksTotal,
        tasksFormatted: `${tasksDone}/${tasksTotal}`,
        date,
        members,
        memberInitials: members.map((m) => m.initials),
        tasks,
    };
}

/**
 * GET /api/projects
 * Fetch list of projects from backend and map to frontend types.
 */
export async function fetchProjects(): Promise<MappedProject[]> {
    const res = await fetch(`${API_BASE_URL}/projects`, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch projects (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
        throw new Error(json.error || "Invalid response format from projects API");
    }
    return json.data.map(mapApiProjectToFrontend);
}

/**
 * GET /api/projects/:id
 * Fetch single project by ID from backend and map to frontend types.
 */
export async function fetchProjectById(id: string): Promise<MappedProject> {
    const res = await fetch(`${API_BASE_URL}/projects/${id}`, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch project (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !json.data) {
        throw new Error(json.error || "Invalid response format from project API");
    }
    return mapApiProjectToFrontend(json.data);
}

/**
 * Map frontend status → backend TaskStatus enum string.
 */
export function toApiStatus(status: TaskStatus): string {
    switch (status) {
        case "progress": return "IN_PROGRESS";
        case "review":   return "REVIEW";
        case "done":     return "DONE";
        case "todo":     return "TODO";
    }
}

/**
 * Map frontend priority → backend TaskPriority enum string.
 */
export function toApiPriority(priority: TaskPriority): string {
    switch (priority) {
        case "low":    return "LOW";
        case "high":   return "HIGH";
        case "medium": return "MEDIUM";
    }
}

/**
 * Convert the TaskModal's free-text due field (e.g. "Aug 24" / "Aug 24, 2026")
 * into an ISO date string the backend accepts, or null if empty/unparseable.
 * Appends the current year when the user types only "Aug 24".
 */
export function parseDueForApi(due: string): string | null {
    const trimmed = due.trim();
    if (!trimmed) return null;
    // Try parsing as-is first
    let d = new Date(trimmed);
    if (isNaN(d.getTime())) {
        // Append current year for short formats like "Aug 24"
        d = new Date(`${trimmed} ${new Date().getFullYear()}`);
    }
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
}

/**
 * POST /api/projects/:projectId/tasks
 * Create a new task and return the mapped frontend Task.
 */
export async function createTaskApi(
    projectId: string,
    payload: {
        title: string;
        description?: string;
        status: TaskStatus;
        priority: TaskPriority;
        due: string;
        assignee: string;          // frontend initials
        members: Member[];         // to resolve initials → userId
    }
): Promise<Task> {
    const assigneeId = payload.members.find((m) => m.initials === payload.assignee)?.userId ?? null;
    const body: Record<string, unknown> = {
        title: payload.title,
        status: toApiStatus(payload.status),
        priority: toApiPriority(payload.priority),
    };
    if (payload.description) body.description = payload.description;
    const dueDateIso = parseDueForApi(payload.due);
    if (dueDateIso) body.dueDate = dueDateIso;
    if (assigneeId) body.assigneeId = assigneeId;

    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to create task (HTTP ${res.status})`);
    }
    const json = await res.json();
    return mapApiTaskToFrontend(json.data);
}

/**
 * PATCH /api/tasks/:id
 * Update any combination of task fields. Returns the updated frontend Task.
 */
export async function updateTaskApi(
    taskId: string,
    payload: {
        title?: string;
        description?: string;
        status?: TaskStatus;
        priority?: TaskPriority;
        due?: string;
        assignee?: string;         // frontend initials
        members?: Member[];        // to resolve initials → userId
    }
): Promise<Task> {
    const body: Record<string, unknown> = {};
    if (payload.title !== undefined)       body.title       = payload.title;
    if (payload.description !== undefined) body.description = payload.description || null;
    if (payload.status !== undefined)      body.status      = toApiStatus(payload.status);
    if (payload.priority !== undefined)    body.priority    = toApiPriority(payload.priority);
    if (payload.due !== undefined) {
        body.dueDate = parseDueForApi(payload.due) ?? null;
    }
    if (payload.assignee !== undefined && payload.members) {
        const uid = payload.members.find((m) => m.initials === payload.assignee)?.userId ?? null;
        body.assigneeId = uid;
    }

    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to update task (HTTP ${res.status})`);
    }
    const json = await res.json();
    return mapApiTaskToFrontend(json.data);
}

/**
 * PATCH /api/tasks/:id  (status-only — used by Board drag-and-drop)
 */
export async function updateTaskStatusApi(taskId: string, status: TaskStatus): Promise<Task> {
    return updateTaskApi(taskId, { status });
}

/**
 * DELETE /api/tasks/:id
 */
export async function deleteTaskApi(taskId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to delete task (HTTP ${res.status})`);
    }
}

/**
 * POST /api/projects/:projectId/members
 * Add an existing user (looked up by email) to a project.
 * Throws with the backend's error message on 404 (user not found) or 409 (already member).
 */
export async function addMemberApi(
    projectId: string,
    email: string,
    role?: string          // display role from AddMemberModal — sent as-is; backend maps to enum
): Promise<Member> {
    // Map the AddMemberModal display role to a ProjectMemberRole enum value
    // Any non-admin display role maps to MEMBER; backend default is also MEMBER.
    const apiRole = role?.toLowerCase().includes("admin") ? "ADMIN" : "MEMBER";

    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), role: apiRole }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to add member (HTTP ${res.status})`);
    }
    return mapApiMemberToFrontend(json.data);
}

/**
 * Map backend document API response to frontend ProjectDocument type.
 */
export function mapApiDocumentToFrontend(apiDoc: any): ProjectDocument {
    return {
        id: apiDoc.id,
        name: apiDoc.name,
        description: apiDoc.description || "",
        type: (apiDoc.type || "DOC") as DocType,
        owner: apiDoc.owner || "Unknown",
        createdAt: formatDisplayDate(apiDoc.createdAt),
        updatedAt: formatDisplayDate(apiDoc.updatedAt),
        size: apiDoc.size || undefined,
    };
}

/**
 * GET /api/projects/:projectId/documents
 * Fetch documents for a project from backend and map to frontend types.
 */
export async function fetchDocuments(projectId: string): Promise<ProjectDocument[]> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/documents`, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch documents (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
        throw new Error(json.error || "Invalid response format from documents API");
    }
    return json.data.map(mapApiDocumentToFrontend);
}

/**
 * POST /api/projects/:projectId/documents
 * Create a new document in a project.
 */
export async function createDocumentApi(
    projectId: string,
    payload: {
        name: string;
        description?: string;
        type: DocType;
        owner: string;
        size?: string;
    }
): Promise<ProjectDocument> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to create document (HTTP ${res.status})`);
    }
    return mapApiDocumentToFrontend(json.data);
}

/**
 * DELETE /api/documents/:id
 * Delete a document by ID.
 */
export async function deleteDocumentApi(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/documents/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to delete document (HTTP ${res.status})`);
    }
}

/**
 * Map backend file API response to frontend ProjectFile type.
 */
export function mapApiFileToFrontend(apiFile: any): ProjectFile {
    return {
        id: apiFile.id,
        name: apiFile.name,
        type: (apiFile.type || "PDF") as FileType,
        size: apiFile.size,
        uploadedBy: apiFile.uploadedBy,
        uploadedAt: formatDisplayDate(apiFile.createdAt),
        modifiedAt: formatDisplayDate(apiFile.updatedAt),
        description: apiFile.description || undefined,
    };
}

/**
 * GET /api/projects/:projectId/files
 * Fetch files associated with a project from backend and map to frontend ProjectFile types.
 */
export async function fetchFiles(projectId: string): Promise<ProjectFile[]> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/files`, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch files (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
        throw new Error(json.error || "Invalid response format from files API");
    }
    return json.data.map(mapApiFileToFrontend);
}

/**
 * POST /api/projects/:projectId/files
 * Create/upload a new file asset record for a project.
 */
export async function createFileApi(
    projectId: string,
    payload: {
        name: string;
        type: FileType;
        size: string;
        uploadedBy: string;
        description?: string;
    }
): Promise<ProjectFile> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to create file (HTTP ${res.status})`);
    }
    return mapApiFileToFrontend(json.data);
}

/**
 * DELETE /api/files/:id
 * Delete a file by ID.
 */
export async function deleteFileApi(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/files/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to delete file (HTTP ${res.status})`);
    }
}

/**
 * Map backend chat message response to frontend ChatMessage interface.
 */
export function mapApiChatMessageToFrontend(apiMsg: any): ChatMessage {
    return {
        id: apiMsg.id,
        senderInitials: apiMsg.senderInitials,
        text: apiMsg.text,
        timestamp: apiMsg.timestamp || (apiMsg.createdAt ? new Date(apiMsg.createdAt).toISOString() : new Date().toISOString()),
    };
}

/**
 * GET /api/projects/:projectId/messages
 * Fetch all chat messages for a project chronologically.
 */
export async function fetchChatMessages(projectId: string): Promise<ChatMessage[]> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/messages`, { credentials: "include" });
    if (!res.ok) {
        throw new Error(`Failed to fetch chat messages (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
        throw new Error(json.error || "Invalid response format from chat messages API");
    }
    return json.data.map(mapApiChatMessageToFrontend);
}

/**
 * POST /api/projects/:projectId/messages
 * Send a new chat message to a project.
 */
export async function sendChatMessageApi(
    projectId: string,
    text: string,
    senderInitials: string
): Promise<ChatMessage> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, senderInitials }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to send message (HTTP ${res.status})`);
    }
    return mapApiChatMessageToFrontend(json.data);
}



