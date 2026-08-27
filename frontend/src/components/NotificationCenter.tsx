import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { socket } from "../services/socket";
import {
    fetchNotifications,
    fetchUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    NotificationItem,
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
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Initial fetch of unread count
    const loadUnreadCount = async () => {
        try {
            const count = await fetchUnreadCount();
            setUnreadCount(count);
        } catch (e) {
            console.error("Failed to fetch unread count:", e);
        }
    };

    // Load notification list
    const loadNotifications = async () => {
        setLoading(true);
        try {
            const res = await fetchNotifications(workspaceId, 1, 20);
            setNotifications(res.data);
            setUnreadCount(res.unreadCount);
        } catch (e) {
            console.error("Failed to load notifications:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user) return;

        loadUnreadCount();

        // Join socket user room for live updates
        socket.emit("joinUser", user.id);

        const handleNewNotif = (notif: NotificationItem) => {
            setNotifications((prev) => [notif, ...prev]);
            setUnreadCount((prev) => prev + 1);
        };

        socket.on("notification:new", handleNewNotif);
        socket.on("notification", handleNewNotif);

        return () => {
            socket.off("notification:new", handleNewNotif);
            socket.off("notification", handleNewNotif);
        };
    }, [user, workspaceId]);

    // Handle outside click to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
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
            navigate(notif.link);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsAsRead(workspaceId);
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (e) {
            console.error("Failed to mark all read:", e);
        }
    };

    const getIcon = (type: NotificationItem["type"]) => {
        switch (type) {
            case "TASK_ASSIGNED":
            case "TASK_UPDATED":
                return "📋";
            case "DOCUMENT_EDITED":
                return "📄";
            case "FILE_UPLOADED":
                return "📁";
            case "MENTION":
                return "@";
            case "WORKSPACE_INVITATION":
                return "👋";
            default:
                return "🔔";
        }
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    return (
        <div className="notif-center-wrapper" ref={dropdownRef}>
            <button className="notif-bell-btn" onClick={toggleOpen} title="Notifications">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                    <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <div className="notif-dropdown">
                    <div className="notif-header">
                        <h3>Notifications</h3>
                        {unreadCount > 0 && (
                            <button className="mark-all-btn" onClick={handleMarkAllRead}>
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="notif-list">
                        {loading ? (
                            <div className="notif-empty">Loading notifications...</div>
                        ) : notifications.length === 0 ? (
                            <div className="notif-empty">No notifications yet</div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={`notif-item ${!notif.isRead ? "unread" : ""}`}
                                    onClick={() => handleNotificationClick(notif)}
                                >
                                    <div className={`notif-icon ${notif.type}`}>
                                        {getIcon(notif.type)}
                                    </div>
                                    <div className="notif-content">
                                        <div className="notif-title">{notif.title}</div>
                                        <div className="notif-message">{notif.message}</div>
                                        <div className="notif-time">{formatTime(notif.createdAt)}</div>
                                    </div>
                                    {!notif.isRead && <div className="unread-dot" />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
