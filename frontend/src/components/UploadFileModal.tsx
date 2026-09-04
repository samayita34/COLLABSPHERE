import React, { useState, useEffect, useRef } from "react";
import { fetchProjects, uploadFileApi, type MappedProject } from "../services/projectApi";
import { UploadCloud, X, AlertCircle, Loader2 } from "lucide-react";

interface UploadFileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onFileUploaded: () => void;
    workspaceId: string | undefined;
    defaultProjectId?: string;
    initialFile?: File | null;
}

function formatBytes(bytes: number) {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function UploadFileModal({
    isOpen,
    onClose,
    onFileUploaded,
    workspaceId,
    defaultProjectId,
    initialFile,
}: UploadFileModalProps) {
    const [projects, setProjects] = useState<MappedProject[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [customName, setCustomName] = useState("");
    const [description, setDescription] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Escape to close
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !uploading) onClose();
        };
        if (isOpen) {
            window.addEventListener("keydown", handler);
        }
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, uploading, onClose]);

    // Load projects when modal opens
    useEffect(() => {
        if (isOpen && workspaceId) {
            setLoadingProjects(true);
            setError(null);
            fetchProjects(workspaceId)
                .then((projs) => {
                    setProjects(projs);
                    if (defaultProjectId && projs.some((p) => p.id === defaultProjectId)) {
                        setSelectedProjectId(defaultProjectId);
                    } else if (projs.length > 0) {
                        setSelectedProjectId(projs[0].id);
                    }
                })
                .catch((err) => {
                    console.error("Failed to load projects:", err);
                    setError("Failed to load projects in this workspace.");
                })
                .finally(() => {
                    setLoadingProjects(false);
                });
        }
    }, [isOpen, workspaceId, defaultProjectId]);

    // Set initial file if provided (e.g. from drag & drop onto page)
    useEffect(() => {
        if (initialFile) {
            setSelectedFile(initialFile);
            setCustomName(initialFile.name);
        }
    }, [initialFile]);

    if (!isOpen) return null;

    const handleFileSelect = (file: File) => {
        setSelectedFile(file);
        setCustomName(file.name);
        setError(null);
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
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) {
            setError("Please select a file to upload.");
            return;
        }
        if (!selectedProjectId) {
            setError("Please select a target project.");
            return;
        }

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("name", (customName.trim() || selectedFile.name));
        if (description.trim()) {
            formData.append("description", description.trim());
        }

        try {
            await uploadFileApi(selectedProjectId, formData);
            onFileUploaded();
            handleClose();
        } catch (err: any) {
            console.error("Upload error:", err);
            setError(err.message || "Failed to upload file. Please check storage quota or file size.");
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        if (uploading) return;
        setSelectedFile(null);
        setCustomName("");
        setDescription("");
        setError(null);
        onClose();
    };

    return (
        <div className="modal-overlay" onMouseDown={handleClose}>
            <div
                className="task-modal"
                style={{ maxWidth: "540px", width: "100%" }}
                role="dialog"
                aria-modal="true"
                aria-label="Upload File"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="task-modal-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <UploadCloud size={20} color="#2563eb" />
                        <h3>Upload File</h3>
                    </div>
                    <button className="modal-close" onClick={handleClose} disabled={uploading} aria-label="Close" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="task-modal-body">
                    {error && (
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "10px 14px",
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            color: "#b91c1c",
                            borderRadius: "8px",
                            fontSize: "13px",
                            marginBottom: "16px"
                        }}>
                            <AlertCircle size={16} style={{ flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* File Dropzone */}
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
                                padding: "36px 20px",
                                textAlign: "center",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                marginBottom: "20px",
                            }}
                        >
                            <UploadCloud size={38} color={isDragging ? "#2563eb" : "#64748b"} style={{ margin: "0 auto 10px" }} />
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", marginBottom: "4px" }}>
                                Choose a file or drag & drop here
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748b" }}>
                                Supports PDF, DOC, Images, Spreadsheets, ZIP, and more
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        handleFileSelect(e.target.files[0]);
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 16px",
                            background: "#f1f5f9",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            marginBottom: "20px"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                                <div style={{
                                    width: "38px",
                                    height: "38px",
                                    background: "#e0e7ff",
                                    color: "#4338ca",
                                    borderRadius: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 700,
                                    fontSize: "12px",
                                    flexShrink: 0
                                }}>
                                    {selectedFile.name.split(".").pop()?.toUpperCase() || "FILE"}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {selectedFile.name}
                                    </div>
                                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                                        {formatBytes(selectedFile.size)}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedFile(null)}
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "#64748b",
                                    cursor: "pointer",
                                    padding: "4px",
                                    borderRadius: "4px",
                                }}
                                title="Remove file"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}

                    {/* Target Project Selection */}
                    <div className="modal-field">
                        <label htmlFor="target-project">Target Project *</label>
                        {loadingProjects ? (
                            <div style={{ fontSize: "13px", color: "#64748b", padding: "8px 0" }}>Loading projects...</div>
                        ) : projects.length === 0 ? (
                            <div style={{ fontSize: "13px", color: "#dc2626", padding: "8px 0" }}>
                                No projects found in this workspace. Please create a project first.
                            </div>
                        ) : (
                            <select
                                id="target-project"
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                required
                                style={{
                                    width: "100%",
                                    padding: "9px 12px",
                                    borderRadius: "6px",
                                    border: "1px solid #d1d5db",
                                    fontSize: "13.5px",
                                    background: "#ffffff",
                                    color: "#1e293b",
                                    outline: "none"
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

                    {/* Custom File Name */}
                    {selectedFile && (
                        <div className="modal-field">
                            <label htmlFor="custom-file-name">Display Name (optional)</label>
                            <input
                                id="custom-file-name"
                                type="text"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                placeholder={selectedFile.name}
                            />
                        </div>
                    )}

                    {/* Description */}
                    <div className="modal-field">
                        <label htmlFor="file-description">Description (optional)</label>
                        <textarea
                            id="file-description"
                            rows={2}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add context or notes about this file..."
                        />
                    </div>

                    <div className="modal-actions" style={{ marginTop: "24px" }}>
                        <button type="button" className="btn-secondary" onClick={handleClose} disabled={uploading}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={uploading || !selectedFile || !selectedProjectId}
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                            {uploading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Uploading...</span>
                                </>
                            ) : (
                                <>
                                    <UploadCloud size={16} />
                                    <span>Upload File</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default UploadFileModal;
