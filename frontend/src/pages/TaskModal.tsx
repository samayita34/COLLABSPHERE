import { useEffect, useState } from "react";
import { TaskCommentSection } from "../components/TaskCommentSection";

/* =========================
   TYPES
   Mirrors the Task/Member shapes in ProjectWorkspace.tsx.
========================= */
import { type Task, type TaskPriority } from "../services/projectApi";

interface Member {
    initials: string;
    name: string;
    role: string;
}

interface Column {
    id: string;
    name: string;
}

interface TaskModalProps {
    mode: "create" | "edit";
    task: Task | null;
    defaultColumnId: string | null;
    columns: Column[];
    members: Member[];
    projectId: string;
    onClose: () => void;
    onSave: (task: Task) => void;
    onDelete: (id: string) => void;
}

// STATUS_OPTIONS removed as columns are passed dynamically

const PRIORITY_OPTIONS: { key: TaskPriority; label: string }[] = [
    { key: "low", label: "Low" },
    { key: "medium", label: "Medium" },
    { key: "high", label: "High" },
];

export default function TaskModal({
    mode,
    task,
    defaultColumnId,
    columns,
    members,
    projectId,
    onClose,
    onSave,
    onDelete,
}: TaskModalProps) {
    const [title, setTitle] = useState(task?.title ?? "");
    const [description, setDescription] = useState(task?.description ?? "");
    const [columnId, setColumnId] = useState<string | null>(task?.columnId ?? defaultColumnId);
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
            columnId,
            swimlaneId: task?.swimlaneId || null,
            order: task?.order || 0,
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
                        <label htmlFor="task-title">Title</label>
                        <input
                            id="task-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Task title"
                            autoFocus
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="task-desc">Description</label>
                        <textarea
                            id="task-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add more detail (optional)"
                            rows={3}
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="task-col">Column</label>
                        <select
                            id="task-col"
                            value={columnId || ""}
                            onChange={(e) => setColumnId(e.target.value)}
                        >
                            {columns.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
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
                            <label htmlFor="task-due">Due date</label>
                            <input
                                id="task-due"
                                type="text"
                                value={due}
                                onChange={(e) => setDue(e.target.value)}
                                placeholder="e.g. Aug 24"
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="task-assignee">Assignee</label>
                            <select
                                id="task-assignee"
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

                {mode === "edit" && task && (
                    <div className="task-modal-body" style={{ marginTop: '-1.5rem', paddingTop: 0 }}>
                        <TaskCommentSection projectId={projectId} taskId={task.id} projectMembers={members as any} />
                    </div>
                )}

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