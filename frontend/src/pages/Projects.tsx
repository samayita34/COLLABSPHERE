import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProjects } from "../services/projectApi";
import type { MappedProject } from "../services/projectApi";
import "./Projects.css";

export default function Projects() {
  const navigate = useNavigate();
  const [projectsList, setProjectsList] = useState<MappedProject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"All" | "Active" | "Completed" | "Archived">("All");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchProjects()
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
  }, []);

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

        <div className="workspace">
          <div className="workspace-logo">AC</div>

          <div>
            <strong>Acme Corp</strong>
            <span>Enterprise workspace</span>
          </div>

          <span className="chevron">⌄</span>
        </div>

        <div className="nav-title">NAVIGATION</div>

        <nav>
          <a href="#">Overview</a>
          <a href="#" className="selected">
            Projects
            <span>{projectsList.length}</span>
          </a>
          <a href="#">My Tasks</a>
          <a href="#">Documents</a>
          <a href="#">Files</a>
          <a href="#">Messages</a>
          <a href="#">Analytics</a>
          <a href="#">Settings</a>
        </nav>

        <div className="profile">
          <div className="profile-avatar">SR</div>

          <div>
            <strong>Samayita Ray</strong>
            <span>Workspace Admin</span>
          </div>
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

            <button className="notification">♢</button>

            <div className="profile-avatar">SR</div>
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

            <button className="new-project">
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

    </div>
  );
}