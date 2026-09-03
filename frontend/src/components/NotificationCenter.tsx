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
    type NotificationItem,
    type NotificationType,
} from "../services/notificationApi";
import "./NotificationCenter.css";

interface NotificationCenterProps {
    workspaceId?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ workspaceId }) => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
    const [filterByWorkspace, setFilterByWorkspace] = useState(false);
    const [toastNotification, setToastNotification] = useState<NotificationItem | null>(null);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


    const effectiveWorkspaceId = filterByWorkspace ? workspaceId : undefined;

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

    // Load notifications list
    const loadNotifications = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await fetchNotifications(effectiveWorkspaceId, 1, 40, activeTab === "unread");
            setNotifications(res.data);
            setUnreadCount(res.unreadCount);
        } catch (e) {
            console.error("Failed to load notifications:", e);
        } finally {
            setLoading(false);
        }
    }, [user, effectiveWorkspaceId, activeTab]);

    // Initial fetch and socket live events
    useEffect(() => {
        if (!user) return;

        loadUnreadCount();

        const socket = socketService.connect();
        socketService.joinUser(user.id);

        const handleNewNotif = (notif: NotificationItem) => {
            if (!notif || !notif.id) return;

            setNotifications((prev) => {
                if (prev.some((n) => n.id === notif.id)) {
                    return prev;
                }
                return [notif, ...prev];
            });

            setUnreadCount((prev) => prev + 1);

            // Trigger In-App live floating toast
            setToastNotification(notif);
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
            }
            toastTimerRef.current = setTimeout(() => {
                setToastNotification(null);
            }, 5500);
        };

        socket.on("notification:new", handleNewNotif);
        socket.on("notification", handleNewNotif);

        return () => {
            socket.off("notification:new", handleNewNotif);
            socket.off("notification", handleNewNotif);
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
            }
        };
    }, [user, loadUnreadCount]);

    // Refresh notifications when activeTab or filter changes while open
    useEffect(() => {
        if (isOpen) {
            loadNotifications();
        }
    }, [isOpen, activeTab, filterByWorkspace, loadNotifications]);

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

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case "TASK_ASSIGNED":
            case "TASK_UPDATED":
                return "📋";
            case "TASK_STATUS_CHANGED":
                return "🔄";
            case "TASK_OVERDUE":
                return "⚠️";
            case "TASK_PRIORITY_CHANGED":
                return "🔥";
            case "SUBTASK_COMPLETED":
                return "✅";
            case "TASK_COMMENT":
                return "💬";
            case "TASK_MENTION":
            case "MENTION":
                return "@";
            case "CHAT_MESSAGE":
                return "✉️";
            case "DOCUMENT_EDITED":
                return "📄";
            case "FILE_UPLOADED":
                return "📁";
            case "WORKSPACE_INVITATION":
            case "PROJECT_MEMBER_ADDED":
                return "👋";
            case "PROJECT_MEMBER_REMOVED":
                return "🚪";
            case "DUE_DATE_REMINDER":
                return "⏰";
            default:
                return "🔔";
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

    const displayedNotifications = activeTab === "unread" 
        ? notifications.filter(n => !n.isRead) 
        : notifications;

    const hasReadNotifications = notifications.some(n => n.isRead);

    return (
        <div className="notif-center-wrapper" ref={dropdownRef}>
            {/* Notification Bell Button */}
            <button
                className={`notif-bell-btn ${isOpen ? "active" : ""}`}
                onClick={toggleOpen}
                title="Notifications"
                aria-label="View notifications"
                aria-expanded={isOpen}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                    <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
            </button>

            {/* Notification Dropdown Panel */}
            {isOpen && (
                <div className="notif-dropdown">
                    {/* Header */}
                    <div className="notif-header">
                        <div className="notif-header-title">
                            <h3>Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="notif-unread-count-pill">{unreadCount} new</span>
                            )}
                        </div>

                        <div className="notif-header-actions">
                            {unreadCount > 0 && (
                                <button className="notif-header-btn" onClick={handleMarkAllRead} title="Mark all as read">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Mark all read
                                </button>
                            )}
                            {hasReadNotifications && (
                                <button className="notif-header-btn clear-btn" onClick={handleClearRead} title="Clear all read">
                                    Clear read
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filter Tabs & Scope */}
                    <div className="notif-tabs-bar">
                        <div className="notif-tabs">
                            <button
                                className={`notif-tab ${activeTab === "all" ? "active" : ""}`}
                                onClick={() => setActiveTab("all")}
                            >
                                All
                                <span className="notif-tab-count">{notifications.length}</span>
                            </button>
                            <button
                                className={`notif-tab ${activeTab === "unread" ? "active" : ""}`}
                                onClick={() => setActiveTab("unread")}
                            >
                                Unread
                                {unreadCount > 0 && (
                                    <span className="notif-tab-count unread">{unreadCount}</span>
                                )}
                            </button>
                        </div>

                        {workspaceId && (
                            <button
                                className={`notif-scope-toggle ${filterByWorkspace ? "active" : ""}`}
                                onClick={() => setFilterByWorkspace(!filterByWorkspace)}
                                title={filterByWorkspace ? "Showing current workspace only" : "Showing all workspaces"}
                            >
                                {filterByWorkspace ? "Current WS" : "All WS"}
                            </button>
                        )}
                    </div>

                    {/* Notifications List */}
                    <div className="notif-list">
                        {loading ? (
                            <div className="notif-loading">
                                <div className="notif-skeleton-item" />
                                <div className="notif-skeleton-item" />
                                <div className="notif-skeleton-item" />
                            </div>
                        ) : displayedNotifications.length === 0 ? (
                            <div className="notif-empty">
                                <div className="notif-empty-icon">
                                    {activeTab === "unread" ? "🎉" : "🔔"}
                                </div>
                                <div className="notif-empty-title">
                                    {activeTab === "unread" ? "You're all caught up!" : "No notifications yet"}
                                </div>
                                <div className="notif-empty-subtitle">
                                    {activeTab === "unread"
                                        ? "No new unread alerts at the moment."
                                        : "Activity updates and mentions will appear here."}
                                </div>
                            </div>
                        ) : (
                            displayedNotifications.map((notif) => (
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
                                    <div className={`notif-icon-box ${notif.type}`}>
                                        {getIcon(notif.type)}
                                    </div>

                                    <div className="notif-content">
                                        <div className="notif-content-top">
                                            <span className="notif-title">{notif.title}</span>
                                            <span className="notif-time">{formatTime(notif.createdAt)}</span>
                                        </div>
                                        <div className="notif-message">{notif.message}</div>
                                    </div>

                                    <div className="notif-actions">
                                        <button
                                            className="notif-action-btn"
                                            title={notif.isRead ? "Mark as unread" : "Mark as read"}
                                            onClick={(e) => handleToggleRead(e, notif)}
                                        >
                                            {notif.isRead ? (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="9" />
                                                </svg>
                                            ) : (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </button>
                                        <button
                                            className="notif-action-btn delete"
                                            title="Delete notification"
                                            onClick={(e) => handleDelete(e, notif.id, notif.isRead)}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    </div>

                                    {!notif.isRead && <div className="notif-unread-dot" />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Live Floating In-App Toast Alert */}
            {toastNotification && !isOpen && (
                <div
                    className="notif-floating-toast"
                    onClick={() => handleNotificationClick(toastNotification)}
                >
                    <div className={`notif-icon-box toast ${toastNotification.type}`}>
                        {getIcon(toastNotification.type)}
                    </div>
                    <div className="notif-toast-body">
                        <div className="notif-toast-title">{toastNotification.title}</div>
                        <div className="notif-toast-message">{toastNotification.message}</div>
                    </div>
                    <button
                        className="notif-toast-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            setToastNotification(null);
                        }}
                        title="Dismiss"
                    >
                        ✕
                    </button>
                    <div className="notif-toast-progress" />
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
