import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchWorkspaceOverviewApi, type WorkspaceOverviewData } from "../services/workspaceApi";
import { fetchNotifications, markNotificationAsRead, type NotificationItem } from "../services/notificationApi";
import { CreateProjectModal } from "./CreateProjectModal";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopbar } from "../components/AppTopbar";
import "./Projects.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  
  const [data, setData] = useState<WorkspaceOverviewData | null>(null);
  const [, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Task Horizon Tab State ("pending" | "today" | "upcoming")
  const [taskTab, setTaskTab] = useState<"pending" | "today" | "upcoming">("pending");

  // Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loadingNotifs, setLoadingNotifs] = useState<boolean>(false);

  const loadData = () => {
    if (!activeWorkspace) {
      setData(null);
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchWorkspaceOverviewApi(activeWorkspace.id)
      .then((overview) => {
        setData(overview);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load workspace overview:", err);
        setError(err.message || "Failed to load overview data");
      })
      .finally(() => {
        setLoading(false);
      });

    loadNotifications();
  };

  const loadNotifications = () => {
    if (!activeWorkspace) return;
    setLoadingNotifs(true);
    fetchNotifications(activeWorkspace.id, 1, 6)
      .then((res) => {
        setNotifications(res.data || []);
        setUnreadCount(res.unreadCount || 0);
      })
      .catch((err) => console.error("Failed to load notifications:", err))
      .finally(() => setLoadingNotifs(false));
  };

  const handleMarkRead = async (notifId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markNotificationAsRead(notifId);
      setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeWorkspace]);

  const metrics = data?.metrics ?? {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    todoTasks: 0,
  };

  const completionPct = metrics.totalTasks === 0 
    ? 0 
    : Math.round((metrics.completedTasks / metrics.totalTasks) * 100);

  const pendingTasksList = data?.pendingTasks || [];
  const dueTodayTasksList = data?.dueTodayTasks || [];
  const upcomingTasksList = data?.upcomingDeadlineTasks || [];

  return (
    <div className="projects-page">

      <AppSidebar activePage="overview" projectsCount={metrics.totalProjects} />

      <main className="projects-main">

        <AppTopbar pageTitle="Overview" />

        <section className="content">

          {/* PAGE HEADING */}
          <div className="page-heading">
            <div>
              <h1>Smart Workspace Dashboard</h1>
              <p>Live metrics, task horizons, notifications, and team activity for <strong>{activeWorkspace?.name || "Workspace"}</strong>.</p>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button 
                type="button" 
                onClick={loadData}
                style={{
                  border: "1px solid #e7e3d8",
                  background: "#ffffff",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontSize: "12.5px",
                  fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                ↻ Refresh
              </button>
              <button
                type="button"
                onClick={() => navigate("/analytics")}
                style={{
                  border: "1px solid #3b82f6",
                  background: "rgba(59, 130, 246, 0.08)",
                  color: "#2563eb",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                📊 Analytics →
              </button>
              <button className="new-project" onClick={() => setIsCreateModalOpen(true)}>
                + New project
              </button>
            </div>
          </div>

          {/* ERROR BANNER */}
          {error && (
            <div style={{ background: "#fdf2f2", color: "#991b1b", border: "1px solid #f8d7da", padding: "12px 18px", borderRadius: "8px", marginBottom: "24px", fontSize: "13px" }}>
              {error}
            </div>
          )}

          {/* WIDGET 8: WORKSPACE STATISTICS (KPI STATS ROW) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "18px", marginBottom: "34px" }}>
            
            <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "20px", background: "#ffffff" }}>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "11px", color: "#9a968a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Active Projects
              </div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: "32px", fontWeight: 500, color: "#14161c", margin: "8px 0 4px" }}>
                {metrics.activeProjects}
              </div>
              <div style={{ fontSize: "12px", color: "#5a594f" }}>
                {metrics.totalProjects} total project streams
              </div>
            </div>

            <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "20px", background: "#ffffff" }}>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "11px", color: "#9a968a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Pending Tasks
              </div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: "32px", fontWeight: 500, color: "#14161c", margin: "8px 0 4px" }}>
                {metrics.inProgressTasks + metrics.todoTasks}
              </div>
              <div style={{ fontSize: "12px", color: "#5a594f" }}>
                {metrics.inProgressTasks} in progress, {metrics.todoTasks} to do
              </div>
            </div>

            <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "20px", background: "#ffffff" }}>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "11px", color: "#9a968a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Completed Tasks
              </div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: "32px", fontWeight: 500, color: "#14161c", margin: "8px 0 4px" }}>
                {metrics.completedTasks}
              </div>
              <div style={{ fontSize: "12px", color: "#5a594f" }}>
                {completionPct}% completion velocity
              </div>
            </div>

            <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "20px", background: "#ffffff" }}>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "11px", color: "#9a968a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Workspace Health
              </div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: "32px", fontWeight: 500, color: "#14161c", margin: "8px 0 4px" }}>
                {completionPct}%
              </div>
              <div style={{ fontSize: "12px", color: "#5a594f" }}>
                Across {metrics.totalTasks} total workspace tasks
              </div>
            </div>

          </div>

          {/* MAIN 2-COLUMN GRID */}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "28px", marginBottom: "34px" }}>
            
            {/* LEFT COLUMN: WIDGET 1 (ACTIVE PROJECTS) & WIDGET 3,4,5 (TASK HORIZONS) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              
              {/* WIDGET 1: ACTIVE PROJECTS */}
              <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "24px", background: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "18px" }}>
                  <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "18px", fontWeight: 500, margin: 0 }}>
                    Active Projects
                  </h2>
                  <Link to="/projects" style={{ fontSize: "12.5px", color: "#5a594f", textDecoration: "none", fontWeight: 500 }}>
                    View all ({metrics.totalProjects}) →
                  </Link>
                </div>

                {(!data?.recentProjects || data.recentProjects.length === 0) ? (
                  <div style={{ textAlign: "center", padding: "34px 20px", color: "#9a968a" }}>
                    <p style={{ margin: 0, fontSize: "13.5px" }}>No active projects in this workspace yet.</p>
                    <button className="new-project" style={{ marginTop: "14px" }} onClick={() => setIsCreateModalOpen(true)}>
                      + Create First Project
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {data.recentProjects.map((p) => {
                      const initials = p.name.slice(0, 2).toUpperCase();
                      return (
                        <div 
                          key={p.id} 
                          onClick={() => navigate(`/projects/${p.id}`)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                            padding: "12px 16px",
                            border: "1px solid #f0ede4",
                            borderRadius: "8px",
                            cursor: "pointer",
                            transition: "background 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#fcfbf8")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                        >
                          <div className="project-mark" style={{ width: "36px", height: "36px", fontSize: "12px" }}>
                            {initials}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <strong style={{ fontSize: "13.5px", fontWeight: 500, color: "#14161c" }}>{p.name}</strong>
                              <span className={`status ${(p.status || "ACTIVE").toLowerCase()}`}>
                                <span />
                                {p.status}
                              </span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                              <div style={{ flex: 1, height: "4px", background: "#f0ede4", borderRadius: "2px", overflow: "hidden" }}>
                                <div style={{ width: `${p.progress}%`, height: "100%", background: "#232a3d" }} />
                              </div>
                              <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "10.5px", color: "#9a968a" }}>
                                {p.progress}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* WIDGET 3, 4, 5: TASK HORIZONS (PENDING TASKS, DUE TODAY, UPCOMING DEADLINES) */}
              <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "24px", background: "#ffffff" }}>
                
                {/* WIDGET TAB SWITCHER */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", borderBottom: "1px solid #f0ede4", paddingBottom: "12px" }}>
                  <div style={{ display: "flex", gap: "16px" }}>
                    <button
                      type="button"
                      onClick={() => setTaskTab("pending")}
                      style={{
                        background: "none",
                        border: "none",
                        fontFamily: "Fraunces, serif",
                        fontSize: "16px",
                        fontWeight: taskTab === "pending" ? 600 : 400,
                        color: taskTab === "pending" ? "#14161c" : "#9a968a",
                        cursor: "pointer",
                        borderBottom: taskTab === "pending" ? "2px solid #14161c" : "none",
                        paddingBottom: "4px"
                      }}
                    >
                      Pending Tasks ({pendingTasksList.length})
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setTaskTab("today")}
                      style={{
                        background: "none",
                        border: "none",
                        fontFamily: "Fraunces, serif",
                        fontSize: "16px",
                        fontWeight: taskTab === "today" ? 600 : 400,
                        color: taskTab === "today" ? "#dc2626" : "#9a968a",
                        cursor: "pointer",
                        borderBottom: taskTab === "today" ? "2px solid #dc2626" : "none",
                        paddingBottom: "4px"
                      }}
                    >
                      Due Today ({dueTodayTasksList.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setTaskTab("upcoming")}
                      style={{
                        background: "none",
                        border: "none",
                        fontFamily: "Fraunces, serif",
                        fontSize: "16px",
                        fontWeight: taskTab === "upcoming" ? 600 : 400,
                        color: taskTab === "upcoming" ? "#2563eb" : "#9a968a",
                        cursor: "pointer",
                        borderBottom: taskTab === "upcoming" ? "2px solid #2563eb" : "none",
                        paddingBottom: "4px"
                      }}
                    >
                      Upcoming Deadlines ({upcomingTasksList.length})
                    </button>
                  </div>

                  <Link to="/my-tasks" style={{ fontSize: "12.5px", color: "#5a594f", textDecoration: "none", fontWeight: 500 }}>
                    My Tasks →
                  </Link>
                </div>

                {/* TAB CONTENT 1: PENDING TASKS */}
                {taskTab === "pending" && (
                  pendingTasksList.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 20px", color: "#9a968a", fontSize: "13px" }}>
                      No pending tasks found.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {pendingTasksList.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => navigate(`/projects/${t.projectId}?tab=tasks`)}
                          style={{
                            padding: "12px 14px",
                            border: "1px solid #f0ede4",
                            borderRadius: "8px",
                            cursor: "pointer",
                            background: "#ffffff",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#fcfbf8")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <strong style={{ fontSize: "13px", fontWeight: 500, color: "#14161c" }}>{t.title}</strong>
                            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "#f0ede4", color: "#5a594f" }}>
                              {t.status}
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "11.5px", color: "#9a968a" }}>
                            <span>📁 {t.projectName}</span>
                            <span>{t.dueDate ? `Due ${new Date(t.dueDate).toLocaleDateString()}` : "No due date"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* TAB CONTENT 2: DUE TODAY */}
                {taskTab === "today" && (
                  dueTodayTasksList.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 20px", color: "#16a34a", fontSize: "13px", fontWeight: 500 }}>
                      ✓ High five! No tasks are due today.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {dueTodayTasksList.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => navigate(`/projects/${t.projectId}?tab=tasks`)}
                          style={{
                            padding: "12px 14px",
                            border: "1px solid #fecaca",
                            borderRadius: "8px",
                            cursor: "pointer",
                            background: "#fef2f2",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <strong style={{ fontSize: "13px", fontWeight: 600, color: "#991b1b" }}>🔥 {t.title}</strong>
                            <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#dc2626", background: "#fee2e2", padding: "2px 8px", borderRadius: "4px" }}>
                              DUE TODAY
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "11.5px", color: "#991b1b" }}>
                            <span>📁 {t.projectName}</span>
                            <span>Priority: {t.priority}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* TAB CONTENT 3: UPCOMING DEADLINES */}
                {taskTab === "upcoming" && (
                  upcomingTasksList.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 20px", color: "#9a968a", fontSize: "13px" }}>
                      No deadlines coming up in the next 7 days.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {upcomingTasksList.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => navigate(`/projects/${t.projectId}?tab=tasks`)}
                          style={{
                            padding: "12px 14px",
                            border: "1px solid #dbeafe",
                            borderRadius: "8px",
                            cursor: "pointer",
                            background: "#eff6ff",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <strong style={{ fontSize: "13px", fontWeight: 500, color: "#1e40af" }}>📅 {t.title}</strong>
                            <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#2563eb", background: "#dbeafe", padding: "2px 8px", borderRadius: "4px" }}>
                              {new Date(t.dueDate!).toLocaleDateString()}
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "11.5px", color: "#1e40af" }}>
                            <span>📁 {t.projectName}</span>
                            <span>Status: {t.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

              </div>

            </div>

            {/* RIGHT COLUMN: WIDGET 7 (NOTIFICATIONS), WIDGET 2 (RECENT DOCS), WIDGET 6 (TEAM ACTIVITY) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              
              {/* WIDGET 7: LIVE WORKSPACE NOTIFICATIONS */}
              <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "24px", background: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "18px", fontWeight: 500, margin: 0 }}>
                    Notifications
                  </h2>
                  {unreadCount > 0 && (
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#4f46e5", background: "#eef2ff", padding: "2px 8px", borderRadius: "10px" }}>
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                {loadingNotifs ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "#9a968a", fontSize: "12.5px" }}>
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "#9a968a", fontSize: "12.5px" }}>
                    No recent notifications.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => n.link && navigate(n.link)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: "1px solid #f0ede4",
                          background: n.isRead ? "#ffffff" : "#f8fafc",
                          cursor: n.link ? "pointer" : "default",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "8px"
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "12.5px", fontWeight: n.isRead ? 400 : 600, color: "#14161c" }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: "11.5px", color: "#5a594f", marginTop: "2px" }}>
                            {n.message}
                          </div>
                          <div style={{ fontSize: "10px", color: "#9a968a", marginTop: "4px" }}>
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkRead(n.id, e)}
                            style={{
                              border: "none",
                              background: "none",
                              color: "#6366f1",
                              fontSize: "11px",
                              cursor: "pointer",
                              fontWeight: 500
                            }}
                            title="Mark as read"
                          >
                            ✓
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* WIDGET 2: RECENT DOCUMENTS */}
              <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "24px", background: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
                  <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "18px", fontWeight: 500, margin: 0 }}>
                    Recent Documents
                  </h2>
                  <Link to="/documents" style={{ fontSize: "12.5px", color: "#5a594f", textDecoration: "none", fontWeight: 500 }}>
                    All Docs →
                  </Link>
                </div>

                {(!data?.recentDocuments || data.recentDocuments.length === 0) ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "#9a968a", fontSize: "12.5px" }}>
                    No recent documents found.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {data.recentDocuments.map((doc) => (
                      <div 
                        key={doc.id}
                        onClick={() => navigate(`/projects/${doc.project.id}?tab=documents`)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 12px",
                          border: "1px solid #f0ede4",
                          borderRadius: "8px",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#fcfbf8")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                      >
                        <div>
                          <strong style={{ fontSize: "12.5px", fontWeight: 500, color: "#14161c", display: "block" }}>📄 {doc.title}</strong>
                          <span style={{ fontSize: "11px", color: "#9a968a" }}>{doc.project.name}</span>
                        </div>
                        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "10.5px", color: "#9a968a" }}>
                          {new Date(doc.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* WIDGET 6: TEAM ACTIVITY */}
              <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "24px", background: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
                  <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "18px", fontWeight: 500, margin: 0 }}>
                    Team Activity
                  </h2>
                  <Link to="/activity-log" style={{ fontSize: "12.5px", color: "#5a594f", textDecoration: "none", fontWeight: 500 }}>
                    Audit Log →
                  </Link>
                </div>

                {(!data?.recentActivity || data.recentActivity.length === 0) ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "#9a968a", fontSize: "12.5px" }}>
                    No recent team activity recorded.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {data.recentActivity.slice(0, 5).map((act) => (
                      <div key={act.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid #f8f6f0", fontSize: "12px" }}>
                        <div className="profile-avatar" style={{ width: "24px", height: "24px", fontSize: "9px" }}>
                          {act.user ? ((act.user.firstName || "")[0] + (act.user.lastName || "")[0]).toUpperCase() : "SY"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <strong style={{ color: "#14161c" }}>{act.user?.firstName || "System"}</strong>
                          <span style={{ color: "#5a594f", marginLeft: "6px" }}>{act.action.replace(/_/g, " ").toLowerCase()}</span>
                        </div>
                        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "10px", color: "#9a968a" }}>
                          {new Date(act.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>

        </section>
      </main>

      {/* CREATE PROJECT MODAL */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onProjectCreated={() => {
          setIsCreateModalOpen(false);
          loadData();
        }}
        workspaceId={activeWorkspace?.id}
      />

    </div>
  );
}