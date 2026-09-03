import { useEffect, useRef, useState, type KeyboardEvent, type ChangeEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { socketService } from "../services/socket";

/* =========================
   TYPES
   Mirrors the Member shape in ProjectWorkspace.tsx. Kept local
   so this component has no import-order coupling (same pattern
   as TaskModal.tsx / MemberModal.tsx / DocumentModal.tsx).
========================= */

interface Member {
    initials: string;
    name: string;
    role: string;
    email: string;
}

export interface ChatMessage {
    id: string;
    senderInitials: string;
    text: string;
    timestamp: string; // ISO string
}

interface ProjectChatProps {
    projectId?: string;
    members: Member[];
    messages: ChatMessage[];
    onSend: (text: string) => void;
}

function senderInfo(initials: string, members: Member[], currentInitials: string, currentName: string) {
    const member = members.find((m) => m.initials === initials);
    if (member) return { name: member.name };
    if (initials === currentInitials) return { name: currentName };
    return { name: initials };
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });
}

function isSameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function dayLabel(iso: string) {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (isSameDay(date, today)) return "Today";
    if (isSameDay(date, yesterday)) return "Yesterday";

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ProjectChat({ projectId, members, messages, onSend }: ProjectChatProps) {
    const { userInitials, userFullName, user } = useAuth();

    const [draft, setDraft] = useState("");

    // Map<userId, displayName> of other users currently typing
    const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Refs for typing state — these do NOT cause re-renders
    const isTypingRef = useRef(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Socket ref — never call socketService.connect() during render
    const socketRef = useRef<ReturnType<typeof socketService.connect> | null>(null);

    // ── Auto-scroll ──────────────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ block: "end" });
    }, [messages.length]);

    // ── Socket: listen for typing events ─────────────────────────────────────
    useEffect(() => {
        // Establish the connection once inside the effect, not during render
        const socket = socketService.connect();
        socketRef.current = socket;

        const handleUserTyping = (data: {
            projectId?: string;
            channelId?: string;
            userId: string;
            userName: string;
        }) => {
            if (!data) return;
            // Never show the indicator for the current user
            if (data.userId === user?.id) return;
            // Filter events that belong to a different project
            if (projectId && data.projectId && data.projectId !== projectId) return;

            setTypingUsers((prev) => {
                const next = new Map(prev);
                next.set(data.userId, data.userName || "Someone");
                return next;
            });
        };

        const handleUserStoppedTyping = (data: {
            projectId?: string;
            channelId?: string;
            userId: string;
        }) => {
            if (!data) return;
            if (data.userId === user?.id) return;

            setTypingUsers((prev) => {
                const next = new Map(prev);
                next.delete(data.userId);
                return next;
            });
        };

        socket?.on("user_typing", handleUserTyping);
        socket?.on("user_stopped_typing", handleUserStoppedTyping);

        return () => {
            // Remove listeners
            socket?.off("user_typing", handleUserTyping);
            socket?.off("user_stopped_typing", handleUserStoppedTyping);

            // If we are still marked as typing, notify others before unmounting
            if (isTypingRef.current && projectId && socket) {
                socket.emit("typing_end", {
                    projectId,
                    userId: user?.id,
                    userName: userFullName || userInitials || "User",
                });
                isTypingRef.current = false;
            }

            // Clear any pending debounce timer
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        };
    }, [projectId, user?.id, userFullName, userInitials]);

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Emit typing_end immediately and reset state. */
    const emitTypingEnd = () => {
        const socket = socketRef.current;
        if (!socket || !projectId || !isTypingRef.current) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        socket.emit("typing_end", {
            projectId,
            userId: user?.id,
            userName: userFullName || userInitials || "User",
        });

        isTypingRef.current = false;
    };

    /** Emit typing_start and arm the inactivity debounce. */
    const handleDraftChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setDraft(val);

        const socket = socketRef.current;
        if (!projectId || !socket) return;

        // Input cleared → immediately stop typing
        if (!val.trim()) {
            emitTypingEnd();
            return;
        }

        // First keystroke with content → emit typing_start
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            socket.emit("typing_start", {
                projectId,
                userId: user?.id,
                userName: userFullName || userInitials || "User",
            });
        }

        // Reset the 1-second inactivity timer
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            emitTypingEnd();
        }, 1000);
    };

    const handleSend = () => {
        const text = draft.trim();
        if (!text) return;

        // Stop typing before sending
        emitTypingEnd();

        onSend(text);
        setDraft("");
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        // Shift+Enter falls through to the textarea's default behaviour (newline).
    };

    // ── Typing indicator text ────────────────────────────────────────────────
    const typingText = (() => {
        const names = Array.from(typingUsers.values());
        if (names.length === 0) return null;
        if (names.length === 1) return `${names[0]} is typing...`;
        if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
        return "Several people are typing...";
    })();

    // ── Group messages by day ────────────────────────────────────────────────
    const sections: { label: string; items: ChatMessage[] }[] = [];
    messages.forEach((msg) => {
        const label = dayLabel(msg.timestamp);
        const last = sections[sections.length - 1];
        if (last && last.label === label) {
            last.items.push(msg);
        } else {
            sections.push({ label, items: [msg] });
        }
    });

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="chat-tab">
            <div className="chat-tab-header">
                <div>
                    <h2>Project chat</h2>
                    <p>Discuss updates, decisions, blockers, and everything related to this project.</p>
                </div>

                <div className="chat-meta">
                    <span>{members.length} {members.length === 1 ? "member" : "members"}</span>
                    <span>{messages.length} {messages.length === 1 ? "message" : "messages"}</span>
                </div>
            </div>

            <div className="chat-panel">
                <div className="chat-messages">
                    {messages.length === 0 ? (
                        <div className="empty-state">
                            <h3>Start the conversation</h3>
                            <p>Post an update, ask a question, or flag a blocker to get things moving.</p>
                        </div>
                    ) : (
                        <>
                            {sections.map((section, sectionIndex) => (
                                <div className="chat-day-section" key={`${section.label}-${sectionIndex}`}>
                                    <div className="chat-day-separator">
                                        <span>{section.label}</span>
                                    </div>

                                    {section.items.map((msg) => {
                                        const info = senderInfo(msg.senderInitials, members, userInitials, userFullName);
                                        const isSelf = msg.senderInitials === userInitials;

                                        return (
                                            <div className="chat-message" key={msg.id}>
                                                <div className="profile-avatar chat-avatar">
                                                    {msg.senderInitials}
                                                </div>

                                                <div className="chat-message-body">
                                                    <div className="chat-message-meta">
                                                        <strong>{isSelf ? "You" : info.name}</strong>
                                                        <span>{formatTime(msg.timestamp)}</span>
                                                    </div>
                                                    <p>{msg.text}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Typing indicator — shown above the composer, hidden when nobody is typing */}
                {typingText && (
                    <div
                        style={{
                            padding: "4px 22px",
                            fontSize: "12px",
                            color: "#6b7280",
                            fontStyle: "italic",
                            background: "#fcfbf8",
                            minHeight: "24px",
                        }}
                    >
                        {typingText}
                    </div>
                )}

                <div className="chat-composer">
                    <textarea
                        value={draft}
                        onChange={handleDraftChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Write a message..."
                        rows={1}
                    />
                    <button
                        type="button"
                        className="add-task-button"
                        onClick={handleSend}
                        disabled={!draft.trim()}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}