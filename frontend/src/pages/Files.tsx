import React, { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { fetchWorkspaceFiles } from "../services/workspaceApi";
import { type WorkspaceFile, deleteFileApi } from "../services/projectApi";
import { AppSidebar } from "../components/AppSidebar";
import { AppTopbar } from "../components/AppTopbar";
import { UploadFileModal } from "../components/UploadFileModal";
import { UploadCloud, Download, Trash2, Plus } from "lucide-react";
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
    JPEG: "images",
    GIF: "images",
    SVG: "images",
    WEBP: "images",
    PDF: "documents",
    DOC: "documents",
    DOCX: "documents",
    TXT: "documents",
    MD: "documents",
    XLS: "documents",
    XLSX: "documents",
    CSV: "documents",
    PPT: "documents",
    PPTX: "documents",
    FIG: "design",
    PSD: "design",
    AI: "design",
    ZIP: "archives",
    TAR: "archives",
    GZ: "archives",
    RAR: "archives",
    MP4: "videos",
    MOV: "videos",
    AVI: "videos",
};

export default function Files() {
    const { activeWorkspace } = useWorkspace();
    
    const [files, setFiles] = useState<WorkspaceFile[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    
    const [fileFilter, setFileFilter] = useState<"all" | "images" | "documents" | "design" | "archives" | "videos">("all");
    const [fileSearch, setFileSearch] = useState("");

    // Modal state
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [droppedFile, setDroppedFile] = useState<File | null>(null);
    const [isDraggingOverPage, setIsDraggingOverPage] = useState(false);

    const loadFiles = useCallback(() => {
        if (!activeWorkspace) {
            setFiles([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        fetchWorkspaceFiles(activeWorkspace.id)
            .then((data) => {
                setFiles(data);
                setError(null);
            })
            .catch((err) => {
                console.error("Error fetching files:", err);
                setError(err.message || "Failed to load files");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [activeWorkspace]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

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
            setIsUploadModalOpen(true);
        }
    };

    const handleDeleteFile = async (e: React.MouseEvent, file: WorkspaceFile) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete "${file.name}"?`)) return;
        try {
            await deleteFileApi(file.projectId, file.id);
            setFiles((prev) => prev.filter((f) => f.id !== file.id));
        } catch (err: any) {
            alert(err.message || "Failed to delete file");
        }
    };

    const handleDownloadFile = (e: React.MouseEvent, file: WorkspaceFile) => {
        e.stopPropagation();
        window.open(`/api/projects/${file.projectId}/files/${file.id}/download`, "_blank");
    };

    const filteredFiles = files.filter((f) => {
        const ext = f.name.split(".").pop()?.toUpperCase() || "";
        const cat = FILE_CATEGORY_MAP[ext] || "documents";
        const catMatch = fileFilter === "all" || cat === fileFilter;
        
        const latestVersion = f.versions && f.versions.length > 0 ? f.versions[f.versions.length - 1] : null;

        const q = fileSearch.trim().toLowerCase();
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
                        Drop file here to upload
                    </h2>
                </div>
            )}

            <AppSidebar activePage="files" filesCount={files.length} />

            <main className="projects-main">
                <AppTopbar 
                    pageTitle="Files" 
                    searchPlaceholder="Search files..."
                    searchValue={fileSearch}
                    onSearchChange={setFileSearch}
                />

                <section className="content">
                    <div className="page-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <h1>Files</h1>
                            <p>Global files, assets, and documents across all workspace projects.</p>
                        </div>

                        <button
                            className="new-project"
                            onClick={() => {
                                setDroppedFile(null);
                                setIsUploadModalOpen(true);
                            }}
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                            <Plus size={16} />
                            <span>Upload File</span>
                        </button>
                    </div>

                    <div className="tab-pane" style={{ marginTop: "24px" }}>
                        <div className="pane-toolbar">
                            <div className="pane-title">
                                <h2>All Files ({filteredFiles.length})</h2>
                            </div>

                            <div className="pane-actions">
                                <div className="search">
                                    <span>⌕</span>
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
                            <div style={{ padding: "60px 0", color: "#64748b", textAlign: "center" }}>
                                Loading workspace files...
                            </div>
                        ) : error ? (
                            <div style={{ padding: "40px 0", color: "#ef4444", textAlign: "center" }}>
                                {error}
                            </div>
                        ) : (
                            <div className="files-grid">
                                {filteredFiles.length === 0 ? (
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
                                        <UploadCloud size={48} color="#94a3b8" style={{ margin: "0 auto 12px" }} />
                                        <h3 style={{ fontSize: "16px", color: "#1e293b", marginBottom: "4px" }}>No files uploaded yet</h3>
                                        <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
                                            Drag & drop any PDF, DOC, image, or spreadsheet here or click below to upload.
                                        </p>
                                        <button
                                            className="new-project"
                                            onClick={() => {
                                                setDroppedFile(null);
                                                setIsUploadModalOpen(true);
                                            }}
                                            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                                        >
                                            <UploadCloud size={16} />
                                            <span>Upload Local File</span>
                                        </button>
                                    </div>
                                ) : (
                                    filteredFiles.map((f) => {
                                        const ext = f.name.split(".").pop()?.toUpperCase() || f.type;
                                        return (
                                            <div
                                                className="file-card"
                                                key={f.id}
                                                style={{ position: "relative", cursor: "pointer" }}
                                                onClick={(e) => handleDownloadFile(e, f)}
                                            >
                                                <div className="file-preview" style={{ fontWeight: 700 }}>
                                                    {ext}
                                                </div>
                                                <div className="file-info">
                                                    <h3 title={f.name}>{f.name}</h3>
                                                    <p className="file-size">
                                                        {f.versions?.[0] ? f.versions[0].sizeBytes : "Unknown size"}
                                                    </p>

                                                    <div className="file-meta">
                                                        {f.projectName && (
                                                            <span className="file-project" style={{ color: "#2563eb", fontWeight: 500 }}>
                                                                {f.projectCode && <strong>[{f.projectCode}] </strong>}
                                                                {f.projectName}
                                                            </span>
                                                        )}
                                                        <span>By: {f.versions?.[0]?.uploadedBy?.firstName || "Member"}</span>
                                                        <span>Date: {f.createdAt}</span>
                                                    </div>

                                                    {/* Quick Action Buttons */}
                                                    <div style={{ display: "flex", gap: "6px", marginTop: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDownloadFile(e, f)}
                                                            style={{
                                                                flex: 1,
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                gap: "4px",
                                                                padding: "5px 8px",
                                                                fontSize: "12px",
                                                                border: "1px solid #e2e8f0",
                                                                borderRadius: "6px",
                                                                background: "#ffffff",
                                                                color: "#1e293b",
                                                                cursor: "pointer",
                                                            }}
                                                            title="Download File"
                                                        >
                                                            <Download size={13} />
                                                            <span>Download</span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDeleteFile(e, f)}
                                                            style={{
                                                                padding: "5px 8px",
                                                                border: "1px solid #fee2e2",
                                                                borderRadius: "6px",
                                                                background: "#fef2f2",
                                                                color: "#ef4444",
                                                                cursor: "pointer",
                                                            }}
                                                            title="Delete File"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </main>

            {/* Upload File Modal */}
            <UploadFileModal
                isOpen={isUploadModalOpen}
                onClose={() => {
                    setIsUploadModalOpen(false);
                    setDroppedFile(null);
                }}
                onFileUploaded={loadFiles}
                workspaceId={activeWorkspace?.id}
                initialFile={droppedFile}
            />
        </div>
    );
}

