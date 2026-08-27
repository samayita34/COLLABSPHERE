import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchWorkspaceAnalyticsApi, type WorkspaceAnalyticsData } from "../services/workspaceApi";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import { 
  Activity, 
  CheckCircle, 
  TrendingUp, 
  Users, 
  FileText, 
  Database, 
  MessageSquare,
  BarChart2
} from "lucide-react";
import "./Dashboard.css";
import "./Analytics.css";

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

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function Analytics() {
  const navigate = useNavigate();
  const { userFullName, userInitials, logout } = useAuth();
  const { activeWorkspace } = useWorkspace();
  
  const [data, setData] = useState<WorkspaceAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWorkspace) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchWorkspaceAnalyticsApi(activeWorkspace.id)
      .then((analyticsData) => {
        setData(analyticsData);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load analytics:", err);
        setError(err.message || "Failed to load analytics data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activeWorkspace]);

  const maxProductivity = data?.productivityTrends 
    ? Math.max(...data.productivityTrends.map(t => t.completed), 1)
    : 1;

  const storageUsed = data?.storageUsage?.used || 0;
  const storageQuota = data?.storageUsage?.quota || 1;
  const storagePct = Math.min((storageUsed / storageQuota) * 100, 100);

  return (
    <div className="cs-analytics-page">
      
      {/* SIDEBAR */}
      <aside className="cs-sidebar">
        <div className="cs-brand">
          <span className="cs-brand-logo">
            <span className="cs-brand-collab">COLLAB</span>
            <span className="cs-brand-sphere">SPHERE</span>
          </span>
          <span className="cs-brand-badge">ENT</span>
        </div>

        <WorkspaceSelector />

        <nav className="cs-nav">
          <span className="cs-nav-group-title">MAIN WORKSPACE</span>
          <Link to="/overview" className="cs-nav-item">
            <NavIcon t="overview" />
            <span className="cs-nav-label">Overview</span>
          </Link>
          <Link to="/projects" className="cs-nav-item">
            <NavIcon t="projects" />
            <span className="cs-nav-label">Projects</span>
          </Link>
          <Link to="/my-tasks" className="cs-nav-item">
            <NavIcon t="tasks" />
            <span className="cs-nav-label">My Tasks</span>
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
          <Link to="/analytics" className="cs-nav-item active">
            <NavIcon t="analytics" />
            <span className="cs-nav-label">Analytics</span>
          </Link>
          <a href="#" className="cs-nav-item" onClick={(e) => { e.preventDefault(); navigate("/projects"); }}>
            <NavIcon t="settings" />
            <span className="cs-nav-label">Settings</span>
          </a>
        </nav>

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

      {/* CONTENT */}
      <main className="cs-analytics-content">
        <header className="cs-analytics-header">
          <h1 className="cs-analytics-headline">Workspace Analytics</h1>
          <p className="cs-analytics-subtext">Insights and performance telemetry for {activeWorkspace?.name || "your workspace"}.</p>
        </header>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
            Crunching analytics data...
          </div>
        ) : error ? (
          <div style={{ padding: "40px", color: "#b91c1c", textAlign: "center" }}>
            {error}
          </div>
        ) : data ? (
          <div className="cs-analytics-grid">
            
            {/* KPI Cards */}
            <div className="cs-metric-card">
              <div className="cs-metric-header">
                <span className="cs-metric-title">Completion Rate</span>
                <CheckCircle className="cs-metric-icon" />
              </div>
              <div>
                <div className="cs-metric-value">{Math.round(data.taskCompletionRate * 100)}%</div>
                <div className="cs-metric-subtitle">Of {data.workspaceGrowth.totalTasks} total tasks completed</div>
              </div>
            </div>

            <div className="cs-metric-card">
              <div className="cs-metric-header">
                <span className="cs-metric-title">Active Users</span>
                <Activity className="cs-metric-icon" />
              </div>
              <div>
                <div className="cs-metric-value">{data.activeUsers}</div>
                <div className="cs-metric-subtitle">Active in the last 7 days</div>
              </div>
            </div>

            <div className="cs-metric-card">
              <div className="cs-metric-header">
                <span className="cs-metric-title">Document Activity</span>
                <FileText className="cs-metric-icon" />
              </div>
              <div>
                <div className="cs-metric-value">{data.documentActivity}</div>
                <div className="cs-metric-subtitle">Updated in the last 30 days</div>
              </div>
            </div>

            <div className="cs-metric-card">
              <div className="cs-metric-header">
                <span className="cs-metric-title">Chat Messages</span>
                <MessageSquare className="cs-metric-icon" />
              </div>
              <div>
                <div className="cs-metric-value">{data.chatStatistics}</div>
                <div className="cs-metric-subtitle">Total messages sent</div>
              </div>
            </div>

            {/* Wide Cards */}
            <div className="cs-wide-card">
              <div className="cs-metric-header">
                <span className="cs-metric-title">Productivity Trends (30 Days)</span>
                <TrendingUp className="cs-metric-icon" />
              </div>
              <div className="cs-metric-subtitle">Tasks completed per day</div>
              
              <div className="cs-chart-container">
                {data.productivityTrends.map((t, idx) => (
                  <div key={idx} className="cs-chart-bar-wrap" title={`${t.date}: ${t.completed} tasks`}>
                    <div 
                      className="cs-chart-bar" 
                      style={{ height: `${(t.completed / maxProductivity) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="cs-wide-card">
              <div className="cs-metric-header">
                <span className="cs-metric-title">Team Performance</span>
                <Users className="cs-metric-icon" />
              </div>
              <div className="cs-metric-subtitle">Top performers by completed tasks</div>
              
              <div className="cs-team-list">
                {data.teamPerformance.slice(0, 5).map(u => {
                  const initial = u.name ? u.name.charAt(0).toUpperCase() : "U";
                  return (
                    <div key={u.userId} className="cs-team-item">
                      <div className="cs-team-user">
                        <div className="cs-team-avatar">{initial}</div>
                        <div className="cs-team-name">{u.name}</div>
                      </div>
                      <div className="cs-team-score">{u.completedTasks} tasks</div>
                    </div>
                  );
                })}
                {data.teamPerformance.length === 0 && (
                  <div style={{ color: "#64748b", fontSize: "14px", marginTop: "12px" }}>No tasks completed yet.</div>
                )}
              </div>
            </div>

            {/* Bottom Row */}
            <div className="cs-metric-card" style={{ gridColumn: "span 2" }}>
              <div className="cs-metric-header">
                <span className="cs-metric-title">Storage Usage</span>
                <Database className="cs-metric-icon" />
              </div>
              <div>
                <div className="cs-metric-value">{formatBytes(storageUsed)}</div>
                <div className="cs-metric-subtitle">Of {formatBytes(storageQuota)} allocated</div>
                <div className="cs-storage-bar-bg">
                  <div className="cs-storage-bar-fill" style={{ width: `${storagePct}%` }} />
                </div>
              </div>
            </div>

            <div className="cs-metric-card" style={{ gridColumn: "span 2" }}>
              <div className="cs-metric-header">
                <span className="cs-metric-title">Workspace Growth</span>
                <BarChart2 className="cs-metric-icon" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{data.workspaceGrowth.totalUsers}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Total Users</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{data.workspaceGrowth.totalProjects}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Total Projects</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{data.workspaceGrowth.totalTasks}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Total Tasks</div>
                </div>
              </div>
            </div>

          </div>
        ) : null}
      </main>

    </div>
  );
}
