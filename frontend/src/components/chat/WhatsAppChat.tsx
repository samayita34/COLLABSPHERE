import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { socketService } from "../../services/socket";
import {
    fetchChannels,
    fetchChannelMessages,
    sendChannelMessage,
    toggleReactionApi,
    markChannelAsReadApi,
    uploadChatFileApi,
    type Channel,
    type ChannelMessage,
    type ChannelMember,
    type ChatAttachment
} from "../../services/chatApi";
import { NewDirectMessageModal } from "./NewDirectMessageModal";
import { CreateGroupModal } from "./CreateGroupModal";
import "./WhatsAppChat.css";

interface Props {
    workspaceId?: string;
    initialChannelId?: string;
}

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉", "👏", "🚀", "💯", "👀", "✅", "✨"];

export const WhatsAppChat: React.FC<Props> = ({ workspaceId, initialChannelId }) => {
    const { user, userInitials, userFullName } = useAuth();

    const [channels, setChannels] = useState<Channel[]>([]);
    const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
    const [messages, setMessages] = useState<ChannelMessage[]>([]);
    const [members, setMembers] = useState<ChannelMember[]>([]);
    const [loadingChannels, setLoadingChannels] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Filter and search in conversation list
    const [channelFilter, setChannelFilter] = useState<"ALL" | "DIRECT" | "GROUP" | "PROJECT" | "UNREAD">("ALL");
    const [channelSearch, setChannelSearch] = useState("");

    // In-chat message search
    const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
    const [inChatSearchQuery, setInChatSearchQuery] = useState("");
    const [, setHighlightedMsgId] = useState<string | null>(null);

    // Chat input
    const [draftText, setDraftText] = useState("");
    const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [showEmojiTray, setShowEmojiTray] = useState(false);

    // Mention state
    const [showMentionMenu, setShowMentionMenu] = useState(false);
    const [mentionFilter, setMentionFilter] = useState("");
    const [mentionUsers, setMentionUsers] = useState<string[]>([]);

    // Modals
    const [isDmModalOpen, setIsDmModalOpen] = useState(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

    // Typing
    const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ── Load Channels ──────────────────────────────────────────
    const loadChannels = async (selectChannelId?: string) => {
        try {
            setLoadingChannels(true);
            const data = await fetchChannels(workspaceId);
            setChannels(data);

            if (selectChannelId) {
                const target = data.find((c) => c.id === selectChannelId);
                if (target) setActiveChannel(target);
            } else if (!activeChannel && data.length > 0) {
                setActiveChannel(data[0]);
            }
        } catch (err) {
            console.error("Failed to load channels:", err);
        } finally {
            setLoadingChannels(false);
        }
    };

    useEffect(() => {
        loadChannels(initialChannelId);
    }, [workspaceId]);

    // ── Socket Connections & Real-time Listeners ──────────────
    useEffect(() => {
        const socket = socketService.connect();
        if (user?.id) {
            socketService.joinUser(user.id);
        }

        // Handle incoming new messages
        const handleNewMessage = (msg: ChannelMessage) => {
            // If message belongs to currently open channel
            if (activeChannel && msg.channelId === activeChannel.id) {
                setMessages((prev) => {
                    if (prev.some((m) => m.id === msg.id)) return prev;
                    return [...prev, { ...msg, isOwn: msg.senderId === user?.id }];
                });
                markChannelAsReadApi(activeChannel.id);
            }

            // Update channel list item's lastMessage and unreadCount
            setChannels((prev) =>
                prev.map((c) => {
                    if (c.id === msg.channelId) {
                        const isCurrentActive = activeChannel?.id === c.id;
                        return {
                            ...c,
                            lastMessage: {
                                id: msg.id,
                                text: msg.text,
                                createdAt: msg.createdAt,
                                sender: { id: msg.senderId, firstName: msg.sender?.firstName || "", lastName: msg.sender?.lastName || "" },
                                hasAttachment: !!msg.attachment
                            },
                            unreadCount: isCurrentActive ? 0 : c.unreadCount + (msg.senderId !== user?.id ? 1 : 0),
                            updatedAt: msg.createdAt
                        };
                    }
                    return c;
                })
            );
        };

        // Handle reaction updates
        const handleReactionUpdated = (data: { messageId: string; channelId: string; reactions: any[] }) => {
            setMessages((prev) =>
                prev.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m))
            );
        };

        // Handle read receipts
        const handleChannelRead = (data: { channelId: string; userId: string; readAt: string }) => {
            if (activeChannel?.id === data.channelId) {
                // Update messages where sender is current user to read
                setMessages((prev) =>
                    prev.map((m) => {
                        if (m.senderId === user?.id) {
                            return { ...m, isRead: true };
                        }
                        return m;
                    })
                );
            }
        };

        // Handle new channels created
        const handleNewChannel = (newCh: Channel) => {
            setChannels((prev) => {
                if (prev.some((c) => c.id === newCh.id)) return prev;
                return [newCh, ...prev];
            });
        };

        // Handle typing indicators
        const handleUserTyping = (data: { channelId?: string; userId: string; userName: string }) => {
            if (activeChannel?.id === data.channelId && data.userId !== user?.id) {
                setTypingUsers((prev) => new Map(prev).set(data.userId, data.userName));
            }
        };

        const handleUserStoppedTyping = (data: { channelId?: string; userId: string }) => {
            if (activeChannel?.id === data.channelId) {
                setTypingUsers((prev) => {
                    const next = new Map(prev);
                    next.delete(data.userId);
                    return next;
                });
            }
        };

        socket?.on("new_message", handleNewMessage);
        socket?.on("reaction_updated", handleReactionUpdated);
        socket?.on("channel_read", handleChannelRead);
        socket?.on("new_channel", handleNewChannel);
        socket?.on("user_typing", handleUserTyping);
        socket?.on("user_stopped_typing", handleUserStoppedTyping);

        return () => {
            socket?.off("new_message", handleNewMessage);
            socket?.off("reaction_updated", handleReactionUpdated);
            socket?.off("channel_read", handleChannelRead);
            socket?.off("new_channel", handleNewChannel);
            socket?.off("user_typing", handleUserTyping);
            socket?.off("user_stopped_typing", handleUserStoppedTyping);
        };
    }, [activeChannel?.id, user?.id]);

    // ── Switch Active Channel ─────────────────────────────────
    useEffect(() => {
        if (!activeChannel) {
            setMessages([]);
            setMembers([]);
            return;
        }

        socketService.joinChannel(activeChannel.id);
        setLoadingMessages(true);
        setTypingUsers(new Map());
        setInChatSearchOpen(false);
        setInChatSearchQuery("");
        setHighlightedMsgId(null);

        fetchChannelMessages(activeChannel.id)
            .then(({ messages, members }) => {
                setMessages(messages);
                setMembers(members);
                // Clear unread in channel list
                setChannels((prev) =>
                    prev.map((c) => (c.id === activeChannel.id ? { ...c, unreadCount: 0 } : c))
                );
            })
            .catch((err) => console.error("Error loading messages:", err))
            .finally(() => setLoadingMessages(false));

        return () => {
            socketService.leaveChannel(activeChannel.id);
        };
    }, [activeChannel?.id]);

    // Auto-scroll on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    // ── Typing Detection ──────────────────────────────────────
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setDraftText(val);

        // Check for @mention trigger
        const cursor = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursor);
        const lastAt = textBeforeCursor.lastIndexOf("@");
        if (lastAt !== -1 && !/\s/.test(textBeforeCursor.slice(lastAt + 1))) {
            setShowMentionMenu(true);
            setMentionFilter(textBeforeCursor.slice(lastAt + 1).toLowerCase());
        } else {
            setShowMentionMenu(false);
        }

        if (!activeChannel || !user) return;
        socketService.emitTyping(activeChannel.id, user.id, `${user.firstName} ${user.lastName}`, true);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socketService.emitTyping(activeChannel.id, user.id, `${user.firstName} ${user.lastName}`, false);
        }, 2000);
    };

    // ── Mention Insertion ─────────────────────────────────────
    const insertMention = (member: ChannelMember) => {
        const cursor = textareaRef.current?.selectionStart || draftText.length;
        const textBeforeCursor = draftText.slice(0, cursor);
        const textAfterCursor = draftText.slice(cursor);
        const lastAt = textBeforeCursor.lastIndexOf("@");

        const memberName = `${member.user.firstName} ${member.user.lastName}`;
        const newText = textBeforeCursor.slice(0, lastAt) + `@${memberName} ` + textAfterCursor;

        setDraftText(newText);
        setMentionUsers((prev) => Array.from(new Set([...prev, member.userId])));
        setShowMentionMenu(false);

        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    // ── Send Message ──────────────────────────────────────────
    const handleSendMessage = async () => {
        if ((!draftText.trim() && !pendingAttachment) || !activeChannel) return;

        const textToSend = draftText.trim();
        const attachmentToSend = pendingAttachment;

        setDraftText("");
        setPendingAttachment(null);
        setShowEmojiTray(false);
        setShowMentionMenu(false);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (user) {
            socketService.emitTyping(activeChannel.id, user.id, "", false);
        }

        try {
            await sendChannelMessage(activeChannel.id, {
                text: textToSend,
                attachment: attachmentToSend || undefined,
                mentions: mentionUsers
            });
            setMentionUsers([]);
        } catch (err) {
            console.error("Failed to send message:", err);
        }
    };

    // ── File Upload ───────────────────────────────────────────
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploadingFile(true);
            const uploaded = await uploadChatFileApi(file);
            setPendingAttachment(uploaded);
        } catch (err) {
            console.error("File upload failed:", err);
            alert("Failed to upload file. Please try again.");
        } finally {
            setUploadingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // ── Emoji Reactions ───────────────────────────────────────
    const handleToggleReaction = async (messageId: string, emoji: string) => {
        try {
            await toggleReactionApi(messageId, emoji);
        } catch (err) {
            console.error("Failed to toggle reaction:", err);
        }
    };

    // ── Channel Filtering ─────────────────────────────────────
    const filteredChannels = channels.filter((c) => {
        if (channelFilter === "DIRECT" && c.type !== "DIRECT_MESSAGE") return false;
        if (channelFilter === "GROUP" && c.type !== "GROUP") return false;
        if (channelFilter === "PROJECT" && c.type !== "PROJECT") return false;
        if (channelFilter === "UNREAD" && c.unreadCount === 0) return false;

        if (channelSearch.trim()) {
            const query = channelSearch.toLowerCase();
            const name = getChannelTitle(c, user?.id).toLowerCase();
            return name.includes(query);
        }
        return true;
    });

    // ── Helpers ───────────────────────────────────────────────
    function getChannelTitle(ch: Channel, currentUserId?: string) {
        if (ch.type === "DIRECT_MESSAGE") {
            const partner = ch.members.find((m) => m.userId !== currentUserId)?.user;
            if (partner) return `${partner.firstName} ${partner.lastName}`;
            return "Direct Message";
        }
        if (ch.type === "PROJECT") {
            return `# ${ch.project?.name || ch.name || "Project Channel"}`;
        }
        return ch.name || "Group Conversation";
    }

    function getChannelAvatar(ch: Channel, currentUserId?: string) {
        if (ch.type === "DIRECT_MESSAGE") {
            const partner = ch.members.find((m) => m.userId !== currentUserId)?.user;
            const initials = `${partner?.firstName?.[0] || ""}${partner?.lastName?.[0] || ""}`.toUpperCase() || "DM";
            return <div className="wa-avatar online">{initials}</div>;
        }
        if (ch.type === "PROJECT") {
            return <div className="wa-avatar project">#</div>;
        }
        const initials = ch.name ? ch.name.substring(0, 2).toUpperCase() : "GP";
        return <div className="wa-avatar group">{initials}</div>;
    }

    function formatTime(iso: string) {
        return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function formatDayLabel(iso: string) {
        const date = new Date(iso);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return "Today";
        if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
        return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    }

    // In-chat search matching
    const matchingMessages = inChatSearchQuery.trim()
        ? messages.filter((m) => m.text?.toLowerCase().includes(inChatSearchQuery.toLowerCase()))
        : [];

    return (
        <div className="whatsapp-chat-container">
            {/* ===================================================
                LEFT SIDEBAR: Conversation List
            =================================================== */}
            <div className="wa-sidebar">
                {/* Header */}
                <div className="wa-sidebar-header">
                    <div className="wa-user-info">
                        <div className="wa-avatar">{userInitials}</div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#0f172a" }}>{userFullName}</div>
                            <div style={{ fontSize: "0.725rem", color: "#16a34a", fontWeight: 500 }}>● Online</div>
                        </div>
                    </div>

                    <div className="wa-header-actions">
                        <button
                            className="wa-icon-btn"
                            title="New Direct Message"
                            onClick={() => setIsDmModalOpen(true)}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </button>
                        <button
                            className="wa-icon-btn"
                            title="New Group"
                            onClick={() => setIsGroupModalOpen(true)}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Search Box */}
                <div className="wa-search-box">
                    <svg className="wa-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                        type="text"
                        className="wa-search-input"
                        placeholder="Search or start new chat"
                        value={channelSearch}
                        onChange={(e) => setChannelSearch(e.target.value)}
                    />
                </div>

                {/* Category Filter Tabs */}
                <div className="wa-filter-tabs">
                    <div
                        className={`wa-filter-pill ${channelFilter === "ALL" ? "active" : ""}`}
                        onClick={() => setChannelFilter("ALL")}
                    >
                        All
                    </div>
                    <div
                        className={`wa-filter-pill ${channelFilter === "DIRECT" ? "active" : ""}`}
                        onClick={() => setChannelFilter("DIRECT")}
                    >
                        Direct
                    </div>
                    <div
                        className={`wa-filter-pill ${channelFilter === "GROUP" ? "active" : ""}`}
                        onClick={() => setChannelFilter("GROUP")}
                    >
                        Groups
                    </div>
                    <div
                        className={`wa-filter-pill ${channelFilter === "PROJECT" ? "active" : ""}`}
                        onClick={() => setChannelFilter("PROJECT")}
                    >
                        Projects
                    </div>
                    <div
                        className={`wa-filter-pill ${channelFilter === "UNREAD" ? "active" : ""}`}
                        onClick={() => setChannelFilter("UNREAD")}
                    >
                        Unread
                    </div>
                </div>

                {/* Channels List */}
                <div className="wa-channel-list">
                    {loadingChannels && (
                        <div className="wa-sidebar-empty">Loading conversations...</div>
                    )}

                    {!loadingChannels && filteredChannels.length === 0 && (
                        <div className="wa-sidebar-empty">
                            No conversations found.<br />Click "+ New DM" or "+ New Group" above to get started!
                        </div>
                    )}

                    {!loadingChannels && filteredChannels.map((c) => {
                        const isSelected = activeChannel?.id === c.id;
                        const title = getChannelTitle(c, user?.id);
                        const lastMsg = c.lastMessage;
                        const timeStr = lastMsg?.createdAt ? formatTime(lastMsg.createdAt) : "";

                        return (
                            <div
                                key={c.id}
                                className={`wa-channel-item ${isSelected ? "active" : ""}`}
                                onClick={() => setActiveChannel(c)}
                            >
                                {getChannelAvatar(c, user?.id)}

                                <div className="wa-channel-meta">
                                    <div className="wa-channel-top">
                                        <div className="wa-channel-name">{title}</div>
                                        {timeStr && <div className="wa-channel-time">{timeStr}</div>}
                                    </div>

                                    <div className="wa-channel-bottom">
                                        <div className="wa-channel-preview">
                                            {lastMsg ? (
                                                <>
                                                    {lastMsg.sender.id === user?.id && <span className="wa-tick">✓✓ </span>}
                                                    {lastMsg.hasAttachment ? "📷 File attached" : lastMsg.text || "Message"}
                                                </>
                                            ) : (
                                                "Tap to start chatting"
                                            )}
                                        </div>

                                        {c.unreadCount > 0 && (
                                            <div className="wa-unread-badge">{c.unreadCount}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ===================================================
                RIGHT MAIN CHAT PANE
            =================================================== */}
            {activeChannel ? (
                <div className="wa-chat-pane">
                    {/* Chat Header */}
                    <div className="wa-chat-header">
                        <div className="wa-chat-header-info">
                            {getChannelAvatar(activeChannel, user?.id)}
                            <div>
                                <div className="wa-header-title">{getChannelTitle(activeChannel, user?.id)}</div>
                                <div className="wa-header-sub">
                                    {typingUsers.size > 0 ? (
                                        <span className="wa-header-sub typing">
                                            {Array.from(typingUsers.values()).join(", ")} is typing...
                                        </span>
                                    ) : activeChannel.type === "DIRECT_MESSAGE" ? (
                                        "Direct conversation"
                                    ) : (
                                        `${members.length} participants`
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="wa-header-actions">
                            <button
                                className="wa-icon-btn"
                                title="Search messages"
                                onClick={() => setInChatSearchOpen(!inChatSearchOpen)}
                            >
                                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* In-Chat Search Bar */}
                    {inChatSearchOpen && (
                        <div className="wa-inchat-search">
                            <input
                                type="text"
                                placeholder="Search messages in this chat..."
                                value={inChatSearchQuery}
                                onChange={(e) => setInChatSearchQuery(e.target.value)}
                                autoFocus
                            />
                            {inChatSearchQuery && (
                                <span className="wa-search-match-badge">
                                    {matchingMessages.length} {matchingMessages.length === 1 ? "match" : "matches"}
                                </span>
                            )}
                            <button
                                className="wa-icon-btn"
                                onClick={() => {
                                    setInChatSearchOpen(false);
                                    setInChatSearchQuery("");
                                    setHighlightedMsgId(null);
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* Message Stream */}
                    <div className="wa-messages-container">
                        {loadingMessages && (
                            <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                                Loading chat history...
                            </div>
                        )}

                        {!loadingMessages && messages.length === 0 && (
                            <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                                👋 No messages yet. Say hello to get the conversation started!
                            </div>
                        )}

                        {!loadingMessages &&
                            messages.map((msg, idx) => {
                                const isOutgoing = msg.senderId === user?.id;
                                const isMatching =
                                    inChatSearchQuery.trim() !== "" &&
                                    msg.text?.toLowerCase().includes(inChatSearchQuery.toLowerCase());

                                // Date divider
                                const prevMsg = messages[idx - 1];
                                const showDayDivider =
                                    !prevMsg ||
                                    new Date(prevMsg.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

                                return (
                                    <React.Fragment key={msg.id}>
                                        {showDayDivider && (
                                            <div className="wa-day-divider">
                                                <span className="wa-day-pill">{formatDayLabel(msg.createdAt)}</span>
                                            </div>
                                        )}

                                        <div className={`wa-message-row ${isOutgoing ? "outgoing" : "incoming"}`}>
                                            <div className={`wa-bubble ${isOutgoing ? "outgoing" : "incoming"} ${isMatching ? "highlight" : ""}`}>
                                                {/* Sender name in group chats for incoming messages */}
                                                {!isOutgoing && activeChannel.type !== "DIRECT_MESSAGE" && (
                                                    <div className="wa-sender-name">
                                                        {msg.sender.firstName} {msg.sender.lastName}
                                                    </div>
                                                )}

                                                {/* Attachment rendering */}
                                                {msg.attachment && (
                                                    <div className="wa-attachment-card">
                                                        {msg.attachment.type.startsWith("image/") ? (
                                                            <a href={msg.attachment.url} target="_blank" rel="noopener noreferrer">
                                                                <img
                                                                    src={msg.attachment.url}
                                                                    alt={msg.attachment.name}
                                                                    className="wa-image-attachment"
                                                                />
                                                            </a>
                                                        ) : (
                                                            <a
                                                                href={msg.attachment.url}
                                                                download={msg.attachment.name}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="wa-file-card"
                                                            >
                                                                <div className="wa-file-icon">📄</div>
                                                                <div className="wa-file-details">
                                                                    <div className="wa-file-name">{msg.attachment.name}</div>
                                                                    <div className="wa-file-size">
                                                                        {(msg.attachment.size / 1024).toFixed(1)} KB • Click to download
                                                                    </div>
                                                                </div>
                                                            </a>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Text Content with @Mention rendering */}
                                                {msg.text && (
                                                    <div className="wa-message-content">
                                                        {msg.text.split(/(@[\w\s]+)/g).map((part, pIdx) => {
                                                            if (part.startsWith("@")) {
                                                                return (
                                                                    <span key={pIdx} className="wa-mention-pill">
                                                                        {part}
                                                                    </span>
                                                                );
                                                            }
                                                            return part;
                                                        })}
                                                    </div>
                                                )}

                                                {/* Footer: Time + WhatsApp Read Receipt Ticks */}
                                                <div className="wa-bubble-footer">
                                                    <span className="wa-message-time">{formatTime(msg.createdAt)}</span>
                                                    {isOutgoing && (
                                                        <span
                                                            className={`wa-tick ${
                                                                msg.isRead ? "double-blue" : "double-grey"
                                                            }`}
                                                            title={msg.isRead ? "Read" : "Delivered"}
                                                        >
                                                            {msg.isRead ? "✓✓" : "✓✓"}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Emoji Reactions display */}
                                                {msg.reactions && msg.reactions.length > 0 && (
                                                    <div className="wa-reactions-row">
                                                        {Array.from(
                                                            msg.reactions.reduce((acc, r) => {
                                                                const count = acc.get(r.emoji) || 0;
                                                                acc.set(r.emoji, count + 1);
                                                                return acc;
                                                            }, new Map<string, number>())
                                                        ).map(([emoji, count]) => {
                                                            const hasReacted = msg.reactions?.some(
                                                                (r) => r.emoji === emoji && r.userId === user?.id
                                                            );
                                                            return (
                                                                <div
                                                                    key={emoji}
                                                                    className={`wa-reaction-badge ${hasReacted ? "mine" : ""}`}
                                                                    onClick={() => handleToggleReaction(msg.id, emoji)}
                                                                    title="Click to toggle reaction"
                                                                >
                                                                    <span>{emoji}</span>
                                                                    <span>{count}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Hover Quick Emoji Reaction Menu */}
                                                <div className="wa-quick-reactions">
                                                    {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                                                        <button
                                                            key={emoji}
                                                            className="wa-emoji-quick-btn"
                                                            onClick={() => handleToggleReaction(msg.id, emoji)}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Chat Input Area */}
                    <div className="wa-input-container">
                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: "none" }}
                            onChange={handleFileSelect}
                        />

                        {/* Emoji Popover Tray */}
                        {showEmojiTray && (
                            <div className="wa-emoji-tray">
                                {COMMON_EMOJIS.map((em) => (
                                    <button
                                        key={em}
                                        className="wa-emoji-item"
                                        onClick={() => {
                                            setDraftText((prev) => prev + em);
                                            setShowEmojiTray(false);
                                            textareaRef.current?.focus();
                                        }}
                                    >
                                        {em}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Mention Autocomplete Dropdown */}
                        {showMentionMenu && (
                            <div className="wa-mention-dropdown">
                                <div style={{ padding: "6px 10px", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>
                                    Mention Member
                                </div>
                                {members
                                    .filter((m) => {
                                        const name = `${m.user.firstName} ${m.user.lastName}`.toLowerCase();
                                        return name.includes(mentionFilter) && m.userId !== user?.id;
                                    })
                                    .map((m) => (
                                        <div
                                            key={m.userId}
                                            className="wa-mention-item"
                                            onClick={() => insertMention(m)}
                                        >
                                            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#0284c7", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 600 }}>
                                                {m.user.firstName[0]}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{m.user.firstName} {m.user.lastName}</div>
                                                <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{m.user.email}</div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}

                        {/* Pending Attachment Preview Banner */}
                        {pendingAttachment && (
                            <div className="wa-pending-attachment">
                                <span>📎 {pendingAttachment.name} ({(pendingAttachment.size / 1024).toFixed(1)} KB)</span>
                                <button
                                    className="wa-remove-attachment"
                                    onClick={() => setPendingAttachment(null)}
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {/* Emoji Button */}
                        <button
                            className="wa-icon-btn"
                            title="Insert Emoji"
                            onClick={() => setShowEmojiTray(!showEmojiTray)}
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                <line x1="15" y1="9" x2="15.01" y2="9"></line>
                            </svg>
                        </button>

                        {/* File Attachment Button */}
                        <button
                            className="wa-icon-btn"
                            title="Attach Document / Photo"
                            disabled={uploadingFile}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                            </svg>
                        </button>

                        {/* Chat Input Textarea */}
                        <div className="wa-chat-input-wrapper">
                            <textarea
                                ref={textareaRef}
                                className="wa-chat-textarea"
                                placeholder="Type a message (type @ to mention)..."
                                rows={1}
                                value={draftText}
                                onChange={handleInputChange}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                            />
                        </div>

                        {/* Send Button */}
                        <button
                            className="wa-send-btn"
                            title="Send Message"
                            disabled={!draftText.trim() && !pendingAttachment}
                            onClick={handleSendMessage}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>
            ) : (
                /* Welcome Screen when no chat is open */
                <div className="wa-welcome-pane">
                    <div className="wa-welcome-icon">💬</div>
                    <h3>Collabsphere Chat</h3>
                    <p>
                        Send and receive messages with your team across Direct Messages, Groups, and Project Channels with real-time read receipts, emoji reactions, and file sharing.
                    </p>
                </div>
            )}

            {/* Modals */}
            <NewDirectMessageModal
                isOpen={isDmModalOpen}
                onClose={() => setIsDmModalOpen(false)}
                workspaceId={workspaceId}
                onSelectChannel={(ch) => {
                    setChannels((prev) => (prev.some((c) => c.id === ch.id) ? prev : [ch, ...prev]));
                    setActiveChannel(ch);
                }}
            />

            <CreateGroupModal
                isOpen={isGroupModalOpen}
                onClose={() => setIsGroupModalOpen(false)}
                workspaceId={workspaceId}
                onSelectChannel={(ch) => {
                    setChannels((prev) => (prev.some((c) => c.id === ch.id) ? prev : [ch, ...prev]));
                    setActiveChannel(ch);
                }}
            />
        </div>
    );
};
export default WhatsAppChat;
