import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";

const projects = [
  { id: 1, name: "Website Redesign", tag: "WR", category: "Design System", progress: 72, tasks: "18/25", members: ["AR", "PS", "SR"], status: "On track", statusType: "success" },
  { id: 2, name: "Mobile Application", tag: "MA", category: "iOS & Android", progress: 48, tasks: "12/25", members: ["JM", "KL", "AR"], status: "In review", statusType: "warning" },
  { id: 3, name: "Internal Portal", tag: "IP", category: "Infrastructure", progress: 91, tasks: "21/23", members: ["SR", "PS"], status: "On track", statusType: "success" },
  { id: 4, name: "API Gateway v2", tag: "AG", category: "Backend Core", progress: 34, tasks: "8/24", members: ["KL", "JM"], status: "At risk", statusType: "danger" },
];

const tasks = [
  { id: 1, title: "Finalize homepage wireframes and component spec", priority: "High", due: "Today", project: "Website Redesign", completed: false },
  { id: 2, title: "Review GraphQL API documentation & endpoint schemas", priority: "Medium", due: "Tomorrow", project: "Mobile App", completed: false },
  { id: 3, title: "User testing session prep & prototype sync", priority: "High", due: "Aug 12", project: "Internal Portal", completed: true },
  { id: 4, title: "Update design tokens in Tailwind configuration", priority: "Low", due: "Aug 14", project: "Website Redesign", completed: false },
  { id: 5, title: "Sprint retrospective notes & Q3 milestone planning", priority: "Medium", due: "Aug 15", project: "Mobile App", completed: false },
];

const activity = [
  { id: 1, initials: "AR", name: "Alex Rivera", action: "updated wireframes in", target: "Website Redesign", time: "12m ago", type: "edit" },
  { id: 2, initials: "PS", name: "Priya Sharma", action: "uploaded 4 assets to", target: "Mobile Application", time: "35m ago", type: "upload" },
  { id: 3, initials: "SR", name: "Samayita Ray", action: "closed milestone in", target: "Internal Portal", time: "1h ago", type: "check" },
  { id: 4, initials: "JM", name: "John Miller", action: "joined the workspace as", target: "Developer", time: "2h ago", type: "user" },
  { id: 5, initials: "KL", name: "Karen Lee", action: "commented on endpoint in", target: "API Gateway v2", time: "3h ago", type: "comment" },
];

const stats = [
  { label: "Active Projects", value: "12", change: "+14%", period: "vs last month", isPositive: true },
  { label: "Pending Tasks", value: "28", change: "6 urgent", period: "due today", isWarning: true },
  { label: "Team Velocity", value: "94.2%", change: "+3.8%", period: "vs last sprint", isPositive: true },
  { label: "Storage Capacity", value: "6.4 GB", change: "64%", period: "of 10 GB quota", isNeutral: true },
];

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

const nav = [
  { label: "Overview", icon: "overview", active: true },
  { label: "Projects", icon: "projects", badge: "4" },
  { label: "Tasks", icon: "tasks", badge: "12" },
  { label: "Documents", icon: "documents" },
  { label: "Files", icon: "files" },
  { label: "Messages", icon: "messages", badge: "3" },
  { label: "Analytics", icon: "analytics" },
  { label: "Settings", icon: "settings" },
];

