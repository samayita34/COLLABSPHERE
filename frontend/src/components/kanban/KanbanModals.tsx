import React, { useState } from "react";
import { type Board, type Column, type Swimlane } from "../../services/projectApi";
import { X } from "lucide-react";

/* --- Create / Edit Board Modal --- */
interface BoardModalProps {
    isOpen: boolean;
    mode: "create" | "edit";
    board?: Board | null;
    onClose: () => void;
    onSave: (data: { name: string; description?: string; template?: string }) => void;
}

export const BoardModal: React.FC<BoardModalProps> = ({
    isOpen,
    mode,
    board,
    onClose,
    onSave,
}) => {
    const [name, setName] = useState(board?.name || "");
    const [description, setDescription] = useState(board?.description || "");
    const [template, setTemplate] = useState("default");

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), description: description.trim() || undefined, template });
    };

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div className="task-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
                <div className="task-modal-header">
                    <h3>{mode === "create" ? "Create New Board" : "Edit Board"}</h3>
                    <button className="modal-close" onClick={onClose}><X size={16} /></button>
                </div>

                <form onSubmit={handleSubmit} className="task-modal-body">
                    <div className="field">
                        <label htmlFor="board-name">Board Name</label>
                        <input
                            id="board-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Sprint 24, Bug Triage, Mobile Roadmap"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="board-desc">Description (Optional)</label>
                        <textarea
                            id="board-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Briefly describe what this board tracks..."
                            rows={3}
                        />
                    </div>

                    {mode === "create" && (
                        <div className="field">
                            <label>Board Template</label>
                            <select value={template} onChange={(e) => setTemplate(e.target.value)}>
                                <option value="default">Standard Kanban (To Do, In Progress, Done)</option>
                                <option value="scrum">Scrum Sprint (Backlog, In Progress, Review, QA, Done)</option>
                                <option value="bug-tracker">Bug Tracker (Reported, Investigating, Fixing, Verified, Resolved)</option>
                            </select>
                        </div>
                    )}

                    <div className="task-modal-footer" style={{ padding: "16px 0 0 0" }}>
                        <span />
                        <div className="task-modal-footer-actions">
                            <button type="button" className="modal-cancel" onClick={onClose}>Cancel</button>
                            <button type="submit" className="modal-save" disabled={!name.trim()}>
                                {mode === "create" ? "Create Board" : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* --- Column Modal --- */
interface ColumnModalProps {
    isOpen: boolean;
    mode: "create" | "edit";
    column?: Column | null;
    onClose: () => void;
    onSave: (data: { name: string }) => void;
}

export const ColumnModal: React.FC<ColumnModalProps> = ({
    isOpen,
    mode,
    column,
    onClose,
    onSave,
}) => {
    const [name, setName] = useState(column?.name || "");

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim() });
    };

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div className="task-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: "420px" }}>
                <div className="task-modal-header">
                    <h3>{mode === "create" ? "Add Column" : "Edit Column"}</h3>
                    <button className="modal-close" onClick={onClose}><X size={16} /></button>
                </div>

                <form onSubmit={handleSubmit} className="task-modal-body">
                    <div className="field">
                        <label htmlFor="col-name">Column Name</label>
                        <input
                            id="col-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Ready for QA, In Design, Blocked"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="task-modal-footer" style={{ padding: "16px 0 0 0" }}>
                        <span />
                        <div className="task-modal-footer-actions">
                            <button type="button" className="modal-cancel" onClick={onClose}>Cancel</button>
                            <button type="submit" className="modal-save" disabled={!name.trim()}>
                                {mode === "create" ? "Add Column" : "Save"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* --- Swimlane Modal --- */
interface SwimlaneModalProps {
    isOpen: boolean;
    mode: "create" | "edit";
    swimlane?: Swimlane | null;
    onClose: () => void;
    onSave: (data: { name: string }) => void;
}

export const SwimlaneModal: React.FC<SwimlaneModalProps> = ({
    isOpen,
    mode,
    swimlane,
    onClose,
    onSave,
}) => {
    const [name, setName] = useState(swimlane?.name || "");

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim() });
    };

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div className="task-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: "420px" }}>
                <div className="task-modal-header">
                    <h3>{mode === "create" ? "Add Swimlane" : "Edit Swimlane"}</h3>
                    <button className="modal-close" onClick={onClose}><X size={16} /></button>
                </div>

                <form onSubmit={handleSubmit} className="task-modal-body">
                    <div className="field">
                        <label htmlFor="lane-name">Swimlane Name</label>
                        <input
                            id="lane-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Frontend Team, Expedited, Backend API"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="task-modal-footer" style={{ padding: "16px 0 0 0" }}>
                        <span />
                        <div className="task-modal-footer-actions">
                            <button type="button" className="modal-cancel" onClick={onClose}>Cancel</button>
                            <button type="submit" className="modal-save" disabled={!name.trim()}>
                                {mode === "create" ? "Add Swimlane" : "Save"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* --- Create Label Modal --- */
const PRESET_COLORS = [
    "#ef4444", // Red / Bug
    "#f59e0b", // Amber / Warning
    "#10b981", // Emerald / Done
    "#3b82f6", // Blue / Feature
    "#8b5cf6", // Purple / Design
    "#ec4899", // Pink / Marketing
    "#06b6d4", // Cyan / DevOps
    "#64748b", // Slate / Misc
];

interface CreateLabelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { name: string; color: string }) => void;
}

export const CreateLabelModal: React.FC<CreateLabelModalProps> = ({
    isOpen,
    onClose,
    onSave,
}) => {
    const [name, setName] = useState("");
    const [color, setColor] = useState(PRESET_COLORS[3]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), color });
        setName("");
    };

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div className="task-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: "420px" }}>
                <div className="task-modal-header">
                    <h3>Create New Label</h3>
                    <button className="modal-close" onClick={onClose}><X size={16} /></button>
                </div>

                <form onSubmit={handleSubmit} className="task-modal-body">
                    <div className="field">
                        <label htmlFor="label-name">Label Name</label>
                        <input
                            id="label-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Bug, Feature, Urgent, Security"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="field">
                        <label>Color</label>
                        <div className="kb-color-palette">
                            {PRESET_COLORS.map((c) => (
                                <div
                                    key={c}
                                    className={`kb-color-dot ${color === c ? "selected" : ""}`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => setColor(c)}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="task-modal-footer" style={{ padding: "16px 0 0 0" }}>
                        <span />
                        <div className="task-modal-footer-actions">
                            <button type="button" className="modal-cancel" onClick={onClose}>Cancel</button>
                            <button type="submit" className="modal-save" disabled={!name.trim()}>
                                Create Label
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
