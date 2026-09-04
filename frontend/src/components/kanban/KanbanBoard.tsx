import React, { useState, useEffect, useMemo, type DragEvent } from "react";
import {
    type Board,
    type Column,
    type Swimlane,
    type Task,
    type Member,
    type Label,
    type TaskPriority,
    fetchBoards,
    createBoardApi,
    updateBoardApi,
    deleteBoardApi,
    createColumnApi,
    updateColumnApi,
    deleteColumnApi,
    reorderColumnsApi,
    createSwimlaneApi,
    updateSwimlaneApi,
    deleteSwimlaneApi,
    fetchProjectLabelsApi,
    createProjectLabelApi,
    updateTaskColumnApi,
    updateTaskApi,
} from "../../services/projectApi";
import { socketService } from "../../services/socket";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanSwimlane } from "./KanbanSwimlane";
import {
    BoardModal,
    ColumnModal,
    SwimlaneModal,
    CreateLabelModal,
} from "./KanbanModals";
import {
    Plus,
    Search,
    Layers,
    User,
    AlertTriangle,
    Tag,
    Trash2,
    Edit2,
} from "lucide-react";
import "./Kanban.css";

interface KanbanBoardProps {
    projectId: string;
    tasks: Task[];
    members: Member[];
    onTaskClick: (task: Task) => void;
    onQuickCreateTask: (columnId?: string, swimlaneId?: string) => void;
    onTasksChange?: (tasks: Task[]) => void;
}

