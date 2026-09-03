import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace("/api", "") 
  : "http://localhost:3000";

class SocketService {
  public socket: Socket | null = null;
  private currentUserId: string | null = null;
  private activeProjects: Set<string> = new Set();
  private activeChannels: Set<string> = new Set();

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        withCredentials: true,
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.socket.on("connect", () => {
        console.log("Socket connected:", this.socket?.id);
        if (this.currentUserId) {
          this.socket?.emit("joinUser", this.currentUserId);
        }
        this.activeProjects.forEach((projId) => {
          this.socket?.emit("joinProject", projId);
        });
        this.activeChannels.forEach((chanId) => {
          this.socket?.emit("join_channel", chanId);
        });
      });

      this.socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
      });

      this.socket.on("connect_error", (error) => {
        console.warn("Socket connection warning:", error.message);
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinProject(projectId: string) {
    if (!projectId) return;
    this.activeProjects.add(projectId);
    if (this.socket && this.socket.connected) {
      this.socket.emit("joinProject", projectId);
    }
  }

  leaveProject(projectId: string) {
    if (!projectId) return;
    this.activeProjects.delete(projectId);
    if (this.socket && this.socket.connected) {
      this.socket.emit("leaveProject", projectId);
    }
  }

  joinChannel(channelId: string) {
    if (!channelId) return;
    this.activeChannels.add(channelId);
    if (this.socket && this.socket.connected) {
      this.socket.emit("join_channel", channelId);
    }
  }

  leaveChannel(channelId: string) {
    if (!channelId) return;
    this.activeChannels.delete(channelId);
    if (this.socket && this.socket.connected) {
      this.socket.emit("leave_channel", channelId);
    }
  }

  joinUser(userId: string) {
    if (!userId) return;
    this.currentUserId = userId;
    if (this.socket && this.socket.connected) {
      this.socket.emit("joinUser", userId);
    }
  }

  leaveUser(userId: string) {
    if (this.currentUserId === userId) {
      this.currentUserId = null;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("leaveUser", userId);
    }
  }

  emitTyping(channelId: string, userId: string, userName: string, isTyping: boolean) {
    if (this.socket && this.socket.connected) {
      const event = isTyping ? "typing_start" : "typing_end";
      this.socket.emit(event, { channelId, userId, userName });
    }
  }

  emitMarkRead(channelId: string, userId: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("mark_read", { channelId, userId, readAt: new Date().toISOString() });
    }
  }
}

export const socketService = new SocketService();