function Dashboard() {
  const { userFullName, userInitials } = useAuth();
  const [taskList, setTaskList] = useState(tasks);

  const toggleTask = (id: number) => {
    setTaskList(taskList.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  return (
    <div className="cs-dashboard">

      {/* FIXED SIDEBAR - Absolutely pinned, zero page scrollup */}
      <aside className="cs-sidebar">
        
        {/* Brand */}
        <div className="cs-brand">
          <span className="cs-brand-logo">
            <span className="cs-brand-collab">COLLAB</span>
            <span className="cs-brand-sphere">SPHERE</span>
          </span>
          <span className="cs-brand-badge">ENT</span>
        </div>

        {/* Workspace Switcher */}
        <div className="cs-workspace-card">
          <div className="cs-ws-icon">{userInitials}</div>
          <div className="cs-ws-details">
            <strong className="cs-ws-title">Acme Corp</strong>
            <span className="cs-ws-sub">Enterprise Plan</span>
          </div>
          <svg className="cs-ws-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        {/* Nav Links */}
        <nav className="cs-nav">
          <span className="cs-nav-group-title">MAIN WORKSPACE</span>
          {nav.map((item) => (
            <a key={item.label} className={`cs-nav-item${item.active ? " active" : ""}`}>
              <NavIcon t={item.icon} />
              <span className="cs-nav-label">{item.label}</span>
              {item.badge && <span className={`cs-nav-badge ${item.active ? "active-badge" : ""}`}>{item.badge}</span>}
            </a>
          ))}
        </nav>

        {/* Sidebar Bottom Profile & Storage */}
        <div className="cs-sidebar-footer">
          <div className="cs-storage-widget">
            <div className="cs-storage-header">
              <span>Cloud Storage</span>
              <strong>6.4 GB / 10 GB</strong>
            </div>
            <div className="cs-storage-track">
              <div className="cs-storage-bar" style={{ width: "64%" }} />
            </div>
          </div>

          <div className="cs-user-pill">
            <div className="cs-user-avatar">{userInitials}</div>
            <div className="cs-user-meta">
              <strong className="cs-user-name">{userFullName}</strong>
              <span className="cs-user-role">Workspace Member</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </div>
        </div>

      </aside>

      {/* MAIN VIEWPORT BODY */}
      <div className="cs-main-container">

        {/* Header bar */}
        <header className="cs-topbar">
          <div className="cs-breadcrumb">
            <span className="cs-bc-root">Acme Workspace</span>
            <span className="cs-bc-divider">/</span>
            <span className="cs-bc-current">Overview</span>
          </div>

          <div className="cs-topbar-actions">
            <div className="cs-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search projects, tasks, members..." />
              <kbd>⌘K</kbd>
            </div>

            <button className="cs-icon-btn" aria-label="Notifications">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span className="cs-unread-indicator" />
            </button>

            <div className="cs-divider-v" />

            <div className="cs-user-quick-profile">
              <div className="cs-avatar-sm">{userInitials}</div>
              <span className="cs-status-dot online" />
            </div>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main className="cs-content">

          {/* Hero Banner / Page Title */}
          <div className="cs-hero-section">
            <div>
              <div className="cs-date-chip">
                <span className="cs-chip-pulse" />
                MONDAY, AUGUST 10, 2026
              </div>
              <h1 className="cs-page-headline">Welcome back, {userFullName}</h1>
              <p className="cs-page-subtext">Here is your high-level workspace summary and active team telemetry.</p>
            </div>

            <div className="cs-hero-cta">
              <button className="cs-btn-secondary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Export Report
              </button>
              <button className="cs-btn-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Project
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="cs-stats-grid">
            {stats.map((s, idx) => (
              <div key={idx} className="cs-stat-card">
                <div className="cs-stat-header">
                  <span className="cs-stat-label">{s.label}</span>
                </div>
                <div className="cs-stat-body">
                  <span className="cs-stat-val">{s.value}</span>
                  <div className="cs-stat-meta">
                    <span className={`cs-stat-pill ${s.isPositive ? "pos" : s.isWarning ? "warn" : "neu"}`}>
                      {s.change}
                    </span>
                    <span className="cs-stat-period">{s.period}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Core Grid: Projects + Tasks */}
          <div className="cs-main-grid">

            {/* Active Projects Widget */}
            <div className="cs-panel">
              <div className="cs-panel-header">
                <div>
                  <h2 className="cs-panel-title">Active Projects</h2>
                  <p className="cs-panel-subtitle">Real-time status across active engineering streams</p>
                </div>
                <button className="cs-link-btn">View All ({projects.length}) →</button>
              </div>

              <div className="cs-project-cards">
                {projects.map((p) => (
                  <div key={p.id} className="cs-project-row">
                    <div className="cs-proj-icon">{p.tag}</div>
                    
                    <div className="cs-proj-info">
                      <div className="cs-proj-head">
                        <strong className="cs-proj-name">{p.name}</strong>
                        <span className={`cs-tag-badge ${p.statusType}`}>{p.status}</span>
                      </div>
                      
                      <div className="cs-proj-sub">
                        <span>{p.category}</span>
                        <span className="cs-dot-sep">•</span>
                        <span>{p.tasks} tasks completed</span>
                      </div>

                      <div className="cs-proj-progress">
                        <div className="cs-bar-bg">
                          <div 
                            className={`cs-bar-fill ${p.statusType}`} 
                            style={{ width: `${p.progress}%` }} 
                          />
                        </div>
                        <span className="cs-pct">{p.progress}%</span>
                      </div>
                    </div>

                    <div className="cs-proj-members">
                      {p.members.map((m, i) => (
                        <div key={i} className="cs-member-avatar" style={{ zIndex: 5 - i }}>{m}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks Panel */}
            <div className="cs-panel">
              <div className="cs-panel-header">
                <div>
                  <h2 className="cs-panel-title">My Tasks</h2>
                  <p className="cs-panel-subtitle">Tasks assigned to you across active sprints</p>
                </div>
                <button className="cs-link-btn">Filter →</button>
              </div>

              <div className="cs-tasks-list">
                {taskList.map((t) => (
                  <div 
                    key={t.id} 
                    className={`cs-task-item ${t.completed ? "completed" : ""}`}
                    onClick={() => toggleTask(t.id)}
                  >
                    <div className={`cs-checkbox ${t.completed ? "checked" : ""}`}>
                      {t.completed && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </div>

                    <div className="cs-task-details">
                      <p className="cs-task-title">{t.title}</p>
                      <div className="cs-task-tags">
                        <span className="cs-task-proj">{t.project}</span>
                        <span className={`cs-priority-pill ${t.priority.toLowerCase()}`}>{t.priority}</span>
                      </div>
                    </div>

                    <div className="cs-task-due">
                      <span className={t.due === "Today" ? "urgent-date" : ""}>{t.due}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Bottom Activity Timeline */}
          <div className="cs-panel cs-activity-panel">
            <div className="cs-panel-header">
              <div>
                <h2 className="cs-panel-title">Recent Activity Feed</h2>
                <p className="cs-panel-subtitle">Live audit stream of edits, comments, and uploads</p>
              </div>
              <button className="cs-link-btn">Audit Log →</button>
            </div>

            <div className="cs-activity-feed">
              {activity.map((a) => (
                <div key={a.id} className="cs-activity-row">
                  <div className="cs-activity-user-av">{a.initials}</div>
                  
                  <div className="cs-activity-body">
                    <p className="cs-activity-msg">
                      <strong className="cs-user-bold">{a.name}</strong> {a.action}{" "}
                      <span className="cs-target-highlight">{a.target}</span>
                    </p>
                    <span className="cs-activity-timestamp">{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </main>
      </div>

    </div>
  );
}

export default Dashboard;