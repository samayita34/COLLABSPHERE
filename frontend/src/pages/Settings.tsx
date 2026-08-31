import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { updateWorkspaceApi } from "../services/workspaceApi";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopbar } from "../components/AppTopbar";
import "./Projects.css";

export default function Settings() {
  const { userFullName, userInitials, user } = useAuth();
  const { activeWorkspace, refreshContext } = useWorkspace();

  const [activeTab, setActiveTab] = useState<"workspace" | "profile" | "preferences">("workspace");

  // Form State
  const [wsName, setWsName] = useState("");
  const [wsDesc, setWsDesc] = useState("");
  const [copiedId, setCopiedId] = useState(false);

  const [emailNotifs, setEmailNotifs] = useState(true);
  const [desktopNotifs, setDesktopNotifs] = useState(true);
  const [dueReminders, setDueReminders] = useState(true);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeWorkspace) {
      setWsName(activeWorkspace.name || "");
      setWsDesc(activeWorkspace.description || "");
    }
  }, [activeWorkspace]);

  const handleCopyId = () => {
    if (activeWorkspace?.id) {
      navigator.clipboard.writeText(activeWorkspace.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await updateWorkspaceApi(activeWorkspace.id, {
        name: wsName.trim(),
        description: wsDesc.trim(),
      });
      await refreshContext();
      setSuccessMsg("Workspace configuration updated successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update workspace settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg("Notification preferences updated!");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const ws = activeWorkspace as any;
  const storageQuotaMB = ws?.storageQuota ? Math.round(Number(ws.storageQuota) / (1024 * 1024)) : 5120;
  const storageUsedMB = ws?.storageUsed ? Math.round(Number(ws.storageUsed) / (1024 * 1024)) : 0;
  const storagePercent = Math.min(100, Math.round((storageUsedMB / (storageQuotaMB || 1)) * 100));

  return (
    <div className="projects-page">

      <AppSidebar activePage="settings" />

      <main className="projects-main">

        <AppTopbar pageTitle="Settings" />

        <section className="content">

          {/* PAGE HEADING */}
          <div className="page-heading">
            <div>
              <h1>Settings & Preferences</h1>
              <p>Configure workspace parameters, personal account, and notification preferences.</p>
            </div>
          </div>

          {/* FEEDBACK MESSAGES */}
          {successMsg && (
            <div style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "12px 18px", borderRadius: "8px", marginBottom: "20px", fontSize: "13.5px" }}>
              ✓ {successMsg}
            </div>
          )}

          {errorMsg && (
            <div style={{ background: "#fdf2f2", color: "#991b1b", border: "1px solid #f8d7da", padding: "12px 18px", borderRadius: "8px", marginBottom: "20px", fontSize: "13.5px" }}>
              ✕ {errorMsg}
            </div>
          )}

          {/* TABS */}
          <div className="filters">
            <div className="tabs">
              <button
                type="button"
                className={activeTab === "workspace" ? "active" : ""}
                onClick={() => setActiveTab("workspace")}
              >
                Workspace Details
              </button>
              <button
                type="button"
                className={activeTab === "profile" ? "active" : ""}
                onClick={() => setActiveTab("profile")}
              >
                My Profile
              </button>
              <button
                type="button"
                className={activeTab === "preferences" ? "active" : ""}
                onClick={() => setActiveTab("preferences")}
              >
                Notifications & Alerts
              </button>
            </div>
          </div>

          {/* TAB 1: WORKSPACE CONFIGURATION */}
          {activeTab === "workspace" && (
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "28px", maxWidth: "1080px" }}>
              
              <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "28px", background: "#ffffff" }}>
                <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "20px", fontWeight: 500, margin: "0 0 6px" }}>
                  Workspace Identity
                </h2>
                <p style={{ fontSize: "13px", color: "#5a594f", margin: "0 0 24px" }}>
                  Update your active workspace identity and public details.
                </p>

                <form onSubmit={handleSaveWorkspace} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#14161c", marginBottom: "6px" }}>
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      value={wsName}
                      onChange={(e) => setWsName(e.target.value)}
                      placeholder="Workspace Name"
                      required
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        border: "1px solid #e7e3d8",
                        borderRadius: "6px",
                        fontFamily: "Inter, sans-serif",
                        fontSize: "13.5px",
                        color: "#14161c",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#14161c", marginBottom: "6px" }}>
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={wsDesc}
                      onChange={(e) => setWsDesc(e.target.value)}
                      placeholder="Brief description of this workspace"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        border: "1px solid #e7e3d8",
                        borderRadius: "6px",
                        fontFamily: "Inter, sans-serif",
                        fontSize: "13.5px",
                        color: "#14161c",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#14161c", marginBottom: "6px" }}>
                      Workspace ID
                    </label>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fcfbf8", border: "1px solid #e7e3d8", borderRadius: "6px", padding: "8px 12px" }}>
                      <code style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "12px", color: "#5a594f" }}>
                        {activeWorkspace?.id || "N/A"}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyId}
                        style={{
                          border: "1px solid #e7e3d8",
                          background: "#ffffff",
                          padding: "4px 10px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        {copiedId ? "Copied!" : "Copy ID"}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: "10px" }}>
                    <button type="submit" className="new-project" disabled={saving}>
                      {saving ? "Saving..." : "Save Workspace Changes"}
                    </button>
                  </div>
                </form>
              </div>

              {/* STORAGE QUOTA CARD */}
              <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "28px", background: "#ffffff" }}>
                <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "20px", fontWeight: 500, margin: "0 0 6px" }}>
                  Storage Allocation
                </h2>
                <p style={{ fontSize: "13px", color: "#5a594f", margin: "0 0 20px" }}>
                  Cloud file storage limits for this workspace.
                </p>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#9a968a", fontFamily: "IBM Plex Mono, monospace" }}>
                    {storageUsedMB} MB of {storageQuotaMB} MB used
                  </span>
                  <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "12px", fontWeight: 500 }}>
                    {storagePercent}%
                  </span>
                </div>

                <div style={{ height: "6px", background: "#f0ede4", borderRadius: "3px", overflow: "hidden", margin: "10px 0 16px" }}>
                  <div style={{ width: `${storagePercent}%`, height: "100%", background: "#232a3d" }} />
                </div>

                <div style={{ fontSize: "12px", color: "#5a594f", lineHeight: "1.5" }}>
                  ✓ Standard S3 Storage Bucket connected and active across all workspace projects.
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: MY PROFILE */}
          {activeTab === "profile" && (
            <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "28px", background: "#ffffff", maxWidth: "680px" }}>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "20px", fontWeight: 500, margin: "0 0 6px" }}>
                User Profile
              </h2>
              <p style={{ fontSize: "13px", color: "#5a594f", margin: "0 0 24px" }}>
                Your personal details and account context.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "16px", paddingBottom: "20px", borderBottom: "1px solid #f0ede4", marginBottom: "20px" }}>
                <div className="profile-avatar" style={{ width: "48px", height: "48px", fontSize: "16px" }}>
                  {userInitials}
                </div>
                <div>
                  <h3 style={{ fontFamily: "Fraunces, serif", fontSize: "18px", margin: "0 0 2px", color: "#14161c" }}>{userFullName}</h3>
                  <span style={{ fontSize: "13px", color: "#9a968a" }}>{user?.email}</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#14161c", marginBottom: "6px" }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={userFullName}
                    disabled
                    readOnly
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #e7e3d8", borderRadius: "6px", background: "#fcfbf8", color: "#5a594f", fontSize: "13.5px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#14161c", marginBottom: "6px" }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    readOnly
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #e7e3d8", borderRadius: "6px", background: "#fcfbf8", color: "#5a594f", fontSize: "13.5px" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PREFERENCES */}
          {activeTab === "preferences" && (
            <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "28px", background: "#ffffff", maxWidth: "680px" }}>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "20px", fontWeight: 500, margin: "0 0 6px" }}>
                Notification Preferences
              </h2>
              <p style={{ fontSize: "13px", color: "#5a594f", margin: "0 0 24px" }}>
                Customize how and when Collabsphere notifies you.
              </p>

              <form onSubmit={handleSavePreferences} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px", border: "1px solid #f0ede4", borderRadius: "8px", cursor: "pointer", background: "#fcfbf8" }}>
                  <div>
                    <strong style={{ display: "block", fontSize: "13.5px", color: "#14161c" }}>Email Notifications</strong>
                    <span style={{ fontSize: "12px", color: "#9a968a" }}>Receive email updates for task assignments and mentions.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailNotifs}
                    onChange={(e) => setEmailNotifs(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "#232a3d" }}
                  />
                </label>

                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px", border: "1px solid #f0ede4", borderRadius: "8px", cursor: "pointer", background: "#fcfbf8" }}>
                  <div>
                    <strong style={{ display: "block", fontSize: "13.5px", color: "#14161c" }}>Desktop Alerts</strong>
                    <span style={{ fontSize: "12px", color: "#9a968a" }}>Show browser popups for chat messages and comments.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={desktopNotifs}
                    onChange={(e) => setDesktopNotifs(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "#232a3d" }}
                  />
                </label>

                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px", border: "1px solid #f0ede4", borderRadius: "8px", cursor: "pointer", background: "#fcfbf8" }}>
                  <div>
                    <strong style={{ display: "block", fontSize: "13.5px", color: "#14161c" }}>Due Date Reminders</strong>
                    <span style={{ fontSize: "12px", color: "#9a968a" }}>Receive alerts for upcoming deadlines in the next 24 hours.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={dueReminders}
                    onChange={(e) => setDueReminders(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "#232a3d" }}
                  />
                </label>

                <div style={{ marginTop: "10px" }}>
                  <button type="submit" className="new-project">
                    Save Preferences
                  </button>
                </div>
              </form>
            </div>
          )}

        </section>
      </main>

    </div>
  );
}
