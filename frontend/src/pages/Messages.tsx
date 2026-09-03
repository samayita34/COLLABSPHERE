import { useWorkspace } from "../context/WorkspaceContext";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopbar } from "../components/AppTopbar";
import { WhatsAppChat } from "../components/chat/WhatsAppChat";
import "./Projects.css";
import "./ProjectWorkspace.css";
import "./Messages.css";

export default function Messages() {
    const { activeWorkspace } = useWorkspace();

    return (
        <div className="projects-page">
            <AppSidebar activePage="messages" />

            {/* MAIN CONTENT */}
            <main className="projects-main" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
                <AppTopbar pageTitle="Messages" />

                <div style={{ flex: 1, padding: "16px 24px 24px 24px", minHeight: 0, display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
                    <WhatsAppChat workspaceId={activeWorkspace?.id} />
                </div>
            </main>
        </div>
    );
}
