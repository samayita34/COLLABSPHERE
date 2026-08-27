import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import { fetchMyTasksApi, updateTaskSemanticStatusApi, type MyTaskItem } from "../services/projectApi";
import { NotificationCenter } from "../components/NotificationCenter";
import "./Projects.css";
import "./MyTasks.css";

const STATUS_TABS = [
    { key: "all", label: "All" },
    { key: "todo", label: "To Do" },
    { key: "progress", label: "In Progress" },
    { key: "review", label: "Review" },
    { key: "done", label: "Done" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["key"];

export default function MyTasks() {
    const navigate = useNavigate();
    const { userFullName, userInitials, logout } = useAuth();
    const { activeWorkspace } = useWorkspace();

    const [tasks, setTasks] = useState<MyTaskItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<StatusTab>("all");
    const [priorityFilter, setPriorityFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

    const loadTasks = () => {
        if (!activeWorkspace) {
            setTasks([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        fetchMyTasksApi(activeWorkspace.id)
            .then((data) => {
                setTasks(data);
            })
            .catch((err) => {
                console.error("Failed to load my tasks:", err);
                setError(err.message || "Failed to load assigned tasks");
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        loadTasks();
    }, [activeWorkspace]);

    const mapSemanticStatus = (columnName: string) => {
        const lower = columnName.toLowerCase();
        if (lower.includes("do") || lower.includes("backlog")) return "todo";
        if (lower.includes("progress")) return "progress";
        if (lower.includes("review")) return "review";
        if (lower.includes("done") || lower.includes("complete")) return "done";
        return "todo";
    };

    const handleStatusChange = async (taskId: string, newSemanticStatus: string) => {
        setUpdatingTaskId(taskId);
        
        // Optimistic update
        setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, columnName: newSemanticStatus } : t))
        );

        try {
            await updateTaskSemanticStatusApi(taskId, newSemanticStatus);
            loadTasks();
        } catch (err: any) {
            console.error("Failed to update task status:", err);
            loadTasks();
            alert(err.message || "Failed to update task status");
        } finally {
            setUpdatingTaskId(null);
        }
    };

    const handleToggleCheck = (task: MyTaskItem) => {
        const nextStatus = mapSemanticStatus(task.columnName) === "done" ? "todo" : "done";
        handleStatusChange(task.id, nextStatus);
    };

    // Filter calculations
    // Filter calculations
    const todoCount = tasks.filter((t) => mapSemanticStatus(t.columnName) === "todo").length;
    const progressCount = tasks.filter((t) => mapSemanticStatus(t.columnName) === "progress").length;
    const reviewCount = tasks.filter((t) => mapSemanticStatus(t.columnName) === "review").length;
    const doneCount = tasks.filter((t) => mapSemanticStatus(t.columnName) === "done").length;
    const overdueCount = tasks.filter((t) => t.isOverdue).length;

    const getTabCount = (tab: StatusTab) => {
        switch (tab) {
            case "todo": return todoCount;
            case "progress": return progressCount;
            case "review": return reviewCount;
            case "done": return doneCount;
            default: return tasks.length;
        }
    };

    const filteredTasks = tasks.filter((t) => {
        const matchesTab = activeTab === "all" || mapSemanticStatus(t.columnName) === activeTab;
        const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
            !q ||
            t.title.toLowerCase().includes(q) ||
            t.projectName.toLowerCase().includes(q) ||
            (t.description ?? "").toLowerCase().includes(q);

        return matchesTab && matchesPriority && matchesSearch;
    });

    return (
        <div className="my-tasks-page">

            {/* SIDEBAR */}
            <aside className="projects-sidebar">
                <div className="brand">
                    <span>Collabsphere</span>
                    <small>ENT</small>
                </div>

                <WorkspaceSelector />

                <div className="nav-title">NAVIGATION</div>

                <nav>
                    <Link to="/overview">Overview</Link>
                    <Link to="/projects">Projects</Link>
                    <Link to="/my-tasks" className="selected">
                        My Tasks
                        {tasks.length > 0 && <span>{tasks.length}</span>}
                    </Link>
                    <Link to="/documents">Documents</Link>
                    <Link to="/files">Files</Link>
                    <Link to="/messages">Messages</Link>
                    <a href="#" onClick={(e) => { e.preventDefault(); navigate("/projects"); }}>Analytics</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); navigate("/projects"); }}>Settings</a>
                </nav>

                <div className="profile">
                    <div className="profile-avatar">{userInitials}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {userFullName}
                        </strong>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Workspace Member</span>
                    </div>

                    <button
                        onClick={logout}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#ef4444",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: "4px 8px",
                            borderRadius: "4px",
                        }}
                        title="Sign out"
                    >
                        Sign out
                    </button>
                </div>
            </aside>

            {/* MAIN VIEWPORT */}
            <main className="my-tasks-main">

                {/* TOPBAR */}
                <header className="topbar">
                    <div className="breadcrumb">
                        <span>{activeWorkspace?.name || "Workspace"}</span>
                        <span> / </span>
                        <strong>My Tasks</strong>
                    </div>

                    <div className="topbar-actions">
                        <div className="search">
                            <span>⌕</span>
                            <input
                                placeholder="Search tasks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <NotificationCenter workspaceId={activeWorkspace?.id} />
                        <div className="profile-avatar">{userInitials}</div>
                    </div>
                </header>

                {/* CONTENT */}
                <section className="my-tasks-content">

                    <div className="my-tasks-header">
                        <div>
                            <h1>My Tasks</h1>
                            <p>
                                All tasks assigned to you across projects in <strong>{activeWorkspace?.name || "this workspace"}</strong>.
                            </p>
                        </div>
                    </div>

                    {/* OVERDUE BANNER */}
                    {overdueCount > 0 && (
                        <div className="my-tasks-alert-banner">
                            <span>⚠️</span>
                            <span>
                                You have <strong>{overdueCount} overdue {overdueCount === 1 ? "task" : "tasks"}</strong> requiring attention.
                            </span>
                        </div>
                    )}

                    {/* ERROR BANNER */}
                    {error && (
                        <div style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", padding: "12px 16px", borderRadius: "8px", marginBottom: "20px" }}>
                            {error}
                        </div>
                    )}

                    {/* FILTERS & CONTROLS */}
                    <div className="my-tasks-filters-bar">
                        <div className="my-tasks-tab-group">
                            {STATUS_TABS.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    className={`my-tasks-tab ${activeTab === tab.key ? "active" : ""}`}
                                    onClick={() => setActiveTab(tab.key)}
                                >
                                    <span>{tab.label}</span>
                                    <span className="my-tasks-tab-badge">{getTabCount(tab.key)}</span>
                                </button>
                            ))}
                        </div>

                        <div className="my-tasks-controls">
                            <select
                                className="my-tasks-select"
                                value={priorityFilter}
                                onChange={(e) => setPriorityFilter(e.target.value)}
                            >
                                <option value="all">All Priorities</option>
                                <option value="high">High Priority</option>
                                <option value="medium">Medium Priority</option>
                                <option value="low">Low Priority</option>
                            </select>
                        </div>
                    </div>

                    {/* LOADING STATE */}
                    {loading && tasks.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
                            Loading your assigned tasks...
                        </div>
                    ) : filteredTasks.length === 0 ? (
                        /* EMPTY STATE */
                        <div className="my-tasks-table">
                            <div className="my-tasks-empty">
                                <h3>No tasks found</h3>
                                <p>
                                    {tasks.length === 0
                                        ? "You have no tasks assigned in this workspace yet."
                                        : "No tasks match the selected filters."}
                                </p>
                            </div>
                        </div>
                    ) : (
                        /* TASKS TABLE */
                        <div className="my-tasks-table">
                            <div className="my-tasks-table-header">
                                <span />
                                <span>Task</span>
                                <span>Project</span>
                                <span>Priority</span>
                                <span>Due Date</span>
                                <span>Status</span>
                            </div>

                            <div className="my-tasks-table-body">
                                {filteredTasks.map((t) => {
                                    const isDone = mapSemanticStatus(t.columnName) === "done";
                                    const isUpdating = updatingTaskId === t.id;

                                    return (
                                        <div key={t.id} className={`my-tasks-row ${isDone ? "done" : ""}`}>
                                            <div>
                                                <button
                                                    type="button"
                                                    className={`my-tasks-status-btn ${isDone ? "done" : ""}`}
                                                    onClick={() => handleToggleCheck(t)}
                                                    disabled={isUpdating}
                                                    title={isDone ? "Mark as Incomplete" : "Mark as Done"}
                                                >
                                                    {isDone && "✓"}
                                                </button>
                                            </div>

                                            <div className="my-tasks-title-col">
                                                <p className="my-tasks-task-title" title={t.title}>
                                                    {t.title}
                                                </p>
                                                {t.description && (
                                                    <p className="my-tasks-desc-preview">{t.description}</p>
                                                )}
                                            </div>

                                            <div>
                                                <Link
                                                    to={`/projects/${t.projectId}`}
                                                    className="my-tasks-proj-tag"
                                                    title={`Open ${t.projectName}`}
                                                >
                                                    📁 {t.projectCode ? `[${t.projectCode}] ` : ""}{t.projectName}
                                                </Link>
                                            </div>

                                            <div>
                                                <span className={`my-tasks-priority-pill ${t.priority}`}>
                                                    {t.priority}
                                                </span>
                                            </div>

                                            <div className="my-tasks-due-col">
                                                <span>{t.due || "—"}</span>
                                                {t.isOverdue && (
                                                    <span className="my-tasks-overdue-tag">⚠️ Overdue</span>
                                                )}
                                            </div>

                                            <div>
                                                <select
                                                    className="my-tasks-status-select"
                                                    value={mapSemanticStatus(t.columnName)}
                                                    onChange={(e) => handleStatusChange(t.id, e.target.value)}
                                                    disabled={isUpdating}
                                                >
                                                    <option value="todo">To Do</option>
                                                    <option value="progress">In Progress</option>
                                                    <option value="review">Review</option>
                                                    <option value="done">Done</option>
                                                </select>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </section>
            </main>

        </div>
    );
}
