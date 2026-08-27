import React, { useState, useEffect, useCallback, useRef } from "react";
import { fetchFoldersApi, fetchProjectFilesApi, createFolderApi, uploadFileApi, deleteFileApi, toggleFileLockApi } from "../services/projectApi";
import type { Folder, ProjectFile } from "../services/projectApi";
import { Folder as FiFolder, File as FiFile, Lock as FiLock, Unlock as FiUnlock, Trash2 as FiTrash2, Download as FiDownload, UploadCloud as FiUploadCloud, FolderPlus as FiFolderPlus, ChevronRight as FiChevronRight, Clock as FiClock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatDisplayDate } from "../services/projectApi";

interface FileBrowserProps {
    projectId: string;
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
                fetchProjectFilesApi(projectId, currentFolderId || undefined)
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
        if (!name) return;
        try {
            await createFolderApi(projectId, name, currentFolderId || undefined);
            loadData();
        } catch (err: any) {
            alert(err.message);
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
        try {
            await uploadFileApi(projectId, formData);
            loadData();
        } catch (err: any) {
            alert(err.message);
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
            alert(err.message);
        }
    };

    const handleToggleLock = async (fileId: string) => {
        try {
            await toggleFileLockApi(projectId, fileId);
            loadData();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const formatBytes = (bytes: string | number) => {
        const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
        if (b === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(b) / Math.log(k));
        return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const breadcrumbs = [];
    let currId = currentFolderId;
    while (currId) {
        const f = folders.find(fd => fd.id === currId);
        if (f) {
            breadcrumbs.unshift(f);
            currId = f.parentId;
        } else {
            break;
        }
    }

    const currentFolders = folders.filter(f => f.parentId === currentFolderId);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-[var(--surface-color)] text-[var(--text-color)]">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                <div className="flex items-center space-x-2 text-lg font-medium">
                    <button 
                        onClick={() => setCurrentFolderId(null)}
                        className="hover:text-[var(--primary-color)] transition-colors"
                    >
                        Files
                    </button>
                    {breadcrumbs.map(f => (
                        <React.Fragment key={f.id}>
                            <FiChevronRight className="text-[var(--text-muted)]" />
                            <button 
                                onClick={() => setCurrentFolderId(f.id)}
                                className="hover:text-[var(--primary-color)] transition-colors"
                            >
                                {f.name}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
                <div className="flex items-center space-x-3">
                    <button 
                        onClick={handleCreateFolder}
                        className="flex items-center px-3 py-1.5 text-sm font-medium bg-[var(--surface-hover)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--border-color)] transition-colors"
                    >
                        <FiFolderPlus className="mr-2" /> New Folder
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center px-3 py-1.5 text-sm font-medium bg-[var(--primary-color)] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
                    >
                        {uploading ? (
                            <span className="animate-spin mr-2 border-2 border-white border-t-transparent rounded-full w-4 h-4" />
                        ) : (
                            <FiUploadCloud className="mr-2" />
                        )}
                        Upload File
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                    />
                </div>
            </div>

            {error && (
                <div className="m-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md">
                    {error}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--primary-color)]"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {/* Folders */}
                        {currentFolders.map(folder => (
                            <div 
                                key={folder.id} 
                                onClick={() => setCurrentFolderId(folder.id)}
                                className="group flex flex-col p-4 bg-[var(--surface-hover)] border border-[var(--border-color)] rounded-xl cursor-pointer hover:border-[var(--primary-color)] transition-all"
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-500 rounded-lg">
                                        <FiFolder size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-semibold truncate">{folder.name}</h3>
                                        <p className="text-xs text-[var(--text-muted)]">
                                            {folder._count?.files || 0} files
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Files */}
                        {files.map(file => {
                            const latestVersion = file.versions?.[0];
                            const canEdit = !file.isLocked || file.lockedBy?.id === user?.id;

                            return (
                                <div 
                                    key={file.id} 
                                    className="group flex flex-col p-4 bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl hover:shadow-lg transition-all"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2 bg-[var(--surface-hover)] text-[var(--text-muted)] rounded-lg">
                                                <FiFile size={24} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-semibold truncate" title={file.name}>{file.name}</h3>
                                                <div className="flex items-center text-xs text-[var(--text-muted)] mt-1 space-x-2">
                                                    <span>v{latestVersion?.versionNum || 1}</span>
                                                    <span>•</span>
                                                    <span>{latestVersion ? formatBytes(latestVersion.sizeBytes) : "Unknown"}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="text-xs text-[var(--text-muted)] flex items-center">
                                            <FiClock className="mr-1" />
                                            {formatDisplayDate(file.updatedAt)}
                                        </div>
                                        
                                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleToggleLock(file.id)}
                                                className={`p-1.5 rounded-md transition-colors ${file.isLocked ? 'bg-amber-100 text-amber-600' : 'hover:bg-[var(--surface-hover)] text-[var(--text-muted)]'}`}
                                                title={file.isLocked ? `Locked by ${file.lockedBy?.firstName}` : 'Lock file'}
                                            >
                                                {file.isLocked ? <FiLock size={14} /> : <FiUnlock size={14} />}
                                            </button>
                                            
                                            <a 
                                                href={`/api/projects/${projectId}/files/${file.id}/download`}
                                                className="p-1.5 hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--primary-color)] rounded-md transition-colors"
                                                title="Download"
                                            >
                                                <FiDownload size={14} />
                                            </a>

                                            {canEdit && (
                                                <button
                                                    onClick={() => handleDeleteFile(file.id)}
                                                    className="p-1.5 hover:bg-red-100 text-[var(--text-muted)] hover:text-red-500 rounded-md transition-colors"
                                                    title="Delete"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Version History Info */}
                                    {file.versions?.length > 1 && (
                                        <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                                            <p className="text-xs text-[var(--text-muted)] flex justify-between">
                                                <span>Previous versions: {file.versions.length - 1}</span>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {currentFolders.length === 0 && files.length === 0 && (
                            <div className="col-span-full py-12 flex flex-col items-center justify-center text-[var(--text-muted)] border-2 border-dashed border-[var(--border-color)] rounded-xl">
                                <div className="p-4 bg-[var(--surface-hover)] rounded-full mb-3">
                                    <FiFolderPlus size={32} className="opacity-50" />
                                </div>
                                <h3 className="text-lg font-medium mb-1">This folder is empty</h3>
                                <p className="text-sm">Drag and drop files here or click "Upload File"</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
