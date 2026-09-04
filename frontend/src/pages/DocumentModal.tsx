import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";
import { RichTextEditor } from "../components/RichTextEditor";

/* =========================
   TYPES
   Mirrors the ProjectDocument shape in ProjectWorkspace.tsx.
   Kept local so this component has no import-order coupling
   (same pattern as TaskModal.tsx / MemberModal.tsx). Named
   ProjectDocument to avoid colliding with the DOM's built-in
   Document type.
========================= */

type DocType = "DOC" | "PDF" | "XLS" | "PPT";

export interface ProjectDocument {
    id: string;
    name: string;
    description: string;
    type: DocType;
    owner: string;
    createdAt: string;
    updatedAt: string;
    size?: string;
    content?: string;
}

const TYPE_LABEL: Record<DocType, string> = {
    DOC: "Document",
    PDF: "PDF",
    XLS: "Spreadsheet",
    PPT: "Presentation",
};

/* Shared: close on Escape */
function useEscapeToClose(onClose: () => void) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);
}

/* =========================
   DOCUMENT DETAIL MODAL
   Read-only metadata view. "Open document" has no backend/file
   storage to hook into yet, so it's a styled no-op for now.
========================= */

import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchDocumentVersionsApi, createDocumentVersionApi, restoreDocumentVersionApi, type DocumentVersion } from "../services/projectApi";

interface DocumentDetailModalProps {
    document: ProjectDocument;
    onClose: () => void;
    onSave?: (id: string, newContent: string) => void;
}

