import React, { useState, useEffect } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchAuditLogs, type AuditLogItem } from "../services/auditApi";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopbar } from "../components/AppTopbar";
import "./Projects.css";
import "./ActivityLog.css";

export const ActivityLog: React.FC = () => {
    const { activeWorkspace } = useWorkspace();
    const [logs, setLogs] = useState<AuditLogItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [actionFilter, setActionFilter] = useState<string>("");

    const loadAuditLogs = async () => {
        if (!activeWorkspace) {
            setLogs([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetchAuditLogs(activeWorkspace.id, actionFilter || undefined, 1, 50);
            setLogs(res.data);
        } catch (err: any) {
            setError(err.message || "Failed to fetch audit logs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAuditLogs();
    }, [activeWorkspace, actionFilter]);

    const formatDetails = (details: any, metadata: any) => {
        const payload = metadata || details;
        if (!payload) return "—";
        if (typeof payload === "string") return payload;
        
        // Exclude sensitive fields if any were present
        const { password, passwordHash, token, refreshToken, secret, ...safePayload } = payload;

        return Object.entries(safePayload)
            .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
            .join(" | ");
    };

    const getInitials = (user?: AuditLogItem["user"]) => {
        if (!user) return "SY";
        const f = (user.firstName || "")[0] || "";
        const l = (user.lastName || "")[0] || "";
        return (f + l).toUpperCase() || user.email.slice(0, 2).toUpperCase();
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hr ago`;
        if (diffDays === 1) return "Yesterday";
        return `${diffDays} days ago`;
    };

    return (
        <div className="projects-page">
            <AppSidebar activePage="activity-log" activityCount={logs.length} />

            {/* MAIN VIEWPORT */}
            <main className="projects-main">
                <AppTopbar pageTitle="Activity Log" searchPlaceholder="Search audit logs..." />

                {/* CONTENT */}
                <section className="content">
                    <div className="page-heading">
                        <div>
                            <h1>Workspace Activity & Audit Log</h1>
                            <p>Track system actions, security events, and project modifications within <strong>{activeWorkspace?.name || "your workspace"}</strong>.</p>
                        </div>

                        <select
                            className="category"
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            style={{ outline: "none", cursor: "pointer" }}
                        >
                            <option value="">All Audit Actions</option>
                            <option value="USER_LOGIN">User Login</option>
                            <option value="USER_LOGOUT">User Logout</option>
                            <option value="USER_SIGNUP">User Signup</option>
                            <option value="PROJECT_CREATED">Project Created</option>
                            <option value="PROJECT_UPDATED">Project Updated</option>
                            <option value="PROJECT_DELETED">Project Deleted</option>
                            <option value="PROJECT_ARCHIVED">Project Archived</option>
                            <option value="TASK_CREATED">Task Created</option>
                            <option value="TASK_UPDATED">Task Updated</option>
                            <option value="TASK_DELETED">Task Deleted</option>
                            <option value="TASK_ASSIGNED">Task Assigned</option>
                            <option value="TASK_STATUS_CHANGED">Task Status Changed</option>
                            <option value="DOCUMENT_CREATED">Document Created</option>
                            <option value="DOCUMENT_UPDATED">Document Updated</option>
                            <option value="DOCUMENT_DELETED">Document Deleted</option>
                            <option value="DOCUMENT_RESTORED">Document Restored</option>
                            <option value="FILE_UPLOADED">File Uploaded</option>
                            <option value="FILE_DELETED">File Deleted</option>
                            <option value="MEMBER_INVITED">Member Invited</option>
                            <option value="MEMBER_REMOVED">Member Removed</option>
                            <option value="ROLE_UPDATED">Role Updated</option>
                            <option value="WORKSPACE_CREATED">Workspace Created</option>
                            <option value="WORKSPACE_UPDATED">Workspace Updated</option>
                            <option value="WORKSPACE_MEMBER_ADDED">Workspace Member Added</option>
                            <option value="WORKSPACE_MEMBER_REMOVED">Workspace Member Removed</option>
                            <option value="MESSAGE_SENT">Message Sent</option>
                        </select>
                    </div>

                    <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", background: "#ffffff", overflow: "hidden" }}>
                        {loading ? (
                            <div style={{ textAlign: "center", padding: "60px 0", color: "#9a968a", fontSize: "14px" }}>
                                Loading workspace activity logs...
                            </div>
                        ) : error ? (
                            <div style={{ padding: "40px", color: "#b91c1c", textAlign: "center", fontSize: "14px" }}>
                                {error}
                            </div>
                        ) : logs.length === 0 ? (
                            <div style={{ padding: "60px 20px", textAlign: "center", color: "#9a968a", fontSize: "14px" }}>
                                No activity records found matching the criteria.
                            </div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                                <thead>
                                    <tr style={{ background: "#fcfbf8", borderBottom: "1px solid #e7e3d8" }}>
                                        <th style={{ padding: "12px 18px", fontFamily: "IBM Plex Mono, monospace", fontSize: "10.5px", letterSpacing: "0.08em", color: "#9a968a", textTransform: "uppercase" }}>Actor</th>
                                        <th style={{ padding: "12px 18px", fontFamily: "IBM Plex Mono, monospace", fontSize: "10.5px", letterSpacing: "0.08em", color: "#9a968a", textTransform: "uppercase" }}>Action</th>
                                        <th style={{ padding: "12px 18px", fontFamily: "IBM Plex Mono, monospace", fontSize: "10.5px", letterSpacing: "0.08em", color: "#9a968a", textTransform: "uppercase" }}>Entity</th>
                                        <th style={{ padding: "12px 18px", fontFamily: "IBM Plex Mono, monospace", fontSize: "10.5px", letterSpacing: "0.08em", color: "#9a968a", textTransform: "uppercase" }}>Details / Metadata</th>
                                        <th style={{ padding: "12px 18px", fontFamily: "IBM Plex Mono, monospace", fontSize: "10.5px", letterSpacing: "0.08em", color: "#9a968a", textTransform: "uppercase" }}>IP Address</th>
                                        <th style={{ padding: "12px 18px", fontFamily: "IBM Plex Mono, monospace", fontSize: "10.5px", letterSpacing: "0.08em", color: "#9a968a", textTransform: "uppercase" }}>Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} style={{ borderBottom: "1px solid #f0ede4" }}>
                                            <td style={{ padding: "14px 18px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                    <div className="profile-avatar" style={{ width: "26px", height: "26px", fontSize: "10px" }}>
                                                        {getInitials(log.user)}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: "13px", fontWeight: 500, color: "#14161c" }}>
                                                            {log.user ? `${log.user.firstName} ${log.user.lastName}`.trim() : "System / Automated"}
                                                        </div>
                                                        <div style={{ fontSize: "11px", color: "#9a968a" }}>
                                                            {log.user?.email || "system@collabsphere.local"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: "14px 18px" }}>
                                                <span 
                                                    style={{ 
                                                        fontFamily: "IBM Plex Mono, monospace", 
                                                        fontSize: "10.5px", 
                                                        padding: "3px 8px", 
                                                        borderRadius: "4px", 
                                                        background: "#f0ede4", 
                                                        color: "#232a3d",
                                                        border: "1px solid #e7e3d8"
                                                    }}
                                                >
                                                    {log.action.replace(/_/g, " ")}
                                                </span>
                                            </td>
                                            <td style={{ padding: "14px 18px", fontSize: "13px", fontWeight: 500, color: "#14161c" }}>
                                                {log.entityType}
                                            </td>
                                            <td style={{ padding: "14px 18px", fontSize: "12px", color: "#5a594f", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={formatDetails(log.details, log.metadata)}>
                                                {formatDetails(log.details, log.metadata)}
                                            </td>
                                            <td style={{ padding: "14px 18px", fontFamily: "IBM Plex Mono, monospace", fontSize: "11.5px", color: "#9a968a" }}>
                                                {log.ipAddress || "127.0.0.1"}
                                            </td>
                                            <td style={{ padding: "14px 18px", fontFamily: "IBM Plex Mono, monospace", fontSize: "11.5px", color: "#9a968a" }} title={new Date(log.createdAt).toLocaleString()}>
                                                {formatTime(log.createdAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default ActivityLog;
