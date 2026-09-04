import React, { useEffect, useState, useRef } from "react";
import { TaskCommentSection } from "../components/TaskCommentSection";
import {
    type Task,
    type TaskPriority,
    type Member,
    type Column,
    type Swimlane,
    type Label,
    type TaskChecklist,
    type TaskChecklistItem,
    type TaskAttachment,
    type TimeEntry,
    type TaskActivityLog,
    fetchProjectLabelsApi,
    createProjectLabelApi,
    addLabelToTaskApi,
    removeLabelFromTaskApi,
    fetchTaskChecklistsApi,
    createChecklistApi,
    deleteChecklistApi,
    addChecklistItemApi,
    updateChecklistItemApi,
    deleteChecklistItemApi,
    fetchTaskAttachmentsApi,
    uploadTaskAttachmentApi,
    deleteTaskAttachmentApi,
    fetchTaskTimeEntriesApi,
    addTimeEntryApi,
    deleteTimeEntryApi,
    fetchTaskActivityApi,
} from "../services/projectApi";
import { CreateLabelModal } from "../components/kanban/KanbanModals";
import {
    X,
    Clock,
    CheckSquare,
    Paperclip,
    Activity,
    MessageSquare,
    Play,
    Pause,
    RotateCcw,
    Plus,
    Trash2,
    Download,
    FileText,
} from "lucide-react";

interface TaskModalProps {
    mode: "create" | "edit";
    task: Task | null;
    defaultColumnId: string | null;
    defaultSwimlaneId?: string | null;
    columns: Column[];
    swimlanes?: Swimlane[];
    members: Member[];
    projectId: string;
    onClose: () => void;
    onSave: (task: Task) => void;
    onDelete: (id: string) => void;
}

const PRIORITY_OPTIONS: { key: TaskPriority; label: string; color: string }[] = [
    { key: "low", label: "Low", color: "#3b82f6" },
    { key: "medium", label: "Medium", color: "#f59e0b" },
    { key: "high", label: "High", color: "#ef4444" },
];

