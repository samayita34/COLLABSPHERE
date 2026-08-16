import { useNavigate } from "react-router-dom";
import "./Projects.css";

const projects = [
  {
    slug: "website-redesign",
    initials: "WR",
    name: "Website Redesign",
    category: "Design & Frontend",
    description:
      "Overhaul of the enterprise marketing platform, brand assets, and interactive component library.",
    status: "ACTIVE",
    progress: 78,
    tasks: "18/23",
    date: "Aug 28, 2026",
    members: ["AR", "PS", "SR", "JM"],
  },
  {
    slug: "mobile-application",
    initials: "MA",
    name: "Mobile Application",
    category: "iOS & Android",
    description:
      "Next-generation cross-platform mobile client with real-time sync and offline-first task execution.",
    status: "ACTIVE",
    progress: 45,
    tasks: "13/24",
    date: "Sep 15, 2026",
    members: ["JM", "KL", "AR"],
  },
  {
    slug: "internal-portal",
    initials: "IP",
    name: "Internal Portal",
    category: "Infrastructure",
    description:
      "Unified admin control centre for team permissions, analytics telemetry, and SSO security controls.",
    status: "COMPLETED",
    progress: 100,
    tasks: "22/22",
    date: "Done Aug 02, 2026",
    members: ["SR", "PS"],
  },
  {
    slug: "marketing-campaign",
    initials: "MC",
    name: "Marketing Campaign",
    category: "Growth & Brand",
    description:
      "Q3 global product launch collateral, video assets, and targeted enterprise lead-generation funnels.",
    status: "ACTIVE",
    progress: 60,
    tasks: "9/15",
    date: "Sep 30, 2026",
    members: ["AR", "SR", "KL"],
  },
];

export default function Projects() {
  const navigate = useNavigate();

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
            <span>4</span>
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
              <button className="active">All</button>
              <button>Active</button>
              <button>Completed</button>
              <button>Archived</button>
            </div>

            <button className="category">
              All Categories ⌄
            </button>

          </div>

          <div className="project-grid">

            {projects.map((project) => (

              <article
                className="project-card"
                key={project.name}
                onClick={() => navigate(`/projects/${project.slug}`)}
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
                    <span>✓ {project.tasks}</span>
                    <span>◷ {project.date}</span>
                  </div>

                  <div className="members">

                    {project.members.map((member) => (
                      <div
                        className="member"
                        key={member}
                      >
                        {member}
                      </div>
                    ))}

                  </div>

                </div>

              </article>

            ))}

          </div>

        </section>

      </main>

    </div>
  );
}