import React, { useState } from "react";
import { type Column, type Task, type Member } from "../../services/projectApi";
import { KanbanCard } from "./KanbanCard";
import { Plus, MoreHorizontal, ArrowLeft, ArrowRight, Trash2, Edit2 } from "lucide-react";

interface KanbanColumnProps {
    column: Column;
    tasks: Task[];
    members: Member[];
    draggingTaskId: string | null;
    isDragOver: boolean;
    canMoveLeft: boolean;
    canMoveRight: boolean;
    onDragOver: (e: React.DragEvent, columnId: string) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, columnId: string) => void;
    onDragStart: (e: React.DragEvent, taskId: string) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onTaskClick: (task: Task) => void;
    onQuickAddTask: (columnId: string) => void;
    onEditColumn: (column: Column) => void;
    onDeleteColumn: (columnId: string) => void;
    onMoveColumn: (columnId: string, direction: "left" | "right") => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
    column,
    tasks,
    members,
    draggingTaskId,
    isDragOver,
    canMoveLeft,
    canMoveRight,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragStart,
    onDragEnd,
    onTaskClick,
    onQuickAddTask,
    onEditColumn,
    onDeleteColumn,
    onMoveColumn,
}) => {
    const [menuOpen, setMenuOpen] = useState(false);

    const getColumnColor = (name: string) => {
        const lower = name.toLowerCase();
        if (lower.includes("todo") || lower.includes("to do") || lower.includes("backlog")) return "#64748b";
        if (lower.includes("in progress") || lower.includes("active") || lower.includes("doing")) return "#3b82f6";
        if (lower.includes("review") || lower.includes("testing") || lower.includes("qa")) return "#f59e0b";
        if (lower.includes("done") || lower.includes("complete") || lower.includes("resolved")) return "#10b981";
        return "#8b5cf6";
    };

    return (
        <div
            className={`kb-column ${isDragOver ? "kb-drag-over" : ""}`}
            onDragOver={(e) => onDragOver(e, column.id)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, column.id)}
        >
            <div className="kb-col-header">
                <div className="kb-col-title-group">
                    <span
                        className="kb-col-indicator"
                        style={{ backgroundColor: getColumnColor(column.name) }}
                    />
                    <span className="kb-col-name" title={column.name}>
                        {column.name}
                    </span>
                    <span className="kb-col-badge">{tasks.length}</span>
                </div>

                <div className="kb-col-actions" style={{ position: "relative" }}>
                    <button
                        className="kb-col-btn"
                        onClick={() => onQuickAddTask(column.id)}
                        title="Add Task"
                    >
                        <Plus size={14} />
                    </button>

                    <button
                        className="kb-col-btn"
                        onClick={() => setMenuOpen(!menuOpen)}
                        title="Column Actions"
                    >
                        <MoreHorizontal size={14} />
                    </button>

                    {menuOpen && (
                        <>
                            <div
                                style={{ position: "fixed", inset: 0, zIndex: 40 }}
                                onClick={() => setMenuOpen(false)}
                            />
                            <div
                                style={{
                                    position: "absolute",
                                    top: "100%",
                                    right: 0,
                                    zIndex: 50,
                                    background: "#ffffff",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "8px",
                                    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.1)",
                                    padding: "6px",
                                    minWidth: "150px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "2px",
                                }}
                            >
                                <button
                                    className="kb-action-btn"
                                    style={{ width: "100%", justifyContent: "flex-start", border: "none" }}
                                    onClick={() => {
                                        setMenuOpen(false);
                                        onEditColumn(column);
                                    }}
                                >
                                    <Edit2 size={13} /> Rename Column
                                </button>

                                {canMoveLeft && (
                                    <button
                                        className="kb-action-btn"
                                        style={{ width: "100%", justifyContent: "flex-start", border: "none" }}
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onMoveColumn(column.id, "left");
                                        }}
                                    >
                                        <ArrowLeft size={13} /> Move Left
                                    </button>
                                )}

                                {canMoveRight && (
                                    <button
                                        className="kb-action-btn"
                                        style={{ width: "100%", justifyContent: "flex-start", border: "none" }}
                                        onClick={() => {
                                            setMenuOpen(false);
                                            onMoveColumn(column.id, "right");
                                        }}
                                    >
                                        <ArrowRight size={13} /> Move Right
                                    </button>
                                )}

                                <div style={{ height: 1, background: "#f1f5f9", margin: "4px 0" }} />

                                <button
                                    className="kb-action-btn danger"
                                    style={{ width: "100%", justifyContent: "flex-start", border: "none" }}
                                    onClick={() => {
                                        setMenuOpen(false);
                                        onDeleteColumn(column.id);
                                    }}
                                >
                                    <Trash2 size={13} /> Delete Column
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="kb-col-body">
                {tasks.length === 0 ? (
                    <div className={`kb-empty-zone ${isDragOver ? "active" : ""}`}>
                        {isDragOver ? "Drop here to move" : "No tasks in this column"}
                    </div>
                ) : (
                    tasks.map((task) => (
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
            </div>

            <div className="kb-quick-add">
                <button
                    className="kb-quick-add-btn"
                    onClick={() => onQuickAddTask(column.id)}
                >
                    <Plus size={13} /> Add Task
                </button>
            </div>
        </div>
    );
};
