import { useEffect, useState } from "react";

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

interface DocumentDetailModalProps {
    document: ProjectDocument;
    onClose: () => void;
}

export function DocumentDetailModal({ document: doc, onClose }: DocumentDetailModalProps) {
    useEscapeToClose(onClose);

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
                    <button className="modal-close" onClick={onClose} aria-label="Close">
                        ✕
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

                    <div className="doc-detail-meta">
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
                </div>

                <div className="task-modal-footer">
                    <span />
                    <div className="task-modal-footer-actions">
                        <button type="button" className="modal-cancel" onClick={onClose}>
                            Close
                        </button>
                        <button type="button" className="modal-save" onClick={() => { }}>
                            Open document
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* =========================
   ADD DOCUMENT MODAL
   Simple local-state form. The new document is handed back to
   ProjectWorkspace, which stamps created/updated dates and
   prepends it to the live `documents` state.
========================= */

interface AddDocumentModalProps {
    onClose: () => void;
    onSave: (doc: {
        name: string;
        description: string;
        type: DocType;
        owner: string;
        size?: string;
    }) => void;
}

const TYPE_OPTIONS: DocType[] = ["DOC", "PDF", "XLS", "PPT"];

export function AddDocumentModal({ onClose, onSave }: AddDocumentModalProps) {
    useEscapeToClose(onClose);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [type, setType] = useState<DocType>("DOC");
    const [owner, setOwner] = useState("");
    const [size, setSize] = useState("");

    const canSave = name.trim().length > 0 && owner.trim().length > 0;

    const handleSave = () => {
        if (!canSave) return;
        onSave({
            name: name.trim(),
            description: description.trim(),
            type,
            owner: owner.trim(),
            size: size.trim() || undefined,
        });
    };

    return (
        <div className="modal-overlay" onMouseDown={onClose}>
            <div
                className="task-modal"
                role="dialog"
                aria-modal="true"
                aria-label="New document"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="task-modal-header">
                    <h3>New document</h3>
                    <button className="modal-close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                <div className="task-modal-body">
                    <div className="field">
                        <label>Document name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Onboarding Guide"
                            autoFocus
                        />
                    </div>

                    <div className="field">
                        <label>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this document about? (optional)"
                            rows={3}
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
                            <label>Owner</label>
                            <input
                                type="text"
                                value={owner}
                                onChange={(e) => setOwner(e.target.value)}
                                placeholder="e.g. Aditi Rao"
                            />
                        </div>
                    </div>

                    <div className="field">
                        <label>Size (optional)</label>
                        <input
                            type="text"
                            value={size}
                            onChange={(e) => setSize(e.target.value)}
                            placeholder="e.g. 1.2 MB"
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
                            Add document
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}