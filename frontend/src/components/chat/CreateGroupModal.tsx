import React, { useState, useEffect } from "react";
import { fetchWorkspaceChatUsers, createGroupApi, type ChatUser, type Channel } from "../../services/chatApi";
import { useAuth } from "../../context/AuthContext";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    workspaceId?: string;
    onSelectChannel: (channel: Channel) => void;
}

export const CreateGroupModal: React.FC<Props> = ({ isOpen, onClose, workspaceId, onSelectChannel }) => {
    const { user } = useAuth();
    const [users, setUsers] = useState<ChatUser[]>([]);
    const [groupName, setGroupName] = useState("");
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setGroupName("");
            setSelectedUserIds([]);
            setSearch("");
            setLoading(true);
            setError(null);
            fetchWorkspaceChatUsers(workspaceId)
                .then((res) => {
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

    const toggleUser = (userId: string) => {
        setSelectedUserIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupName.trim()) {
            setError("Please enter a group name");
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const channel = await createGroupApi(groupName.trim(), selectedUserIds, workspaceId);
            onSelectChannel(channel);
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to create group");
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter((u) => {
        const full = `${u.firstName} ${u.lastName}`.toLowerCase();
        return full.includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    });

    return (
        <div className="modal-backdrop" onClick={onClose} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{
                background: "white", borderRadius: "12px", width: "460px", maxWidth: "90vw", padding: "20px", maxHeight: "85vh", display: "flex", flexDirection: "column"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>Create New Group</h3>
                    <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748b" }}>✕</button>
                </div>

                <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                    <div style={{ marginBottom: "14px" }}>
                        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Group Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Marketing Launch, Design Sync"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            required
                            style={{
                                width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "0.9rem", boxSizing: "border-box"
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>Add Members ({selectedUserIds.length} selected)</label>
                        </div>
                        <input
                            type="text"
                            placeholder="Filter members..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.85rem", boxSizing: "border-box"
                            }}
                        />
                    </div>

                    {error && <div style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: "10px" }}>{error}</div>}

                    <div style={{ flex: 1, overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: "8px", padding: "6px", marginBottom: "16px", minHeight: "150px" }}>
                        {loading && <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>Loading...</div>}
                        {!loading && filteredUsers.map((u) => {
                            const isSelected = selectedUserIds.includes(u.id);
                            const initials = `${u.firstName[0] || ""}${u.lastName[0] || ""}`.toUpperCase() || u.email.slice(0, 2).toUpperCase();
                            return (
                                <div
                                    key={u.id}
                                    onClick={() => toggleUser(u.id)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "6px", cursor: "pointer", background: isSelected ? "#f0fdf4" : "transparent"
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {}} // Handled by div click
                                        style={{ cursor: "pointer" }}
                                    />
                                    <div style={{
                                        width: "32px", height: "32px", borderRadius: "50%", background: "#10b981", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "0.8rem"
                                    }}>
                                        {initials}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>{u.firstName} {u.lastName}</div>
                                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{u.email}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                        <button type="button" onClick={onClose} style={{
                            padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "white", cursor: "pointer", fontWeight: 500
                        }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} style={{
                            padding: "8px 18px", borderRadius: "6px", border: "none", background: "#25d366", color: "white", cursor: "pointer", fontWeight: 600
                        }}>
                            {loading ? "Creating..." : "Create Group"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
