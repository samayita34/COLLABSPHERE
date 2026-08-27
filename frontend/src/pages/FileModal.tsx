import { useEffect, useRef, useState } from "react";

/* =========================
   TYPES
   Mirrors the ProjectFile shape in ProjectWorkspace.tsx.
========================= */

type FileType = "PDF" | "PNG" | "JPG" | "FIG" | "ZIP" | "PPT" | "DOC" | "MP4" | "XLS";
type FileCategory = "images" | "documents" | "design" | "archives" | "videos";

const FILE_CATEGORY: Record<FileType, FileCategory> = {
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

/** Map a file extension → FileType enum. Falls back to "DOC". */
function extToFileType(filename: string): FileType {
    const ext = filename.split(".").pop()?.toUpperCase() ?? "";
    const valid: FileType[] = ["PDF", "PNG", "JPG", "FIG", "ZIP", "PPT", "DOC", "MP4", "XLS"];
    return (valid.includes(ext as FileType) ? ext : "DOC") as FileType;
}

/** Format bytes to human-readable string (e.g. "4.2 MB"). */
function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export interface ProjectFile {
    id: string;
    name: string;
    type: FileType;
    size: string;
    uploadedBy: string;
    uploadedAt: string;
    modifiedAt?: string;
    description?: string;
    fileUrl?: string;
}

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
   FILE DETAIL MODAL
========================= */

interface FileDetailModalProps {
    file: ProjectFile;
    onClose: () => void;
    onDelete?: (id: string) => Promise<void>;
}

export function FileDetailModal({ file, onClose, onDelete }: FileDetailModalProps) {
    useEscapeToClose(onClose);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleOpenFile = () => {
        if (file.fileUrl) {
            const base = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3000";
            window.open(`${base}${file.fileUrl}`, "_blank", "noopener,noreferrer");
        }
    };

    const handleDelete = async () => {
        if (!onDelete) return;
        if (window.confirm(`Are you sure you want to delete "${file.name}"?`)) {
            setIsDeleting(true);
            try {
                await onDelete(file.id);
                onClose();
            } catch (err: any) {
                alert(err.message || "Failed to delete file");
            } finally {
                setIsDeleting(false);
            }
        }
    };

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div
                className="task-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`${file.name} details`}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="task-modal-header">
                    <h3>File</h3>
                    <button className="modal-close" onClick={onClose} aria-label="Close" disabled={isDeleting}>
                        ✕
                    </button>
                </div>

                <div className="task-modal-body">
                    <div className="doc-detail-header">
                        <div className={`doc-icon file-icon-${FILE_CATEGORY[file.type]}`}>{file.type}</div>
                        <div>
                            <strong>{file.name}</strong>
                            <span>{file.type}</span>
                        </div>
                    </div>

                    {file.description && (
                        <p className="doc-detail-description">{file.description}</p>
                    )}

                    <div className="doc-detail-meta">
                        <div className="stat-row">
                            <span>Size</span>
                            <span>{file.size}</span>
                        </div>
                        <div className="stat-row">
                            <span>Uploaded by</span>
                            <span>{file.uploadedBy}</span>
                        </div>
                        <div className="stat-row">
                            <span>Uploaded</span>
                            <span>{file.uploadedAt}</span>
                        </div>
                        <div className="stat-row">
                            <span>Last modified</span>
                            <span>{file.modifiedAt ?? "—"}</span>
                        </div>
                    </div>
                </div>

                <div className="task-modal-footer">
                    {onDelete ? (
                        <button
                            type="button"
                            className="modal-delete"
                            style={{
                                background: "#fee2e2",
                                color: "#ef4444",
                                border: "none",
                                padding: "8px 14px",
                                borderRadius: "6px",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                cursor: "pointer",
                            }}
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete file"}
                        </button>
                    ) : (
                        <span />
                    )}
                    <div className="task-modal-footer-actions">
                        <button type="button" className="modal-cancel" onClick={onClose} disabled={isDeleting}>
                            Close
                        </button>
                        <button
                            type="button"
                            className="modal-save"
                            onClick={handleOpenFile}
                            disabled={!file.fileUrl || isDeleting}
                            title={file.fileUrl ? "Open file in new tab" : "No file URL available"}
                        >
                            Open file
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* =========================
   ADD FILE MODAL
   Real file picker → FormData → Multer upload.
   Callback receives a FormData object ready to POST.
========================= */

interface AddFileModalProps {
    onClose: () => void;
    /** Called with a FormData object ready to send to the backend. */
    onSave: (formData: FormData) => void;
    uploaderName: string;   // pre-filled from logged-in user's display name
    isLoading?: boolean;
}

export function AddFileModal({ onClose, onSave, uploaderName, isLoading = false }: AddFileModalProps) {
    useEscapeToClose(onClose);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [description, setDescription] = useState("");
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (file: File | null) => {
        if (file) setSelectedFile(file);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFileChange(e.target.files?.[0] ?? null);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0] ?? null;
        handleFileChange(file);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handleSave = () => {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("name", selectedFile.name);
        formData.append("type", extToFileType(selectedFile.name));
        formData.append("size", formatBytes(selectedFile.size));
        formData.append("uploadedBy", uploaderName || "Unknown");
        if (description.trim()) {
            formData.append("description", description.trim());
        }

        onSave(formData);
    };

    const canSave = !!selectedFile && !isLoading;

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div
                className="task-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Upload file"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="task-modal-header">
                    <h3>Upload file</h3>
                    <button className="modal-close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                <div className="task-modal-body">
                    {/* Drag-and-drop / click-to-pick zone */}
                    <div
                        className={`file-drop-zone${isDragging ? " dragging" : ""}${selectedFile ? " has-file" : ""}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                        aria-label="Click or drag a file here to upload"
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            style={{ display: "none" }}
                            onChange={handleInputChange}
                            accept=".pdf,.png,.jpg,.jpeg,.fig,.zip,.ppt,.pptx,.doc,.docx,.mp4,.xls,.xlsx"
                        />

                        {selectedFile ? (
                            <div className="file-drop-selected">
                                <div className="file-drop-icon">📄</div>
                                <div className="file-drop-info">
                                    <strong>{selectedFile.name}</strong>
                                    <span>{formatBytes(selectedFile.size)} · {extToFileType(selectedFile.name)}</span>
                                </div>
                                <button
                                    type="button"
                                    className="file-drop-remove"
                                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                    aria-label="Remove selected file"
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <div className="file-drop-placeholder">
                                <div className="file-drop-icon">📁</div>
                                <p><strong>Click to choose a file</strong> or drag &amp; drop here</p>
                                <span>PDF, PNG, JPG, DOC, XLS, PPT, ZIP, MP4, FIG</span>
                            </div>
                        )}
                    </div>

                    <div className="field">
                        <label>Description (optional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this file? (optional)"
                            rows={3}
                        />
                    </div>
                </div>

                <div className="task-modal-footer">
                    <span />
                    <div className="task-modal-footer-actions">
                        <button type="button" className="modal-cancel" onClick={onClose} disabled={isLoading}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="modal-save"
                            disabled={!canSave}
                            onClick={handleSave}
                        >
                            {isLoading ? "Uploading…" : "Upload file"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}