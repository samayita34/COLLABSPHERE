import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    fetchAuditLogs,
    type AuditLogItem,
    type AuditCategory,
    AUDIT_CATEGORIES,
    ACTION_CATEGORY_COLORS,
    getActionCategory,
    getActionLabel,
    formatRelativeTime,
} from "../services/auditApi";
import "./ActivityTimeline.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityTimelineProps {
    /** Required: workspace to scope the logs to */
    workspaceId: string;
    /** Optional: further scope to a specific project */
    projectId?: string;
    /** Display as embedded panel (no outer card shadow / full page chrome) */
    embedded?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(user?: AuditLogItem["user"]): string {
    if (!user) return "SY";
    const f = (user.firstName || "")[0] || "";
    const l = (user.lastName  || "")[0] || "";
    return (f + l).toUpperCase() || user.email.slice(0, 2).toUpperCase();
}

function getAvatarColor(str: string): string {
    const palette = [
        "#4338ca","#0891b2","#16a34a","#ca8a04","#dc2626","#7c3aed","#db2777","#0284c7",
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
}

function formatDetailsPayload(details: any, metadata: any): string | null {
    const payload = metadata || details;
    if (!payload) return null;
    if (typeof payload === "string") return payload;
    const { password, passwordHash, token, refreshToken, secret, ...safe } = payload;
    const entries = Object.entries(safe).filter(([, v]) => v !== null && v !== undefined);
    if (!entries.length) return null;
    return entries
        .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").trim()}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
        .join(" · ");
}

// ─── ActivityTimeline Component ───────────────────────────────────────────────

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
    workspaceId,
    projectId,
    embedded = false,
}) => {
    const [logs, setLogs]           = useState<AuditLogItem[]>([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState<string | null>(null);
    const [total, setTotal]         = useState(0);
    const [page, setPage]           = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Filters
    const [category, setCategory]   = useState<AuditCategory | "ALL">("ALL");
    const [search, setSearch]       = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate]     = useState("");

    // Debounced search
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [search]);

    const load = useCallback(async (p = 1) => {
        if (!workspaceId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetchAuditLogs({
                workspaceId,
                projectId,
                category: category !== "ALL" ? category : undefined,
                search: debouncedSearch || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                page: p,
                limit: 25,
            });
            if (p === 1) setLogs(res.data);
            else setLogs(prev => [...prev, ...res.data]);
            setTotal(res.pagination.total);
            setTotalPages(res.pagination.totalPages);
            setPage(p);
        } catch (err: any) {
            setError(err.message || "Failed to fetch activity logs");
        } finally {
            setLoading(false);
        }
    }, [workspaceId, projectId, category, debouncedSearch, startDate, endDate]);

    // Reload from page 1 when any filter changes
    useEffect(() => { load(1); }, [load]);

    const handleLoadMore = () => { if (page < totalPages) load(page + 1); };

    const clearFilters = () => {
        setCategory("ALL");
        setSearch("");
        setStartDate("");
        setEndDate("");
    };

    const hasFilters = category !== "ALL" || debouncedSearch || startDate || endDate;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className={`atl-root${embedded ? " atl-embedded" : ""}`}>

            {/* ── Header ──────────────────────────────────────────────── */}
            {!embedded && (
                <div className="atl-header">
                    <div>
                        <h2 className="atl-title">Activity Timeline</h2>
                        <p className="atl-subtitle">
                            Complete audit trail — logins, task updates, file uploads, role changes & more.
                        </p>
                    </div>
                    <div className="atl-total-badge">
                        {total.toLocaleString()} events
                    </div>
                </div>
            )}

            {/* ── Category Filter Chips ────────────────────────────────── */}
            <div className="atl-chips">
                <button
                    className={`atl-chip${category === "ALL" ? " atl-chip--active" : ""}`}
                    onClick={() => setCategory("ALL")}
                    data-category="ALL"
                >
                    🌐 All
                </button>
                {AUDIT_CATEGORIES.map(cat => (
                    <button
                        key={cat.key}
                        className={`atl-chip${category === cat.key ? " atl-chip--active" : ""}`}
                        style={category === cat.key ? {
                            background: ACTION_CATEGORY_COLORS[cat.key].bg,
                            color: ACTION_CATEGORY_COLORS[cat.key].text,
                            borderColor: ACTION_CATEGORY_COLORS[cat.key].border,
                        } : {}}
                        onClick={() => setCategory(category === cat.key ? "ALL" : cat.key as AuditCategory)}
                        data-category={cat.key}
                    >
                        {cat.emoji} {cat.label}
                    </button>
                ))}
            </div>

            {/* ── Search & Date Range ─────────────────────────────────── */}
            <div className="atl-filters">
                <div className="atl-search-wrap">
                    <span className="atl-search-icon">🔍</span>
                    <input
                        type="text"
                        className="atl-search"
                        placeholder="Search by entity type or ID…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        id="atl-search-input"
                    />
                    {search && (
                        <button className="atl-search-clear" onClick={() => setSearch("")} title="Clear search">✕</button>
                    )}
                </div>

                <div className="atl-date-range">
                    <label className="atl-date-label">From</label>
                    <input
                        type="date"
                        className="atl-date-input"
                        value={startDate}
                        max={endDate || undefined}
                        onChange={e => setStartDate(e.target.value)}
                        id="atl-start-date"
                    />
                    <label className="atl-date-label">To</label>
                    <input
                        type="date"
                        className="atl-date-input"
                        value={endDate}
                        min={startDate || undefined}
                        onChange={e => setEndDate(e.target.value)}
                        id="atl-end-date"
                    />
                </div>

                {hasFilters && (
                    <button className="atl-clear-btn" onClick={clearFilters} title="Clear all filters">
                        ✕ Clear filters
                    </button>
                )}

                {embedded && (
                    <div className="atl-total-badge atl-total-badge--inline">
                        {total.toLocaleString()} events
                    </div>
                )}
            </div>

            {/* ── Timeline Body ───────────────────────────────────────── */}
            <div className="atl-body">
                {loading && logs.length === 0 ? (
                    <div className="atl-empty">
                        <div className="atl-spinner" />
                        <p>Loading activity…</p>
                    </div>
                ) : error ? (
                    <div className="atl-error">
                        <span>⚠️</span>
                        <p>{error}</p>
                        <button className="atl-retry" onClick={() => load(1)}>Retry</button>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="atl-empty">
                        <div className="atl-empty-icon">📋</div>
                        <h3>No activity found</h3>
                        <p>{hasFilters ? "Try adjusting your filters." : "Actions like task creation, logins, and file uploads will appear here."}</p>
                        {hasFilters && (
                            <button className="atl-retry" onClick={clearFilters}>Clear filters</button>
                        )}
                    </div>
                ) : (
                    <div className="atl-timeline">
                        {logs.map((log, i) => {
                            const actorName = log.user
                                ? `${log.user.firstName} ${log.user.lastName}`.trim()
                                : "System";
                            const actorEmail = log.user?.email || "system@collabsphere";
                            const initials = getInitials(log.user);
                            const avatarColor = getAvatarColor(log.userId || "system");
                            const actionCat = getActionCategory(log.action);
                            const colors = ACTION_CATEGORY_COLORS[actionCat] || ACTION_CATEGORY_COLORS["ALL"];
                            const actionLabel = getActionLabel(log.action);
                            const detailStr = formatDetailsPayload(log.details, log.metadata);
                            const absTime = new Date(log.createdAt).toLocaleString(undefined, {
                                month: "short", day: "numeric", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                            });
                            const relTime = formatRelativeTime(log.createdAt);
                            const isLast = i === logs.length - 1;

                            return (
                                <div className="atl-item" key={log.id || i}>
                                    {/* ── Left rail ──────────────── */}
                                    <div className="atl-rail">
                                        <div
                                            className="atl-dot"
                                            style={{ background: colors.bg, border: `2px solid ${colors.border}` }}
                                        />
                                        {!isLast && <div className="atl-line" />}
                                    </div>

                                    {/* ── Card ───────────────────── */}
                                    <div className="atl-card">
                                        <div className="atl-card-top">
                                            {/* Actor avatar */}
                                            <div
                                                className="atl-avatar"
                                                style={{ background: avatarColor }}
                                                title={actorEmail}
                                            >
                                                {log.user?.avatar ? (
                                                    <img src={log.user.avatar} alt={initials} />
                                                ) : initials}
                                            </div>

                                            {/* Actor + Action */}
                                            <div className="atl-card-info">
                                                <div className="atl-actor-row">
                                                    <span className="atl-actor-name">{actorName}</span>
                                                    <span
                                                        className="atl-action-pill"
                                                        style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
                                                    >
                                                        {actionLabel}
                                                    </span>
                                                </div>
                                                <div className="atl-actor-sub">{actorEmail}</div>
                                            </div>

                                            {/* Timestamp */}
                                            <div className="atl-time" title={absTime}>
                                                {relTime}
                                            </div>
                                        </div>

                                        {/* Details row */}
                                        {(detailStr || log.entityType || log.entityId) && (
                                            <div className="atl-card-details">
                                                {log.entityType && (
                                                    <span className="atl-entity-chip">{log.entityType}</span>
                                                )}
                                                {log.entityId && (
                                                    <span className="atl-entity-id" title={log.entityId}>
                                                        #{log.entityId.slice(-8)}
                                                    </span>
                                                )}
                                                {detailStr && (
                                                    <span className="atl-detail-text" title={detailStr}>{detailStr}</span>
                                                )}
                                                {log.ipAddress && (
                                                    <span className="atl-ip">{log.ipAddress}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Load more */}
                        {page < totalPages && (
                            <div className="atl-load-more-wrap">
                                <button
                                    className="atl-load-more"
                                    onClick={handleLoadMore}
                                    disabled={loading}
                                    id="atl-load-more-btn"
                                >
                                    {loading ? (
                                        <><span className="atl-spinner atl-spinner--sm" /> Loading…</>
                                    ) : (
                                        `Load more · ${total - logs.length} remaining`
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityTimeline;
