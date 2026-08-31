import { Request, Response } from "express";
import prisma from "../lib/prisma";

/**
 * GET /api/workspaces/:id/analytics
 */
export const getWorkspaceAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        // Ensure workspace exists
        const workspace = await prisma.workspace.findUnique({
            where: { id },
            include: {
                projects: true,
                members: true,
            },
        });

        if (!workspace) {
            res.status(404).json({ success: false, error: "Workspace not found" });
            return;
        }

        const projectIds = workspace.projects.map((p: any) => p.id);

        // 1. Task Completion Rate
        const totalTasks = await prisma.task.count({
            where: { projectId: { in: projectIds } }
        });

        // Fetch all columns and filter completion column IDs
        const allColumns = await prisma.column.findMany({
            where: { board: { projectId: { in: projectIds } } },
            select: { id: true, name: true }
        });
        
        const completedColNames = ["done", "completed", "finished", "resolved", "complete"];
        const completedColumnIds = allColumns
            .filter((c: any) => completedColNames.includes(c.name.toLowerCase().trim()))
            .map((c: any) => c.id);

        const completedTasks = await prisma.task.count({
            where: {
                projectId: { in: projectIds },
                columnId: { in: completedColumnIds }
            }
        });

        const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) : 0;

        // 2. Productivity Trends (Last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Fetch completed tasks in the last 30 days
        const recentCompletedTasks = await prisma.task.findMany({
            where: {
                projectId: { in: projectIds },
                columnId: { in: completedColumnIds },
                updatedAt: { gte: thirtyDaysAgo } // Approximate completion date
            },
            select: { updatedAt: true }
        });

        const productivityTrends = Array.from({ length: 30 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (29 - i));
            return {
                date: d.toISOString().split("T")[0],
                completed: 0
            };
        });

        recentCompletedTasks.forEach((task: any) => {
            const dateStr = task.updatedAt.toISOString().split("T")[0];
            const day = productivityTrends.find((t: any) => t.date === dateStr);
            if (day) day.completed += 1;
        });

        // 3. Team Performance (Tasks completed per user)
        const teamTasks = await prisma.task.groupBy({
            by: ['assigneeId'],
            where: {
                projectId: { in: projectIds },
                columnId: { in: completedColumnIds },
                assigneeId: { not: null }
            },
            _count: { id: true }
        });

        const userIds = teamTasks.map((t: any) => t.assigneeId as string);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true, email: true }
        });

        const teamPerformance = teamTasks.map((t: any) => {
            const user = users.find((u: any) => u.id === t.assigneeId);
            return {
                userId: t.assigneeId,
                name: user ? `${user.firstName} ${user.lastName}`.trim() || user.email : "Unknown User",
                completedTasks: t._count.id
            };
        }).sort((a: any, b: any) => b.completedTasks - a.completedTasks);

        // 4. Active Users (workspace members)
        const activeUsersCount = workspace.members.length;
        
        // 5. Document Activity (Last 30 days)
        const documentActivityCount = await prisma.document.count({
            where: {
                projectId: { in: projectIds },
                updatedAt: { gte: thirtyDaysAgo }
            }
        });

        // 6. Storage Usage
        const storageUsage = {
            used: Number(workspace.storageUsed),
            quota: Number(workspace.storageQuota)
        };

        // 7. Chat Statistics
        const chatStatistics = await prisma.chatMessage.count({
            where: {
                channel: {
                    OR: [
                        { workspaceId: id },
                        { projectId: { in: projectIds } }
                    ]
                }
            }
        });

        // 8. Workspace Growth (Users, projects, tasks)
        const totalUsers = workspace.members.length;
        
        res.status(200).json({
            success: true,
            data: {
                taskCompletionRate,
                productivityTrends,
                teamPerformance,
                activeUsers: activeUsersCount,
                documentActivity: documentActivityCount,
                storageUsage,
                chatStatistics,
                workspaceGrowth: {
                    totalUsers,
                    totalProjects: projectIds.length,
                    totalTasks
                }
            }
        });
    } catch (error: any) {
        console.error("Error fetching analytics:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch analytics" });
    }
};
