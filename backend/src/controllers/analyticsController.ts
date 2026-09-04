import { Request, Response } from "express";
import prisma from "../lib/prisma";

/**
 * GET /api/workspaces/:id/analytics?period=7d|30d|90d|1y
 */
export const getWorkspaceAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const periodParam = (req.query.period as string) || "30d";

        // Determine days count
        let days = 30;
        if (periodParam === "7d") days = 7;
        else if (periodParam === "90d") days = 90;
        else if (periodParam === "1y") days = 365;

        const now = new Date();
        const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const prevPeriodStart = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000);

        // Ensure workspace exists
        const workspace = await prisma.workspace.findUnique({
            where: { id },
            include: {
                projects: true,
                members: {
                    include: {
                        user: {
                            select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true }
                        }
                    }
                },
            },
        });

        if (!workspace) {
            res.status(404).json({ success: false, error: "Workspace not found" });
            return;
        }

        const projectIds: string[] = workspace.projects.map((p: any) => p.id);

        // Columns resolution for completion
        const allColumns = await prisma.column.findMany({
            where: { board: { projectId: { in: projectIds } } },
            select: { id: true, name: true }
        });

        const completedColNames = ["done", "completed", "finished", "resolved", "complete"];
        const completedColumnIds: string[] = allColumns
            .filter((c: any) => completedColNames.includes(c.name.toLowerCase().trim()))
            .map((c: any) => c.id);

        // 1. Task Completion Rate & Status Metrics
        const [
            totalTasks,
            completedTasks,
            inProgressTasks,
            lowPriority,
            medPriority,
            highPriority,
            overdueTasks,
            prevCompletedTasks,
            prevTotalTasks
        ] = await Promise.all([
            prisma.task.count({ where: { projectId: { in: projectIds } } }),
            prisma.task.count({
                where: {
                    projectId: { in: projectIds },
                    columnId: { in: completedColumnIds }
                }
            }),
            prisma.task.count({
                where: {
                    projectId: { in: projectIds },
                    column: {
                        name: {
                            contains: "progress",
                            mode: "insensitive"
                        }
                    }
                }
            }),
            prisma.task.count({ where: { projectId: { in: projectIds }, priority: "LOW" } }),
            prisma.task.count({ where: { projectId: { in: projectIds }, priority: "MEDIUM" } }),
            prisma.task.count({ where: { projectId: { in: projectIds }, priority: "HIGH" } }),
            prisma.task.count({
                where: {
                    projectId: { in: projectIds },
                    dueDate: { lt: now },
                    NOT: { columnId: { in: completedColumnIds } }
                }
            }),
            // Previous period comparison
            prisma.task.count({
                where: {
                    projectId: { in: projectIds },
                    columnId: { in: completedColumnIds },
                    updatedAt: { gte: prevPeriodStart, lt: periodStart }
                }
            }),
            prisma.task.count({
                where: {
                    projectId: { in: projectIds },
                    createdAt: { lt: periodStart }
                }
            })
        ]);

        const taskCompletionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
        const prevRate = prevTotalTasks > 0 ? prevCompletedTasks / prevTotalTasks : 0;
        const rateChange = Math.round((taskCompletionRate - prevRate) * 1000) / 10; // e.g. +4.2%

        const todoTasks = Math.max(0, totalTasks - completedTasks - inProgressTasks);

        // 2. Productivity Trends (Time Series)
        const [recentCompletedTasks, recentCreatedTasks] = await Promise.all([
            prisma.task.findMany({
                where: {
                    projectId: { in: projectIds },
                    columnId: { in: completedColumnIds },
                    updatedAt: { gte: periodStart }
                },
                select: { updatedAt: true }
            }),
            prisma.task.findMany({
                where: {
                    projectId: { in: projectIds },
                    createdAt: { gte: periodStart }
                },
                select: { createdAt: true }
            })
        ]);

        // Bucket by day (or every 3 days if 90d/1y for cleaner points)
        const bucketCount = Math.min(days, 30);
        const intervalMs = (days * 24 * 60 * 60 * 1000) / bucketCount;

        const productivityTrends = Array.from({ length: bucketCount }, (_, i) => {
            const bStart = new Date(periodStart.getTime() + i * intervalMs);
            return {
                date: bStart.toISOString().split("T")[0],
                completed: 0,
                created: 0,
            };
        });

        recentCompletedTasks.forEach((t: any) => {
            const tTime = new Date(t.updatedAt).getTime();
            const bIdx = Math.min(
                bucketCount - 1,
                Math.max(0, Math.floor((tTime - periodStart.getTime()) / intervalMs))
            );
            if (productivityTrends[bIdx]) productivityTrends[bIdx].completed += 1;
        });

        recentCreatedTasks.forEach((t: any) => {
            const tTime = new Date(t.createdAt).getTime();
            const bIdx = Math.min(
                bucketCount - 1,
                Math.max(0, Math.floor((tTime - periodStart.getTime()) / intervalMs))
            );
            if (productivityTrends[bIdx]) productivityTrends[bIdx].created += 1;
        });

        const totalCompletedInPeriod = recentCompletedTasks.length;
        const totalCreatedInPeriod = recentCreatedTasks.length;
        const avgCompletionVelocity = days > 0 ? Math.round((totalCompletedInPeriod / days) * 10) / 10 : 0;

        let peakDay = { date: "", count: 0 };
        productivityTrends.forEach((pt) => {
            if (pt.completed > peakDay.count) {
                peakDay = { date: pt.date, count: pt.completed };
            }
        });

        // 3. Team Performance
        const [memberCompletedTasks, memberAssignedTasks, memberComments] = await Promise.all([
            prisma.task.groupBy({
                by: ["assigneeId"],
                where: {
                    projectId: { in: projectIds },
                    columnId: { in: completedColumnIds },
                    assigneeId: { not: null }
                },
                _count: { id: true }
            }),
            prisma.task.groupBy({
                by: ["assigneeId"],
                where: {
                    projectId: { in: projectIds },
                    assigneeId: { not: null }
                },
                _count: { id: true }
            }),
            prisma.taskComment.groupBy({
                by: ["authorId"],
                where: {
                    task: { projectId: { in: projectIds } },
                    createdAt: { gte: periodStart }
                },
                _count: { id: true }
            })
        ]);

        const completedMap = new Map<string, number>();
        memberCompletedTasks.forEach((m: any) => {
            if (m.assigneeId) completedMap.set(m.assigneeId, m._count.id);
        });

        const assignedMap = new Map<string, number>();
        memberAssignedTasks.forEach((m: any) => {
            if (m.assigneeId) assignedMap.set(m.assigneeId, m._count.id);
        });

        const commentsMap = new Map<string, number>();
        memberComments.forEach((m: any) => {
            if (m.authorId) commentsMap.set(m.authorId, m._count.id);
        });

        const teamPerformance = workspace.members.map((wm: any) => {
            const u = wm.user;
            const completed = completedMap.get(u.id) || 0;
            const assigned = assignedMap.get(u.id) || 0;
            const comments = commentsMap.get(u.id) || 0;
            const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
            const productivityScore = Math.min(100, completed * 15 + comments * 5);

            return {
                userId: u.id,
                name: `${u.firstName} ${u.lastName}`.trim() || u.email,
                firstName: u.firstName,
                lastName: u.lastName,
                email: u.email,
                avatar: u.avatar,
                role: wm.role || u.role,
                completedTasks: completed,
                assignedTasks: assigned,
                completionRate,
                commentsCount: comments,
                productivityScore
            };
        }).sort((a: any, b: any) => b.completedTasks - a.completedTasks);

        // 4. Active Users (Users with actions in period)
        const [activeChatSenders, activeTaskUpdaters, activeDocCommenters, recentAuditLogs] = await Promise.all([
            prisma.chatMessage.findMany({
                where: {
                    createdAt: { gte: periodStart },
                    channel: {
                        OR: [
                            { workspaceId: id },
                            { projectId: { in: projectIds } }
                        ]
                    }
                },
                select: { senderId: true },
                distinct: ["senderId"]
            }),
            prisma.task.findMany({
                where: {
                    updatedAt: { gte: periodStart },
                    projectId: { in: projectIds },
                    assigneeId: { not: null }
                },
                select: { assigneeId: true },
                distinct: ["assigneeId"]
            }),
            prisma.documentComment.findMany({
                where: {
                    createdAt: { gte: periodStart },
                    document: { projectId: { in: projectIds } }
                },
                select: { authorId: true },
                distinct: ["authorId"]
            }),
            prisma.auditLog.findMany({
                where: {
                    workspaceId: id,
                    createdAt: { gte: periodStart }
                },
                include: {
                    user: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } }
                },
                orderBy: { createdAt: "desc" },
                take: 6
            })
        ]);

        const activeUserIds = new Set<string>();
        activeChatSenders.forEach((s: any) => { if (s.senderId) activeUserIds.add(s.senderId); });
        activeTaskUpdaters.forEach((s: any) => { if (s.assigneeId) activeUserIds.add(s.assigneeId); });
        activeDocCommenters.forEach((s: any) => { if (s.authorId) activeUserIds.add(s.authorId); });
        recentAuditLogs.forEach((a: any) => { if (a.userId) activeUserIds.add(a.userId); });

        const totalMembers = workspace.members.length;
        const activeUsersCount = Math.max(activeUserIds.size, totalMembers > 0 ? 1 : 0);
        const activityRate = totalMembers > 0 ? Math.round((activeUsersCount / totalMembers) * 100) : 0;

        const recentActiveMembers = recentAuditLogs.map((log: any) => ({
            id: log.id,
            user: log.user ? {
                id: log.user.id,
                name: `${log.user.firstName} ${log.user.lastName}`.trim() || log.user.email,
                avatar: log.user.avatar
            } : null,
            action: log.action,
            entityType: log.entityType,
            timestamp: log.createdAt
        }));

        // 5. Document Activity
        const [
            totalDocuments,
            documentActivityCount,
            documentVersionsCount,
            documentCommentsCount,
            topDocuments,
            docTypeCounts
        ] = await Promise.all([
            prisma.document.count({ where: { projectId: { in: projectIds } } }),
            prisma.document.count({
                where: {
                    projectId: { in: projectIds },
                    updatedAt: { gte: periodStart }
                }
            }),
            prisma.documentVersion.count({
                where: {
                    document: { projectId: { in: projectIds } },
                    createdAt: { gte: periodStart }
                }
            }),
            prisma.documentComment.count({
                where: {
                    document: { projectId: { in: projectIds } },
                    createdAt: { gte: periodStart }
                }
            }),
            prisma.document.findMany({
                where: { projectId: { in: projectIds } },
                include: {
                    project: { select: { id: true, name: true } },
                    _count: { select: { versions: true, docComments: true } }
                },
                orderBy: { updatedAt: "desc" },
                take: 5
            }),
            prisma.document.groupBy({
                by: ["type"],
                where: { projectId: { in: projectIds } },
                _count: { id: true }
            })
        ]);

        const documentTypeMap: Record<string, number> = { DOC: 0, PDF: 0, XLS: 0, PPT: 0 };
        docTypeCounts.forEach((dc: any) => {
            documentTypeMap[dc.type] = dc._count.id;
        });

        const topActiveDocuments = topDocuments.map((d: any) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            projectName: d.project?.name || "Project",
            projectId: d.projectId,
            updatedAt: d.updatedAt,
            versionsCount: d._count.versions,
            commentsCount: d._count.docComments
        }));

        // 6. Storage Usage & File Breakdown
        const [totalFiles, fileTypeCounts] = await Promise.all([
            prisma.file.count({ where: { projectId: { in: projectIds } } }),
            prisma.file.groupBy({
                by: ["type"],
                where: { projectId: { in: projectIds } },
                _count: { id: true }
            })
        ]);

        const storageUsedBytes = Number(workspace.storageUsed) || 0;
        const storageQuotaBytes = Number(workspace.storageQuota) || 5368709120; // 5GB
        const storagePercentage = Math.min(100, Math.round((storageUsedBytes / storageQuotaBytes) * 100));

        const filesByType: Record<string, number> = {
            PDF: 0,
            PNG: 0,
            JPG: 0,
            FIG: 0,
            ZIP: 0,
            PPT: 0,
            DOC: 0,
            MP4: 0,
            XLS: 0
        };
        fileTypeCounts.forEach((fc: any) => {
            filesByType[fc.type] = fc._count.id;
        });

        // 7. Chat Statistics
        const [
            totalChatMessages,
            periodChatMessages,
            totalChannels,
            activeChannelsGroup,
            chatReactionsCount
        ] = await Promise.all([
            prisma.chatMessage.count({
                where: {
                    channel: {
                        OR: [
                            { workspaceId: id },
                            { projectId: { in: projectIds } }
                        ]
                    }
                }
            }),
            prisma.chatMessage.count({
                where: {
                    createdAt: { gte: periodStart },
                    channel: {
                        OR: [
                            { workspaceId: id },
                            { projectId: { in: projectIds } }
                        ]
                    }
                }
            }),
            prisma.channel.count({
                where: {
                    OR: [
                        { workspaceId: id },
                        { projectId: { in: projectIds } }
                    ]
                }
            }),
            prisma.chatMessage.groupBy({
                by: ["channelId"],
                where: {
                    channel: {
                        OR: [
                            { workspaceId: id },
                            { projectId: { in: projectIds } }
                        ]
                    }
                },
                _count: { id: true },
                orderBy: { _count: { id: "desc" } },
                take: 4
            }),
            prisma.messageReaction.count({
                where: {
                    message: {
                        channel: {
                            OR: [
                                { workspaceId: id },
                                { projectId: { in: projectIds } }
                            ]
                        }
                    }
                }
            })
        ]);

        const topChannelIds = activeChannelsGroup.map((c: any) => c.channelId);
        const channelsData = await prisma.channel.findMany({
            where: { id: { in: topChannelIds } },
            select: { id: true, name: true, type: true }
        });

        const topChannels = activeChannelsGroup.map((ac: any) => {
            const ch = channelsData.find((c: any) => c.id === ac.channelId);
            return {
                id: ac.channelId,
                name: ch?.name || "General Chat",
                type: ch?.type || "PROJECT",
                messageCount: ac._count.id
            };
        });

        // 8. Workspace Growth & Health Score
        const [
            newUsersInPeriod,
            newProjectsInPeriod,
            completedProjectsCount,
            newTasksInPeriod
        ] = await Promise.all([
            prisma.workspaceMember.count({
                where: {
                    workspaceId: id,
                    createdAt: { gte: periodStart }
                }
            }),
            prisma.project.count({
                where: {
                    workspaceId: id,
                    createdAt: { gte: periodStart }
                }
            }),
            prisma.project.count({
                where: {
                    workspaceId: id,
                    status: "COMPLETED"
                }
            }),
            prisma.task.count({
                where: {
                    projectId: { in: projectIds },
                    createdAt: { gte: periodStart }
                }
            })
        ]);

        // Composite Health Index (0-100)
        // Weighted: 40% completion rate, 30% user activity rate, 30% storage and task volume health
        const healthScore = Math.min(
            100,
            Math.max(
                10,
                Math.round(
                    taskCompletionRate * 40 +
                    (activityRate / 100) * 30 +
                    (totalTasks > 0 ? 25 : 10) +
                    (storagePercentage < 90 ? 5 : 0)
                )
            )
        );

        res.status(200).json({
            success: true,
            data: {
                period: periodParam,
                days,
                taskCompletionRate,
                rateChange,
                taskMetrics: {
                    totalTasks,
                    completedTasks,
                    inProgressTasks,
                    todoTasks,
                    overdueTasks,
                    byPriority: {
                        low: lowPriority,
                        medium: medPriority,
                        high: highPriority
                    }
                },
                productivityTrends,
                velocitySummary: {
                    totalCompletedInPeriod,
                    totalCreatedInPeriod,
                    avgCompletionVelocity,
                    peakDay
                },
                teamPerformance,
                activeUsers: {
                    count: activeUsersCount,
                    totalMembers,
                    activityRate,
                    recentActiveMembers
                },
                documentActivity: {
                    totalDocuments,
                    editsInPeriod: documentActivityCount,
                    versionsCreated: documentVersionsCount,
                    commentsCount: documentCommentsCount,
                    byType: documentTypeMap,
                    topActiveDocuments
                },
                storageUsage: {
                    used: storageUsedBytes,
                    quota: storageQuotaBytes,
                    percentage: storagePercentage,
                    totalFiles,
                    byType: filesByType
                },
                chatStatistics: {
                    totalMessages: totalChatMessages,
                    messagesInPeriod: periodChatMessages,
                    channelsCount: totalChannels,
                    reactionsCount: chatReactionsCount,
                    topChannels
                },
                workspaceGrowth: {
                    totalUsers: totalMembers,
                    newUsersInPeriod,
                    totalProjects: projectIds.length,
                    newProjectsInPeriod,
                    completedProjects: completedProjectsCount,
                    totalTasks,
                    newTasksInPeriod,
                    healthScore
                }
            }
        });
    } catch (error: any) {
        console.error("Error fetching analytics:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch analytics" });
    }
};
