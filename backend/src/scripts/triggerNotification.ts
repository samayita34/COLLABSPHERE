import prisma from "../lib/prisma";
import { io as ioClient } from "socket.io-client";
import { NotificationType } from "../../generated/prisma/enums";

async function main() {
    console.log("Connecting to live backend socket...");
    const socket = ioClient("http://localhost:3000", {
        withCredentials: true,
        transports: ["websocket", "polling"],
    });

    await new Promise((resolve) => {
        socket.on("connect", () => {
            console.log("Connected to live server with socket id:", socket.id);
            resolve(true);
        });
        setTimeout(() => resolve(false), 2000);
    });

    console.log("Fetching users from DB...");
    const users = await prisma.user.findMany({
        select: { id: true, email: true, firstName: true, lastName: true },
    });

    console.log(`Found ${users.length} users.`);

    for (const user of users) {
        console.log(`Creating and broadcasting live notification for ${user.firstName} (${user.email})...`);

        // 1. Task Assigned Notification
        const notif1 = await prisma.notification.create({
            data: {
                userId: user.id,
                type: NotificationType.TASK_ASSIGNED,
                title: "New Task Assigned 🚀",
                message: "You have been assigned to 'Design System & Notification Hub'.",
                link: "/projects",
                isRead: false,
            },
        });
        socket.emit("broadcast_notification", { userId: user.id, notification: notif1 });

        // 2. Chat/Comment Mention Notification
        const notif2 = await prisma.notification.create({
            data: {
                userId: user.id,
                type: NotificationType.TASK_COMMENT,
                title: "New Comment from Alex 💬",
                message: "Alex commented: 'The new notification center looks gorgeous and works seamlessly!'",
                link: "/projects",
                isRead: false,
            },
        });
        socket.emit("broadcast_notification", { userId: user.id, notification: notif2 });

        // 3. Workspace Welcome Notification
        const notif3 = await prisma.notification.create({
            data: {
                userId: user.id,
                type: NotificationType.WORKSPACE_INVITATION,
                title: "Welcome to CollabSphere 👋",
                message: "You have been added to the Core Engineering workspace.",
                link: "/dashboard",
                isRead: false,
            },
        });
        socket.emit("broadcast_notification", { userId: user.id, notification: notif3 });
    }

    // Give socket 1.5s to deliver all messages
    await new Promise((resolve) => setTimeout(resolve, 1500));
    socket.disconnect();

    console.log("All real-time notifications created and dispatched to live clients!");
    process.exit(0);
}

main().catch((err) => {
    console.error("Error triggering notifications:", err);
    process.exit(1);
});
