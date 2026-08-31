import { useEffect, useState } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchWorkspaceAnalyticsApi, type WorkspaceAnalyticsData } from "../services/workspaceApi";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopbar } from "../components/AppTopbar";
import "./Projects.css";

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function Analytics() {
  const { activeWorkspace } = useWorkspace();
  
  const [data, setData] = useState<WorkspaceAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = () => {
    if (!activeWorkspace) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchWorkspaceAnalyticsApi(activeWorkspace.id)
      .then((analyticsData) => {
        setData(analyticsData);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load analytics:", err);
        setError(err.message || "Failed to load analytics data");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadAnalytics();
  }, [activeWorkspace]);

  const maxProductivity = data?.productivityTrends 
    ? Math.max(...data.productivityTrends.map(t => t.completed), 1)
    : 1;

  const storageUsed = data?.storageUsage?.used || 0;
  const storageQuota = data?.storageUsage?.quota || 1;
  const storagePct = Math.min(Math.round((storageUsed / storageQuota) * 100), 100);

  return (
    <div className="projects-page">

      <AppSidebar activePage="analytics" />

      <main className="projects-main">

        <AppTopbar pageTitle="Analytics" />

        {/* CONTENT */}
        <section className="content">

          {/* PAGE HEADING */}
          <div className="page-heading">
            <div>
              <h1>Analytics & Telemetry</h1>
              <p>Performance metrics, team output velocity, and resource utilization for <strong>{activeWorkspace?.name || "Workspace"}</strong>.</p>
            </div>

            <button className="new-project" onClick={loadAnalytics} disabled={loading}>
              {loading ? "Refreshing..." : "↻ Refresh Telemetry"}
            </button>
          </div>

          {/* ERROR BANNER */}
          {error && (
            <div style={{ background: "#fdf2f2", color: "#991b1b", border: "1px solid #f8d7da", padding: "12px 18px", borderRadius: "8px", marginBottom: "24px", fontSize: "13px" }}>
              {error}
            </div>
          )}

          {loading && !data ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#9a968a", fontSize: "14px" }}>
              Loading analytics data...
            </div>
          ) : data ? (
            <>
              {/* TOP 4 STATS CARDS */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "18px", marginBottom: "34px" }}>
                
                <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "20px", background: "#ffffff" }}>
                  <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "11px", color: "#9a968a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Completion Rate
                  </div>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: "32px", fontWeight: 500, color: "#14161c", margin: "8px 0 4px" }}>
                    {Math.round(data.taskCompletionRate * 100)}%
                  </div>
                  <div style={{ fontSize: "12px", color: "#5a594f" }}>
                    Of {data.workspaceGrowth.totalTasks} total tasks
                  </div>
                </div>

                <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "20px", background: "#ffffff" }}>
                  <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "11px", color: "#9a968a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Active Contributors
                  </div>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: "32px", fontWeight: 500, color: "#14161c", margin: "8px 0 4px" }}>
                    {data.activeUsers}
                  </div>
                  <div style={{ fontSize: "12px", color: "#5a594f" }}>
                    Of {data.workspaceGrowth.totalUsers} workspace members
                  </div>
                </div>

                <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "20px", background: "#ffffff" }}>
                  <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "11px", color: "#9a968a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Document Activity
                  </div>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: "32px", fontWeight: 500, color: "#14161c", margin: "8px 0 4px" }}>
                    {data.documentActivity}
                  </div>
                  <div style={{ fontSize: "12px", color: "#5a594f" }}>
                    Edits in last 30 days
                  </div>
                </div>

                <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "20px", background: "#ffffff" }}>
                  <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "11px", color: "#9a968a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Discussions & Chat
                  </div>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: "32px", fontWeight: 500, color: "#14161c", margin: "8px 0 4px" }}>
                    {data.chatStatistics}
                  </div>
                  <div style={{ fontSize: "12px", color: "#5a594f" }}>
                    Messages across channels
                  </div>
                </div>

              </div>

              {/* 2-COLUMN SECTION: PRODUCTIVITY CHART & TEAM PERFORMANCE */}
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "28px", marginBottom: "34px" }}>
                
                {/* 30-DAY VELOCITY */}
                <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "24px", background: "#ffffff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "18px" }}>
                    <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "18px", fontWeight: 500, margin: 0 }}>
                      30-Day Velocity & Output
                    </h2>
                    <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "11px", color: "#9a968a" }}>
                      Daily Completed Tasks
                    </span>
                  </div>

                  <div style={{ height: "200px", display: "flex", alignItems: "flex-end", gap: "5px", background: "#fcfbf8", padding: "16px 12px 8px", borderRadius: "8px", border: "1px solid #f0ede4" }}>
                    {data.productivityTrends.map((t, idx) => {
                      const heightPct = Math.max((t.completed / maxProductivity) * 100, t.completed > 0 ? 15 : 4);
                      const isNonZero = t.completed > 0;
                      return (
                        <div 
                          key={idx} 
                          title={`${t.date}: ${t.completed} tasks`}
                          style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", cursor: "pointer" }}
                        >
                          <div style={{ width: "100%", maxWidth: "12px", height: `${heightPct}%`, background: isNonZero ? "#232a3d" : "#e7e3d8", borderRadius: "3px 3px 0 0", transition: "all 0.2s" }} />
                          {idx % 6 === 0 && (
                            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "9px", color: "#9a968a", marginTop: "6px", whiteSpace: "nowrap" }}>
                              {new Date(t.date).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* TEAM LEADERBOARD */}
                <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "24px", background: "#ffffff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "18px" }}>
                    <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "18px", fontWeight: 500, margin: 0 }}>
                      Member Output
                    </h2>
                    <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "11px", color: "#9a968a" }}>
                      Leaderboard
                    </span>
                  </div>

                  {data.teamPerformance.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 20px", color: "#9a968a", fontSize: "13px" }}>
                      No tasks completed yet.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {data.teamPerformance.slice(0, 5).map((m, idx) => {
                        const initials = m.name.slice(0, 2).toUpperCase();
                        const maxScore = Math.max(...data.teamPerformance.map(u => u.completedTasks), 1);
                        const pct = Math.round((m.completedTasks / maxScore) * 100);

                        return (
                          <div key={m.userId || idx} style={{ padding: "10px 14px", border: "1px solid #f0ede4", borderRadius: "8px", background: "#ffffff" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div className="profile-avatar" style={{ width: "24px", height: "24px", fontSize: "9.5px" }}>
                                  {initials}
                                </div>
                                <strong style={{ fontSize: "13px", color: "#14161c", fontWeight: 500 }}>{m.name}</strong>
                              </div>
                              <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "11px", color: "#232a3d", fontWeight: 500 }}>
                                {m.completedTasks} {m.completedTasks === 1 ? "task" : "tasks"}
                              </span>
                            </div>
                            <div style={{ height: "3px", background: "#f0ede4", borderRadius: "2px", overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: "#232a3d" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* BOTTOM ROW: STORAGE & WORKSPACE FOOTPRINT */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px" }}>
                
                {/* STORAGE */}
                <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "24px", background: "#ffffff" }}>
                  <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "18px", fontWeight: 500, margin: "0 0 18px" }}>
                    Storage Quota
                  </h2>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                    <div>
                      <span style={{ fontSize: "11.5px", color: "#9a968a", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "IBM Plex Mono, monospace" }}>Used Storage</span>
                      <div style={{ fontFamily: "Fraunces, serif", fontSize: "24px", fontWeight: 500, color: "#14161c" }}>{formatBytes(storageUsed)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "11.5px", color: "#9a968a", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "IBM Plex Mono, monospace" }}>Total Quota</span>
                      <div style={{ fontFamily: "Fraunces, serif", fontSize: "18px", color: "#5a594f" }}>{formatBytes(storageQuota)}</div>
                    </div>
                  </div>

                  <div style={{ height: "6px", background: "#f0ede4", borderRadius: "3px", overflow: "hidden", margin: "14px 0 10px" }}>
                    <div style={{ width: `${storagePct}%`, height: "100%", background: "#232a3d", borderRadius: "3px" }} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#9a968a" }}>
                    <span>✓ S3 Cloud Bucket Active</span>
                    <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{formatBytes(Math.max(storageQuota - storageUsed, 0))} remaining</span>
                  </div>
                </div>

                {/* WORKSPACE FOOTPRINT */}
                <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "24px", background: "#ffffff" }}>
                  <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "18px", fontWeight: 500, margin: "0 0 18px" }}>
                    Workspace Scale
                  </h2>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                    <div style={{ textAlign: "center", padding: "16px 8px", background: "#fcfbf8", border: "1px solid #f0ede4", borderRadius: "8px" }}>
                      <div style={{ fontFamily: "Fraunces, serif", fontSize: "28px", fontWeight: 500, color: "#14161c" }}>{data.workspaceGrowth.totalUsers}</div>
                      <div style={{ fontSize: "11.5px", color: "#9a968a", marginTop: "4px" }}>Members</div>
                    </div>

                    <div style={{ textAlign: "center", padding: "16px 8px", background: "#fcfbf8", border: "1px solid #f0ede4", borderRadius: "8px" }}>
                      <div style={{ fontFamily: "Fraunces, serif", fontSize: "28px", fontWeight: 500, color: "#14161c" }}>{data.workspaceGrowth.totalProjects}</div>
                      <div style={{ fontSize: "11.5px", color: "#9a968a", marginTop: "4px" }}>Projects</div>
                    </div>

                    <div style={{ textAlign: "center", padding: "16px 8px", background: "#fcfbf8", border: "1px solid #f0ede4", borderRadius: "8px" }}>
                      <div style={{ fontFamily: "Fraunces, serif", fontSize: "28px", fontWeight: 500, color: "#14161c" }}>{data.workspaceGrowth.totalTasks}</div>
                      <div style={{ fontSize: "11.5px", color: "#9a968a", marginTop: "4px" }}>Tasks</div>
                    </div>
                  </div>
                </div>

              </div>
            </>
          ) : null}

        </section>
      </main>

    </div>
  );
}
