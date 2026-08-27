import { useState, useEffect } from "react";
import { type Workspace, fetchWorkspaceMembers, addWorkspaceMemberApi, removeWorkspaceMemberApi } from "../services/workspaceApi";
import type { Member } from "../services/projectApi";
import "./Modal.css";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    workspace: Workspace;
}

export function WorkspaceSettingsModal({ isOpen, onClose, workspace }: Props) {
    const [activeTab, setActiveTab] = useState<"general" | "members">("general");
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Add Member State
    const [addEmail, setAddEmail] = useState("");
    const [addRole, setAddRole] = useState("MEMBER");
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        if (isOpen && activeTab === "members") {
            loadMembers();
        }
    }, [isOpen, activeTab, workspace.id]);

    const loadMembers = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchWorkspaceMembers(workspace.id);
            setMembers(data);
        } catch (err: any) {
            setError(err.message || "Failed to load members");
        } finally {
            setLoading(false);
        }
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addEmail.trim()) return;
        setAdding(true);
        setError(null);
        try {
            const newMember = await addWorkspaceMemberApi(workspace.id, addEmail.trim(), addRole);
            setMembers((prev) => [...prev, newMember]);
            setAddEmail("");
        } catch (err: any) {
            setError(err.message || "Failed to add member");
        } finally {
            setAdding(false);
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!confirm("Are you sure you want to remove this member?")) return;
        try {
            await removeWorkspaceMemberApi(workspace.id, userId);
            setMembers((prev) => prev.filter((m) => m.userId !== userId));
        } catch (err: any) {
            alert(err.message || "Failed to remove member");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: "600px", minHeight: "400px", display: "flex", flexDirection: "column" }}>
                <button className="modal-close" onClick={onClose}>×</button>
                <div className="modal-header">
                    <h2>Workspace Settings</h2>
                    <p>{workspace.name}</p>
                </div>

                <div className="tabs" style={{ marginBottom: "20px" }}>
                    <button
                        className={activeTab === "general" ? "active" : ""}
                        onClick={() => setActiveTab("general")}
                    >
                        General
                    </button>
                    <button
                        className={activeTab === "members" ? "active" : ""}
                        onClick={() => setActiveTab("members")}
                    >
                        Members
                    </button>
                </div>

                <div className="modal-body form-layout" style={{ flex: 1, overflowY: "auto" }}>
                    {error && (
                        <div style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "1rem", padding: "10px", background: "#fef2f2", borderRadius: "4px" }}>
                            {error}
                        </div>
                    )}

                    {activeTab === "general" && (
                        <div>
                            <div className="form-group">
                                <label>Workspace Name</label>
                                <input type="text" value={workspace.name} disabled />
                            </div>
                            <div className="form-group">
                                <label>Organization ID</label>
                                <input type="text" value={workspace.organizationId} disabled />
                            </div>
                            <div className="form-group">
                                <label>Slug</label>
                                <input type="text" value={workspace.slug} disabled />
                            </div>
                            <div style={{ marginTop: "24px", color: "#64748b", fontSize: "0.875rem" }}>
                                To edit these details, please contact an administrator.
                            </div>
                        </div>
                    )}

                    {activeTab === "members" && (
                        <div>
                            <form onSubmit={handleAddMember} style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
                                <input
                                    type="email"
                                    placeholder="user@example.com"
                                    value={addEmail}
                                    onChange={(e) => setAddEmail(e.target.value)}
                                    style={{ flex: 1 }}
                                    required
                                />
                                <select value={addRole} onChange={(e) => setAddRole(e.target.value)}>
                                    <option value="MEMBER">Member</option>
                                    <option value="WORKSPACE_ADMIN">Admin</option>
                                    <option value="PROJECT_MANAGER">Manager</option>
                                    <option value="GUEST">Guest</option>
                                </select>
                                <button type="submit" className="cs-btn cs-btn-primary" disabled={adding}>
                                    {adding ? "Adding..." : "Invite"}
                                </button>
                            </form>

                            {loading ? (
                                <div style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>Loading members...</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    {members.map((m) => (
                                        <div key={m.userId || m.email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: "bold", color: "#475569" }}>
                                                    {m.initials}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#1e293b" }}>{m.name}</div>
                                                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{m.email} · {m.role}</div>
                                                </div>
                                            </div>
                                            
                                            <button 
                                                onClick={() => m.userId && handleRemoveMember(m.userId)}
                                                style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}
                                                disabled={!m.userId}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                    {members.length === 0 && (
                                        <div style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>No members found.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
