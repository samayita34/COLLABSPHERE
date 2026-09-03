import { useState, useRef, useEffect } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { CreateWorkspaceModal } from "./CreateWorkspaceModal";
import { WorkspaceSettingsModal } from "./WorkspaceSettingsModal";
import "./WorkspaceSelector.css";

export function WorkspaceSelector() {
    const { organizations, workspaces, activeOrganization, activeWorkspace, switchWorkspace, loading } = useWorkspace();
    const [isOpen, setIsOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [ref]);

    if (loading) {
        return (
            <div className="workspace loading">
                <div className="workspace-logo" />
                <div>
                    <strong>Loading...</strong>
                    <span>Workspace</span>
                </div>
            </div>
        );
    }

    if (!activeWorkspace) {
        return (
            <div className="workspace-selector-wrapper" ref={ref}>
                <div className="workspace clickable" onClick={() => setIsOpen(!isOpen)}>
                    <div className="workspace-logo" style={{ background: "#e2e8f0", color: "#64748b" }}>?</div>
                    <div>
                        <strong>No Workspace</strong>
                        <span>Select or create one</span>
                    </div>
                    <span className="chevron">⌄</span>
                </div>

                {isOpen && (
                    <div className="workspace-dropdown">
                        <div className="dropdown-empty">
                            No workspaces available.
                        </div>
                        <div className="dropdown-actions">
                            <button onClick={() => { setIsCreateModalOpen(true); setIsOpen(false); }}>
                                + Create Workspace
                            </button>
                        </div>
                    </div>
                )}

                <CreateWorkspaceModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
            </div>
        );
    }

    const initials = activeWorkspace.name.substring(0, 2).toUpperCase();

    return (
        <div className="workspace-selector-wrapper" ref={ref}>
            <div className="workspace clickable" onClick={() => setIsOpen(!isOpen)}>
                <div className="workspace-logo">{initials}</div>
                <div>
                    <strong>{activeWorkspace.name}</strong>
                    <span>{activeOrganization?.name || "Workspace"}</span>
                </div>
                <span className="chevron">⌄</span>
            </div>

            {isOpen && (
                <div className="workspace-dropdown">
                    <div className="dropdown-section-title">Organizations & Workspaces</div>
                    <div className="dropdown-list">
                        {organizations.map((org) => (
                            <div key={org.id} className="org-group">
                                <div className="org-name">{org.name}</div>
                                {workspaces[org.id]?.map((ws) => (
                                    <div
                                        key={ws.id}
                                        className={`ws-item ${ws.id === activeWorkspace.id ? "active" : ""}`}
                                        onClick={() => {
                                            switchWorkspace(ws.id);
                                            setIsOpen(false);
                                        }}
                                    >
                                        <div className="ws-icon">{ws.name.substring(0, 2).toUpperCase()}</div>
                                        <div className="ws-name">{ws.name}</div>
                                        {ws.id === activeWorkspace.id && <span className="ws-check">✓</span>}
                                    </div>
                                ))}
                                {(!workspaces[org.id] || workspaces[org.id].length === 0) && (
                                    <div className="ws-item empty">No workspaces</div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="dropdown-actions">
                        <button onClick={() => { setIsSettingsModalOpen(true); setIsOpen(false); }}>
                            ⚙️ Workspace Settings
                        </button>
                        <button onClick={() => { setIsCreateModalOpen(true); setIsOpen(false); }}>
                            + Create Workspace
                        </button>
                    </div>
                </div>
            )}

            <CreateWorkspaceModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
            {activeWorkspace && (
                <WorkspaceSettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => setIsSettingsModalOpen(false)}
                    workspace={activeWorkspace}
                />
            )}
        </div>
    );
}

export default WorkspaceSelector;
