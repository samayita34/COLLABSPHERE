/* =========================================================
   PROJECT API SERVICE
   Provides API calls to COLLABSPHERE backend and transforms
   PostgreSQL API responses into existing frontend types.
========================================================= */

// Removed TaskStatus as we use dynamic columns now
export type TaskPriority = "low" | "medium" | "high";

export type DocType = "DOC" | "PDF" | "XLS" | "PPT";

export interface Document {
    id: string;
    name: string;
    type: "DOC" | "PDF" | "XLS" | "PPT";
    size: string;
    owner: string;
    date: string;
    content?: string;
    projectId: string;
}

export interface DocumentVersion {
    id: string;
    name: string;
    createdAt: string;
    createdBy: string | null;
}

export interface ProjectDocument {
    id: string;
    name: string;
    description: string;
    type: DocType;
    owner: string;
    createdAt: string;
    updatedAt: string;
    size?: string;
    content?: string;
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

export interface FileVersion {
    id: string;
    versionNum: number;
    s3Key: string;
    sizeBytes: string;
    uploadedBy: { id: string; firstName: string; lastName: string; email?: string };
    createdAt: string;
}

export interface ProjectFile {
    id: string;
    name: string;
    type: FileType;
    description?: string;
    projectId: string;
    folderId?: string | null;
    isLocked: boolean;
    lockedBy?: { id: string; firstName: string; lastName: string } | null;
    versions: FileVersion[];
    createdAt: string;
    updatedAt: string;
}

export interface Folder {
    id: string;
    name: string;
    projectId: string;
    parentId: string | null;
    _count?: { files: number; children: number };
}

export interface WorkspaceDocument extends ProjectDocument {
    projectId: string;
    projectName?: string;
    projectCode?: string | null;
    projectStatus?: string;
}

export interface WorkspaceFile extends ProjectFile {
    projectId: string;
    projectName?: string;
    projectCode?: string | null;
    projectStatus?: string;
}

export interface ChatMessage {
    id: string;
    senderInitials: string;
    text: string;
    timestamp: string;
}

export interface Label {
    id: string;
    name: string;
    color: string;
    projectId?: string;
    createdAt?: string;
}

export interface TaskLabel {
    taskId: string;
    labelId: string;
    label: Label;
}

export interface TaskChecklistItem {
    id: string;
    content: string;
    isCompleted: boolean;
    checklistId: string;
    createdAt?: string;
}

export interface TaskChecklist {
    id: string;
    title: string;
    taskId: string;
    items: TaskChecklistItem[];
    createdAt?: string;
}

export interface TaskAttachment {
    id: string;
    fileName: string;
    fileUrl: string;
    fileType?: string | null;
    fileSize?: number | null;
    taskId: string;
    uploadedById?: string;
    uploadedBy?: { id: string; firstName: string; lastName: string; email?: string; avatar?: string | null };
    createdAt?: string;
}

export interface TimeEntry {
    id: string;
    duration: number; // in minutes
    description?: string | null;
    taskId: string;
    userId: string;
    user?: { id: string; firstName: string; lastName: string; email?: string; avatar?: string | null };
    date: string;
    createdAt?: string;
}

export interface TaskActivityLog {
    id: string;
    action: string;
    entityType: string;
    entityId?: string;
    details?: any;
    createdAt: string;
    user?: { id: string; firstName: string; lastName: string; email?: string; avatar?: string | null };
}

export interface Swimlane {
    id: string;
    name: string;
    order: number;
    boardId: string;
    createdAt?: string;
}

export interface Column {
    id: string;
    name: string;
    order: number;
    boardId: string;
    createdAt?: string;
}

export interface Board {
    id: string;
    name: string;
    description?: string | null;
    projectId: string;
    columns: Column[];
    swimlanes?: Swimlane[];
    createdAt?: string;
}

export interface Task {
    id: string;
    title: string;
    description?: string;
    columnId: string | null;
    column?: Column | null;
    swimlaneId: string | null;
    swimlane?: Swimlane | null;
    order: number;
    priority: TaskPriority;
    due: string;
    dueDateRaw?: string | null;
    assignee: string;
    assigneeId?: string | null;
    assigneeUser?: { id: string; firstName: string; lastName: string; email?: string; avatar?: string | null } | null;
    labels?: Label[];
    checklists?: TaskChecklist[];
    checklistStats?: { total: number; completed: number; progress: number };
    attachmentsCount?: number;
    attachments?: TaskAttachment[];
    timeEntries?: TimeEntry[];
    totalTimeSpentMinutes?: number;
    commentsCount?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface MyTaskItem {
    id: string;
    title: string;
    description?: string;
    columnId: string | null;
    columnName: string;
    swimlaneId: string | null;
    order: number;
    priority: TaskPriority;
    due: string;
    dueDateRaw?: string | null;
    isOverdue: boolean;
    assignee: string;
    assigneeName: string;
    projectId: string;
    projectName: string;
    projectCode?: string | null;
    projectStatus?: string;
    createdAt: string;
    updatedAt: string;
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
    workspaceId?: string;
    slug: string;
    initials: string;
    name: string;
    code?: string | null;
    category: string;
    description: string;
    status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
    dueDate?: string | null;
    ownerId?: string;
    owner?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        avatar?: string | null;
    };
    canEdit?: boolean;
    canDelete?: boolean;
    currentUserRole?: string;
    progress: number;
    tasksDone: number;
    tasksTotal: number;
    tasksFormatted: string; // for Projects.tsx "18/23"
    date: string;
    members: Member[];
    memberInitials: string[];
    tasks: Task[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

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
export function formatDisplayDate(dateStr?: string | null, status?: string): string {
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

// Task status mapping removed, replaced by dynamic columns

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

    let roleDisplay = "Member";
    if (apiMember.role === "ADMIN") {
        roleDisplay = "Admin";
    } else if (apiMember.role === "VIEWER") {
        roleDisplay = "Viewer";
    } else if (apiMember.role === "MEMBER") {
        roleDisplay = "Member";
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

    const labels = (apiTask.labels || []).map((tl: any) => (tl.label ? tl.label : tl));
    const checklists = apiTask.checklists || [];
    const totalChecklistItems = apiTask.checklistStats?.total ?? checklists.reduce((acc: number, cl: any) => acc + (cl.items?.length || 0), 0);
    const completedChecklistItems = apiTask.checklistStats?.completed ?? checklists.reduce((acc: number, cl: any) => acc + (cl.items?.filter((it: any) => it.isCompleted)?.length || 0), 0);
    const progress = totalChecklistItems > 0 ? Math.round((completedChecklistItems / totalChecklistItems) * 100) : 0;
    const totalTimeSpentMinutes = apiTask.totalTimeSpentMinutes ?? (apiTask.timeEntries || []).reduce((acc: number, entry: any) => acc + (entry.duration || 0), 0);

    return {
        id: apiTask.id,
        title: apiTask.title,
        description: apiTask.description || undefined,
        columnId: apiTask.columnId || null,
        column: apiTask.column || null,
        swimlaneId: apiTask.swimlaneId || null,
        swimlane: apiTask.swimlane || null,
        order: apiTask.order || 0,
        priority: mapTaskPriority(apiTask.priority),
        due: formatShortDate(apiTask.dueDate),
        dueDateRaw: apiTask.dueDate || null,
        assignee: assigneeInitials,
        assigneeId: apiTask.assigneeId || null,
        assigneeUser: apiTask.assignee || null,
        labels,
        checklists,
        checklistStats: {
            total: totalChecklistItems,
            completed: completedChecklistItems,
            progress,
        },
        attachmentsCount: apiTask.attachmentsCount ?? apiTask.attachments?.length ?? 0,
        attachments: apiTask.attachments || [],
        timeEntries: apiTask.timeEntries || [],
        totalTimeSpentMinutes,
        commentsCount: apiTask.commentsCount ?? apiTask.comments?.length ?? 0,
        createdAt: apiTask.createdAt,
        updatedAt: apiTask.updatedAt,
    };
}

/**
 * Map backend project API response item to frontend MappedProject type.
 */
export function mapApiProjectToFrontend(apiProject: any): MappedProject {
    if (!apiProject) {
        return {
            id: "",
            workspaceId: "",
            slug: "",
            initials: "PR",
            name: "Untitled Project",
            category: "General",
            description: "",
            status: "ACTIVE",
            progress: 0,
            tasksDone: 0,
            tasksTotal: 0,
            tasksFormatted: "0/0",
            date: "",
            members: [],
            memberInitials: [],
            tasks: [],
        };
    }
    const members: Member[] = (apiProject.members || []).map(mapApiMemberToFrontend);
    const tasks: Task[] = (apiProject.tasks || []).map(mapApiTaskToFrontend);

    const tasksDone = apiProject.tasksCompleted ?? 0;
    const tasksTotal = apiProject.tasksTotal ?? 0;
    const progress = apiProject.progress ?? 0;

    const initials = deriveInitials(apiProject.code, apiProject.name);
    const date = formatDisplayDate(apiProject.dueDate || apiProject.createdAt, apiProject.status);

    let status: "ACTIVE" | "COMPLETED" | "ARCHIVED" = "ACTIVE";
    if (apiProject.status === "COMPLETED") status = "COMPLETED";
    else if (apiProject.status === "ARCHIVED") status = "ARCHIVED";

    return {
        id: apiProject.id,
        workspaceId: apiProject.workspaceId,
        slug: apiProject.id,
        initials,
        name: apiProject.name,
        code: apiProject.code || undefined,
        category: apiProject.category || "General",
        description: apiProject.description || "",
        status,
        dueDate: apiProject.dueDate || undefined,
        ownerId: apiProject.ownerId,
        owner: apiProject.owner,
        canEdit: apiProject.canEdit,
        canDelete: apiProject.canDelete,
        currentUserRole: apiProject.currentUserRole,
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
export async function fetchProjects(workspaceId?: string): Promise<MappedProject[]> {
    if (!workspaceId) {
        return [];
    }
    const res = await fetch(`${API_BASE_URL}/projects?workspaceId=${encodeURIComponent(workspaceId)}`, { credentials: "include" });
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
    // Backend returns { success, project } for single project fetch
    const projectData = json.project ?? json.data;
    if (!json.success || !projectData) {
        throw new Error(json.error || "Invalid response format from project API");
    }
    return mapApiProjectToFrontend(projectData);
}

// toApiStatus removed

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
 * GET /api/tasks/:id
 * Fetch a single task by ID.
 */
export async function fetchTaskByIdApi(taskId: string): Promise<Task> {
    const res = await fetch(`${API_BASE_URL}/tasks/${encodeURIComponent(taskId)}`, { credentials: "include" });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to fetch task (HTTP ${res.status})`);
    }
    const json = await res.json();
    return mapApiTaskToFrontend(json.data);
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
        columnId?: string;
        swimlaneId?: string;
        order?: number;
        priority: TaskPriority;
        due: string;
        assignee?: string;          // frontend initials
        assigneeId?: string | null; // direct user ID
        labelIds?: string[];
        members?: Member[];         // to resolve initials → userId
    }
): Promise<Task> {
    let assigneeId = payload.assigneeId ?? null;
    if (!assigneeId && payload.assignee && payload.members) {
        assigneeId = payload.members.find((m) => m.initials === payload.assignee || m.name === payload.assignee || m.email === payload.assignee)?.userId ?? null;
    }

    const body: Record<string, unknown> = {
        title: payload.title,
        priority: toApiPriority(payload.priority),
    };
    if (payload.columnId) body.columnId = payload.columnId;
    if (payload.swimlaneId) body.swimlaneId = payload.swimlaneId;
    if (payload.order !== undefined) body.order = payload.order;
    if (payload.description) body.description = payload.description;
    if (Array.isArray(payload.labelIds)) body.labelIds = payload.labelIds;
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
        columnId?: string | null;
        swimlaneId?: string | null;
        order?: number;
        priority?: TaskPriority;
        due?: string;
        assignee?: string;          // frontend initials
        assigneeId?: string | null; // direct user ID
        labelIds?: string[];
        members?: Member[];         // to resolve initials → userId
    }
): Promise<Task> {
    const body: Record<string, unknown> = {};
    if (payload.title !== undefined)       body.title       = payload.title;
    if (payload.description !== undefined) body.description = payload.description || null;
    if (payload.columnId !== undefined)    body.columnId    = payload.columnId;
    if (payload.swimlaneId !== undefined)  body.swimlaneId  = payload.swimlaneId;
    if (payload.order !== undefined)       body.order       = payload.order;
    if (payload.priority !== undefined)    body.priority    = toApiPriority(payload.priority);
    if (Array.isArray(payload.labelIds))   body.labelIds    = payload.labelIds;
    if (payload.due !== undefined) {
        body.dueDate = parseDueForApi(payload.due) ?? null;
    }
    if (payload.assigneeId !== undefined) {
        body.assigneeId = payload.assigneeId;
    } else if (payload.assignee !== undefined && payload.members) {
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
 * PATCH /api/tasks/:id  (used by Board drag-and-drop)
 */
export async function updateTaskColumnApi(taskId: string, columnId: string | null, order?: number, swimlaneId?: string | null): Promise<Task> {
    const payload: any = { columnId };
    if (order !== undefined) payload.order = order;
    if (swimlaneId !== undefined) payload.swimlaneId = swimlaneId;
    return updateTaskApi(taskId, payload);
}

export async function updateTaskSwimlaneApi(taskId: string, swimlaneId: string | null, order?: number): Promise<Task> {
    return updateTaskApi(taskId, { swimlaneId, order });
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
    role: string = "MEMBER"
): Promise<Member> {
    const validRoles = ["ADMIN", "MEMBER", "VIEWER"];
    const normalizedRole = validRoles.includes(role.toUpperCase()) ? role.toUpperCase() : "MEMBER";

    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), role: normalizedRole }),
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
        content: apiDoc.content || "",
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

export interface DocumentWithProject extends ProjectDocument {
    projectId?: string;
    projectName?: string;
    projectCode?: string;
    project?: {
        id: string;
        name: string;
        code?: string;
        workspaceId?: string;
        members?: Array<{
            userId: string;
            role: string;
            user: {
                id: string;
                firstName?: string;
                lastName?: string;
                name?: string;
                email: string;
                avatar?: string | null;
            };
        }>;
    };
}

/**
 * GET /api/documents/:id
 * Fetch a single document by ID with project and member details.
 */
export async function fetchDocumentByIdApi(documentId: string): Promise<DocumentWithProject> {
    const res = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}`, {
        credentials: "include",
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to fetch document (HTTP ${res.status})`);
    }
    const json = await res.json();
    const mapped = mapApiDocumentToFrontend(json.data);
    return {
        ...mapped,
        projectId: json.data.projectId,
        projectName: json.data.project?.name,
        projectCode: json.data.project?.code,
        project: json.data.project,
    };
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
 * PATCH /api/documents/:id
 * Update a document by ID.
 */
export async function updateDocumentApi(
    id: string,
    payload: {
        name?: string;
        description?: string;
        content?: string;
    }
): Promise<ProjectDocument> {
    const res = await fetch(`${API_BASE_URL}/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to update document (HTTP ${res.status})`);
    }
    return mapApiDocumentToFrontend(json.data);
}

/**
 * DELETE /api/documents/:id
 * Delete a document by ID.
 */
export async function deleteDocumentApi(documentId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}`, {
        method: "DELETE",
        credentials: "include",
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to delete document`);
    }
}

export async function fetchDocumentVersionsApi(documentId: string): Promise<DocumentVersion[]> {
    const res = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/versions`, {
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to fetch versions");
    return json.data;
}

export async function createDocumentVersionApi(documentId: string, name: string): Promise<DocumentVersion> {
    const res = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to create version");
    return json.data;
}

export async function restoreDocumentVersionApi(documentId: string, versionId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}/restore`, {
        method: "POST",
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to restore version");
}
export function mapApiFileToFrontend(apiFile: any): ProjectFile {
    return {
        id: apiFile.id,
        name: apiFile.name,
        type: (apiFile.type || "PDF") as FileType,
        description: apiFile.description || undefined,
        projectId: apiFile.projectId,
        folderId: apiFile.folderId || null,
        isLocked: apiFile.isLocked || false,
        lockedBy: apiFile.lockedBy || null,
        versions: (apiFile.versions || []).map((v: any) => ({
            id: v.id,
            versionNum: v.versionNum,
            s3Key: v.s3Key,
            sizeBytes: v.sizeBytes,
            uploadedBy: v.uploadedBy,
            createdAt: v.createdAt
        })),
        createdAt: formatDisplayDate(apiFile.createdAt),
        updatedAt: formatDisplayDate(apiFile.updatedAt),
    };
}

/**
 * DELETE /api/projects/:projectId/files/:id
 * Delete a file by ID.
 */
export async function deleteFileApi(projectId: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/files/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to delete file (HTTP ${res.status})`);
    }
}

/**
 * POST /api/projects/:projectId/files  (multipart/form-data)
 * Upload a real file via FormData.
 * Do NOT set Content-Type manually; the browser sets it with the correct boundary.
 */
export async function uploadFileApi(
    projectId: string,
    formData: FormData
): Promise<ProjectFile> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/files`, {
        method: "POST",
        credentials: "include",
        body: formData,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to upload file (HTTP ${res.status})`);
    }
    return mapApiFileToFrontend(json.data);
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

/**
 * POST /api/projects
 * Create a new project. Backend derives ownerId automatically from authenticated user context.
 */
export async function createProjectApi(payload: {
    name: string;
    description?: string;
    category?: string;
    code?: string;
    dueDate?: string;
    workspaceId: string;
}): Promise<MappedProject> {
    const res = await fetch(`${API_BASE_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to create project (HTTP ${res.status})`);
    }
    return mapApiProjectToFrontend(json.project ?? json.data);
}

/**
 * Map backend task item to frontend MyTaskItem.
 */
export function mapApiMyTaskToFrontend(apiTask: any): MyTaskItem {
    let assigneeInitials = "UN";
    let assigneeName = "Unassigned";
    if (apiTask.assignee) {
        assigneeInitials = deriveMemberInitials(apiTask.assignee.firstName, apiTask.assignee.lastName, apiTask.assignee.email);
        assigneeName = `${apiTask.assignee.firstName || ""} ${apiTask.assignee.lastName || ""}`.trim() || apiTask.assignee.email;
    }

    const isOverdue = !!(apiTask.dueDate && new Date(apiTask.dueDate) < new Date() && apiTask.status !== "DONE");

    return {
        id: apiTask.id,
        title: apiTask.title,
        description: apiTask.description || undefined,
        columnId: apiTask.columnId,
        columnName: apiTask.columnName || "Unknown",
        swimlaneId: apiTask.swimlaneId || null,
        order: apiTask.order || 0,
        priority: mapTaskPriority(apiTask.priority),
        due: formatShortDate(apiTask.dueDate),
        dueDateRaw: apiTask.dueDate,
        isOverdue,
        assignee: assigneeInitials,
        assigneeName,
        projectId: apiTask.projectId,
        projectName: apiTask.projectName || "Project",
        projectCode: apiTask.projectCode,
        projectStatus: apiTask.projectStatus,
        createdAt: apiTask.createdAt,
        updatedAt: apiTask.updatedAt,
    };
}

/**
 * GET /api/tasks/my-tasks?workspaceId=<workspaceId>&scope=<scope>
 * Fetches tasks in the workspace (assigned, created, or all).
 */
export async function fetchMyTasksApi(workspaceId: string, scope: string = "all"): Promise<MyTaskItem[]> {
    const res = await fetch(`${API_BASE_URL}/tasks/my-tasks?workspaceId=${encodeURIComponent(workspaceId)}&scope=${encodeURIComponent(scope)}`, {
        credentials: "include",
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to fetch tasks (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
        throw new Error(json.error || "Invalid response format from tasks API");
    }
    return json.data.map(mapApiMyTaskToFrontend);
}

/**
 * PATCH /api/projects/:id
 * Update project fields (name, description, category, code, status, dueDate).
 */
export async function updateProjectApi(
    projectId: string,
    payload: {
        name?: string;
        description?: string | null;
        category?: string | null;
        code?: string | null;
        status?: "ACTIVE" | "COMPLETED" | "ARCHIVED";
        dueDate?: string | null;
    }
): Promise<MappedProject> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to update project (HTTP ${res.status})`);
    }
    if (!json.success || !json.project) {
        throw new Error(json.error || "Invalid response format from project update API");
    }
    return mapApiProjectToFrontend(json.project);
}

/**
 * DELETE /api/projects/:id
 * Delete a project by ID.
 */
export async function deleteProjectApi(projectId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
        method: "DELETE",
        credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || `Failed to delete project (HTTP ${res.status})`);
    }
    if (!json.success) {
        throw new Error(json.error || "Failed to delete project");
    }
}

/**
 * GET /api/documents?workspaceId=<workspaceId>
 * Fetches all documents across projects in the active workspace.
 */
export async function fetchWorkspaceDocuments(workspaceId: string): Promise<WorkspaceDocument[]> {
    const res = await fetch(`${API_BASE_URL}/documents?workspaceId=${encodeURIComponent(workspaceId)}`, {
        credentials: "include",
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to fetch documents (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
        throw new Error(json.error || "Invalid response format from documents API");
    }
    return json.data.map((d: any) => ({
        id: d.id,
        name: d.name,
        description: d.description || "",
        type: (d.type || "DOC") as DocType,
        owner: d.owner || "Unknown",
        createdAt: formatDisplayDate(d.createdAt),
        updatedAt: formatDisplayDate(d.updatedAt),
        size: d.size || undefined,
        content: d.content || "",
        projectId: d.projectId,
        projectName: d.projectName || "Project",
        projectCode: d.projectCode || null,
        projectStatus: d.projectStatus || "ACTIVE",
    }));
}

/**
 * GET /api/files?workspaceId=<workspaceId>
 * Fetches all files across projects in the active workspace.
 */
export async function fetchWorkspaceFiles(workspaceId: string): Promise<WorkspaceFile[]> {
    const res = await fetch(`${API_BASE_URL}/files?workspaceId=${encodeURIComponent(workspaceId)}`, {
        credentials: "include",
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to fetch files (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
        throw new Error(json.error || "Invalid response format from files API");
    }
    return json.data.map((f: any) => ({
        id: f.id,
        name: f.name,
        type: (f.type || "PDF") as FileType,
        size: f.size || "Unknown",
        uploadedBy: f.uploadedBy || "Unknown",
        uploadedAt: formatDisplayDate(f.createdAt),
        modifiedAt: formatDisplayDate(f.updatedAt),
        description: f.description || "",
        fileUrl: f.fileUrl || undefined,
        projectId: f.projectId,
        projectName: f.projectName || "Project",
        projectCode: f.projectCode || null,
        projectStatus: f.projectStatus || "ACTIVE",
    }));
}





export async function fetchBoards(projectId: string): Promise<Board[]> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/boards`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch boards");
    const json = await res.json();
    return json.data;
}

export async function createBoardApi(projectId: string, payload: { name: string; description?: string; template?: string; columns?: Array<{ name: string }> }): Promise<Board> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/boards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to create board");
    return json.data;
}

export async function updateBoardApi(projectId: string, boardId: string, payload: { name?: string; description?: string | null }): Promise<Board> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/boards/${boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to update board");
    return json.data;
}

export async function deleteBoardApi(projectId: string, boardId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/boards/${boardId}`, {
        method: "DELETE",
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to delete board");
}

export async function createColumnApi(projectId: string, boardId: string, payload: { name: string; order?: number }): Promise<Column> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/boards/${boardId}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to create column");
    return json.data;
}

export async function updateColumnApi(projectId: string, columnId: string, payload: { name?: string; order?: number }): Promise<Column> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/boards/columns/${columnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to update column");
    return json.data;
}

export async function deleteColumnApi(projectId: string, columnId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/boards/columns/${columnId}`, {
        method: "DELETE",
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to delete column");
}

export async function reorderColumnsApi(projectId: string, boardId: string, columnIds: string[]): Promise<Column[]> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/boards/${boardId}/columns/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ columnIds }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to reorder columns");
    return json.data;
}

// Swimlanes API
export async function createSwimlaneApi(projectId: string, boardId: string, payload: { name: string; order?: number }): Promise<Swimlane> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/boards/${boardId}/swimlanes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to create swimlane");
    return json.data;
}

export async function updateSwimlaneApi(projectId: string, swimlaneId: string, payload: { name?: string; order?: number }): Promise<Swimlane> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/boards/swimlanes/${swimlaneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to update swimlane");
    return json.data;
}

export async function deleteSwimlaneApi(projectId: string, swimlaneId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/boards/swimlanes/${swimlaneId}`, {
        method: "DELETE",
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to delete swimlane");
}

export async function reorderSwimlanesApi(projectId: string, boardId: string, swimlaneIds: string[]): Promise<Swimlane[]> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/boards/${boardId}/swimlanes/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ swimlaneIds }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to reorder swimlanes");
    return json.data;
}

// Labels API
export async function fetchProjectLabelsApi(projectId: string): Promise<Label[]> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/labels`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch project labels");
    const json = await res.json();
    return json.data || [];
}

export async function createProjectLabelApi(projectId: string, payload: { name: string; color: string }): Promise<Label> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to create label");
    return json.data;
}

