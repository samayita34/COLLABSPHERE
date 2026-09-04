import React, { useState } from "react";
import { type Column, type Task, type Member, type Swimlane } from "../../services/projectApi";
import { KanbanCard } from "./KanbanCard";
import { ChevronDown, Plus, Edit2, Trash2 } from "lucide-react";

interface KanbanSwimlaneProps {
    swimlaneKey: string;
    title: string;
    icon?: React.ReactNode;
    swimlaneObject?: Swimlane;
    columns: Column[];
    tasks: Task[];
    members: Member[];
    draggingTaskId: string | null;
    dragOverColumn: string | null;
    dragOverSwimlane: string | null;
    onDragOver: (e: React.DragEvent, columnId: string, swimlaneKey: string) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, columnId: string, swimlaneKey: string) => void;
    onDragStart: (e: React.DragEvent, taskId: string) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onTaskClick: (task: Task) => void;
    onQuickAddTask: (columnId: string, swimlaneKey?: string) => void;
    onEditSwimlane?: (swimlane: Swimlane) => void;
    onDeleteSwimlane?: (swimlaneId: string) => void;
}

export const KanbanSwimlane: React.FC<KanbanSwimlaneProps> = ({
    swimlaneKey,
    title,
    icon,
    swimlaneObject,
    columns,
    tasks,
    members,
    draggingTaskId,
    dragOverColumn,
    dragOverSwimlane,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragStart,
    onDragEnd,
    onTaskClick,
    onQuickAddTask,
    onEditSwimlane,
    onDeleteSwimlane,
}) => {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="kb-swimlane-row">
            <div
                className="kb-swimlane-header"
                onClick={() => setCollapsed(!collapsed)}
            >
                <div className="kb-swimlane-title-group">
                    <ChevronDown
                        size={16}
                        className={`kb-swimlane-toggle-icon ${collapsed ? "collapsed" : ""}`}
                    />
                    {icon}
                    <span className="kb-swimlane-title">{title}</span>
                    <span className="kb-swimlane-count">{tasks.length}</span>
                </div>

                <div
                    className="kb-col-actions"
                    onClick={(e) => e.stopPropagation()}
                >
                    {swimlaneObject && onEditSwimlane && (
                        <button
                            className="kb-col-btn"
                            title="Edit Swimlane"
                            onClick={() => onEditSwimlane(swimlaneObject)}
                        >
                            <Edit2 size={13} />
                        </button>
                    )}

                    {swimlaneObject && onDeleteSwimlane && (
                        <button
                            className="kb-col-btn"
                            title="Delete Swimlane"
                            style={{ color: "#ef4444" }}
                            onClick={() => onDeleteSwimlane(swimlaneObject.id)}
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
            </div>

            {!collapsed && (
                <div className="kb-swimlane-grid">
                    {columns.map((col) => {
                        const colTasks = tasks.filter((t) => t.columnId === col.id);
                        const isTarget =
                            dragOverColumn === col.id && dragOverSwimlane === swimlaneKey;

                        return (
                            <div
                                key={col.id}
                                className={`kb-swimlane-col-sub ${
                                    isTarget ? "kb-drag-over" : ""
                                }`}
                                onDragOver={(e) => onDragOver(e, col.id, swimlaneKey)}
                                onDragLeave={onDragLeave}
                                onDrop={(e) => onDrop(e, col.id, swimlaneKey)}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "4px 6px",
                                        fontSize: "11.5px",
                                        fontWeight: 600,
                                        color: "#64748b",
                                    }}
                                >
                                    <span>{col.name}</span>
                                    <span>{colTasks.length}</span>
                                </div>

                                {colTasks.length === 0 ? (
                                    <div
                                        className={`kb-empty-zone ${
                                            isTarget ? "active" : ""
                                        }`}
                                        style={{ padding: "16px 8px", fontSize: "11.5px" }}
                                    >
                                        {isTarget ? "Drop here" : "Empty"}
                                    </div>
                                ) : (
                                    colTasks.map((task) => (
                                        <KanbanCard
                                            key={task.id}
                                            task={task}
                                            members={members}
                                            isDragging={draggingTaskId === task.id}
                                            onDragStart={onDragStart}
                                            onDragEnd={onDragEnd}
                                            onClick={onTaskClick}
                                        />
                                    ))
                                )}

                                <button
                                    className="kb-quick-add-btn"
                                    style={{ fontSize: "11.5px", padding: "4px" }}
                                    onClick={() => onQuickAddTask(col.id, swimlaneKey)}
                                >
                                    <Plus size={11} /> Add
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
