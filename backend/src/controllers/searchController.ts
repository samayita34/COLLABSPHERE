import { Request, Response } from "express";
import prisma from "../lib/prisma";

interface DateFilter {
    gte?: Date;
    lte?: Date;
}

/**
 * Helper to extract snippet around matching keyword for full-text search preview
 */
function createSnippet(text: string | null | undefined, query: string, maxLength: number = 160): string {
    if (!text) return "";
    if (!query.trim()) return text.slice(0, maxLength) + (text.length > maxLength ? "..." : "");

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase().trim();
    const matchIndex = lowerText.indexOf(lowerQuery);

    if (matchIndex === -1) {
        return text.slice(0, maxLength) + (text.length > maxLength ? "..." : "");
    }

    const start = Math.max(0, matchIndex - 60);
    const end = Math.min(text.length, matchIndex + lowerQuery.length + 100);
    let snippet = text.slice(start, end).trim();
    if (start > 0) snippet = "..." + snippet;
    if (end < text.length) snippet = snippet + "...";
    return snippet;
}

/**
 * GET /api/search
 * Global search across Tasks, Users, Documents, Chats, Files, Comments, and Workspaces.
 */
export const globalSearch = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const q = (req.query.q as string || "").trim();
        const category = (req.query.type || req.query.category || "all") as string;
        const workspaceId = req.query.workspaceId as string | undefined;
        const projectId = req.query.projectId as string | undefined;
        const filterUserId = req.query.userId as string | undefined;
        const startDateStr = req.query.startDate as string | undefined;
        const endDateStr = req.query.endDate as string | undefined;
        const limitParam = parseInt(req.query.limit as string, 10);
        const limit = isNaN(limitParam) || limitParam <= 0 ? 20 : Math.min(limitParam, 100);
        const pageParam = parseInt(req.query.page as string, 10);
        const page = isNaN(pageParam) || pageParam <= 0 ? 1 : pageParam;
        const skip = (page - 1) * limit;

        // Build date filter if provided
        let dateFilter: DateFilter | undefined = undefined;
        if (startDateStr || endDateStr) {
            dateFilter = {};
            if (startDateStr) {
                const s = new Date(startDateStr);
                if (!isNaN(s.getTime())) dateFilter.gte = s;
            }
            if (endDateStr) {
                const e = new Date(endDateStr);
                if (!isNaN(e.getTime())) {
                    if (endDateStr.length <= 10) {
                        e.setHours(23, 59, 59, 999);
                    }
                    dateFilter.lte = e;
                }
            }
            if (!dateFilter.gte && !dateFilter.lte) {
                dateFilter = undefined;
            }
        }

        // 1. Determine user accessible workspaces
        const userWorkspaceMemberships = await prisma.workspaceMember.findMany({
            where: { userId },
            select: { workspaceId: true, role: true }
        });

        let accessibleWorkspaceIds: string[] = userWorkspaceMemberships.map((m: any) => m.workspaceId);

        if (workspaceId) {
            if (!accessibleWorkspaceIds.includes(workspaceId)) {
                const ws = await prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    include: { organization: { include: { members: { where: { userId } } } } }
                });
                if (ws && ws.organization?.members?.length) {
                    accessibleWorkspaceIds = [workspaceId];
                } else {
                    res.status(403).json({ success: false, error: "Access denied to this workspace" });
                    return;
                }
            } else {
                accessibleWorkspaceIds = [workspaceId];
            }
        }

        // 2. Determine accessible projects
        const projectWhere: any = {
            workspaceId: { in: accessibleWorkspaceIds },
        };
        if (projectId) {
            projectWhere.id = projectId;
        }

        const accessibleProjects = await prisma.project.findMany({
            where: projectWhere,
            select: { id: true, name: true, code: true, workspaceId: true }
        });
        const accessibleProjectIds: string[] = accessibleProjects.map((p: any) => p.id);

        // 3. Determine accessible channels for chat search
        const channelMemberships = await prisma.channelMember.findMany({
            where: { userId },
            select: { channelId: true }
        });
        const directChannelIds: string[] = channelMemberships.map((cm: any) => cm.channelId);

        const openChannels = await prisma.channel.findMany({
            where: {
                OR: [
                    { workspaceId: { in: accessibleWorkspaceIds }, type: "WORKSPACE_GLOBAL" },
                    { projectId: { in: accessibleProjectIds }, type: "PROJECT" },
                    { id: { in: directChannelIds } }
                ]
            },
            select: { id: true }
        });
        const accessibleChannelIds: string[] = openChannels.map((c: any) => c.id);

        // Define search execution flags
        const shouldSearchAll = category === "all";
        const shouldSearchTasks = shouldSearchAll || category === "tasks";
        const shouldSearchUsers = shouldSearchAll || category === "users";
        const shouldSearchDocs = shouldSearchAll || category === "documents";
        const shouldSearchChats = shouldSearchAll || category === "chats";
        const shouldSearchFiles = shouldSearchAll || category === "files";
        const shouldSearchComments = shouldSearchAll || category === "comments";
        const shouldSearchWorkspaces = shouldSearchAll || category === "workspaces";

        const counts = {
            all: 0,
            tasks: 0,
            users: 0,
            documents: 0,
            chats: 0,
            files: 0,
            comments: 0,
            workspaces: 0
        };

        const results: {
            tasks: any[];
            users: any[];
            documents: any[];
            chats: any[];
            files: any[];
            comments: any[];
            workspaces: any[];
        } = {
            tasks: [],
            users: [],
            documents: [],
            chats: [],
            files: [],
            comments: [],
            workspaces: []
        };

        // Queries execution
        const tasksPromise = (async () => {
            if (!shouldSearchTasks || accessibleProjectIds.length === 0) return;
            const whereClause: any = {
                projectId: { in: accessibleProjectIds }
            };
            if (q) {
                whereClause.OR = [
                    { title: { contains: q, mode: "insensitive" } },
                    { description: { contains: q, mode: "insensitive" } }
                ];
            }
            if (filterUserId) {
                whereClause.assigneeId = filterUserId;
            }
            if (dateFilter) {
                whereClause.createdAt = dateFilter;
            }

            const [taskCount, taskItems] = await Promise.all([
                prisma.task.count({ where: whereClause }),
                prisma.task.findMany({
                    where: whereClause,
                    include: {
                        project: { select: { id: true, name: true, code: true, workspaceId: true } },
                        assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
                        column: { select: { id: true, name: true } },
                        labels: { include: { label: true } }
                    },
                    orderBy: { updatedAt: "desc" },
                    take: shouldSearchAll ? 10 : limit,
                    skip: shouldSearchAll ? 0 : skip
                })
            ]);

            counts.tasks = taskCount;
            results.tasks = taskItems.map((t: any) => ({
                id: t.id,
                type: "task",
                title: t.title,
                description: t.description,
                snippet: createSnippet(t.description || t.title, q),
                priority: t.priority,
                status: t.column?.name || "TODO",
                column: t.column,
                dueDate: t.dueDate,
                projectId: t.projectId,
                project: t.project,
                assignee: t.assignee,
                labels: (t.labels || []).map((l: any) => l.label),
                createdAt: t.createdAt,
                updatedAt: t.updatedAt
            }));
        })();

        const usersPromise = (async () => {
            if (!shouldSearchUsers) return;

            const userWhere: any = {
                workspaces: {
                    some: {
                        workspaceId: { in: accessibleWorkspaceIds }
                    }
                }
            };
            if (q) {
                userWhere.OR = [
                    { firstName: { contains: q, mode: "insensitive" } },
                    { lastName: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } }
                ];
            }
            if (filterUserId) {
                userWhere.id = filterUserId;
            }
            if (dateFilter) {
                userWhere.createdAt = dateFilter;
            }

            const [userCount, userItems] = await Promise.all([
                prisma.user.count({ where: userWhere }),
                prisma.user.findMany({
                    where: userWhere,
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatar: true,
                        role: true,
                        createdAt: true
                    },
                    orderBy: { firstName: "asc" },
                    take: shouldSearchAll ? 8 : limit,
                    skip: shouldSearchAll ? 0 : skip
                })
            ]);

            counts.users = userCount;
            results.users = userItems.map((u: any) => ({
                id: u.id,
                type: "user",
                name: `${u.firstName} ${u.lastName}`.trim(),
                firstName: u.firstName,
                lastName: u.lastName,
                email: u.email,
                avatar: u.avatar,
                role: u.role,
                createdAt: u.createdAt
            }));
        })();

        const documentsPromise = (async () => {
            if (!shouldSearchDocs || accessibleProjectIds.length === 0) return;
            const whereClause: any = {
                projectId: { in: accessibleProjectIds }
            };
            if (q) {
                whereClause.OR = [
                    { name: { contains: q, mode: "insensitive" } },
                    { description: { contains: q, mode: "insensitive" } },
                    { content: { contains: q, mode: "insensitive" } }
                ];
            }
            if (dateFilter) {
                whereClause.createdAt = dateFilter;
            }

            const [docCount, docItems] = await Promise.all([
                prisma.document.count({ where: whereClause }),
                prisma.document.findMany({
                    where: whereClause,
                    include: {
                        project: { select: { id: true, name: true, workspaceId: true } }
                    },
                    orderBy: { updatedAt: "desc" },
                    take: shouldSearchAll ? 10 : limit,
                    skip: shouldSearchAll ? 0 : skip
                })
            ]);

            counts.documents = docCount;
            results.documents = docItems.map((d: any) => ({
                id: d.id,
                type: "document",
                title: d.name,
                name: d.name,
                description: d.description,
                snippet: createSnippet(d.content || d.description || d.name, q),
                docType: d.type,
                owner: d.owner,
                size: d.size,
                projectId: d.projectId,
                project: d.project,
                createdAt: d.createdAt,
                updatedAt: d.updatedAt
            }));
        })();

        const chatsPromise = (async () => {
            if (!shouldSearchChats || accessibleChannelIds.length === 0) return;
            const whereClause: any = {
                channelId: { in: accessibleChannelIds }
            };
            if (q) {
                whereClause.text = { contains: q, mode: "insensitive" };
            }
            if (filterUserId) {
                whereClause.senderId = filterUserId;
            }
            if (dateFilter) {
                whereClause.createdAt = dateFilter;
            }

            const [chatCount, chatItems] = await Promise.all([
                prisma.chatMessage.count({ where: whereClause }),
                prisma.chatMessage.findMany({
                    where: whereClause,
                    include: {
                        sender: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
                        channel: { select: { id: true, name: true, type: true, workspaceId: true, projectId: true } }
                    },
                    orderBy: { createdAt: "desc" },
                    take: shouldSearchAll ? 10 : limit,
                    skip: shouldSearchAll ? 0 : skip
                })
            ]);

            counts.chats = chatCount;
            results.chats = chatItems.map((m: any) => ({
                id: m.id,
                type: "chat",
                title: m.text ? (m.text.length > 60 ? m.text.slice(0, 60) + "..." : m.text) : "Attachment",
                text: m.text,
                snippet: createSnippet(m.text, q),
                channelId: m.channelId,
                channel: m.channel,
                sender: m.sender,
                senderName: `${m.sender?.firstName || ""} ${m.sender?.lastName || ""}`.trim() || m.sender?.email,
                fileId: m.fileId,
                createdAt: m.createdAt
            }));
        })();

        const filesPromise = (async () => {
            if (!shouldSearchFiles || accessibleProjectIds.length === 0) return;
            const whereClause: any = {
                projectId: { in: accessibleProjectIds }
            };
            if (q) {
                whereClause.OR = [
                    { name: { contains: q, mode: "insensitive" } },
                    { description: { contains: q, mode: "insensitive" } }
                ];
            }
            if (dateFilter) {
                whereClause.createdAt = dateFilter;
            }

            const [fileCount, fileItems] = await Promise.all([
                prisma.file.count({ where: whereClause }),
                prisma.file.findMany({
                    where: whereClause,
                    include: {
                        project: { select: { id: true, name: true, workspaceId: true } },
                        folder: { select: { id: true, name: true } },
                        versions: { take: 1, orderBy: { versionNum: "desc" } }
                    },
                    orderBy: { updatedAt: "desc" },
                    take: shouldSearchAll ? 10 : limit,
                    skip: shouldSearchAll ? 0 : skip
                })
            ]);

            counts.files = fileCount;
            results.files = fileItems.map((f: any) => ({
                id: f.id,
                type: "file",
                title: f.name,
                name: f.name,
                fileType: f.type,
                description: f.description,
                snippet: createSnippet(f.description || f.name, q),
                projectId: f.projectId,
                project: f.project,
                folder: f.folder,
                isLocked: f.isLocked,
                latestVersion: f.versions[0] || null,
                createdAt: f.createdAt,
                updatedAt: f.updatedAt
            }));
        })();

        const commentsPromise = (async () => {
            if (!shouldSearchComments || accessibleProjectIds.length === 0) return;

            // 1. Task comments
            const taskCommentWhere: any = {
                task: { projectId: { in: accessibleProjectIds } }
            };
            if (q) {
                taskCommentWhere.text = { contains: q, mode: "insensitive" };
            }
            if (filterUserId) {
                taskCommentWhere.authorId = filterUserId;
            }
            if (dateFilter) {
                taskCommentWhere.createdAt = dateFilter;
            }

            // 2. Document comments
            const docCommentWhere: any = {
                document: { projectId: { in: accessibleProjectIds } }
            };
            if (q) {
                docCommentWhere.OR = [
                    { content: { contains: q, mode: "insensitive" } },
                    { highlightedText: { contains: q, mode: "insensitive" } }
                ];
            }
            if (filterUserId) {
                docCommentWhere.authorId = filterUserId;
            }
            if (dateFilter) {
                docCommentWhere.createdAt = dateFilter;
            }

            const [tcCount, dcCount, tcItems, dcItems] = await Promise.all([
                prisma.taskComment.count({ where: taskCommentWhere }),
                prisma.documentComment.count({ where: docCommentWhere }),
                prisma.taskComment.findMany({
                    where: taskCommentWhere,
                    include: {
                        author: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
                        task: {
                            select: {
                                id: true,
                                title: true,
                                projectId: true,
                                project: { select: { id: true, name: true, workspaceId: true } }
                            }
                        }
                    },
                    orderBy: { createdAt: "desc" },
                    take: shouldSearchAll ? 5 : limit,
                    skip: shouldSearchAll ? 0 : skip
                }),
                prisma.documentComment.findMany({
                    where: docCommentWhere,
                    include: {
                        author: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
                        document: {
                            select: {
                                id: true,
                                name: true,
                                projectId: true,
                                project: { select: { id: true, name: true, workspaceId: true } }
                            }
                        }
                    },
                    orderBy: { createdAt: "desc" },
                    take: shouldSearchAll ? 5 : limit,
                    skip: shouldSearchAll ? 0 : skip
                })
            ]);

            counts.comments = tcCount + dcCount;

            const mappedTaskComments = tcItems.map((c: any) => ({
                id: c.id,
                type: "comment",
                commentType: "task",
                title: `Comment on task: ${c.task?.title || "Task"}`,
                text: c.text,
                snippet: createSnippet(c.text, q),
                targetId: c.taskId,
                targetTitle: c.task?.title,
                projectId: c.task?.projectId,
                project: c.task?.project,
                author: c.author,
                authorName: `${c.author?.firstName || ""} ${c.author?.lastName || ""}`.trim() || c.author?.email,
                createdAt: c.createdAt
            }));

            const mappedDocComments = dcItems.map((c: any) => ({
                id: c.id,
                type: "comment",
                commentType: "document",
                title: `Comment on document: ${c.document?.name || "Document"}`,
                text: c.content,
                snippet: createSnippet(c.content, q),
                targetId: c.documentId,
                targetTitle: c.document?.name,
                highlightedText: c.highlightedText,
                projectId: c.document?.projectId,
                project: c.document?.project,
                author: c.author,
                authorName: `${c.author?.firstName || ""} ${c.author?.lastName || ""}`.trim() || c.author?.email,
                createdAt: c.createdAt
            }));

            const combined = [...mappedTaskComments, ...mappedDocComments]
                .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            results.comments = shouldSearchAll ? combined.slice(0, 8) : combined.slice(0, limit);
        })();

        const workspacesPromise = (async () => {
            if (!shouldSearchWorkspaces) return;

            const wsWhere: any = {
                id: { in: accessibleWorkspaceIds }
            };
            if (q) {
                wsWhere.OR = [
                    { name: { contains: q, mode: "insensitive" } },
                    { slug: { contains: q, mode: "insensitive" } },
                    { description: { contains: q, mode: "insensitive" } }
                ];
            }
            if (dateFilter) {
                wsWhere.createdAt = dateFilter;
            }

            const [wsCount, wsItems] = await Promise.all([
                prisma.workspace.count({ where: wsWhere }),
                prisma.workspace.findMany({
                    where: wsWhere,
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        description: true,
                        organizationId: true,
                        createdAt: true,
                        updatedAt: true
                    },
                    orderBy: { name: "asc" },
                    take: shouldSearchAll ? 6 : limit,
                    skip: shouldSearchAll ? 0 : skip
                })
            ]);

            counts.workspaces = wsCount;
            results.workspaces = wsItems.map((w: any) => ({
                id: w.id,
                type: "workspace",
                title: w.name,
                name: w.name,
                slug: w.slug,
                description: w.description,
                snippet: createSnippet(w.description || w.name, q),
                organizationId: w.organizationId,
                createdAt: w.createdAt,
                updatedAt: w.updatedAt
            }));
        })();

        await Promise.all([
            tasksPromise,
            usersPromise,
            documentsPromise,
            chatsPromise,
            filesPromise,
            commentsPromise,
            workspacesPromise
        ]);

        counts.all = counts.tasks + counts.users + counts.documents + counts.chats + counts.files + counts.comments + counts.workspaces;

        res.status(200).json({
            success: true,
            query: q,
            category,
            counts,
            results,
            pagination: {
                page,
                limit,
                total: counts[category as keyof typeof counts] || counts.all
            }
        });
    } catch (error: any) {
        console.error("globalSearch error:", error);
        res.status(500).json({ success: false, error: error.message || "Global search failed" });
    }
};