type SwimlaneMode = "none" | "assignee" | "priority" | "custom";

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
    projectId,
    tasks,
    members,
    onTaskClick,
    onQuickCreateTask,
    onTasksChange,
}) => {
    // Boards & active board state
    const [boards, setBoards] = useState<Board[]>([]);
    const [activeBoardId, setActiveBoardId] = useState<string>("");
    const [labels, setLabels] = useState<Label[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Swimlane mode
    const [swimlaneMode, setSwimlaneMode] = useState<SwimlaneMode>("none");

    // Search and filter state
    const [searchQuery, setSearchQuery] = useState("");
    const [filterPriority, setFilterPriority] = useState<string>("all");
    const [filterAssignee, setFilterAssignee] = useState<string>("all");
    const [filterLabel, setFilterLabel] = useState<string>("all");
    const [filterDueDate, setFilterDueDate] = useState<string>("all");

    // Drag-and-drop state
    const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
    const [dragOverSwimlane, setDragOverSwimlane] = useState<string | null>(null);

    // Modals state
    const [boardModalOpen, setBoardModalOpen] = useState(false);
    const [boardModalMode, setBoardModalMode] = useState<"create" | "edit">("create");
    const [columnModalOpen, setColumnModalOpen] = useState(false);
    const [columnModalMode, setColumnModalMode] = useState<"create" | "edit">("create");
    const [selectedColumn, setSelectedColumn] = useState<Column | null>(null);
    const [swimlaneModalOpen, setSwimlaneModalOpen] = useState(false);
    const [swimlaneModalMode, setSwimlaneModalMode] = useState<"create" | "edit">("create");
    const [selectedSwimlane, setSelectedSwimlane] = useState<Swimlane | null>(null);
    const [labelModalOpen, setLabelModalOpen] = useState(false);

    // Load boards & project labels
    useEffect(() => {
        if (!projectId) return;
        setLoading(true);

        Promise.all([
            fetchBoards(projectId).catch((err) => {
                console.error("Error fetching boards:", err);
                return [] as Board[];
            }),
            fetchProjectLabelsApi(projectId).catch((err) => {
                console.error("Error fetching labels:", err);
                return [] as Label[];
            }),
        ])
            .then(([fetchedBoards, fetchedLabels]) => {
                setBoards(fetchedBoards);
                if (fetchedBoards.length > 0) {
                    setActiveBoardId(fetchedBoards[0].id);
                }
                setLabels(fetchedLabels);
            })
            .finally(() => setLoading(false));
    }, [projectId]);

    const activeBoard = useMemo(() => {
        return boards.find((b) => b.id === activeBoardId) || boards[0] || null;
    }, [boards, activeBoardId]);

    /* =========================================================
       REAL-TIME SOCKET SYNCHRONIZATION
    ========================================================= */
    useEffect(() => {
        if (!projectId) return;
        const socket = socketService.connect();
        socketService.joinProject(projectId);

        const handleBoardCreated = (newBoard: Board) => {
            setBoards((prev) => {
                if (prev.some((b) => b.id === newBoard.id)) return prev;
                return [...prev, newBoard];
            });
        };

        const handleBoardUpdated = (updatedBoard: Board) => {
            setBoards((prev) => prev.map((b) => (b.id === updatedBoard.id ? updatedBoard : b)));
        };

        const handleBoardDeleted = (deletedBoardId: string) => {
            setBoards((prev) => {
                const next = prev.filter((b) => b.id !== deletedBoardId);
                if (activeBoardId === deletedBoardId && next.length > 0) {
                    setActiveBoardId(next[0].id);
                }
                return next;
            });
        };

        const handleColumnCreated = ({ boardId, column }: { boardId: string; column: Column }) => {
            setBoards((prev) =>
                prev.map((b) => {
                    if (b.id !== boardId) return b;
                    const exists = b.columns.some((c) => c.id === column.id);
                    const cols = exists ? b.columns.map((c) => (c.id === column.id ? column : c)) : [...b.columns, column];
                    return { ...b, columns: cols.sort((a, b) => a.order - b.order) };
                })
            );
        };

        const handleColumnUpdated = ({ boardId, column }: { boardId: string; column: Column }) => {
            setBoards((prev) =>
                prev.map((b) => {
                    if (b.id !== boardId) return b;
                    return {
                        ...b,
                        columns: b.columns.map((c) => (c.id === column.id ? column : c)),
                    };
                })
            );
        };

        const handleColumnDeleted = ({ boardId, columnId }: { boardId: string; columnId: string }) => {
            setBoards((prev) =>
                prev.map((b) => {
                    if (b.id !== boardId) return b;
                    return { ...b, columns: b.columns.filter((c) => c.id !== columnId) };
                })
            );
        };

        const handleColumnsReordered = ({ boardId, columns }: { boardId: string; columns: Column[] }) => {
            setBoards((prev) =>
                prev.map((b) => (b.id === boardId ? { ...b, columns } : b))
            );
        };

        const handleSwimlaneCreated = ({ boardId, swimlane }: { boardId: string; swimlane: Swimlane }) => {
            setBoards((prev) =>
                prev.map((b) => {
                    if (b.id !== boardId) return b;
                    const lanes = b.swimlanes || [];
                    const exists = lanes.some((s) => s.id === swimlane.id);
                    const updated = exists ? lanes.map((s) => (s.id === swimlane.id ? swimlane : s)) : [...lanes, swimlane];
                    return { ...b, swimlanes: updated.sort((a, b) => a.order - b.order) };
                })
            );
        };

        const handleSwimlaneUpdated = ({ boardId, swimlane }: { boardId: string; swimlane: Swimlane }) => {
            setBoards((prev) =>
                prev.map((b) => {
                    if (b.id !== boardId) return b;
                    return {
                        ...b,
                        swimlanes: (b.swimlanes || []).map((s) => (s.id === swimlane.id ? swimlane : s)),
                    };
                })
            );
        };

        const handleSwimlaneDeleted = ({ boardId, swimlaneId }: { boardId: string; swimlaneId: string }) => {
            setBoards((prev) =>
                prev.map((b) => {
                    if (b.id !== boardId) return b;
                    return { ...b, swimlanes: (b.swimlanes || []).filter((s) => s.id !== swimlaneId) };
                })
            );
        };

        const handleLabelCreated = (newLabel: Label) => {
            setLabels((prev) => {
                if (prev.some((l) => l.id === newLabel.id)) return prev;
                return [...prev, newLabel];
            });
        };

        const handleLabelDeleted = (deletedLabelId: string) => {
            setLabels((prev) => prev.filter((l) => l.id !== deletedLabelId));
        };

        socket?.on("boardCreated", handleBoardCreated);
        socket?.on("boardUpdated", handleBoardUpdated);
        socket?.on("boardDeleted", handleBoardDeleted);
        socket?.on("columnCreated", handleColumnCreated);
        socket?.on("columnUpdated", handleColumnUpdated);
        socket?.on("columnDeleted", handleColumnDeleted);
        socket?.on("columnsReordered", handleColumnsReordered);
        socket?.on("swimlaneCreated", handleSwimlaneCreated);
        socket?.on("swimlaneUpdated", handleSwimlaneUpdated);
        socket?.on("swimlaneDeleted", handleSwimlaneDeleted);
        socket?.on("labelCreated", handleLabelCreated);
        socket?.on("labelDeleted", handleLabelDeleted);

        return () => {
            socket?.off("boardCreated", handleBoardCreated);
            socket?.off("boardUpdated", handleBoardUpdated);
            socket?.off("boardDeleted", handleBoardDeleted);
            socket?.off("columnCreated", handleColumnCreated);
            socket?.off("columnUpdated", handleColumnUpdated);
            socket?.off("columnDeleted", handleColumnDeleted);
            socket?.off("columnsReordered", handleColumnsReordered);
            socket?.off("swimlaneCreated", handleSwimlaneCreated);
            socket?.off("swimlaneUpdated", handleSwimlaneUpdated);
            socket?.off("swimlaneDeleted", handleSwimlaneDeleted);
            socket?.off("labelCreated", handleLabelCreated);
            socket?.off("labelDeleted", handleLabelDeleted);
        };
    }, [projectId, activeBoardId]);

    /* =========================================================
       FILTERED TASKS
    ========================================================= */
    const filteredTasks = useMemo(() => {
        return tasks.filter((t) => {
            // Search filter (title, description, labels)
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const titleMatch = t.title.toLowerCase().includes(q);
                const descMatch = (t.description || "").toLowerCase().includes(q);
                const labelMatch = (t.labels || []).some((l) => l.name.toLowerCase().includes(q));
                if (!titleMatch && !descMatch && !labelMatch) return false;
            }

            // Priority filter
            if (filterPriority !== "all" && t.priority !== filterPriority) {
                return false;
            }

            // Assignee filter
            if (filterAssignee !== "all") {
                if (filterAssignee === "unassigned") {
                    if (t.assigneeId || (t.assignee && t.assignee !== "UN")) return false;
                } else {
                    const matchInitials = t.assignee === filterAssignee;
                    const matchId = t.assigneeId === filterAssignee;
                    if (!matchInitials && !matchId) return false;
                }
            }

            // Label filter
            if (filterLabel !== "all") {
                const hasLabel = (t.labels || []).some((l) => l.id === filterLabel || l.name === filterLabel);
                if (!hasLabel) return false;
            }

            // Due Date filter
            if (filterDueDate !== "all") {
                if (!t.dueDateRaw) return false;
                const dueDate = new Date(t.dueDateRaw);
                const now = new Date();
                const isOverdue = dueDate < now && t.column?.name.toLowerCase() !== "done";

                if (filterDueDate === "overdue" && !isOverdue) return false;
                if (filterDueDate === "today") {
                    if (dueDate.toDateString() !== now.toDateString()) return false;
                }
                if (filterDueDate === "week") {
                    const nextWeek = new Date();
                    nextWeek.setDate(now.getDate() + 7);
                    if (dueDate < now || dueDate > nextWeek) return false;
                }
            }

            return true;
        });
    }, [tasks, searchQuery, filterPriority, filterAssignee, filterLabel, filterDueDate]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (searchQuery.trim()) count++;
        if (filterPriority !== "all") count++;
        if (filterAssignee !== "all") count++;
        if (filterLabel !== "all") count++;
        if (filterDueDate !== "all") count++;
        return count;
    }, [searchQuery, filterPriority, filterAssignee, filterLabel, filterDueDate]);

    const clearFilters = () => {
        setSearchQuery("");
        setFilterPriority("all");
        setFilterAssignee("all");
        setFilterLabel("all");
        setFilterDueDate("all");
    };

    /* =========================================================
       DRAG AND DROP HANDLERS
    ========================================================= */
    const handleDragStart = (e: DragEvent, taskId: string) => {
        setDraggingTaskId(taskId);
        e.dataTransfer.setData("text/plain", taskId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragEnd = () => {
        setDraggingTaskId(null);
        setDragOverColumn(null);
        setDragOverSwimlane(null);
    };

    const handleDragOverColumn = (e: DragEvent, columnId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOverColumn !== columnId) {
            setDragOverColumn(columnId);
        }
    };

    const handleDragOverSwimlane = (e: DragEvent, columnId: string, swimlaneKey: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverColumn(columnId);
        setDragOverSwimlane(swimlaneKey);
    };

    const handleDragLeave = () => {
        // Handled gracefully
    };

    const handleDropOnColumn = async (e: DragEvent, columnId: string) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("text/plain") || draggingTaskId;
        if (!taskId) return;

        // Optimistic UI update
        const currentTask = tasks.find((t) => t.id === taskId);
        if (!currentTask || currentTask.columnId === columnId) {
            setDraggingTaskId(null);
            setDragOverColumn(null);
            return;
        }

        const updatedTasks = tasks.map((t) => (t.id === taskId ? { ...t, columnId } : t));
        if (onTasksChange) onTasksChange(updatedTasks);

        try {
            const updated = await updateTaskColumnApi(taskId, columnId);
            if (onTasksChange) {
                onTasksChange(tasks.map((t) => (t.id === updated.id ? updated : t)));
            }
        } catch (error) {
            console.error("Failed to update task column:", error);
            if (onTasksChange) onTasksChange(tasks); // revert
        }

        setDraggingTaskId(null);
        setDragOverColumn(null);
    };

    const handleDropOnSwimlane = async (e: DragEvent, columnId: string, swimlaneKey: string) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("text/plain") || draggingTaskId;
        if (!taskId) return;

        const currentTask = tasks.find((t) => t.id === taskId);
        if (!currentTask) return;

        let patchPayload: any = { columnId };

        if (swimlaneMode === "assignee") {
            const assigneeMember = members.find((m) => m.initials === swimlaneKey || m.userId === swimlaneKey);
            patchPayload.assignee = assigneeMember ? assigneeMember.initials : "UN";
            patchPayload.assigneeId = assigneeMember ? assigneeMember.userId : null;
        } else if (swimlaneMode === "priority") {
            patchPayload.priority = swimlaneKey as TaskPriority;
        } else if (swimlaneMode === "custom") {
            patchPayload.swimlaneId = swimlaneKey === "unassigned" ? null : swimlaneKey;
        }

        // Optimistic update
        const updatedTasks = tasks.map((t) => (t.id === taskId ? { ...t, ...patchPayload } : t));
        if (onTasksChange) onTasksChange(updatedTasks);

        try {
            const updated = await updateTaskApi(taskId, { ...patchPayload, members });
            if (onTasksChange) {
                onTasksChange(tasks.map((t) => (t.id === updated.id ? updated : t)));
            }
        } catch (error) {
            console.error("Failed to move task across swimlane:", error);
            if (onTasksChange) onTasksChange(tasks);
        }

        setDraggingTaskId(null);
        setDragOverColumn(null);
        setDragOverSwimlane(null);
    };

    /* =========================================================
       BOARD CRUD ACTIONS
    ========================================================= */
    const handleSaveBoard = async (data: { name: string; description?: string; template?: string }) => {
        try {
            if (boardModalMode === "create") {
                const newBoard = await createBoardApi(projectId, data);
                setBoards((prev) => [...prev, newBoard]);
                setActiveBoardId(newBoard.id);
            } else if (activeBoard) {
                const updated = await updateBoardApi(projectId, activeBoard.id, data);
                setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
            }
            setBoardModalOpen(false);
        } catch (error) {
            console.error("Failed to save board:", error);
        }
    };

    const handleDeleteBoard = async () => {
        if (!activeBoard) return;
        if (!window.confirm(`Are you sure you want to delete board "${activeBoard.name}"?`)) return;

        try {
            await deleteBoardApi(projectId, activeBoard.id);
            const remaining = boards.filter((b) => b.id !== activeBoard.id);
            setBoards(remaining);
            if (remaining.length > 0) setActiveBoardId(remaining[0].id);
        } catch (error: any) {
            alert(error.message || "Failed to delete board");
        }
    };

    /* =========================================================
       COLUMN CRUD ACTIONS
    ========================================================= */
    const handleSaveColumn = async (data: { name: string }) => {
        if (!activeBoard) return;
        try {
            if (columnModalMode === "create") {
                const newCol = await createColumnApi(projectId, activeBoard.id, data);
                setBoards((prev) =>
                    prev.map((b) => (b.id === activeBoard.id ? { ...b, columns: [...b.columns, newCol] } : b))
                );
            } else if (selectedColumn) {
                const updated = await updateColumnApi(projectId, selectedColumn.id, data);
                setBoards((prev) =>
                    prev.map((b) =>
                        b.id === activeBoard.id
                            ? { ...b, columns: b.columns.map((c) => (c.id === updated.id ? updated : c)) }
                            : b
                    )
                );
            }
            setColumnModalOpen(false);
        } catch (error) {
            console.error("Failed to save column:", error);
        }
    };

    const handleDeleteColumn = async (columnId: string) => {
        if (!window.confirm("Are you sure you want to delete this column? Tasks in this column will be unassigned.")) return;
        try {
            await deleteColumnApi(projectId, columnId);
            setBoards((prev) =>
                prev.map((b) =>
                    b.id === activeBoardId ? { ...b, columns: b.columns.filter((c) => c.id !== columnId) } : b
                )
            );
        } catch (error) {
            console.error("Failed to delete column:", error);
        }
    };

    const handleMoveColumn = async (columnId: string, direction: "left" | "right") => {
        if (!activeBoard) return;
        const cols = [...activeBoard.columns];
        const idx = cols.findIndex((c) => c.id === columnId);
        if (idx === -1) return;

        const targetIdx = direction === "left" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= cols.length) return;

        const temp = cols[idx];
        cols[idx] = cols[targetIdx];
        cols[targetIdx] = temp;

        const columnIds = cols.map((c) => c.id);
        try {
            const reordered = await reorderColumnsApi(projectId, activeBoard.id, columnIds);
            setBoards((prev) =>
                prev.map((b) => (b.id === activeBoard.id ? { ...b, columns: reordered } : b))
            );
        } catch (error) {
            console.error("Failed to reorder columns:", error);
        }
    };

    /* =========================================================
       SWIMLANE CRUD ACTIONS
    ========================================================= */
    const handleSaveSwimlane = async (data: { name: string }) => {
        if (!activeBoard) return;
        try {
            if (swimlaneModalMode === "create") {
                const newLane = await createSwimlaneApi(projectId, activeBoard.id, data);
                setBoards((prev) =>
                    prev.map((b) =>
                        b.id === activeBoard.id
                            ? { ...b, swimlanes: [...(b.swimlanes || []), newLane] }
                            : b
                    )
                );
            } else if (selectedSwimlane) {
                const updated = await updateSwimlaneApi(projectId, selectedSwimlane.id, data);
                setBoards((prev) =>
                    prev.map((b) =>
                        b.id === activeBoard.id
                            ? {
                                  ...b,
                                  swimlanes: (b.swimlanes || []).map((s) =>
                                      s.id === updated.id ? updated : s
                                  ),
                              }
                            : b
                    )
                );
            }
            setSwimlaneModalOpen(false);
        } catch (error) {
            console.error("Failed to save swimlane:", error);
        }
    };

    const handleDeleteSwimlane = async (swimlaneId: string) => {
        if (!window.confirm("Are you sure you want to delete this swimlane?")) return;
        try {
            await deleteSwimlaneApi(projectId, swimlaneId);
            setBoards((prev) =>
                prev.map((b) =>
                    b.id === activeBoardId
                        ? { ...b, swimlanes: (b.swimlanes || []).filter((s) => s.id !== swimlaneId) }
                        : b
                )
            );
        } catch (error) {
            console.error("Failed to delete swimlane:", error);
        }
    };

    /* =========================================================
       RENDER
    ========================================================= */
    if (loading) {
        return (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                Loading Dynamic Kanban Board...
            </div>
        );
    }

    return (
        <div className="kb-container">
            {/* Top Control Bar */}
            <div className="kb-topbar">
                <div className="kb-topbar-left">
                    {/* Board selector */}
                    <div className="kb-board-selector">
                        <select
                            className="kb-board-select"
                            value={activeBoardId}
                            onChange={(e) => setActiveBoardId(e.target.value)}
                        >
                            {boards.map((b) => (
                                <option key={b.id} value={b.id}>
                                    📋 {b.name}
                                </option>
                            ))}
                        </select>

                        <button
                            className="kb-action-btn"
                            onClick={() => {
                                setBoardModalMode("create");
                                setBoardModalOpen(true);
                            }}
                            title="Create New Board"
                        >
                            <Plus size={13} /> New Board
                        </button>

                        {activeBoard && (
                            <>
                                <button
                                    className="kb-action-btn"
                                    onClick={() => {
                                        setBoardModalMode("edit");
                                        setBoardModalOpen(true);
                                    }}
                                    title="Edit Board"
                                >
                                    <Edit2 size={13} />
                                </button>

                                {boards.length > 1 && (
                                    <button
                                        className="kb-action-btn danger"
                                        onClick={handleDeleteBoard}
                                        title="Delete Board"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {/* Swimlane Mode Switcher */}
                    <div className="kb-view-pills" title="Group into Swimlanes">
                        <button
                            className={`kb-view-pill ${swimlaneMode === "none" ? "active" : ""}`}
                            onClick={() => setSwimlaneMode("none")}
                        >
                            Columns Only
                        </button>
                        <button
                            className={`kb-view-pill ${swimlaneMode === "assignee" ? "active" : ""}`}
                            onClick={() => setSwimlaneMode("assignee")}
                        >
                            By Assignee
                        </button>
                        <button
                            className={`kb-view-pill ${swimlaneMode === "priority" ? "active" : ""}`}
                            onClick={() => setSwimlaneMode("priority")}
                        >
                            By Priority
                        </button>
                        <button
                            className={`kb-view-pill ${swimlaneMode === "custom" ? "active" : ""}`}
                            onClick={() => setSwimlaneMode("custom")}
                        >
                            Custom Lanes
                        </button>
                    </div>

                    {swimlaneMode === "custom" && (
                        <button
                            className="kb-action-btn"
                            onClick={() => {
                                setSelectedSwimlane(null);
                                setSwimlaneModalMode("create");
                                setSwimlaneModalOpen(true);
                            }}
                        >
                            <Plus size={12} /> Add Swimlane
                        </button>
                    )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        className="kb-action-btn"
                        onClick={() => {
                            setSelectedColumn(null);
                            setColumnModalMode("create");
                            setColumnModalOpen(true);
                        }}
                    >
                        <Plus size={13} /> Add Column
                    </button>

                    <button
                        className="kb-action-btn"
                        onClick={() => setLabelModalOpen(true)}
                        title="Manage Project Labels"
                    >
                        <Tag size={13} /> Labels
                    </button>

                    <button
                        className="kb-action-btn primary"
                        onClick={() => onQuickCreateTask(activeBoard?.columns[0]?.id)}
                    >
                        <Plus size={14} /> New Task
                    </button>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="kb-filters-bar">
                <div className="kb-search-box">
                    <Search size={14} color="#94a3b8" />
                    <input
                        placeholder="Search tasks, descriptions, labels..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <select
                    className="kb-filter-select"
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                >
                    <option value="all">All Priorities</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                </select>

                <select
                    className="kb-filter-select"
                    value={filterAssignee}
                    onChange={(e) => setFilterAssignee(e.target.value)}
                >
                    <option value="all">All Assignees</option>
                    <option value="unassigned">Unassigned</option>
                    {members.map((m) => (
                        <option key={m.userId || m.initials} value={m.userId || m.initials}>
                            {m.name} ({m.initials})
                        </option>
                    ))}
                </select>

                <select
                    className="kb-filter-select"
                    value={filterLabel}
                    onChange={(e) => setFilterLabel(e.target.value)}
                >
                    <option value="all">All Labels</option>
                    {labels.map((l) => (
                        <option key={l.id} value={l.id}>
                            🏷️ {l.name}
                        </option>
                    ))}
                </select>

                <select
                    className="kb-filter-select"
                    value={filterDueDate}
                    onChange={(e) => setFilterDueDate(e.target.value)}
                >
                    <option value="all">All Dates</option>
                    <option value="overdue">⚠️ Overdue</option>
                    <option value="today">📅 Due Today</option>
                    <option value="week">🗓️ Due This Week</option>
                </select>

                {activeFilterCount > 0 && (
                    <button
                        className="kb-action-btn"
                        style={{ fontSize: "11.5px", padding: "4px 8px" }}
                        onClick={clearFilters}
                    >
                        Clear ({activeFilterCount})
                    </button>
                )}
            </div>

            {/* Main Board View: Standard Columns OR Swimlanes */}
            {!activeBoard || activeBoard.columns.length === 0 ? (
                <div className="kb-empty-zone" style={{ padding: "60px 20px" }}>
                    <h3>No columns configured on this board</h3>
                    <p>Add columns like "To Do", "In Progress", "Done" to get started.</p>
                    <button
                        className="kb-action-btn primary"
                        style={{ marginTop: "12px" }}
                        onClick={() => {
                            setSelectedColumn(null);
                            setColumnModalMode("create");
                            setColumnModalOpen(true);
                        }}
                    >
                        <Plus size={14} /> Add First Column
                    </button>
                </div>
            ) : swimlaneMode === "none" ? (
                /* Standard Vertical Columns Canvas */
                <div className="kb-canvas">
                    {activeBoard.columns.map((col, idx) => {
                        const colTasks = filteredTasks.filter((t) => t.columnId === col.id);
                        return (
                            <KanbanColumn
                                key={col.id}
                                column={col}
                                tasks={colTasks}
                                members={members}
                                draggingTaskId={draggingTaskId}
                                isDragOver={dragOverColumn === col.id}
                                canMoveLeft={idx > 0}
                                canMoveRight={idx < activeBoard.columns.length - 1}
                                onDragOver={handleDragOverColumn}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDropOnColumn}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onTaskClick={onTaskClick}
                                onQuickAddTask={(cId) => onQuickCreateTask(cId)}
                                onEditColumn={(c) => {
                                    setSelectedColumn(c);
                                    setColumnModalMode("edit");
                                    setColumnModalOpen(true);
                                }}
                                onDeleteColumn={handleDeleteColumn}
                                onMoveColumn={handleMoveColumn}
                            />
                        );
                    })}
                </div>
            ) : swimlaneMode === "assignee" ? (
                /* Group By Assignee Swimlanes */
                <div className="kb-swimlanes-container">
                    {/* Unassigned Lane */}
                    <KanbanSwimlane
                        swimlaneKey="unassigned"
                        title="Unassigned Tasks"
                        icon={<User size={15} color="#94a3b8" />}
                        columns={activeBoard.columns}
                        tasks={filteredTasks.filter((t) => !t.assigneeId && (!t.assignee || t.assignee === "UN"))}
                        members={members}
                        draggingTaskId={draggingTaskId}
                        dragOverColumn={dragOverColumn}
                        dragOverSwimlane={dragOverSwimlane}
                        onDragOver={handleDragOverSwimlane}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDropOnSwimlane}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onTaskClick={onTaskClick}
                        onQuickAddTask={(cId) => onQuickCreateTask(cId)}
                    />

                    {/* Member Lanes */}
                    {members.map((member) => (
                        <KanbanSwimlane
                            key={member.userId || member.initials}
                            swimlaneKey={member.userId || member.initials}
                            title={`${member.name} (${member.role})`}
                            icon={
                                <div className="kb-card-avatar" style={{ width: 20, height: 20, fontSize: 9 }}>
                                    {member.initials}
                                </div>
                            }
                            columns={activeBoard.columns}
                            tasks={filteredTasks.filter(
                                (t) => t.assigneeId === member.userId || t.assignee === member.initials
                            )}
                            members={members}
                            draggingTaskId={draggingTaskId}
                            dragOverColumn={dragOverColumn}
                            dragOverSwimlane={dragOverSwimlane}
                            onDragOver={handleDragOverSwimlane}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDropOnSwimlane}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onTaskClick={onTaskClick}
                            onQuickAddTask={(cId) => onQuickCreateTask(cId)}
                        />
                    ))}
                </div>
            ) : swimlaneMode === "priority" ? (
                /* Group By Priority Swimlanes */
                <div className="kb-swimlanes-container">
                    {(["high", "medium", "low"] as TaskPriority[]).map((p) => (
                        <KanbanSwimlane
                            key={p}
                            swimlaneKey={p}
                            title={`${p.toUpperCase()} Priority`}
                            icon={<AlertTriangle size={15} className={`kb-priority-tag ${p}`} />}
                            columns={activeBoard.columns}
                            tasks={filteredTasks.filter((t) => t.priority === p)}
                            members={members}
                            draggingTaskId={draggingTaskId}
                            dragOverColumn={dragOverColumn}
                            dragOverSwimlane={dragOverSwimlane}
                            onDragOver={handleDragOverSwimlane}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDropOnSwimlane}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onTaskClick={onTaskClick}
                            onQuickAddTask={(cId) => onQuickCreateTask(cId)}
                        />
                    ))}
                </div>
            ) : (
                /* Custom Board Swimlanes */
                <div className="kb-swimlanes-container">
                    {/* General / No Swimlane Lane */}
                    <KanbanSwimlane
                        swimlaneKey="unassigned"
                        title="General Tasks"
                        icon={<Layers size={15} color="#94a3b8" />}
                        columns={activeBoard.columns}
                        tasks={filteredTasks.filter((t) => !t.swimlaneId)}
                        members={members}
                        draggingTaskId={draggingTaskId}
                        dragOverColumn={dragOverColumn}
                        dragOverSwimlane={dragOverSwimlane}
                        onDragOver={handleDragOverSwimlane}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDropOnSwimlane}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onTaskClick={onTaskClick}
                        onQuickAddTask={(cId) => onQuickCreateTask(cId)}
                    />

                    {/* Custom Lanes from Board */}
                    {(activeBoard.swimlanes || []).map((lane) => (
                        <KanbanSwimlane
                            key={lane.id}
                            swimlaneKey={lane.id}
                            title={lane.name}
                            swimlaneObject={lane}
                            icon={<Layers size={15} color="#3b82f6" />}
                            columns={activeBoard.columns}
                            tasks={filteredTasks.filter((t) => t.swimlaneId === lane.id)}
                            members={members}
                            draggingTaskId={draggingTaskId}
                            dragOverColumn={dragOverColumn}
                            dragOverSwimlane={dragOverSwimlane}
                            onDragOver={handleDragOverSwimlane}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDropOnSwimlane}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onTaskClick={onTaskClick}
                            onQuickAddTask={(cId, sKey) => onQuickCreateTask(cId, sKey)}
                            onEditSwimlane={(s) => {
                                setSelectedSwimlane(s);
                                setSwimlaneModalMode("edit");
                                setSwimlaneModalOpen(true);
                            }}
                            onDeleteSwimlane={handleDeleteSwimlane}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            <BoardModal
                isOpen={boardModalOpen}
                mode={boardModalMode}
                board={boardModalMode === "edit" ? activeBoard : null}
                onClose={() => setBoardModalOpen(false)}
                onSave={handleSaveBoard}
            />

            <ColumnModal
                isOpen={columnModalOpen}
                mode={columnModalMode}
                column={columnModalMode === "edit" ? selectedColumn : null}
                onClose={() => setColumnModalOpen(false)}
                onSave={handleSaveColumn}
            />

            <SwimlaneModal
                isOpen={swimlaneModalOpen}
                mode={swimlaneModalMode}
                swimlane={swimlaneModalMode === "edit" ? selectedSwimlane : null}
                onClose={() => setSwimlaneModalOpen(false)}
                onSave={handleSaveSwimlane}
            />

            <CreateLabelModal
                isOpen={labelModalOpen}
                onClose={() => setLabelModalOpen(false)}
                onSave={async (data) => {
                    try {
                        const newL = await createProjectLabelApi(projectId, data);
                        setLabels((prev) => [...prev, newL]);
                        setLabelModalOpen(false);
                    } catch (err: any) {
                        alert(err.message || "Failed to create label");
                    }
                }}
            />
        </div>
    );
};
