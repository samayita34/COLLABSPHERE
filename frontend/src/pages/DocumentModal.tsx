import { useEffect, useState } from "react";
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

import { useAuth } from "../context/AuthContext";
import { fetchDocumentVersionsApi, createDocumentVersionApi, restoreDocumentVersionApi, type DocumentVersion } from "../services/projectApi";

interface DocumentDetailModalProps {
    document: ProjectDocument;
    onClose: () => void;
    onSave?: (id: string, newContent: string) => void;
}

export function DocumentDetailModal({ document: doc, onClose }: DocumentDetailModalProps) {
    useEscapeToClose(onClose);
    const { userFullName, userInitials, user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    
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
                        {isEditing && (
                            <button type="button" className="modal-save" onClick={() => {
                                setIsEditing(false);
                            }}>
                                Stop Editing
                            </button>
                        )}
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