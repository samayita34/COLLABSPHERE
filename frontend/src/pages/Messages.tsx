import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchWorkspaceMessages, type WorkspaceMessage } from "../services/workspaceApi";
import { socketService } from "../services/socket";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import "./Projects.css";
import "./ProjectWorkspace.css";
import "./Messages.css";

export default function Messages() {
    const navigate = useNavigate();
    const { userFullName, userInitials, logout } = useAuth();
    const { activeWorkspace } = useWorkspace();

    const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedProject, setSelectedProject] = useState<string>("all");

    const joinedProjectIdsRef = useRef<string[]>([]);

    const loadMessages = () => {
        if (!activeWorkspace?.id) {
            setMessages([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        fetchWorkspaceMessages(activeWorkspace.id)
            .then((result) => {
                setMessages(result.messages);
                setError(null);

                // Clean up any previously joined project rooms
                joinedProjectIdsRef.current.forEach((pId) => {
                    socketService.leaveProject(pId);
                });

                // Join socket rooms for all accessible projects in the new workspace
                joinedProjectIdsRef.current = result.accessibleProjectIds;
                result.accessibleProjectIds.forEach((pId) => {
                    socketService.joinProject(pId);
                });
            })
            .catch((err) => {
                console.error("Error fetching workspace messages:", err);
                setError("Failed to load messages");
                setMessages([]);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        // 1. Immediately clear old messages to prevent cross-workspace message leakage
        setMessages([]);
        setSelectedProject("all");
        setSearchQuery("");

        if (!activeWorkspace?.id) {
            setLoading(false);
            return;
        }

        const socket = socketService.connect();

        const handleNewMessage = (rawMsg: any) => {
            const msgProjectId = rawMsg.projectId;
            if (!msgProjectId || !joinedProjectIdsRef.current.includes(msgProjectId)) {
                return;
            }

            const newMsg: WorkspaceMessage = {
                id: rawMsg.id,
                text: rawMsg.text,
                senderInitials: rawMsg.senderInitials || "U",
                senderName: rawMsg.senderName || undefined,
                createdAt: rawMsg.createdAt ? new Date(rawMsg.createdAt).toISOString() : (rawMsg.timestamp || new Date().toISOString()),
                updatedAt: rawMsg.updatedAt ? new Date(rawMsg.updatedAt).toISOString() : undefined,
                projectId: rawMsg.projectId,
                projectName: rawMsg.projectName || rawMsg.project?.name || "",
                projectCode: rawMsg.projectCode ?? rawMsg.project?.code ?? null,
                projectStatus: rawMsg.projectStatus || rawMsg.project?.status,
            };

            setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [newMsg, ...prev];
            });
        };

        socket?.on("newMessage", handleNewMessage);

        loadMessages();

        return () => {
            socket?.off("newMessage", handleNewMessage);
            joinedProjectIdsRef.current.forEach((pId) => {
                socketService.leaveProject(pId);
            });
            joinedProjectIdsRef.current = [];
        };
    }, [activeWorkspace?.id]);

    // Unique project options for filtering
    const projectOptions = Array.from(
        new Map(
            messages
                .filter((m) => m.projectId && m.projectName)
                .map((m) => [m.projectId, { id: m.projectId, name: m.projectName, code: m.projectCode }])
        ).values()
    );

    const filteredMessages = messages.filter((msg) => {
        const matchesProject = selectedProject === "all" || msg.projectId === selectedProject;
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
            !q ||
            msg.text.toLowerCase().includes(q) ||
            msg.senderInitials.toLowerCase().includes(q) ||
            (msg.senderName && msg.senderName.toLowerCase().includes(q)) ||
            msg.projectName.toLowerCase().includes(q) ||
            (msg.projectCode && msg.projectCode.toLowerCase().includes(q));

        return matchesProject && matchesSearch;
    });

    const getRelativeTime = (dateStr: string): string => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;

        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 30) return "just now";
        if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes} ${diffInMinutes === 1 ? "min" : "mins"} ago`;

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours} ${diffInHours === 1 ? "hour" : "hours"} ago`;

        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 30) return `${diffInDays} ${diffInDays === 1 ? "day" : "days"} ago`;

        const diffInMonths = Math.floor(diffInDays / 30);
        if (diffInMonths < 12) return `${diffInMonths} ${diffInMonths === 1 ? "month" : "months"} ago`;

        const diffInYears = Math.floor(diffInMonths / 12);
        return `${diffInYears} ${diffInYears === 1 ? "year" : "years"} ago`;
    };

    const formatTimestamp = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="projects-page">
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
                    <Link to="/my-tasks">My Tasks</Link>
                    <Link to="/documents">Documents</Link>
                    <Link to="/files">Files</Link>
                    <Link to="/messages" className="selected">
                        Messages
                        {messages.length > 0 && <span>{messages.length}</span>}
                    </Link>
                    <a href="#" onClick={(e) => { e.preventDefault(); navigate("/projects"); }}>Analytics</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); navigate("/projects"); }}>Settings</a>
                </nav>

                <div className="profile">
                    <div className="profile-avatar">{userInitials}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{userFullName}</strong>
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

            {/* MAIN CONTENT */}
            <main className="projects-main">
                <header className="topbar">
                    <div className="breadcrumb">
                        Workspace / <strong>Messages</strong>
                    </div>

                    <div className="topbar-actions">
                        <div className="search">
                            <span>⌕</span>
                            <input
                                placeholder="Search anything..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <kbd>⌘ K</kbd>
                        </div>
                        <button className="notification">♢</button>
                        <div className="profile-avatar">{userInitials}</div>
                    </div>
                </header>

                <section className="content">
                    <div className="page-heading">
                        <div>
                            <h1>Messages</h1>
                            <p>Conversations across all projects in this workspace.</p>
                        </div>
                    </div>

                    <div className="messages-container">
                        {/* TOOLBAR */}
                        <div className="messages-toolbar">
                            <div className="messages-toolbar-left">
                                <div className="messages-search-input">
                                    <span>⌕</span>
                                    <input
                                        type="text"
                                        placeholder="Search messages..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                <select
                                    className="messages-project-select"
                                    value={selectedProject}
                                    onChange={(e) => setSelectedProject(e.target.value)}
                                    title="Filter messages by project"
                                >
                                    <option value="all">All Projects</option>
                                    {projectOptions.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.code ? `[${p.code}] ${p.name}` : p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <span className="messages-count-badge">
                                Showing {filteredMessages.length} of {messages.length} messages
                            </span>
                        </div>

                        {/* CONTENT AREA */}
                        {loading ? (
                            <div className="messages-loading">Loading messages...</div>
                        ) : error ? (
                            <div className="messages-error">
                                <span>{error}</span>
                                <button className="messages-retry-btn" onClick={loadMessages}>
                                    Retry
                                </button>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="messages-empty-state">
                                <div className="messages-empty-state-icon">💬</div>
                                <h3>No messages yet</h3>
                                <p style={{ fontSize: "0.85rem", marginTop: "4px" }}>
                                    Project conversations from this workspace will appear here.
                                </p>
                            </div>
                        ) : filteredMessages.length === 0 ? (
                            <div className="messages-empty-state">
                                <div className="messages-empty-state-icon">⌕</div>
                                <h3>No messages match your search.</h3>
                                <p style={{ fontSize: "0.85rem", marginTop: "4px" }}>
                                    Try adjusting your search query or project filter.
                                </p>
                            </div>
                        ) : (
                            <div className="messages-feed">
                                {filteredMessages.map((msg) => (
                                    <div className="message-card" key={msg.id}>
                                        <div className="message-card-avatar" title={msg.senderName || msg.senderInitials}>
                                            {msg.senderInitials || "U"}
                                        </div>

                                        <div className="message-card-content">
                                            <div className="message-card-header">
                                                <div className="message-card-header-left">
                                                    <span className="message-card-sender">
                                                        {msg.senderName ? msg.senderName : msg.senderInitials}
                                                    </span>
                                                </div>

                                                <div className="message-card-time-group" title={formatTimestamp(msg.createdAt)}>
                                                    <span className="message-card-relative-time">{getRelativeTime(msg.createdAt)}</span>
                                                    <span className="message-card-exact-time">{formatTimestamp(msg.createdAt)}</span>
                                                </div>
                                            </div>

                                            <div className="message-card-text">{msg.text}</div>

                                            <div className="message-card-footer">
                                                {msg.projectId ? (
                                                    <>
                                                        <Link
                                                            to={`/projects/${msg.projectId}`}
                                                            state={{ activeTab: "Chat" }}
                                                            className="message-card-project-tag"
                                                            title={`Open ${msg.projectName} project workspace chat`}
                                                        >
                                                            📁 {msg.projectCode ? `${msg.projectCode} · ` : ""}{msg.projectName || "Project"}
                                                        </Link>

                                                        <Link
                                                            to={`/projects/${msg.projectId}`}
                                                            state={{ activeTab: "Chat" }}
                                                            className="message-card-open-link"
                                                            title={`Open ${msg.projectName} project chat`}
                                                        >
                                                            Open project →
                                                        </Link>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
