import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { WorkspaceSelector } from "./WorkspaceSelector";
import { useSidebar } from "../context/SidebarContext";
import { usePermissions } from "../hooks/usePermissions";

interface AppSidebarProps {
  activePage: "overview" | "projects" | "tasks" | "documents" | "files" | "messages" | "activity-log" | "analytics" | "settings";
  projectsCount?: number;
  tasksCount?: number;
  documentsCount?: number;
  filesCount?: number;
  messagesCount?: number;
  activityCount?: number;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activePage,
  projectsCount,
  tasksCount,
  documentsCount,
  filesCount,
  messagesCount,
  activityCount,
}) => {
  const { userFullName, userInitials, logout } = useAuth();
  const { isOpen, setIsOpen } = useSidebar();
  const { role } = usePermissions();

  const formattedRole = role.replace("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <>
      {/* Mobile/Floating Backdrop */}
      {isOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR */}
      <aside className={`projects-sidebar ${isOpen ? "open" : "collapsed"}`}>
        <div className="brand">
          <span>Collabsphere</span>
          <small>ENT</small>
        </div>

        <WorkspaceSelector />

        <div className="nav-title">NAVIGATION</div>

        <nav>
          <Link 
            to="/overview" 
            className={activePage === "overview" ? "selected" : ""}
          >
            Overview
          </Link>

          <Link 
            to="/projects" 
            className={activePage === "projects" ? "selected" : ""}
          >
            Projects
            {typeof projectsCount === "number" && projectsCount > 0 && (
              <span>{projectsCount}</span>
            )}
          </Link>

          <Link 
            to="/my-tasks" 
            className={activePage === "tasks" ? "selected" : ""}
          >
            My Tasks
            {typeof tasksCount === "number" && tasksCount > 0 && (
              <span>{tasksCount}</span>
            )}
          </Link>

          <Link 
            to="/documents" 
            className={activePage === "documents" ? "selected" : ""}
          >
            Documents
            {typeof documentsCount === "number" && documentsCount > 0 && (
              <span>{documentsCount}</span>
            )}
          </Link>

          <Link 
            to="/files" 
            className={activePage === "files" ? "selected" : ""}
          >
            Files
            {typeof filesCount === "number" && filesCount > 0 && (
              <span>{filesCount}</span>
            )}
          </Link>

          <Link 
            to="/messages" 
            className={activePage === "messages" ? "selected" : ""}
          >
            Messages
            {typeof messagesCount === "number" && messagesCount > 0 && (
              <span>{messagesCount}</span>
            )}
          </Link>

          <Link 
            to="/activity-log" 
            className={activePage === "activity-log" ? "selected" : ""}
          >
            Activity Log
            {typeof activityCount === "number" && activityCount > 0 && (
              <span>{activityCount}</span>
            )}
          </Link>

          <Link 
            to="/analytics" 
            className={activePage === "analytics" ? "selected" : ""}
          >
            Analytics
          </Link>

          <Link 
            to="/settings" 
            className={activePage === "settings" ? "selected" : ""}
          >
            Settings
          </Link>
        </nav>

        <div className="profile">
          <div className="profile-avatar">{userInitials}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
              {userFullName}
            </strong>
            <span style={{ fontSize: "0.75rem", color: "#6366f1", fontWeight: 600 }}>{formattedRole}</span>
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
    </>
  );
};

export default AppSidebar;
