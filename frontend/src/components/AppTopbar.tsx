import React from "react";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useSidebar } from "../context/SidebarContext";
import NotificationCenter from "./NotificationCenter";

interface AppTopbarProps {
  pageTitle: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  children?: React.ReactNode;
}

export const AppTopbar: React.FC<AppTopbarProps> = ({
  pageTitle,
  searchPlaceholder = "Search anything...",
  searchValue,
  onSearchChange,
  children,
}) => {
  const { userInitials } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { toggleSidebar, isOpen } = useSidebar();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="hamburger-btn"
          onClick={toggleSidebar}
          title={isOpen ? "Toggle / Float Sidebar" : "Open Sidebar"}
          aria-label="Toggle navigation sidebar"
        >
          <svg 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="breadcrumb">
          {activeWorkspace?.name || "Workspace"} / <strong>{pageTitle}</strong>
        </div>
      </div>

      <div className="topbar-actions">
        {children}

        <div className="search">
          <span>⌕</span>
          <input
            placeholder={searchPlaceholder}
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          />
          <kbd>⌘ K</kbd>
        </div>

        <NotificationCenter workspaceId={activeWorkspace?.id} />

        <div className="profile-avatar">{userInitials}</div>
      </div>
    </header>
  );
};

export default AppTopbar;
