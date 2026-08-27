import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchWorkspaceFiles } from "../services/workspaceApi";
import { type WorkspaceFile } from "../services/projectApi";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
// import { FileDetailModal, type ProjectFile } from "./FileModal"; // We don't have FileDetailModal for this simplified view right now
import "./Projects.css";
import "./ProjectWorkspace.css";

const FILE_CATEGORY_FILTERS: { key: "all" | "images" | "documents" | "design" | "archives" | "videos"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "images", label: "Images" },
    { key: "documents", label: "Documents" },
    { key: "design", label: "Design" },
    { key: "archives", label: "Archives" },
    { key: "videos", label: "Videos" },
];

const FILE_CATEGORY_MAP: Record<string, "images" | "documents" | "design" | "archives" | "videos"> = {
    PNG: "images",
    JPG: "images",
    PDF: "documents",
    DOC: "documents",
    XLS: "documents",
    PPT: "documents",
    FIG: "design",
    ZIP: "archives",
    MP4: "videos",
};

export default function Files() {
    const navigate = useNavigate();
    const { userFullName, userInitials, logout } = useAuth();
    const { activeWorkspace } = useWorkspace();
    
    const [files, setFiles] = useState<WorkspaceFile[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    
    const [fileFilter, setFileFilter] = useState<"all" | "images" | "documents" | "design" | "archives" | "videos">("all");
    const [fileSearch, setFileSearch] = useState("");


    useEffect(() => {
        let isMounted = true;
        if (!activeWorkspace) {
            setFiles([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        fetchWorkspaceFiles(activeWorkspace.id)
            .then((data) => {
                if (isMounted) {
                    setFiles(data);
                    setError(null);
                }
            })
            .catch((err) => {
                if (isMounted) {
                    console.error("Error fetching files:", err);
                    setError(err.message || "Failed to load files");
                }
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [activeWorkspace]);

    const filteredFiles = files.filter((f) => {
        const cat = FILE_CATEGORY_MAP[f.type];
        const catMatch = fileFilter === "all" || cat === fileFilter;
        const q = fileSearch.trim().toLowerCase();
        const latestVersion = f.versions?.[0];
        const searchMatch =
            !q ||
            f.name.toLowerCase().includes(q) ||
            (latestVersion?.uploadedBy?.firstName || "").toLowerCase().includes(q) ||
            (f.description ?? "").toLowerCase().includes(q) ||
            (f.projectName && f.projectName.toLowerCase().includes(q)) ||
            (f.projectCode && f.projectCode.toLowerCase().includes(q));
        return catMatch && searchMatch;
    });



    return (
        <div className="projects-page">
            <aside className="projects-sidebar">
                <div className="brand">
                    <span>Collabsphere</span>
                    <small>ENT</small>
                </div>

                <WorkspaceSelector />

                <div className="nav-title">NAVIGATION</div>

                <nav>
                    <Link to="/overview">Overview</Link>
                    <Link to="/projects">Projects</Link>
                    <Link to="/my-tasks">My Tasks</Link>
                    <Link to="/documents">Documents</Link>
                    <Link to="/files" className="selected">
                        Files
                        <span>{files.length}</span>
                    </Link>
                    <Link to="/messages">Messages</Link>
                    <a href="#" onClick={(e) => { e.preventDefault(); navigate("/projects"); }}>Analytics</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); navigate("/projects"); }}>Settings</a>
                </nav>

                <div className="profile">
                    <div className="profile-avatar">{userInitials}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{userFullName}</strong>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Workspace Member</span>
                    </div>

                    <button
                        onClick={logout}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#ef4444",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: "4px 8px",
                            borderRadius: "4px",
                        }}
                        title="Sign out"
                    >
                        Sign out
                    </button>
                </div>
            </aside>

            <main className="projects-main">
                <header className="topbar">
                    <div className="breadcrumb">
                        Workspace / <strong>Files</strong>
                    </div>

                    <div className="topbar-actions">
                        <div className="search">
                            <span>?</span>
                            <input placeholder="Search anything..." />
                            <kbd>? K</kbd>
                        </div>
                        <button className="notification">?</button>
                        <div className="profile-avatar">{userInitials}</div>
                    </div>
                </header>

                <section className="content">
                    <div className="page-heading">
                        <div>
                            <h1>Files</h1>
                            <p>Global files and assets across all projects in this workspace.</p>
                        </div>
                    </div>

                    <div className="tab-pane" style={{ marginTop: "24px" }}>
                        <div className="pane-toolbar">
                            <div className="pane-title">
                                <h2>All Files ({filteredFiles.length})</h2>
                            </div>

                            <div className="pane-actions">
                                <div className="search">
                                    <span>?</span>
                                    <input
                                        placeholder="Search files..."
                                        value={fileSearch}
                                        onChange={(e) => setFileSearch(e.target.value)}
                                    />
                                </div>

                                <select
                                    className="filter-select"
                                    value={fileFilter}
                                    onChange={(e) => setFileFilter(e.target.value as any)}
                                >
                                    {FILE_CATEGORY_FILTERS.map((f) => (
                                        <option key={f.key} value={f.key}>
                                            {f.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ padding: "40px 0", color: "#64748b", textAlign: "center" }}>
                                Loading files...
                            </div>
                        ) : error ? (
                            <div style={{ padding: "40px 0", color: "#ef4444", textAlign: "center" }}>
                                {error}
                            </div>
                        ) : (
                            <div className="files-grid">
                                {filteredFiles.length === 0 ? (
                                    <div className="empty-state" style={{ gridColumn: "1 / -1", padding: "60px 0", textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                                        <p>No files found.</p>
                                    </div>
                                ) : (
                                    filteredFiles.map((f) => (
                                        <div
                                            className="file-card"
                                            key={f.id}
                                        >
                                            <div className="file-preview">
                                                {f.type}
                                            </div>
                                            <div className="file-info">
                                                <h3 title={f.name}>{f.name}</h3>
                                                <p className="file-size">{f.versions?.[0] ? f.versions[0].sizeBytes : "Unknown"}</p>

                                                <div className="file-meta">
                                                    {f.projectName && (
                                                        <span className="file-project">
                                                            {f.projectCode && <strong>{f.projectCode}</strong>} {f.projectName}
                                                        </span>
                                                    )}
                                                    <span>By: {f.versions?.[0]?.uploadedBy?.firstName || "Unknown"}</span>
                                                    <span>Date: {f.createdAt}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
