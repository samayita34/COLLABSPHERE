import { useState } from "react";
import "./App.css";

type Project = {
  name: string;
  description: string;
  progress: number;
  members: number;
  tasks: string;
  status: "On Track" | "At Risk" | "Completed";
};

const projects: Project[] = [
  {
    name: "Website Redesign",
    description: "Redesign the company website and improve user experience.",
    progress: 76,
    members: 8,
    tasks: "18/24",
    status: "On Track",
  },
  {
    name: "Mobile Application",
    description: "Build the next-generation mobile experience.",
    progress: 52,
    members: 6,
    tasks: "13/25",
    status: "On Track",
  },
  {
    name: "Marketing Campaign",
    description: "Launch the Q3 product marketing campaign.",
    progress: 90,
    members: 5,
    tasks: "27/30",
    status: "Completed",
  },
];

const navigation = [
  { name: "Overview", icon: "⌂" },
  { name: "Projects", icon: "▣" },
  { name: "Tasks", icon: "✓" },
  { name: "Documents", icon: "▤" },
  { name: "Chat", icon: "◌" },
  { name: "Files", icon: "▱" },
  { name: "Analytics", icon: "◫" },
];

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [search, setSearch] = useState("");

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>

          <div>
            <div className="brand-name">COLLABSPHERE</div>
            <div className="brand-subtitle">Workspace</div>
          </div>
        </div>

        <div className="workspace-selector">
          <div className="workspace-avatar">A</div>

          <div className="workspace-info">
            <span>Acme Corporation</span>
            <small>Engineering Workspace</small>
          </div>

          <span className="chevron">⌄</span>
        </div>

        <div className="nav-section">
          <p className="nav-title">WORKSPACE</p>

          {navigation.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${activePage === item.name ? "active" : ""
                }`}
              onClick={() => setActivePage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>

              {item.name === "Chat" && <span className="nav-badge">4</span>}
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button className="nav-item">
            <span className="nav-icon">⚙</span>
            <span>Settings</span>
          </button>

          <button className="nav-item">
            <span className="nav-icon">?</span>
            <span>Help & Support</span>
          </button>

          <div className="user-card">
            <div className="user-avatar">SR</div>

            <div className="user-info">
              <strong>Samayita Ray</strong>
              <span>Workspace Admin</span>
            </div>

            <span className="more">•••</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> {activePage}
          </div>

          <div className="topbar-actions">
            <div className="search-box">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search anything..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <kbd>⌘ K</kbd>
            </div>

            <button className="icon-button notification">
              ♧
              <span></span>
            </button>

            <div className="top-avatar">SR</div>
          </div>
        </header>

        {/* Dashboard */}
        <div className="content">
          <section className="welcome-section">
            <div>
              <p className="eyebrow">MONDAY, AUGUST 10, 2026</p>

              <h1>
                Good evening, <span>Samayita</span> 👋
              </h1>

              <p className="welcome-text">
                Here's what's happening across your workspace today.
              </p>
            </div>

            <button className="primary-button">
              <span>＋</span>
              Create new
            </button>
          </section>

          {/* Statistics */}
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">ACTIVE PROJECTS</span>
                <span className="stat-icon purple">▣</span>
              </div>

              <div className="stat-value">08</div>

              <div className="stat-change positive">
                ↑ 12.5% <span>from last month</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">PENDING TASKS</span>
                <span className="stat-icon blue">✓</span>
              </div>

              <div className="stat-value">24</div>

              <div className="stat-change positive">
                ↓ 8.2% <span>from last week</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">DUE TODAY</span>
                <span className="stat-icon orange">◷</span>
              </div>

              <div className="stat-value">05</div>

              <div className="stat-change warning">
                2 <span>need your attention</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">TEAM MEMBERS</span>
                <span className="stat-icon green">♧</span>
              </div>

              <div className="stat-value">12</div>

              <div className="stat-change positive">
                ↑ 2 <span>new this month</span>
              </div>
            </div>
          </section>

          <div className="dashboard-grid">
            {/* Projects */}
            <section className="panel projects-panel">
              <div className="panel-header">
                <div>
                  <h2>Active Projects</h2>
                  <p>Track progress across your workspace</p>
                </div>

                <button className="view-all">View all →</button>
              </div>

              <div className="project-list">
                {filteredProjects.map((project) => (
                  <div className="project-row" key={project.name}>
                    <div className="project-color"></div>

                    <div className="project-main">
                      <div className="project-title-row">
                        <h3>{project.name}</h3>

                        <span
                          className={`status ${project.status
                            .toLowerCase()
                            .replace(" ", "-")}`}
                        >
                          {project.status}
                        </span>
                      </div>

                      <p>{project.description}</p>

                      <div className="progress-container">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>

                        <span>{project.progress}%</span>
                      </div>
                    </div>

                    <div className="project-meta">
                      <div className="mini-members">
                        <span>SR</span>
                        <span>AK</span>
                        <span>+</span>
                      </div>

                      <small>
                        {project.tasks} tasks
                      </small>
                    </div>
                  </div>
                ))}

                {filteredProjects.length === 0 && (
                  <div className="empty-state">
                    No projects found.
                  </div>
                )}
              </div>
            </section>

            {/* Activity */}
            <section className="panel activity-panel">
              <div className="panel-header">
                <div>
                  <h2>Team Activity</h2>
                  <p>Latest workspace updates</p>
                </div>

                <button className="more-button">•••</button>
              </div>

              <div className="activity-list">
                <Activity
                  avatar="AK"
                  name="Ankit Kumar"
                  action="completed a task"
                  detail="Design authentication flow"
                  time="8 min ago"
                />

                <Activity
                  avatar="PR"
                  name="Priya Roy"
                  action="commented on"
                  detail="Website Redesign"
                  time="24 min ago"
                />

                <Activity
                  avatar="RM"
                  name="Rahul Mehta"
                  action="uploaded a document"
                  detail="Q3 Product Requirements"
                  time="1 hr ago"
                />

                <Activity
                  avatar="SR"
                  name="Samayita Ray"
                  action="created a task"
                  detail="Implement Google OAuth"
                  time="2 hrs ago"
                />
              </div>

              <button className="activity-footer">
                View all activity →
              </button>
            </section>
          </div>

          {/* Bottom Row */}
          <div className="bottom-grid">
            <section className="panel deadline-panel">
              <div className="panel-header">
                <div>
                  <h2>Upcoming Deadlines</h2>
                  <p>Keep track of important dates</p>
                </div>

                <button className="view-all">View calendar →</button>
              </div>

              <div className="deadline-list">
                <Deadline
                  day="12"
                  month="AUG"
                  title="Authentication module"
                  project="Website Redesign"
                  priority="High"
                />

                <Deadline
                  day="15"
                  month="AUG"
                  title="Mobile UI review"
                  project="Mobile Application"
                  priority="Medium"
                />

                <Deadline
                  day="18"
                  month="AUG"
                  title="Marketing assets"
                  project="Marketing Campaign"
                  priority="Low"
                />
              </div>
            </section>

            <section className="panel productivity-panel">
              <div className="panel-header">
                <div>
                  <h2>Workspace Productivity</h2>
                  <p>Task completion this week</p>
                </div>

                <span className="period">This week ⌄</span>
              </div>

              <div className="chart">
                <div className="chart-y">
                  <span>100</span>
                  <span>75</span>
                  <span>50</span>
                  <span>25</span>
                  <span>0</span>
                </div>

                <div className="bars">
                  {[45, 62, 48, 78, 68, 88, 74].map(
                    (height, index) => (
                      <div className="bar-wrapper" key={index}>
                        <div
                          className="bar"
                          style={{ height: `${height}%` }}
                        ></div>

                        <span>
                          {["M", "T", "W", "T", "F", "S", "S"][index]}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Activity({
  avatar,
  name,
  action,
  detail,
  time,
}: {
  avatar: string;
  name: string;
  action: string;
  detail: string;
  time: string;
}) {
  return (
    <div className="activity-item">
      <div className="activity-avatar">{avatar}</div>

      <div className="activity-content">
        <p>
          <strong>{name}</strong> {action}
        </p>

        <span>{detail}</span>
        <small>{time}</small>
      </div>
    </div>
  );
}

function Deadline({
  day,
  month,
  title,
  project,
  priority,
}: {
  day: string;
  month: string;
  title: string;
  project: string;
  priority: string;
}) {
  return (
    <div className="deadline-item">
      <div className="date-box">
        <strong>{day}</strong>
        <span>{month}</span>
      </div>

      <div className="deadline-info">
        <strong>{title}</strong>
        <span>{project}</span>
      </div>

      <span
        className={`priority ${priority.toLowerCase()}`}
      >
        {priority}
      </span>
    </div>
  );
}

export default App;
