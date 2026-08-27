import { useState, type FormEvent, useEffect } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { createOrganizationApi } from "../services/orgApi";
import { createWorkspaceApi } from "../services/workspaceApi";
import "./Modal.css";

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export function CreateWorkspaceModal({ isOpen, onClose }: Props) {
    const { organizations, refreshContext } = useWorkspace();
    const [name, setName] = useState("");
    const [orgChoice, setOrgChoice] = useState<"existing" | "new">("existing");
    const [selectedOrgId, setSelectedOrgId] = useState<string>("");
    const [newOrgName, setNewOrgName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setName("");
            setNewOrgName("");
            setError(null);
            if (organizations.length > 0) {
                setOrgChoice("existing");
                setSelectedOrgId(organizations[0].id);
            } else {
                setOrgChoice("new");
                setSelectedOrgId("");
            }
        }
    }, [isOpen, organizations]);

    if (!isOpen) return null;

    const generateSlug = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!name.trim()) {
            setError("Workspace name is required");
            return;
        }

        setLoading(true);
        try {
            let finalOrgId = selectedOrgId;

            if (orgChoice === "new") {
                if (!newOrgName.trim()) {
                    throw new Error("Organization name is required");
                }
                const orgSlug = generateSlug(newOrgName);
                const newOrg = await createOrganizationApi(newOrgName.trim(), orgSlug);
                finalOrgId = newOrg.id;
            }

            if (!finalOrgId) {
                throw new Error("Please select an organization");
            }

            const wsSlug = generateSlug(name);
            await createWorkspaceApi(finalOrgId, name.trim(), wsSlug);
            
            // Refresh global context to pull new org/workspace
            await refreshContext();
            onClose();
        } catch (err: any) {
            console.error("Create Workspace Error:", err);
            setError(err.message || "Failed to create workspace");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: "450px" }}>
                <button className="modal-close" onClick={onClose}>×</button>
                <div className="modal-header">
                    <h2>Create Workspace</h2>
                    <p>Set up a new workspace for your team's projects.</p>
                </div>

                <form onSubmit={handleSubmit} className="modal-body form-layout">
                    {error && (
                        <div style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "1rem", padding: "10px", background: "#fef2f2", borderRadius: "4px" }}>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label>Workspace Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Engineering, Marketing..."
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label>Organization</label>
                        
                        {organizations.length > 0 && (
                            <div style={{ marginBottom: "12px", display: "flex", gap: "16px" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "normal" }}>
                                    <input 
                                        type="radio" 
                                        checked={orgChoice === "existing"} 
                                        onChange={() => setOrgChoice("existing")} 
                                    />
                                    Use Existing
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "normal" }}>
                                    <input 
                                        type="radio" 
                                        checked={orgChoice === "new"} 
                                        onChange={() => setOrgChoice("new")} 
                                    />
                                    Create New
                                </label>
                            </div>
                        )}

                        {orgChoice === "existing" && organizations.length > 0 ? (
                            <select 
                                value={selectedOrgId} 
                                onChange={(e) => setSelectedOrgId(e.target.value)}
                                required
                            >
                                {organizations.map((org) => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={newOrgName}
                                onChange={(e) => setNewOrgName(e.target.value)}
                                placeholder="Organization Name (e.g. Acme Corp)"
                                required={orgChoice === "new"}
                            />
                        )}
                    </div>

                    <div className="modal-actions" style={{ marginTop: "24px" }}>
                        <button type="button" className="cs-btn cs-btn-secondary" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="cs-btn cs-btn-primary" disabled={loading}>
                            {loading ? "Creating..." : "Create Workspace"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
