import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { socketService } from "../services/socket";
import {
    fetchNotifications,
    fetchUnreadCount,
    markNotificationAsRead,
    markNotificationAsUnread,
    markAllNotificationsAsRead,
    deleteNotification,
    clearReadNotifications,
    triggerTestNotificationApi,
    checkDueDatesApi,
    type NotificationItem,
    type NotificationType,
} from "../services/notificationApi";
import {
    Bell,
    Check,
    CheckCheck,
    Trash2,
    Volume2,
    VolumeX,
    ExternalLink,
    Play,
    Clock,
    X,
} from "lucide-react";
import "./NotificationCenter.css";

interface NotificationCenterProps {
    workspaceId?: string;
}

type CategoryFilter = "ALL" | "UNREAD" | "TASKS" | "MENTIONS" | "DOCUMENTS" | "FILES" | "CHAT" | "INVITATIONS";

const TEST_NOTIFICATION_TYPES: { type: NotificationType; label: string; icon: string }[] = [
    { type: "TASK_ASSIGNED", label: "Task Assigned", icon: "📋" },
    { type: "TASK_UPDATED", label: "Task Updated", icon: "✏️" },
    { type: "MENTION", label: "Mention", icon: "@" },
    { type: "DOCUMENT_EDITED", label: "Document Edited", icon: "📄" },
    { type: "FILE_UPLOADED", label: "File Uploaded", icon: "📁" },
    { type: "CHAT_MESSAGE", label: "Chat Message", icon: "💬" },
    { type: "WORKSPACE_INVITATION", label: "Workspace Invitation", icon: "👋" },
    { type: "DUE_DATE_REMINDER", label: "Due Date Reminder", icon: "⏰" },
];

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ workspaceId }) => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [activeCategory, setActiveCategory] = useState<CategoryFilter>("ALL");
    const [filterByWorkspace, setFilterByWorkspace] = useState(false);
    const [toastNotification, setToastNotification] = useState<NotificationItem | null>(null);
    const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
        const saved = localStorage.getItem("collabsphere_notif_sound");
        return saved !== null ? saved === "true" : true;
    });

    const [testType, setTestType] = useState<NotificationType>("TASK_ASSIGNED");
    const [isTriggeringTest, setIsTriggeringTest] = useState(false);
    const [isCheckingDueDates, setIsCheckingDueDates] = useState(false);
    const [statusBanner, setStatusBanner] = useState<string | null>(null);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const effectiveWorkspaceId = filterByWorkspace ? workspaceId : undefined;

    // Web Audio synthesizer chime
    const playChime = useCallback(() => {
        if (!soundEnabled) return;
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            const ctx = new AudioContextClass();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        } catch (e) {
            // AudioContext restrictions before user interaction
        }
    }, [soundEnabled]);

    const toggleSound = () => {
        const next = !soundEnabled;
        setSoundEnabled(next);
        localStorage.setItem("collabsphere_notif_sound", String(next));
        if (next) {
            playChime();
        }
    };

    // Load unread count
    const loadUnreadCount = useCallback(async () => {
        if (!user) return;
        try {
            const count = await fetchUnreadCount(effectiveWorkspaceId);
            setUnreadCount(count);
        } catch (e) {
            console.error("Failed to fetch unread count:", e);
        }
    }, [user, effectiveWorkspaceId]);

    // Load notifications list with category filtering
    const loadNotifications = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const unreadOnly = activeCategory === "UNREAD";
            const cat = activeCategory === "ALL" || activeCategory === "UNREAD" ? undefined : activeCategory;
            const res = await fetchNotifications(effectiveWorkspaceId, 1, 40, unreadOnly, cat);
            setNotifications(res.data);
            setUnreadCount(res.unreadCount);
        } catch (e) {
            console.error("Failed to load notifications:", e);
        } finally {
            setLoading(false);
        }
    }, [user, effectiveWorkspaceId, activeCategory]);

    // Initial fetch and real-time socket events
    useEffect(() => {
        if (!user) return;

        loadUnreadCount();

        const socket = socketService.connect();
        socketService.joinUser(user.id);

        const handleNewNotif = (notif: NotificationItem) => {
            if (!notif || !notif.id) return;

            setNotifications((prev) => {
                if (prev.some((n) => n.id === notif.id)) return prev;
                return [notif, ...prev];
            });

            setUnreadCount((prev) => prev + 1);

            // Play audio notification chime
            playChime();

            // Trigger In-App floating toast
            setToastNotification(notif);
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => {
                setToastNotification(null);
            }, 6000);
        };

        socket.on("notification:new", handleNewNotif);
        socket.on("notification", handleNewNotif);

        return () => {
            socket.off("notification:new", handleNewNotif);
            socket.off("notification", handleNewNotif);
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, [user, loadUnreadCount, playChime]);

    // Reload notifications when open or category changes
    useEffect(() => {
        if (isOpen) {
            loadNotifications();
        }
    }, [isOpen, activeCategory, filterByWorkspace, loadNotifications]);

    // Close on outside click or ESC key
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
                setToastNotification(null);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    const toggleOpen = () => {
        if (!isOpen) {
            loadNotifications();
        }
        setIsOpen(!isOpen);
    };

    const handleNotificationClick = async (notif: NotificationItem) => {
        if (!notif.isRead) {
            try {
                await markNotificationAsRead(notif.id);
                setNotifications((prev) =>
                    prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
                );
                setUnreadCount((prev) => Math.max(0, prev - 1));
            } catch (e) {
                console.error("Failed to mark notification as read:", e);
            }
        }
        if (notif.link) {
            setIsOpen(false);
            setToastNotification(null);
            navigate(notif.link);
        }
    };

    const handleToggleRead = async (e: React.MouseEvent, notif: NotificationItem) => {
        e.stopPropagation();
        try {
            if (notif.isRead) {
                await markNotificationAsUnread(notif.id);
                setNotifications((prev) =>
                    prev.map((n) => (n.id === notif.id ? { ...n, isRead: false } : n))
                );
                setUnreadCount((prev) => prev + 1);
            } else {
                await markNotificationAsRead(notif.id);
                setNotifications((prev) =>
                    prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
                );
                setUnreadCount((prev) => Math.max(0, prev - 1));
            }
        } catch (e) {
            console.error("Failed to toggle read state:", e);
        }
    };

    const handleDelete = async (e: React.MouseEvent, notifId: string, wasRead: boolean) => {
        e.stopPropagation();
        try {
            await deleteNotification(notifId);
            setNotifications((prev) => prev.filter((n) => n.id !== notifId));
            if (!wasRead) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
            }
        } catch (e) {
            console.error("Failed to delete notification:", e);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsAsRead(effectiveWorkspaceId);
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (e) {
            console.error("Failed to mark all read:", e);
        }
    };

    const handleClearRead = async () => {
        try {
            await clearReadNotifications(effectiveWorkspaceId);
            setNotifications((prev) => prev.filter((n) => !n.isRead));
        } catch (e) {
            console.error("Failed to clear read notifications:", e);
        }
    };

    // On-demand Trigger Test Notification
    const handleTriggerTest = async () => {
        setIsTriggeringTest(true);
        setStatusBanner(null);
        try {
            const item = TEST_NOTIFICATION_TYPES.find((t) => t.type === testType);
            await triggerTestNotificationApi({
                type: testType,
                title: item?.label || "New Alert",
                message: `Simulated ${item?.label || "alert"} delivered via Real-time Socket.IO and In-App delivery.`,
                link: workspaceId ? `/projects` : undefined,
                workspaceId: effectiveWorkspaceId,
            });
            setStatusBanner(`Triggered test "${item?.label}"!`);
            setTimeout(() => setStatusBanner(null), 3500);
            loadNotifications();
        } catch (e: any) {
            alert(e.message || "Failed to trigger test notification");
        } finally {
            setIsTriggeringTest(false);
        }
    };

    // On-demand Check Due Dates
    const handleCheckDueDates = async () => {
        setIsCheckingDueDates(true);
        setStatusBanner(null);
        try {
            await checkDueDatesApi();
            setStatusBanner("Checked tasks for due date & overdue reminders!");
            setTimeout(() => setStatusBanner(null), 3500);
            loadNotifications();
        } catch (e: any) {
            alert(e.message || "Failed to check due dates");
        } finally {
            setIsCheckingDueDates(false);
        }
    };

    const getIconAndTag = (type: NotificationType) => {
        switch (type) {
            case "TASK_ASSIGNED":
                return { icon: "📋", tag: "Task Assigned", color: "#3b82f6" };
            case "TASK_UPDATED":
                return { icon: "✏️", tag: "Task Updated", color: "#6366f1" };
            case "TASK_STATUS_CHANGED":
                return { icon: "🔄", tag: "Status Changed", color: "#06b6d4" };
            case "TASK_OVERDUE":
                return { icon: "⚠️", tag: "Task Overdue", color: "#ef4444" };
            case "TASK_PRIORITY_CHANGED":
                return { icon: "🔥", tag: "Priority Changed", color: "#f97316" };
            case "DUE_DATE_REMINDER":
                return { icon: "⏰", tag: "Due Soon", color: "#eab308" };
            case "SUBTASK_COMPLETED":
                return { icon: "✅", tag: "Checklist", color: "#10b981" };
            case "TASK_COMMENT":
                return { icon: "💬", tag: "Task Comment", color: "#8b5cf6" };
            case "TASK_MENTION":
            case "MENTION":
                return { icon: "@", tag: "Mention", color: "#ec4899" };
            case "DOCUMENT_EDITED":
                return { icon: "📄", tag: "Doc Edited", color: "#0ea5e9" };
            case "FILE_UPLOADED":
                return { icon: "📁", tag: "File Uploaded", color: "#14b8a6" };
            case "CHAT_MESSAGE":
                return { icon: "💬", tag: "Chat Message", color: "#10b981" };
            case "WORKSPACE_INVITATION":
            case "PROJECT_MEMBER_ADDED":
                return { icon: "👋", tag: "Invitation", color: "#a855f7" };
            case "PROJECT_MEMBER_REMOVED":
                return { icon: "🚪", tag: "Removed", color: "#64748b" };
            default:
                return { icon: "🔔", tag: "Notification", color: "#64748b" };
        }
    };

    const formatTime = (isoString: string) => {
        if (!isoString) return "";
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };

    const hasReadNotifications = notifications.some((n) => n.isRead);

    return (
        <div className="notif-center-wrapper" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                className={`notif-bell-btn ${isOpen ? "active" : ""}`}
                onClick={toggleOpen}
                title="Notifications"
                aria-label="View notifications"
                aria-expanded={isOpen}
            >
                <Bell size={19} />
                {unreadCount > 0 && (
                    <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="notif-dropdown">
                    {/* Header */}
                    <div className="notif-header">
                        <div className="notif-header-title">
                            <h3>Smart Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="notif-unread-count-pill">{unreadCount} new</span>
                            )}
                        </div>

                        <div className="notif-header-actions">
                            {workspaceId && (
                                <button
                                    type="button"
                                    className={`notif-header-btn ${filterByWorkspace ? "sound-on" : ""}`}
                                    onClick={() => setFilterByWorkspace((prev) => !prev)}
                                    title={filterByWorkspace ? "Showing current workspace only (Click to show all)" : "Showing all workspaces (Click to filter to current)"}
                                    style={{ fontSize: "11px" }}
                                >
                                    {filterByWorkspace ? "This WS" : "All WS"}
                                </button>
                            )}

                            <button
                                className={`notif-header-btn ${soundEnabled ? "sound-on" : ""}`}
                                onClick={toggleSound}
                                title={soundEnabled ? "Mute notification sounds" : "Unmute notification sounds"}
                            >
                                {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                            </button>

                            {unreadCount > 0 && (
                                <button className="notif-header-btn" onClick={handleMarkAllRead} title="Mark all as read">
                                    <CheckCheck size={13} />
                                    <span>Read all</span>
                                </button>
                            )}

                            {hasReadNotifications && (
                                <button className="notif-header-btn clear-btn" onClick={handleClearRead} title="Clear all read">
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Status Banner */}
                    {statusBanner && (
                        <div className="notif-status-banner">
                            <span>{statusBanner}</span>
                        </div>
                    )}

                    {/* Category Filter Tabs Bar */}
                    <div className="notif-category-bar">
                        <div className="notif-category-scroll">
                            <button
                                className={`notif-cat-pill ${activeCategory === "ALL" ? "active" : ""}`}
                                onClick={() => setActiveCategory("ALL")}
                            >
                                All
                            </button>
                            <button
                                className={`notif-cat-pill ${activeCategory === "UNREAD" ? "active" : ""}`}
                                onClick={() => setActiveCategory("UNREAD")}
                            >
                                Unread {unreadCount > 0 && `(${unreadCount})`}
                            </button>
                            <button
                                className={`notif-cat-pill ${activeCategory === "TASKS" ? "active" : ""}`}
                                onClick={() => setActiveCategory("TASKS")}
                            >
                                📋 Tasks
                            </button>
                            <button
                                className={`notif-cat-pill ${activeCategory === "MENTIONS" ? "active" : ""}`}
                                onClick={() => setActiveCategory("MENTIONS")}
                            >
                                @ Mentions
                            </button>
                            <button
                                className={`notif-cat-pill ${activeCategory === "DOCUMENTS" ? "active" : ""}`}
                                onClick={() => setActiveCategory("DOCUMENTS")}
                            >
                                📄 Docs
                            </button>
                            <button
                                className={`notif-cat-pill ${activeCategory === "FILES" ? "active" : ""}`}
                                onClick={() => setActiveCategory("FILES")}
                            >
                                📁 Files
                            </button>
                            <button
                                className={`notif-cat-pill ${activeCategory === "CHAT" ? "active" : ""}`}
                                onClick={() => setActiveCategory("CHAT")}
                            >
                                💬 Chat
                            </button>
                            <button
                                className={`notif-cat-pill ${activeCategory === "INVITATIONS" ? "active" : ""}`}
                                onClick={() => setActiveCategory("INVITATIONS")}
                            >
                                👋 Invites
                            </button>
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="notif-list">
                        {loading ? (
                            <div className="notif-loading">
                                <div className="notif-skeleton-item" />
                                <div className="notif-skeleton-item" />
                                <div className="notif-skeleton-item" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="notif-empty">
                                <div className="notif-empty-icon">
                                    {activeCategory === "UNREAD" ? "🎉" : "🔔"}
                                </div>
                                <div className="notif-empty-title">
                                    {activeCategory === "UNREAD" ? "You're all caught up!" : "No notifications"}
                                </div>
                                <div className="notif-empty-subtitle">
                                    {activeCategory === "UNREAD"
                                        ? "No new unread alerts at the moment."
                                        : "Activity updates, reminders, and mentions will appear here."}
                                </div>
                            </div>
                        ) : (
                            notifications.map((notif) => {
                                const { icon, tag, color } = getIconAndTag(notif.type);

                                return (
                                    <div
                                        key={notif.id}
                                        className={`notif-item ${!notif.isRead ? "unread" : ""}`}
                                        onClick={() => handleNotificationClick(notif)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                handleNotificationClick(notif);
                                            }
                                        }}
                                    >
                                        <div className="notif-icon-box" style={{ backgroundColor: `${color}18`, color }}>
                                            {icon}
                                        </div>

                                        <div className="notif-content">
                                            <div className="notif-content-top">
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                    <span className="notif-title">{notif.title}</span>
                                                    <span className="notif-type-tag" style={{ color, borderColor: `${color}40` }}>
                                                        {tag}
                                                    </span>
                                                </div>
                                                <span className="notif-time">{formatTime(notif.createdAt)}</span>
                                            </div>
                                            <div className="notif-message">{notif.message}</div>
                                        </div>

                                        <div className="notif-actions" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                className="notif-action-btn"
                                                title={notif.isRead ? "Mark as unread" : "Mark as read"}
                                                onClick={(e) => handleToggleRead(e, notif)}
                                            >
                                                {notif.isRead ? <Check size={13} color="#94a3b8" /> : <Check size={13} color="#2563eb" />}
                                            </button>
                                            <button
                                                className="notif-action-btn delete"
                                                title="Delete notification"
                                                onClick={(e) => handleDelete(e, notif.id, notif.isRead)}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>

                                        {!notif.isRead && <div className="notif-unread-dot" />}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer: Live Test & Due Date Tools */}
                    <div className="notif-footer-tools">
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1 }}>
                            <select
                                value={testType}
                                onChange={(e) => setTestType(e.target.value as NotificationType)}
                                className="notif-test-select"
                                title="Select notification type to test"
                            >
                                {TEST_NOTIFICATION_TYPES.map((t) => (
                                    <option key={t.type} value={t.type}>
                                        {t.icon} {t.label}
                                    </option>
                                ))}
                            </select>

                            <button
                                type="button"
                                onClick={handleTriggerTest}
                                disabled={isTriggeringTest}
                                className="notif-test-btn"
                                title="Send live test notification via Socket.IO"
                            >
                                <Play size={11} /> {isTriggeringTest ? "Sending..." : "Test"}
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleCheckDueDates}
                            disabled={isCheckingDueDates}
                            className="notif-check-due-btn"
                            title="Scan all tasks for due date & overdue alerts"
                        >
                            <Clock size={11} /> {isCheckingDueDates ? "Scanning..." : "Check Due Dates"}
                        </button>
                    </div>
                </div>
            )}

            {/* Real-Time Floating In-App Toast Alert */}
            {toastNotification && !isOpen && (
                <div
                    className="notif-floating-toast"
                    onClick={() => handleNotificationClick(toastNotification)}
                >
                    <div className="notif-toast-icon">
                        {getIconAndTag(toastNotification.type).icon}
                    </div>
                    <div className="notif-toast-body">
                        <div className="notif-toast-header">
                            <span className="notif-toast-title">{toastNotification.title}</span>
                            <span className="notif-toast-tag">
                                {getIconAndTag(toastNotification.type).tag}
                            </span>
                        </div>
                        <div className="notif-toast-message">{toastNotification.message}</div>
                    </div>
                    {toastNotification.link && (
                        <span className="notif-toast-action" title="Open resource">
                            <ExternalLink size={13} />
                        </span>
                    )}
                    <button
                        className="notif-toast-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            setToastNotification(null);
                        }}
                        title="Dismiss alert"
                    >
                        <X size={14} />
                    </button>
                    <div className="notif-toast-progress" />
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
