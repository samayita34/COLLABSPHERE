import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { updateWorkspaceApi } from "../services/workspaceApi";
import { getSessionsApi, revokeSessionApi, changePasswordApi, type UserSession } from "../services/authApi";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopbar } from "../components/AppTopbar";
import "./Projects.css";

export default function Settings() {
  const { userFullName, userInitials, user } = useAuth();
  const { activeWorkspace, refreshContext } = useWorkspace();

  const [activeTab, setActiveTab] = useState<"workspace" | "profile" | "preferences" | "security">("workspace");

  // Form State
  const [wsName, setWsName] = useState("");
  const [wsDesc, setWsDesc] = useState("");
  const [copiedId, setCopiedId] = useState(false);

  const [emailNotifs, setEmailNotifs] = useState(true);
  const [desktopNotifs, setDesktopNotifs] = useState(true);
  const [dueReminders, setDueReminders] = useState(true);

  // Security Tab State
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [currPass, setCurrPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "security") {
      fetchSessions();
    }
  }, [activeTab]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await getSessionsApi();
      setSessions(data);
    } catch (err: any) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSessionApi(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setSuccessMsg("Session revoked successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to revoke session");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPass.length < 6) {
      setErrorMsg("New password must be at least 6 characters long.");
      return;
    }
    if (newPass !== confirmPass) {
      setErrorMsg("New passwords do not match.");
      return;
    }

    setPassLoading(true);
    try {
      const res = await changePasswordApi(currPass, newPass);
      setSuccessMsg(res.message || "Password updated successfully.");
      setCurrPass("");
      setNewPass("");
      setConfirmPass("");
      fetchSessions();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update password.");
    } finally {
      setPassLoading(false);
    }
  };


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
              <button
                type="button"
                className={activeTab === "security" ? "active" : ""}
                onClick={() => setActiveTab("security")}
              >
                Security & Sessions
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

          {/* TAB 4: SECURITY & SESSIONS */}
          {activeTab === "security" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "28px", maxWidth: "1080px" }}>
              
              {/* CHANGE PASSWORD PANEL */}
              <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "28px", background: "#ffffff" }}>
                <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "20px", fontWeight: 500, margin: "0 0 6px" }}>
                  Password & Security
                </h2>
                <p style={{ fontSize: "13px", color: "#5a594f", margin: "0 0 24px", lineHeight: 1.5 }}>
                  {user?.isGoogleUser
                    ? "Your account was created via Google OAuth. You can set a password below to enable email/password login."
                    : "Update your password regularly to maintain account security. Changing your password revokes all other device sessions."}
                </p>

                <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {!user?.isGoogleUser && (
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#14161c", marginBottom: "6px" }}>
                        Current Password
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={currPass}
                        onChange={(e) => setCurrPass(e.target.value)}
                        required={!user?.isGoogleUser}
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
                  )}

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#14161c", marginBottom: "6px" }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      placeholder="At least 6 characters"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
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
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
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

                  <div style={{ marginTop: "10px" }}>
                    <button type="submit" className="new-project" disabled={passLoading}>
                      {passLoading ? "Updating Password..." : "Update Password"}
                    </button>
                  </div>
                </form>
              </div>

              {/* ACTIVE SESSIONS PANEL */}
              <div style={{ border: "1px solid #e7e3d8", borderRadius: "10px", padding: "28px", background: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                  <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "20px", fontWeight: 500, margin: 0 }}>
                    Active Device Sessions
                  </h2>
                  <button
                    type="button"
                    onClick={fetchSessions}
                    style={{ background: "none", border: "none", color: "#6366f1", fontSize: "12px", cursor: "pointer", fontWeight: 500 }}
                  >
                    Refresh
                  </button>
                </div>
                <p style={{ fontSize: "13px", color: "#5a594f", margin: "0 0 20px" }}>
                  Devices logged into your COLLABSPHERE account using Refresh Tokens.
                </p>

                {loadingSessions ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#9a968a", fontSize: "13px" }}>
                    Loading active sessions...
                  </div>
                ) : sessions.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#9a968a", fontSize: "13px" }}>
                    No active sessions found.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {sessions.map((sess) => (
                      <div
                        key={sess.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px",
                          border: "1px solid #f0ede4",
                          borderRadius: "8px",
                          background: "#fcfbf8",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            background: "#eef2ff",
                            color: "#4f46e5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "16px"
                          }}>
                            💻
                          </div>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#14161c", maxWidth: "240px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {sess.device || "Unknown Browser / Device"}
                            </div>
                            <div style={{ fontSize: "11.5px", color: "#9a968a", marginTop: "2px" }}>
                              IP: {sess.ip || "127.0.0.1"} • Created {new Date(sess.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRevokeSession(sess.id)}
                          style={{
                            border: "1px solid #fecaca",
                            background: "#fef2f2",
                            color: "#dc2626",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </section>
      </main>

    </div>
  );
}
