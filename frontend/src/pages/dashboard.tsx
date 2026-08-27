import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchWorkspaceOverviewApi, type WorkspaceOverviewData } from "../services/workspaceApi";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import { CreateProjectModal } from "./CreateProjectModal";
import NotificationCenter from "../components/NotificationCenter";
import "./Dashboard.css";

function NavIcon({ t }: { t: string }) {
  const p = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (t) {
    case "overview": return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>;
    case "projects": return <svg {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
    case "tasks": return <svg {...p}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
    case "documents": return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
    case "files": return <svg {...p}><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/><polyline points="14 2 14 8 20 8"/><path d="M2 15h10"/><path d="M9 18l3-3-3-3"/></svg>;
    case "messages": return <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case "analytics": return <svg {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    case "settings": return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    default: return null;
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { userFullName, userInitials, logout } = useAuth();
  const { activeWorkspace } = useWorkspace();
  
  const [data, setData] = useState<WorkspaceOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadData = () => {
    if (!activeWorkspace) {
      setData(null);
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

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();

  const getStatusBadgeClass = (status: string) => {
    if (status === "ACTIVE") return "success";
    if (status === "COMPLETED") return "warning";
    return "danger";
  };

  const getStatusDisplay = (status: string) => {
    if (status === "ACTIVE") return "Active";
    if (status === "COMPLETED") return "Completed";
    return "Archived";
  };

  return (
    <div className="cs-dashboard">

      {/* FIXED SIDEBAR */}
      <aside className="cs-sidebar">
        {/* Brand */}
        <div className="cs-brand">
          <span className="cs-brand-logo">
            <span className="cs-brand-collab">COLLAB</span>
            <span className="cs-brand-sphere">SPHERE</span>
          </span>
          <span className="cs-brand-badge">ENT</span>
        </div>

        {/* Dynamic Workspace Switcher */}
        <WorkspaceSelector />

        {/* Nav Links */}
        <nav className="cs-nav">
          <span className="cs-nav-group-title">MAIN WORKSPACE</span>
          
          <Link to="/overview" className="cs-nav-item active">
            <NavIcon t="overview" />
            <span className="cs-nav-label">Overview</span>
          </Link>

          <Link to="/projects" className="cs-nav-item">
            <NavIcon t="projects" />
            <span className="cs-nav-label">Projects</span>
            {metrics.totalProjects > 0 && (
              <span className="cs-nav-badge">{metrics.totalProjects}</span>
            )}
          </Link>

          <Link to="/my-tasks" className="cs-nav-item">
            <NavIcon t="tasks" />
            <span className="cs-nav-label">My Tasks</span>
            {metrics.inProgressTasks + metrics.todoTasks > 0 && (
              <span className="cs-nav-badge">{metrics.inProgressTasks + metrics.todoTasks}</span>
            )}
          </Link>

          <Link to="/documents" className="cs-nav-item">
            <NavIcon t="documents" />
            <span className="cs-nav-label">Documents</span>
          </Link>

          <Link to="/files" className="cs-nav-item">
            <NavIcon t="files" />
            <span className="cs-nav-label">Files</span>
          </Link>

          <Link to="/messages" className="cs-nav-item">
            <NavIcon t="messages" />
            <span className="cs-nav-label">Messages</span>
          </Link>

          <Link to="/analytics" className="cs-nav-item">
            <NavIcon t="analytics" />
            <span className="cs-nav-label">Analytics</span>
          </Link>

          <a href="#" className="cs-nav-item" onClick={(e) => { e.preventDefault(); navigate("/projects"); }}>
            <NavIcon t="settings" />
            <span className="cs-nav-label">Settings</span>
          </a>
        </nav>

        {/* Sidebar Footer User Card */}
        <div className="cs-sidebar-footer">
          <div className="cs-user-card">
            <div className="cs-user-avatar">{userInitials}</div>
            <div className="cs-user-meta">
              <span className="cs-user-name">{userFullName}</span>
              <span className="cs-user-role">Workspace Member</span>
            </div>
            <button className="cs-logout-btn" onClick={logout} title="Sign Out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="cs-main-container">

        {/* Topbar */}
        <header className="cs-topbar">
          <div className="cs-breadcrumb">
            <span className="cs-bc-root">{activeWorkspace?.name || "Workspace"}</span>
            <span className="cs-bc-divider">/</span>
            <span className="cs-bc-current">Overview</span>
          </div>

          <div className="cs-topbar-actions">
            <div className="cs-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search projects, tasks..." />
              <kbd>⌘K</kbd>
            </div>

            <NotificationCenter workspaceId={activeWorkspace?.id} />

            <div className="cs-divider-v" />

            <div className="cs-user-quick-profile">
              <div className="cs-avatar-sm">{userInitials}</div>
              <span className="cs-status-dot online" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="cs-content">

          {/* Hero Banner */}
          <div className="cs-hero-section">
            <div>
              <div className="cs-date-chip">
                <span className="cs-chip-pulse" />
                {todayFormatted}
              </div>
              <h1 className="cs-page-headline">Welcome back, {userFullName}</h1>
              <p className="cs-page-subtext">
                Live workspace telemetry for <strong>{activeWorkspace?.name || "your workspace"}</strong>.
              </p>
            </div>

            <div className="cs-hero-cta">
              <button className="cs-btn-secondary" onClick={() => navigate("/projects")}>
                View Projects
              </button>
              <button className="cs-btn-primary" onClick={() => setIsCreateModalOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Project
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", padding: "12px 16px", borderRadius: "8px", marginBottom: "20px" }}>
              {error}
            </div>
          )}

          {/* Loading Indicator */}
          {loading && !data && (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
              Loading workspace overview...
            </div>
          )}

          {/* Dynamic Stats Grid */}
          <div className="cs-stats-grid">
            
            <div className="cs-stat-card">
              <div className="cs-stat-header">
                <span className="cs-stat-label">Active Projects</span>
              </div>
              <div className="cs-stat-body">
                <span className="cs-stat-val">{metrics.activeProjects}</span>
                <div className="cs-stat-meta">
                  <span className="cs-stat-pill pos">
                    {metrics.totalProjects} Total
                  </span>
                  <span className="cs-stat-period">{metrics.completedProjects} completed</span>
                </div>
              </div>
            </div>

            <div className="cs-stat-card">
              <div className="cs-stat-header">
                <span className="cs-stat-label">Pending Tasks</span>
              </div>
              <div className="cs-stat-body">
                <span className="cs-stat-val">{metrics.inProgressTasks + metrics.todoTasks}</span>
                <div className="cs-stat-meta">
                  <span className="cs-stat-pill warn">
                    {metrics.inProgressTasks} in progress
                  </span>
                  <span className="cs-stat-period">{metrics.todoTasks} to do</span>
                </div>
              </div>
            </div>

            <div className="cs-stat-card">
              <div className="cs-stat-header">
                <span className="cs-stat-label">Completed Tasks</span>
              </div>
              <div className="cs-stat-body">
                <span className="cs-stat-val">{metrics.completedTasks}</span>
                <div className="cs-stat-meta">
                  <span className="cs-stat-pill pos">
                    {completionPct}% Done
                  </span>
                  <span className="cs-stat-period">of {metrics.totalTasks} total tasks</span>
                </div>
              </div>
            </div>

            <div className="cs-stat-card">
              <div className="cs-stat-header">
                <span className="cs-stat-label">Workspace Health</span>
              </div>
              <div className="cs-stat-body">
                <span className="cs-stat-val">{completionPct}%</span>
                <div className="cs-stat-meta">
                  <span className="cs-stat-pill neu">Overall Progress</span>
                  <span className="cs-stat-period">{metrics.totalProjects} active streams</span>
                </div>
              </div>
            </div>

          </div>

          {/* Main Grid: Projects + Tasks */}
          <div className="cs-main-grid">

            {/* Recent Projects Widget */}
            <div className="cs-panel">
              <div className="cs-panel-header">
                <div>
                  <h2 className="cs-panel-title">Recent Projects</h2>
                  <p className="cs-panel-subtitle">Real-time status across active project streams</p>
                </div>
                <button className="cs-link-btn" onClick={() => navigate("/projects")}>
                  View All ({metrics.totalProjects}) →
                </button>
              </div>

              <div className="cs-project-cards">
                {(!data?.recentProjects || data.recentProjects.length === 0) ? (
                  <div style={{ textAlign: "center", padding: "30px 20px", color: "#64748b" }}>
                    <p style={{ margin: "0 0 10px", fontSize: "0.95rem" }}>No projects found in this workspace.</p>
                    <button 
                      className="cs-btn-primary" 
                      style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                      onClick={() => setIsCreateModalOpen(true)}
                    >
                      + Create First Project
                    </button>
                  </div>
                ) : (
                  data.recentProjects.map((p) => (
                    <div 
                      key={p.id} 
                      className="cs-project-row"
                      onClick={() => navigate(`/projects/${p.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="cs-proj-icon">
                        {p.name.substring(0, 2).toUpperCase()}
                      </div>
                      
                      <div className="cs-proj-info">
                        <div className="cs-proj-head">
                          <strong className="cs-proj-name">{p.name}</strong>
                          <span className={`cs-tag-badge ${getStatusBadgeClass(p.status)}`}>
                            {getStatusDisplay(p.status)}
                          </span>
                        </div>
                        
                        <div className="cs-proj-sub">
                          <span>{p.category}</span>
                          <span className="cs-dot-sep">•</span>
                          <span>{p.tasksCompleted}/{p.tasksTotal} tasks done</span>
                        </div>

                        <div className="cs-proj-progress">
                          <div className="cs-bar-bg">
                            <div 
                              className={`cs-bar-fill ${getStatusBadgeClass(p.status)}`} 
                              style={{ width: `${p.progress}%` }} 
                            />
                          </div>
                          <span className="cs-pct">{p.progress}%</span>
                        </div>
                      </div>

                      <div className="cs-proj-members">
                        {p.members.slice(0, 3).map((m, i) => (
                          <div key={m.id || i} className="cs-member-avatar" style={{ zIndex: 5 - i }} title={m.name}>
                            {m.initials}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Tasks Panel */}
            <div className="cs-panel">
              <div className="cs-panel-header">
                <div>
                  <h2 className="cs-panel-title">Latest Workspace Tasks</h2>
                  <p className="cs-panel-subtitle">Recently updated tasks across projects</p>
                </div>
                <button className="cs-link-btn" onClick={() => navigate("/projects")}>
                  Projects →
                </button>
              </div>

              <div className="cs-tasks-list">
                {(!data?.recentTasks || data.recentTasks.length === 0) ? (
                  <div style={{ textAlign: "center", padding: "30px 20px", color: "#64748b" }}>
                    <p style={{ margin: 0, fontSize: "0.95rem" }}>No tasks created yet in this workspace.</p>
                  </div>
                ) : (
                  data.recentTasks.map((t) => {
                    const isDone = t.status === "DONE";
                    return (
                      <div 
                        key={t.id} 
                        className={`cs-task-item ${isDone ? "completed" : ""}`}
                        onClick={() => navigate(`/projects/${t.projectId}`)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className={`cs-checkbox ${isDone ? "checked" : ""}`}>
                          {isDone && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </div>

                        <div className="cs-task-details">
                          <p className="cs-task-title">{t.title}</p>
                          <div className="cs-task-tags">
                            <span className="cs-task-proj">{t.projectName}</span>
                            <span className={`cs-priority-pill ${t.priority.toLowerCase()}`}>
                              {t.priority}
                            </span>
                          </div>
                        </div>

                        <div className="cs-task-due">
                          <span>{t.status === "DONE" ? "Done" : t.status === "IN_PROGRESS" ? "In Progress" : t.status === "REVIEW" ? "Review" : "To Do"}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </main>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onProjectCreated={() => {
          loadData();
          setIsCreateModalOpen(false);
        }}
        workspaceId={activeWorkspace?.id}
      />

    </div>
  );
}