import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import * as Y from "yjs";
// @ts-ignore
import { setupWSConnection } from "y-websocket/bin/utils";
import prisma from "./lib/prisma";

export function initCollaborationServer(server: http.Server) {
    // Create a WebSocket server attached to the HTTP server
    // We'll use a specific path for collaboration
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
        // Only handle paths starting with /api/collaboration
        if (request.url?.startsWith("/api/collaboration/")) {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit("connection", ws, request);
            });
        }
    });

    wss.on("connection", (ws, req) => {
        // request.url is e.g., /api/collaboration/document-id
        const docName = req.url?.split("/").pop() || "default";

        // `setupWSConnection` handles the Yjs syncing protocol and awareness
        setupWSConnection(ws, req, { docName });

        // Retrieve the document from y-websocket memory
        const docs = require("y-websocket/bin/utils").docs;
        const ydoc = docs.get(docName) as Y.Doc;

        if (ydoc) {
            // Load initial state from DB if it's the first time
            if (!(ydoc as any).customSettings?.isLoaded) {
                (ydoc as any).customSettings = { isLoaded: true };
                prisma.document.findUnique({ where: { id: docName } }).then((doc: any) => {
                    if (doc && doc.ydocState) {
                        Y.applyUpdate(ydoc, new Uint8Array(doc.ydocState));
                    }
                }).catch((err: any) => console.error("Error loading ydoc from DB:", err));
            }

            // Debounced save to Prisma
            ydoc.on("update", () => {
                if ((ydoc as any).customSettings.saveTimeout) {
                    clearTimeout((ydoc as any).customSettings.saveTimeout);
                }
                (ydoc as any).customSettings.saveTimeout = setTimeout(async () => {
                    try {
                        const stateVector = Y.encodeStateAsUpdate(ydoc);
                        await prisma.document.update({
                            where: { id: docName },
                            data: { ydocState: Buffer.from(stateVector) },
                        });
                    } catch (error) {
                        console.error(`Failed to save document ${docName} to DB:`, error);
                    }
                }, 2000); // Debounce save every 2 seconds
            });
        }
    });

    console.log("Collaboration (Yjs) WebSocket server initialized on /api/collaboration/*");
}
