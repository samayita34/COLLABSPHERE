import { useState, type FormEvent, useEffect } from "react";
import { updateProjectApi, deleteProjectApi, type MappedProject } from "../services/projectApi";
import { useAuth } from "../context/AuthContext";

interface ProjectSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: MappedProject;
    onProjectUpdated: (updated: MappedProject) => void;
    onProjectDeleted: () => void;
}

const CATEGORY_SUGGESTIONS = ["Engineering", "Product", "Design", "Marketing", "Operations", "Research"];

export function ProjectSettingsModal({
    isOpen,
    onClose,
    project,
    onProjectUpdated,
    onProjectDeleted,
}: ProjectSettingsModalProps) {
    const { user } = useAuth();

    // Permissions check
    const isOwner = !!(user?.id && project.ownerId === user.id);
    const memberRecord = project.members?.find((m) => m.userId === user?.id);
    const isProjectAdmin = isOwner || memberRecord?.role === "ADMIN";
    const isGlobalOrWsAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ORG_ADMIN" || user?.role === "WORKSPACE_ADMIN";
    const canEdit = project.canEdit ?? (isProjectAdmin || isGlobalOrWsAdmin);
    const canDelete = project.canDelete ?? (isProjectAdmin || isGlobalOrWsAdmin);

    const [name, setName] = useState(project.name);
    const [code, setCode] = useState(project.code || "");
    const [category, setCategory] = useState(project.category || "Engineering");
    const [description, setDescription] = useState(project.description || "");
    const [status, setStatus] = useState<"ACTIVE" | "COMPLETED" | "ARCHIVED">(project.status || "ACTIVE");
    const [dueDate, setDueDate] = useState<string>("");

    const [saving, setSaving] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Sync form state when project changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setName(project.name);
            setCode(project.code || "");
            setCategory(project.category || "Engineering");
            setDescription(project.description || "");
            setStatus(project.status || "ACTIVE");

            if (project.dueDate) {
                const d = new Date(project.dueDate);
                if (!isNaN(d.getTime())) {
                    setDueDate(d.toISOString().split("T")[0]);
                }
            } else {
                setDueDate("");
            }
            setError(null);
            setSuccessMsg(null);
            setShowArchiveConfirm(false);
            setShowDeleteConfirm(false);
        }
    }, [isOpen, project]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            window.addEventListener("keydown", handler);
        }
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        if (!canEdit) return;

        setError(null);
        setSuccessMsg(null);

        if (!name.trim()) {
            setError("Project name cannot be empty");
            return;
        }

        setSaving(true);
        try {
            const updated = await updateProjectApi(project.id, {
                name: name.trim(),
                code: code.trim() ? code.trim().toUpperCase() : null,
                category: category.trim() || null,
                description: description.trim() || null,
                status,
                dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            });
            setSuccessMsg("Settings updated successfully!");
            onProjectUpdated(updated);
            setTimeout(() => {
                onClose();
            }, 600);
        } catch (err: any) {
            setError(err.message || "Failed to update project settings");
        } finally {
            setSaving(false);
        }
    };

    const executeArchiveToggle = async () => {
        if (!canEdit) return;

        const nextStatus = status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";
        setArchiving(true);
        setError(null);
        try {
            const updated = await updateProjectApi(project.id, { status: nextStatus });
            setStatus(nextStatus);
            setShowArchiveConfirm(false);
            onProjectUpdated(updated);
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to update project archive status");
        } finally {
            setArchiving(false);
        }
    };

    const executeDelete = async () => {
        if (!canDelete) return;

        setDeleting(true);
        setError(null);
        try {
            await deleteProjectApi(project.id);
            setShowDeleteConfirm(false);
            onClose();
            onProjectDeleted();
        } catch (err: any) {
            setError(err.message || "Failed to delete project");
            setDeleting(false);
        }
    };

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div
                className="task-modal"
                style={{ maxWidth: "620px", maxHeight: "90vh", borderRadius: "14px" }}
                role="dialog"
                aria-modal="true"
                aria-label="Project Settings"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="task-modal-header" style={{ padding: "18px 24px" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>Project Settings</h3>
                            <span
                                style={{
                                    fontSize: "0.7rem",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontWeight: 600,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                    background: canEdit ? "#e0f2fe" : "#f1f5f9",
                                    color: canEdit ? "#0369a1" : "#64748b",
                                    border: `1px solid ${canEdit ? "#bae6fd" : "#cbd5e1"}`,
                                }}
                            >
                                {isOwner ? "👑 Owner" : isProjectAdmin ? "👑 Admin" : isGlobalOrWsAdmin ? "⚡ Workspace Admin" : "👁️ Member (Read-Only)"}
                            </span>
                        </div>
                        <p style={{ margin: "3px 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                            Manage general settings, status, lifecycle, and identity for {project.name}.
                        </p>
                    </div>
                    <button className="modal-close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSave} className="task-modal-body" style={{ padding: "20px 24px", overflowY: "auto" }}>
                    {/* Read-Only RBAC Notification */}
                    {!canEdit && (
                        <div
                            style={{
                                background: "#f8fafc",
                                border: "1px solid #cbd5e1",
                                borderLeft: "4px solid #64748b",
                                padding: "12px 16px",
                                borderRadius: "8px",
                                fontSize: "0.82rem",
                                color: "#334155",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                marginBottom: "4px",
                            }}
                        >
                            <span style={{ fontSize: "1.2rem" }}>🔒</span>
                            <div>
                                <strong>Read-Only Mode:</strong> You are viewing this project with member permissions. Only Project Administrators or Workspace Owners can edit settings, change status, or delete this project.
                            </div>
                        </div>
                    )}

                    {error && (
                        <div style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: "8px", fontSize: "0.85rem" }}>
                            {error}
                        </div>
                    )}

                    {successMsg && (
                        <div style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", padding: "10px 14px", borderRadius: "8px", fontSize: "0.85rem" }}>
                            ✓ {successMsg}
                        </div>
                    )}

                    {/* Field: Project Name */}
                    <div className="field">
                        <label htmlFor="proj-name">Project Name *</label>
                        <input
                            id="proj-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Website Redesign"
                            required
                            disabled={!canEdit}
                            style={{
                                background: !canEdit ? "#f8fafc" : "#ffffff",
                                cursor: !canEdit ? "not-allowed" : "text",
                            }}
                        />
                    </div>

                    {/* Row: Code & Category */}
                    <div className="field-row">
                        <div className="field">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <label htmlFor="proj-code">Project Code / Tag</label>
                                {code.trim() && (
                                    <span
                                        style={{
                                            fontFamily: "monospace",
                                            fontSize: "0.75rem",
                                            background: "#232a3d",
                                            color: "#ffffff",
                                            padding: "1px 6px",
                                            borderRadius: "4px",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {code.trim().toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <input
                                id="proj-code"
                                type="text"
                                placeholder="e.g. WR, API, APP"
                                maxLength={10}
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                disabled={!canEdit}
                                style={{
                                    textTransform: "uppercase",
                                    fontFamily: "monospace",
                                    background: !canEdit ? "#f8fafc" : "#ffffff",
                                    cursor: !canEdit ? "not-allowed" : "text",
                                }}
                            />
                            <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Short uppercase identifier used for task tags and project mark.</span>
                        </div>

                        <div className="field">
                            <label htmlFor="proj-category">Category</label>
                            <input
                                id="proj-category"
                                type="text"
                                placeholder="e.g. Engineering, Design"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                disabled={!canEdit}
                                style={{
                                    background: !canEdit ? "#f8fafc" : "#ffffff",
                                    cursor: !canEdit ? "not-allowed" : "text",
                                }}
                            />
                            {/* Category quick chips */}
                            {canEdit && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                                    {CATEGORY_SUGGESTIONS.map((cat) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setCategory(cat)}
                                            style={{
                                                background: category === cat ? "#e2e8f0" : "#f8fafc",
                                                border: "1px solid #e2e8f0",
                                                borderRadius: "4px",
                                                padding: "1px 6px",
                                                fontSize: "0.68rem",
                                                color: category === cat ? "#0f172a" : "#64748b",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Row: Status & Target Due Date */}
                    <div className="field-row">
                        <div className="field">
                            <label>Lifecycle Status</label>
                            <div className="segmented" style={{ marginTop: "2px" }}>
                                <button
                                    type="button"
                                    className={status === "ACTIVE" ? "active" : ""}
                                    onClick={() => canEdit && setStatus("ACTIVE")}
                                    disabled={!canEdit}
                                    style={{
                                        cursor: !canEdit ? "not-allowed" : "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                    }}
                                >
                                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: status === "ACTIVE" ? "#22c55e" : "#94a3b8" }} />
                                    Active
                                </button>
                                <button
                                    type="button"
                                    className={status === "COMPLETED" ? "active" : ""}
                                    onClick={() => canEdit && setStatus("COMPLETED")}
                                    disabled={!canEdit}
                                    style={{
                                        cursor: !canEdit ? "not-allowed" : "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                    }}
                                >
                                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: status === "COMPLETED" ? "#3b82f6" : "#94a3b8" }} />
                                    Completed
                                </button>
                                <button
                                    type="button"
                                    className={status === "ARCHIVED" ? "active" : ""}
                                    onClick={() => canEdit && setStatus("ARCHIVED")}
                                    disabled={!canEdit}
                                    style={{
                                        cursor: !canEdit ? "not-allowed" : "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                    }}
                                >
                                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: status === "ARCHIVED" ? "#f59e0b" : "#94a3b8" }} />
                                    Archived
                                </button>
                            </div>
                        </div>

                        <div className="field">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <label htmlFor="proj-due">Target / Due Date</label>
                                {dueDate && canEdit && (
                                    <button
                                        type="button"
                                        onClick={() => setDueDate("")}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "#ef4444",
                                            fontSize: "0.72rem",
                                            cursor: "pointer",
                                            padding: 0,
                                        }}
                                    >
                                        Clear date
                                    </button>
                                )}
                            </div>
                            <input
                                id="proj-due"
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                disabled={!canEdit}
                                style={{
                                    background: !canEdit ? "#f8fafc" : "#ffffff",
                                    cursor: !canEdit ? "not-allowed" : "text",
                                }}
                            />
                            <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Optional deadline for project completion.</span>
                        </div>
                    </div>

                    {/* Field: Description */}
                    <div className="field">
                        <label htmlFor="proj-desc">Description</label>
                        <textarea
                            id="proj-desc"
                            rows={3}
                            placeholder="Brief summary of the project goals, scope, and deliverables..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={!canEdit}
                            style={{
                                background: !canEdit ? "#f8fafc" : "#ffffff",
                                cursor: !canEdit ? "not-allowed" : "text",
                            }}
                        />
                    </div>

                    {/* Meta bar */}
                    <div
                        style={{
                            background: "#f8fafc",
                            padding: "10px 14px",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            fontSize: "0.78rem",
                            color: "#64748b",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <span>Project ID: <code style={{ color: "#334155", background: "#e2e8f0", padding: "1px 5px", borderRadius: "4px" }}>{project.id.slice(0, 10)}...</code></span>
                        <span>👥 {project.members?.length || 0} team members</span>
                    </div>

                    {/* Inline Archive Confirmation */}
                    {showArchiveConfirm && (
                        <div
                            style={{
                                background: "#fffbeb",
                                border: "1px solid #fde68a",
                                padding: "12px 16px",
                                borderRadius: "8px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "10px",
                                marginTop: "4px",
                            }}
                        >
                            <span style={{ fontSize: "0.82rem", color: "#92400e", fontWeight: 500 }}>
                                {status === "ARCHIVED" ? "Reactivate this project to make it visible in active workspace views?" : "Archive this project and hide it from active workspace views?"}
                            </span>
                            <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                    type="button"
                                    onClick={() => setShowArchiveConfirm(false)}
                                    style={{
                                        padding: "5px 10px",
                                        borderRadius: "5px",
                                        border: "1px solid #cbd5e1",
                                        background: "#fff",
                                        fontSize: "0.78rem",
                                        cursor: "pointer",
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={executeArchiveToggle}
                                    disabled={archiving}
                                    style={{
                                        padding: "5px 12px",
                                        borderRadius: "5px",
                                        border: "none",
                                        background: "#d97706",
                                        color: "#fff",
                                        fontWeight: 600,
                                        fontSize: "0.78rem",
                                        cursor: "pointer",
                                    }}
                                >
                                    {archiving ? "Updating..." : status === "ARCHIVED" ? "Confirm Reactivate" : "Confirm Archive"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div
                        style={{
                            marginTop: "8px",
                            paddingTop: "14px",
                            borderTop: "1px solid #f1f5f9",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        {/* Archive Toggle Button */}
                        {canEdit ? (
                            <button
                                type="button"
                                onClick={() => setShowArchiveConfirm(!showArchiveConfirm)}
                                disabled={archiving || saving || deleting}
                                style={{
                                    background: status === "ARCHIVED" ? "#fef3c7" : "#f1f5f9",
                                    border: `1px solid ${status === "ARCHIVED" ? "#fde68a" : "#cbd5e1"}`,
                                    color: status === "ARCHIVED" ? "#92400e" : "#334155",
                                    padding: "8px 14px",
                                    borderRadius: "7px",
                                    fontSize: "0.82rem",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    transition: "all 0.15s ease",
                                }}
                            >
                                {archiving ? "Updating..." : status === "ARCHIVED" ? "📂 Reactivate Project" : "📦 Archive Project"}
                            </button>
                        ) : (
                            <div />
                        )}

                        <div style={{ display: "flex", gap: "10px" }}>
                            <button
                                type="button"
                                className="modal-btn-cancel"
                                onClick={onClose}
                                disabled={saving}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: "7px",
                                    border: "1px solid #cbd5e1",
                                    background: "#ffffff",
                                    color: "#475569",
                                    fontSize: "0.85rem",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                }}
                            >
                                {canEdit ? "Cancel" : "Close"}
                            </button>
                            {canEdit && (
                                <button
                                    type="submit"
                                    disabled={saving || archiving || deleting}
                                    style={{
                                        padding: "8px 18px",
                                        borderRadius: "7px",
                                        border: "none",
                                        background: "#232a3d",
                                        color: "#f8fafc",
                                        fontSize: "0.85rem",
                                        fontWeight: 600,
                                        cursor: saving ? "wait" : "pointer",
                                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                    }}
                                >
                                    {saving ? "Saving Changes..." : "Save Changes"}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Danger Zone: Delete Project (Only for Admins/Owners) */}
                    {canDelete && (
                        <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid #fee2e2" }}>
                            {showDeleteConfirm ? (
                                <div
                                    style={{
                                        background: "#fef2f2",
                                        border: "1px solid #fecaca",
                                        padding: "14px 18px",
                                        borderRadius: "8px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "10px",
                                    }}
                                >
                                    <div>
                                        <strong style={{ color: "#991b1b", fontSize: "0.88rem", display: "block" }}>⚠️ Permanent Deletion</strong>
                                        <span style={{ color: "#b91c1c", fontSize: "0.8rem" }}>
                                            Are you absolutely sure you want to delete "{project.name}"? All associated tasks, files, and documents will be permanently destroyed.
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowDeleteConfirm(false)}
                                            style={{
                                                padding: "6px 12px",
                                                borderRadius: "6px",
                                                border: "1px solid #cbd5e1",
                                                background: "#fff",
                                                fontSize: "0.8rem",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={executeDelete}
                                            disabled={deleting}
                                            style={{
                                                padding: "6px 14px",
                                                borderRadius: "6px",
                                                border: "none",
                                                background: "#dc2626",
                                                color: "#fff",
                                                fontWeight: 600,
                                                fontSize: "0.8rem",
                                                cursor: deleting ? "wait" : "pointer",
                                            }}
                                        >
                                            {deleting ? "Deleting Project..." : "Yes, Delete Project"}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    style={{
                                        background: "#fff5f5",
                                        border: "1px solid #fecaca",
                                        padding: "12px 16px",
                                        borderRadius: "8px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: "12px",
                                    }}
                                >
                                    <div>
                                        <strong style={{ color: "#991b1b", fontSize: "0.85rem", display: "block" }}>Delete this project</strong>
                                        <span style={{ color: "#b91c1c", fontSize: "0.75rem" }}>
                                            Permanently delete this project along with all associated tasks, files, and documents.
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        disabled={deleting || saving || archiving}
                                        style={{
                                            background: "#dc2626",
                                            color: "#ffffff",
                                            border: "none",
                                            padding: "7px 14px",
                                            borderRadius: "7px",
                                            fontSize: "0.8rem",
                                            fontWeight: 600,
                                            cursor: "pointer",
                                            whiteSpace: "nowrap",
                                            boxShadow: "0 1px 3px rgba(220, 38, 38, 0.3)",
                                        }}
                                    >
                                        Delete Project
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