export async function updateProjectLabelApi(projectId: string, labelId: string, payload: { name?: string; color?: string }): Promise<Label> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/labels/${labelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to update label");
    return json.data;
}

export async function deleteProjectLabelApi(projectId: string, labelId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/labels/${labelId}`, {
        method: "DELETE",
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to delete label");
}

export async function addLabelToTaskApi(taskId: string, labelId: string): Promise<TaskLabel> {
    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ labelId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to add label to task");
    return json.data;
}

export async function removeLabelFromTaskApi(taskId: string, labelId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/labels/${labelId}`, {
        method: "DELETE",
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to remove label from task");
}

// Checklists API
export async function fetchTaskChecklistsApi(taskId: string): Promise<TaskChecklist[]> {
    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/checklists`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch checklists");
    const json = await res.json();
    return json.data || [];
}

export async function createChecklistApi(taskId: string, title?: string): Promise<TaskChecklist> {
    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/checklists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: title || "Checklist" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to create checklist");
    return json.data;
}

export async function deleteChecklistApi(checklistId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tasks/checklists/${checklistId}`, {
        method: "DELETE",
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to delete checklist");
}

export async function addChecklistItemApi(checklistId: string, content: string): Promise<TaskChecklistItem> {
    const res = await fetch(`${API_BASE_URL}/tasks/checklists/${checklistId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to add checklist item");
    return json.data;
}

export async function updateChecklistItemApi(itemId: string, payload: { isCompleted?: boolean; content?: string }): Promise<TaskChecklistItem> {
    const res = await fetch(`${API_BASE_URL}/tasks/checklists/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to update checklist item");
    return json.data;
}

export async function deleteChecklistItemApi(itemId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tasks/checklists/items/${itemId}`, {
        method: "DELETE",
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to delete checklist item");
}

// Time Tracking API
export async function fetchTaskTimeEntriesApi(taskId: string): Promise<{ totalMinutes: number; data: TimeEntry[] }> {
    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/time-entries`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch time entries");
    const json = await res.json();
    return {
        totalMinutes: json.totalMinutes || 0,
        data: json.data || [],
    };
}

export async function addTimeEntryApi(taskId: string, payload: { duration: number; description?: string; date?: string }): Promise<TimeEntry> {
    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to log time entry");
    return json.data;
}

export async function deleteTimeEntryApi(entryId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tasks/time-entries/${entryId}`, {
        method: "DELETE",
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to delete time entry");
}

// Attachments API
export async function fetchTaskAttachmentsApi(taskId: string): Promise<TaskAttachment[]> {
    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/attachments`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch attachments");
    const json = await res.json();
    return json.data || [];
}

export async function uploadTaskAttachmentApi(taskId: string, file: File): Promise<TaskAttachment> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/attachments`, {
        method: "POST",
        credentials: "include",
        body: formData,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to upload attachment");
    return json.data;
}

export async function deleteTaskAttachmentApi(taskId: string, attachmentId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/attachments/${attachmentId}`, {
        method: "DELETE",
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to delete attachment");
}

// Task Activity / Audit History API
export async function fetchTaskActivityApi(taskId: string): Promise<TaskActivityLog[]> {
    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/activity`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch task activity");
    const json = await res.json();
    return json.data || [];
}

export async function updateTaskSemanticStatusApi(taskId: string, semanticStatus: string): Promise<Task> {
    const res = await fetch(`${API_BASE_URL}/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ semanticStatus }),
    });
    const json = await res.json();
    return json.data;
}

