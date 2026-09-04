import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchWorkspaceDocuments } from "../services/workspaceApi";
import { updateDocumentApi, createDocumentApi, uploadDocumentFileApi, deleteDocumentApi, type WorkspaceDocument } from "../services/projectApi";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopbar } from "../components/AppTopbar";
import { DocumentDetailModal, AddDocumentModal, type ProjectDocument } from "./DocumentModal";
import { Plus, UploadCloud, Trash2, FileText, Folder } from "lucide-react";
import "./Projects.css";
import "./ProjectWorkspace.css";
import "./Documents.css";

const DOC_TYPE_FILTERS: { key: "all" | "DOC" | "PDF" | "XLS" | "PPT"; label: string }[] = [
    { key: "all", label: "All Documents" },
    { key: "DOC", label: "Docs" },
    { key: "PDF", label: "PDFs" },
    { key: "XLS", label: "Sheets" },
    { key: "PPT", label: "Slides" },
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
        file?: File | null;
    }) => {
        if (!doc.projectId) {
            alert("Please select a target project for this document.");
            return;
        }
        try {
            if (doc.file) {
                // Uploaded file — multipart POST to /upload endpoint
                const formData = new FormData();
                formData.append("file", doc.file);
                formData.append("name", doc.name);
                if (doc.description) formData.append("description", doc.description);
                await uploadDocumentFileApi(doc.projectId, formData);
            } else {
                // Blank / native collaborative document
                await createDocumentApi(doc.projectId, {
                    name: doc.name,
                    description: doc.description,
                    type: doc.type,
                    owner: doc.owner,
                    size: doc.size,
                });
            }
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
        const typeMatch = docFilter === "all" || d.type.toUpperCase() === docFilter.toUpperCase();
        const q = docSearch.trim().toLowerCase();
        const searchMatch =
            !q ||
            d.name.toLowerCase().includes(q) ||
            (d.description && d.description.toLowerCase().includes(q)) ||
            (d.owner && d.owner.toLowerCase().includes(q)) ||
            (d.projectName && d.projectName.toLowerCase().includes(q)) ||
            (d.projectCode && d.projectCode.toLowerCase().includes(q));
        return typeMatch && searchMatch;
    });

    const getOwnerInitials = (ownerName?: string) => {
        if (!ownerName) return "MB";
        const parts = ownerName.trim().split(" ");
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return ownerName.slice(0, 2).toUpperCase();
    };

    const formatRelativeDate = (dateStr?: string) => {
        if (!dateStr) return "";
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        } catch {
            return dateStr;
        }
    };

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
                    searchPlaceholder="Search documents by name, project, owner..."
                    searchValue={docSearch}
                    onSearchChange={setDocSearch}
                />

                <section className="content">
                    <div className="page-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px" }}>
                        <div>
                            <h1>Documents</h1>
                            <p>Global specifications, briefs, PDFs, and requirements across all projects.</p>
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

                    <div className="tab-pane" style={{ marginTop: "10px" }}>
                        <div className="pane-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                            <div className="doc-filter-pills">
                                {DOC_TYPE_FILTERS.map((f) => {
                                    const count = f.key === "all" 
                                        ? documents.length 
                                        : documents.filter(d => d.type.toUpperCase() === f.key).length;
                                    return (
                                        <button
                                            key={f.key}
                                            className={`doc-filter-pill ${docFilter === f.key ? "active" : ""}`}
                                            onClick={() => setDocFilter(f.key)}
                                        >
                                            {f.label}
                                            <span className="doc-filter-pill-count">{count}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="pane-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div className="search" style={{ width: "240px" }}>
                                    <span>⌕</span>
                                    <input
                                        placeholder="Filter documents..."
                                        value={docSearch}
                                        onChange={(e) => setDocSearch(e.target.value)}
                                    />
                                </div>
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
                                            background: "#fcfbf8",
                                            borderRadius: "10px",
                                            border: "1px dashed #e7e3d8"
                                        }}
                                    >
                                        <FileText size={44} color="#94a3b8" style={{ margin: "0 auto 12px" }} />
                                        <h3 style={{ fontSize: "15px", color: "#14161c", marginBottom: "4px", fontWeight: 600 }}>No documents found</h3>
                                        <p style={{ fontSize: "12.5px", color: "#64748b", marginBottom: "16px", maxWidth: "380px", margin: "0 auto 16px" }}>
                                            {docSearch || docFilter !== "all" 
                                                ? "Try adjusting your search query or document type filter." 
                                                : "Upload a local PDF, Word doc, Markdown, or spreadsheet, or start a new document."}
                                        </p>
                                        <button
                                            className="new-project"
                                            onClick={() => {
                                                setDroppedFile(null);
                                                setIsAddModalOpen(true);
                                            }}
                                            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                                        >
                                            <UploadCloud size={15} />
                                            <span>Upload Local Document</span>
                                        </button>
                                    </div>
                                ) : (
                                    filteredDocs.map((d) => (
                                        <div
                                            className="doc-card"
                                            key={d.id}
                                            onClick={() => navigate(`/documents/${d.id}`)}
                                        >
                                            <div>
                                                <div className="doc-card-top">
                                                    <span className={`doc-type-badge ${d.type}`}>
                                                        {d.type.toUpperCase()}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="doc-delete-btn"
                                                        onClick={(e) => handleDeleteDocument(e, d)}
                                                        title="Delete Document"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>

                                                <div className="doc-card-content">
                                                    <h3>{d.name}</h3>
                                                    <p className="doc-desc">{d.description || "No description provided."}</p>
                                                    
                                                    {d.projectName && (
                                                        <div className="doc-project-tag" title={`Project: ${d.projectName}`}>
                                                            <Folder size={12} />
                                                            <span>{d.projectName} {d.projectCode ? `(${d.projectCode})` : ""}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="doc-meta">
                                                <div className="doc-meta-owner">
                                                    <div className="doc-meta-avatar">
                                                        {getOwnerInitials(d.owner)}
                                                    </div>
                                                    <span>{d.owner || "Workspace Member"}</span>
                                                </div>

                                                <div className="doc-meta-right">
                                                    {d.size && (
                                                        <span className="doc-size-badge">{d.size}</span>
                                                    )}
                                                    <span className="doc-time-badge">
                                                        {formatRelativeDate(d.updatedAt)}
                                                    </span>
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
