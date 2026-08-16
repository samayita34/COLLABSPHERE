import { useEffect, useState } from "react";

/* =========================
   TYPES
   Mirrors the ProjectFile shape in ProjectWorkspace.tsx.
   Kept local so this component has no import-order coupling
   (same pattern as TaskModal.tsx / MemberModal.tsx /
   DocumentModal.tsx). Independent of ProjectDocument -- Files
   is uploaded assets/attachments, Documents is structured
   project content.
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

export interface ProjectFile {
    id: string;
    name: string;
    type: FileType;
    size: string;
    uploadedBy: string;
    uploadedAt: string;
    modifiedAt?: string;
    description?: string;
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
   Read-only metadata view. "Open file" has no real storage to
   hook into yet, so it's a styled no-op for now.
========================= */

interface FileDetailModalProps {
    file: ProjectFile;
    onClose: () => void;
}

export function FileDetailModal({ file, onClose }: FileDetailModalProps) {
    useEscapeToClose(onClose);

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
                    <button className="modal-close" onClick={onClose} aria-label="Close">
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
                    <span />
                    <div className="task-modal-footer-actions">
                        <button type="button" className="modal-cancel" onClick={onClose}>
                            Close
                        </button>
                        <button type="button" className="modal-save" onClick={() => { }}>
                            Open file
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* =========================
   ADD FILE MODAL (Upload file)
   Simple local-state form -- no real browser upload/storage
   yet. The new file is handed back to ProjectWorkspace, which
   stamps the uploaded date and prepends it to `files` state.
========================= */

interface AddFileModalProps {
    onClose: () => void;
    onSave: (file: {
        name: string;
        type: FileType;
        size: string;
        uploadedBy: string;
        description?: string;
    }) => void;
}

const TYPE_OPTIONS: FileType[] = ["PDF", "PNG", "JPG", "FIG", "ZIP", "PPT", "DOC", "MP4", "XLS"];

export function AddFileModal({ onClose, onSave }: AddFileModalProps) {
    useEscapeToClose(onClose);

    const [name, setName] = useState("");
    const [type, setType] = useState<FileType>("PDF");
    const [size, setSize] = useState("");
    const [uploadedBy, setUploadedBy] = useState("");
    const [description, setDescription] = useState("");

    const canSave =
        name.trim().length > 0 && size.trim().length > 0 && uploadedBy.trim().length > 0;

    const handleSave = () => {
        if (!canSave) return;
        onSave({
            name: name.trim(),
            type,
            size: size.trim(),
            uploadedBy: uploadedBy.trim(),
            description: description.trim() || undefined,
        });
    };

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
                    <div className="field">
                        <label>File name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. homepage-final.fig"
                            autoFocus
                        />
                    </div>

                    <div className="field-row">
                        <div className="field">
                            <label>File type</label>
                            <select value={type} onChange={(e) => setType(e.target.value as FileType)}>
                                {TYPE_OPTIONS.map((t) => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="field">
                            <label>File size</label>
                            <input
                                type="text"
                                value={size}
                                onChange={(e) => setSize(e.target.value)}
                                placeholder="e.g. 4.2 MB"
                            />
                        </div>
                    </div>

                    <div className="field">
                        <label>Uploaded by</label>
                        <input
                            type="text"
                            value={uploadedBy}
                            onChange={(e) => setUploadedBy(e.target.value)}
                            placeholder="e.g. Aditi Rao"
                        />
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
                        <button type="button" className="modal-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="modal-save"
                            disabled={!canSave}
                            onClick={handleSave}
                        >
                            Upload file
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}