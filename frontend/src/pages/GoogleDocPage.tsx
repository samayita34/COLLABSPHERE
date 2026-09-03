import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Extension } from "@tiptap/core";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

import { useAuth } from "../context/AuthContext";
import {
    fetchDocumentByIdApi,
    updateDocumentApi,
    fetchDocumentVersionsApi,
    createDocumentVersionApi,
    restoreDocumentVersionApi,
    type DocumentWithProject,
    type DocumentVersion,
} from "../services/projectApi";

import {
    FileText,
    ChevronDown,
    Share2,
    History,
    MessageSquare,
    Undo2,
    Redo2,
    Printer,
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Strikethrough,
    Highlighter,
    Link as LinkIcon,
    Image as ImageIcon,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    List,
    ListOrdered,
    CheckSquare,
    Indent,
    Outdent,
    Quote,
    Code,
    Table as TableIcon,
    Search,
    Copy,
    Plus,
    Check,
    X,
    Lock,
    Globe,
    Cloud,
    ArrowLeft,
} from "lucide-react";

import "./GoogleDocPage.css";

/* ==========================================================================
   CUSTOM EXTENSIONS (FontSize, LineHeight)
   ========================================================================== */

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        fontSize: {
            setFontSize: (size: string) => ReturnType;
            unsetFontSize: () => ReturnType;
        };
        lineHeight: {
            setLineHeight: (height: string) => ReturnType;
            unsetLineHeight: () => ReturnType;
        };
    }
}

const FontSize = Extension.create({
    name: "fontSize",
    addOptions() {
        return { types: ["textStyle"] };
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, "") || null,
                        renderHTML: (attributes) => {
                            if (!attributes.fontSize) return {};
                            return { style: `font-size: ${attributes.fontSize}` };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setFontSize: (fontSize: string) => ({ chain }) =>
                chain().setMark("textStyle", { fontSize }).run(),
            unsetFontSize: () => ({ chain }) =>
                chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
        };
    },
});

