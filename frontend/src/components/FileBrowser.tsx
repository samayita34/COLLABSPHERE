import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    fetchFoldersApi,
    fetchProjectFilesApi,
    createFolderApi,
    uploadFileApi,
    deleteFileApi,
    toggleFileLockApi,
    type Folder,
    type ProjectFile,
    formatDisplayDate,
} from "../services/projectApi";
import {
    Folder as FiFolder,
    Lock as FiLock,
    Unlock as FiUnlock,
    Trash2 as FiTrash2,
    Download as FiDownload,
    UploadCloud as FiUploadCloud,
    FolderPlus as FiFolderPlus,
    ChevronRight as FiChevronRight,
    Clock as FiClock,
    Loader2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface FileBrowserProps {
    projectId: string;
}

function formatBytes(bytes: string | number) {
    const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
    if (isNaN(b) || b === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function FileBrowser({ projectId }: FileBrowserProps) {
    const { user } = useAuth();
    const [folders, setFolders] = useState<Folder[]>([]);
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [fetchedFolders, fetchedFiles] = await Promise.all([
                fetchFoldersApi(projectId),
                fetchProjectFilesApi(projectId, currentFolderId || undefined),
            ]);
            setFolders(fetchedFolders);
            setFiles(fetchedFiles);
        } catch (err: any) {
            setError(err.message || "Failed to load files");
        } finally {
            setLoading(false);
        }
    }, [projectId, currentFolderId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreateFolder = async () => {
        const name = prompt("Folder name:");
        if (!name || !name.trim()) return;
        try {
            await createFolderApi(projectId, name.trim(), currentFolderId || undefined);
            loadData();
        } catch (err: any) {
            alert(err.message || "Failed to create folder");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", file.name);
        if (currentFolderId) {
            formData.append("folderId", currentFolderId);
        }

        setUploading(true);
        setError(null);
        try {
            await uploadFileApi(projectId, formData);
            loadData();
        } catch (err: any) {
            console.error("Upload error:", err);
            setError(err.message || "Failed to upload file");
            alert(err.message || "Failed to upload file");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDeleteFile = async (fileId: string) => {
        if (!confirm("Are you sure you want to delete this file?")) return;
        try {
            await deleteFileApi(projectId, fileId);
            loadData();
        } catch (err: any) {
            alert(err.message || "Failed to delete file");
        }
    };

    const handleToggleLock = async (fileId: string) => {
        try {
            await toggleFileLockApi(projectId, fileId);
            loadData();
        } catch (err: any) {
            alert(err.message || "Failed to toggle file lock");
        }
    };

    const breadcrumbs = [];
    let currId = currentFolderId;
    while (currId) {
        const f = folders.find((fd) => fd.id === currId);
        if (f) {
            breadcrumbs.unshift(f);
            currId = f.parentId;
        } else {
            break;
        }
    }

    const currentFolders = folders.filter((f) => f.parentId === currentFolderId);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", borderRadius: "10px", border: "1px solid #e7e3d8", overflow: "hidden" }}>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #f0ede4", background: "#fcfbf8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 600, color: "#14161c" }}>
                    <button
                        type="button"
                        onClick={() => setCurrentFolderId(null)}
                        style={{ background: "none", border: "none", color: currentFolderId ? "#5a594f" : "#14161c", fontWeight: currentFolderId ? 500 : 700, cursor: "pointer", padding: "2px 4px", fontSize: "14px" }}
                    >
                        📁 Files
                    </button>
                    {breadcrumbs.map((f) => (
                        <React.Fragment key={f.id}>
                            <FiChevronRight size={14} color="#9a968a" />
                            <button
                                type="button"
                                onClick={() => setCurrentFolderId(f.id)}
                                style={{ background: "none", border: "none", color: f.id === currentFolderId ? "#14161c" : "#5a594f", fontWeight: f.id === currentFolderId ? 700 : 500, cursor: "pointer", padding: "2px 4px", fontSize: "14px" }}
                            >
                                {f.name}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                        type="button"
                        onClick={handleCreateFolder}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 12px",
                            fontSize: "13px",
                            fontWeight: 500,
                            borderRadius: "6px",
                            border: "1px solid #e7e3d8",
                            background: "#ffffff",
                            color: "#14161c",
                            cursor: "pointer",
                        }}
                    >
                        <FiFolderPlus size={15} />
                        <span>New Folder</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 14px",
                            fontSize: "13px",
                            fontWeight: 600,
                            borderRadius: "6px",
                            border: "none",
                            background: "#232a3d",
                            color: "#ffffff",
                            cursor: uploading ? "not-allowed" : "pointer",
                            opacity: uploading ? 0.7 : 1,
                        }}
                    >
                        {uploading ? (
                            <>
                                <Loader2 size={15} className="animate-spin" />
                                <span>Uploading...</span>
                            </>
                        ) : (
                            <>
                                <FiUploadCloud size={15} />
                                <span>Upload File</span>
                            </>
                        )}
                    </button>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        style={{ display: "none" }}
                    />
                </div>
            </div>

            {error && (
                <div style={{ margin: "12px 20px", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: "8px", fontSize: "13px" }}>
                    {error}
                </div>
            )}

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                {loading ? (
                    <div style={{ textAlign: "center", padding: "60px 0", color: "#9a968a", fontSize: "14px" }}>
                        Loading files and folders...
                    </div>
                ) : (
                    <div>
                        {/* Folders Section */}
                        {currentFolders.length > 0 && (
                            <div style={{ marginBottom: "24px" }}>
                                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a968a", marginBottom: "12px", fontFamily: "IBM Plex Mono, monospace" }}>
                                    Folders ({currentFolders.length})
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                                    {currentFolders.map((folder) => (
                                        <div
                                            key={folder.id}
                                            onClick={() => setCurrentFolderId(folder.id)}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "12px",
                                                padding: "12px 14px",
                                                background: "#ffffff",
                                                border: "1px solid #e7e3d8",
                                                borderRadius: "8px",
                                                cursor: "pointer",
                                                transition: "border-color 0.15s ease, transform 0.15s ease",
                                            }}
                                        >
                                            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#e0e7ff", color: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                <FiFolder size={20} />
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#14161c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {folder.name}
                                                </div>
                                                <div style={{ fontSize: "11.5px", color: "#9a968a", marginTop: "2px" }}>
                                                    {folder._count?.files || 0} files
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Files Section */}
                        <div>
                            {files.length > 0 && (
                                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a968a", marginBottom: "12px", fontFamily: "IBM Plex Mono, monospace" }}>
                                    Files ({files.length})
                                </div>
                            )}

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "14px" }}>
                                {files.map((file) => {
                                    const latestVersion = file.versions?.[0];
                                    const canEdit = !file.isLocked || file.lockedBy?.id === user?.id;
                                    const ext = file.name.split(".").pop()?.toUpperCase() || file.type || "FILE";

                                    return (
                                        <div
                                            key={file.id}
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                justifyContent: "space-between",
                                                padding: "14px",
                                                background: "#ffffff",
                                                border: "1px solid #e7e3d8",
                                                borderRadius: "10px",
                                                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
                                                    <div style={{
                                                        width: "36px",
                                                        height: "36px",
                                                        background: "#f0ede4",
                                                        color: "#232a3d",
                                                        borderRadius: "6px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontWeight: 700,
                                                        fontSize: "10.5px",
                                                        flexShrink: 0,
                                                        fontFamily: "IBM Plex Mono, monospace"
                                                    }}>
                                                        {ext}
                                                    </div>
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: 600, color: "#14161c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.name}>
                                                            {file.name}
                                                        </h4>
                                                        <div style={{ fontSize: "11px", color: "#9a968a", marginTop: "2px" }}>
                                                            v{latestVersion?.versionNum || 1} • {latestVersion ? formatBytes(latestVersion.sizeBytes) : "Unknown"}
                                                        </div>
                                                    </div>
                                                </div>

                                                {file.description && (
                                                    <p style={{ margin: "4px 0 8px", fontSize: "12px", color: "#5a594f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {file.description}
                                                    </p>
                                                )}
                                            </div>

                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f0ede4", paddingTop: "10px", marginTop: "10px" }}>
                                                <div style={{ fontSize: "11px", color: "#9a968a", display: "flex", alignItems: "center", gap: "4px" }}>
                                                    <FiClock size={12} />
                                                    <span>{formatDisplayDate(file.updatedAt)}</span>
                                                </div>

                                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleLock(file.id)}
                                                        style={{
                                                            padding: "4px 6px",
                                                            border: "1px solid #e7e3d8",
                                                            borderRadius: "4px",
                                                            background: file.isLocked ? "#fef3c7" : "#ffffff",
                                                            color: file.isLocked ? "#d97706" : "#5a594f",
                                                            cursor: "pointer",
                                                        }}
                                                        title={file.isLocked ? `Locked by ${file.lockedBy?.firstName}` : "Lock file"}
                                                    >
                                                        {file.isLocked ? <FiLock size={13} /> : <FiUnlock size={13} />}
                                                    </button>

                                                    <a
                                                        href={`/api/projects/${projectId}/files/${file.id}/download`}
                                                        style={{
                                                            padding: "4px 6px",
                                                            border: "1px solid #e7e3d8",
                                                            borderRadius: "4px",
                                                            background: "#ffffff",
                                                            color: "#2563eb",
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            textDecoration: "none",
                                                        }}
                                                        title="Download"
                                                    >
                                                        <FiDownload size={13} />
                                                    </a>

                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteFile(file.id)}
                                                            style={{
                                                                padding: "4px 6px",
                                                                border: "1px solid #fee2e2",
                                                                borderRadius: "4px",
                                                                background: "#fef2f2",
                                                                color: "#ef4444",
                                                                cursor: "pointer",
                                                            }}
                                                            title="Delete"
                                                        >
                                                            <FiTrash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Empty state */}
                        {currentFolders.length === 0 && files.length === 0 && (
                            <div style={{ textAlign: "center", padding: "60px 20px", background: "#fcfbf8", borderRadius: "10px", border: "2px dashed #e7e3d8" }}>
                                <FiUploadCloud size={44} color="#9a968a" style={{ margin: "0 auto 12px" }} />
                                <h3 style={{ fontSize: "16px", color: "#14161c", marginBottom: "4px" }}>No files in this folder</h3>
                                <p style={{ fontSize: "13px", color: "#9a968a", marginBottom: "16px" }}>
                                    Click "Upload File" above to upload documents, PDFs, images, or assets.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        padding: "8px 16px",
                                        fontSize: "13px",
                                        fontWeight: 600,
                                        borderRadius: "6px",
                                        border: "none",
                                        background: "#232a3d",
                                        color: "#ffffff",
                                        cursor: "pointer",
                                    }}
                                >
                                    <FiUploadCloud size={15} />
                                    <span>Upload File</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
