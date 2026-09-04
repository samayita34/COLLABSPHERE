import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    fetchFoldersApi,
    fetchProjectFilesApi,
    createFolderApi,
    renameFolderApi,
    deleteFolderApi,
    moveFileApi,
    uploadFileApi,
    deleteFileApi,
    toggleFileLockApi,
    fetchStorageQuotaApi,
    type Folder,
    type ProjectFile,
    type StorageQuota,
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
    Eye,
    FolderInput,
    Edit2,
    HardDrive,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { FilePreviewModal } from "./FilePreviewModal";

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
    const [storageQuota, setStorageQuota] = useState<StorageQuota | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Selected file for Preview/Version/Download modal
    const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);

    // Move file state
    const [movingFile, setMovingFile] = useState<ProjectFile | null>(null);
    const [targetFolderId, setTargetFolderId] = useState<string | null>(null);

    // Drag and drop state
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const dragCounterRef = useRef(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const isGuest = user?.role === "GUEST";

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [fetchedFolders, fetchedFiles, fetchedQuota] = await Promise.all([
                fetchFoldersApi(projectId),
                fetchProjectFilesApi(projectId, currentFolderId || undefined),
                fetchStorageQuotaApi(projectId).catch(() => null),
            ]);
            setFolders(fetchedFolders);
            setFiles(fetchedFiles);
            if (fetchedQuota) setStorageQuota(fetchedQuota);
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
        if (isGuest) {
            alert("Guests do not have permission to create folders.");
            return;
        }
        const name = prompt("Folder name:");
        if (!name || !name.trim()) return;
        try {
            await createFolderApi(projectId, name.trim(), currentFolderId || undefined);
            loadData();
        } catch (err: any) {
            alert(err.message || "Failed to create folder");
        }
    };

    const handleRenameFolder = async (folder: Folder, e: React.MouseEvent) => {
        e.stopPropagation();
        if (isGuest) return;
        const newName = prompt("Rename folder:", folder.name);
        if (!newName || !newName.trim() || newName.trim() === folder.name) return;
        try {
            await renameFolderApi(projectId, folder.id, newName.trim());
            loadData();
        } catch (err: any) {
            alert(err.message || "Failed to rename folder");
        }
    };

    const handleDeleteFolder = async (folder: Folder, e: React.MouseEvent) => {
        e.stopPropagation();
        if (isGuest) return;
        if (!confirm(`Are you sure you want to delete folder "${folder.name}" and all its contents?`)) return;
        try {
            await deleteFolderApi(projectId, folder.id);
            if (currentFolderId === folder.id) {
                setCurrentFolderId(folder.parentId);
            }
            loadData();
        } catch (err: any) {
            alert(err.message || "Failed to delete folder");
        }
    };

    const uploadFiles = async (fileList: FileList | File[]) => {
        if (isGuest) {
            alert("Guests do not have permission to upload files.");
            return;
        }
        if (!fileList || fileList.length === 0) return;

        setUploading(true);
        setError(null);
        try {
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                const formData = new FormData();
                formData.append("file", file);
                formData.append("name", file.name);
                if (currentFolderId) {
                    formData.append("folderId", currentFolderId);
                }
                await uploadFileApi(projectId, formData);
            }
            loadData();
        } catch (err: any) {
            console.error("Upload error:", err);
            setError(err.message || "Failed to upload file(s)");
            alert(err.message || "Failed to upload file(s)");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            uploadFiles(e.target.files);
        }
    };

    /* Drag and Drop Handlers */
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDraggingOver(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDraggingOver(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        dragCounterRef.current = 0;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            uploadFiles(e.dataTransfer.files);
        }
    };

    const handleDeleteFile = async (file: ProjectFile, e: React.MouseEvent) => {
        e.stopPropagation();
        if (isGuest) return;
        if (file.isLocked && file.lockedBy?.id !== user?.id) {
            alert(`Cannot delete file. It is locked by ${file.lockedBy?.firstName || "another user"}.`);
            return;
        }
        if (!confirm(`Are you sure you want to delete "${file.name}"?`)) return;
        try {
            await deleteFileApi(projectId, file.id);
            loadData();
        } catch (err: any) {
            alert(err.message || "Failed to delete file");
        }
    };

    const handleToggleLock = async (file: ProjectFile, e: React.MouseEvent) => {
        e.stopPropagation();
        if (isGuest) return;
        try {
            await toggleFileLockApi(projectId, file.id);
            loadData();
        } catch (err: any) {
            alert(err.message || "Failed to toggle file lock");
        }
    };

    const handleMoveFileSubmit = async () => {
        if (!movingFile) return;
        try {
            await moveFileApi(projectId, movingFile.id, targetFolderId);
            setMovingFile(null);
            loadData();
        } catch (err: any) {
            alert(err.message || "Failed to move file");
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
    const currentFolderName = breadcrumbs[breadcrumbs.length - 1]?.name || "Root Directory";

    return (
        <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                background: "#ffffff",
                borderRadius: "10px",
                border: "1px solid #e7e3d8",
                overflow: "hidden",
                position: "relative",
            }}
        >
            {/* Drag and Drop Active Overlay */}
            {isDraggingOver && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundColor: "rgba(37, 99, 235, 0.92)",
                        color: "#ffffff",
                        zIndex: 50,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "3px dashed #ffffff",
                        pointerEvents: "none",
                    }}
                >
                    <FiUploadCloud size={64} style={{ marginBottom: "16px", animation: "bounce 1s infinite" }} />
                    <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>
                        Drop files to upload
                    </h2>
                    <p style={{ margin: "6px 0 0", fontSize: "14px", opacity: 0.9 }}>
                        Uploading to <strong>{currentFolderName}</strong>
                    </p>
                </div>
            )}

            {/* Toolbar */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 20px",
                    borderBottom: "1px solid #f0ede4",
                    background: "#fcfbf8",
                    flexWrap: "wrap",
                    gap: "12px",
                }}
            >
                {/* Breadcrumbs */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 600, color: "#14161c", flexWrap: "wrap" }}>
                    <button
                        type="button"
                        onClick={() => setCurrentFolderId(null)}
                        style={{
                            background: "none",
                            border: "none",
                            color: currentFolderId ? "#5a594f" : "#14161c",
                            fontWeight: currentFolderId ? 500 : 700,
                            cursor: "pointer",
                            padding: "2px 4px",
                            fontSize: "14px",
                        }}
                    >
                        📁 Files
                    </button>
                    {breadcrumbs.map((f) => (
                        <React.Fragment key={f.id}>
                            <FiChevronRight size={14} color="#9a968a" />
                            <button
                                type="button"
                                onClick={() => setCurrentFolderId(f.id)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: f.id === currentFolderId ? "#14161c" : "#5a594f",
                                    fontWeight: f.id === currentFolderId ? 700 : 500,
                                    cursor: "pointer",
                                    padding: "2px 4px",
                                    fontSize: "14px",
                                }}
                            >
                                {f.name}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                {/* Right controls: Quota + Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    {/* Storage Quota Widget */}
                    {storageQuota && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                background: "#ffffff",
                                padding: "5px 12px",
                                borderRadius: "20px",
                                border: "1px solid #e7e3d8",
                                fontSize: "12px",
                                color: "#475569",
                            }}
                            title={`Storage: ${storageQuota.storageUsedFormatted} used of ${storageQuota.storageQuotaFormatted}`}
                        >
                            <HardDrive size={13} color="#2563eb" />
                            <span>
                                {storageQuota.storageUsedFormatted} / {storageQuota.storageQuotaFormatted}
                            </span>
                            <div
                                style={{
                                    width: "60px",
                                    height: "6px",
                                    background: "#e2e8f0",
                                    borderRadius: "3px",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        width: `${Math.min(storageQuota.percentage, 100)}%`,
                                        height: "100%",
                                        background: storageQuota.percentage > 90 ? "#ef4444" : storageQuota.percentage > 70 ? "#f59e0b" : "#10b981",
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {!isGuest && (
                        <>
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
                                        <span>Upload Files</span>
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileInputChange}
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
                                                justifyContent: "space-between",
                                                padding: "12px 14px",
                                                background: "#ffffff",
                                                border: "1px solid #e7e3d8",
                                                borderRadius: "8px",
                                                cursor: "pointer",
                                                transition: "border-color 0.15s ease, transform 0.15s ease",
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                                                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#e0e7ff", color: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                    <FiFolder size={20} />
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#14161c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {folder.name}
                                                    </div>
                                                    <div style={{ fontSize: "11.5px", color: "#9a968a", marginTop: "2px" }}>
                                                        {folder._count?.files || 0} files
                                                    </div>
                                                </div>
                                            </div>

                                            {!isGuest && (
                                                <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleRenameFolder(folder, e)}
                                                        style={{ background: "none", border: "none", color: "#64748b", padding: "4px", cursor: "pointer", borderRadius: "4px" }}
                                                        title="Rename folder"
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDeleteFolder(folder, e)}
                                                        style={{ background: "none", border: "none", color: "#ef4444", padding: "4px", cursor: "pointer", borderRadius: "4px" }}
                                                        title="Delete folder"
                                                    >
                                                        <FiTrash2 size={13} />
                                                    </button>
                                                </div>
                                            )}
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

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" }}>
                                {files.map((file) => {
                                    const latestVersion = file.versions?.[0];
                                    const canEdit = !isGuest && (!file.isLocked || file.lockedBy?.id === user?.id);
                                    const ext = (file.name.split(".").pop() || file.type || "FILE").toUpperCase();

                                    return (
                                        <div
                                            key={file.id}
                                            onClick={() => setSelectedFile(file)}
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                justifyContent: "space-between",
                                                padding: "14px",
                                                background: "#ffffff",
                                                border: "1px solid #e7e3d8",
                                                borderRadius: "10px",
                                                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                                                cursor: "pointer",
                                                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
                                                    <div style={{
                                                        width: "38px",
                                                        height: "38px",
                                                        background: "#4f46e5",
                                                        color: "#ffffff",
                                                        borderRadius: "8px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontWeight: 700,
                                                        fontSize: "10.5px",
                                                        flexShrink: 0,
                                                        fontFamily: "monospace"
                                                    }}>
                                                        {ext}
                                                    </div>
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                            <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: 600, color: "#14161c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.name}>
                                                                {file.name}
                                                            </h4>
                                                            {file.isLocked && (
                                                                <span style={{ fontSize: "10px", background: "#fef3c7", color: "#b45309", padding: "1px 5px", borderRadius: "8px", display: "inline-flex", alignItems: "center", gap: "2px" }} title={`Locked by ${file.lockedBy?.firstName || "user"}`}>
                                                                    <FiLock size={10} /> Lock
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: "11px", color: "#9a968a", marginTop: "3px", display: "flex", alignItems: "center", gap: "6px" }}>
                                                            <span style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: "4px", fontWeight: 600 }}>v{latestVersion?.versionNum || 1}</span>
                                                            <span>•</span>
                                                            <span>{latestVersion ? formatBytes(latestVersion.sizeBytes) : "0 B"}</span>
                                                            <span>•</span>
                                                            <span title={`${file.downloadCount || 0} downloads`}>⬇️ {file.downloadCount || 0}</span>
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

                                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedFile(file)}
                                                        style={{
                                                            padding: "4px 6px",
                                                            border: "1px solid #e7e3d8",
                                                            borderRadius: "4px",
                                                            background: "#ffffff",
                                                            color: "#334155",
                                                            cursor: "pointer",
                                                        }}
                                                        title="Preview & Versions"
                                                    >
                                                        <Eye size={13} />
                                                    </button>

                                                    {!isGuest && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleToggleLock(file, e)}
                                                                disabled={file.isLocked && file.lockedBy?.id !== user?.id}
                                                                style={{
                                                                    padding: "4px 6px",
                                                                    border: "1px solid #e7e3d8",
                                                                    borderRadius: "4px",
                                                                    background: file.isLocked ? "#fef3c7" : "#ffffff",
                                                                    color: file.isLocked ? "#d97706" : "#5a594f",
                                                                    cursor: "pointer",
                                                                }}
                                                                title={file.isLocked ? `Locked by ${file.lockedBy?.firstName || "user"}` : "Lock file"}
                                                            >
                                                                {file.isLocked ? <FiLock size={13} /> : <FiUnlock size={13} />}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setMovingFile(file);
                                                                    setTargetFolderId(file.folderId || null);
                                                                }}
                                                                style={{
                                                                    padding: "4px 6px",
                                                                    border: "1px solid #e7e3d8",
                                                                    borderRadius: "4px",
                                                                    background: "#ffffff",
                                                                    color: "#5a594f",
                                                                    cursor: "pointer",
                                                                }}
                                                                title="Move to folder"
                                                            >
                                                                <FolderInput size={13} />
                                                            </button>
                                                        </>
                                                    )}

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
                                                        title="Download latest version"
                                                    >
                                                        <FiDownload size={13} />
                                                    </a>

                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDeleteFile(file, e)}
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
                                    Drag and drop files here, or click "Upload Files" to upload.
                                </p>
                                {!isGuest && (
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
                                        <span>Upload Files</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* File Preview / Version History Modal */}
            {selectedFile && (
                <FilePreviewModal
                    file={selectedFile}
                    projectId={projectId}
                    onClose={() => setSelectedFile(null)}
                    onFileUpdated={() => {
                        loadData();
                    }}
                />
            )}

            {/* Move File Modal */}
            {movingFile && (
                <div
                    className="modal-overlay"
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(15, 23, 42, 0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1060,
                    }}
                    onMouseDown={() => setMovingFile(null)}
                >
                    <div
                        style={{
                            background: "#ffffff",
                            padding: "20px",
                            borderRadius: "12px",
                            width: "90vw",
                            maxWidth: "400px",
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: "0 0 12px", fontSize: "16px", color: "#0f172a" }}>
                            Move "{movingFile.name}"
                        </h3>
                        <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>
                            Select target folder:
                        </p>

                        <select
                            value={targetFolderId || ""}
                            onChange={(e) => setTargetFolderId(e.target.value || null)}
                            style={{
                                width: "100%",
                                padding: "8px 12px",
                                borderRadius: "6px",
                                border: "1px solid #cbd5e1",
                                fontSize: "13px",
                                marginBottom: "20px",
                            }}
                        >
                            <option value="">📁 Root (Files)</option>
                            {folders.map((f) => (
                                <option key={f.id} value={f.id}>
                                    📁 {f.name}
                                </option>
                            ))}
                        </select>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                            <button
                                type="button"
                                onClick={() => setMovingFile(null)}
                                style={{
                                    padding: "6px 14px",
                                    borderRadius: "6px",
                                    border: "1px solid #cbd5e1",
                                    background: "#ffffff",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleMoveFileSubmit}
                                style={{
                                    padding: "6px 14px",
                                    borderRadius: "6px",
                                    border: "none",
                                    background: "#2563eb",
                                    color: "#ffffff",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                }}
                            >
                                Move
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