const LineHeight = Extension.create({
    name: "lineHeight",
    addOptions() {
        return { types: ["paragraph", "heading"] };
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    lineHeight: {
                        default: null,
                        parseHTML: (element) => element.style.lineHeight || null,
                        renderHTML: (attributes) => {
                            if (!attributes.lineHeight) return {};
                            return { style: `line-height: ${attributes.lineHeight}` };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setLineHeight: (lineHeight: string) => ({ commands }) => {
                return this.options.types.some((type: string) =>
                    commands.updateAttributes(type, { lineHeight })
                );
            },
            unsetLineHeight: () => ({ commands }) => {
                return this.options.types.some((type: string) =>
                    commands.updateAttributes(type, { lineHeight: null })
                );
            },
        };
    },
});

/* ==========================================================================
   CONSTANTS & HELPERS
   ========================================================================== */

const USER_COLORS = [
    "#ea4335", "#4285f4", "#34a853", "#fbbc05",
    "#9333ea", "#ec4899", "#06b6d4", "#f97316",
    "#10b981", "#6366f1", "#14b8a6", "#8b5cf6",
];

function getUserColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

const TEXT_COLORS = [
    "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc",
    "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff",
    "#4a86e8", "#0000ff", "#9900ff", "#ff00ff", "#1a73e8", "#0d904f",
];

const HIGHLIGHT_COLORS = [
    "#ffff00", "#00ff00", "#00ffff", "#ff00ff", "#0000ff", "#ff0000",
    "#fff2cc", "#d9ead3", "#c9daf8", "#f4cccc", "#d0e0e3", "#ead1dc",
];

const FONT_FAMILIES = [
    "Arial",
    "Inter",
    "Roboto",
    "Times New Roman",
    "Georgia",
    "Courier New",
    "Verdana",
    "Comic Sans MS",
];

const getWsBaseUrl = () => {
    const configuredWsUrl = import.meta.env.VITE_WS_URL;
    if (configuredWsUrl) {
        return configuredWsUrl
            .replace(/\/api\/collaboration\/?$/, "")
            .replace(/\/api\/?$/, "")
            .replace(/\/$/, "");
    }
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    return apiUrl
        .replace(/\/api\/collaboration\/?$/, "")
        .replace(/\/api\/?$/, "")
        .replace(/^http:/, "ws:")
        .replace(/^https:/, "wss:")
        .replace(/\/$/, "");
};

interface CollaboratorInfo {
    id?: string;
    name: string;
    email?: string;
    initials: string;
    color: string;
}

interface DocComment {
    id: string;
    author: string;
    initials: string;
    color: string;
    text: string;
    quote?: string;
    timestamp: string;
    resolved: boolean;
    replies: Array<{
        id: string;
        author: string;
        initials: string;
        text: string;
        timestamp: string;
    }>;
}

/* ==========================================================================
   MAIN GOOGLE DOC COMPONENT
   ========================================================================== */

export default function GoogleDocPage() {
    const { id: documentId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, userFullName, userInitials } = useAuth();

    // Document state
    const [docData, setDocData] = useState<DocumentWithProject | null>(null);
    const [docTitle, setDocTitle] = useState("Untitled Document");
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Collaboration & Awareness
    const [_provider, setProvider] = useState<WebsocketProvider | null>(null);
    const [saveStatus, setSaveStatus] = useState<"synced" | "syncing" | "offline">("syncing");
    const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);

    // Editor UI state
    const [isReadonly, setIsReadonly] = useState(false);
    const [showRuler, setShowRuler] = useState(true);
    const [zoomLevel, setZoomLevel] = useState(100);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [selectedFont, setSelectedFont] = useState("Arial");
    const [fontSize, setFontSize] = useState(11);
    const [showTextColorPicker, setShowTextColorPicker] = useState(false);
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);
    const [showAlignPicker, setShowAlignPicker] = useState(false);
    const [showLineSpacingPicker, setShowLineSpacingPicker] = useState(false);
    const [showTablePicker, setShowTablePicker] = useState(false);

    // Drawers & Modals
    const [showShareModal, setShowShareModal] = useState(false);
    const [copiedShareLink, setCopiedShareLink] = useState(false);
    const [showVersionDrawer, setShowVersionDrawer] = useState(false);
    const [versions, setVersions] = useState<DocumentVersion[]>([]);
    const [isLoadingVersions, setIsLoadingVersions] = useState(false);
    const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);
    const [comments, setComments] = useState<DocComment[]>([]);
    const [newCommentText, setNewCommentText] = useState("");
    const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
    const [showFindReplaceModal, setShowFindReplaceModal] = useState(false);
    const [findQuery, setFindQuery] = useState("");
    const [replaceQuery, setReplaceQuery] = useState("");
    const [showWordCountModal, setShowWordCountModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [imageUrlInput, setImageUrlInput] = useState("");

    const localColor = useMemo(() => {
        return getUserColor(user?.id || userFullName || "Guest");
    }, [user?.id, userFullName]);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest(".gdoc-menu-item")) {
                setActiveMenu(null);
            }
            if (!target.closest(".gdoc-palette-popover") && !target.closest(".gdoc-color-btn")) {
                setShowTextColorPicker(false);
                setShowHighlightPicker(false);
            }
            if (!target.closest(".gdoc-align-popover") && !target.closest(".gdoc-align-btn")) {
                setShowAlignPicker(false);
            }
            if (!target.closest(".gdoc-linespacing-popover") && !target.closest(".gdoc-linespacing-btn")) {
                setShowLineSpacingPicker(false);
            }
            if (!target.closest(".gdoc-table-picker") && !target.closest(".gdoc-table-btn")) {
                setShowTablePicker(false);
            }
        };
        window.addEventListener("mousedown", handleClickOutside);
        return () => window.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 1. Fetch document metadata
    useEffect(() => {
        if (!documentId) return;
        setIsLoading(true);
        fetchDocumentByIdApi(documentId)
            .then((data) => {
                setDocData(data);
                setDocTitle(data.name || "Untitled Document");
                setLoadError(null);
            })
            .catch((err) => {
                console.error("Failed to load document:", err);
                setLoadError(err.message || "Failed to load document");
            })
            .finally(() => setIsLoading(false));
    }, [documentId]);

    // Load persistent comments from localStorage keyed by documentId
    useEffect(() => {
        if (!documentId) return;
        const stored = localStorage.getItem(`gdoc_comments_${documentId}`);
        if (stored) {
            try {
                setComments(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse comments", e);
            }
        }
    }, [documentId]);

    const saveComments = (newComments: DocComment[]) => {
        setComments(newComments);
        if (documentId) {
            localStorage.setItem(`gdoc_comments_${documentId}`, JSON.stringify(newComments));
        }
    };

    // 2. Setup Y.Doc and Y-WebSocket Provider
    const ydoc = useMemo(() => new Y.Doc(), [documentId]);

    useEffect(() => {
        if (!documentId) return;

        let wsProvider: WebsocketProvider | null = null;
        try {
            const wsBaseUrl = getWsBaseUrl();
            const collaborationUrl = `${wsBaseUrl}/api/collaboration`;

            wsProvider = new WebsocketProvider(collaborationUrl, documentId, ydoc, {
                connect: true,
            });

            // Awareness: broadcast current user identity
            const awareness = wsProvider.awareness;
            awareness.setLocalStateField("user", {
                id: user?.id || "guest",
                name: userFullName || "Guest User",
                email: user?.email || "",
                initials: userInitials || "U",
                color: localColor,
            });

            const handleAwarenessChange = () => {
                const states = Array.from(awareness.getStates().values());
                const active = states
                    .map((s: any) => s.user)
                    .filter((u): u is CollaboratorInfo => Boolean(u && u.name));
                setCollaborators(active);
            };

            awareness.on("change", handleAwarenessChange);

            wsProvider.on("status", (event: { status: string }) => {
                if (event.status === "connected") {
                    setSaveStatus("synced");
                } else {
                    setSaveStatus("offline");
                }
            });

            wsProvider.on("sync", (synced: boolean) => {
                if (synced) setSaveStatus("synced");
            });

            setProvider(wsProvider);

            return () => {
                awareness.off("change", handleAwarenessChange);
                wsProvider?.destroy();
                setProvider(null);
            };
        } catch (err) {
            console.error("Yjs WebSocket provider error:", err);
            setSaveStatus("offline");
        }
    }, [documentId, ydoc, user?.id, userFullName, userInitials, localColor]);

    // Track unsaved typing status
    useEffect(() => {
        const handleUpdate = () => {
            setSaveStatus("syncing");
            const timer = setTimeout(() => {
                setSaveStatus("synced");
            }, 1200);
            return () => clearTimeout(timer);
        };
        ydoc.on("update", handleUpdate);
        return () => {
            ydoc.off("update", handleUpdate);
        };
    }, [ydoc]);

    // 3. TipTap Editor Initialization
    const extensions = useMemo(() => {
        return [
            StarterKit.configure({
                undoRedo: false, // Yjs handles undo/redo
            }),
            Collaboration.configure({
                document: ydoc,
            }),
            Underline,
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
            Highlight.configure({
                multicolor: true,
            }),
            TextStyle,
            Color,
            FontFamily,
            FontSize,
            LineHeight,
            Subscript,
            Superscript,
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Image.configure({
                inline: true,
                allowBase64: true,
            }),
            LinkExtension.configure({
                openOnClick: false,
                HTMLAttributes: {
                    target: "_blank",
                    rel: "noopener noreferrer",
                },
            }),
            Placeholder.configure({
                placeholder: "Type '@' to insert, or start writing your thoughts...",
            }),
            CharacterCount,
        ];
    }, [ydoc]);

    const editor = useEditor(
        {
            extensions,
            editable: !isReadonly,
            editorProps: {
                attributes: {
                    class: "gdoc-editor",
                },
            },
        },
        [ydoc, isReadonly]
    );

    // Sync font size stepper with editor
    const updateFontSize = (delta: number) => {
        if (!editor) return;
        const newSize = Math.max(8, Math.min(72, fontSize + delta));
        setFontSize(newSize);
        editor.chain().focus().setFontSize(`${newSize}pt`).run();
    };

    // Rename document inline
    const handleTitleBlur = () => {
        if (!documentId || !docTitle.trim()) return;
        updateDocumentApi(documentId, { name: docTitle.trim() })
            .then((updated) => {
                setDocData((prev) => (prev ? { ...prev, name: updated.name } : null));
            })
            .catch((err) => console.error("Failed to rename document:", err));
    };

    // Export Handlers
    const handleDownload = (format: "pdf" | "doc" | "md" | "txt") => {
        if (!editor) return;
        const filename = `${docTitle.trim().replace(/\s+/g, "_") || "document"}`;

        if (format === "pdf") {
            window.print();
        } else if (format === "doc") {
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title></head><body>${editor.getHTML()}</body></html>`;
            const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${filename}.doc`;
            a.click();
            URL.revokeObjectURL(url);
        } else if (format === "md") {
            const text = editor.getText();
            const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${filename}.md`;
            a.click();
            URL.revokeObjectURL(url);
        } else if (format === "txt") {
            const text = editor.getText();
            const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${filename}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    // Version History Handlers
    const loadVersions = async () => {
        if (!documentId) return;
        setIsLoadingVersions(true);
        try {
            const list = await fetchDocumentVersionsApi(documentId);
            setVersions(list);
        } catch (err) {
            console.error("Failed to fetch versions:", err);
        } finally {
            setIsLoadingVersions(false);
        }
    };

    const handleCreateVersion = async () => {
        if (!documentId) return;
        const name = prompt("Enter a name for this version snapshot:");
        if (!name) return;
        try {
            await createDocumentVersionApi(documentId, name.trim());
            loadVersions();
        } catch (err: any) {
            alert(err.message || "Failed to create version");
        }
    };

    const handleRestoreVersion = async (v: DocumentVersion) => {
        if (!documentId) return;
        if (!confirm(`Restore document to "${v.name}"? This will overwrite the live document.`)) return;
        try {
            await restoreDocumentVersionApi(documentId, v.id);
            alert("Restored successfully! Refreshing view...");
            window.location.reload();
        } catch (err: any) {
            alert(err.message || "Failed to restore version");
        }
    };

    // Comments Handlers
    const handleAddComment = () => {
        if (!newCommentText.trim() || !editor) return;
        const selectedText = editor.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to,
            " "
        );

        const newComment: DocComment = {
            id: `c_${Date.now()}`,
            author: userFullName || "Guest",
            initials: userInitials || "G",
            color: localColor,
            text: newCommentText.trim(),
            quote: selectedText ? `"${selectedText}"` : undefined,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            resolved: false,
            replies: [],
        };

        saveComments([newComment, ...comments]);
        setNewCommentText("");
    };

    const handleAddReply = (commentId: string) => {
        const text = replyTextMap[commentId];
        if (!text || !text.trim()) return;

        const updated = comments.map((c) => {
            if (c.id === commentId) {
                return {
                    ...c,
                    replies: [
                        ...c.replies,
                        {
                            id: `r_${Date.now()}`,
                            author: userFullName || "Guest",
                            initials: userInitials || "G",
                            text: text.trim(),
                            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        },
                    ],
                };
            }
            return c;
        });

        saveComments(updated);
        setReplyTextMap((prev) => ({ ...prev, [commentId]: "" }));
    };

    const toggleResolveComment = (commentId: string) => {
        const updated = comments.map((c) =>
            c.id === commentId ? { ...c, resolved: !c.resolved } : c
        );
        saveComments(updated);
    };

    const deleteComment = (commentId: string) => {
        saveComments(comments.filter((c) => c.id !== commentId));
    };

    // Insert Image Handler
    const handleInsertImage = () => {
        if (!imageUrlInput.trim() || !editor) return;
        editor.chain().focus().setImage({ src: imageUrlInput.trim() }).run();
        setImageUrlInput("");
        setShowImageModal(false);
    };

    const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !editor) return;
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            if (reader.result) {
                editor.chain().focus().setImage({ src: reader.result as string }).run();
                setShowImageModal(false);
            }
        };
        reader.readAsDataURL(file);
    };

    // Copy Share Link
    const handleCopyShareLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            setCopiedShareLink(true);
            setTimeout(() => setCopiedShareLink(false), 2500);
        });
    };

    if (isLoading) {
        return (
            <div className="gdoc-page flex items-center justify-center">
                <div style={{ textAlign: "center", color: "#5f6368" }}>
                    <div style={{ marginBottom: "16px" }}>
                        <Cloud className="animate-pulse" size={48} color="#1a73e8" />
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 500 }}>Opening Google Doc...</div>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="gdoc-page flex items-center justify-center p-4">
                <div style={{ maxWidth: "420px", textAlign: "center", background: "#ffffff", padding: "32px", borderRadius: "12px", boxShadow: "var(--gdoc-shadow)" }}>
                    <FileText size={48} color="#dc2626" style={{ margin: "0 auto 16px" }} />
                    <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#111827", marginBottom: "8px" }}>
                        Document Not Found or Inaccessible
                    </h2>
                    <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px" }}>
                        {loadError}
                    </p>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            background: "#1a73e8",
                            color: "#ffffff",
                            padding: "8px 18px",
                            borderRadius: "6px",
                            border: "none",
                            fontWeight: 500,
                            cursor: "pointer",
                        }}
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="gdoc-page">
            {/* ==========================================================================
               TOP APPLICATION HEADER
               ========================================================================== */}
            <header className="gdoc-header">
                <div className="gdoc-header-left">
                    <button
                        className="gdoc-doc-icon"
                        onClick={() => {
                            if (docData?.projectId) {
                                navigate(`/projects/${docData.projectId}`);
                            } else {
                                navigate("/documents");
                            }
                        }}
                        title="Back to workspace"
                    >
                        <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
                            <rect width="40" height="40" rx="8" fill="#4285F4" />
                            <path d="M12 10H23L30 17V30H12V10Z" fill="white" />
                            <path d="M23 10V17H30L23 10Z" fill="#A1C2FA" />
                            <rect x="15" y="19" width="12" height="2" rx="1" fill="#4285F4" />
                            <rect x="15" y="23" width="12" height="2" rx="1" fill="#4285F4" />
                            <rect x="15" y="27" width="8" height="2" rx="1" fill="#4285F4" />
                        </svg>
                    </button>

                    <div className="gdoc-header-details">
                        <div className="gdoc-title-row">
                            <input
                                type="text"
                                className="gdoc-title-input"
                                value={docTitle}
                                onChange={(e) => setDocTitle(e.target.value)}
                                onBlur={handleTitleBlur}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                }}
                                title="Click to rename"
                            />

                            {docData?.projectName && (
                                <Link
                                    to={`/projects/${docData.projectId}`}
                                    className="gdoc-folder-badge"
                                    title={`In Project: ${docData.projectName}`}
                                >
                                    <ArrowLeft size={12} />
                                    <span>{docData.projectName}</span>
                                </Link>
                            )}

                            {/* Cloud Sync Status */}
                            <div className={`gdoc-save-status ${saveStatus}`}>
                                {saveStatus === "synced" && (
                                    <>
                                        <Cloud size={14} />
                                        <span>Saved to Cloud</span>
                                    </>
                                )}
                                {saveStatus === "syncing" && (
                                    <>
                                        <Cloud size={14} className="animate-pulse" />
                                        <span>Saving changes...</span>
                                    </>
                                )}
                                {saveStatus === "offline" && (
                                    <>
                                        <Cloud size={14} color="#d97706" />
                                        <span>Offline</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Menu Bar (File, Edit, View, Insert, Format, Tools) */}
                        <div className="gdoc-menubar">
                            {/* File Menu */}
                            <div className="gdoc-menu-item">
                                <button
                                    className={`gdoc-menu-trigger ${activeMenu === "file" ? "active" : ""}`}
                                    onClick={() => setActiveMenu(activeMenu === "file" ? null : "file")}
                                >
                                    File
                                </button>
                                {activeMenu === "file" && (
                                    <div className="gdoc-dropdown-menu">
                                        <button className="gdoc-menu-option" onClick={() => navigate("/documents")}>
                                            <span className="gdoc-menu-option-label">New document</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => handleDownload("doc")}>
                                            <span className="gdoc-menu-option-label">Download as Word (.doc)</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => handleDownload("pdf")}>
                                            <span className="gdoc-menu-option-label">Download as PDF</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => handleDownload("md")}>
                                            <span className="gdoc-menu-option-label">Download Markdown (.md)</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => handleDownload("txt")}>
                                            <span className="gdoc-menu-option-label">Download Plain text (.txt)</span>
                                        </button>
                                        <div className="gdoc-menu-divider" />
                                        <button className="gdoc-menu-option" onClick={() => {
                                            setActiveMenu(null);
                                            setShowVersionDrawer(true);
                                            loadVersions();
                                        }}>
                                            <span className="gdoc-menu-option-label">Version history</span>
                                        </button>
                                        <div className="gdoc-menu-divider" />
                                        <button className="gdoc-menu-option" onClick={() => window.print()}>
                                            <span className="gdoc-menu-option-label">Print</span>
                                            <span className="gdoc-menu-shortcut">Ctrl+P</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Edit Menu */}
                            <div className="gdoc-menu-item">
                                <button
                                    className={`gdoc-menu-trigger ${activeMenu === "edit" ? "active" : ""}`}
                                    onClick={() => setActiveMenu(activeMenu === "edit" ? null : "edit")}
                                >
                                    Edit
                                </button>
                                {activeMenu === "edit" && (
                                    <div className="gdoc-dropdown-menu">
                                        <button className="gdoc-menu-option" onClick={() => editor?.chain().focus().undo().run()}>
                                            <span className="gdoc-menu-option-label">Undo</span>
                                            <span className="gdoc-menu-shortcut">Ctrl+Z</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => editor?.chain().focus().redo().run()}>
                                            <span className="gdoc-menu-option-label">Redo</span>
                                            <span className="gdoc-menu-shortcut">Ctrl+Y</span>
                                        </button>
                                        <div className="gdoc-menu-divider" />
                                        <button className="gdoc-menu-option" onClick={() => editor?.chain().focus().selectAll().run()}>
                                            <span className="gdoc-menu-option-label">Select all</span>
                                            <span className="gdoc-menu-shortcut">Ctrl+A</span>
                                        </button>
                                        <div className="gdoc-menu-divider" />
                                        <button className="gdoc-menu-option" onClick={() => {
                                            setActiveMenu(null);
                                            setShowFindReplaceModal(true);
                                        }}>
                                            <span className="gdoc-menu-option-label">Find and replace</span>
                                            <span className="gdoc-menu-shortcut">Ctrl+H</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* View Menu */}
                            <div className="gdoc-menu-item">
                                <button
                                    className={`gdoc-menu-trigger ${activeMenu === "view" ? "active" : ""}`}
                                    onClick={() => setActiveMenu(activeMenu === "view" ? null : "view")}
                                >
                                    View
                                </button>
                                {activeMenu === "view" && (
                                    <div className="gdoc-dropdown-menu">
                                        <button className="gdoc-menu-option" onClick={() => setIsReadonly(!isReadonly)}>
                                            <span className="gdoc-menu-option-label">
                                                Mode: {isReadonly ? "Viewing (Read-only)" : "Editing"}
                                            </span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => setShowRuler(!showRuler)}>
                                            <span className="gdoc-menu-option-label">
                                                {showRuler ? "Hide ruler" : "Show ruler"}
                                            </span>
                                        </button>
                                        <div className="gdoc-menu-divider" />
                                        <button className="gdoc-menu-option" onClick={() => {
                                            setActiveMenu(null);
                                            setShowWordCountModal(true);
                                        }}>
                                            <span className="gdoc-menu-option-label">Word count</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Insert Menu */}
                            <div className="gdoc-menu-item">
                                <button
                                    className={`gdoc-menu-trigger ${activeMenu === "insert" ? "active" : ""}`}
                                    onClick={() => setActiveMenu(activeMenu === "insert" ? null : "insert")}
                                >
                                    Insert
                                </button>
                                {activeMenu === "insert" && (
                                    <div className="gdoc-dropdown-menu">
                                        <button className="gdoc-menu-option" onClick={() => {
                                            setActiveMenu(null);
                                            setShowImageModal(true);
                                        }}>
                                            <span className="gdoc-menu-option-label">Image</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => {
                                            editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                                            setActiveMenu(null);
                                        }}>
                                            <span className="gdoc-menu-option-label">Table (3x3)</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => {
                                            const url = prompt("Enter URL:");
                                            if (url) editor?.chain().focus().setLink({ href: url }).run();
                                            setActiveMenu(null);
                                        }}>
                                            <span className="gdoc-menu-option-label">Link</span>
                                        </button>
                                        <div className="gdoc-menu-divider" />
                                        <button className="gdoc-menu-option" onClick={() => {
                                            editor?.chain().focus().setHorizontalRule().run();
                                            setActiveMenu(null);
                                        }}>
                                            <span className="gdoc-menu-option-label">Horizontal line</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => {
                                            editor?.chain().focus().toggleTaskList().run();
                                            setActiveMenu(null);
                                        }}>
                                            <span className="gdoc-menu-option-label">Checkbox list</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => {
                                            editor?.chain().focus().toggleBlockquote().run();
                                            setActiveMenu(null);
                                        }}>
                                            <span className="gdoc-menu-option-label">Quote callout</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => {
                                            editor?.chain().focus().toggleCodeBlock().run();
                                            setActiveMenu(null);
                                        }}>
                                            <span className="gdoc-menu-option-label">Code block</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Format Menu */}
                            <div className="gdoc-menu-item">
                                <button
                                    className={`gdoc-menu-trigger ${activeMenu === "format" ? "active" : ""}`}
                                    onClick={() => setActiveMenu(activeMenu === "format" ? null : "format")}
                                >
                                    Format
                                </button>
                                {activeMenu === "format" && (
                                    <div className="gdoc-dropdown-menu">
                                        <button className="gdoc-menu-option" onClick={() => editor?.chain().focus().toggleBold().run()}>
                                            <span className="gdoc-menu-option-label">Bold</span>
                                            <span className="gdoc-menu-shortcut">Ctrl+B</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => editor?.chain().focus().toggleItalic().run()}>
                                            <span className="gdoc-menu-option-label">Italic</span>
                                            <span className="gdoc-menu-shortcut">Ctrl+I</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => editor?.chain().focus().toggleUnderline().run()}>
                                            <span className="gdoc-menu-option-label">Underline</span>
                                            <span className="gdoc-menu-shortcut">Ctrl+U</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => editor?.chain().focus().toggleStrike().run()}>
                                            <span className="gdoc-menu-option-label">Strikethrough</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => editor?.chain().focus().toggleSubscript().run()}>
                                            <span className="gdoc-menu-option-label">Subscript</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => editor?.chain().focus().toggleSuperscript().run()}>
                                            <span className="gdoc-menu-option-label">Superscript</span>
                                        </button>
                                        <div className="gdoc-menu-divider" />
                                        <button className="gdoc-menu-option" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}>
                                            <span className="gdoc-menu-option-label">Clear formatting</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Tools Menu */}
                            <div className="gdoc-menu-item">
                                <button
                                    className={`gdoc-menu-trigger ${activeMenu === "tools" ? "active" : ""}`}
                                    onClick={() => setActiveMenu(activeMenu === "tools" ? null : "tools")}
                                >
                                    Tools
                                </button>
                                {activeMenu === "tools" && (
                                    <div className="gdoc-dropdown-menu">
                                        <button className="gdoc-menu-option" onClick={() => {
                                            setActiveMenu(null);
                                            setShowWordCountModal(true);
                                        }}>
                                            <span className="gdoc-menu-option-label">Word count</span>
                                        </button>
                                        <button className="gdoc-menu-option" onClick={() => {
                                            setActiveMenu(null);
                                            setShowFindReplaceModal(true);
                                        }}>
                                            <span className="gdoc-menu-option-label">Find and replace</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Action Bar */}
                <div className="gdoc-header-right">
                    {/* Live Collaborators Presence */}
                    <div className="gdoc-collaborators-list">
                        {collaborators.map((c, i) => (
                            <div
                                key={c.id || i}
                                className="gdoc-collaborator-avatar"
                                style={{ backgroundColor: c.color }}
                                title={`${c.name} (${c.email || "Active"})`}
                            >
                                {c.initials}
                            </div>
                        ))}
                    </div>

                    {/* Version History Button */}
                    <button
                        className={`gdoc-icon-btn ${showVersionDrawer ? "active" : ""}`}
                        onClick={() => {
                            setShowVersionDrawer(!showVersionDrawer);
                            if (!showVersionDrawer) loadVersions();
                        }}
                        title="Version history"
                    >
                        <History size={18} />
                    </button>

                    {/* Comments Button */}
                    <button
                        className={`gdoc-icon-btn ${showCommentsDrawer ? "active" : ""}`}
                        onClick={() => setShowCommentsDrawer(!showCommentsDrawer)}
                        title="Open comments"
                    >
                        <MessageSquare size={18} />
                        {comments.filter((c) => !c.resolved).length > 0 && (
                            <span className="badge">
                                {comments.filter((c) => !c.resolved).length}
                            </span>
                        )}
                    </button>

                    {/* Share Button */}
                    <button
                        className="gdoc-share-btn"
                        onClick={() => setShowShareModal(true)}
                        title="Share with project members"
                    >
                        <Lock size={15} />
                        <span>Share</span>
                    </button>

                    {/* User profile avatar */}
                    <div
                        style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: localColor,
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "13px",
                            fontWeight: 600,
                        }}
                        title={userFullName || "User"}
                    >
                        {userInitials || "U"}
                    </div>
                </div>
            </header>

            {/* ==========================================================================
               FORMATTING ACTION TOOLBAR
               ========================================================================== */}
            <div className="gdoc-toolbar-container">
                <div className="gdoc-toolbar">
                    {/* Undo / Redo */}
                    <button
                        type="button"
                        className="gdoc-toolbar-btn"
                        onClick={() => editor?.chain().focus().undo().run()}
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 size={16} />
                    </button>
                    <button
                        type="button"
                        className="gdoc-toolbar-btn"
                        onClick={() => editor?.chain().focus().redo().run()}
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 size={16} />
                    </button>
                    <button
                        type="button"
                        className="gdoc-toolbar-btn"
                        onClick={() => window.print()}
                        title="Print (Ctrl+P)"
                    >
                        <Printer size={16} />
                    </button>

                    <div className="gdoc-toolbar-separator" />

                    {/* Zoom selector */}
                    <select
                        className="gdoc-toolbar-select"
                        value={zoomLevel}
                        onChange={(e) => setZoomLevel(Number(e.target.value))}
                        title="Zoom"
                    >
                        <option value={50}>50%</option>
                        <option value={75}>75%</option>
                        <option value={90}>90%</option>
                        <option value={100}>100%</option>
                        <option value={125}>125%</option>
                        <option value={150}>150%</option>
                    </select>

                    <div className="gdoc-toolbar-separator" />

                    {/* Paragraph / Heading Style Selector */}
                    <select
                        className="gdoc-toolbar-select"
                        value={
                            editor?.isActive("heading", { level: 1 })
                                ? "h1"
                                : editor?.isActive("heading", { level: 2 })
                                ? "h2"
                                : editor?.isActive("heading", { level: 3 })
                                ? "h3"
                                : "p"
                        }
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === "h1") editor?.chain().focus().toggleHeading({ level: 1 }).run();
                            else if (val === "h2") editor?.chain().focus().toggleHeading({ level: 2 }).run();
                            else if (val === "h3") editor?.chain().focus().toggleHeading({ level: 3 }).run();
                            else editor?.chain().focus().setParagraph().run();
                        }}
                        title="Styles"
                    >
                        <option value="p">Normal text</option>
                        <option value="h1">Heading 1</option>
                        <option value="h2">Heading 2</option>
                        <option value="h3">Heading 3</option>
                    </select>

                    {/* Font Family Selector */}
                    <select
                        className="gdoc-toolbar-select"
                        value={selectedFont}
                        onChange={(e) => {
                            const font = e.target.value;
                            setSelectedFont(font);
                            editor?.chain().focus().setFontFamily(font).run();
                        }}
                        title="Font"
                    >
                        {FONT_FAMILIES.map((f) => (
                            <option key={f} value={f}>
                                {f}
                            </option>
                        ))}
                    </select>

                    <div className="gdoc-toolbar-separator" />

                    {/* Font Size Stepper */}
                    <div className="gdoc-stepper" title="Font size">
                        <button type="button" className="gdoc-stepper-btn" onClick={() => updateFontSize(-1)}>
                            -
                        </button>
                        <span className="gdoc-stepper-val">{fontSize}</span>
                        <button type="button" className="gdoc-stepper-btn" onClick={() => updateFontSize(1)}>
                            +
                        </button>
                    </div>

                    <div className="gdoc-toolbar-separator" />

                    {/* Bold, Italic, Underline, Strike */}
                    <button
                        type="button"
                        className={`gdoc-toolbar-btn ${editor?.isActive("bold") ? "active" : ""}`}
                        onClick={() => editor?.chain().focus().toggleBold().run()}
                        title="Bold (Ctrl+B)"
                    >
                        <Bold size={16} />
                    </button>
                    <button
                        type="button"
                        className={`gdoc-toolbar-btn ${editor?.isActive("italic") ? "active" : ""}`}
                        onClick={() => editor?.chain().focus().toggleItalic().run()}
                        title="Italic (Ctrl+I)"
                    >
                        <Italic size={16} />
                    </button>
                    <button
                        type="button"
                        className={`gdoc-toolbar-btn ${editor?.isActive("underline") ? "active" : ""}`}
                        onClick={() => editor?.chain().focus().toggleUnderline().run()}
                        title="Underline (Ctrl+U)"
                    >
                        <UnderlineIcon size={16} />
                    </button>
                    <button
                        type="button"
                        className={`gdoc-toolbar-btn ${editor?.isActive("strike") ? "active" : ""}`}
                        onClick={() => editor?.chain().focus().toggleStrike().run()}
                        title="Strikethrough"
                    >
                        <Strikethrough size={16} />
                    </button>

                    {/* Text Color Picker */}
                    <div className="relative">
                        <button
                            type="button"
                            className="gdoc-toolbar-btn gdoc-color-btn"
                            onClick={() => setShowTextColorPicker(!showTextColorPicker)}
                            title="Text color"
                        >
                            <span style={{ fontWeight: 700, fontSize: "14px" }}>A</span>
                            <div className="gdoc-color-strip" style={{ backgroundColor: "#000000" }} />
                        </button>
                        {showTextColorPicker && (
                            <div className="gdoc-palette-popover">
                                {TEXT_COLORS.map((c) => (
                                    <div
                                        key={c}
                                        className="gdoc-palette-color"
                                        style={{ backgroundColor: c }}
                                        onClick={() => {
                                            editor?.chain().focus().setColor(c).run();
                                            setShowTextColorPicker(false);
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Highlight Marker */}
                    <div className="relative">
                        <button
                            type="button"
                            className={`gdoc-toolbar-btn ${editor?.isActive("highlight") ? "active" : ""}`}
                            onClick={() => setShowHighlightPicker(!showHighlightPicker)}
                            title="Highlight color"
                        >
                            <Highlighter size={16} />
                        </button>
                        {showHighlightPicker && (
                            <div className="gdoc-palette-popover">
                                {HIGHLIGHT_COLORS.map((c) => (
                                    <div
                                        key={c}
                                        className="gdoc-palette-color"
                                        style={{ backgroundColor: c }}
                                        onClick={() => {
                                            editor?.chain().focus().toggleHighlight({ color: c }).run();
                                            setShowHighlightPicker(false);
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="gdoc-toolbar-separator" />

                    {/* Link & Image */}
                    <button
                        type="button"
                        className={`gdoc-toolbar-btn ${editor?.isActive("link") ? "active" : ""}`}
                        onClick={() => {
                            const url = prompt("Enter link URL:");
                            if (url) editor?.chain().focus().setLink({ href: url }).run();
                        }}
                        title="Insert link (Ctrl+K)"
                    >
                        <LinkIcon size={16} />
                    </button>
                    <button
                        type="button"
                        className="gdoc-toolbar-btn"
                        onClick={() => setShowImageModal(true)}
                        title="Insert image"
                    >
                        <ImageIcon size={16} />
                    </button>
                    <button
                        type="button"
                        className="gdoc-toolbar-btn"
                        onClick={() => setShowCommentsDrawer(true)}
                        title="Add comment"
                    >
                        <MessageSquare size={16} />
                    </button>

                    <div className="gdoc-toolbar-separator" />

                    {/* Alignment */}
                    <div className="relative">
                        <button
                            type="button"
                            className="gdoc-toolbar-btn gdoc-align-btn"
                            onClick={() => setShowAlignPicker(!showAlignPicker)}
                            title="Align"
                        >
                            {editor?.isActive({ textAlign: "center" }) ? (
                                <AlignCenter size={16} />
                            ) : editor?.isActive({ textAlign: "right" }) ? (
                                <AlignRight size={16} />
                            ) : editor?.isActive({ textAlign: "justify" }) ? (
                                <AlignJustify size={16} />
                            ) : (
                                <AlignLeft size={16} />
                            )}
                            <ChevronDown size={12} style={{ marginLeft: "2px" }} />
                        </button>
                        {showAlignPicker && (
                            <div
                                className="gdoc-palette-popover gdoc-align-popover"
                                style={{ display: "flex", width: "auto", padding: "4px" }}
                            >
                                <button
                                    type="button"
                                    className="gdoc-toolbar-btn"
                                    onClick={() => {
                                        editor?.chain().focus().setTextAlign("left").run();
                                        setShowAlignPicker(false);
                                    }}
                                >
                                    <AlignLeft size={16} />
                                </button>
                                <button
                                    type="button"
                                    className="gdoc-toolbar-btn"
                                    onClick={() => {
                                        editor?.chain().focus().setTextAlign("center").run();
                                        setShowAlignPicker(false);
                                    }}
                                >
                                    <AlignCenter size={16} />
                                </button>
                                <button
                                    type="button"
                                    className="gdoc-toolbar-btn"
                                    onClick={() => {
                                        editor?.chain().focus().setTextAlign("right").run();
                                        setShowAlignPicker(false);
                                    }}
                                >
                                    <AlignRight size={16} />
                                </button>
                                <button
                                    type="button"
                                    className="gdoc-toolbar-btn"
                                    onClick={() => {
                                        editor?.chain().focus().setTextAlign("justify").run();
                                        setShowAlignPicker(false);
                                    }}
                                >
                                    <AlignJustify size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Line Spacing */}
                    <div className="relative">
                        <button
                            type="button"
                            className="gdoc-toolbar-btn gdoc-linespacing-btn"
                            onClick={() => setShowLineSpacingPicker(!showLineSpacingPicker)}
                            title="Line spacing"
                        >
                            <span style={{ fontSize: "11px", fontWeight: 600 }}>1.15↕</span>
                        </button>
                        {showLineSpacingPicker && (
                            <div className="gdoc-dropdown-menu gdoc-linespacing-popover" style={{ minWidth: "120px" }}>
                                <button
                                    className="gdoc-menu-option"
                                    onClick={() => {
                                        editor?.chain().focus().setLineHeight("1").run();
                                        setShowLineSpacingPicker(false);
                                    }}
                                >
                                    Single (1.0)
                                </button>
                                <button
                                    className="gdoc-menu-option"
                                    onClick={() => {
                                        editor?.chain().focus().setLineHeight("1.15").run();
                                        setShowLineSpacingPicker(false);
                                    }}
                                >
                                    1.15
                                </button>
                                <button
                                    className="gdoc-menu-option"
                                    onClick={() => {
                                        editor?.chain().focus().setLineHeight("1.5").run();
                                        setShowLineSpacingPicker(false);
                                    }}
                                >
                                    1.5
                                </button>
                                <button
                                    className="gdoc-menu-option"
                                    onClick={() => {
                                        editor?.chain().focus().setLineHeight("2").run();
                                        setShowLineSpacingPicker(false);
                                    }}
                                >
                                    Double (2.0)
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="gdoc-toolbar-separator" />

                    {/* Checkbox / Task list */}
                    <button
                        type="button"
                        className={`gdoc-toolbar-btn ${editor?.isActive("taskList") ? "active" : ""}`}
                        onClick={() => editor?.chain().focus().toggleTaskList().run()}
                        title="Checklist"
                    >
                        <CheckSquare size={16} />
                    </button>

                    {/* Bullet list & Numbered list */}
                    <button
                        type="button"
                        className={`gdoc-toolbar-btn ${editor?.isActive("bulletList") ? "active" : ""}`}
                        onClick={() => editor?.chain().focus().toggleBulletList().run()}
                        title="Bulleted list"
                    >
                        <List size={16} />
                    </button>
                    <button
                        type="button"
                        className={`gdoc-toolbar-btn ${editor?.isActive("orderedList") ? "active" : ""}`}
                        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                        title="Numbered list"
                    >
                        <ListOrdered size={16} />
                    </button>

                    {/* Indent / Outdent */}
                    <button
                        type="button"
                        className="gdoc-toolbar-btn"
                        onClick={() => editor?.chain().focus().liftListItem("listItem").run()}
                        title="Decrease indent"
                    >
                        <Outdent size={16} />
                    </button>
                    <button
                        type="button"
                        className="gdoc-toolbar-btn"
                        onClick={() => editor?.chain().focus().sinkListItem("listItem").run()}
                        title="Increase indent"
                    >
                        <Indent size={16} />
                    </button>

                    <div className="gdoc-toolbar-separator" />

                    {/* Quote & Code Block */}
                    <button
                        type="button"
                        className={`gdoc-toolbar-btn ${editor?.isActive("blockquote") ? "active" : ""}`}
                        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                        title="Blockquote callout"
                    >
                        <Quote size={16} />
                    </button>
                    <button
                        type="button"
                        className={`gdoc-toolbar-btn ${editor?.isActive("codeBlock") ? "active" : ""}`}
                        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                        title="Code block"
                    >
                        <Code size={16} />
                    </button>

                    {/* Table Controls */}
                    <div className="relative">
                        <button
                            type="button"
                            className={`gdoc-toolbar-btn gdoc-table-btn ${editor?.isActive("table") ? "active" : ""}`}
                            onClick={() => setShowTablePicker(!showTablePicker)}
                            title="Table operations"
                        >
                            <TableIcon size={16} />
                        </button>
                        {showTablePicker && (
                            <div className="gdoc-dropdown-menu gdoc-table-picker" style={{ minWidth: "180px" }}>
                                {!editor?.isActive("table") ? (
                                    <button
                                        className="gdoc-menu-option"
                                        onClick={() => {
                                            editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                                            setShowTablePicker(false);
                                        }}
                                    >
                                        Insert Table (3x3)
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            className="gdoc-menu-option"
                                            onClick={() => editor?.chain().focus().addRowAfter().run()}
                                        >
                                            Add row below
                                        </button>
                                        <button
                                            className="gdoc-menu-option"
                                            onClick={() => editor?.chain().focus().addColumnAfter().run()}
                                        >
                                            Add column right
                                        </button>
                                        <button
                                            className="gdoc-menu-option"
                                            onClick={() => editor?.chain().focus().deleteRow().run()}
                                        >
                                            Delete row
                                        </button>
                                        <button
                                            className="gdoc-menu-option"
                                            onClick={() => editor?.chain().focus().deleteColumn().run()}
                                        >
                                            Delete column
                                        </button>
                                        <div className="gdoc-menu-divider" />
                                        <button
                                            className="gdoc-menu-option danger"
                                            onClick={() => {
                                                editor?.chain().focus().deleteTable().run();
                                                setShowTablePicker(false);
                                            }}
                                        >
                                            Delete table
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ==========================================================================
               VISUAL RULER
               ========================================================================== */}
            {showRuler && (
                <div className="gdoc-ruler-container">
                    <div className="gdoc-ruler" style={{ width: `${816 * (zoomLevel / 100)}px` }}>
                        <div className="gdoc-ruler-ticks">
                            {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                                <div key={num} className="gdoc-ruler-inch">
                                    {num}
                                </div>
                            ))}
                        </div>
                        <div className="gdoc-ruler-stop-left" />
                        <div className="gdoc-ruler-stop-right" />
                    </div>
                </div>
            )}

            {/* ==========================================================================
               DOCUMENT CANVAS & PAPER SHEET
               ========================================================================== */}
            <main className="gdoc-canvas-wrapper">
                <div
                    className="gdoc-paper-sheet"
                    style={{
                        transform: `scale(${zoomLevel / 100})`,
                        transformOrigin: "top center",
                    }}
                >
                    <EditorContent editor={editor} />
                </div>
            </main>

            {/* ==========================================================================
               FOOTER STATUS BAR
               ========================================================================== */}
            <footer className="gdoc-footer">
                <div>
                    {editor?.storage.characterCount.words() || 0} words &bull;{" "}
                    {editor?.storage.characterCount.characters() || 0} characters
                </div>
                <div>
                    Zoom: {zoomLevel}% &bull; Mode: {isReadonly ? "Read-Only" : "Editing"}
                </div>
            </footer>

            {/* ==========================================================================
               SIDE DRAWER: VERSION HISTORY
               ========================================================================== */}
            {showVersionDrawer && (
                <aside className="gdoc-drawer">
                    <div className="gdoc-drawer-header">
                        <h3>Version History</h3>
                        <button className="gdoc-icon-btn" onClick={() => setShowVersionDrawer(false)}>
                            <X size={18} />
                        </button>
                    </div>
                    <div className="gdoc-drawer-content">
                        <div style={{ marginBottom: "16px" }}>
                            <button
                                className="gdoc-share-btn"
                                style={{ width: "100%", justifyContent: "center" }}
                                onClick={handleCreateVersion}
                            >
                                <Plus size={16} />
                                <span>Name Current Version</span>
                            </button>
                        </div>

                        {isLoadingVersions ? (
                            <p style={{ color: "var(--gdoc-text-muted)", fontSize: "13px" }}>Loading snapshots...</p>
                        ) : versions.length === 0 ? (
                            <p style={{ color: "var(--gdoc-text-muted)", fontSize: "13px" }}>No named versions saved yet.</p>
                        ) : (
                            <div>
                                {versions.map((v) => (
                                    <div
                                        key={v.id}
                                        style={{
                                            padding: "12px",
                                            border: "1px solid var(--gdoc-border)",
                                            borderRadius: "8px",
                                            marginBottom: "10px",
                                            backgroundColor: "var(--gdoc-bg)",
                                        }}
                                    >
                                        <div style={{ fontWeight: 600, fontSize: "13.5px", marginBottom: "4px" }}>
                                            {v.name}
                                        </div>
                                        <div style={{ fontSize: "11px", color: "var(--gdoc-text-muted)", marginBottom: "8px" }}>
                                            {new Date(v.createdAt).toLocaleString()}
                                        </div>
                                        <button
                                            style={{
                                                background: "transparent",
                                                border: "1px solid var(--gdoc-blue)",
                                                color: "var(--gdoc-blue)",
                                                borderRadius: "4px",
                                                padding: "4px 8px",
                                                fontSize: "12px",
                                                fontWeight: 500,
                                                cursor: "pointer",
                                            }}
                                            onClick={() => handleRestoreVersion(v)}
                                        >
                                            Restore this version
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
            )}

            {/* ==========================================================================
               SIDE DRAWER: COMMENTS
               ========================================================================== */}
            {showCommentsDrawer && (
                <aside className="gdoc-drawer">
                    <div className="gdoc-drawer-header">
                        <h3>Document Comments</h3>
                        <button className="gdoc-icon-btn" onClick={() => setShowCommentsDrawer(false)}>
                            <X size={18} />
                        </button>
                    </div>
                    <div className="gdoc-drawer-content">
                        {/* New Comment Box */}
                        <div className="gdoc-new-comment-box">
                            <textarea
                                placeholder="Add a comment or feedback for members..."
                                rows={3}
                                value={newCommentText}
                                onChange={(e) => setNewCommentText(e.target.value)}
                            />
                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                                <button
                                    className="gdoc-share-btn"
                                    style={{ padding: "5px 14px", fontSize: "12px" }}
                                    disabled={!newCommentText.trim()}
                                    onClick={handleAddComment}
                                >
                                    Comment
                                </button>
                            </div>
                        </div>

                        {/* Comments List */}
                        {comments.length === 0 ? (
                            <div style={{ textAlign: "center", color: "var(--gdoc-text-muted)", fontSize: "13px", padding: "20px 0" }}>
                                No comments on this document yet. Highlight text and click Comment.
                            </div>
                        ) : (
                            comments.map((c) => (
                                <div key={c.id} className={`gdoc-comment-card ${c.resolved ? "resolved" : ""}`}>
                                    <div className="gdoc-comment-header">
                                        <div className="gdoc-comment-author">
                                            <div
                                                style={{
                                                    width: "22px",
                                                    height: "22px",
                                                    borderRadius: "50%",
                                                    backgroundColor: c.color,
                                                    color: "#fff",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontSize: "10px",
                                                }}
                                            >
                                                {c.initials}
                                            </div>
                                            <span>{c.author}</span>
                                        </div>
                                        <span className="gdoc-comment-time">{c.timestamp}</span>
                                    </div>

                                    {c.quote && <div className="gdoc-comment-quote">{c.quote}</div>}

                                    <div className="gdoc-comment-text">{c.text}</div>

                                    {/* Replies */}
                                    {c.replies.length > 0 && (
                                        <div style={{ marginTop: "8px", borderTop: "1px solid var(--gdoc-border)", paddingTop: "8px" }}>
                                            {c.replies.map((r) => (
                                                <div key={r.id} style={{ fontSize: "12px", marginBottom: "6px" }}>
                                                    <strong>{r.author}: </strong>
                                                    <span>{r.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Reply Box */}
                                    {!c.resolved && (
                                        <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                                            <input
                                                type="text"
                                                placeholder="Reply..."
                                                value={replyTextMap[c.id] || ""}
                                                onChange={(e) =>
                                                    setReplyTextMap((prev) => ({ ...prev, [c.id]: e.target.value }))
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleAddReply(c.id);
                                                }}
                                                style={{
                                                    flex: 1,
                                                    fontSize: "12px",
                                                    padding: "4px 8px",
                                                    border: "1px solid var(--gdoc-border)",
                                                    borderRadius: "4px",
                                                    background: "transparent",
                                                    color: "inherit",
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleAddReply(c.id)}
                                                style={{
                                                    fontSize: "11px",
                                                    padding: "4px 8px",
                                                    background: "var(--gdoc-blue)",
                                                    color: "#fff",
                                                    border: "none",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                Reply
                                            </button>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="gdoc-comment-actions" style={{ marginTop: "10px" }}>
                                        <button
                                            type="button"
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: c.resolved ? "#16a34a" : "var(--gdoc-blue)",
                                                cursor: "pointer",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                fontSize: "11.5px",
                                            }}
                                            onClick={() => toggleResolveComment(c.id)}
                                        >
                                            <Check size={14} />
                                            <span>{c.resolved ? "Resolved" : "Mark resolved"}</span>
                                        </button>
                                        <button
                                            type="button"
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: "#dc2626",
                                                cursor: "pointer",
                                                marginLeft: "auto",
                                                fontSize: "11.5px",
                                            }}
                                            onClick={() => deleteComment(c.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </aside>
            )}

            {/* ==========================================================================
               MODAL: SHARE DOCUMENT
               ========================================================================== */}
            {showShareModal && (
                <div className="gdoc-modal-overlay" onMouseDown={() => setShowShareModal(false)}>
                    <div className="gdoc-modal-card" onMouseDown={(e) => e.stopPropagation()}>
                        <div className="gdoc-modal-header">
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <Share2 size={18} color="#1a73e8" />
                                <h3>Share "{docTitle}"</h3>
                            </div>
                            <button className="gdoc-icon-btn" onClick={() => setShowShareModal(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="gdoc-modal-body">
                            {/* General Access Box */}
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
                                <Globe size={22} color="#1a73e8" style={{ marginTop: "2px" }} />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--gdoc-text)" }}>
                                        Collaborative Project Access
                                    </div>
                                    <div style={{ fontSize: "12px", color: "var(--gdoc-text-muted)" }}>
                                        Anyone who belongs to this workspace or project can access, edit, and collaborate in real-time.
                                    </div>
                                </div>
                            </div>

                            {/* Share Link Field */}
                            <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--gdoc-text)" }}>
                                Sharable Link
                            </label>
                            <div className="gdoc-share-link-box">
                                <input
                                    type="text"
                                    readOnly
                                    className="gdoc-share-link-input"
                                    value={window.location.href}
                                />
                                <button
                                    className="gdoc-share-btn"
                                    style={{ padding: "6px 12px", fontSize: "12px" }}
                                    onClick={handleCopyShareLink}
                                >
                                    {copiedShareLink ? <Check size={14} /> : <Copy size={14} />}
                                    <span>{copiedShareLink ? "Copied!" : "Copy link"}</span>
                                </button>
                            </div>

                            {/* People with Access */}
                            {docData?.project?.members && docData.project.members.length > 0 && (
                                <div style={{ marginTop: "20px" }}>
                                    <div style={{ fontSize: "12.5px", fontWeight: 600, marginBottom: "8px" }}>
                                        Members with Access ({docData.project.members.length})
                                    </div>
                                    <div style={{ maxHeight: "160px", overflowY: "auto", border: "1px solid var(--gdoc-border)", borderRadius: "8px" }}>
                                        {docData.project.members.map((m) => (
                                            <div
                                                key={m.userId}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    padding: "8px 12px",
                                                    borderBottom: "1px solid var(--gdoc-border)",
                                                }}
                                            >
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <div
                                                        style={{
                                                            width: "26px",
                                                            height: "26px",
                                                            borderRadius: "50%",
                                                            backgroundColor: getUserColor(m.user.name),
                                                            color: "#ffffff",
                                                            fontSize: "11px",
                                                            fontWeight: 600,
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                        }}
                                                    >
                                                        {m.user.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: "13px", fontWeight: 500 }}>{m.user.name}</div>
                                                        <div style={{ fontSize: "11px", color: "var(--gdoc-text-muted)" }}>{m.user.email}</div>
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: "11.5px", color: "var(--gdoc-text-muted)", fontWeight: 500 }}>
                                                    {m.role}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="gdoc-modal-footer">
                            <button
                                className="gdoc-share-btn"
                                onClick={() => setShowShareModal(false)}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================================================
               MODAL: WORD COUNT
               ========================================================================== */}
            {showWordCountModal && (
                <div className="gdoc-modal-overlay" onMouseDown={() => setShowWordCountModal(false)}>
                    <div className="gdoc-modal-card" style={{ maxWidth: "380px" }} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="gdoc-modal-header">
                            <h3>Word Count</h3>
                            <button className="gdoc-icon-btn" onClick={() => setShowWordCountModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="gdoc-modal-body">
                            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: "10px", fontSize: "14px" }}>
                                <span>Pages</span>
                                <strong>{Math.max(1, Math.ceil((editor?.storage.characterCount.words() || 0) / 450))}</strong>
                                <span>Words</span>
                                <strong>{editor?.storage.characterCount.words() || 0}</strong>
                                <span>Characters</span>
                                <strong>{editor?.storage.characterCount.characters() || 0}</strong>
                                <span>Characters (no spaces)</span>
                                <strong>
                                    {(editor?.getText() || "").replace(/\s/g, "").length}
                                </strong>
                                <span>Reading time</span>
                                <strong>
                                    ~{Math.max(1, Math.ceil((editor?.storage.characterCount.words() || 0) / 200))} min
                                </strong>
                            </div>
                        </div>
                        <div className="gdoc-modal-footer">
                            <button className="gdoc-share-btn" onClick={() => setShowWordCountModal(false)}>
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================================================
               MODAL: FIND & REPLACE
               ========================================================================== */}
            {showFindReplaceModal && (
                <div className="gdoc-modal-overlay" onMouseDown={() => setShowFindReplaceModal(false)}>
                    <div className="gdoc-modal-card" style={{ maxWidth: "440px" }} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="gdoc-modal-header">
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <Search size={18} color="#1a73e8" />
                                <h3>Find and Replace</h3>
                            </div>
                            <button className="gdoc-icon-btn" onClick={() => setShowFindReplaceModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="gdoc-modal-body">
                            <div style={{ marginBottom: "12px" }}>
                                <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                                    Find
                                </label>
                                <input
                                    type="text"
                                    value={findQuery}
                                    onChange={(e) => setFindQuery(e.target.value)}
                                    placeholder="Text to find..."
                                    style={{
                                        width: "100%",
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        border: "1px solid var(--gdoc-border)",
                                        fontSize: "13.5px",
                                        outline: "none",
                                        background: "transparent",
                                        color: "inherit",
                                    }}
                                />
                            </div>
                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                                    Replace with
                                </label>
                                <input
                                    type="text"
                                    value={replaceQuery}
                                    onChange={(e) => setReplaceQuery(e.target.value)}
                                    placeholder="Replacement text..."
                                    style={{
                                        width: "100%",
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        border: "1px solid var(--gdoc-border)",
                                        fontSize: "13.5px",
                                        outline: "none",
                                        background: "transparent",
                                        color: "inherit",
                                    }}
                                />
                            </div>
                        </div>
                        <div className="gdoc-modal-footer">
                            <button
                                style={{
                                    padding: "6px 14px",
                                    borderRadius: "4px",
                                    border: "1px solid var(--gdoc-border)",
                                    background: "transparent",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                }}
                                onClick={() => {
                                    if (!findQuery || !editor) return;
                                    const text = editor.getHTML();
                                    const regex = new RegExp(findQuery, "g");
                                    const updated = text.replace(regex, replaceQuery);
                                    editor.commands.setContent(updated);
                                    setShowFindReplaceModal(false);
                                }}
                            >
                                Replace All
                            </button>
                            <button className="gdoc-share-btn" onClick={() => setShowFindReplaceModal(false)}>
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================================================
               MODAL: INSERT IMAGE
               ========================================================================== */}
            {showImageModal && (
                <div className="gdoc-modal-overlay" onMouseDown={() => setShowImageModal(false)}>
                    <div className="gdoc-modal-card" style={{ maxWidth: "440px" }} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="gdoc-modal-header">
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ImageIcon size={18} color="#1a73e8" />
                                <h3>Insert Image</h3>
                            </div>
                            <button className="gdoc-icon-btn" onClick={() => setShowImageModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="gdoc-modal-body">
                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                                    Upload from Computer
                                </label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLocalImageUpload}
                                    style={{ fontSize: "13px" }}
                                />
                            </div>

                            <div style={{ textAlign: "center", color: "var(--gdoc-text-muted)", fontSize: "12px", margin: "8px 0" }}>
                                — OR —
                            </div>

                            <div>
                                <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                                    Image Web URL
                                </label>
                                <input
                                    type="text"
                                    value={imageUrlInput}
                                    onChange={(e) => setImageUrlInput(e.target.value)}
                                    placeholder="https://example.com/image.png"
                                    style={{
                                        width: "100%",
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        border: "1px solid var(--gdoc-border)",
                                        fontSize: "13px",
                                        outline: "none",
                                        background: "transparent",
                                        color: "inherit",
                                    }}
                                />
                            </div>
                        </div>
                        <div className="gdoc-modal-footer">
                            <button
                                style={{
                                    padding: "6px 14px",
                                    borderRadius: "4px",
                                    border: "1px solid var(--gdoc-border)",
                                    background: "transparent",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                }}
                                onClick={() => setShowImageModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="gdoc-share-btn"
                                disabled={!imageUrlInput.trim()}
                                onClick={handleInsertImage}
                            >
                                Insert
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
