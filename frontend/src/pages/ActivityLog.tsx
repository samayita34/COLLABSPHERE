import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchAuditLogs, AuditLogItem } from "../services/auditApi";
import WorkspaceSelector from "../components/WorkspaceSelector";
import NotificationCenter from "../components/NotificationCenter";
import "./ActivityLog.css";

export const ActivityLog: React.FC = () => {
    const { currentWorkspace } = useWorkspace();
    const [logs, setLogs] = useState<AuditLogItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [actionFilter, setActionFilter] = useState<string>("");

    const loadAuditLogs = async () => {
        if (!currentWorkspace) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetchAuditLogs(currentWorkspace.id, actionFilter || undefined, 1, 50);
            setLogs(res.data);
        } catch (err: any) {
            setError(err.message || "Failed to fetch audit logs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAuditLogs();
    }, [currentWorkspace, actionFilter]);

    const formatDetails = (details: any) => {
        if (!details) return "—";
        if (typeof details === "string") return details;
        return Object.entries(details)
            .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
            .join(" | ");
    };

    const getInitials = (user?: AuditLogItem["user"]) => {
        if (!user) return "SY";
        const f = (user.firstName || "")[0] || "";
        const l = (user.lastName || "")[0] || "";
        return (f + l).toUpperCase() || user.email.slice(0, 2).toUpperCase();
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
                    <NotificationCenter workspaceId={currentWorkspace?.id} />
                </div>
            </header>

            <div className="activity-container">
                <div className="activity-header">
                    <div className="activity-title">
                        <h1>Activity Timeline & Audit Log</h1>
                        <p>Track system actions, security events, and modifications within {currentWorkspace?.name || "your workspace"}.</p>
                    </div>
                </div>

                <div className="activity-filters">
                    <select
                        className="activity-select"
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                    >
                        <option value="">All Actions</option>
                        <option value="USER_LOGIN">User Login</option>
                        <option value="USER_LOGOUT">User Logout</option>
                        <option value="FILE_UPLOAD">File Upload</option>
                        <option value="TASK_DELETE">Task Delete</option>
                        <option value="DOCUMENT_RESTORE">Document Restore</option>
                        <option value="ROLE_UPDATE">Role Update</option>
                        <option value="PERMISSION_CHANGE">Permission Change</option>
                        <option value="TASK_CREATE">Task Create</option>
                        <option value="DOCUMENT_CREATE">Document Create</option>
                        <option value="WORKSPACE_CREATE">Workspace Create</option>
                        <option value="MEMBER_ADD">Member Add</option>
                        <option value="MEMBER_REMOVE">Member Remove</option>
                    </select>
                </div>

                <div className="audit-card">
                    {loading ? (
                        <div className="activity-empty">Loading audit timeline...</div>
                    ) : error ? (
                        <div className="activity-empty" style={{ color: "#ef4444" }}>{error}</div>
                    ) : logs.length === 0 ? (
                        <div className="activity-empty">No activity records found matching the criteria.</div>
                    ) : (
                        <table className="audit-table">
                            <thead>
                                <tr>
                                    <th>User / Actor</th>
                                    <th>Action</th>
                                    <th>Entity</th>
                                    <th>Details</th>
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
                                                {log.action.replace("_", " ")}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 500 }}>{log.entityType}</span>
                                        </td>
                                        <td>
                                            <span style={{ color: "#94a3b8" }}>{formatDetails(log.details)}</span>
                                        </td>
                                        <td>
                                            <span className="audit-ip">{log.ipAddress || "127.0.0.1"}</span>
                                        </td>
                                        <td>
                                            <span className="audit-time">{new Date(log.createdAt).toLocaleString()}</span>
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
