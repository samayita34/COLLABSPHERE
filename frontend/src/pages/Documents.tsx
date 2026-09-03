import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchWorkspaceDocuments } from "../services/workspaceApi";
import { updateDocumentApi, createDocumentApi, deleteDocumentApi, type WorkspaceDocument } from "../services/projectApi";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopbar } from "../components/AppTopbar";
import { DocumentDetailModal, AddDocumentModal, type ProjectDocument } from "./DocumentModal";
import { Plus, UploadCloud, Trash2, FileText } from "lucide-react";
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
    const { activeWorkspace } = useWorkspace();
    
    const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    
    const [docFilter, setDocFilter] = useState<"all" | "DOC" | "PDF" | "XLS" | "PPT">("all");
    const [docSearch, setDocSearch] = useState("");
    const [detailDoc, setDetailDoc] = useState<WorkspaceDocument | null>(null);

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [droppedFile, setDroppedFile] = useState<File | null>(null);
    const [isDraggingOverPage, setIsDraggingOverPage] = useState(false);

    const loadDocuments = useCallback(() => {
        if (!activeWorkspace) {
            setDocuments([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        fetchWorkspaceDocuments(activeWorkspace.id)
            .then((data) => {
                setDocuments(data);
                setError(null);
            })
            .catch((err) => {
                console.error("Error fetching documents:", err);
                setError(err.message || "Failed to load documents");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [activeWorkspace]);

    useEffect(() => {
        loadDocuments();
    }, [loadDocuments]);

    // Page-level Drag & Drop support
    const handlePageDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDraggingOverPage) setIsDraggingOverPage(true);
    };

    const handlePageDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDraggingOverPage(false);
    };

    const handlePageDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOverPage(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setDroppedFile(e.dataTransfer.files[0]);
            setIsAddModalOpen(true);
        }
    };

    const handleCreateDocument = async (doc: {
        name: string;
        description: string;
        type: "DOC" | "PDF" | "XLS" | "PPT";
        owner: string;
        size?: string;
        content?: string;
        projectId?: string;
    }) => {
        if (!doc.projectId) {
            alert("Please select a target project for this document.");
            return;
        }
        try {
            await createDocumentApi(doc.projectId, {
                name: doc.name,
                description: doc.description,
                type: doc.type,
                owner: doc.owner,
                size: doc.size,
            });
            setIsAddModalOpen(false);
            setDroppedFile(null);
            loadDocuments();
        } catch (err: any) {
            console.error("Error creating document:", err);
            alert(err.message || "Failed to create document");
        }
    };

    const handleDeleteDocument = async (e: React.MouseEvent, doc: WorkspaceDocument) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete "${doc.name}"?`)) return;
        try {
            await deleteDocumentApi(doc.id);
            setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        } catch (err: any) {
            alert(err.message || "Failed to delete document");
        }
    };

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

    return (
        <div
            className="projects-page"
            onDragOver={handlePageDragOver}
            onDragLeave={handlePageDragLeave}
            onDrop={handlePageDrop}
            style={{ position: "relative" }}
        >
            {/* Fullscreen drag overlay indicator */}
            {isDraggingOverPage && (
                <div style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 999,
                    background: "rgba(37, 99, 235, 0.08)",
                    border: "3px dashed #2563eb",
                    backdropFilter: "blur(2px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                }}>
                    <UploadCloud size={64} color="#2563eb" className="animate-bounce" />
                    <h2 style={{ color: "#1e3a8a", marginTop: "12px", fontFamily: "Fraunces, serif" }}>
                        Drop document here to upload
                    </h2>
                </div>
            )}

            <AppSidebar activePage="documents" documentsCount={documents.length} />

            <main className="projects-main">
                <AppTopbar 
                    pageTitle="Documents" 
                    searchPlaceholder="Search documents..."
                    searchValue={docSearch}
                    onSearchChange={setDocSearch}
                />

                <section className="content">
                    <div className="page-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <h1>Documents</h1>
                            <p>Global specifications, notes, PDFs, and requirements across all projects.</p>
                        </div>

                        <button
                            className="new-project"
                            onClick={() => {
                                setDroppedFile(null);
                                setIsAddModalOpen(true);
                            }}
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                            <Plus size={16} />
                            <span>Upload / New Document</span>
                        </button>
                    </div>

                    <div className="tab-pane" style={{ marginTop: "24px" }}>
                        <div className="pane-toolbar">
                            <div className="pane-title">
                                <h2>All Documents ({filteredDocs.length})</h2>
                            </div>

                            <div className="pane-actions">
                                <div className="search">
                                    <span>⌕</span>
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
                            <div style={{ padding: "60px 0", color: "#64748b", textAlign: "center" }}>
                                Loading workspace documents...
                            </div>
                        ) : error ? (
                            <div style={{ padding: "40px 0", color: "#ef4444", textAlign: "center" }}>
                                {error}
                            </div>
                        ) : (
                            <div className="documents-grid">
                                {filteredDocs.length === 0 ? (
                                    <div
                                        className="empty-state"
                                        style={{
                                            gridColumn: "1 / -1",
                                            padding: "60px 20px",
                                            textAlign: "center",
                                            color: "#64748b",
                                            background: "#f8fafc",
                                            borderRadius: "12px",
                                            border: "2px dashed #cbd5e1"
                                        }}
                                    >
                                        <FileText size={48} color="#94a3b8" style={{ margin: "0 auto 12px" }} />
                                        <h3 style={{ fontSize: "16px", color: "#1e293b", marginBottom: "4px" }}>No documents created yet</h3>
                                        <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
                                            Upload a local PDF, Word doc, Markdown, or spreadsheet, or start a new blank document.
                                        </p>
                                        <button
                                            className="new-project"
                                            onClick={() => {
                                                setDroppedFile(null);
                                                setIsAddModalOpen(true);
                                            }}
                                            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                                        >
                                            <UploadCloud size={16} />
                                            <span>Upload Local Document</span>
                                        </button>
                                    </div>
                                ) : (
                                    filteredDocs.map((d) => (
                                        <div
                                            className="doc-card"
                                            key={d.id}
                                            onClick={() => navigate(`/documents/${d.id}`)}
                                            style={{ position: "relative", cursor: "pointer" }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                <div className="doc-type-badge">{d.type}</div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDeleteDocument(e, d)}
                                                    style={{
                                                        border: "none",
                                                        background: "transparent",
                                                        color: "#94a3b8",
                                                        cursor: "pointer",
                                                        padding: "4px",
                                                        borderRadius: "4px",
                                                        transition: "color 0.15s ease",
                                                    }}
                                                    title="Delete Document"
                                                    onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                                                    onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>

                                            <h3>{d.name}</h3>
                                            <p className="doc-desc">{d.description || "No description provided."}</p>
                                            
                                            {d.projectName && (
                                                <div style={{ fontSize: "0.75rem", color: "#3b82f6", marginBottom: "8px", fontWeight: 500 }}>
                                                    Project: {d.projectName} {d.projectCode && `(${d.projectCode})`}
                                                </div>
                                            )}

                                            <div className="doc-meta">
                                                <span>Owner: {d.owner}</span>
                                                <span>{d.size ? `Size: ${d.size}` : `Updated: ${d.updatedAt}`}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </main>

            {/* Document Detail / Collaborative Editor Modal */}
            {detailDoc && (
                <DocumentDetailModal
                    document={detailDoc as ProjectDocument}
                    onClose={() => setDetailDoc(null)}
                    onSave={handleUpdateDocument}
                />
            )}

            {/* Upload / New Document Modal */}
            {isAddModalOpen && (
                <AddDocumentModal
                    onClose={() => {
                        setIsAddModalOpen(false);
                        setDroppedFile(null);
                    }}
                    onSave={handleCreateDocument}
                    workspaceId={activeWorkspace?.id}
                    initialFile={droppedFile}
                />
            )}
        </div>
    );
}

