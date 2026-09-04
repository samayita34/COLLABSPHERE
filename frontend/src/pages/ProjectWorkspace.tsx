import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import "./Projects.css";
import "./ProjectWorkspace.css";
import TaskModal from "./TaskModal";
import { KanbanBoard } from "../components/kanban/KanbanBoard";
import { MemberDetailModal, AddMemberModal } from "./MemberModal";
import { DocumentDetailModal, AddDocumentModal } from "./DocumentModal";
import { FileBrowser } from "../components/FileBrowser";
import { ProjectSettingsModal } from "./ProjectSettingsModal";
import ProjectChat, { type ChatMessage } from "./ProjectChat";
import { fetchProjectById, createTaskApi, updateTaskApi, deleteTaskApi, addMemberApi, fetchDocuments, createDocumentApi, fetchChatMessages, sendChatMessageApi, updateDocumentApi, mapApiTaskToFrontend, mapApiChatMessageToFrontend, fetchBoards } from "../services/projectApi";
import type { TaskPriority, Task, Member, MappedProject as Project, Board } from "../services/projectApi";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useSidebar } from "../context/SidebarContext";
import { AppSidebar } from "../components/AppSidebar";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import { socketService } from "../services/socket";
import NotificationCenter from "../components/NotificationCenter";
import { CheckSquare2, Users, FileText, Activity, Plus, Search, Calendar, User, ChevronRight, Loader2, AlertCircle } from "lucide-react";

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







interface AuditLogEntry {
    id: string;
    action: string;
    entityType: string;
    entityId?: string;
    details?: any;
    createdAt: string;
    user?: { id: string; firstName: string; lastName: string; email: string };
}

const TABS = ["Overview", "Tasks", "Board", "Members", "Documents", "Files", "Chat", "Activity", "Settings"] as const;
type Tab = (typeof TABS)[number];

// Removed static COLUMNS, TAG_LABEL, STATUS_FILTERS as they are dynamic now

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



