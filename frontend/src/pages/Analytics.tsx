import React, { useEffect, useState, useMemo } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchWorkspaceAnalyticsApi, type WorkspaceAnalyticsData } from "../services/workspaceApi";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopbar } from "../components/AppTopbar";
import {
    TrendingUp,
    TrendingDown,
    CheckCircle2,
    Users,
    FileText,
    MessageSquare,
    HardDrive,
    Sparkles,
    BarChart3,
    Printer,
    RefreshCw,
    Activity,
    Layers,
    ShieldCheck,
    AlertTriangle
} from "lucide-react";
import "./Analytics.css";

function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export const Analytics: React.FC = () => {
    const { activeWorkspace } = useWorkspace();

    const [period, setPeriod] = useState<string>("30d");
    const [data, setData] = useState<WorkspaceAnalyticsData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const loadAnalytics = (selectedPeriod: string = period) => {
        if (!activeWorkspace) {
            setData(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        fetchWorkspaceAnalyticsApi(activeWorkspace.id, selectedPeriod)
            .then((analyticsData) => {
                setData(analyticsData);
                setError(null);
            })
            .catch((err) => {
                console.error("Failed to load analytics:", err);
                setError(err.message || "Failed to load telemetry data");
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        loadAnalytics(period);
    }, [activeWorkspace, period]);

    // Derived values
    const completionPct = useMemo(() => {
        return Math.round((data?.taskCompletionRate || 0) * 100);
    }, [data]);

    const activeUsersCount = useMemo(() => {
        if (!data) return 0;
        return typeof data.activeUsers === "object" ? data.activeUsers.count : data.activeUsers;
    }, [data]);

    const activeUsersRate = useMemo(() => {
        if (!data) return 0;
        if (typeof data.activeUsers === "object") return data.activeUsers.activityRate;
        const total = data.workspaceGrowth?.totalUsers || 1;
        return Math.round((data.activeUsers / total) * 100);
    }, [data]);

    const storageUsed = data?.storageUsage?.used || 0;
    const storageQuota = data?.storageUsage?.quota || 5368709120;
    const storagePct = data?.storageUsage?.percentage ?? Math.min(100, Math.round((storageUsed / storageQuota) * 100));

    const totalChatMessages = useMemo(() => {
        if (!data) return 0;
        return typeof data.chatStatistics === "object" ? data.chatStatistics.totalMessages : data.chatStatistics;
    }, [data]);

    const periodChatMessages = useMemo(() => {
        if (!data) return 0;
        return typeof data.chatStatistics === "object" ? data.chatStatistics.messagesInPeriod : totalChatMessages;
    }, [data, totalChatMessages]);

    const totalDocsCount = useMemo(() => {
        if (!data) return 0;
        return typeof data.documentActivity === "object" ? data.documentActivity.totalDocuments : data.documentActivity;
    }, [data]);

    const docEditsCount = useMemo(() => {
        if (!data) return 0;
        return typeof data.documentActivity === "object" ? data.documentActivity.editsInPeriod : data.documentActivity;
    }, [data]);

    const maxProductivity = useMemo(() => {
        if (!data?.productivityTrends || data.productivityTrends.length === 0) return 1;
        return Math.max(...data.productivityTrends.map((t) => t.completed), 1);
    }, [data]);

    const healthScore = data?.workspaceGrowth?.healthScore ?? 85;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="analytics-page">
            <div className="analytics-layout">
                <AppSidebar activePage="analytics" />

                <main className="analytics-main">
                    <AppTopbar pageTitle="Analytics" />

                    <div className="analytics-content">
                        {/* Header & Period Switcher */}
                        <div className="analytics-header-row">
                            <div className="analytics-title-group">
                                <h1>
                                    <BarChart3 size={24} color="#3b82f6" />
                                    <span>Analytics & Telemetry</span>
                                </h1>
                                <p>
                                    Live velocity, team performance, resource utilization, and health metrics for{" "}
                                    <strong>{activeWorkspace?.name || "Workspace"}</strong>.
                                </p>
                            </div>

                            <div className="analytics-controls">
                                <div className="analytics-period-selector">
                                    <button
                                        type="button"
                                        className={`analytics-period-btn ${period === "7d" ? "active" : ""}`}
                                        onClick={() => setPeriod("7d")}
                                    >
                                        7 Days
                                    </button>
                                    <button
                                        type="button"
                                        className={`analytics-period-btn ${period === "30d" ? "active" : ""}`}
                                        onClick={() => setPeriod("30d")}
                                    >
                                        30 Days
                                    </button>
                                    <button
                                        type="button"
                                        className={`analytics-period-btn ${period === "90d" ? "active" : ""}`}
                                        onClick={() => setPeriod("90d")}
                                    >
                                        90 Days
                                    </button>
                                    <button
                                        type="button"
                                        className={`analytics-period-btn ${period === "1y" ? "active" : ""}`}
                                        onClick={() => setPeriod("1y")}
                                    >
                                        1 Year
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    className="analytics-action-btn"
                                    onClick={() => loadAnalytics(period)}
                                    disabled={loading}
                                    title="Refresh analytics data"
                                >
                                    <RefreshCw size={14} className={loading ? "gsm-spinner" : ""} />
                                    <span>{loading ? "Refreshing..." : "Refresh"}</span>
                                </button>

                                <button
                                    type="button"
                                    className="analytics-action-btn"
                                    onClick={handlePrint}
                                    title="Print telemetry report"
                                >
                                    <Printer size={14} />
                                    <span>Export Report</span>
                                </button>
                            </div>
                        </div>

                        {/* Error Alert */}
                        {error && (
                            <div
                                style={{
                                    background: "rgba(239, 68, 68, 0.12)",
                                    border: "1px solid rgba(239, 68, 68, 0.3)",
                                    color: "#fca5a5",
                                    padding: "12px 18px",
                                    borderRadius: "10px",
                                    marginBottom: "24px",
                                    fontSize: "0.875rem",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px"
                                }}
                            >
                                <AlertTriangle size={18} color="#ef4444" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* TOP 4 KPI CARDS */}
                        <div className="analytics-kpi-grid">
                            {/* 1. Task Completion Rate */}
                            <div className="analytics-kpi-card emerald">
                                <div className="analytics-kpi-header">
                                    <span className="analytics-kpi-label">Completion Rate</span>
                                    <div className="analytics-kpi-icon-wrapper">
                                        <CheckCircle2 size={18} />
                                    </div>
                                </div>
                                <div className="analytics-kpi-value-row">
                                    <span className="analytics-kpi-value">{completionPct}%</span>
                                    {data?.rateChange !== undefined && (
                                        <span
                                            className={`analytics-trend-badge ${
                                                data.rateChange > 0
                                                    ? "positive"
                                                    : data.rateChange < 0
                                                    ? "negative"
                                                    : "neutral"
                                            }`}
                                        >
                                            {data.rateChange > 0 ? (
                                                <TrendingUp size={12} />
                                            ) : data.rateChange < 0 ? (
                                                <TrendingDown size={12} />
                                            ) : null}
                                            <span>
                                                {data.rateChange > 0 ? `+${data.rateChange}%` : `${data.rateChange}%`}
                                            </span>
                                        </span>
                                    )}
                                </div>
                                <div className="analytics-kpi-subtext">
                                    {data?.taskMetrics?.completedTasks ?? 0} of {data?.workspaceGrowth?.totalTasks ?? 0}{" "}
                                    tasks completed
                                </div>
                            </div>

                            {/* 2. Active Contributors */}
                            <div className="analytics-kpi-card violet">
                                <div className="analytics-kpi-header">
                                    <span className="analytics-kpi-label">Active Users</span>
                                    <div className="analytics-kpi-icon-wrapper">
                                        <Users size={18} />
                                    </div>
                                </div>
                                <div className="analytics-kpi-value-row">
                                    <span className="analytics-kpi-value">{activeUsersCount}</span>
                                    <span className="analytics-trend-badge positive">
                                        <span>{activeUsersRate}% Active</span>
                                    </span>
                                </div>
                                <div className="analytics-kpi-subtext">
                                    Of {data?.workspaceGrowth?.totalUsers ?? 0} total workspace members
                                </div>
                            </div>

                            {/* 3. Document Activity */}
                            <div className="analytics-kpi-card blue">
                                <div className="analytics-kpi-header">
                                    <span className="analytics-kpi-label">Document Activity</span>
                                    <div className="analytics-kpi-icon-wrapper">
                                        <FileText size={18} />
                                    </div>
                                </div>
                                <div className="analytics-kpi-value-row">
                                    <span className="analytics-kpi-value">{docEditsCount}</span>
                                    <span className="analytics-trend-badge neutral">
                                        <span>{totalDocsCount} Docs</span>
                                    </span>
                                </div>
                                <div className="analytics-kpi-subtext">
                                    Edits & versions logged in {period}
                                </div>
                            </div>

                            {/* 4. Chat & Discussion Volume */}
                            <div className="analytics-kpi-card amber">
                                <div className="analytics-kpi-header">
                                    <span className="analytics-kpi-label">Chat Statistics</span>
                                    <div className="analytics-kpi-icon-wrapper">
                                        <MessageSquare size={18} />
                                    </div>
                                </div>
                                <div className="analytics-kpi-value-row">
                                    <span className="analytics-kpi-value">{periodChatMessages}</span>
                                    <span className="analytics-trend-badge positive">
                                        <span>{totalChatMessages} Total</span>
                                    </span>
                                </div>
                                <div className="analytics-kpi-subtext">
                                    Messages exchanged across channels
                                </div>
                            </div>
                        </div>

                        {/* MIDDLE ROW: PRODUCTIVITY TRENDS & TEAM PERFORMANCE */}
                        <div className="analytics-middle-grid">
                            {/* Productivity Velocity Chart */}
                            <div className="analytics-panel">
                                <div className="analytics-panel-header">
                                    <div>
                                        <h2 className="analytics-panel-title">
                                            <Activity size={18} color="#3b82f6" />
                                            <span>Productivity Trends & Velocity</span>
                                        </h2>
                                        <span className="analytics-panel-subtitle">
                                            Daily completed tasks over the selected time window
                                        </span>
                                    </div>

                                    {data?.velocitySummary && (
                                        <div style={{ textAlign: "right", fontSize: "0.775rem", color: "#8b949e" }}>
                                            <div>
                                                Velocity:{" "}
                                                <strong style={{ color: "#ffffff" }}>
                                                    {data.velocitySummary.avgCompletionVelocity} tasks/day
                                                </strong>
                                            </div>
                                            {data.velocitySummary.peakDay?.date && (
                                                <div>
                                                    Peak: {data.velocitySummary.peakDay.count} on{" "}
                                                    {data.velocitySummary.peakDay.date}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="analytics-chart-container">
                                    {data?.productivityTrends?.map((item, idx) => {
                                        const heightPct = Math.max(
                                            (item.completed / maxProductivity) * 100,
                                            item.completed > 0 ? 16 : 4
                                        );
                                        const isNonZero = item.completed > 0;

                                        return (
                                            <div
                                                key={idx}
                                                className="analytics-bar-col"
                                                title={`${item.date}: ${item.completed} completed${
                                                    item.created !== undefined ? `, ${item.created} created` : ""
                                                }`}
                                            >
                                                <div className="analytics-bar-wrapper">
                                                    <div
                                                        className="analytics-bar-fill"
                                                        style={{
                                                            height: `${heightPct}%`,
                                                            opacity: isNonZero ? 1 : 0.25
                                                        }}
                                                    />
                                                </div>

                                                {(idx === 0 ||
                                                    idx === Math.floor((data.productivityTrends.length - 1) / 2) ||
                                                    idx === data.productivityTrends.length - 1) && (
                                                    <span className="analytics-bar-label">
                                                        {new Date(item.date).toLocaleDateString(undefined, {
                                                            month: "numeric",
                                                            day: "numeric"
                                                        })}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="analytics-chart-legend">
                                    <div className="analytics-legend-item">
                                        <div
                                            className="analytics-legend-dot"
                                            style={{ background: "#3b82f6" }}
                                        />
                                        <span>Completed Tasks</span>
                                    </div>
                                    <div className="analytics-legend-item">
                                        <div
                                            className="analytics-legend-dot"
                                            style={{ background: "#6e7681" }}
                                        />
                                        <span>Base Activity</span>
                                    </div>
                                    <div style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#6e7681" }}>
                                        Total output: {data?.velocitySummary?.totalCompletedInPeriod ?? 0} tasks
                                    </div>
                                </div>
                            </div>

                            {/* Team Performance Leaderboard */}
                            <div className="analytics-panel">
                                <div className="analytics-panel-header">
                                    <div>
                                        <h2 className="analytics-panel-title">
                                            <Sparkles size={18} color="#a78bfa" />
                                            <span>Team Performance</span>
                                        </h2>
                                        <span className="analytics-panel-subtitle">
                                            Member output and task completion leaderboard
                                        </span>
                                    </div>
                                </div>

                                {!data?.teamPerformance || data.teamPerformance.length === 0 ? (
                                    <div
                                        style={{
                                            textAlign: "center",
                                            padding: "40px 10px",
                                            color: "#6e7681",
                                            fontSize: "0.875rem"
                                        }}
                                    >
                                        No tasks assigned or completed in this period.
                                    </div>
                                ) : (
                                    <div className="analytics-leaderboard-list">
                                        {data.teamPerformance.slice(0, 5).map((member, idx) => {
                                            const initials = member.name.slice(0, 2).toUpperCase();
                                            const maxScore = Math.max(
                                                ...data.teamPerformance.map((u) => u.completedTasks),
                                                1
                                            );
                                            const progressPct = Math.round((member.completedTasks / maxScore) * 100);

                                            return (
                                                <div key={member.userId || idx} className="analytics-member-card">
                                                    <div className="analytics-member-top">
                                                        <div className="analytics-member-info">
                                                            <div className="analytics-member-avatar">{initials}</div>
                                                            <div>
                                                                <div className="analytics-member-name">{member.name}</div>
                                                                <span
                                                                    style={{
                                                                        fontSize: "0.72rem",
                                                                        color: "#8b949e",
                                                                        textTransform: "capitalize"
                                                                    }}
                                                                >
                                                                    {member.role?.toLowerCase() || "Member"}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div style={{ textAlign: "right" }}>
                                                            <span className="analytics-member-score">
                                                                {member.completedTasks}{" "}
                                                                {member.completedTasks === 1 ? "task" : "tasks"}
                                                            </span>
                                                            {member.completionRate !== undefined && (
                                                                <div style={{ fontSize: "0.7rem", color: "#8b949e" }}>
                                                                    {member.completionRate}% rate
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="analytics-progress-bar-bg">
                                                        <div
                                                            className="analytics-progress-bar-val"
                                                            style={{ width: `${progressPct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* BOTTOM 3 TELEMETRY MODULES */}
                        <div className="analytics-bottom-grid">
                            {/* Storage Usage & File Type Breakdown */}
                            <div className="analytics-panel">
                                <div className="analytics-panel-header">
                                    <h2 className="analytics-panel-title">
                                        <HardDrive size={18} color="#ec4899" />
                                        <span>Storage Usage</span>
                                    </h2>
                                    <span
                                        className={`analytics-trend-badge ${
                                            storagePct > 90 ? "negative" : storagePct > 70 ? "neutral" : "positive"
                                        }`}
                                    >
                                        {storagePct > 90 ? "Critical" : storagePct > 70 ? "Warning" : "Healthy"}
                                    </span>
                                </div>

                                <div className="analytics-storage-display">
                                    <div className="analytics-storage-numbers">
                                        <div>
                                            <span style={{ fontSize: "0.75rem", color: "#8b949e" }}>UTILIZED</span>
                                            <div className="analytics-storage-used">{formatBytes(storageUsed)}</div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <span style={{ fontSize: "0.75rem", color: "#8b949e" }}>QUOTA</span>
                                            <div className="analytics-storage-quota">{formatBytes(storageQuota)}</div>
                                        </div>
                                    </div>

                                    <div className="analytics-storage-bar">
                                        <div
                                            className="analytics-storage-fill"
                                            style={{ width: `${storagePct}%` }}
                                        />
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            fontSize: "0.775rem",
                                            color: "#8b949e",
                                            marginBottom: "14px"
                                        }}
                                    >
                                        <span>{storagePct}% of storage consumed</span>
                                        <span>{formatBytes(Math.max(storageQuota - storageUsed, 0))} free</span>
                                    </div>

                                    {data?.storageUsage?.byType && (
                                        <div className="analytics-type-pills">
                                            {Object.entries(data.storageUsage.byType)
                                                .filter(([_, count]) => count > 0)
                                                .map(([type, count]) => (
                                                    <div key={type} className="analytics-type-pill">
                                                        <strong>{type}:</strong>
                                                        <span>{count}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Document Activity & Top Docs */}
                            <div className="analytics-panel">
                                <div className="analytics-panel-header">
                                    <h2 className="analytics-panel-title">
                                        <FileText size={18} color="#60a5fa" />
                                        <span>Top Document Activity</span>
                                    </h2>
                                    <span style={{ fontSize: "0.75rem", color: "#8b949e" }}>
                                        {totalDocsCount} Total
                                    </span>
                                </div>

                                {typeof data?.documentActivity === "object" &&
                                data.documentActivity.topActiveDocuments?.length ? (
                                    <div>
                                        {data.documentActivity.topActiveDocuments.map((doc) => (
                                            <div key={doc.id} className="analytics-doc-item">
                                                <div>
                                                    <div className="analytics-doc-name" title={doc.name}>
                                                        {doc.name}
                                                    </div>
                                                    <div className="analytics-doc-meta">
                                                        <span>{doc.projectName}</span> • <span>{doc.type}</span>
                                                    </div>
                                                </div>

                                                <div style={{ textAlign: "right" }}>
                                                    <span
                                                        style={{
                                                            fontSize: "0.75rem",
                                                            color: "#60a5fa",
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        v{doc.versionsCount || 1}
                                                    </span>
                                                    <div style={{ fontSize: "0.7rem", color: "#8b949e" }}>
                                                        {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                                                            month: "short",
                                                            day: "numeric"
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            textAlign: "center",
                                            padding: "36px 12px",
                                            color: "#6e7681",
                                            fontSize: "0.875rem"
                                        }}
                                    >
                                        No recent document edits in this period.
                                    </div>
                                )}
                            </div>

                            {/* Workspace Growth & Health Score */}
                            <div className="analytics-panel">
                                <div className="analytics-panel-header">
                                    <h2 className="analytics-panel-title">
                                        <Layers size={18} color="#10b981" />
                                        <span>Workspace Health & Scale</span>
                                    </h2>
                                    <span className="analytics-trend-badge positive">
                                        <ShieldCheck size={12} />
                                        <span>Active</span>
                                    </span>
                                </div>

                                <div className="analytics-health-box">
                                    <div
                                        className="analytics-health-circle"
                                        style={
                                            {
                                                "--health-deg": `${Math.round((healthScore / 100) * 360)}deg`
                                            } as React.CSSProperties
                                        }
                                    >
                                        <div className="analytics-health-inner">{healthScore}</div>
                                    </div>

                                    <div>
                                        <div style={{ fontWeight: 600, color: "#ffffff", fontSize: "0.9375rem" }}>
                                            {healthScore >= 80
                                                ? "Optimal Health"
                                                : healthScore >= 60
                                                ? "Moderate Activity"
                                                : "Action Needed"}
                                        </div>
                                        <p style={{ margin: "2px 0 0", fontSize: "0.775rem", color: "#8b949e" }}>
                                            Composite score evaluating output velocity and user participation.
                                        </p>
                                    </div>
                                </div>

                                <div className="analytics-growth-stat-row">
                                    <div className="analytics-growth-stat">
                                        <div className="analytics-growth-stat-num">
                                            {data?.workspaceGrowth?.totalUsers ?? 0}
                                        </div>
                                        <div className="analytics-growth-stat-label">Members</div>
                                    </div>

                                    <div className="analytics-growth-stat">
                                        <div className="analytics-growth-stat-num">
                                            {data?.workspaceGrowth?.totalProjects ?? 0}
                                        </div>
                                        <div className="analytics-growth-stat-label">Projects</div>
                                    </div>

                                    <div className="analytics-growth-stat">
                                        <div className="analytics-growth-stat-num">
                                            {data?.workspaceGrowth?.totalTasks ?? 0}
                                        </div>
                                        <div className="analytics-growth-stat-label">Tasks</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Analytics;
