import React from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import ActivityTimeline from "../components/ActivityTimeline";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopbar } from "../components/AppTopbar";
import "./Projects.css";
import "./ActivityLog.css";

/**
 * Full-page Activity Log — accessible from sidebar → "Activity Log".
 * Shows workspace-wide events with category filters, search, and date range.
 */
const ActivityLog: React.FC = () => {
    const { activeWorkspace } = useWorkspace();

    return (
        <div className="projects-page">
            <AppSidebar activePage="activity-log" />

            {/* MAIN VIEWPORT */}
            <main className="projects-main">
                <AppTopbar pageTitle="Activity Log" searchPlaceholder="Search audit logs..." />

                {/* CONTENT */}
                <section className="content">
                    <div className="page-heading">
                        <div>
                            <h1>Workspace Activity &amp; Audit Log</h1>
                            <p>
                                Track every important event within{" "}
                                <strong>{activeWorkspace?.name || "your workspace"}</strong> —
                                logins, task updates, document changes, file uploads, role changes &amp; member invitations.
                            </p>
                        </div>
                    </div>

                    {activeWorkspace ? (
                        <div className="activity-log-panel">
                            <ActivityTimeline workspaceId={activeWorkspace.id} />
                        </div>
                    ) : (
                        <div className="activity-log-no-workspace">
                            <span>🏠</span>
                            <p>Select a workspace from the sidebar to view its activity log.</p>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default ActivityLog;
