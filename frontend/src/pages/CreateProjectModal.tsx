import { useState, type FormEvent, useEffect } from "react";
import { X } from "lucide-react";
import { createProjectApi } from "../services/projectApi";
import type { MappedProject } from "../services/projectApi";

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProjectCreated: (project: MappedProject) => void;
    workspaceId: string | undefined;
}

export function CreateProjectModal({ isOpen, onClose, onProjectCreated, workspaceId }: CreateProjectModalProps) {
    const [name, setName] = useState("");
    const [category, setCategory] = useState("Engineering");
    const [code, setCode] = useState("");
    const [description, setDescription] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

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

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!name.trim()) {
            setError("Project name is required");
            return;
        }
        if (!workspaceId) {
            setError("No active workspace selected");
            return;
        }

        setSubmitting(true);
        try {
            const newProj = await createProjectApi({
                name: name.trim(),
                category: category.trim() || undefined,
                code: code.trim() || undefined,
                description: description.trim() || undefined,
                dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
                workspaceId,
            });
            onProjectCreated(newProj);
            setName("");
            setCode("");
            setDescription("");
            setDueDate("");
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to create project");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div
                className="task-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Create new project"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="task-modal-header">
                    <h3>Create New Project</h3>
                    <button className="modal-close" onClick={onClose} aria-label="Close" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="task-modal-body">
                    {error && (
                        <div style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "1rem" }}>
                            {error}
                        </div>
                    )}

                    <div className="modal-field">
                        <label htmlFor="proj-name">Project Name *</label>
                        <input
                            id="proj-name"
                            type="text"
                            placeholder="e.g. Website Redesign"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="modal-field">
                        <label htmlFor="proj-code">Project Code</label>
                        <input
                            id="proj-code"
                            type="text"
                            placeholder="e.g. REDESIGN (short code for initials)"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                        />
                    </div>

                    <div className="modal-field">
                        <label htmlFor="proj-category">Category</label>
                        <select
                            id="proj-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            <option value="Engineering">Engineering</option>
                            <option value="Design">Design</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Product">Product</option>
                            <option value="General">General</option>
                        </select>
                    </div>

                    <div className="modal-field">
                        <label htmlFor="proj-due-date">Due Date</label>
                        <input
                            id="proj-due-date"
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                        />
                    </div>

                    <div className="modal-field">
                        <label htmlFor="proj-desc">Description</label>
                        <textarea
                            id="proj-desc"
                            rows={3}
                            placeholder="Briefly describe the project goals..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={submitting}>
                            {submitting ? "Creating..." : "Create Project"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
