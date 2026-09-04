import { useState, useEffect, useRef } from "react";
import {
    type ProjectFile,
    type FileDownloadRecord,
    restoreFileVersionApi,
    fetchFileDownloadsApi,
    toggleFileLockApi,
    uploadFileApi,
    formatDisplayDate,
} from "../services/projectApi";
import {
    X,
    Download,
    Lock,
    Unlock,
    RotateCcw,
    Clock,
    FileText,
    Eye,
    History,
    UploadCloud,
    ZoomIn,
    ZoomOut,
    User as FiUser,
    CheckCircle,
    Loader2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./FilePreviewModal.css";

interface FilePreviewModalProps {
    file: ProjectFile;
    projectId: string;
    onClose: () => void;
    onFileUpdated: () => void;
}

function formatBytes(bytes: string | number) {
    const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
    if (isNaN(b) || b === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function FilePreviewModal({ file: initialFile, projectId, onClose, onFileUpdated }: FilePreviewModalProps) {
    const { user } = useAuth();
    const [file, setFile] = useState<ProjectFile>(initialFile);
    const [activeTab, setActiveTab] = useState<"preview" | "versions" | "downloads">("preview");

    // Download history
    const [downloads, setDownloads] = useState<FileDownloadRecord[]>([]);
    const [loadingDownloads, setLoadingDownloads] = useState(false);

    // Text file content
    const [textContent, setTextContent] = useState<string | null>(null);
    const [loadingText, setLoadingText] = useState(false);

    // Image Zoom
    const [imageZoom, setImageZoom] = useState(1);

    // Actions state
    const [actionLoading, setActionLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const versionUploadInputRef = useRef<HTMLInputElement>(null);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    // Load downloads when tab is opened
    useEffect(() => {
        if (activeTab === "downloads") {
            setLoadingDownloads(true);
            fetchFileDownloadsApi(projectId, file.id)
                .then(setDownloads)
                .catch((err) => console.error("Failed to load downloads:", err))
                .finally(() => setLoadingDownloads(false));
        }
    }, [activeTab, projectId, file.id]);

    const ext = (file.name.split(".").pop() || file.type || "").toLowerCase();
    const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext);
    const isPdf = ext === "pdf";
    const isVideo = ["mp4", "webm", "mov", "mkv"].includes(ext);
    const isAudio = ["mp3", "wav", "ogg", "m4a"].includes(ext);
    const isText = ["txt", "md", "json", "js", "ts", "tsx", "jsx", "html", "css", "csv", "xml", "env"].includes(ext);

    // Download URL for latest version
    const latestVersion = file.versions?.[0];
    const downloadUrl = `/api/projects/${projectId}/files/${file.id}/download`;

    // Fetch text content for text files
    useEffect(() => {
        if (isText && activeTab === "preview") {
            setLoadingText(true);
            fetch(downloadUrl)
                .then((res) => {
                    if (!res.ok) throw new Error("Could not fetch file content");
                    return res.text();
                })
                .then((text) => setTextContent(text))
                .catch((err) => {
                    console.error("Failed to read text file:", err);
                    setTextContent(null);
                })
                .finally(() => setLoadingText(false));
        }
    }, [isText, downloadUrl, activeTab]);

    const handleToggleLock = async () => {
        setActionLoading(true);
        setErrorMessage(null);
        try {
            const updated = await toggleFileLockApi(projectId, file.id);
            setFile(updated);
            onFileUpdated();
            setSuccessMessage(updated.isLocked ? "File locked successfully" : "File unlocked");
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to toggle file lock");
        } finally {
            setActionLoading(false);
        }
    };

    const handleRestoreVersion = async (versionId: string, versionNum: number) => {
        if (!confirm(`Are you sure you want to restore Version ${versionNum}? This will create a new latest version from it.`)) return;

        setActionLoading(true);
        setErrorMessage(null);
        try {
            const updated = await restoreFileVersionApi(projectId, file.id, versionId);
            setFile(updated);
            onFileUpdated();
            setSuccessMessage(`Version ${versionNum} restored successfully!`);
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to restore version");
        } finally {
            setActionLoading(false);
        }
    };

    const handleUploadNewVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        const formData = new FormData();
        formData.append("file", selected);
        formData.append("name", file.name); // Keep same name so backend treats as new version
        if (file.folderId) {
            formData.append("folderId", file.folderId);
        }

        setActionLoading(true);
        setErrorMessage(null);
        try {
            const updated = await uploadFileApi(projectId, formData);
            setFile(updated);
            onFileUpdated();
            setSuccessMessage("New version uploaded successfully!");
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to upload new version");
        } finally {
            setActionLoading(false);
            if (versionUploadInputRef.current) versionUploadInputRef.current.value = "";
        }
    };

    const isLockedByOther = file.isLocked && file.lockedBy?.id !== user?.id;

    return (
        <div className="file-preview-overlay" onMouseDown={onClose}>
            <div
                className="file-preview-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`${file.name} preview`}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="file-preview-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <div className="file-preview-badge">
                            {ext.toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <h3 className="file-preview-title" title={file.name}>
                                    {file.name}
                                </h3>
                                {file.isLocked && (
                                    <span className="file-lock-badge" title={`Locked by ${file.lockedBy?.firstName || "user"}`}>
                                        <Lock size={12} /> Locked by {file.lockedBy?.firstName || "user"}
                                    </span>
                                )}
                            </div>
                            <div className="file-preview-subtitle">
                                v{latestVersion?.versionNum || 1} • {latestVersion ? formatBytes(latestVersion.sizeBytes) : ""} • Updated {file.updatedAt}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button
                            type="button"
                            onClick={handleToggleLock}
                            disabled={actionLoading || (file.isLocked && file.lockedBy?.id !== user?.id)}
                            className={`file-header-btn ${file.isLocked ? "locked" : ""}`}
                            title={file.isLocked ? "Unlock file" : "Lock file to prevent edits"}
                        >
                            {file.isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                            <span>{file.isLocked ? "Unlock" : "Lock"}</span>
                        </button>

                        <a
                            href={downloadUrl}
                            className="file-header-btn primary"
                            title="Download latest version"
                        >
                            <Download size={14} />
                            <span>Download</span>
                        </a>

                        <button className="file-close-btn" onClick={onClose} aria-label="Close">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Status Banners */}
                {successMessage && (
                    <div className="file-banner success">
                        <CheckCircle size={14} />
                        <span>{successMessage}</span>
                    </div>
                )}
                {errorMessage && (
                    <div className="file-banner error">
                        <X size={14} />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Tabs Strip */}
                <div className="file-preview-tabs">
                    <button
                        type="button"
                        className={`file-tab-btn ${activeTab === "preview" ? "active" : ""}`}
                        onClick={() => setActiveTab("preview")}
                    >
                        <Eye size={14} /> Preview
                    </button>
                    <button
                        type="button"
                        className={`file-tab-btn ${activeTab === "versions" ? "active" : ""}`}
                        onClick={() => setActiveTab("versions")}
                    >
                        <History size={14} /> Version History ({file.versions?.length || 1})
                    </button>
                    <button
                        type="button"
                        className={`file-tab-btn ${activeTab === "downloads" ? "active" : ""}`}
                        onClick={() => setActiveTab("downloads")}
                    >
                        <Download size={14} /> Downloads ({file.downloadCount || 0})
                    </button>
                </div>

                {/* Tab 1: Preview */}
                {activeTab === "preview" && (
                    <div className="file-preview-body">
                        {isImage && (
                            <div className="file-image-container">
                                <div className="file-zoom-controls">
                                    <button
                                        type="button"
                                        onClick={() => setImageZoom((prev) => Math.min(prev + 0.25, 3))}
                                        title="Zoom in"
                                    >
                                        <ZoomIn size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setImageZoom(1)}
                                        title="Reset zoom"
                                    >
                                        {Math.round(imageZoom * 100)}%
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setImageZoom((prev) => Math.max(prev - 0.25, 0.5))}
                                        title="Zoom out"
                                    >
                                        <ZoomOut size={14} />
                                    </button>
                                </div>
                                <div className="file-image-scroll">
                                    <img
                                        src={downloadUrl}
                                        alt={file.name}
                                        style={{ transform: `scale(${imageZoom})`, transformOrigin: "center center" }}
                                    />
                                </div>
                            </div>
                        )}

                        {isPdf && (
                            <div className="file-pdf-container">
                                <iframe
                                    src={`${downloadUrl}#toolbar=1`}
                                    title={file.name}
                                    width="100%"
                                    height="100%"
                                />
                            </div>
                        )}

                        {isVideo && (
                            <div className="file-media-container">
                                <video controls src={downloadUrl} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "8px" }}>
                                    Your browser does not support HTML5 video preview.
                                </video>
                            </div>
                        )}

                        {isAudio && (
                            <div className="file-audio-container">
                                <audio controls src={downloadUrl} style={{ width: "100%", maxWidth: "450px" }}>
                                    Your browser does not support HTML5 audio playback.
                                </audio>
                            </div>
                        )}

                        {isText && (
                            <div className="file-text-container">
                                {loadingText ? (
                                    <div className="file-loading-state">
                                        <Loader2 size={24} className="animate-spin" />
                                        <span>Loading document content...</span>
                                    </div>
                                ) : (
                                    <pre className="file-code-preview">
                                        <code>{textContent || "No text content preview available."}</code>
                                    </pre>
                                )}
                            </div>
                        )}

                        {!isImage && !isPdf && !isVideo && !isAudio && !isText && (
                            <div className="file-fallback-container">
                                <FileText size={64} color="#94a3b8" />
                                <h4>{file.name}</h4>
                                <p>
                                    Direct inline preview is not supported for this file format ({ext.toUpperCase()}).
                                </p>
                                <a href={downloadUrl} className="file-header-btn primary" style={{ marginTop: "12px" }}>
                                    <Download size={15} />
                                    <span>Download File ({latestVersion ? formatBytes(latestVersion.sizeBytes) : ""})</span>
                                </a>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 2: Version History & Restore */}
                {activeTab === "versions" && (
                    <div className="file-preview-body" style={{ background: "#ffffff", padding: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <div>
                                <h4 style={{ margin: 0, fontSize: "15px", color: "#0f172a" }}>Revisions Timeline</h4>
                                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                                    Every change is versioned. You can download historical files or restore past versions.
                                </p>
                            </div>

                            <input
                                ref={versionUploadInputRef}
                                type="file"
                                style={{ display: "none" }}
                                onChange={handleUploadNewVersion}
                            />
                            <button
                                type="button"
                                onClick={() => versionUploadInputRef.current?.click()}
                                disabled={actionLoading || isLockedByOther}
                                className="file-header-btn primary"
                                title={isLockedByOther ? "File is locked by another user" : "Upload new revision"}
                            >
                                <UploadCloud size={14} />
                                <span>Upload New Revision</span>
                            </button>
                        </div>

                        <div className="file-version-list">
                            {(file.versions || []).map((v, index) => {
                                const isCurrent = index === 0;
                                const versionDownloadUrl = `/api/projects/${projectId}/files/${file.id}/download?versionId=${v.id}`;
                                const uploaderName = v.uploadedBy ? `${v.uploadedBy.firstName} ${v.uploadedBy.lastName}`.trim() : "Member";

                                return (
                                    <div key={v.id} className={`file-version-card ${isCurrent ? "current" : ""}`}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                            <div className={`file-version-badge ${isCurrent ? "active" : ""}`}>
                                                v{v.versionNum}
                                            </div>
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <strong style={{ fontSize: "13.5px", color: "#1e293b" }}>
                                                        Version {v.versionNum}
                                                    </strong>
                                                    {isCurrent && (
                                                        <span className="file-active-pill">Active / Current</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px", display: "flex", alignItems: "center", gap: "10px" }}>
                                                    <span>By {uploaderName}</span>
                                                    <span>•</span>
                                                    <span>{formatBytes(v.sizeBytes)}</span>
                                                    <span>•</span>
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                                        <Clock size={11} /> {formatDisplayDate(v.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <a
                                                href={versionDownloadUrl}
                                                className="file-action-pill"
                                                title={`Download Version ${v.versionNum}`}
                                            >
                                                <Download size={13} />
                                                <span>Download</span>
                                            </a>

                                            {!isCurrent && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRestoreVersion(v.id, v.versionNum)}
                                                    disabled={actionLoading || isLockedByOther}
                                                    className="file-action-pill restore"
                                                    title={isLockedByOther ? "File is locked" : `Restore Version ${v.versionNum}`}
                                                >
                                                    <RotateCcw size={13} />
                                                    <span>Restore</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Tab 3: Downloads Tracking */}
                {activeTab === "downloads" && (
                    <div className="file-preview-body" style={{ background: "#ffffff", padding: "20px" }}>
                        <div style={{ marginBottom: "16px" }}>
                            <h4 style={{ margin: 0, fontSize: "15px", color: "#0f172a" }}>Download Activity</h4>
                            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                                Total {file.downloadCount || downloads.length} downloads recorded for this file.
                            </p>
                        </div>

                        {loadingDownloads ? (
                            <div className="file-loading-state">
                                <Loader2 size={24} className="animate-spin" />
                                <span>Loading download trail...</span>
                            </div>
                        ) : downloads.length === 0 ? (
                            <div className="file-empty-zone">
                                <Download size={32} color="#cbd5e1" />
                                <p style={{ marginTop: "8px", fontSize: "13px", color: "#94a3b8" }}>
                                    No downloads recorded yet.
                                </p>
                            </div>
                        ) : (
                            <div className="file-downloads-list">
                                {downloads.map((d) => (
                                    <div key={d.id} className="file-download-row">
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <div className="file-user-avatar">
                                                {d.user?.name ? d.user.name.slice(0, 2).toUpperCase() : <FiUser size={13} />}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                                                    {d.user?.name || "Anonymous Member"}
                                                </div>
                                                <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                                    {d.user?.email}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                                            <Clock size={12} />
                                            <span>{new Date(d.downloadedAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
