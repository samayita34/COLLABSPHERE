import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { fetchWorkspaceChatUsers, createDirectMessageApi, type ChatUser, type Channel } from "../../services/chatApi";
import { useAuth } from "../../context/AuthContext";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    workspaceId?: string;
    onSelectChannel: (channel: Channel) => void;
}

export const NewDirectMessageModal: React.FC<Props> = ({ isOpen, onClose, workspaceId, onSelectChannel }) => {
    const { user } = useAuth();
    const [users, setUsers] = useState<ChatUser[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setError(null);
            fetchWorkspaceChatUsers(workspaceId)
                .then((res) => {
                    // Exclude current user
                    setUsers(res.filter((u) => u.id !== user?.id));
                })
                .catch((err) => {
                    console.error("Error loading chat users:", err);
                    setError("Failed to load workspace members");
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, workspaceId, user?.id]);

    if (!isOpen) return null;

    const filteredUsers = users.filter((u) => {
        const full = `${u.firstName} ${u.lastName}`.toLowerCase();
        return full.includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    });

    const handleSelectUser = async (targetUser: ChatUser) => {
        try {
            setLoading(true);
            const channel = await createDirectMessageApi(targetUser.id, workspaceId);
            onSelectChannel(channel);
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to start direct message");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{
                background: "white", borderRadius: "12px", width: "420px", maxWidth: "90vw", padding: "20px", maxHeight: "80vh", display: "flex", flexDirection: "column"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>New Direct Message</h3>
                    <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b", display: "inline-flex", alignItems: "center" }} aria-label="Close"><X size={18} /></button>
                </div>

                <input
                    type="text"
                    placeholder="Search people..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "14px", outline: "none", fontSize: "0.9rem"
                    }}
                />

                {error && <div style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: "10px" }}>{error}</div>}

                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {loading && <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>Loading members...</div>}
                    {!loading && filteredUsers.length === 0 && (
                        <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>No members found.</div>
                    )}
                    {!loading && filteredUsers.map((u) => {
                        const initials = `${u.firstName[0] || ""}${u.lastName[0] || ""}`.toUpperCase() || u.email.slice(0, 2).toUpperCase();
                        return (
                            <div
                                key={u.id}
                                onClick={() => handleSelectUser(u)}
                                style={{
                                    display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", transition: "background 0.15s"
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                                <div style={{
                                    width: "36px", height: "36px", borderRadius: "50%", background: "#0284c7", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "0.85rem"
                                }}>
                                    {initials}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>{u.firstName} {u.lastName}</div>
                                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{u.email}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
