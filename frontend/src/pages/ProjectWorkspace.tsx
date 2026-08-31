import { useEffect, useState, type DragEvent } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import "./Projects.css";
import "./ProjectWorkspace.css";
import TaskModal from "./TaskModal";
import { MemberDetailModal, AddMemberModal } from "./MemberModal";
import { DocumentDetailModal, AddDocumentModal } from "./DocumentModal";
import { FileBrowser } from "../components/FileBrowser";
import { ProjectSettingsModal } from "./ProjectSettingsModal";
import ProjectChat, { type ChatMessage } from "./ProjectChat";
import { fetchProjectById, createTaskApi, updateTaskApi, updateTaskColumnApi, deleteTaskApi, addMemberApi, fetchDocuments, createDocumentApi, fetchChatMessages, sendChatMessageApi, updateDocumentApi, mapApiTaskToFrontend, mapApiChatMessageToFrontend, fetchBoards } from "../services/projectApi";
import type { TaskPriority, Task, Member, MappedProject as Project, Board } from "../services/projectApi";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useSidebar } from "../context/SidebarContext";
import { AppSidebar } from "../components/AppSidebar";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import { socketService } from "../services/socket";
import NotificationCenter from "../components/NotificationCenter";

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







const activity: { text: string; time: string }[] = [];

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

    /* Drag and drop */
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

    const handleDrop = (columnId: string, e: DragEvent) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("text/plain") || draggingId;
        if (taskId) {
            // Optimistic update
            setTasks((prev) =>
                prev.map((t) => (t.id === taskId ? { ...t, columnId } : t))
            );
            // Persist to backend
            updateTaskColumnApi(taskId, columnId).then((updated) => {
                setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            }).catch((err) => {
                console.error("Failed to update task column:", err);
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
    const [modalDefaultColumnId, setModalDefaultColumnId] = useState<string | null>(null);

    const openCreateModal = (columnId?: string) => {
        setModalMode("create");
        setModalTask(null);
        setModalDefaultColumnId(columnId || board?.columns[0]?.id || null);
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
                priority: task.priority,
                due: task.due,
                assignee: task.assignee,
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
                                        {activity.length === 0 ? (
                                            <div style={{ color: "#64748b", fontSize: "13px", padding: "8px 0" }}>
                                                No activity yet.
                                            </div>
                                        ) : (
                                            activity.map((a, i) => (
                                                <div className="activity-row" key={i}>
                                                    <div className="activity-bullet" />
                                                    <div className="activity-body">
                                                        <p>{a.text}</p>
                                                        <span>{a.time}</span>
                                                    </div>
                                                </div>
                                            ))
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
                                            <option value="all">All</option>
                                            {board?.columns.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name}
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

                                                {t.description && (
                                                    <p className="task-desc">{t.description}</p>
                                                )}

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
                                                {board?.columns.map((col) => {
                                                    const colTasks = tasks.filter((t) => t.columnId === col.id);
                                                    const isTarget = dragOverColumn === col.id;

                                    return (
                                        <div
                                            key={col.id}
                                            className={`board-column ${isTarget ? "drag-over" : ""}`}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                setDragOverColumn(col.id);
                                            }}
                                            onDragLeave={() => setDragOverColumn(null)}
                                            onDrop={(e) => handleDrop(col.id, e)}
                                        >
                                            <div className="column-header">
                                                <div className="column-title">
                                                    <span className="column-dot" />
                                                    <strong>{col.name}</strong>
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
                                                    onClick={() => openCreateModal(col.id)}
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
                        <div className="tab-pane" style={{ height: "calc(100vh - 180px)", padding: 0 }}>
                            <FileBrowser projectId={project.id} />
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
                                {activity.length === 0 ? (
                                    <div className="empty-state" style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                                        <p style={{ margin: 0, fontSize: "14px", fontWeight: 500 }}>No activity yet</p>
                                        <p style={{ margin: "4px 0 0", fontSize: "12.5px" }}>Updates and changes across this project will appear here.</p>
                                    </div>
                                ) : (
                                    activity.map((a, i) => (
                                        <div className="activity-row" key={i}>
                                            <div className="activity-bullet" />
                                            <div className="activity-body">
                                                <p>{a.text}</p>
                                                <span>{a.time}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
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
                    defaultColumnId={modalDefaultColumnId}
                    columns={board?.columns || []}
                    members={members}
                    projectId={id || ""}
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