export function DocumentDetailModal({ document: doc, onClose }: DocumentDetailModalProps) {
    useEscapeToClose(onClose);
    const navigate = useNavigate();
    const { userFullName, userInitials, user } = useAuth();
    const [isEditing, setIsEditing] = useState(true);

    // Versioning state
    const [showVersions, setShowVersions] = useState(false);
    const [versions, setVersions] = useState<DocumentVersion[]>([]);
    const [viewingVersion, setViewingVersion] = useState<DocumentVersion | null>(null);
    const [isLoadingVersions, setIsLoadingVersions] = useState(false);

    const loadVersions = async () => {
        setIsLoadingVersions(true);
        try {
            const data = await fetchDocumentVersionsApi(doc.id);
            setVersions(data);
        } catch (error) {
            console.error("Failed to load versions", error);
        } finally {
            setIsLoadingVersions(false);
        }
    };

    const handleCreateVersion = async () => {
        const name = prompt("Enter a name for this version:");
        if (name === null) return;
        try {
            await createDocumentVersionApi(doc.id, name);
            loadVersions();
        } catch (error: any) {
            alert(error.message || "Failed to create version");
        }
    };

    const handleRestoreVersion = async (v: DocumentVersion) => {
        if (!confirm(`Are you sure you want to restore the document to version "${v.name}"? This will overwrite the current live document for all users.`)) return;
        try {
            await restoreDocumentVersionApi(doc.id, v.id);
            alert("Restored successfully. Please close and reopen the document to sync.");
            onClose(); // Close to force a clean re-mount of the editor
        } catch (error: any) {
            alert(error.message || "Failed to restore version");
        }
    };

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div
                className="task-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`${doc.name} details`}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="task-modal-header">
                    <h3>Document</h3>
                    <button className="modal-close" onClick={onClose} aria-label="Close" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <X size={18} />
                    </button>
                </div>

                <div className="task-modal-body">
                    <div className="doc-detail-header">
                        <div className={`doc-icon ${doc.type.toLowerCase()}`}>{doc.type}</div>
                        <div>
                            <strong>{doc.name}</strong>
                            <span>{TYPE_LABEL[doc.type]}</span>
                        </div>
                    </div>

                    {doc.description && (
                        <p className="doc-detail-description">{doc.description}</p>
                    )}

                    <div className="doc-detail-meta mt-4">
                        <div className="stat-row">
                            <span>Owner</span>
                            <span>{doc.owner}</span>
                        </div>
                        <div className="stat-row">
                            <span>Created</span>
                            <span>{doc.createdAt}</span>
                        </div>
                        <div className="stat-row">
                            <span>Last updated</span>
                            <span>{doc.updatedAt}</span>
                        </div>
                        <div className="stat-row">
                            <span>Size</span>
                            <span>{doc.size ?? "—"}</span>
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium text-sm">Content</h4>
                            <div className="flex gap-2">
                                <button type="button" className="text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white" onClick={() => {
                                    setShowVersions(!showVersions);
                                    if (!showVersions) loadVersions();
                                }}>
                                    {showVersions ? "Hide Versions" : "Version History"}
                                </button>
                                {!isEditing && !viewingVersion && (
                                    <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => setIsEditing(true)}>
                                        Collaborate
                                    </button>
                                )}
                            </div>
                        </div>

                        {showVersions && (
                            <div className="mb-4 p-3 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-950/50">
                                <div className="flex justify-between items-center mb-2">
                                    <h5 className="font-semibold text-xs uppercase tracking-wider text-zinc-500">Version History</h5>
                                    <button className="text-xs bg-blue-600 text-white px-2 py-1 rounded" onClick={handleCreateVersion}>Save Current as Version</button>
                                </div>
                                {isLoadingVersions ? (
                                    <p className="text-xs text-zinc-500">Loading versions...</p>
                                ) : versions.length === 0 ? (
                                    <p className="text-xs text-zinc-500">No versions saved.</p>
                                ) : (
                                    <ul className="text-sm space-y-1 mt-2 max-h-32 overflow-y-auto">
                                        {versions.map(v => (
                                            <li key={v.id} className="flex justify-between items-center p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                                                <div>
                                                    <span className="font-medium">{v.name}</span>
                                                    <span className="text-xs text-zinc-500 ml-2">{new Date(v.createdAt).toLocaleString()}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button className="text-xs text-blue-600 hover:underline" onClick={() => setViewingVersion(v)}>View</button>
                                                    <button className="text-xs text-red-600 hover:underline" onClick={() => handleRestoreVersion(v)}>Restore</button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {viewingVersion && (
                                    <div className="mt-2 p-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-xs rounded">
                                        <span>Viewing snapshot: <strong>{viewingVersion.name}</strong></span>
                                        <button className="underline" onClick={() => setViewingVersion(null)}>Return to Live Document</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {isEditing && !viewingVersion ? (
                            <RichTextEditor
                                documentId={doc.id}
                                currentUser={{ id: user?.id || "unknown", name: userFullName || "Guest", initials: userInitials || "G" }}
                                isReadonly={false}
                            />
                        ) : (
                            <div className="relative">
                                {/* If viewing a version, we need a separate readonly editor instance but we don't have its ydoc state here easily if it's stored as binary.
                                    Actually, if we only have the binary ydoc state in the backend, the easiest way to render it without a websocket is to just use a standard div if we kept `content` updated, or we use a temporary websocket channel.
                                    For simplicity, let's assume `doc.content` is somewhat synced, or we just render the live editor in readonly mode for now.
                                    Let's render the collaborative editor in readonly mode if they are just viewing, but if they view a past version, they won't see it unless the backend pushes it.
                                    Since we want true real-time, let's just make the document ALWAYS collaborative, and remove the "Edit" button entirely! */}
                                <RichTextEditor
                                    documentId={doc.id}
                                    currentUser={{ id: user?.id || "unknown", name: userFullName || "Guest", initials: userInitials || "G" }}
                                    isReadonly={!!viewingVersion}
                                />
                                {viewingVersion && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm pointer-events-none">
                                        <span className="bg-black text-white px-3 py-1 rounded shadow text-sm">Previewing past version is unsupported in this view yet. Please restore to edit.</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="task-modal-footer">
                    <span />
                    <div className="task-modal-footer-actions">
                        <button type="button" className="modal-cancel" onClick={onClose}>
                            Close
                        </button>
                        <button
                            type="button"
                            className="modal-save"
                            style={{
                                background: "#1a73e8",
                                color: "#ffffff",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                            onClick={() => {
                                onClose();
                                navigate(`/documents/${doc.id}`);
                            }}
                        >
                            Open in Full Google Docs
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* =========================
   ADD DOCUMENT MODAL
   Supports uploading a local file (.pdf, .doc, .docx, .txt, .md, .xls, .ppt)
   or creating a blank collaborative document.
========================= */

import { fetchProjects, type MappedProject } from "../services/projectApi";
import { UploadCloud, FileText, X as CloseIcon } from "lucide-react";

interface AddDocumentModalProps {
    onClose: () => void;
    onSave: (doc: {
        name: string;
        description: string;
        type: DocType;
        owner: string;
        size?: string;
        content?: string;
        projectId?: string;
        file?: File | null;
    }) => void;
    workspaceId?: string;
    defaultProjectId?: string;
    initialFile?: File | null;
}

const TYPE_OPTIONS: DocType[] = ["DOC", "PDF", "XLS", "PPT"];

function detectDocType(fileName: string): DocType {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (ext === "pdf") return "PDF";
    if (ext === "xls" || ext === "xlsx" || ext === "csv") return "XLS";
    if (ext === "ppt" || ext === "pptx") return "PPT";
    return "DOC";
}

function formatDocSize(bytes: number): string {
    if (!bytes || bytes === 0) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function AddDocumentModal({
    onClose,
    onSave,
    workspaceId,
    defaultProjectId,
    initialFile,
}: AddDocumentModalProps) {
    useEscapeToClose(onClose);
    const { userFullName } = useAuth();

    const [mode, setMode] = useState<"upload" | "blank">(initialFile ? "upload" : "upload");
    const [selectedFile, setSelectedFile] = useState<File | null>(initialFile || null);
    const [name, setName] = useState(initialFile ? initialFile.name.replace(/\.[^/.]+$/, "") : "");
    const [description, setDescription] = useState("");
    const [type, setType] = useState<DocType>(initialFile ? detectDocType(initialFile.name) : "DOC");
    const [owner, setOwner] = useState(userFullName || "Workspace Member");
    const [size, setSize] = useState(initialFile ? formatDocSize(initialFile.size) : "");
    const [content, setContent] = useState<string>("");
    const [isDragging, setIsDragging] = useState(false);

    // Project selection
    const [projects, setProjects] = useState<MappedProject[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultProjectId || "");
    const [loadingProjects, setLoadingProjects] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (workspaceId) {
            setLoadingProjects(true);
            fetchProjects(workspaceId)
                .then((projs) => {
                    setProjects(projs);
                    if (defaultProjectId && projs.some((p) => p.id === defaultProjectId)) {
                        setSelectedProjectId(defaultProjectId);
                    } else if (projs.length > 0) {
                        setSelectedProjectId(projs[0].id);
                    }
                })
                .catch((err) => console.error("Failed to load projects", err))
                .finally(() => setLoadingProjects(false));
        }
    }, [workspaceId, defaultProjectId]);

    const handleFileChosen = (file: File) => {
        setSelectedFile(file);
        const autoName = file.name.replace(/\.[^/.]+$/, "");
        setName(autoName);
        const detected = detectDocType(file.name);
        setType(detected);
        setSize(formatDocSize(file.size));

        // If it's a text/markdown/html file, read its content
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        if (["txt", "md", "json", "html", "htm", "rtf"].includes(ext) || file.type.startsWith("text/")) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                if (text) setContent(text);
            };
            reader.readAsText(file);
        } else {
            setContent(`Uploaded local file: ${file.name} (${formatDocSize(file.size)})`);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileChosen(e.dataTransfer.files[0]);
        }
    };

    const canSave = name.trim().length > 0 && owner.trim().length > 0 && (!workspaceId || selectedProjectId);

    const handleSave = () => {
        if (!canSave) return;
        onSave({
            name: name.trim(),
            description: description.trim(),
            type,
            owner: owner.trim(),
            size: size.trim() || undefined,
            content: content.trim() || undefined,
            projectId: selectedProjectId || defaultProjectId || undefined,
            file: mode === "upload" ? selectedFile : null,
        });
    };

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div
                className="task-modal"
                style={{ maxWidth: "560px", width: "100%" }}
                role="dialog"
                aria-modal="true"
                aria-label="New document"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="task-modal-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <FileText size={20} color="#2563eb" />
                        <h3>New Document</h3>
                    </div>
                    <button className="modal-close" onClick={onClose} aria-label="Close" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <X size={18} />
                    </button>
                </div>

                <div className="task-modal-body">
                    {/* Tab Selection */}
                    <div style={{ display: "flex", gap: "6px", background: "#f1f5f9", padding: "4px", borderRadius: "8px", marginBottom: "18px" }}>
                        <button
                            type="button"
                            onClick={() => setMode("upload")}
                            style={{
                                flex: 1,
                                padding: "6px 12px",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "13px",
                                fontWeight: mode === "upload" ? 600 : 500,
                                background: mode === "upload" ? "#ffffff" : "transparent",
                                color: mode === "upload" ? "#1e293b" : "#64748b",
                                cursor: "pointer",
                                boxShadow: mode === "upload" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                            }}
                        >
                            Upload Local File (PDF, DOC, XLS, TXT)
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("blank")}
                            style={{
                                flex: 1,
                                padding: "6px 12px",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "13px",
                                fontWeight: mode === "blank" ? 600 : 500,
                                background: mode === "blank" ? "#ffffff" : "transparent",
                                color: mode === "blank" ? "#1e293b" : "#64748b",
                                cursor: "pointer",
                                boxShadow: mode === "blank" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                            }}
                        >
                            Blank Document
                        </button>
                    </div>

                    {/* File Dropzone (Upload Mode) */}
                    {mode === "upload" && (
                        <>
                            {!selectedFile ? (
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        border: isDragging ? "2px dashed #2563eb" : "2px dashed #cbd5e1",
                                        background: isDragging ? "#eff6ff" : "#f8fafc",
                                        borderRadius: "10px",
                                        padding: "28px 16px",
                                        textAlign: "center",
                                        cursor: "pointer",
                                        transition: "all 0.15s ease",
                                        marginBottom: "16px",
                                    }}
                                >
                                    <UploadCloud size={34} color={isDragging ? "#2563eb" : "#64748b"} style={{ margin: "0 auto 8px" }} />
                                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#1e293b", marginBottom: "2px" }}>
                                        Select document from your computer
                                    </div>
                                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                                        PDF, DOCX, TXT, MD, XLS, PPT
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.rtf,.html"
                                        style={{ display: "none" }}
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                handleFileChosen(e.target.files[0]);
                                            }
                                        }}
                                    />
                                </div>
                            ) : (
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "10px 14px",
                                    background: "#f1f5f9",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "8px",
                                    marginBottom: "16px"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                                        <div style={{
                                            width: "34px",
                                            height: "34px",
                                            background: "#dbeafe",
                                            color: "#1d4ed8",
                                            borderRadius: "6px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontWeight: 700,
                                            fontSize: "11px",
                                            flexShrink: 0
                                        }}>
                                            {type}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {selectedFile.name}
                                            </div>
                                            <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                                                {size}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedFile(null);
                                            setSize("");
                                            setContent("");
                                        }}
                                        style={{
                                            border: "none",
                                            background: "transparent",
                                            color: "#64748b",
                                            cursor: "pointer",
                                            padding: "4px",
                                        }}
                                        title="Change file"
                                    >
                                        <CloseIcon size={16} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Target Project (if workspace has multiple projects) */}
                    {workspaceId && (
                        <div className="field">
                            <label>Target Project *</label>
                            {loadingProjects ? (
                                <div style={{ fontSize: "12px", color: "#64748b" }}>Loading projects...</div>
                            ) : projects.length === 0 ? (
                                <div style={{ fontSize: "12px", color: "#dc2626" }}>No projects available in workspace.</div>
                            ) : (
                                <select
                                    value={selectedProjectId}
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                    required
                                    style={{
                                        width: "100%",
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        border: "1px solid #d1d5db",
                                        fontSize: "13px",
                                    }}
                                >
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.code ? `[${p.code}] ` : ""}{p.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    <div className="field">
                        <label>Document Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Engineering Architecture Spec"
                            autoFocus={mode === "blank"}
                            required
                        />
                    </div>

                    <div className="field">
                        <label>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this document about? (optional)"
                            rows={2}
                        />
                    </div>

                    <div className="field-row">
                        <div className="field">
                            <label>Type</label>
                            <select value={type} onChange={(e) => setType(e.target.value as DocType)}>
                                {TYPE_OPTIONS.map((t) => (
                                    <option key={t} value={t}>
                                        {TYPE_LABEL[t]}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="field">
                            <label>Owner *</label>
                            <input
                                type="text"
                                value={owner}
                                onChange={(e) => setOwner(e.target.value)}
                                placeholder="e.g. John Doe"
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="task-modal-footer">
                    <span />
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
                            {mode === "upload" && selectedFile ? "Upload Document" : "Create Document"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
