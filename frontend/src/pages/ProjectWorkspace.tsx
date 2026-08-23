import { useEffect, useState, type DragEvent } from "react";
import { useParams, Link } from "react-router-dom";
import "./Projects.css";
import "./ProjectWorkspace.css";
import TaskModal from "./TaskModal";
import { MemberDetailModal, AddMemberModal } from "./MemberModal";
import { DocumentDetailModal, AddDocumentModal } from "./DocumentModal";
import { FileDetailModal, AddFileModal } from "./FileModal";
import ProjectChat, { type ChatMessage } from "./ProjectChat";
import { fetchProjectById, createTaskApi, updateTaskApi, updateTaskStatusApi, deleteTaskApi, addMemberApi, fetchDocuments, createDocumentApi, fetchFiles, createFileApi, fetchChatMessages, sendChatMessageApi } from "../services/projectApi";
import type { TaskStatus, TaskPriority, Task, Member, MappedProject as Project } from "../services/projectApi";

/* =========================
   TYPES
========================= */

type DocType = "DOC" | "PDF" | "XLS" | "PPT";

interface ProjectDocument {
    id: string;
    name: string;
    description: string;
    type: DocType;
    owner: string;
    createdAt: string;
    updatedAt: string;
    size?: string;
}

type FileType = "PDF" | "PNG" | "JPG" | "FIG" | "ZIP" | "PPT" | "DOC" | "MP4" | "XLS";
type FileCategory = "images" | "documents" | "design" | "archives" | "videos";

const FILE_CATEGORY: Record<FileType, FileCategory> = {
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

interface ProjectFile {
    id: string;
    name: string;
    type: FileType;
    size: string;
    uploadedBy: string;
    uploadedAt: string;
    modifiedAt?: string;
    description?: string;
}

interface MockWorkspaceData {
    slug: string;
    id?: string;
    documents: ProjectDocument[];
    files: ProjectFile[];
    messages: ChatMessage[];
}

const HOUR = 60 * 60 * 1000;
const chatTime = (hoursAgo: number) => new Date(Date.now() - hoursAgo * HOUR).toISOString();

const mockWorkspaceDataList: MockWorkspaceData[] = [
    {
        slug: "website-redesign",
        documents: [
            { id: "d1", name: "Project Requirements", description: "Scope, goals, and success criteria for the redesign.", type: "DOC", owner: "Samayita Ray", createdAt: "Jul 02, 2026", updatedAt: "Aug 10, 2026", size: "184 KB" },
            { id: "d2", name: "Product Specification", description: "Detailed functional spec for the new component library.", type: "DOC", owner: "Aditi Rao", createdAt: "Jul 08, 2026", updatedAt: "Aug 14, 2026", size: "412 KB" },
            { id: "d3", name: "Meeting Notes — August 2026", description: "Notes and decisions from the weekly design sync.", type: "DOC", owner: "Jordan Mehta", createdAt: "Aug 05, 2026", updatedAt: "Aug 12, 2026", size: "96 KB" },
            { id: "d4", name: "UI Guidelines", description: "Typography, spacing, and component usage guidelines.", type: "PDF", owner: "Aditi Rao", createdAt: "Jul 15, 2026", updatedAt: "Aug 09, 2026", size: "2.3 MB" },
            { id: "d5", name: "API Documentation", description: "Endpoints and payloads for the marketing site integration.", type: "DOC", owner: "Pranav Sen", createdAt: "Jul 20, 2026", updatedAt: "Aug 15, 2026", size: "268 KB" },
            { id: "d6", name: "Project Roadmap", description: "Milestones and delivery timeline through Q3.", type: "PPT", owner: "Samayita Ray", createdAt: "Jun 28, 2026", updatedAt: "Aug 01, 2026", size: "1.1 MB" },
        ],
        files: [
            { id: "f1", name: "brand-assets.zip", type: "ZIP", size: "48.2 MB", uploadedBy: "Aditi Rao", uploadedAt: "Jul 03, 2026", modifiedAt: "Aug 09, 2026", description: "Logos, color tokens, and icon set for the redesign." },
            { id: "f2", name: "homepage-final.fig", type: "FIG", size: "12.6 MB", uploadedBy: "Aditi Rao", uploadedAt: "Aug 12, 2026", description: "Final approved homepage layout and components." },
            { id: "f3", name: "project-presentation.pptx", type: "PPT", size: "6.8 MB", uploadedBy: "Samayita Ray", uploadedAt: "Jul 30, 2026", modifiedAt: "Aug 01, 2026" },
            { id: "f4", name: "user-research.pdf", type: "PDF", size: "3.1 MB", uploadedBy: "Jordan Mehta", uploadedAt: "Jul 18, 2026", description: "Usability findings from the June research round." },
            { id: "f5", name: "database-schema.png", type: "PNG", size: "820 KB", uploadedBy: "Pranav Sen", uploadedAt: "Aug 05, 2026" },
        ],
        messages: [
            { id: "m1", senderInitials: "PS", text: "Audit of the existing component library is complete. I've added the findings to the project documentation.", timestamp: chatTime(29) },
            { id: "m2", senderInitials: "AR", text: "I've updated the hero section based on the latest design feedback.", timestamp: chatTime(26) },
            { id: "m3", senderInitials: "JM", text: "QA pass is ready for review. I found two issues with the interactive states.", timestamp: chatTime(4) },
            { id: "m4", senderInitials: "SR", text: "I'll review the remaining tasks and update the project timeline today.", timestamp: chatTime(3) },
        ],
    },
];

const defaultMockWorkspaceData: MockWorkspaceData = mockWorkspaceDataList[0];

const activity = [
    { text: "Pranav Sen marked \"Audit existing component library\" as done", time: "2h ago" },
    { text: "Aditi Rao commented on the hero section design", time: "5h ago" },
    { text: "Jordan Mehta moved \"QA pass on interactive states\" to Review", time: "Yesterday" },
    { text: "Samayita Ray added Kabir Luthra to the project", time: "2 days ago" },
];

const TABS = ["Overview", "Tasks", "Board", "Members", "Documents", "Files", "Chat", "Activity"] as const;
type Tab = (typeof TABS)[number];

const COLUMNS: { key: TaskStatus; label: string }[] = [
    { key: "todo", label: "TO DO" },
    { key: "progress", label: "IN PROGRESS" },
    { key: "review", label: "REVIEW" },
    { key: "done", label: "DONE" },
];

const TAG_LABEL: Record<TaskStatus, string> = {
    todo: "To do",
    progress: "In progress",
    review: "Review",
    done: "Done",
};

const STATUS_FILTERS: { key: "all" | TaskStatus; label: string }[] = [
    { key: "all", label: "All" },
    { key: "todo", label: "To do" },
    { key: "progress", label: "In progress" },
    { key: "review", label: "Review" },
    { key: "done", label: "Done" },
];

const PRIORITY_FILTERS: { key: "all" | TaskPriority; label: string }[] = [
    { key: "all", label: "All priorities" },
    { key: "high", label: "High priority" },
    { key: "medium", label: "Medium priority" },
    { key: "low", label: "Low priority" },
];

const DOC_TYPE_FILTERS: { key: "all" | DocType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "DOC", label: "Documents" },
    { key: "PDF", label: "PDFs" },
    { key: "XLS", label: "Spreadsheets" },
    { key: "PPT", label: "Presentations" },
];