export default function TaskModal({
    mode,
    task,
    defaultColumnId,
    defaultSwimlaneId,
    columns,
    swimlanes = [],
    members,
    projectId,
    onClose,
    onSave,
    onDelete,
}: TaskModalProps) {
    // Active Tab in modal: "details" | "checklists" | "attachments" | "time" | "activity" | "comments"
    const [activeTab, setActiveTab] = useState<"details" | "checklists" | "attachments" | "time" | "activity" | "comments">("details");

    // Form fields
    const [title, setTitle] = useState(task?.title ?? "");
    const [description, setDescription] = useState(task?.description ?? "");
    const [columnId, setColumnId] = useState<string | null>(task?.columnId ?? defaultColumnId ?? (columns[0]?.id || null));
    const [swimlaneId, setSwimlaneId] = useState<string | null>(task?.swimlaneId ?? defaultSwimlaneId ?? null);
    const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
    const [due, setDue] = useState(task?.due ?? "");
    const [assignee, setAssignee] = useState(task?.assignee ?? members[0]?.initials ?? "UN");

    // Labels state
    const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
    const [selectedLabels, setSelectedLabels] = useState<Label[]>(task?.labels || []);
    const [labelModalOpen, setLabelModalOpen] = useState(false);

    // Checklists state
    const [checklists, setChecklists] = useState<TaskChecklist[]>(task?.checklists || []);
    const [newChecklistTitle, setNewChecklistTitle] = useState("");
    const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});

    // Attachments state
    const [attachments, setAttachments] = useState<TaskAttachment[]>(task?.attachments || []);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Time Tracking state
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(task?.timeEntries || []);
    const [totalTimeMinutes, setTotalTimeMinutes] = useState<number>(task?.totalTimeSpentMinutes || 0);
    const [manualMinutes, setManualMinutes] = useState<string>("");
    const [manualDescription, setManualDescription] = useState<string>("");

    // Live Stopwatch Timer
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [timerSeconds, setTimerSeconds] = useState(0);

    // Activity History state
    const [activityLogs, setActivityLogs] = useState<TaskActivityLog[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(false);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    // Fetch Project Labels
    useEffect(() => {
        if (!projectId) return;
        fetchProjectLabelsApi(projectId)
            .then(setAvailableLabels)
            .catch(console.error);
    }, [projectId]);

    // Fetch full task data if in edit mode
    useEffect(() => {
        if (mode === "edit" && task?.id && !task.id.startsWith("t-")) {
            fetchTaskChecklistsApi(task.id)
                .then(setChecklists)
                .catch(console.error);

            fetchTaskAttachmentsApi(task.id)
                .then(setAttachments)
                .catch(console.error);

            fetchTaskTimeEntriesApi(task.id)
                .then((res) => {
                    setTimeEntries(res.data);
                    setTotalTimeMinutes(res.totalMinutes);
                })
                .catch(console.error);
        }
    }, [mode, task?.id]);

    // Fetch Activity Logs when Activity tab is active
    useEffect(() => {
        if (activeTab === "activity" && task?.id && !task.id.startsWith("t-")) {
            setLoadingActivity(true);
            fetchTaskActivityApi(task.id)
                .then(setActivityLogs)
                .catch(console.error)
                .finally(() => setLoadingActivity(false));
        }
    }, [activeTab, task?.id]);

    // Stopwatch Timer Interval
    useEffect(() => {
        let interval: any = null;
        if (isTimerRunning) {
            interval = setInterval(() => {
                setTimerSeconds((prev) => prev + 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning]);

    const formatTimerDisplay = (totalSecs: number) => {
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        return `${hrs.toString().padStart(2, "0")}:${mins
            .toString()
            .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const handleLogTimer = async () => {
        if (timerSeconds <= 0 || !task?.id) return;
        const minutes = Math.max(1, Math.round(timerSeconds / 60));
        try {
            const entry = await addTimeEntryApi(task.id, {
                duration: minutes,
                description: `Live timer session (${formatTimerDisplay(timerSeconds)})`,
            });
            setTimeEntries((prev) => [entry, ...prev]);
            setTotalTimeMinutes((prev) => prev + minutes);
            setTimerSeconds(0);
            setIsTimerRunning(false);
        } catch (err: any) {
            alert(err.message || "Failed to log time entry");
        }
    };

    const handleAddManualTime = async (e: React.FormEvent) => {
        e.preventDefault();
        const mins = parseInt(manualMinutes, 10);
        if (isNaN(mins) || mins <= 0 || !task?.id) return;

        try {
            const entry = await addTimeEntryApi(task.id, {
                duration: mins,
                description: manualDescription.trim() || undefined,
            });
            setTimeEntries((prev) => [entry, ...prev]);
            setTotalTimeMinutes((prev) => prev + mins);
            setManualMinutes("");
            setManualDescription("");
        } catch (err: any) {
            alert(err.message || "Failed to add time entry");
        }
    };

    const handleDeleteTimeEntry = async (entryId: string) => {
        try {
            await deleteTimeEntryApi(entryId);
            const deleted = timeEntries.find((e) => e.id === entryId);
            setTimeEntries((prev) => prev.filter((e) => e.id !== entryId));
            if (deleted) {
                setTotalTimeMinutes((prev) => Math.max(0, prev - deleted.duration));
            }
        } catch (err: any) {
            alert(err.message || "Failed to delete time entry");
        }
    };

    /* Checklists Actions */
    const handleCreateChecklist = async () => {
        if (!task?.id) return;
        try {
            const cl = await createChecklistApi(task.id, newChecklistTitle.trim() || "Checklist");
            setChecklists((prev) => [...prev, cl]);
            setNewChecklistTitle("");
        } catch (err: any) {
            alert(err.message || "Failed to create checklist");
        }
    };

    const handleDeleteChecklist = async (checklistId: string) => {
        try {
            await deleteChecklistApi(checklistId);
            setChecklists((prev) => prev.filter((cl) => cl.id !== checklistId));
        } catch (err: any) {
            alert(err.message || "Failed to delete checklist");
        }
    };

    const handleAddChecklistItem = async (checklistId: string) => {
        const text = newItemTexts[checklistId];
        if (!text || !text.trim()) return;

        try {
            const item = await addChecklistItemApi(checklistId, text.trim());
            setChecklists((prev) =>
                prev.map((cl) =>
                    cl.id === checklistId ? { ...cl, items: [...(cl.items || []), item] } : cl
                )
            );
            setNewItemTexts((prev) => ({ ...prev, [checklistId]: "" }));
        } catch (err: any) {
            alert(err.message || "Failed to add item");
        }
    };

    const handleToggleChecklistItem = async (checklistId: string, item: TaskChecklistItem) => {
        try {
            const updated = await updateChecklistItemApi(item.id, { isCompleted: !item.isCompleted });
            setChecklists((prev) =>
                prev.map((cl) =>
                    cl.id === checklistId
                        ? {
                              ...cl,
                              items: cl.items.map((it) => (it.id === item.id ? updated : it)),
                          }
                        : cl
                )
            );
        } catch (err: any) {
            alert(err.message || "Failed to update item");
        }
    };

    const handleDeleteChecklistItem = async (checklistId: string, itemId: string) => {
        try {
            await deleteChecklistItemApi(itemId);
            setChecklists((prev) =>
                prev.map((cl) =>
                    cl.id === checklistId
                        ? { ...cl, items: cl.items.filter((it) => it.id !== itemId) }
                        : cl
                )
            );
        } catch (err: any) {
            alert(err.message || "Failed to delete item");
        }
    };

    /* Attachments Actions */
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !task?.id) return;

        setIsUploading(true);
        try {
            const att = await uploadTaskAttachmentApi(task.id, file);
            setAttachments((prev) => [att, ...prev]);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (err: any) {
            alert(err.message || "Failed to upload file");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!task?.id) return;
        try {
            await deleteTaskAttachmentApi(task.id, attachmentId);
            setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
        } catch (err: any) {
            alert(err.message || "Failed to delete attachment");
        }
    };

    /* Labels Actions */
    const handleToggleLabel = async (label: Label) => {
        const isSelected = selectedLabels.some((l) => l.id === label.id);
        if (isSelected) {
            setSelectedLabels((prev) => prev.filter((l) => l.id !== label.id));
            if (task?.id && !task.id.startsWith("t-")) {
                await removeLabelFromTaskApi(task.id, label.id).catch(console.error);
            }
        } else {
            setSelectedLabels((prev) => [...prev, label]);
            if (task?.id && !task.id.startsWith("t-")) {
                await addLabelToTaskApi(task.id, label.id).catch(console.error);
            }
        }
    };

    const canSave = title.trim().length > 0;

    const handleSave = () => {
        if (!canSave) return;

        const assignedMember = members.find((m) => m.initials === assignee);

        onSave({
            id: task?.id ?? `t-${Date.now()}`,
            title: title.trim(),
            description: description.trim() || undefined,
            columnId,
            swimlaneId,
            order: task?.order || 0,
            priority,
            due: due.trim(),
            dueDateRaw: task?.dueDateRaw,
            assignee,
            assigneeId: assignedMember?.userId || task?.assigneeId || null,
            labels: selectedLabels,
            checklists,
            attachments,
            timeEntries,
            totalTimeSpentMinutes: totalTimeMinutes,
        });
    };

    // Calculate total checklist stats
    const totalItems = checklists.reduce((acc, cl) => acc + (cl.items?.length || 0), 0);
    const completedItems = checklists.reduce(
        (acc, cl) => acc + (cl.items?.filter((it) => it.isCompleted)?.length || 0),
        0
    );
    const checklistProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div
                className="task-modal"
                role="dialog"
                aria-modal="true"
                aria-label={mode === "create" ? "Create task" : "Edit task"}
                onMouseDown={(e) => e.stopPropagation()}
                style={{ maxWidth: "840px", width: "95vw" }}
            >
                {/* Modal Header */}
                <div className="task-modal-header" style={{ paddingBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <h3>{mode === "create" ? "New Task" : "Task Details"}</h3>
                        {mode === "edit" && task && (
                            <span
                                style={{
                                    fontFamily: "monospace",
                                    fontSize: "11px",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: "#f1f5f9",
                                    color: "#64748b",
                                }}
                            >
                                #{task.id.slice(-6)}
                            </span>
                        )}
                    </div>
                    <button className="modal-close" onClick={onClose} aria-label="Close">
                        <X size={16} />
                    </button>
                </div>

                {/* Tabs Strip in Edit Mode */}
                {mode === "edit" && task && (
                    <div
                        style={{
                            display: "flex",
                            gap: "4px",
                            borderBottom: "1px solid #e2e8f0",
                            padding: "0 24px",
                            background: "#fafafa",
                        }}
                    >
                        <button
                            type="button"
                            className={`kb-view-pill ${activeTab === "details" ? "active" : ""}`}
                            onClick={() => setActiveTab("details")}
                            style={{ borderRadius: "6px 6px 0 0", padding: "8px 14px", borderBottom: activeTab === "details" ? "2px solid #232a3d" : "none" }}
                        >
                            Details
                        </button>
                        <button
                            type="button"
                            className={`kb-view-pill ${activeTab === "checklists" ? "active" : ""}`}
                            onClick={() => setActiveTab("checklists")}
                            style={{ borderRadius: "6px 6px 0 0", padding: "8px 14px", borderBottom: activeTab === "checklists" ? "2px solid #232a3d" : "none" }}
                        >
                            <CheckSquare size={13} style={{ marginRight: 4 }} /> Checklist ({totalItems})
                        </button>
                        <button
                            type="button"
                            className={`kb-view-pill ${activeTab === "attachments" ? "active" : ""}`}
                            onClick={() => setActiveTab("attachments")}
                            style={{ borderRadius: "6px 6px 0 0", padding: "8px 14px", borderBottom: activeTab === "attachments" ? "2px solid #232a3d" : "none" }}
                        >
                            <Paperclip size={13} style={{ marginRight: 4 }} /> Files ({attachments.length})
                        </button>
                        <button
                            type="button"
                            className={`kb-view-pill ${activeTab === "time" ? "active" : ""}`}
                            onClick={() => setActiveTab("time")}
                            style={{ borderRadius: "6px 6px 0 0", padding: "8px 14px", borderBottom: activeTab === "time" ? "2px solid #232a3d" : "none" }}
                        >
                            <Clock size={13} style={{ marginRight: 4 }} /> Time Tracking ({totalTimeMinutes}m)
                        </button>
                        <button
                            type="button"
                            className={`kb-view-pill ${activeTab === "activity" ? "active" : ""}`}
                            onClick={() => setActiveTab("activity")}
                            style={{ borderRadius: "6px 6px 0 0", padding: "8px 14px", borderBottom: activeTab === "activity" ? "2px solid #232a3d" : "none" }}
                        >
                            <Activity size={13} style={{ marginRight: 4 }} /> Activity
                        </button>
                        <button
                            type="button"
                            className={`kb-view-pill ${activeTab === "comments" ? "active" : ""}`}
                            onClick={() => setActiveTab("comments")}
                            style={{ borderRadius: "6px 6px 0 0", padding: "8px 14px", borderBottom: activeTab === "comments" ? "2px solid #232a3d" : "none" }}
                        >
                            <MessageSquare size={13} style={{ marginRight: 4 }} /> Discussion
                        </button>
                    </div>
                )}

                {/* Tab: Details */}
                {activeTab === "details" && (
                    <div className="task-modal-body" style={{ maxHeight: "68vh", overflowY: "auto" }}>
                        <div className="field">
                            <label htmlFor="task-title">Title</label>
                            <input
                                id="task-title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="What needs to be done?"
                                autoFocus
                                required
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="task-desc">Description</label>
                            <textarea
                                id="task-desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add detailed context, notes, or acceptance criteria..."
                                rows={3}
                            />
                        </div>

                        <div className="field-row">
                            <div className="field">
                                <label htmlFor="task-col">Column</label>
                                <select
                                    id="task-col"
                                    value={columnId || ""}
                                    onChange={(e) => setColumnId(e.target.value || null)}
                                >
                                    {columns.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="field">
                                <label htmlFor="task-lane">Swimlane</label>
                                <select
                                    id="task-lane"
                                    value={swimlaneId || ""}
                                    onChange={(e) => setSwimlaneId(e.target.value || null)}
                                >
                                    <option value="">General / None</option>
                                    {swimlanes.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="field-row">
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

                            <div className="field">
                                <label htmlFor="task-due">Due Date</label>
                                <input
                                    id="task-due"
                                    type="text"
                                    value={due}
                                    onChange={(e) => setDue(e.target.value)}
                                    placeholder="e.g. Aug 24, Today, Tomorrow"
                                />
                            </div>
                        </div>

                        <div className="field">
                            <label htmlFor="task-assignee">Assignee</label>
                            <select
                                id="task-assignee"
                                value={assignee}
                                onChange={(e) => setAssignee(e.target.value)}
                            >
                                <option value="UN">Unassigned</option>
                                {members.map((m) => (
                                    <option key={m.userId || m.initials} value={m.initials}>
                                        {m.name} ({m.role})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Labels Section */}
                        <div className="field">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <label style={{ margin: 0 }}>Labels</label>
                                <button
                                    type="button"
                                    className="kb-action-btn"
                                    style={{ fontSize: "11px", padding: "2px 8px" }}
                                    onClick={() => setLabelModalOpen(true)}
                                >
                                    + New Label
                                </button>
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {availableLabels.map((label) => {
                                    const isSelected = selectedLabels.some((l) => l.id === label.id);
                                    return (
                                        <div
                                            key={label.id}
                                            onClick={() => handleToggleLabel(label)}
                                            style={{
                                                cursor: "pointer",
                                                padding: "4px 10px",
                                                borderRadius: "16px",
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                color: isSelected ? "#ffffff" : "#475569",
                                                backgroundColor: isSelected ? label.color : "#f1f5f9",
                                                border: `1.5px solid ${isSelected ? label.color : "#cbd5e1"}`,
                                                transition: "all 0.15s ease",
                                            }}
                                        >
                                            {label.name} {isSelected && "✓"}
                                        </div>
                                    );
                                })}

                                {availableLabels.length === 0 && (
                                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                                        No labels in project. Click "+ New Label" to create one.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab: Checklists */}
                {activeTab === "checklists" && (
                    <div className="task-modal-body" style={{ maxHeight: "68vh", overflowY: "auto" }}>
                        {/* Overall Progress */}
                        {totalItems > 0 && (
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                                    <span>Checklist Progress</span>
                                    <span>{completedItems} of {totalItems} completed ({checklistProgress}%)</span>
                                </div>
                                <div className="kb-progress-bar-bg" style={{ height: "6px" }}>
                                    <div className="kb-progress-bar-fill" style={{ width: `${checklistProgress}%` }} />
                                </div>
                            </div>
                        )}

                        {/* List of Checklists */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                            {checklists.map((checklist) => (
                                <div
                                    key={checklist.id}
                                    style={{
                                        background: "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "10px",
                                        padding: "14px",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                        <h4 style={{ margin: 0, fontSize: "14px", color: "#0f172a" }}>
                                            ☑️ {checklist.title}
                                        </h4>
                                        <button
                                            type="button"
                                            className="kb-col-btn"
                                            style={{ color: "#ef4444" }}
                                            onClick={() => handleDeleteChecklist(checklist.id)}
                                            title="Delete Checklist"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    {/* Items */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                                        {(checklist.items || []).map((item) => (
                                            <div
                                                key={item.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    padding: "6px 10px",
                                                    background: "#ffffff",
                                                    border: "1px solid #e2e8f0",
                                                    borderRadius: "6px",
                                                }}
                                            >
                                                <label
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "8px",
                                                        cursor: "pointer",
                                                        margin: 0,
                                                        fontSize: "13px",
                                                        color: item.isCompleted ? "#94a3b8" : "#1e293b",
                                                        textDecoration: item.isCompleted ? "line-through" : "none",
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={item.isCompleted}
                                                        onChange={() => handleToggleChecklistItem(checklist.id, item)}
                                                    />
                                                    <span>{item.content}</span>
                                                </label>

                                                <button
                                                    type="button"
                                                    className="kb-col-btn"
                                                    onClick={() => handleDeleteChecklistItem(checklist.id, item.id)}
                                                    title="Delete Item"
                                                >
                                                    <X size={13} />
                                                </button>
                                            </div>
                                        ))}

                                        {(!checklist.items || checklist.items.length === 0) && (
                                            <div style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
                                                No items yet. Add one below.
                                            </div>
                                        )}
                                    </div>

                                    {/* Add Item Input */}
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <input
                                            type="text"
                                            placeholder="Add an item..."
                                            value={newItemTexts[checklist.id] || ""}
                                            onChange={(e) =>
                                                setNewItemTexts({ ...newItemTexts, [checklist.id]: e.target.value })
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleAddChecklistItem(checklist.id);
                                                }
                                            }}
                                            style={{ flex: 1, padding: "6px 10px", fontSize: "12.5px" }}
                                        />
                                        <button
                                            type="button"
                                            className="kb-action-btn primary"
                                            onClick={() => handleAddChecklistItem(checklist.id)}
                                        >
                                            <Plus size={13} /> Add
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Create New Checklist */}
                            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                                <input
                                    type="text"
                                    placeholder="New checklist title (e.g. Acceptance Criteria, QA Steps)"
                                    value={newChecklistTitle}
                                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                                    style={{ flex: 1, padding: "8px 12px", fontSize: "13px" }}
                                />
                                <button
                                    type="button"
                                    className="kb-action-btn"
                                    onClick={handleCreateChecklist}
                                >
                                    <Plus size={14} /> Add Checklist
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab: Attachments */}
                {activeTab === "attachments" && (
                    <div className="task-modal-body" style={{ maxHeight: "68vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                            <div>
                                <h4 style={{ margin: 0, fontSize: "14px" }}>Task Attachments</h4>
                                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                                    Upload documents, design mockups, logs, or screenshots for this task.
                                </p>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                style={{ display: "none" }}
                                onChange={handleFileUpload}
                            />
                            <button
                                type="button"
                                className="kb-action-btn primary"
                                disabled={isUploading}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Paperclip size={14} /> {isUploading ? "Uploading..." : "Upload File"}
                            </button>
                        </div>

                        {attachments.length === 0 ? (
                            <div className="kb-empty-zone" style={{ padding: "40px" }}>
                                <Paperclip size={32} color="#cbd5e1" />
                                <p style={{ marginTop: 8 }}>No attachments uploaded yet.</p>
                            </div>
                        ) : (
                            <div className="kb-attachment-grid">
                                {attachments.map((att) => (
                                    <div key={att.id} className="kb-attachment-card">
                                        <div className="kb-attachment-info">
                                            <FileText size={20} color="#3b82f6" />
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div className="kb-attachment-name" title={att.fileName}>
                                                    {att.fileName}
                                                </div>
                                                <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                                    {att.fileSize ? `${Math.round(att.fileSize / 1024)} KB` : "File"}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: "6px" }}>
                                            <a
                                                href={att.fileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="kb-action-btn"
                                                style={{ fontSize: "11px", padding: "3px 8px" }}
                                            >
                                                <Download size={11} /> Download
                                            </a>
                                            <button
                                                type="button"
                                                className="kb-col-btn"
                                                style={{ color: "#ef4444" }}
                                                onClick={() => handleDeleteAttachment(att.id)}
                                                title="Delete Attachment"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab: Time Tracking */}
                {activeTab === "time" && (
                    <div className="task-modal-body" style={{ maxHeight: "68vh", overflowY: "auto" }}>
                        {/* Stopwatch Timer Widget */}
                        <div className="kb-timer-widget">
                            <div>
                                <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                                    Stopwatch Timer
                                </div>
                                <div className="kb-timer-display">
                                    {formatTimerDisplay(timerSeconds)}
                                </div>
                            </div>

                            <div className="kb-timer-actions">
                                {!isTimerRunning ? (
                                    <button
                                        type="button"
                                        className="kb-action-btn primary"
                                        onClick={() => setIsTimerRunning(true)}
                                    >
                                        <Play size={14} /> Start Timer
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="kb-action-btn"
                                        onClick={() => setIsTimerRunning(false)}
                                    >
                                        <Pause size={14} /> Pause
                                    </button>
                                )}

                                {timerSeconds > 0 && (
                                    <>
                                        <button
                                            type="button"
                                            className="kb-action-btn"
                                            onClick={handleLogTimer}
                                            title="Save Logged Time"
                                        >
                                            Log Time
                                        </button>
                                        <button
                                            type="button"
                                            className="kb-col-btn"
                                            onClick={() => {
                                                setIsTimerRunning(false);
                                                setTimerSeconds(0);
                                            }}
                                            title="Reset Timer"
                                        >
                                            <RotateCcw size={14} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Manual Log Form */}
                        <form onSubmit={handleAddManualTime} style={{ marginTop: "16px", background: "#fcfbf9", padding: "14px", borderRadius: "10px", border: "1px solid #e7e3d8" }}>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b", marginBottom: 10 }}>
                                ⏱️ Log Time Manually
                            </div>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <input
                                    type="number"
                                    placeholder="Minutes (e.g. 45)"
                                    value={manualMinutes}
                                    onChange={(e) => setManualMinutes(e.target.value)}
                                    style={{ width: "140px", padding: "6px 10px", fontSize: "12.5px" }}
                                    min="1"
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="Work description (e.g. Refactored auth controller)"
                                    value={manualDescription}
                                    onChange={(e) => setManualDescription(e.target.value)}
                                    style={{ flex: 1, padding: "6px 10px", fontSize: "12.5px" }}
                                />
                                <button type="submit" className="kb-action-btn primary">
                                    Log
                                </button>
                            </div>
                        </form>

                        {/* Total Logged Summary & Entries Table */}
                        <div style={{ marginTop: "20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                <h4 style={{ margin: 0, fontSize: "13.5px" }}>Time Entries Log</h4>
                                <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                                    Total: {Math.floor(totalTimeMinutes / 60)}h {totalTimeMinutes % 60}m
                                </span>
                            </div>

                            {timeEntries.length === 0 ? (
                                <div style={{ fontSize: "12.5px", color: "#94a3b8", fontStyle: "italic", padding: "12px 0" }}>
                                    No time logged yet.
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {timeEntries.map((entry) => (
                                        <div
                                            key={entry.id}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "8px 12px",
                                                background: "#ffffff",
                                                border: "1px solid #e2e8f0",
                                                borderRadius: "6px",
                                                fontSize: "12.5px",
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <div className="kb-card-avatar" style={{ width: 22, height: 22, fontSize: 9 }}>
                                                    {entry.user ? `${entry.user.firstName[0]}${entry.user.lastName[0]}` : "U"}
                                                </div>
                                                <div>
                                                    <strong>{entry.duration} mins</strong>
                                                    {entry.description && (
                                                        <span style={{ color: "#64748b", marginLeft: 8 }}>
                                                            {entry.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                                                    {new Date(entry.date || entry.createdAt || "").toLocaleDateString()}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="kb-col-btn"
                                                    style={{ color: "#ef4444" }}
                                                    onClick={() => handleDeleteTimeEntry(entry.id)}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tab: Activity History */}
                {activeTab === "activity" && (
                    <div className="task-modal-body" style={{ maxHeight: "68vh", overflowY: "auto" }}>
                        <h4 style={{ margin: "0 0 14px 0", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Activity size={16} color="#4f46e5" /> Activity & Audit Timeline
                        </h4>
                        {loadingActivity ? (
                            <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                                Loading task audit history...
                            </div>
                        ) : activityLogs.length === 0 ? (
                            <div style={{ color: "#94a3b8", fontSize: "12.5px", fontStyle: "italic", padding: "16px 0" }}>
                                No activity recorded for this task yet.
                            </div>
                        ) : (
                            <div className="kb-activity-timeline">
                                {activityLogs.map((log) => {
                                    const fn = log.user?.firstName || "";
                                    const ln = log.user?.lastName || "";
                                    const initials = ((fn[0] || "") + (ln[0] || "")).toUpperCase() || "US";
                                    const actorName = log.user ? `${fn} ${ln}`.trim() || log.user.email : "System";
                                    const when = new Date(log.createdAt).toLocaleString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit"
                                    });

                                    let actionBadgeColor = "#e2e8f0";
                                    let actionTextColor = "#334155";
                                    if (log.action.includes("CREATE")) {
                                        actionBadgeColor = "#dcfce7";
                                        actionTextColor = "#166534";
                                    } else if (log.action.includes("STATUS") || log.action.includes("MOVE")) {
                                        actionBadgeColor = "#e0f2fe";
                                        actionTextColor = "#0369a1";
                                    } else if (log.action.includes("DELETE") || log.action.includes("REMOVE")) {
                                        actionBadgeColor = "#fee2e2";
                                        actionTextColor = "#991b1b";
                                    } else if (log.action.includes("COMMENT")) {
                                        actionBadgeColor = "#f3e8ff";
                                        actionTextColor = "#6b21a8";
                                    }

                                    const formattedAction = log.action
                                        .replace(/_/g, " ")
                                        .toLowerCase()
                                        .replace(/\b\w/g, (c) => c.toUpperCase());

                                    return (
                                        <div key={log.id} className="kb-activity-item" style={{ marginBottom: "14px" }}>
                                            <div style={{
                                                width: "28px",
                                                height: "28px",
                                                borderRadius: "50%",
                                                background: "#4f46e5",
                                                color: "#ffffff",
                                                fontSize: "10px",
                                                fontWeight: 700,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}>
                                                {initials}
                                            </div>
                                            <div className="kb-activity-content" style={{ flex: 1 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "13px" }}>
                                                    <strong style={{ color: "#0f172a" }}>{actorName}</strong>
                                                    <span style={{
                                                        fontSize: "11px",
                                                        fontWeight: 600,
                                                        padding: "1px 8px",
                                                        borderRadius: "10px",
                                                        backgroundColor: actionBadgeColor,
                                                        color: actionTextColor,
                                                    }}>
                                                        {formattedAction}
                                                    </span>
                                                    {log.details?.fromColumn && log.details?.toColumn && (
                                                        <span style={{ fontSize: "12px", color: "#475569", fontWeight: 500 }}>
                                                            ({log.details.fromColumn} &rarr; {log.details.toColumn})
                                                        </span>
                                                    )}
                                                </div>
                                                {log.details?.title && (
                                                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                                                        Title: "{log.details.title}"
                                                    </div>
                                                )}
                                                {log.details?.duration && (
                                                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                                                        Logged {log.details.duration} mins {log.details.description ? `- ${log.details.description}` : ""}
                                                    </div>
                                                )}
                                                <span className="kb-activity-time" style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginTop: "3px" }}>
                                                    {when}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab: Discussion / Comments */}
                {activeTab === "comments" && task && (
                    <div className="task-modal-body" style={{ maxHeight: "68vh", overflowY: "auto" }}>
                        <TaskCommentSection
                            projectId={projectId}
                            taskId={task.id}
                            projectMembers={members as any}
                        />
                    </div>
                )}

                {/* Footer */}
                <div className="task-modal-footer">
                    {mode === "edit" && task ? (
                        <button
                            type="button"
                            className="modal-delete"
                            onClick={() => onDelete(task.id)}
                        >
                            Delete Task
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
                            {mode === "create" ? "Create Task" : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Create Label Modal */}
            <CreateLabelModal
                isOpen={labelModalOpen}
                onClose={() => setLabelModalOpen(false)}
                onSave={async (data) => {
                    try {
                        const newL = await createProjectLabelApi(projectId, data);
                        setAvailableLabels((prev) => [...prev, newL]);
                        setSelectedLabels((prev) => [...prev, newL]);
                        setLabelModalOpen(false);
                    } catch (err: any) {
                        alert(err.message || "Failed to create label");
                    }
                }}
            />
        </div>
    );
}