export default function ProjectWorkspace() {
    const { id, slug } = useParams<{ id?: string; slug?: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { userFullName, userInitials } = useAuth();
    const { activeWorkspace } = useWorkspace();
    const { toggleSidebar, isOpen } = useSidebar();
    const routeParam = id || slug || "";

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    
    const initialTab = (location.state?.activeTab && TABS.includes(location.state.activeTab as Tab)) ? (location.state.activeTab as Tab) : "Overview";
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);

    useEffect(() => {
        if (location.state?.activeTab && TABS.includes(location.state.activeTab as Tab)) {
            setActiveTab(location.state.activeTab as Tab);
        }
    }, [location.state]);
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [documents, setDocuments] = useState<ProjectDocument[]>([]);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [board, setBoard] = useState<Board | null>(null);

    // Activity / Audit log
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [taskSearch, setTaskSearch] = useState("");
    const [memberSearch, setMemberSearch] = useState("");

    /* Tasks tab filters */
    const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
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
            fetchChatMessages(routeParam).catch((err) => {
                console.error("Error fetching chat messages:", err);
                return null;
            }),
            fetchBoards(routeParam).catch((err) => {
                console.error("Error fetching boards:", err);
                return null;
            }),
        ])
            .then(([data, apiDocs, apiMessages, apiBoards]) => {
                if (isMounted) {
                    setProject(data);
                    setTasks(data.tasks || []);
                    setMembers(data.members || []);
                    setDocuments(apiDocs || []);
                    setMessages(apiMessages || []);
                    if (apiBoards && apiBoards.length > 0) {
                        setBoard(apiBoards[0]); // Primary board
                    }
                    setError(null);

                    // Fetch recent audit logs for activity trail
                    const wsId = data.workspaceId || activeWorkspace?.id;
                    if (wsId) {
                        fetch(`/api/audit-logs?workspaceId=${wsId}&limit=20`, { credentials: "include" })
                            .then((r) => r.json())
                            .then((res) => {
                                if (res.success && isMounted) {
                                    setAuditLogs(res.data || []);
                                }
                            })
                            .catch(console.error);
                    }
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

    /* =========================
       REAL-TIME SOCKET.IO SYNC
    ========================= */
    useEffect(() => {
        if (!routeParam) return;
        const socket = socketService.connect();
        socketService.joinProject(routeParam);

        const handleTaskUpdated = (rawTask: any) => {
            const mapped = mapApiTaskToFrontend(rawTask);
            setTasks((prev) => {
                const exists = prev.some((t) => t.id === mapped.id);
                return exists
                    ? prev.map((t) => (t.id === mapped.id ? mapped : t))
                    : [...prev, mapped];
            });
        };

        const handleTaskDeleted = (deletedTaskId: string) => {
            setTasks((prev) => prev.filter((t) => t.id !== deletedTaskId));
        };

        const handleNewMessage = (rawMsg: any) => {
            const mapped = mapApiChatMessageToFrontend(rawMsg);
            setMessages((prev) => {
                if (prev.some((m) => m.id === mapped.id)) return prev;
                return [...prev, mapped];
            });
        };

        socket?.on("taskUpdated", handleTaskUpdated);
        socket?.on("taskDeleted", handleTaskDeleted);
        socket?.on("newMessage", handleNewMessage);

        return () => {
            socket?.off("taskUpdated", handleTaskUpdated);
            socket?.off("taskDeleted", handleTaskDeleted);
            socket?.off("newMessage", handleNewMessage);
            socketService.leaveProject(routeParam);
        };
    }, [routeParam]);

    const filteredTasks = tasks.filter((t) => {
        const statusMatch = statusFilter === "all" || t.columnId === statusFilter;
        const priorityMatch = priorityFilter === "all" || t.priority === priorityFilter;
        return statusMatch && priorityMatch;
    });

    const doneColumnId = board?.columns.find(c => c.name.toLowerCase() === 'done')?.id;
    const tasksDone = tasks.filter((t) => t.columnId === doneColumnId).length;
    const tasksTotal = tasks.length;
    const progress = tasksTotal === 0 ? (project?.progress ?? 0) : Math.round((tasksDone / tasksTotal) * 100);

    /* Task modal (create / edit) */
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"create" | "edit">("create");
    const [modalTask, setModalTask] = useState<Task | null>(null);
    const [modalDefaultColumnId, setModalDefaultColumnId] = useState<string | null>(null);
    const [modalDefaultSwimlaneId, setModalDefaultSwimlaneId] = useState<string | null>(null);

    const openCreateModal = (columnId?: string, swimlaneId?: string) => {
        setModalMode("create");
        setModalTask(null);
        setModalDefaultColumnId(columnId || board?.columns[0]?.id || null);
        setModalDefaultSwimlaneId(swimlaneId || null);
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
                columnId: task.columnId || undefined,
                swimlaneId: task.swimlaneId || undefined,
                priority: task.priority,
                due: task.due,
                assignee: task.assignee,
                assigneeId: task.assigneeId,
                labelIds: task.labels?.map((l) => l.id),
                members,
            })
                .then((created) => {
                    setTasks((prev) => {
                        const exists = prev.some((t) => t.id === created.id);
                        return exists ? prev.map((t) => (t.id === created.id ? created : t)) : [...prev, created];
                    });
                })
                .catch((err) => console.error("Failed to create task:", err));
        } else {
            // PATCH: update — optimistic first, then sync with DB response
            setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
            updateTaskApi(task.id, {
                title: task.title,
                description: task.description,
                columnId: task.columnId || undefined,
                swimlaneId: task.swimlaneId || undefined,
                priority: task.priority,
                due: task.due,
                assignee: task.assignee,
                assigneeId: task.assigneeId,
                labelIds: task.labels?.map((l) => l.id),
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
        const doneColId = board?.columns.find(c => c.name.toLowerCase() === 'done')?.id;
        return {
            assignedTasks,
            assigned: assignedTasks.length,
            completed: assignedTasks.filter((t) => t.columnId === doneColId).length,
            remaining: assignedTasks.filter((t) => t.columnId !== doneColId).length,
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

    const handleUpdateDocument = (id: string, newContent: string) => {
        updateDocumentApi(id, { content: newContent })
            .then((updatedDoc) => {
                setDocuments((prev) => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
                if (detailDoc?.id === updatedDoc.id) {
                    setDetailDoc(updatedDoc);
                }
            })
            .catch((err) => {
                console.error("Failed to update document:", err);
            });
    };



    /* =========================
       CHAT TAB
    ========================= */
    const handleSendMessage = (text: string) => {
        const senderInitialsToUse = userInitials || "US";
        sendChatMessageApi(routeParam, text, senderInitialsToUse)
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
                    <WorkspaceSelector />
                    <div className="nav-title">NAVIGATION</div>
                    <nav>
                        <Link to="/overview">Overview</Link>
                        <Link to="/projects" className="selected">Projects</Link>
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
                    <WorkspaceSelector />
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

            <AppSidebar activePage="projects" projectsCount={members.length} />

            <main className="projects-main">

                <header className="topbar">

                    <div className="topbar-left">
                        <button
                            type="button"
                            className="hamburger-btn"
                            onClick={toggleSidebar}
                            title={isOpen ? "Toggle / Float Sidebar" : "Open Sidebar"}
                            aria-label="Toggle navigation sidebar"
                        >
                            <svg 
                                width="18" 
                                height="18" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                            >
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        </button>

                        <div className="breadcrumb">
                            <Link to="/projects" style={{ color: "inherit", textDecoration: "none" }}>Workspace</Link>
                            <span style={{ margin: "0 6px" }}>/</span>
                            <Link to="/projects" style={{ color: "inherit", textDecoration: "none" }}>Projects</Link>
                            <span style={{ margin: "0 6px" }}>/</span>
                            <strong>{project.name}</strong>
                        </div>
                    </div>

                    <div className="topbar-actions">
                        <div className="search">
                            <span>⌕</span>
                            <input placeholder="Search anything..." />
                            <kbd>⌘ K</kbd>
                        </div>

                        <NotificationCenter workspaceId={project?.workspaceId || activeWorkspace?.id} />

                        <div className="profile-avatar" title={userFullName}>{userInitials}</div>
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

                                    {project.code && (
                                        <span
                                            style={{
                                                fontFamily: "monospace",
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                                background: "#232a3d",
                                                color: "#f8fafc",
                                                padding: "2px 8px",
                                                borderRadius: "4px",
                                                letterSpacing: "0.05em",
                                                marginLeft: "8px",
                                            }}
                                            title="Project Code"
                                        >
                                            {project.code}
                                        </span>
                                    )}

                                    <div
                                        className={`status ${project.status === "COMPLETED" ? "completed" : project.status === "ARCHIVED" ? "archived" : "active"}`}
                                    >
                                        <span />
                                        {project.status}
                                    </div>

                                    <button
                                        type="button"
                                        className="settings-trigger-btn"
                                        onClick={() => setIsSettingsOpen(true)}
                                        style={{
                                            background: "#ffffff",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "6px",
                                            padding: "4px 10px",
                                            fontSize: "0.8rem",
                                            fontWeight: 500,
                                            color: "#475569",
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "5px",
                                            marginLeft: "12px",
                                            transition: "all 0.12s ease",
                                        }}
                                        title="Project Settings & Lifecycle"
                                    >
                                        <span>⚙️</span> Settings
                                    </button>
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
                                    {project.date && <span>🕒 {project.date}</span>}
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
                                onClick={() => {
                                    if (tab === "Settings") {
                                        setIsSettingsOpen(true);
                                    } else {
                                        setActiveTab(tab);
                                    }
                                }}
                            >
                                {tab === "Settings" && <span style={{ marginRight: "4px" }}>⚙️</span>}
                                {tab}
                                {tab === "Tasks" && <span className="tab-count">{tasksTotal}</span>}
                                {tab === "Board" && <span className="tab-count">{tasksTotal}</span>}
                                {tab === "Members" && <span className="tab-count">{members.length}</span>}
                                {tab === "Documents" && (
                                    <span className="tab-count">{documents.length}</span>
                                )}
                                {tab === "Files" && null}
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
                                        {tasks.length === 0 ? (
                                            <div style={{ color: "#64748b", fontSize: "13px", padding: "12px 0" }}>
                                                No active tasks.
                                            </div>
                                        ) : (
                                            tasks.slice(0, 4).map((t) => (
                                                <div
                                                    className={`task-row ${t.columnId === doneColumnId ? "done" : ""} clickable`}
                                                    key={t.id}
                                                    onClick={() => openEditModal(t)}
                                                >
                                                    <div className={`task-check ${t.columnId === doneColumnId ? "checked" : ""}`}>
                                                        {t.columnId === doneColumnId ? "✓" : ""}
                                                    </div>

                                                    <div className="task-body">
                                                        <div className="task-title-row">
                                                            <span className="task-title">{t.title}</span>
                                                            <span className={`priority-tag ${t.priority ? t.priority.toLowerCase() : "medium"}`}>
                                                                {t.priority}
                                                            </span>
                                                        </div>

                                                        <div className="task-meta">
                                                            <span className="status-badge">{board?.columns.find(c => c.id === t.columnId)?.name || "Unknown"}</span>
                                                            <span className="meta-sep">·</span>
                                                            <span>Due {t.due}</span>
                                                            <span className="meta-sep">·</span>
                                                            <span>{memberName(t.assignee)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
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
                                        {auditLogs.length === 0 ? (
                                            <div style={{ color: "#64748b", fontSize: "13px", padding: "8px 0" }}>
                                                No activity yet.
                                            </div>
                                        ) : (
                                            auditLogs.slice(0, 5).map((log, i) => {
                                                const actor = log.user ? `${log.user.firstName} ${log.user.lastName}` : "System";
                                                const label = log.action
                                                    .replace(/_/g, " ")
                                                    .toLowerCase()
                                                    .replace(/\b\w/g, (c) => c.toUpperCase());
                                                const when = new Date(log.createdAt);
                                                const timeStr = when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                                                return (
                                                    <div className="activity-row" key={log.id || i}>
                                                        <div className="activity-bullet" />
                                                        <div className="activity-body">
                                                            <p>
                                                                <strong>{actor}</strong> {label.toLowerCase()}{" "}
                                                                {log.details?.name || log.details?.title || log.entityType?.toLowerCase()}
                                                            </p>
                                                            <span>{timeStr}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
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
                                    <h2>Tasks <span className="tab-count">{filteredTasks.length}</span></h2>
                                    <p>Structured view of all work items in this project.</p>
                                </div>

                                <div className="pane-actions">
                                    <div className="tw-search-box">
                                        <Search size={14} color="#9a968a" />
                                        <input
                                            placeholder="Search tasks..."
                                            value={taskSearch}
                                            onChange={(e) => setTaskSearch(e.target.value)}
                                        />
                                    </div>

                                    <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                        <option value="all">All statuses</option>
                                        {board?.columns.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>

                                    <select className="filter-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as any)}>
                                        {PRIORITY_FILTERS.map((f) => (
                                            <option key={f.key} value={f.key}>{f.label}</option>
                                        ))}
                                    </select>

                                    <button className="cs-btn cs-btn-primary" onClick={() => openCreateModal(board?.columns[0]?.id)}>
                                        <Plus size={14} style={{ marginRight: 4 }} />
                                        New Task
                                    </button>
                                </div>
                            </div>

                            {/* Group tasks by column */}
                            {filteredTasks.filter(t => !taskSearch || t.title.toLowerCase().includes(taskSearch.toLowerCase()) || (t.description || "").toLowerCase().includes(taskSearch.toLowerCase())).length === 0 ? (
                                <div className="tw-empty-state">
                                    <CheckSquare2 size={40} color="#c9c4b4" />
                                    <h3>No tasks found</h3>
                                    <p>Try adjusting your filters or create a new task.</p>
                                    <button className="cs-btn cs-btn-primary" onClick={() => openCreateModal(board?.columns[0]?.id)} style={{ marginTop: 12 }}>
                                        <Plus size={14} style={{ marginRight: 4 }} /> Create First Task
                                    </button>
                                </div>
                            ) : (
                                <div className="tw-task-table">
                                    {/* Table Header */}
                                    <div className="tw-task-header">
                                        <span></span>
                                        <span>Task</span>
                                        <span>Status</span>
                                        <span>Priority</span>
                                        <span>Assignee</span>
                                        <span>Due Date</span>
                                    </div>

                                    {filteredTasks
                                        .filter(t => !taskSearch || t.title.toLowerCase().includes(taskSearch.toLowerCase()) || (t.description || "").toLowerCase().includes(taskSearch.toLowerCase()))
                                        .map((t) => {
                                            const isDone = t.columnId === doneColumnId;
                                            const colName = board?.columns.find(c => c.id === t.columnId)?.name || "Unknown";
                                            const assigneeMember = members.find(m => m.initials === t.assignee);
                                            const isOverdue = t.due && !isDone && new Date(t.due) < new Date();
                                            return (
                                                <div
                                                    className={`tw-task-row ${isDone ? "tw-done" : ""}`}
                                                    key={t.id}
                                                    onClick={() => openEditModal(t)}
                                                >
                                                    <div className={`tw-task-check ${isDone ? "checked" : ""}`}>
                                                        {isDone ? "✓" : ""}
                                                    </div>

                                                    <div className="tw-task-main">
                                                        <span className="tw-task-title">{t.title}</span>
                                                        {t.description && (
                                                            <span className="tw-task-desc">{t.description}</span>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <span className={`tw-status-badge tw-status-${colName.toLowerCase().replace(/\s+/g, "-")}`}>
                                                            {colName}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <span className={`priority-tag ${t.priority?.toLowerCase() || "medium"}`}>
                                                            {t.priority}
                                                        </span>
                                                    </div>

                                                    <div className="tw-assignee">
                                                        <div className="tw-avatar" title={assigneeMember?.name || t.assignee}>
                                                            {t.assignee || "?"}
                                                        </div>
                                                        <span>{assigneeMember?.name?.split(" ")[0] || t.assignee}</span>
                                                    </div>

                                                    <div className={`tw-due-date ${isOverdue ? "overdue" : ""}`}>
                                                        <Calendar size={12} />
                                                        <span>{t.due || "—"}</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            )}
                        </div>
                    )}

                    {/* BOARD TAB (DYNAMIC KANBAN VIEW) */}
                    {activeTab === "Board" && (
                        <div className="tab-pane" style={{ padding: 0 }}>
                            <KanbanBoard
                                projectId={routeParam}
                                tasks={tasks}
                                members={members}
                                onTaskClick={openEditModal}
                                onQuickCreateTask={(colId, swimlaneId) => openCreateModal(colId, swimlaneId)}
                                onTasksChange={(updatedTasks) => setTasks(updatedTasks)}
                            />
                        </div>
                    )}

                    {/* MEMBERS TAB */}
                    {activeTab === "Members" && (
                        <div className="tab-pane">
                            <div className="pane-toolbar">
                                <div className="pane-title">
                                    <h2>Team Members <span className="tab-count">{members.length}</span></h2>
                                    <p>People with access to this project workspace.</p>
                                </div>

                                <div className="pane-actions">
                                    <div className="tw-search-box">
                                        <Search size={14} color="#9a968a" />
                                        <input
                                            placeholder="Search members..."
                                            value={memberSearch}
                                            onChange={(e) => setMemberSearch(e.target.value)}
                                        />
                                    </div>
                                    <button className="cs-btn cs-btn-primary" onClick={() => setAddMemberOpen(true)}>
                                        <Plus size={14} style={{ marginRight: 4 }} />
                                        Add Member
                                    </button>
                                </div>
                            </div>

                            {memberError && (
                                <div className="tw-error-banner">
                                    <AlertCircle size={15} />
                                    <span>{memberError}</span>
                                </div>
                            )}

                            {members.filter(m => !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase()) || m.email?.toLowerCase().includes(memberSearch.toLowerCase())).length === 0 ? (
                                <div className="tw-empty-state">
                                    <Users size={40} color="#9a968a" />
                                    <h3>No members found</h3>
                                    <p>{memberSearch ? "Try a different search term." : "Add your first team member to get started."}</p>
                                    <button className="cs-btn cs-btn-primary" onClick={() => setAddMemberOpen(true)} style={{ marginTop: 12 }}>
                                        <Plus size={14} style={{ marginRight: 4 }} /> Add Member
                                    </button>
                                </div>
                            ) : (
                                <div className="tw-members-grid">
                                    {members
                                        .filter(m => !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase()) || m.email?.toLowerCase().includes(memberSearch.toLowerCase()))
                                        .map((m) => {
                                            const stats = memberStats(m);
                                            const workloadPct = stats.assigned === 0 ? 0 : Math.round((stats.completed / stats.assigned) * 100);
                                            return (
                                                <div
                                                    className="tw-member-card"
                                                    key={m.initials}
                                                    onClick={() => setDetailMember(m)}
                                                >
                                                    <div className="tw-member-card-top">
                                                        <div className="tw-member-avatar">{m.initials}</div>
                                                        <div className="tw-member-info">
                                                            <strong>{m.name}</strong>
                                                            <span className="tw-member-role-badge">{m.role}</span>
                                                        </div>
                                                        <ChevronRight size={15} color="#9a968a" style={{ marginLeft: "auto", flexShrink: 0 }} />
                                                    </div>

                                                    {m.email && (
                                                        <div className="tw-member-email">{m.email}</div>
                                                    )}

                                                    <div className="tw-member-stats">
                                                        <div className="tw-stat">
                                                            <strong>{stats.assigned}</strong>
                                                            <span>Assigned</span>
                                                        </div>
                                                        <div className="tw-stat">
                                                            <strong>{stats.completed}</strong>
                                                            <span>Done</span>
                                                        </div>
                                                        <div className="tw-stat">
                                                            <strong>{stats.remaining}</strong>
                                                            <span>Active</span>
                                                        </div>
                                                    </div>

                                                    {stats.assigned > 0 && (
                                                        <div className="tw-workload-bar">
                                                            <div className="tw-workload-fill" style={{ width: `${workloadPct}%` }} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            )}
                        </div>
                    )}

                    {/* DOCUMENTS TAB */}
                    {activeTab === "Documents" && (
                        <div className="tab-pane">
                            <div className="pane-toolbar">
                                <div className="pane-title">
                                    <h2>Documents <span className="tab-count">{filteredDocs.length}</span></h2>
                                    <p>Specifications, notes, and requirements for this workspace.</p>
                                </div>

                                <div className="pane-actions">
                                    <div className="tw-search-box">
                                        <Search size={14} color="#9a968a" />
                                        <input
                                            placeholder="Search documents..."
                                            value={docSearch}
                                            onChange={(e) => setDocSearch(e.target.value)}
                                        />
                                    </div>

                                    <select className="filter-select" value={docFilter} onChange={(e) => setDocFilter(e.target.value as any)}>
                                        {DOC_TYPE_FILTERS.map((f) => (
                                            <option key={f.key} value={f.key}>{f.label}</option>
                                        ))}
                                    </select>

                                    <button className="cs-btn cs-btn-primary" onClick={() => setAddDocOpen(true)}>
                                        <Plus size={14} style={{ marginRight: 4 }} />
                                        New Document
                                    </button>
                                </div>
                            </div>

                            {filteredDocs.length === 0 ? (
                                <div className="tw-empty-state">
                                    <FileText size={40} color="#9a968a" />
                                    <h3>No documents yet</h3>
                                    <p>Create your first specification, note, or requirement document.</p>
                                    <button className="cs-btn cs-btn-primary" onClick={() => setAddDocOpen(true)} style={{ marginTop: 12 }}>
                                        <Plus size={14} style={{ marginRight: 4 }} /> Create Document
                                    </button>
                                </div>
                            ) : (
                                <div className="tw-docs-grid">
                                    {filteredDocs.map((d) => (
                                        <div
                                            className="tw-doc-card"
                                            key={d.id}
                                            onClick={() => navigate(`/documents/${d.id}`)}
                                        >
                                            <div className="tw-doc-icon">
                                                <span>
                                                    {d.type}
                                                </span>
                                            </div>
                                            <div className="tw-doc-body">
                                                <h4>{d.name}</h4>
                                                <p>{d.description || "No description provided."}</p>
                                            </div>
                                            <div className="tw-doc-meta">
                                                <span>
                                                    <User size={11} /> {d.owner}
                                                </span>
                                                <span>Updated {new Date(d.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* FILES TAB */}
                    {activeTab === "Files" && (
                        <div className="tab-pane" style={{ height: "calc(100vh - 180px)", padding: 0 }}>
                            <FileBrowser projectId={project.id} />
                        </div>
                    )}

                    {/* CHAT TAB */}
                    {activeTab === "Chat" && (
                        <div className="tab-pane">
                            <ProjectChat
                                projectId={project.id}
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
                                    <p>Full audit trail of changes across this project and workspace.</p>
                                </div>
                                <button
                                    className="cs-btn cs-btn-secondary"
                                    onClick={() => {
                                        if (!activeWorkspace?.id) return;
                                        setAuditLoading(true);
                                        fetch(`/api/audit-logs?workspaceId=${activeWorkspace.id}&limit=50`, { credentials: "include" })
                                            .then(r => r.json())
                                            .then(res => { if (res.success) setAuditLogs(res.data || []); })
                                            .catch(console.error)
                                            .finally(() => setAuditLoading(false));
                                    }}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                                >
                                    {auditLoading ? <Loader2 size={13} className="tw-spin" /> : <Activity size={13} />}
                                    Refresh
                                </button>
                            </div>

                            {auditLoading && auditLogs.length === 0 ? (
                                <div className="tw-empty-state">
                                    <Loader2 size={32} color="#9a968a" className="tw-spin" />
                                    <p style={{ marginTop: 8 }}>Loading activity...</p>
                                </div>
                            ) : auditLogs.length === 0 ? (
                                <div className="tw-empty-state">
                                    <Activity size={40} color="#9a968a" />
                                    <h3>No activity yet</h3>
                                    <p>Actions like task creation, member changes, and file uploads will appear here.</p>
                                    <button
                                        className="cs-btn cs-btn-secondary"
                                        style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                                        onClick={() => {
                                            if (!activeWorkspace?.id) return;
                                            setAuditLoading(true);
                                            fetch(`/api/audit-logs?workspaceId=${activeWorkspace.id}&limit=50`, { credentials: "include" })
                                                .then(r => r.json())
                                                .then(res => { if (res.success) setAuditLogs(res.data || []); })
                                                .catch(console.error)
                                                .finally(() => setAuditLoading(false));
                                        }}
                                    >
                                        <Activity size={13} /> Load Activity
                                    </button>
                                </div>
                            ) : (
                                <div className="tw-timeline">
                                    {auditLogs.map((log, i) => {
                                        const actorName = log.user ? `${log.user.firstName} ${log.user.lastName}` : "System";
                                        const when = new Date(log.createdAt);
                                        const timeStr = when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                                        const dateStr = when.toLocaleDateString([], { month: "short", day: "numeric" });
                                        const isToday = new Date().toDateString() === when.toDateString();

                                        const label = log.action
                                            .replace(/_/g, " ")
                                            .toLowerCase()
                                            .replace(/\b\w/g, c => c.toUpperCase());

                                        return (
                                            <div className="tw-timeline-item" key={log.id || i}>
                                                <div className="tw-timeline-left">
                                                    <div className="tw-timeline-dot" />
                                                    {i < auditLogs.length - 1 && <div className="tw-timeline-line" />}
                                                </div>
                                                <div className="tw-timeline-body">
                                                    <div className="tw-timeline-header">
                                                        <div className="tw-mini-avatar">
                                                            {actorName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <strong>{actorName}</strong>
                                                            <span className="tw-action-label">{label}</span>
                                                        </div>
                                                    </div>
                                                    {log.details && (
                                                        <div className="tw-timeline-details">
                                                            {log.details.name && <span>📄 {log.details.name}</span>}
                                                            {log.details.title && <span>📋 {log.details.title}</span>}
                                                        </div>
                                                    )}
                                                    <div className="tw-timeline-time">
                                                        <span className="tw-entity-chip">{log.entityType}</span>
                                                        <span>{isToday ? `Today at ${timeStr}` : `${dateStr} at ${timeStr}`}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                </section>

            </main>

            {/* MODALS */}
            {modalOpen && (
                <TaskModal
                    mode={modalMode}
                    task={modalTask}
                    defaultColumnId={modalDefaultColumnId}
                    defaultSwimlaneId={modalDefaultSwimlaneId}
                    columns={board?.columns || []}
                    swimlanes={board?.swimlanes || []}
                    members={members}
                    projectId={routeParam}
                    onClose={closeModal}
                    onSave={saveTask}
                    onDelete={deleteTask}
                />
            )}

            {addMemberOpen && (
                <AddMemberModal
                    onClose={() => { setAddMemberOpen(false); setMemberError(null); }}
                    onSave={handleAddMemberSave}
                    error={memberError}
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
                    onSave={handleUpdateDocument}
                />
            )}


            {isSettingsOpen && project && (
                <ProjectSettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    project={project}
                    onProjectUpdated={(updated) => {
                        setProject(updated);
                    }}
                    onProjectDeleted={() => {
                        navigate("/projects");
                    }}
                />
            )}

        </div>
    );
}