const FILE_CATEGORY_FILTERS: { key: "all" | FileCategory; label: string }[] = [
    { key: "all", label: "All" },
    { key: "images", label: "Images" },
    { key: "documents", label: "Documents" },
    { key: "design", label: "Design" },
    { key: "archives", label: "Archives" },
    { key: "videos", label: "Videos" },
];

export default function ProjectWorkspace() {
    const { id, slug } = useParams<{ id?: string; slug?: string }>();
    const routeParam = id || slug || "";

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("Overview");

    const [tasks, setTasks] = useState<Task[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [documents, setDocuments] = useState<ProjectDocument[]>([]);
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    /* Tasks tab filters */
    const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
    const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");

    useEffect(() => {
        if (!routeParam) return;
        let isMounted = true;
        setLoading(true);

        Promise.all([
            fetchProjectById(routeParam),
            fetchDocuments(routeParam).catch((err) => {
                console.error("Error fetching documents:", err);
                return null;
            }),
            fetchFiles(routeParam).catch((err) => {
                console.error("Error fetching files:", err);
                return null;
            }),
            fetchChatMessages(routeParam).catch((err) => {
                console.error("Error fetching chat messages:", err);
                return null;
            }),
        ])
            .then(([data, apiDocs, apiFiles, apiMessages]) => {
                if (isMounted) {
                    setProject(data);
                    setTasks(data.tasks);
                    setMembers(data.members);

                    const mockMatch = mockWorkspaceDataList.find(
                        (m) => m.slug === routeParam || m.id === routeParam
                    ) || defaultMockWorkspaceData;

                    setDocuments(apiDocs !== null ? apiDocs : mockMatch.documents);
                    setFiles(apiFiles !== null ? apiFiles : mockMatch.files);
                    setMessages(apiMessages !== null ? apiMessages : mockMatch.messages);
                    setError(null);
                }
            })
            .catch((err) => {
                if (isMounted) {
                    console.error("Error fetching project workspace:", err);
                    setError(err.message || "Project not found");
                }
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                }
            });

        setStatusFilter("all");
        setPriorityFilter("all");
    }, [id, slug, routeParam]);

    const filteredTasks = tasks.filter((t) => {
        const statusMatch = statusFilter === "all" || t.status === statusFilter;
        const priorityMatch = priorityFilter === "all" || t.priority === priorityFilter;
        return statusMatch && priorityMatch;
    });

    const tasksDone = tasks.filter((t) => t.status === "done").length;
    const tasksTotal = tasks.length;
    const progress = tasksTotal === 0 ? (project?.progress ?? 0) : Math.round((tasksDone / tasksTotal) * 100);

    /* Drag and drop */
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

    const handleDrop = (columnKey: TaskStatus, e: DragEvent) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("text/plain") || draggingId;
        if (taskId) {
            // Optimistic update
            setTasks((prev) =>
                prev.map((t) => (t.id === taskId ? { ...t, status: columnKey } : t))
            );
            // Persist to backend
            updateTaskStatusApi(taskId, columnKey).then((updated) => {
                setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            }).catch((err) => {
                console.error("Failed to update task status:", err);
                // Revert on failure — refetch the task list
                if (routeParam) {
                    fetchProjectById(routeParam).then((data) => setTasks(data.tasks)).catch(() => {});
                }
            });
        }
        setDraggingId(null);
        setDragOverColumn(null);
    };

    /* Task modal (create / edit) */
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"create" | "edit">("create");
    const [modalTask, setModalTask] = useState<Task | null>(null);
    const [modalDefaultStatus, setModalDefaultStatus] = useState<TaskStatus>("todo");

    const openCreateModal = (status: TaskStatus) => {
        setModalMode("create");
        setModalTask(null);
        setModalDefaultStatus(status);
        setModalOpen(true);
    };

    const openEditModal = (task: Task) => {
        setModalMode("edit");
        setModalTask(task);
        setModalOpen(true);
    };

    const closeModal = () => setModalOpen(false);

    const saveTask = (task: Task) => {
        const isNew = !tasks.some((t) => t.id === task.id) || task.id.startsWith("t-");

        if (isNew) {
            // POST: create
            createTaskApi(routeParam, {
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                due: task.due,
                assignee: task.assignee,
                members,
            })
                .then((created) => {
                    setTasks((prev) => [...prev, created]);
                })
                .catch((err) => console.error("Failed to create task:", err));
        } else {
            // PATCH: update — optimistic first, then sync with DB response
            setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
            updateTaskApi(task.id, {
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                due: task.due,
                assignee: task.assignee,
                members,
            })
                .then((updated) => {
                    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                })
                .catch((err) => console.error("Failed to update task:", err));
        }
        setModalOpen(false);
    };

    const deleteTask = (id: string) => {
        // Optimistic removal
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setModalOpen(false);
        deleteTaskApi(id).catch((err) => {
            console.error("Failed to delete task:", err);
            // Revert on failure
            if (routeParam) {
                fetchProjectById(routeParam).then((data) => setTasks(data.tasks)).catch(() => {});
            }
        });
    };

    const memberName = (initials: string) =>
        members.find((m) => m.initials === initials)?.name ?? initials;

    /* =========================
       MEMBERS TAB
    ========================= */
    const [addMemberOpen, setAddMemberOpen] = useState(false);
    const [detailMember, setDetailMember] = useState<Member | null>(null);
    const [memberError, setMemberError] = useState<string | null>(null);

    /* AddMemberModal.onSave receives { name, email, role }.
     * We look up the user by email via the backend — no stub creation. */
    const handleAddMemberSave = (form: { name: string; email: string; role: string }) => {
        setMemberError(null);
        addMemberApi(routeParam, form.email, form.role)
            .then((newMember) => {
                setMembers((prev) => {
                    // Guard against duplicate initials in local state
                    if (prev.some((m) => m.userId && m.userId === newMember.userId)) return prev;
                    return [...prev, newMember];
                });
                setAddMemberOpen(false);
            })
            .catch((err: Error) => {
                setMemberError(err.message);
            });
    };

    /* MemberDetailModal doesn't expose onRemoveMember; removal is not supported via modal */
    const memberStats = (member: Member) => {
        const assignedTasks = tasks.filter((t) => t.assignee === member.initials);
        return {
            assignedTasks,
            assigned: assignedTasks.length,
            completed: assignedTasks.filter((t) => t.status === "done").length,
            remaining: assignedTasks.filter((t) => t.status !== "done").length,
        };
    };

    /* =========================
       DOCUMENTS TAB
    ========================= */
    const [docFilter, setDocFilter] = useState<"all" | DocType>("all");
    const [docSearch, setDocSearch] = useState("");
    const [addDocOpen, setAddDocOpen] = useState(false);
    const [detailDoc, setDetailDoc] = useState<ProjectDocument | null>(null);

    const filteredDocs = documents.filter((d) => {
        const typeMatch = docFilter === "all" || d.type === docFilter;
        const q = docSearch.trim().toLowerCase();
        const searchMatch =
            !q ||
            d.name.toLowerCase().includes(q) ||
            d.description.toLowerCase().includes(q) ||
            d.owner.toLowerCase().includes(q);
        return typeMatch && searchMatch;
    });

    /* AddDocumentModal.onSave receives partial doc; we call createDocumentApi */
    const handleAddDocumentSave = (form: { name: string; description: string; type: DocType; owner: string; size?: string }) => {
        createDocumentApi(routeParam, form)
            .then((newDoc) => {
                setDocuments((prev) => [newDoc, ...prev]);
                setAddDocOpen(false);
            })
            .catch((err) => {
                console.error("Failed to create document:", err);
            });
    };

    /* =========================
       FILES TAB
    ========================= */
    const [fileCategoryFilter, setFileCategoryFilter] = useState<"all" | FileCategory>("all");
    const [fileSearch, setFileSearch] = useState("");
    const [addFileOpen, setAddFileOpen] = useState(false);
    const [detailFile, setDetailFile] = useState<ProjectFile | null>(null);

    const filteredFiles = files.filter((f) => {
        const cat = FILE_CATEGORY[f.type];
        const catMatch = fileCategoryFilter === "all" || cat === fileCategoryFilter;
        const q = fileSearch.trim().toLowerCase();
        const searchMatch =
            !q ||
            f.name.toLowerCase().includes(q) ||
            f.uploadedBy.toLowerCase().includes(q) ||
            (f.description ?? "").toLowerCase().includes(q);
        return catMatch && searchMatch;
    });

    /* AddFileModal.onSave receives partial file; we call createFileApi */
    const handleAddFileSave = (form: { name: string; type: FileType; size: string; uploadedBy: string; description?: string }) => {
        createFileApi(routeParam, form)
            .then((newFile) => {
                setFiles((prev) => [newFile, ...prev]);
                setAddFileOpen(false);
            })
            .catch((err) => {
                console.error("Failed to create file:", err);
            });
    };

    /* =========================
       CHAT TAB
    ========================= */
    const handleSendMessage = (text: string) => {
        const currentSender = members[0] ?? {
            initials: "SR",
            name: "Samayita Ray",
            role: "Workspace Admin",
            email: "samayita.ray@acmecorp.com",
        };
        sendChatMessageApi(routeParam, text, currentSender.initials)
            .then((newMsg) => {
                setMessages((prev) => [...prev, newMsg]);
            })
            .catch((err) => {
                console.error("Failed to send chat message:", err);
            });
    };

    if (loading) {
        return (
            <div className="projects-page">
                <aside className="projects-sidebar">
                    <div className="brand"><span>Collabsphere</span><small>ENT</small></div>
                    <div className="workspace">
                        <div className="workspace-logo">AC</div>
                        <div><strong>Acme Corp</strong><span>Enterprise workspace</span></div>
                        <span className="chevron">⌄</span>
                    </div>
                    <div className="nav-title">NAVIGATION</div>
                    <nav>
                        <a href="#">Overview</a>
                        <a href="#" className="selected">Projects</a>
                        <a href="#">My Tasks</a>
                    </nav>
                </aside>
                <main className="projects-main">
                    <header className="topbar">
                        <div className="breadcrumb">Workspace / Projects / <strong>Loading...</strong></div>
                    </header>
                    <section className="content">
                        <div style={{ padding: "60px 0", color: "#64748b", textAlign: "center" }}>
                            Loading workspace project...
                        </div>
                    </section>
                </main>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="projects-page">
                <aside className="projects-sidebar">
                    <div className="brand"><span>Collabsphere</span><small>ENT</small></div>
                    <div className="workspace">
                        <div className="workspace-logo">AC</div>
                        <div><strong>Acme Corp</strong><span>Enterprise workspace</span></div>
                        <span className="chevron">⌄</span>
                    </div>
                </aside>
                <main className="projects-main">
                    <header className="topbar">
                        <div className="breadcrumb">Workspace / Projects / <strong>Error</strong></div>
                    </header>
                    <section className="content">
                        <Link to="/projects" className="back-link">← Back to Projects</Link>
                        <div style={{ padding: "60px 0", color: "#ef4444", textAlign: "center" }}>
                            {error || "Project not found"}
                        </div>
                    </section>
                </main>
            </div>
        );
    }

    return (
        <div className="projects-page">

            <aside className="projects-sidebar">

                <div className="brand">
                    <span>Collabsphere</span>
                    <small>ENT</small>
                </div>

                <div className="workspace">
                    <div className="workspace-logo">AC</div>

                    <div>
                        <strong>Acme Corp</strong>
                        <span>Enterprise workspace</span>
                    </div>

                    <span className="chevron">⌄</span>
                </div>

                <div className="nav-title">NAVIGATION</div>

                <nav>
                    <a href="#">Overview</a>
                    <a href="#" className="selected">
                        Projects
                        <span>{members.length}</span>
                    </a>
                    <a href="#">My Tasks</a>
                    <a href="#">Documents</a>
                    <a href="#">Files</a>
                    <a href="#">Messages</a>
                    <a href="#">Analytics</a>
                    <a href="#">Settings</a>
                </nav>

                <div className="profile">
                    <div className="profile-avatar">SR</div>

                    <div>
                        <strong>Samayita Ray</strong>
                        <span>Workspace Admin</span>
                    </div>
                </div>

            </aside>

            <main className="projects-main">

                <header className="topbar">

                    <div className="breadcrumb">
                        Workspace / Projects / <strong>{project.name}</strong>
                    </div>

                    <div className="topbar-actions">
                        <div className="search">
                            <span>⌕</span>
                            <input placeholder="Search anything..." />
                            <kbd>⌘ K</kbd>
                        </div>

                        <button className="notification">♢</button>

                        <div className="profile-avatar">SR</div>
                    </div>

                </header>

                <section className="content">

                    <Link to="/projects" className="back-link">
                        ← Back to Projects
                    </Link>

                    <div className="workspace-header">

                        <div className="workspace-header-main">

                            <div className="workspace-mark">{project.initials}</div>

                            <div className="workspace-title-block">

                                <div className="workspace-title-row">
                                    <h1>{project.name}</h1>

                                    <div
                                        className={`status ${project.status === "COMPLETED" ? "completed" : "active"
                                            }`}
                                    >
                                        <span />
                                        {project.status}
                                    </div>
                                </div>

                                <div className="workspace-category">{project.category}</div>

                                <p className="workspace-description">{project.description}</p>

                            </div>

                        </div>

                        <div className="workspace-header-side">

                            <div className="workspace-progress">
                                <div className="progress-header">
                                    <span>Progress</span>
                                    <strong>{progress}%</strong>
                                </div>

                                <div className="progress-bar">
                                    <div style={{ width: `${progress}%` }} />
                                </div>

                                <div className="progress-meta">
                                    <span>✓ {tasksDone} of {tasksTotal} tasks complete</span>
                                    <span>◷ {project.date}</span>
                                </div>
                            </div>

                            <div className="workspace-members">

                                <span>Team members</span>

                                <div className="members-stack">
                                    {members.map((m) => (
                                        <div
                                            className="member"
                                            key={m.initials}
                                            title={`${m.name} (${m.role})`}
                                            onClick={() => setDetailMember(m)}
                                            style={{ cursor: "pointer" }}
                                        >
                                            {m.initials}
                                        </div>
                                    ))}

                                    <button
                                        className="add-member-btn"
                                        title="Add team member"
                                        onClick={() => setAddMemberOpen(true)}
                                    >
                                        +
                                    </button>
                                </div>

                            </div>

                        </div>

                    </div>

                    <div className="workspace-tabs">

                        {TABS.map((tab) => (
                            <button
                                key={tab}
                                className={activeTab === tab ? "active" : ""}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab}
                                {tab === "Tasks" && <span className="tab-count">{tasksTotal}</span>}
                                {tab === "Board" && <span className="tab-count">{tasksTotal}</span>}
                                {tab === "Members" && <span className="tab-count">{members.length}</span>}
                                {tab === "Documents" && (
                                    <span className="tab-count">{documents.length}</span>
                                )}
                                {tab === "Files" && <span className="tab-count">{files.length}</span>}
                                {tab === "Chat" && <span className="tab-count">{messages.length}</span>}
                            </button>
                        ))}

                    </div>

                    {/* OVERVIEW TAB */}
                    {activeTab === "Overview" && (
                        <div className="overview-grid">

                            <div className="overview-left">

                                <div className="overview-card">
                                    <div className="overview-card-header">
                                        <div>
                                            <h2>Project Overview</h2>
                                            <p>Key details and execution status for this workspace.</p>
                                        </div>
                                    </div>

                                    <div className="overview-stats">
                                        <div className="stat">
                                            <span>STATUS</span>
                                            <strong style={{ textTransform: "capitalize" }}>
                                                {project.status.toLowerCase()}
                                            </strong>
                                        </div>

                                        <div className="stat">
                                            <span>PROGRESS</span>
                                            <strong>{progress}%</strong>
                                        </div>

                                        <div className="stat">
                                            <span>TASKS</span>
                                            <strong>{tasksDone} / {tasksTotal}</strong>
                                        </div>

                                        <div className="stat">
                                            <span>TARGET DATE</span>
                                            <strong>{project.date}</strong>
                                        </div>
                                    </div>
                                </div>

                                <div className="overview-card">
                                    <div className="overview-card-header">
                                        <div>
                                            <h2>Active Tasks</h2>
                                            <p>High priority work currently in motion.</p>
                                        </div>

                                        <button
                                            className="cs-btn cs-btn-secondary"
                                            onClick={() => setActiveTab("Board")}
                                        >
                                            View Board →
                                        </button>
                                    </div>

                                    <div className="task-list">
                                        {tasks.slice(0, 4).map((t) => (
                                            <div className="task-row" key={t.id} onClick={() => openEditModal(t)}>
                                                <div className={`task-check ${t.status === "done" ? "checked" : ""}`}>
                                                    {t.status === "done" ? "✓" : ""}
                                                </div>

                                                <div className="task-body">
                                                    <div className="task-title-row">
                                                        <span className="task-title">{t.title}</span>
                                                        <span className={`priority-tag ${t.priority}`}>
                                                            {t.priority}
                                                        </span>
                                                    </div>

                                                    <div className="task-meta">
                                                        <span>Status: {TAG_LABEL[t.status]}</span>
                                                        <span>Due: {t.due}</span>
                                                        <span>Assignee: {memberName(t.assignee)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>

                            <div className="overview-right">

                                <div className="overview-card">
                                    <div className="overview-card-header">
                                        <div>
                                            <h2>Team ({members.length})</h2>
                                            <p>Members assigned to this project.</p>
                                        </div>

                                        <button
                                            className="cs-btn cs-btn-secondary"
                                            onClick={() => setAddMemberOpen(true)}
                                        >
                                            + Add
                                        </button>
                                    </div>

                                    <div className="members-list">
                                        {members.map((m) => (
                                            <div
                                                className="member-row"
                                                key={m.initials}
                                                onClick={() => setDetailMember(m)}
                                                style={{ cursor: "pointer" }}
                                            >
                                                <div className="member-avatar">{m.initials}</div>
                                                <div className="member-info">
                                                    <strong>{m.name}</strong>
                                                    <span>{m.role}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="overview-card">
                                    <div className="overview-card-header">
                                        <div>
                                            <h2>Recent Activity</h2>
                                            <p>Audit trail of changes across this project.</p>
                                        </div>
                                    </div>

                                    <div className="activity-list">
                                        {activity.map((a, i) => (
                                            <div className="activity-row" key={i}>
                                                <div className="activity-bullet" />
                                                <div className="activity-body">
                                                    <p>{a.text}</p>
                                                    <span>{a.time}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>

                        </div>
                    )}

                    {/* TASKS TAB (LIST VIEW) */}
                    {activeTab === "Tasks" && (
                        <div className="tab-pane">

                            <div className="pane-toolbar">
                                <div className="pane-title">
                                    <h2>Tasks ({filteredTasks.length})</h2>
                                    <p>Structured view of all deliverable work items.</p>
                                </div>

                                <div className="pane-actions">

                                    <div className="filter-group">

                                        <select
                                            className="filter-select"
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value as any)}
                                        >
                                            {STATUS_FILTERS.map((f) => (
                                                <option key={f.key} value={f.key}>
                                                    {f.label}
                                                </option>
                                            ))}
                                        </select>

                                        <select
                                            className="filter-select"
                                            value={priorityFilter}
                                            onChange={(e) => setPriorityFilter(e.target.value as any)}
                                        >
                                            {PRIORITY_FILTERS.map((f) => (
                                                <option key={f.key} value={f.key}>
                                                    {f.label}
                                                </option>
                                            ))}
                                        </select>

                                    </div>

                                    <button
                                        className="cs-btn cs-btn-primary"
                                        onClick={() => openCreateModal("todo")}
                                    >
                                        + New task
                                    </button>

                                </div>
                            </div>

                            <div className="task-list-container">
                                {filteredTasks.length === 0 ? (
                                    <div className="empty-state">
                                        <p>No tasks match the selected filters.</p>
                                    </div>
                                ) : (
                                    filteredTasks.map((t) => (
                                        <div
                                            className="task-row clickable"
                                            key={t.id}
                                            onClick={() => openEditModal(t)}
                                        >
                                            <div className={`task-check ${t.status === "done" ? "checked" : ""}`}>
                                                {t.status === "done" ? "✓" : ""}
                                            </div>

                                            <div className="task-body">
                                                <div className="task-title-row">
                                                    <span className="task-title">{t.title}</span>
                                                    <span className={`priority-tag ${t.priority}`}>
                                                        {t.priority}
                                                    </span>
                                                </div>

                                                {t.description && (
                                                    <p className="task-desc">{t.description}</p>
                                                )}

                                                <div className="task-meta">
                                                    <span>Status: {TAG_LABEL[t.status]}</span>
                                                    <span>Due: {t.due}</span>
                                                    <span>Assignee: {memberName(t.assignee)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                        </div>
                    )}

                    {/* BOARD TAB (KANBAN VIEW) */}
                    {activeTab === "Board" && (
                        <div className="tab-pane">

                            <div className="pane-toolbar">
                                <div className="pane-title">
                                    <h2>Kanban Board</h2>
                                    <p>Drag and drop tasks between columns to update status.</p>
                                </div>

                                <button
                                    className="cs-btn cs-btn-primary"
                                    onClick={() => openCreateModal("todo")}
                                >
                                    + New task
                                </button>
                            </div>

                            <div className="board-grid">
                                {COLUMNS.map((col) => {
                                    const colTasks = tasks.filter((t) => t.status === col.key);
                                    const isTarget = dragOverColumn === col.key;

                                    return (
                                        <div
                                            key={col.key}
                                            className={`board-column ${isTarget ? "drag-over" : ""}`}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                setDragOverColumn(col.key);
                                            }}
                                            onDragLeave={() => setDragOverColumn(null)}
                                            onDrop={(e) => handleDrop(col.key, e)}
                                        >
                                            <div className="column-header">
                                                <div className="column-title">
                                                    <span className={`column-dot ${col.key}`} />
                                                    <strong>{col.label}</strong>
                                                </div>
                                                <span className="column-count">{colTasks.length}</span>
                                            </div>

                                            <div className="column-body">
                                                {colTasks.map((t) => (
                                                    <div
                                                        key={t.id}
                                                        className={`kanban-card ${draggingId === t.id ? "dragging" : ""}`}
                                                        draggable
                                                        onDragStart={(e) => {
                                                            setDraggingId(t.id);
                                                            e.dataTransfer.setData("text/plain", t.id);
                                                        }}
                                                        onDragEnd={() => setDraggingId(null)}
                                                        onClick={() => openEditModal(t)}
                                                    >
                                                        <div className="card-header-row">
                                                            <span className={`priority-tag ${t.priority}`}>
                                                                {t.priority}
                                                            </span>

                                                            <div className="assignee-avatar" title={memberName(t.assignee)}>
                                                                {t.assignee}
                                                            </div>
                                                        </div>

                                                        <h4 className="card-title">{t.title}</h4>

                                                        {t.description && (
                                                            <p className="card-desc">{t.description}</p>
                                                        )}

                                                        <div className="card-footer-row">
                                                            <span className="card-due">◷ {t.due}</span>
                                                        </div>
                                                    </div>
                                                ))}

                                                <button
                                                    className="add-card-btn"
                                                    onClick={() => openCreateModal(col.key)}
                                                >
                                                    + Add task
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                        </div>
                    )}

                    {/* MEMBERS TAB */}
                    {activeTab === "Members" && (
                        <div className="tab-pane">

                            <div className="pane-toolbar">
                                <div className="pane-title">
                                    <h2>Team Members ({members.length})</h2>
                                    <p>People with access to this project workspace.</p>
                                </div>

                                <button
                                    className="cs-btn cs-btn-primary"
                                    onClick={() => setAddMemberOpen(true)}
                                >
                                    + Add member
                                </button>
                            </div>

                            {memberError && (
                                <p role="alert" style={{ color: "var(--danger, #e53e3e)", margin: "0 0 12px", fontSize: "0.875rem" }}>
                                    ⚠ {memberError}
                                </p>
                            )}

                            <div className="members-grid">
                                {members.map((m) => (
                                    <div
                                        className="member-card"
                                        key={m.initials}
                                        onClick={() => setDetailMember(m)}
                                    >
                                        <div className="member-avatar-lg">{m.initials}</div>
                                        <h3>{m.name}</h3>
                                        <p className="member-role">{m.role}</p>
                                        <p className="member-email">{m.email}</p>
                                    </div>
                                ))}
                            </div>

                        </div>
                    )}

                    {/* DOCUMENTS TAB */}
                    {activeTab === "Documents" && (
                        <div className="tab-pane">

                            <div className="pane-toolbar">
                                <div className="pane-title">
                                    <h2>Project Documents ({filteredDocs.length})</h2>
                                    <p>Specifications, notes, and requirements for this workspace.</p>
                                </div>

                                <div className="pane-actions">

                                    <div className="search">
                                        <span>⌕</span>
                                        <input
                                            placeholder="Search documents..."
                                            value={docSearch}
                                            onChange={(e) => setDocSearch(e.target.value)}
                                        />
                                    </div>

                                    <select
                                        className="filter-select"
                                        value={docFilter}
                                        onChange={(e) => setDocFilter(e.target.value as any)}
                                    >
                                        {DOC_TYPE_FILTERS.map((f) => (
                                            <option key={f.key} value={f.key}>
                                                {f.label}
                                            </option>
                                        ))}
                                    </select>

                                    <button
                                        className="cs-btn cs-btn-primary"
                                        onClick={() => setAddDocOpen(true)}
                                    >
                                        + New document
                                    </button>

                                </div>
                            </div>

                            <div className="documents-grid">
                                {filteredDocs.length === 0 ? (
                                    <div className="empty-state">
                                        <p>No documents found.</p>
                                    </div>
                                ) : (
                                    filteredDocs.map((d) => (
                                        <div
                                            className="doc-card"
                                            key={d.id}
                                            onClick={() => setDetailDoc(d)}
                                        >
                                            <div className="doc-type-badge">{d.type}</div>
                                            <h3>{d.name}</h3>
                                            <p className="doc-desc">{d.description}</p>

                                            <div className="doc-meta">
                                                <span>Owner: {d.owner}</span>
                                                <span>Updated: {d.updatedAt}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                        </div>
                    )}

                    {/* FILES TAB */}
                    {activeTab === "Files" && (
                        <div className="tab-pane">

                            <div className="pane-toolbar">
                                <div className="pane-title">
                                    <h2>Uploaded Files ({filteredFiles.length})</h2>
                                    <p>Design assets, archives, and media attachments.</p>
                                </div>

                                <div className="pane-actions">

                                    <div className="search">
                                        <span>⌕</span>
                                        <input
                                            placeholder="Search files..."
                                            value={fileSearch}
                                            onChange={(e) => setFileSearch(e.target.value)}
                                        />
                                    </div>

                                    <select
                                        className="filter-select"
                                        value={fileCategoryFilter}
                                        onChange={(e) => setFileCategoryFilter(e.target.value as any)}
                                    >
                                        {FILE_CATEGORY_FILTERS.map((f) => (
                                            <option key={f.key} value={f.key}>
                                                {f.label}
                                            </option>
                                        ))}
                                    </select>

                                    <button
                                        className="cs-btn cs-btn-primary"
                                        onClick={() => setAddFileOpen(true)}
                                    >
                                        + Upload file
                                    </button>

                                </div>
                            </div>

                            <div className="files-grid">
                                {filteredFiles.length === 0 ? (
                                    <div className="empty-state">
                                        <p>No files found.</p>
                                    </div>
                                ) : (
                                    filteredFiles.map((f) => (
                                        <div
                                            className="file-card"
                                            key={f.id}
                                            onClick={() => setDetailFile(f)}
                                        >
                                            <div className="file-type-badge">{f.type}</div>
                                            <h3>{f.name}</h3>
                                            <p className="file-size">{f.size}</p>

                                            <div className="file-meta">
                                                <span>By: {f.uploadedBy}</span>
                                                <span>Date: {f.uploadedAt}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                        </div>
                    )}

                    {/* CHAT TAB */}
                    {activeTab === "Chat" && (
                        <div className="tab-pane">
                            <ProjectChat
                                messages={messages}
                                members={members}
                                onSend={handleSendMessage}
                            />
                        </div>
                    )}

                    {/* ACTIVITY TAB */}
                    {activeTab === "Activity" && (
                        <div className="tab-pane">
                            <div className="pane-toolbar">
                                <div className="pane-title">
                                    <h2>Activity Log</h2>
                                    <p>Full record of updates across this project.</p>
                                </div>
                            </div>

                            <div className="activity-list">
                                {activity.map((a, i) => (
                                    <div className="activity-row" key={i}>
                                        <div className="activity-bullet" />
                                        <div className="activity-body">
                                            <p>{a.text}</p>
                                            <span>{a.time}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </section>

            </main>

            {/* MODALS */}
            {modalOpen && (
                <TaskModal
                    mode={modalMode}
                    task={modalTask}
                    defaultStatus={modalDefaultStatus}
                    members={members}
                    onClose={closeModal}
                    onSave={saveTask}
                    onDelete={deleteTask}
                />
            )}

            {addMemberOpen && (
                <AddMemberModal
                    onClose={() => { setAddMemberOpen(false); setMemberError(null); }}
                    onSave={handleAddMemberSave}
                />
            )}

            {detailMember && (
                <MemberDetailModal
                    member={detailMember}
                    stats={memberStats(detailMember)}
                    onClose={() => setDetailMember(null)}
                    onOpenTask={openEditModal}
                />
            )}

            {addDocOpen && (
                <AddDocumentModal
                    onClose={() => setAddDocOpen(false)}
                    onSave={handleAddDocumentSave}
                />
            )}

            {detailDoc && (
                <DocumentDetailModal
                    document={detailDoc}
                    onClose={() => setDetailDoc(null)}
                />
            )}

            {addFileOpen && (
                <AddFileModal
                    onClose={() => setAddFileOpen(false)}
                    onSave={handleAddFileSave}
                />
            )}

            {detailFile && (
                <FileDetailModal
                    file={detailFile}
                    onClose={() => setDetailFile(null)}
                />
            )}

        </div>
    );
}