import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchWorkspaceOverviewApi, type WorkspaceOverviewData } from "../services/workspaceApi";
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

  return (
    <div className="projects-page">

      <AppSidebar activePage="overview" projectsCount={metrics.totalProjects} />

      <main className="projects-main">

        <AppTopbar pageTitle="Overview" />

        <section className="content">

          {/* PAGE HEADING */}
          <div className="page-heading">
            <div>
              <h1>Workspace Overview</h1>
              <p>Live metrics, active projects, and team output for <strong>{activeWorkspace?.name || "Workspace"}</strong>.</p>
            </div>

            <button className="new-project" onClick={() => setIsCreateModalOpen(true)}>
              + New project
            </button>
          </div>

          {/* ERROR BANNER */}
          {error && (
            <div style={{ background: "#fdf2f2", color: "#991b1b", border: "1px solid #f8d7da", padding: "12px 18px", borderRadius: "8px", marginBottom: "24px", fontSize: "13px" }}>
              {error}
            </div>
          )}

          {/* KPI STATS ROW */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "18px", marginBottom: "34px" }}>
            
            <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "20px", background: "#ffffff" }}>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "11px", color: "#9a968a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Active Projects
              </div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: "32px", fontWeight: 500, color: "#14161c", margin: "8px 0 4px" }}>
                {metrics.activeProjects}
              </div>
              <div style={{ fontSize: "12px", color: "#5a594f" }}>
                {metrics.totalProjects} total streams
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
                {completionPct}% completion rate
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
                Across {metrics.totalTasks} total tasks
              </div>
            </div>

          </div>

          {/* 2-COLUMN SECTION: RECENT PROJECTS & RECENT TASKS */}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "28px", marginBottom: "34px" }}>
            
            {/* RECENT PROJECTS */}
            <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "24px", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "18px" }}>
                <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "18px", fontWeight: 500, margin: 0 }}>
                  Recent Projects
                </h2>
                <Link to="/projects" style={{ fontSize: "12.5px", color: "#5a594f", textDecoration: "none", fontWeight: 500 }}>
                  View all ({metrics.totalProjects}) →
                </Link>
              </div>

              {(!data?.recentProjects || data.recentProjects.length === 0) ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#9a968a" }}>
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
                            <div style={{ flex: 1, height: "3px", background: "#f0ede4", borderRadius: "2px", overflow: "hidden" }}>
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

            {/* RECENT TASKS */}
            <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "24px", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "18px" }}>
                <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "18px", fontWeight: 500, margin: 0 }}>
                  Recent Tasks
                </h2>
                <Link to="/my-tasks" style={{ fontSize: "12.5px", color: "#5a594f", textDecoration: "none", fontWeight: 500 }}>
                  View board →
                </Link>
              </div>

              {(!data?.recentTasks || data.recentTasks.length === 0) ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#9a968a" }}>
                  <p style={{ margin: 0, fontSize: "13.5px" }}>No tasks created yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {data.recentTasks.slice(0, 6).map((t) => (
                    <div 
                      key={t.id}
                      onClick={() => navigate(`/projects/${t.projectId}?tab=tasks`)}
                      style={{
                        padding: "10px 14px",
                        border: "1px solid #f0ede4",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fcfbf8")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#14161c" }}>{t.title}</span>
                        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "#f0ede4", color: "#5a594f" }}>
                          {t.status}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "11px", color: "#9a968a" }}>
                        <span>📁 {t.projectName}</span>
                        <span>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* BOTTOM ROW: RECENT DOCUMENTS & TEAM ACTIVITY */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px" }}>
            
            {/* DOCUMENTS */}
            <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "24px", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "18px" }}>
                <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "18px", fontWeight: 500, margin: 0 }}>
                  Recent Documents
                </h2>
                <Link to="/documents" style={{ fontSize: "12.5px", color: "#5a594f", textDecoration: "none", fontWeight: 500 }}>
                  All Documents →
                </Link>
              </div>

              {(!data?.recentDocuments || data.recentDocuments.length === 0) ? (
                <div style={{ textAlign: "center", padding: "30px 20px", color: "#9a968a", fontSize: "13px" }}>
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
                        padding: "10px 14px",
                        border: "1px solid #f0ede4",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fcfbf8")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                    >
                      <div>
                        <strong style={{ fontSize: "13px", fontWeight: 500, color: "#14161c", display: "block" }}>📄 {doc.title}</strong>
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

            {/* ACTIVITY LOG */}
            <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "24px", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "18px" }}>
                <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "18px", fontWeight: 500, margin: 0 }}>
                  Team Activity
                </h2>
                <Link to="/activity-log" style={{ fontSize: "12.5px", color: "#5a594f", textDecoration: "none", fontWeight: 500 }}>
                  Full Audit Log →
                </Link>
              </div>

              {(!data?.recentActivity || data.recentActivity.length === 0) ? (
                <div style={{ textAlign: "center", padding: "30px 20px", color: "#9a968a", fontSize: "13px" }}>
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