export interface TaskMention {
    id: string;
    userId: string;
    user: { id: string; fullName: string; initials: string };
}

export interface TaskComment {
    id: string;
    text: string;
    taskId: string;
    authorId: string;
    author: { id: string; fullName: string; initials: string };
    parentId: string | null;
    replies?: TaskComment[];
    mentions?: TaskMention[];
    attachments?: any[];
    createdAt: string;
    updatedAt: string;
}

export async function fetchTaskCommentsApi(_projectId: string, taskId: string): Promise<TaskComment[]> {
    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/comments`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch comments");
    const json = await res.json();
    return json.data || [];
}

export async function createTaskCommentApi(_projectId: string, taskId: string, payload: { text: string; parentId?: string; mentions?: string[]; attachments?: string[] }): Promise<TaskComment> {
    const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to create comment");
    return json.data;
}

export async function deleteTaskCommentApi(_projectId: string, commentId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/tasks/comments/${commentId}`, {
        method: "DELETE",
        credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to delete comment");
}

// Folders & Files API
export async function fetchFoldersApi(projectId: string): Promise<Folder[]> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/folders`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch folders");
    const json = await res.json();
    return json.data;
}

export async function createFolderApi(projectId: string, name: string, parentId?: string): Promise<Folder> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, parentId }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
}

export async function fetchProjectFilesApi(projectId: string, folderId?: string): Promise<ProjectFile[]> {
    const url = new URL(`${API_BASE_URL}/projects/${projectId}/files`);
    if (folderId) url.searchParams.append("folderId", folderId);
    
    const res = await fetch(url.toString(), { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch files");
    const json = await res.json();
    return json.data;
}

export async function toggleFileLockApi(projectId: string, fileId: string): Promise<ProjectFile> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/files/${fileId}/lock`, {
        method: "PATCH",
        credentials: "include",
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
}


