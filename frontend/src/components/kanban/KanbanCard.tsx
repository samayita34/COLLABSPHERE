import React from "react";
import { type Task, type Member } from "../../services/projectApi";
import { Calendar, CheckSquare, Paperclip, Clock, MessageSquare, AlertCircle } from "lucide-react";

interface KanbanCardProps {
    task: Task;
    members: Member[];
    isDragging?: boolean;
    onDragStart: (e: React.DragEvent, taskId: string) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onClick: (task: Task) => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
    task,
    members,
    isDragging = false,
    onDragStart,
    onDragEnd,
    onClick,
}) => {
    const assigneeMember = members.find(
        (m) => m.initials === task.assignee || (m.userId && m.userId === task.assigneeId)
    );

    const isOverdue = !!(
        task.dueDateRaw &&
        new Date(task.dueDateRaw) < new Date() &&
        task.column?.name.toLowerCase() !== "done"
    );

    const isDueToday = !!(
        task.dueDateRaw &&
        new Date(task.dueDateRaw).toDateString() === new Date().toDateString()
    );

    const checklistTotal = task.checklistStats?.total ?? 0;
    const checklistCompleted = task.checklistStats?.completed ?? 0;
    const checklistProgress = task.checklistStats?.progress ?? 0;

    const formatMinutes = (minutes?: number) => {
        if (!minutes || minutes <= 0) return null;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    };

    const timeSpent = formatMinutes(task.totalTimeSpentMinutes);

    return (
        <div
            className={`kb-task-card priority-border-${task.priority?.toLowerCase() || "medium"} ${
                isDragging ? "kb-card-dragging" : ""
            }`}
            draggable
            onDragStart={(e) => onDragStart(e, task.id)}
            onDragEnd={onDragEnd}
            onClick={() => onClick(task)}
        >
            <div className="kb-card-header">
                <div className="kb-card-tags">
                    <span className={`kb-priority-tag ${task.priority?.toLowerCase() || "medium"}`}>
                        {task.priority}
                    </span>

                    {task.labels &&
                        task.labels.slice(0, 3).map((l) => (
                            <span
                                key={l.id}
                                className="kb-label-tag"
                                style={{ backgroundColor: l.color || "#3b82f6" }}
                                title={l.name}
                            >
                                {l.name}
                            </span>
                        ))}
                    {task.labels && task.labels.length > 3 && (
                        <span className="kb-filter-chip" style={{ fontSize: "10px", padding: "1px 5px" }}>
                            +{task.labels.length - 3}
                        </span>
                    )}
                </div>

                <div
                    className="kb-card-avatar"
                    title={assigneeMember ? `${assigneeMember.name} (${assigneeMember.role})` : task.assignee || "Unassigned"}
                >
                    {task.assignee || "?"}
                </div>
            </div>

            <h4 className="kb-card-title">{task.title}</h4>

            {task.description && <p className="kb-card-desc">{task.description}</p>}

            {/* Checklist progress bar if task has checklist items */}
            {checklistTotal > 0 && (
                <div className="kb-card-progress">
                    <div className="kb-progress-bar-bg">
                        <div
                            className="kb-progress-bar-fill"
                            style={{ width: `${checklistProgress}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="kb-card-footer">
                <div className="kb-card-meta-left">
                    {task.due && (
                        <span
                            className={`kb-due-badge ${
                                isOverdue ? "overdue" : isDueToday ? "due-today" : ""
                            }`}
                            title={isOverdue ? "Task is Overdue!" : `Due: ${task.due}`}
                        >
                            {isOverdue ? <AlertCircle size={11} /> : <Calendar size={11} />}
                            {task.due}
                        </span>
                    )}

                    {checklistTotal > 0 && (
                        <span className="kb-meta-item" title="Checklist progress">
                            <CheckSquare size={11} />
                            {checklistCompleted}/{checklistTotal}
                        </span>
                    )}

                    {(task.attachmentsCount ?? 0) > 0 && (
                        <span className="kb-meta-item" title="Attachments">
                            <Paperclip size={11} />
                            {task.attachmentsCount}
                        </span>
                    )}

                    {timeSpent && (
                        <span className="kb-meta-item" title="Time Logged">
                            <Clock size={11} />
                            {timeSpent}
                        </span>
                    )}

                    {(task.commentsCount ?? 0) > 0 && (
                        <span className="kb-meta-item" title="Comments">
                            <MessageSquare size={11} />
                            {task.commentsCount}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
