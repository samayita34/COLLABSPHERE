import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    Search,
    X,
    SlidersHorizontal,
    CheckSquare2,
    Users,
    FileText,
    MessageSquare,
    Paperclip,
    MessageCircle,
    Building,
    ArrowRight,
    Loader2,
    Clock,
    User,
    ExternalLink
} from "lucide-react";
import { useSearch } from "../context/SearchContext";
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
import "./GlobalSearchModal.css";

const RECENT_SEARCHES_KEY = "collabsphere_recent_searches";

export const GlobalSearchModal: React.FC = () => {
    const { isOpen, closeSearch, initialQuery, initialCategory, initialProjectId } = useSearch();
    const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace();
    const navigate = useNavigate();

    // Inputs & Filters
    const [query, setQuery] = useState(initialQuery || "");
    const [category, setCategory] = useState<SearchCategory>(initialCategory || "all");
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(activeWorkspace?.id || "");
    const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || "");
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [datePreset, setDatePreset] = useState<string>("all");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [showFilters, setShowFilters] = useState<boolean>(false);

    // Dynamic dropdown data
    const [projects, setProjects] = useState<MappedProject[]>([]);
    const [availableUsers, setAvailableUsers] = useState<UserSearchResult[]>([]);

    // Search state
    const [loading, setLoading] = useState<boolean>(false);
    const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

    const inputRef = useRef<HTMLInputElement>(null);

    // Sync initial state when modal opens
    useEffect(() => {
        if (isOpen) {
            setQuery(initialQuery || "");
            setCategory(initialCategory || "all");
            setSelectedProjectId(initialProjectId || "");
            if (activeWorkspace?.id && !selectedWorkspaceId) {
                setSelectedWorkspaceId(activeWorkspace.id);
            }
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);

            // Load recent searches
            try {
                const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
                if (saved) setRecentSearches(JSON.parse(saved));
            } catch (e) {
                // ignore
            }
        }
    }, [isOpen, initialQuery, initialCategory, initialProjectId, activeWorkspace]);

    // Load available projects when selected workspace changes
    useEffect(() => {
        if (!isOpen) return;
        const wsId = selectedWorkspaceId || activeWorkspace?.id;
        fetchProjects(wsId)
            .then((list) => setProjects(list))
            .catch(() => setProjects([]));

        searchUsersApi("", wsId)
            .then((users) => setAvailableUsers(users))
            .catch(() => setAvailableUsers([]));
    }, [isOpen, selectedWorkspaceId, activeWorkspace]);

    // Calculate start/end date from presets
    const computedDates = useMemo(() => {
        if (datePreset === "today") {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return { startDate: start.toISOString(), endDate: now.toISOString() };
        }
        if (datePreset === "7days") {
            const now = new Date();
            const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return { startDate: start.toISOString(), endDate: now.toISOString() };
        }
        if (datePreset === "30days") {
            const now = new Date();
            const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return { startDate: start.toISOString(), endDate: now.toISOString() };
        }
        if (datePreset === "custom") {
            return {
                startDate: startDate ? new Date(startDate).toISOString() : undefined,
                endDate: endDate ? new Date(endDate).toISOString() : undefined
            };
        }
        return { startDate: undefined, endDate: undefined };
    }, [datePreset, startDate, endDate]);

    // Debounced search trigger
    const executeSearch = useCallback(async () => {
        setLoading(true);
        try {
            const res = await globalSearchApi({
                q: query.trim(),
                type: category,
                workspaceId: selectedWorkspaceId || undefined,
                projectId: selectedProjectId || undefined,
                userId: selectedUserId || undefined,
                startDate: computedDates.startDate,
                endDate: computedDates.endDate,
                limit: 30
            });
            setSearchResponse(res);
            setHighlightedIndex(0);

            // If query is valid, add to recent searches
            if (query.trim()) {
                setRecentSearches((prev) => {
                    const updated = [query.trim(), ...prev.filter((item) => item.toLowerCase() !== query.trim().toLowerCase())].slice(0, 8);
                    try {
                        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
                    } catch (e) {
                        // ignore
                    }
                    return updated;
                });
            }
        } catch (err) {
            console.error("Search error:", err);
        } finally {
            setLoading(false);
        }
    }, [query, category, selectedWorkspaceId, selectedProjectId, selectedUserId, computedDates]);

    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            executeSearch();
        }, 220);
        return () => clearTimeout(timer);
    }, [isOpen, executeSearch]);

    // Flattened list of current results for keyboard navigation
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

        // "all" - ordered by relevance
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

    // Handle Item Click Navigation
    const handleSelectResult = (item: AnySearchResultItem) => {
        closeSearch();
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

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (flatResults[highlightedIndex]) {
                handleSelectResult(flatResults[highlightedIndex]);
            }
        }
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem(RECENT_SEARCHES_KEY);
    };

    const resetFilters = () => {
        setSelectedWorkspaceId(activeWorkspace?.id || "");
        setSelectedProjectId("");
        setSelectedUserId("");
        setDatePreset("all");
        setStartDate("");
        setEndDate("");
    };

    const hasActiveFilters = Boolean(
        (selectedWorkspaceId && selectedWorkspaceId !== activeWorkspace?.id) ||
        selectedProjectId ||
        selectedUserId ||
        datePreset !== "all" ||
        startDate ||
        endDate
    );

    // Helper to highlight matching query text in title or snippet
    const renderHighlightedText = (text: string | null | undefined) => {
        if (!text) return "";
        if (!query.trim()) return text;
        const qTrim = query.trim();
        const parts = text.split(new RegExp(`(${qTrim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
        return parts.map((part, i) =>
            part.toLowerCase() === qTrim.toLowerCase() ? (
                <mark key={i} className="gsm-highlight">
                    {part}
                </mark>
            ) : (
                part
            )
        );
    };

    if (!isOpen) return null;

    // Flatten all workspaces list
    const allWorkspacesList = Object.values(workspaces).flat();

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

    return (
        <div className="gsm-overlay" onClick={closeSearch}>
            <div className="gsm-container" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
                {/* Search Header */}
                <div className="gsm-header">
                    <div className="gsm-search-icon">
                        {loading ? <Loader2 size={20} className="gsm-spinner" /> : <Search size={20} />}
                    </div>

                    <div className="gsm-input-wrapper">
                        <input
                            ref={inputRef}
                            className="gsm-input"
                            placeholder="Search tasks, documents, chats, files, users, comments..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>

                    <div className="gsm-header-actions">
                        {query && (
                            <button
                                className="gsm-clear-btn"
                                onClick={() => {
                                    setQuery("");
                                    inputRef.current?.focus();
                                }}
                                title="Clear query"
                            >
                                <X size={16} />
                            </button>
                        )}
                        <kbd className="gsm-kbd-badge">ESC</kbd>
                    </div>
                </div>

                {/* Category Tabs & Filter Toggle */}
                <div className="gsm-tabs-bar">
                    <button
                        type="button"
                        className={`gsm-tab-pill ${category === "all" ? "active" : ""}`}
                        onClick={() => setCategory("all")}
                    >
                        <span>All</span>
                        {counts.all > 0 && <span className="gsm-tab-count">{counts.all}</span>}
                    </button>
                    <button
                        type="button"
                        className={`gsm-tab-pill ${category === "tasks" ? "active" : ""}`}
                        onClick={() => setCategory("tasks")}
                    >
                        <CheckSquare2 size={13} />
                        <span>Tasks</span>
                        {counts.tasks > 0 && <span className="gsm-tab-count">{counts.tasks}</span>}
                    </button>
                    <button
                        type="button"
                        className={`gsm-tab-pill ${category === "documents" ? "active" : ""}`}
                        onClick={() => setCategory("documents")}
                    >
                        <FileText size={13} />
                        <span>Documents</span>
                        {counts.documents > 0 && <span className="gsm-tab-count">{counts.documents}</span>}
                    </button>
                    <button
                        type="button"
                        className={`gsm-tab-pill ${category === "chats" ? "active" : ""}`}
                        onClick={() => setCategory("chats")}
                    >
                        <MessageSquare size={13} />
                        <span>Chats</span>
                        {counts.chats > 0 && <span className="gsm-tab-count">{counts.chats}</span>}
                    </button>
                    <button
                        type="button"
                        className={`gsm-tab-pill ${category === "files" ? "active" : ""}`}
                        onClick={() => setCategory("files")}
                    >
                        <Paperclip size={13} />
                        <span>Files</span>
                        {counts.files > 0 && <span className="gsm-tab-count">{counts.files}</span>}
                    </button>
                    <button
                        type="button"
                        className={`gsm-tab-pill ${category === "comments" ? "active" : ""}`}
                        onClick={() => setCategory("comments")}
                    >
                        <MessageCircle size={13} />
                        <span>Comments</span>
                        {counts.comments > 0 && <span className="gsm-tab-count">{counts.comments}</span>}
                    </button>
                    <button
                        type="button"
                        className={`gsm-tab-pill ${category === "users" ? "active" : ""}`}
                        onClick={() => setCategory("users")}
                    >
                        <Users size={13} />
                        <span>Users</span>
                        {counts.users > 0 && <span className="gsm-tab-count">{counts.users}</span>}
                    </button>
                    <button
                        type="button"
                        className={`gsm-tab-pill ${category === "workspaces" ? "active" : ""}`}
                        onClick={() => setCategory("workspaces")}
                    >
                        <Building size={13} />
                        <span>Workspaces</span>
                        {counts.workspaces > 0 && <span className="gsm-tab-count">{counts.workspaces}</span>}
                    </button>

                    <button
                        type="button"
                        className={`gsm-filter-toggle-btn ${hasActiveFilters ? "has-filters" : ""}`}
                        onClick={() => setShowFilters(!showFilters)}
                        title="Toggle filters"
                    >
                        <SlidersHorizontal size={13} />
                        <span>Filters{hasActiveFilters ? " •" : ""}</span>
                    </button>
                </div>

                {/* Filter Controls Panel */}
                {showFilters && (
                    <div className="gsm-filters-panel">
                        {/* Workspace filter */}
                        <div className="gsm-filter-group">
                            <span className="gsm-filter-label">Workspace:</span>
                            <select
                                className="gsm-filter-select"
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

                        {/* Project filter */}
                        <div className="gsm-filter-group">
                            <span className="gsm-filter-label">Project:</span>
                            <select
                                className="gsm-filter-select"
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

                        {/* User / Author filter */}
                        <div className="gsm-filter-group">
                            <span className="gsm-filter-label">User:</span>
                            <select
                                className="gsm-filter-select"
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                            >
                                <option value="">Anyone</option>
                                {availableUsers.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name} ({u.email})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date Preset */}
                        <div className="gsm-filter-group">
                            <span className="gsm-filter-label">Date:</span>
                            <select
                                className="gsm-filter-select"
                                value={datePreset}
                                onChange={(e) => setDatePreset(e.target.value)}
                            >
                                <option value="all">Any time</option>
                                <option value="today">Today</option>
                                <option value="7days">Past 7 days</option>
                                <option value="30days">Past 30 days</option>
                                <option value="custom">Custom range</option>
                            </select>
                        </div>

                        {datePreset === "custom" && (
                            <div className="gsm-date-inputs">
                                <input
                                    type="date"
                                    className="gsm-date-input"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    title="Start date"
                                />
                                <span style={{ color: "#64748b" }}>–</span>
                                <input
                                    type="date"
                                    className="gsm-date-input"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    title="End date"
                                />
                            </div>
                        )}

                        {hasActiveFilters && (
                            <button type="button" className="gsm-reset-filters-btn" onClick={resetFilters}>
                                Reset filters
                            </button>
                        )}
                    </div>
                )}

                {/* Results Body */}
                <div className="gsm-body">
                    {/* Empty Query with Recent Searches */}
                    {!query && recentSearches.length > 0 && flatResults.length === 0 && (
                        <div>
                            <div className="gsm-section-title">
                                <span>Recent Searches</span>
                                <button type="button" className="gsm-clear-recent" onClick={clearRecentSearches}>
                                    Clear
                                </button>
                            </div>
                            <div className="gsm-recent-chips">
                                {recentSearches.map((item, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className="gsm-recent-chip"
                                        onClick={() => setQuery(item)}
                                    >
                                        <Clock size={12} />
                                        <span>{item}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* No Results */}
                    {!loading && query && flatResults.length === 0 && (
                        <div className="gsm-empty-state">
                            <div className="gsm-empty-title">No results found for "{query}"</div>
                            <p className="gsm-empty-desc">
                                We couldn't find anything matching your search. Try checking for typos, searching for a
                                different keyword, or clearing applied filters.
                            </p>
                        </div>
                    )}

                    {/* Results Listing */}
                    <div className="gsm-results-group">
                        {flatResults.map((item, idx) => {
                            const isHighlighted = idx === highlightedIndex;

                            return (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    className={`gsm-item ${isHighlighted ? "highlighted" : ""}`}
                                    onClick={() => handleSelectResult(item)}
                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                >
                                    {/* Entity Icon */}
                                    <div className={`gsm-item-icon-box ${item.type}`}>
                                        {item.type === "task" && <CheckSquare2 size={18} />}
                                        {item.type === "user" && <User size={18} />}
                                        {item.type === "document" && <FileText size={18} />}
                                        {item.type === "chat" && <MessageSquare size={18} />}
                                        {item.type === "file" && <Paperclip size={18} />}
                                        {item.type === "comment" && <MessageCircle size={18} />}
                                        {item.type === "workspace" && <Building size={18} />}
                                    </div>

                                    {/* Content & Metadata */}
                                    <div className="gsm-item-content">
                                        <div className="gsm-item-header">
                                            <span className="gsm-item-title">
                                                {renderHighlightedText(
                                                    item.type === "user" ? item.name : item.title
                                                )}
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

                                        {/* Snippet / preview */}
                                        {item.snippet && (
                                            <p className="gsm-item-snippet">{renderHighlightedText(item.snippet)}</p>
                                        )}

                                        {/* Metadata Row */}
                                        <div className="gsm-item-meta">
                                            {item.type === "task" && (
                                                <>
                                                    {item.project && <span>{item.project.name}</span>}
                                                    {item.status && <span>• {item.status}</span>}
                                                    {item.assignee && (
                                                        <span>
                                                            • Assigned: {item.assignee.firstName} {item.assignee.lastName}
                                                        </span>
                                                    )}
                                                </>
                                            )}

                                            {item.type === "user" && (
                                                <>
                                                    <span>{item.email}</span>
                                                </>
                                            )}

                                            {item.type === "document" && (
                                                <>
                                                    {item.project && <span>{item.project.name}</span>}
                                                    <span>• {item.docType}</span>
                                                    {item.updatedAt && (
                                                        <span>
                                                            • {new Date(item.updatedAt).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </>
                                            )}

                                            {item.type === "chat" && (
                                                <>
                                                    <span>In: {item.channel?.name || "Chat"}</span>
                                                    <span>• By: {item.senderName}</span>
                                                    <span>• {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                                                    <span>By: {item.authorName}</span>
                                                    {item.project && <span>• {item.project.name}</span>}
                                                    <span>• {new Date(item.createdAt).toLocaleDateString()}</span>
                                                </>
                                            )}

                                            {item.type === "workspace" && (
                                                <>
                                                    <span>/{item.slug}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Arrow icon on hover */}
                                    <div style={{ color: "#64748b", alignSelf: "center" }}>
                                        <ArrowRight size={15} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Modal Footer / Shortcuts */}
                <div className="gsm-footer">
                    <div className="gsm-hints">
                        <div className="gsm-hint-item">
                            <kbd className="gsm-kbd-badge">↑</kbd>
                            <kbd className="gsm-kbd-badge">↓</kbd>
                            <span>Navigate</span>
                        </div>
                        <div className="gsm-hint-item">
                            <kbd className="gsm-kbd-badge">↵</kbd>
                            <span>Select</span>
                        </div>
                        <div className="gsm-hint-item">
                            <kbd className="gsm-kbd-badge">ESC</kbd>
                            <span>Close</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="gsm-footer-link"
                        style={{ background: "none", border: "none", cursor: "pointer" }}
                        onClick={() => {
                            closeSearch();
                            navigate(`/search?q=${encodeURIComponent(query)}&type=${category}`);
                        }}
                    >
                        <span>Open full search page</span>
                        <ExternalLink size={13} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalSearchModal;
