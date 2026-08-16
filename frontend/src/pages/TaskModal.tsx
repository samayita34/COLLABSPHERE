import { useEffect, useState } from "react";

/* =========================
   TYPES
   Mirrors the Task/Member shapes in ProjectWorkspace.tsx.
   Kept local so this component has no import-order coupling.
========================= */

type TaskStatus = "todo" | "progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high";

export interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    due: string;
    assignee: string;
}

interface Member {
    initials: string;
    name: string;
    role: string;
}

interface TaskModalProps {
    mode: "create" | "edit";
    task: Task | null;
    defaultStatus: TaskStatus;
    members: Member[];
    onClose: () => void;
    onSave: (task: Task) => void;
    onDelete: (id: string) => void;
}

const STATUS_OPTIONS: { key: TaskStatus; label: string }[] = [
    { key: "todo", label: "To do" },
    { key: "progress", label: "In progress" },
    { key: "review", label: "Review" },
    { key: "done", label: "Done" },
];

const PRIORITY_OPTIONS: { key: TaskPriority; label: string }[] = [
    { key: "low", label: "Low" },
    { key: "medium", label: "Medium" },
    { key: "high", label: "High" },
];

export default function TaskModal({
    mode,
    task,
    defaultStatus,
    members,
    onClose,
    onSave,
    onDelete,
}: TaskModalProps) {
    const [title, setTitle] = useState(task?.title ?? "");
    const [description, setDescription] = useState(task?.description ?? "");
    const [status, setStatus] = useState<TaskStatus>(task?.status ?? defaultStatus);
    const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
    const [due, setDue] = useState(task?.due ?? "");
    const [assignee, setAssignee] = useState(task?.assignee ?? members[0]?.initials ?? "");

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    const canSave = title.trim().length > 0;

    const handleSave = () => {
        if (!canSave) return;

        onSave({
            id: task?.id ?? `t-${Date.now()}`,
            title: title.trim(),
            description: description.trim() || undefined,
            status,
            priority,
            due: due.trim(),
            assignee,
        });
    };

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div
                className="task-modal"
                role="dialog"
                aria-modal="true"
                aria-label={mode === "create" ? "Create task" : "Edit task"}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="task-modal-header">
                    <h3>{mode === "create" ? "New task" : "Edit task"}</h3>
                    <button className="modal-close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                <div className="task-modal-body">
                    <div className="field">
                        <label>Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Task title"
                            autoFocus
                        />
                    </div>

                    <div className="field">
                        <label>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add more detail (optional)"
                            rows={3}
                        />
                    </div>

                    <div className="field">
                        <label>Status</label>
                        <div className="segmented">
                            {STATUS_OPTIONS.map((opt) => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    className={status === opt.key ? "active" : ""}
                                    onClick={() => setStatus(opt.key)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="field">
                        <label>Priority</label>
                        <div className="segmented">
                            {PRIORITY_OPTIONS.map((opt) => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    className={priority === opt.key ? "active" : ""}
                                    onClick={() => setPriority(opt.key)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="field-row">
                        <div className="field">
                            <label>Due date</label>
                            <input
                                type="text"
                                value={due}
                                onChange={(e) => setDue(e.target.value)}
                                placeholder="e.g. Aug 24"
                            />
                        </div>

                        <div className="field">
                            <label>Assignee</label>
                            <select
                                value={assignee}
                                onChange={(e) => setAssignee(e.target.value)}
                            >
                                {members.map((m) => (
                                    <option key={m.initials} value={m.initials}>
                                        {m.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="task-modal-footer">
                    {mode === "edit" && task ? (
                        <button
                            type="button"
                            className="modal-delete"
                            onClick={() => onDelete(task.id)}
                        >
                            Delete task
                        </button>
                    ) : (
                        <span />
                    )}

                    <div className="task-modal-footer-actions">
                        <button type="button" className="modal-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="modal-save"
                            disabled={!canSave}
                            onClick={handleSave}
                        >
                            {mode === "create" ? "Create task" : "Save changes"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}