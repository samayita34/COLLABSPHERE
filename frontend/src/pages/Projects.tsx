import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { fetchProjects } from "../services/projectApi";
import type { MappedProject } from "../services/projectApi";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { CreateProjectModal } from "./CreateProjectModal";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import NotificationCenter from "../components/NotificationCenter";
import "./Projects.css";

export default function Projects() {
  const navigate = useNavigate();
  const { userFullName, userInitials, logout } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [projectsList, setProjectsList] = useState<MappedProject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"All" | "Active" | "Completed" | "Archived">("All");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!activeWorkspace) {
      setProjectsList([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchProjects(activeWorkspace.id)
      .then((data) => {
        if (isMounted) {
          setProjectsList(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Error fetching projects:", err);
          setError(err.message || "Failed to load projects");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeWorkspace]);

  const filteredProjects = projectsList.filter((project) => {
    if (activeTab === "Active") return project.status === "ACTIVE";
    if (activeTab === "Completed") return project.status === "COMPLETED";
    if (activeTab === "Archived") return (project.status as string) === "ARCHIVED";
    return true;
  });

  return (
    <div className="projects-page">

      <aside className="projects-sidebar">

        <div className="brand">
          <span>Collabsphere</span>
          <small>ENT</small>
        </div>

        <WorkspaceSelector />

        <div className="nav-title">NAVIGATION</div>

        <nav>
          <Link to="/overview">Overview</Link>
          <Link to="/projects" className="selected">
            Projects
            <span>{projectsList.length}</span>
          </Link>
          <Link to="/my-tasks">My Tasks</Link>
          <Link to="/documents">Documents</Link>
          <Link to="/files">Files</Link>
          <Link to="/messages">Messages</Link>
          <Link to="/activity-log">Activity Log</Link>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate("/projects"); }}>Analytics</a>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate("/projects"); }}>Settings</a>
        </nav>

        <div className="profile">
          <div className="profile-avatar">{userInitials}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{userFullName}</strong>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Workspace Member</span>
          </div>

          <button
            onClick={logout}
            style={{
              background: "transparent",
              border: "none",
              color: "#ef4444",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
            title="Sign out"
          >
            Sign out
          </button>
        </div>

      </aside>

      <main className="projects-main">

        <header className="topbar">

          <div className="breadcrumb">
            Workspace / <strong>Projects</strong>
          </div>

          <div className="topbar-actions">
            <div className="search">
              <span>⌕</span>
              <input placeholder="Search anything..." />
              <kbd>⌘ K</kbd>
            </div>

            <NotificationCenter workspaceId={activeWorkspace?.id} />

            <div className="profile-avatar">{userInitials}</div>
          </div>

        </header>

        <section className="content">

          <div className="page-heading">

            <div>
              <h1>Projects</h1>
              <p>
                Manage your team's projects and keep work moving.
              </p>
            </div>

            <button className="new-project" onClick={() => setIsCreateModalOpen(true)}>
              + New project
            </button>

          </div>

          <div className="filters">

            <div className="tabs">
              <button
                className={activeTab === "All" ? "active" : ""}
                onClick={() => setActiveTab("All")}
              >
                All
              </button>
              <button
                className={activeTab === "Active" ? "active" : ""}
                onClick={() => setActiveTab("Active")}
              >
                Active
              </button>
              <button
                className={activeTab === "Completed" ? "active" : ""}
                onClick={() => setActiveTab("Completed")}
              >
                Completed
              </button>
              <button
                className={activeTab === "Archived" ? "active" : ""}
                onClick={() => setActiveTab("Archived")}
              >
                Archived
              </button>
            </div>

            <button className="category">
              All Categories ⌄
            </button>

          </div>

          {loading ? (
            <div style={{ padding: "40px 0", color: "#64748b", textAlign: "center" }}>
              Loading workspace projects...
            </div>
          ) : error ? (
            <div style={{ padding: "40px 0", color: "#ef4444", textAlign: "center" }}>
              {error}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div style={{ padding: "40px 0", color: "#64748b", textAlign: "center" }}>
              No projects found in this workspace.
            </div>
          ) : (
            <div className="project-grid">

              {filteredProjects.map((project) => (

                <article
                  className="project-card"
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                >

                  <div className="card-top">

                    <div className="project-mark">
                      {project.initials}
                    </div>

                    <div
                      className={`status ${project.status === "COMPLETED"
                        ? "completed"
                        : "active"
                        }`}
                    >
                      <span />
                      {project.status}
                    </div>

                  </div>

                  <h2>{project.name}</h2>

                  <div className="category-label">
                    {project.category}
                  </div>

                  <p className="description">
                    {project.description}
                  </p>

                  <div className="progress-header">
                    <span>Progress</span>
                    <strong>{project.progress}%</strong>
                  </div>

                  <div className="progress-bar">
                    <div
                      style={{
                        width: `${project.progress}%`,
                      }}
                    />
                  </div>

                  <div className="card-footer">

                    <div className="meta">
                      <span>✓ {project.tasksFormatted}</span>
                      <span>◷ {project.date}</span>
                    </div>

                    <div className="members">

                      {project.memberInitials.map((member, idx) => (
                        <div
                          className="member"
                          key={`${member}-${idx}`}
                        >
                          {member}
                        </div>
                      ))}

                    </div>

                  </div>

                </article>

              ))}

            </div>
          )}

        </section>

      </main>

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onProjectCreated={(newProj) => setProjectsList((prev) => [newProj, ...prev])}
        workspaceId={activeWorkspace?.id}
      />

    </div>
  );
}