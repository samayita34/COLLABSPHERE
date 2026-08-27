import { useEffect, useState } from "react";

/* =========================
   TYPES
   Mirrors the Member/Task shapes in ProjectWorkspace.tsx.
   Kept local so this component has no import-order coupling
   (same pattern as TaskModal.tsx).
========================= */

type TaskStatus = "todo" | "progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high";

interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    due: string;
    assignee: string;
}

export interface Member {
    initials: string;
    name: string;
    role: string;
    email: string;
}

interface MemberStats {
    assignedTasks: Task[];
    assigned: number;
    completed: number;
    remaining: number;
}

const TAG_LABEL: Record<TaskStatus, string> = {
    todo: "To do",
    progress: "In progress",
    review: "Review",
    done: "Done",
};

/* Shared: close on Escape */
function useEscapeToClose(onClose: () => void) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);
}

/* =========================
   MEMBER DETAIL MODAL
   Read-only profile + live task stats. Assigned tasks are
   clickable and hand off to the existing TaskModal via
   onOpenTask -- this component never renders its own task modal.
========================= */

interface MemberDetailModalProps {
    member: Member;
    stats: MemberStats;
    onClose: () => void;
    onOpenTask: (task: Task) => void;
}

export function MemberDetailModal({ member, stats, onClose, onOpenTask }: MemberDetailModalProps) {
    useEscapeToClose(onClose);

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div
                className="task-modal member-detail-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`${member.name} details`}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="task-modal-header">
                    <h3>Team member</h3>
                    <button className="modal-close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                <div className="task-modal-body">
                    <div className="member-detail-profile">
                        <div className="profile-avatar">{member.initials}</div>
                        <div>
                            <strong>{member.name}</strong>
                            <span>{member.role}</span>
                            <span className="member-detail-email">{member.email}</span>
                        </div>
                    </div>

                    <div className="member-detail-stats">
                        <div className="member-detail-stat">
                            <strong>{stats.assigned}</strong>
                            <span>Assigned</span>
                        </div>
                        <div className="member-detail-stat">
                            <strong>{stats.completed}</strong>
                            <span>Completed</span>
                        </div>
                        <div className="member-detail-stat">
                            <strong>{stats.remaining}</strong>
                            <span>Remaining</span>
                        </div>
                    </div>

                    <div className="field">
                        <label>Assigned tasks</label>

                        {stats.assignedTasks.length === 0 ? (
                            <div className="board-empty">No tasks assigned yet</div>
                        ) : (
                            <div className="member-detail-tasks">
                                {stats.assignedTasks.map((task) => (
                                    <button
                                        type="button"
                                        className="member-detail-task-row"
                                        key={task.id}
                                        onClick={() => onOpenTask(task)}
                                    >
                                        <span className={`task-check ${task.status === "done" ? "done" : ""}`} />
                                        <span className="member-detail-task-title">{task.title}</span>
                                        <span className={`task-row-tag ${task.status}`}>
                                            {TAG_LABEL[task.status]}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="task-modal-footer">
                    <span />
                    <div className="task-modal-footer-actions">
                        <button type="button" className="modal-cancel" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* =========================
   ADD MEMBER MODAL
   Simple local-state form. The new member is handed back to
   ProjectWorkspace, which assigns initials and appends it to
   the live `members` state.
========================= */

interface AddMemberModalProps {
    onClose: () => void;
    onSave: (member: { name: string; email: string; role: string }) => void;
}

const ROLE_OPTIONS = [
    { label: "Member", value: "MEMBER" },
    { label: "Admin", value: "ADMIN" },
    { label: "Viewer", value: "VIEWER" },
];

export function AddMemberModal({ onClose, onSave }: AddMemberModalProps) {
    useEscapeToClose(onClose);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState(ROLE_OPTIONS[0].value);

    const canSave = name.trim().length > 0 && email.trim().length > 0;

    const handleSave = () => {
        if (!canSave) return;
        onSave({ name: name.trim(), email: email.trim(), role });
    };

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div
                className="task-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Add member"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="task-modal-header">
                    <h3>Add member</h3>
                    <button className="modal-close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                <div className="task-modal-body">
                    <div className="field">
                        <label>Full name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Priya Nair"
                            autoFocus
                        />
                    </div>

                    <div className="field">
                        <label>Email</label>
                        <input
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@company.com"
                        />
                    </div>

                    <div className="field">
                        <label>Role</label>
                        <select value={role} onChange={(e) => setRole(e.target.value)}>
                            {ROLE_OPTIONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="task-modal-footer">
                    <span />
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
                            Add member
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}