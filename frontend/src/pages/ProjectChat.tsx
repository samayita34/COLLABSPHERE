import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAuth } from "../context/AuthContext";

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

export default function ProjectChat({ members, messages, onSend }: ProjectChatProps) {
    const { userInitials, userFullName } = useAuth();
    const [draft, setDraft] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to the newest message whenever the conversation grows.
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ block: "end" });
    }, [messages.length]);

    const handleSend = () => {
        const text = draft.trim();
        if (!text) return;
        onSend(text);
        setDraft("");
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        // Shift+Enter falls through to the textarea's default behavior (newline).
    };

    // Group messages into contiguous same-day sections for date separators.
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

                <div className="chat-composer">
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
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