/**
 * GET /api/search/users
 * Search users within active workspace/organization for quick filtering or mention autocomplete.
 */
export const searchUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const q = (req.query.q as string || "").trim();
        const workspaceId = req.query.workspaceId as string | undefined;

        let userWhere: any = {};

        if (workspaceId) {
            userWhere.workspaces = { some: { workspaceId } };
        } else {
            // All workspaces user belongs to
            const memberships = await prisma.workspaceMember.findMany({
                where: { userId },
                select: { workspaceId: true }
            });
            const wsIds: string[] = memberships.map((m: any) => m.workspaceId);
            userWhere.workspaces = { some: { workspaceId: { in: wsIds } } };
        }

        if (q) {
            userWhere.OR = [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } }
            ];
        }

        const users = await prisma.user.findMany({
            where: userWhere,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                role: true
            },
            take: 20
        });

        res.status(200).json({
            success: true,
            users: users.map((u: any) => ({
                id: u.id,
                name: `${u.firstName} ${u.lastName}`.trim(),
                firstName: u.firstName,
                lastName: u.lastName,
                email: u.email,
                avatar: u.avatar,
                role: u.role
            }))
        });
    } catch (error: any) {
        console.error("searchUsers error:", error);
        res.status(500).json({ success: false, error: error.message || "User search failed" });
    }
};
