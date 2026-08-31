import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchMyTasksApi, updateTaskSemanticStatusApi, type MyTaskItem } from "../services/projectApi";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopbar } from "../components/AppTopbar";
import "./Projects.css";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "todo", label: "To Do" },
  { key: "progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Completed" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["key"];

export default function MyTasks() {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();

  const [tasks, setTasks] = useState<MyTaskItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [taskScope, setTaskScope] = useState<"all" | "assigned" | "created">("all");
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const loadTasks = () => {
    if (!activeWorkspace) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchMyTasksApi(activeWorkspace.id, taskScope)
      .then((data) => {
        setTasks(data);
      })
      .catch((err) => {
        console.error("Failed to load tasks:", err);
        setError(err.message || "Failed to load assigned tasks");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadTasks();
  }, [activeWorkspace, taskScope]);

  const mapSemanticStatus = (columnName: string) => {
    const lower = (columnName || "").toLowerCase();
    if (lower.includes("do") || lower.includes("backlog")) return "todo";
    if (lower.includes("progress")) return "progress";
    if (lower.includes("review")) return "review";
    if (lower.includes("done") || lower.includes("complete") || lower.includes("finished") || lower.includes("resolved")) return "done";
    return "todo";
  };

  const handleStatusChange = async (taskId: string, newSemanticStatus: string) => {
    setUpdatingTaskId(taskId);
    
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, columnName: newSemanticStatus } : t))
    );

    try {
      await updateTaskSemanticStatusApi(taskId, newSemanticStatus);
      loadTasks();
    } catch (err: any) {
      console.error("Failed to update task status:", err);
      loadTasks();
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleToggleCheck = (task: MyTaskItem) => {
    const nextStatus = mapSemanticStatus(task.columnName) === "done" ? "todo" : "done";
    handleStatusChange(task.id, nextStatus);
  };

  const todoCount = tasks.filter((t) => mapSemanticStatus(t.columnName) === "todo").length;
  const progressCount = tasks.filter((t) => mapSemanticStatus(t.columnName) === "progress").length;
  const reviewCount = tasks.filter((t) => mapSemanticStatus(t.columnName) === "review").length;
  const doneCount = tasks.filter((t) => mapSemanticStatus(t.columnName) === "done").length;

  const getTabCount = (tab: StatusTab) => {
    switch (tab) {
      case "todo": return todoCount;
      case "progress": return progressCount;
      case "review": return reviewCount;
      case "done": return doneCount;
      default: return tasks.length;
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesTab = activeTab === "all" || mapSemanticStatus(t.columnName) === activeTab;
    const matchesPriority = priorityFilter === "all" || (t.priority || "").toLowerCase() === priorityFilter.toLowerCase();
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.projectName || "").toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q);

    return matchesTab && matchesPriority && matchesSearch;
  });

  return (
    <div className="projects-page">

      <AppSidebar activePage="tasks" tasksCount={tasks.length} />

      <main className="projects-main">

        <AppTopbar 
          pageTitle="My Tasks" 
          searchPlaceholder="Search tasks..." 
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <section className="content">

          {/* PAGE HEADING */}
          <div className="page-heading">
            <div>
              <h1>My Tasks</h1>
              <p>
                Action items and assignments for <strong>{activeWorkspace?.name || "this workspace"}</strong>.
              </p>
            </div>

            {/* SCOPE TOGGLES */}
            <div style={{ display: "flex", gap: "6px", background: "#f0ede4", padding: "3px", borderRadius: "6px" }}>
              <button
                type="button"
                onClick={() => setTaskScope("all")}
                style={{
                  border: "none",
                  background: taskScope === "all" ? "#ffffff" : "transparent",
                  color: taskScope === "all" ? "#14161c" : "#5a594f",
                  fontWeight: taskScope === "all" ? 600 : 400,
                  fontSize: "12px",
                  padding: "5px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  boxShadow: taskScope === "all" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                All Tasks ({tasks.length})
              </button>

              <button
                type="button"
                onClick={() => setTaskScope("assigned")}
                style={{
                  border: "none",
                  background: taskScope === "assigned" ? "#ffffff" : "transparent",
                  color: taskScope === "assigned" ? "#14161c" : "#5a594f",
                  fontWeight: taskScope === "assigned" ? 600 : 400,
                  fontSize: "12px",
                  padding: "5px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  boxShadow: taskScope === "assigned" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                Assigned to Me
              </button>

              <button
                type="button"
                onClick={() => setTaskScope("created")}
                style={{
                  border: "none",
                  background: taskScope === "created" ? "#ffffff" : "transparent",
                  color: taskScope === "created" ? "#14161c" : "#5a594f",
                  fontWeight: taskScope === "created" ? 600 : 400,
                  fontSize: "12px",
                  padding: "5px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  boxShadow: taskScope === "created" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                My Projects
              </button>
            </div>
          </div>

          {/* FILTERS BAR */}
          <div className="filters">
            <div className="tabs">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={activeTab === tab.key ? "active" : ""}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label} ({getTabCount(tab.key)})
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <select
                className="category"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                style={{ outline: "none", cursor: "pointer" }}
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>

          {/* TASKS TABLE / LIST */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#9a968a", fontSize: "14px" }}>
              Loading tasks...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "60px 20px", textAlign: "center", background: "#ffffff" }}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: "18px", color: "#14161c", marginBottom: "6px" }}>
                No tasks found
              </div>
              <p style={{ color: "#9a968a", fontSize: "13px", margin: 0 }}>
                {tasks.length === 0
                  ? taskScope === "assigned"
                    ? "You have no tasks assigned to you. Click 'All Tasks' to view all project tasks."
                    : "No tasks have been created in this workspace yet."
                  : "No tasks match the selected filters."}
              </p>
              {taskScope === "assigned" && tasks.length === 0 && (
                <button className="new-project" style={{ marginTop: "16px" }} onClick={() => setTaskScope("all")}>
                  Switch to All Tasks
                </button>
              )}
            </div>
          ) : (
            <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", background: "#ffffff", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#fcfbf8", borderBottom: "1px solid #e7e3d8" }}>
                    <th style={{ width: "40px", padding: "12px 16px" }}></th>
                    <th style={{ padding: "12px 16px", fontFamily: "IBM Plex Mono, monospace", fontSize: "10.5px", letterSpacing: "0.08em", color: "#9a968a", textTransform: "uppercase" }}>Task</th>
                    <th style={{ padding: "12px 16px", fontFamily: "IBM Plex Mono, monospace", fontSize: "10.5px", letterSpacing: "0.08em", color: "#9a968a", textTransform: "uppercase" }}>Project</th>
                    <th style={{ padding: "12px 16px", fontFamily: "IBM Plex Mono, monospace", fontSize: "10.5px", letterSpacing: "0.08em", color: "#9a968a", textTransform: "uppercase" }}>Priority</th>
                    <th style={{ padding: "12px 16px", fontFamily: "IBM Plex Mono, monospace", fontSize: "10.5px", letterSpacing: "0.08em", color: "#9a968a", textTransform: "uppercase" }}>Due Date</th>
                    <th style={{ padding: "12px 16px", fontFamily: "IBM Plex Mono, monospace", fontSize: "10.5px", letterSpacing: "0.08em", color: "#9a968a", textTransform: "uppercase" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((t) => {
                    const isDone = mapSemanticStatus(t.columnName) === "done";
                    const isUpdating = updatingTaskId === t.id;

                    return (
                      <tr 
                        key={t.id} 
                        style={{ 
                          borderBottom: "1px solid #f0ede4",
                          background: isDone ? "#faf9f6" : "#ffffff",
                          transition: "background 0.12s ease",
                        }}
                      >
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleToggleCheck(t)}
                            disabled={isUpdating}
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "4px",
                              border: isDone ? "1px solid #232a3d" : "1px solid #e7e3d8",
                              background: isDone ? "#232a3d" : "#ffffff",
                              color: "#ffffff",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            {isDone && "✓"}
                          </button>
                        </td>

                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ fontWeight: 500, fontSize: "13.5px", color: isDone ? "#9a968a" : "#14161c", textDecoration: isDone ? "line-through" : "none" }}>
                            {t.title}
                          </div>
                          {t.description && (
                            <div style={{ fontSize: "11.5px", color: "#9a968a", marginTop: "2px" }}>
                              {t.description}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: "14px 16px" }}>
                          <Link 
                            to={`/projects/${t.projectId}`} 
                            style={{ 
                              fontSize: "12px", 
                              color: "#5a594f", 
                              textDecoration: "none",
                              border: "1px solid #e7e3d8",
                              padding: "3px 8px",
                              borderRadius: "5px",
                              background: "#fcfbf8"
                            }}
                          >
                            📁 {t.projectName}
                          </Link>
                        </td>

                        <td style={{ padding: "14px 16px" }}>
                          <span 
                            style={{ 
                              fontFamily: "IBM Plex Mono, monospace", 
                              fontSize: "10px", 
                              padding: "2px 7px", 
                              borderRadius: "4px",
                              background: t.priority === "HIGH" ? "#fbf0f0" : t.priority === "MEDIUM" ? "#fcf6e8" : "#f0ede4",
                              color: t.priority === "HIGH" ? "#b91c1c" : t.priority === "MEDIUM" ? "#b45309" : "#5a594f",
                              border: "1px solid #e7e3d8"
                            }}
                          >
                            {t.priority || "MEDIUM"}
                          </span>
                        </td>

                        <td style={{ padding: "14px 16px", fontFamily: "IBM Plex Mono, monospace", fontSize: "11.5px", color: "#9a968a" }}>
                          {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                        </td>

                        <td style={{ padding: "14px 16px" }}>
                          <select
                            value={mapSemanticStatus(t.columnName)}
                            onChange={(e) => handleStatusChange(t.id, e.target.value)}
                            disabled={isUpdating}
                            style={{
                              fontFamily: "Inter, sans-serif",
                              fontSize: "12px",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "1px solid #e7e3d8",
                              background: "#ffffff",
                              color: "#14161c",
                              outline: "none",
                              cursor: "pointer",
                            }}
                          >
                            <option value="todo">To Do</option>
                            <option value="progress">In Progress</option>
                            <option value="review">Review</option>
                            <option value="done">Done</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </section>
      </main>

    </div>
  );
}
