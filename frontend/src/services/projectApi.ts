/* =========================================================
   PROJECT API SERVICE
   Provides API calls to COLLABSPHERE backend and transforms
   PostgreSQL API responses into existing frontend types.
========================================================= */

export type TaskStatus = "todo" | "progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high";

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
    const res = await fetch(`${API_BASE_URL}/projects`);
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
    const res = await fetch(`${API_BASE_URL}/projects/${id}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch project (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (!json.success || !json.data) {
        throw new Error(json.error || "Invalid response format from project API");
    }
    return mapApiProjectToFrontend(json.data);
}
