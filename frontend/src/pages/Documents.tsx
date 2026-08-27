import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchWorkspaceDocuments } from "../services/workspaceApi";
import { updateDocumentApi, type WorkspaceDocument } from "../services/projectApi";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import { DocumentDetailModal, type ProjectDocument } from "./DocumentModal";
import "./Projects.css";
import "./ProjectWorkspace.css";

const DOC_TYPE_FILTERS: { key: "all" | "DOC" | "PDF" | "XLS" | "PPT"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "DOC", label: "Documents" },
    { key: "PDF", label: "PDFs" },
    { key: "XLS", label: "Spreadsheets" },
    { key: "PPT", label: "Presentations" },
];

export default function Documents() {
    const navigate = useNavigate();
    const { userFullName, userInitials, logout } = useAuth();
    const { activeWorkspace } = useWorkspace();
    
    const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    
    const [docFilter, setDocFilter] = useState<"all" | "DOC" | "PDF" | "XLS" | "PPT">("all");
    const [docSearch, setDocSearch] = useState("");
    const [detailDoc, setDetailDoc] = useState<WorkspaceDocument | null>(null);

    useEffect(() => {
        let isMounted = true;
        if (!activeWorkspace) {
            setDocuments([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        fetchWorkspaceDocuments(activeWorkspace.id)
            .then((data) => {
                if (isMounted) {
                    setDocuments(data);
                    setError(null);
                }
            })
            .catch((err) => {
                if (isMounted) {
                    console.error("Error fetching documents:", err);
                    setError(err.message || "Failed to load documents");
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

    const filteredDocs = documents.filter((d) => {
        const typeMatch = docFilter === "all" || d.type === docFilter;
        const q = docSearch.trim().toLowerCase();
        const searchMatch =
            !q ||
            d.name.toLowerCase().includes(q) ||
            d.description.toLowerCase().includes(q) ||
            d.owner.toLowerCase().includes(q) ||
            (d.projectName && d.projectName.toLowerCase().includes(q)) ||
            (d.projectCode && d.projectCode.toLowerCase().includes(q));
        return typeMatch && searchMatch;
    });

    const handleUpdateDocument = (id: string, newContent: string) => {
        updateDocumentApi(id, { content: newContent })
            .then((updatedDoc) => {
                setDocuments((prev) => prev.map(d => d.id === updatedDoc.id ? { ...d, ...updatedDoc } : d));
                if (detailDoc?.id === updatedDoc.id) {
                    setDetailDoc((prev) => prev ? { ...prev, ...updatedDoc } : null);
                }
            })
            .catch((err) => {
                console.error("Failed to update document:", err);
            });
    };

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
                    <Link to="/documents" className="selected">
                        Documents
                        <span>{documents.length}</span>
                    </Link>
                    <Link to="/files">Files</Link>
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
                        Workspace / <strong>Documents</strong>
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
                            <h1>Documents</h1>
                            <p>Global documents across all projects in this workspace.</p>
                        </div>
                    </div>

                    <div className="tab-pane" style={{ marginTop: "24px" }}>
                        <div className="pane-toolbar">
                            <div className="pane-title">
                                <h2>All Documents ({filteredDocs.length})</h2>
                            </div>

                            <div className="pane-actions">
                                <div className="search">
                                    <span>?</span>
                                    <input
                                        placeholder="Search documents..."
                                        value={docSearch}
                                        onChange={(e) => setDocSearch(e.target.value)}
                                    />
                                </div>

                                <select
                                    className="filter-select"
                                    value={docFilter}
                                    onChange={(e) => setDocFilter(e.target.value as any)}
                                >
                                    {DOC_TYPE_FILTERS.map((f) => (
                                        <option key={f.key} value={f.key}>
                                            {f.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ padding: "40px 0", color: "#64748b", textAlign: "center" }}>
                                Loading documents...
                            </div>
                        ) : error ? (
                            <div style={{ padding: "40px 0", color: "#ef4444", textAlign: "center" }}>
                                {error}
                            </div>
                        ) : (
                            <div className="documents-grid">
                                {filteredDocs.length === 0 ? (
                                    <div className="empty-state" style={{ gridColumn: "1 / -1", padding: "60px 0", textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                                        <p>No documents found.</p>
                                    </div>
                                ) : (
                                    filteredDocs.map((d) => (
                                        <div
                                            className="doc-card"
                                            key={d.id}
                                            onClick={() => setDetailDoc(d)}
                                        >
                                            <div className="doc-type-badge">{d.type}</div>
                                            <h3>{d.name}</h3>
                                            <p className="doc-desc">{d.description}</p>
                                            
                                            {d.projectName && (
                                                <div style={{ fontSize: "0.75rem", color: "#3b82f6", marginBottom: "8px", fontWeight: 500 }}>
                                                    Project: {d.projectName} {d.projectCode && `(${d.projectCode})`}
                                                </div>
                                            )}

                                            <div className="doc-meta">
                                                <span>Owner: {d.owner}</span>
                                                <span>Updated: {d.updatedAt}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </main>

            {detailDoc && (
                <DocumentDetailModal
                    document={detailDoc as ProjectDocument}
                    onClose={() => setDetailDoc(null)}
                    onSave={handleUpdateDocument}
                />
            )}
        </div>
    );
}
