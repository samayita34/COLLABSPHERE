import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import { useAuth } from "../context/AuthContext";
import { fetchAuditLogs, type AuditLogItem } from "../services/auditApi";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import NotificationCenter from "../components/NotificationCenter";
import "./ActivityLog.css";

export const ActivityLog: React.FC = () => {
    const { activeWorkspace } = useWorkspace();
    const { userInitials } = useAuth();
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
        <div className="activity-page">
            {/* Header Nav */}
            <header className="dashboard-header" style={{ padding: "16px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                    <Link to="/projects" className="brand-wordmark" style={{ textDecoration: "none" }}>
                        <span className="brand-collab">COLLAB</span><span className="brand-sphere">SPHERE</span>
                    </Link>
                    <WorkspaceSelector />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <Link to="/projects" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.9rem" }}>Projects</Link>
                    <Link to="/my-tasks" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.9rem" }}>My Tasks</Link>
                    <Link to="/documents" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.9rem" }}>Documents</Link>
                    <Link to="/files" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.9rem" }}>Files</Link>
                    <Link to="/activity-log" style={{ color: "#6366f1", textDecoration: "none", fontWeight: 600, fontSize: "0.9rem" }}>Activity Log</Link>
                    <NotificationCenter workspaceId={activeWorkspace?.id} />
                    
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "12px" }}>
                        <div className="profile-avatar" style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#6366f1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "0.8rem" }}>
                            {userInitials}
                        </div>
                    </div>
                </div>
            </header>

            <div className="activity-container">
                <div className="activity-header">
                    <div className="activity-title">
                        <h1>Workspace Activity & Audit Log</h1>
                        <p>Track system actions, security events, and project modifications within {activeWorkspace?.name || "your workspace"}.</p>
                    </div>
                </div>

                <div className="activity-filters">
                    <select
                        className="activity-select"
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
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

                <div className="audit-card">
                    {loading ? (
                        <div className="activity-empty">Loading workspace activity logs...</div>
                    ) : error ? (
                        <div className="activity-empty" style={{ color: "#ef4444" }}>{error}</div>
                    ) : logs.length === 0 ? (
                        <div className="activity-empty">No activity records found matching the criteria.</div>
                    ) : (
                        <table className="audit-table">
                            <thead>
                                <tr>
                                    <th>Actor</th>
                                    <th>Action</th>
                                    <th>Entity</th>
                                    <th>Details / Metadata</th>
                                    <th>IP Address</th>
                                    <th>Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id}>
                                        <td>
                                            <div className="audit-user">
                                                <div className="audit-avatar">{getInitials(log.user)}</div>
                                                <div>
                                                    <div className="audit-user-name">
                                                        {log.user ? `${log.user.firstName} ${log.user.lastName}`.trim() : "System / Automated"}
                                                    </div>
                                                    <div className="audit-user-email">{log.user?.email || "system@collabsphere.local"}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`action-badge ${log.action}`}>
                                                {log.action.replace(/_/g, " ")}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 500 }}>{log.entityType}</span>
                                        </td>
                                        <td>
                                            <span style={{ color: "#94a3b8" }}>{formatDetails(log.details, log.metadata)}</span>
                                        </td>
                                        <td>
                                            <span className="audit-ip">{log.ipAddress || "127.0.0.1"}</span>
                                        </td>
                                        <td>
                                            <span className="audit-time" title={new Date(log.createdAt).toLocaleString()}>
                                                {formatTime(log.createdAt)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActivityLog;
