import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
    Search,
    X,
    CheckSquare2,
    Users,
    FileText,
    MessageSquare,
    Paperclip,
    MessageCircle,
    Building,
    Loader2,
    ArrowRight,
    User
} from "lucide-react";
import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import { useWorkspace } from "../context/WorkspaceContext";
import {
    globalSearchApi,
    searchUsersApi,
    type SearchCategory,
    type SearchResponse,
    type AnySearchResultItem,
    type UserSearchResult
} from "../services/searchApi";
import { fetchProjects, type MappedProject } from "../services/projectApi";
import "./SearchPage.css";

export const SearchPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace();

    const qParam = searchParams.get("q") || "";
    const typeParam = (searchParams.get("type") as SearchCategory) || "all";
    const wsParam = searchParams.get("workspaceId") || activeWorkspace?.id || "";
    const projParam = searchParams.get("projectId") || "";
    const userParam = searchParams.get("userId") || "";
    const startParam = searchParams.get("startDate") || "";
    const endParam = searchParams.get("endDate") || "";

    const [query, setQuery] = useState(qParam);
    const [category, setCategory] = useState<SearchCategory>(typeParam);
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(wsParam);
    const [selectedProjectId, setSelectedProjectId] = useState(projParam);
    const [selectedUserId, setSelectedUserId] = useState(userParam);
    const [datePreset, setDatePreset] = useState<string>("all");
    const [startDate, setStartDate] = useState(startParam);
    const [endDate, setEndDate] = useState(endParam);

    const [projects, setProjects] = useState<MappedProject[]>([]);
    const [availableUsers, setAvailableUsers] = useState<UserSearchResult[]>([]);

    const [loading, setLoading] = useState(false);
    const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);

    // Sync state when URL params change
    useEffect(() => {
        setQuery(qParam);
        setCategory(typeParam);
        if (wsParam) setSelectedWorkspaceId(wsParam);
        setSelectedProjectId(projParam);
        setSelectedUserId(userParam);
        setStartDate(startParam);
        setEndDate(endParam);
    }, [qParam, typeParam, wsParam, projParam, userParam, startParam, endParam]);

    // Load projects and users for selected workspace
    useEffect(() => {
        const wsId = selectedWorkspaceId || activeWorkspace?.id;
        fetchProjects(wsId)
            .then((list) => setProjects(list))
            .catch(() => setProjects([]));

        searchUsersApi("", wsId)
            .then((users) => setAvailableUsers(users))
            .catch(() => setAvailableUsers([]));
    }, [selectedWorkspaceId, activeWorkspace]);

    // Compute start & end dates
    const computedDates = useMemo(() => {
        if (datePreset === "today") {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return { s: start.toISOString(), e: now.toISOString() };
        }
        if (datePreset === "7days") {
            const now = new Date();
            const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return { s: start.toISOString(), e: now.toISOString() };
        }
        if (datePreset === "30days") {
            const now = new Date();
            const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return { s: start.toISOString(), e: now.toISOString() };
        }
        if (datePreset === "custom") {
            return {
                s: startDate ? new Date(startDate).toISOString() : "",
                e: endDate ? new Date(endDate).toISOString() : ""
            };
        }
        return { s: startDate || "", e: endDate || "" };
    }, [datePreset, startDate, endDate]);

    // Execute Search
    const performSearch = useCallback(async () => {
        setLoading(true);
        try {
            const res = await globalSearchApi({
                q: query.trim(),
                type: category,
                workspaceId: selectedWorkspaceId || undefined,
                projectId: selectedProjectId || undefined,
                userId: selectedUserId || undefined,
                startDate: computedDates.s || undefined,
                endDate: computedDates.e || undefined,
                limit: 40
            });
            setSearchResponse(res);
        } catch (err) {
            console.error("Full page search error:", err);
        } finally {
            setLoading(false);
        }
    }, [query, category, selectedWorkspaceId, selectedProjectId, selectedUserId, computedDates]);

    useEffect(() => {
        const timer = setTimeout(() => {
            performSearch();
        }, 250);
        return () => clearTimeout(timer);
    }, [performSearch]);

    // Update query params in URL
    const updateUrlParams = (newQuery: string, newCat: SearchCategory) => {
        const params = new URLSearchParams();
        if (newQuery) params.set("q", newQuery);
        if (newCat !== "all") params.set("type", newCat);
        if (selectedWorkspaceId) params.set("workspaceId", selectedWorkspaceId);
        if (selectedProjectId) params.set("projectId", selectedProjectId);
        if (selectedUserId) params.set("userId", selectedUserId);
        if (computedDates.s) params.set("startDate", computedDates.s);
        if (computedDates.e) params.set("endDate", computedDates.e);
        setSearchParams(params, { replace: true });
    };

    const handleCategoryChange = (cat: SearchCategory) => {
        setCategory(cat);
        updateUrlParams(query, cat);
    };

    const handleSelectResult = (item: AnySearchResultItem) => {
        switch (item.type) {
            case "task":
                if (item.projectId) {
                    navigate(`/projects/${item.projectId}?taskId=${item.id}`);
                } else {
                    navigate(`/my-tasks`);
                }
                break;
            case "user":
                navigate(`/messages?userId=${item.id}`);
                break;
            case "document":
                if (item.projectId) {
                    navigate(`/projects/${item.projectId}/documents/${item.id}`);
                } else {
                    navigate(`/documents/${item.id}`);
                }
                break;
            case "chat":
                navigate(`/messages?channelId=${item.channelId}&messageId=${item.id}`);
                break;
            case "file":
                if (item.projectId) {
                    navigate(`/projects/${item.projectId}?tab=files&fileId=${item.id}`);
                } else {
                    navigate(`/files?fileId=${item.id}`);
                }
                break;
            case "comment":
                if (item.commentType === "task") {
                    navigate(`/projects/${item.projectId}?taskId=${item.targetId}`);
                } else {
                    navigate(`/projects/${item.projectId}/documents/${item.targetId}`);
                }
                break;
            case "workspace":
                switchWorkspace(item.id);
                navigate("/dashboard");
                break;
        }
    };

    const flatResults: AnySearchResultItem[] = useMemo(() => {
        if (!searchResponse) return [];
        const r = searchResponse.results;
        if (category === "tasks") return r.tasks;
        if (category === "users") return r.users;
        if (category === "documents") return r.documents;
        if (category === "chats") return r.chats;
        if (category === "files") return r.files;
        if (category === "comments") return r.comments;
        if (category === "workspaces") return r.workspaces;

        return [
            ...r.tasks,
            ...r.documents,
            ...r.chats,
            ...r.files,
            ...r.comments,
            ...r.users,
            ...r.workspaces
        ];
    }, [searchResponse, category]);

    const counts = searchResponse?.counts || {
        all: 0,
        tasks: 0,
        users: 0,
        documents: 0,
        chats: 0,
        files: 0,
        comments: 0,
        workspaces: 0
    };

    const allWorkspacesList = Object.values(workspaces).flat();

    return (
        <div className="search-page">
            <div className="search-page-layout">
                <AppSidebar activePage="search" />

                <main className="search-page-main">
                    <AppTopbar pageTitle="Global Search" />

                    <div className="search-page-content">
                        {/* Big Search Card */}
                        <div className="sp-search-card">
                            <div className="sp-search-bar">
                                <Search size={20} color="#3b82f6" />
                                <input
                                    className="sp-search-input"
                                    placeholder="Search anything across Tasks, Users, Documents, Chats, Files, Comments, Workspaces..."
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value);
                                        updateUrlParams(e.target.value, category);
                                    }}
                                />
                                {loading && <Loader2 size={18} className="gsm-spinner" />}
                                {query && (
                                    <button
                                        type="button"
                                        className="gsm-clear-btn"
                                        onClick={() => {
                                            setQuery("");
                                            updateUrlParams("", category);
                                        }}
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Category Filter Tabs */}
                            <div className="sp-tabs">
                                <button
                                    type="button"
                                    className={`sp-tab ${category === "all" ? "active" : ""}`}
                                    onClick={() => handleCategoryChange("all")}
                                >
                                    <span>All</span>
                                    {counts.all > 0 && <span className="sp-tab-badge">{counts.all}</span>}
                                </button>
                                <button
                                    type="button"
                                    className={`sp-tab ${category === "tasks" ? "active" : ""}`}
                                    onClick={() => handleCategoryChange("tasks")}
                                >
                                    <CheckSquare2 size={14} />
                                    <span>Tasks</span>
                                    {counts.tasks > 0 && <span className="sp-tab-badge">{counts.tasks}</span>}
                                </button>
                                <button
                                    type="button"
                                    className={`sp-tab ${category === "documents" ? "active" : ""}`}
                                    onClick={() => handleCategoryChange("documents")}
                                >
                                    <FileText size={14} />
                                    <span>Documents</span>
                                    {counts.documents > 0 && <span className="sp-tab-badge">{counts.documents}</span>}
                                </button>
                                <button
                                    type="button"
                                    className={`sp-tab ${category === "chats" ? "active" : ""}`}
                                    onClick={() => handleCategoryChange("chats")}
                                >
                                    <MessageSquare size={14} />
                                    <span>Chats</span>
                                    {counts.chats > 0 && <span className="sp-tab-badge">{counts.chats}</span>}
                                </button>
                                <button
                                    type="button"
                                    className={`sp-tab ${category === "files" ? "active" : ""}`}
                                    onClick={() => handleCategoryChange("files")}
                                >
                                    <Paperclip size={14} />
                                    <span>Files</span>
                                    {counts.files > 0 && <span className="sp-tab-badge">{counts.files}</span>}
                                </button>
                                <button
                                    type="button"
                                    className={`sp-tab ${category === "comments" ? "active" : ""}`}
                                    onClick={() => handleCategoryChange("comments")}
                                >
                                    <MessageCircle size={14} />
                                    <span>Comments</span>
                                    {counts.comments > 0 && <span className="sp-tab-badge">{counts.comments}</span>}
                                </button>
                                <button
                                    type="button"
                                    className={`sp-tab ${category === "users" ? "active" : ""}`}
                                    onClick={() => handleCategoryChange("users")}
                                >
                                    <Users size={14} />
                                    <span>Users</span>
                                    {counts.users > 0 && <span className="sp-tab-badge">{counts.users}</span>}
                                </button>
                                <button
                                    type="button"
                                    className={`sp-tab ${category === "workspaces" ? "active" : ""}`}
                                    onClick={() => handleCategoryChange("workspaces")}
                                >
                                    <Building size={14} />
                                    <span>Workspaces</span>
                                    {counts.workspaces > 0 && <span className="sp-tab-badge">{counts.workspaces}</span>}
                                </button>
                            </div>

                            {/* Additional Filters */}
                            <div className="sp-filters-row">
                                <div className="sp-filter-item">
                                    <span style={{ color: "#94a3b8" }}>Workspace:</span>
                                    <select
                                        className="sp-select"
                                        value={selectedWorkspaceId}
                                        onChange={(e) => {
                                            setSelectedWorkspaceId(e.target.value);
                                            setSelectedProjectId("");
                                        }}
                                    >
                                        <option value="">All Accessible</option>
                                        {allWorkspacesList.map((w) => (
                                            <option key={w.id} value={w.id}>
                                                {w.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sp-filter-item">
                                    <span style={{ color: "#94a3b8" }}>Project:</span>
                                    <select
                                        className="sp-select"
                                        value={selectedProjectId}
                                        onChange={(e) => setSelectedProjectId(e.target.value)}
                                    >
                                        <option value="">All Projects</option>
                                        {projects.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sp-filter-item">
                                    <span style={{ color: "#94a3b8" }}>User:</span>
                                    <select
                                        className="sp-select"
                                        value={selectedUserId}
                                        onChange={(e) => setSelectedUserId(e.target.value)}
                                    >
                                        <option value="">Anyone</option>
                                        {availableUsers.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sp-filter-item">
                                    <span style={{ color: "#94a3b8" }}>Date:</span>
                                    <select
                                        className="sp-select"
                                        value={datePreset}
                                        onChange={(e) => setDatePreset(e.target.value)}
                                    >
                                        <option value="all">Any time</option>
                                        <option value="today">Today</option>
                                        <option value="7days">Last 7 days</option>
                                        <option value="30days">Last 30 days</option>
                                        <option value="custom">Custom</option>
                                    </select>
                                </div>

                                {datePreset === "custom" && (
                                    <div className="gsm-date-inputs">
                                        <input
                                            type="date"
                                            className="gsm-date-input"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                        />
                                        <span>–</span>
                                        <input
                                            type="date"
                                            className="gsm-date-input"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Results Count Header */}
                        <div className="sp-results-header">
                            <span className="sp-results-count">
                                {flatResults.length} {flatResults.length === 1 ? "result" : "results"}{" "}
                                {query ? `for "${query}"` : ""}
                            </span>
                            <span>Sorted by most recent</span>
                        </div>

                        {/* Results Grid */}
                        <div className="sp-results-grid">
                            {flatResults.map((item) => (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    className="sp-card"
                                    onClick={() => handleSelectResult(item)}
                                >
                                    <div className={`sp-card-icon gsm-item-icon-box ${item.type}`}>
                                        {item.type === "task" && <CheckSquare2 size={20} />}
                                        {item.type === "user" && <User size={20} />}
                                        {item.type === "document" && <FileText size={20} />}
                                        {item.type === "chat" && <MessageSquare size={20} />}
                                        {item.type === "file" && <Paperclip size={20} />}
                                        {item.type === "comment" && <MessageCircle size={20} />}
                                        {item.type === "workspace" && <Building size={20} />}
                                    </div>

                                    <div className="sp-card-body">
                                        <div className="sp-card-title-row">
                                            <span className="sp-card-title">
                                                {item.type === "user" ? item.name : item.title}
                                            </span>

                                            {item.type === "task" && (
                                                <span className={`gsm-item-badge gsm-badge-priority-${item.priority}`}>
                                                    {item.priority}
                                                </span>
                                            )}

                                            {item.type === "user" && (
                                                <span className="gsm-item-badge gsm-badge-role">{item.role}</span>
                                            )}

                                            {item.type === "file" && (
                                                <span className="gsm-item-badge">{item.fileType}</span>
                                            )}
                                        </div>

                                        {item.snippet && <p className="sp-card-snippet">{item.snippet}</p>}

                                        <div className="sp-card-meta">
                                            {item.type === "task" && (
                                                <>
                                                    {item.project && <span>{item.project.name}</span>}
                                                    {item.status && <span>• {item.status}</span>}
                                                    {item.assignee && (
                                                        <span>• Assigned to {item.assignee.firstName} {item.assignee.lastName}</span>
                                                    )}
                                                </>
                                            )}

                                            {item.type === "user" && <span>{item.email}</span>}

                                            {item.type === "document" && (
                                                <>
                                                    {item.project && <span>{item.project.name}</span>}
                                                    <span>• {item.docType}</span>
                                                    {item.updatedAt && (
                                                        <span>• Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
                                                    )}
                                                </>
                                            )}

                                            {item.type === "chat" && (
                                                <>
                                                    <span>Channel: {item.channel?.name || "Chat"}</span>
                                                    <span>• Sender: {item.senderName}</span>
                                                    <span>• {new Date(item.createdAt).toLocaleString()}</span>
                                                </>
                                            )}

                                            {item.type === "file" && (
                                                <>
                                                    {item.project && <span>{item.project.name}</span>}
                                                    <span>• {item.fileType}</span>
                                                    <span>• {new Date(item.createdAt).toLocaleDateString()}</span>
                                                </>
                                            )}

                                            {item.type === "comment" && (
                                                <>
                                                    <span>By {item.authorName}</span>
                                                    {item.project && <span>• {item.project.name}</span>}
                                                    <span>• {new Date(item.createdAt).toLocaleDateString()}</span>
                                                </>
                                            )}

                                            {item.type === "workspace" && <span>/{item.slug}</span>}
                                        </div>
                                    </div>

                                    <div style={{ color: "#64748b" }}>
                                        <ArrowRight size={18} />
                                    </div>
                                </div>
                            ))}

                            {!loading && flatResults.length === 0 && (
                                <div className="gsm-empty-state">
                                    <div className="gsm-empty-title">No search results</div>
                                    <p className="gsm-empty-desc">
                                        Try adjusting your search terms or clearing your filters to see more results.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SearchPage;
