import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace("/api", "") 
  : "http://localhost:3000";

class SocketService {
  public socket: Socket | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        withCredentials: true,
      });

      this.socket.on("connect", () => {
        console.log("Socket connected:", this.socket?.id);
      });

      this.socket.on("disconnect", () => {
        console.log("Socket disconnected");
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
    if (this.socket) {
      this.socket.emit("joinProject", projectId);
    }
  }

  leaveProject(projectId: string) {
    if (this.socket) {
      this.socket.emit("leaveProject", projectId);
    }
  }

  joinChannel(channelId: string) {
    if (this.socket) {
      this.socket.emit("join_channel", channelId);
    }
  }

  leaveChannel(channelId: string) {
    if (this.socket) {
      this.socket.emit("leave_channel", channelId);
    }
  }

  joinUser(userId: string) {
    if (this.socket) {
      this.socket.emit("joinUser", userId);
    }
  }

  leaveUser(userId: string) {
    if (this.socket) {
      this.socket.emit("leaveUser", userId);
    }
  }

  emitTyping(channelId: string, userId: string, userName: string, isTyping: boolean) {
    if (this.socket) {
      const event = isTyping ? "typing_start" : "typing_end";
      this.socket.emit(event, { channelId, userId, userName });
    }
  }

  emitMarkRead(channelId: string, userId: string) {
    if (this.socket) {
      this.socket.emit("mark_read", { channelId, userId, readAt: new Date().toISOString() });
    }
  }
}

export const socketService = new SocketService();
