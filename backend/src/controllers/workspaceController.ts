import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { logAuditAction } from "../services/auditService";
import { AuditAction, NotificationType } from "../../generated/prisma/enums";
import { createAndSendNotification } from "../services/notificationService";

export const createWorkspace = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, slug, description, organizationId } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        if (!name || typeof name !== "string" || name.trim() === "" || !slug || typeof slug !== "string" || slug.trim() === "" || !organizationId) {
            res.status(400).json({ success: false, error: "Valid name, slug, and organizationId are required" });
            return;
        }



        const existing = await prisma.workspace.findUnique({ where: { slug } });
        if (existing) {
            res.status(409).json({ success: false, error: "Workspace slug already exists" });
            return;
        }

        const ws = await prisma.workspace.create({
            data: {
                name,
                slug,
                description,
                organizationId,
                members: {
                    create: {
                        userId,
                        role: "WORKSPACE_ADMIN",
                    },
                },
            },
        });

        // Audit Log: WORKSPACE_CREATED
        logAuditAction({
            userId,
            workspaceId: ws.id,
            action: "WORKSPACE_CREATED",
            entityType: "Workspace",
            entityId: ws.id,
            details: { name: ws.name, slug: ws.slug },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(201).json({ success: true, workspace: ws });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to create workspace" });
    }
};

export const listWorkspacesForOrg = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orgId } = req.params;
        const userId = req.user?.id;
        
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }



        const workspaces = await prisma.workspace.findMany({
            where: {
                organizationId: orgId,
                members: { some: { userId } },
            },
            include: {
                organization: true,
                members: {
                    where: { userId },
                    select: { role: true },
                },
            },
        });

        res.status(200).json({ success: true, workspaces });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to fetch workspaces" });
    }
};

/**
 * GET /api/workspaces
 * Fetch all workspaces the authenticated user belongs to via WorkspaceMember.
 */
export const getUserWorkspaces = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const orgId = req.query.orgId as string | undefined;

        const whereClause: any = {
            userId,
        };

        if (orgId) {
            whereClause.workspace = {
                organizationId: orgId,
            };
        }

        const memberships = await prisma.workspaceMember.findMany({
            where: whereClause,
            include: {
                workspace: {
                    include: {
                        organization: true,
                        members: {
                            where: { userId },
                            select: { role: true },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: "asc",
            },
        });

        const workspaces = memberships
            .filter((m: any) => m.workspace !== null)
            .map((m: any) => ({
                ...m.workspace,
                role: m.role,
            }));

        res.status(200).json({ success: true, workspaces, memberships });
    } catch (error: any) {
        console.error("Error fetching user workspaces:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch workspaces" });
    }
};

export const getWorkspace = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const ws = await prisma.workspace.findFirst({
            where: {
                id,
                members: { some: { userId } },
            },
            include: {
                organization: true,
                members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } } },
                teams: true,
            }
        });

        if (!ws) {
            res.status(404).json({ success: false, error: "Workspace not found" });
            return;
        }

        res.status(200).json({ success: true, workspace: ws });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to fetch workspace" });
    }
};

export const updateWorkspace = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        if (!name || typeof name !== "string" || name.trim() === "") {
            res.status(400).json({ success: false, error: "Valid name is required" });
            return;
        }

        const ws = await prisma.workspace.update({
            where: { id },
            data: { name, description },
        });

        // Audit Log: WORKSPACE_UPDATED
        logAuditAction({
            userId,
            workspaceId: ws.id,
            action: "WORKSPACE_UPDATED",
            entityType: "Workspace",
            entityId: ws.id,
            details: { name: ws.name },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(200).json({ success: true, workspace: ws });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to update workspace" });
    }
};

export const deleteWorkspace = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }



        await prisma.workspace.delete({ where: { id } });

        res.status(200).json({ success: true, message: "Workspace deleted successfully" });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to delete workspace" });
    }
};

// Member management
export const addWorkspaceMember = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { email, role } = req.body;
        const userId = req.user?.id;

        if (!userId) return;

        const validRoles = ["WORKSPACE_ADMIN", "MEMBER"];
        const memberRole = validRoles.includes(role) ? role : "MEMBER";

        const targetUser = await prisma.user.findUnique({
            where: { email },
            select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        });
        if (!targetUser) {
            res.status(404).json({ success: false, error: "User not found" });
            return;
        }

        // Check whether this user is already a workspace member.
        // If so, return the existing record instead of attempting a duplicate insert.
        const existingMember = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: id, userId: targetUser.id } },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
            },
        });

        if (existingMember) {
            // User is already a workspace member — return success without creating a duplicate.
            res.status(200).json({ success: true, member: existingMember, alreadyMember: true });
            return;
        }

        const member = await prisma.workspaceMember.create({
            data: {
                workspaceId: id,
                userId: targetUser.id,
                role: memberRole,
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
            },
        });

        // Safeguard: Ensure user is also an organization member if workspace belongs to an organization
        try {
            const ws = await prisma.workspace.findUnique({
                where: { id },
                select: { organizationId: true },
            });
            if (ws?.organizationId) {
                await prisma.organizationMember.upsert({
                    where: {
                        organizationId_userId: {
                            organizationId: ws.organizationId,
                            userId: targetUser.id,
                        },
                    },
                    update: {},
                    create: {
                        organizationId: ws.organizationId,
                        userId: targetUser.id,
                        role: "MEMBER",
                    },
                });
            }
        } catch (orgErr) {
            console.error("Safeguard: Error ensuring organization membership:", orgErr);
        }

        // Audit Log: WORKSPACE_MEMBER_ADDED & ROLE_UPDATED
        logAuditAction({
            userId,
            workspaceId: (Array.isArray(id) ? id[0] : id) as string,
            action: "WORKSPACE_MEMBER_ADDED",
            entityType: "WorkspaceMember",
            entityId: member.id,
            details: { targetUserId: targetUser.id, role: memberRole },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        logAuditAction({
            userId,
            workspaceId: (Array.isArray(id) ? id[0] : id) as string,
            action: "ROLE_UPDATED",
            entityType: "WorkspaceMember",
            entityId: member.id,
            details: { targetUserId: targetUser.id, role: memberRole },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        // Trigger Notification: Workspace Member Added
        if (targetUser.id !== userId) {
            const wsName = (req.workspace as any)?.name || "a workspace";
            createAndSendNotification({
                userId: targetUser.id,
                workspaceId: (Array.isArray(id) ? id[0] : id) as string,
                type: NotificationType.WORKSPACE_INVITATION,
                title: "Added to Workspace",
                message: `You were added to workspace "${wsName}" as ${memberRole}`,
                link: `/dashboard`,
            }).catch((err) => console.error("Notification error:", err));
        }

        res.status(200).json({ success: true, member });
    } catch (error: any) {
        // Safety net: if a race condition still triggers the unique constraint, surface a clean error.
        if (error?.code === "P2002") {
            res.status(409).json({
                success: false,
                error: "This user is already a member of this workspace.",
            });
            return;
        }
        res.status(500).json({ success: false, error: error.message || "Failed to add member" });
    }
};

export const removeWorkspaceMember = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id, targetUserId } = req.params;
        const userId = req.user?.id;

        if (!userId) return;

        await prisma.workspaceMember.delete({
            where: { workspaceId_userId: { workspaceId: id, userId: targetUserId } },
        });

        // Audit Log: WORKSPACE_MEMBER_REMOVED
        logAuditAction({
            userId,
            workspaceId: (Array.isArray(id) ? id[0] : id) as string,
            action: "WORKSPACE_MEMBER_REMOVED",
            entityType: "WorkspaceMember",
            entityId: (Array.isArray(targetUserId) ? targetUserId[0] : targetUserId) as string,
            details: { removedUserId: targetUserId },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err: any) => console.error("Audit log error:", err));

        // Trigger Notification: Workspace Member Removed
        const actualTargetUserId = (Array.isArray(targetUserId) ? targetUserId[0] : targetUserId) as string;
        if (actualTargetUserId !== userId) {
            const wsName = (req.workspace as any)?.name || "a workspace";
            createAndSendNotification({
                userId: actualTargetUserId,
                workspaceId: (Array.isArray(id) ? id[0] : id) as string,
                type: NotificationType.WORKSPACE_INVITATION,
                title: "Removed from Workspace",
                message: `You were removed from workspace "${wsName}"`,
                link: `/projects`,
            }).catch((err: any) => console.error("Notification error:", err));
        }

        res.status(200).json({ success: true, message: "Member removed" });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to remove member" });
    }
};

/**
 * GET /api/workspaces/:id/overview
 * Returns high-level metrics, recent projects with derived progress, and latest tasks across all projects.
 */
export const getWorkspaceOverview = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const projects = await prisma.project.findMany({
            where: { workspaceId: id },
            include: {
                owner: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                members: {
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true, email: true } },
                    },
                },
                tasks: {
                    include: {
                        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
                        column: { select: { name: true } },
                    },
                    orderBy: { updatedAt: "desc" },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const totalProjects = projects.length;
        const activeProjects = projects.filter((p: any) => p.status === "ACTIVE").length;
        const completedProjects = projects.filter((p: any) => p.status === "COMPLETED").length;

        const allTasks: any[] = [];
        projects.forEach((p: any) => {
            p.tasks.forEach((t: any) => {
                const colName = t.column?.name?.toLowerCase().trim() || "";
                const isDone = ["done", "completed", "finished", "resolved"].includes(colName);
                const status = isDone ? "DONE" : (colName.includes("progress") ? "IN_PROGRESS" : "TODO");
                allTasks.push({
                    id: t.id,
                    title: t.title,
                    status,
                    priority: t.priority,
                    dueDate: t.dueDate,
                    projectId: p.id,
                    projectName: p.name,
                    assignee: t.assignee,
                    updatedAt: t.updatedAt,
                });
            });
        });

        const totalTasks = allTasks.length;
        const completedTasks = allTasks.filter((t: any) => t.status === "DONE").length;
        const inProgressTasks = allTasks.filter((t: any) => t.status === "IN_PROGRESS" || t.status === "REVIEW").length;
        const todoTasks = allTasks.filter((t: any) => t.status === "TODO").length;

        allTasks.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        const recentTasks = allTasks.slice(0, 8);

        const pendingTasks = allTasks.filter((t: any) => ["TODO", "IN_PROGRESS", "REVIEW"].includes(t.status)).slice(0, 8);
        
        const todayStr = new Date().toISOString().split('T')[0];
        const dueTodayTasks = allTasks.filter((t: any) => t.dueDate && typeof t.dueDate.toISOString === 'function' ? t.dueDate.toISOString().split('T')[0] === todayStr : t.dueDate && new Date(t.dueDate).toISOString().split('T')[0] === todayStr).slice(0, 8);
        
        const next7Days = new Date();
        next7Days.setDate(next7Days.getDate() + 7);
        const upcomingDeadlineTasks = allTasks.filter((t: any) => {
            if (!t.dueDate) return false;
            const due = new Date(t.dueDate);
            return due > new Date() && due <= next7Days && due.toISOString().split('T')[0] !== todayStr;
        }).slice(0, 8);

        const recentDocuments = await prisma.document.findMany({
            where: { project: { workspaceId: id } },
            orderBy: { updatedAt: "desc" },
            take: 5,
            select: { id: true, name: true, updatedAt: true, project: { select: { id: true, name: true } } }
        });

        const formattedRecentDocuments = recentDocuments.map((doc: any) => ({
            id: doc.id,
            title: doc.name,
            updatedAt: doc.updatedAt,
            project: doc.project,
        }));

        const recentActivity = await prisma.auditLog.findMany({
            where: { workspaceId: id },
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
                id: true,
                action: true,
                entityType: true,
                createdAt: true,
                details: true,
                user: { select: { id: true, firstName: true, lastName: true, email: true } }
            }
        });

        const recentProjects = projects.slice(0, 6).map((p: any) => {
            const total = p.tasks.length;
            const completed = p.tasks.filter((t: any) => {
                const colName = t.column?.name?.toLowerCase().trim() || "";
                return ["done", "completed", "finished", "resolved"].includes(colName);
            }).length;
            const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
            return {
                id: p.id,
                name: p.name,
                category: p.category || "General",
                status: p.status,
                progress,
                tasksCompleted: completed,
                tasksTotal: total,
                members: p.members.map((m: any) => {
                    const fn = m.user.firstName || "";
                    const ln = m.user.lastName || "";
                    const initials = (fn[0] || "") + (ln[0] || "") || m.user.email.slice(0, 2);
                    return {
                        id: m.id,
                        name: `${fn} ${ln}`.trim() || m.user.email,
                        initials: initials.toUpperCase(),
                        role: m.role,
                    };
                }),
                updatedAt: p.updatedAt,
            };
        });

        res.status(200).json({
            success: true,
            data: {
                metrics: {
                    totalProjects,
                    activeProjects,
                    completedProjects,
                    totalTasks,
                    completedTasks,
                    inProgressTasks,
                    todoTasks,
                },
                recentProjects,
                recentTasks,
                pendingTasks,
                dueTodayTasks,
                upcomingDeadlineTasks,
                recentDocuments: formattedRecentDocuments,
                recentActivity,
            },
        });
    } catch (error: any) {
        console.error("Error fetching workspace overview:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch workspace overview" });
    }
};

/**
 * GET /api/workspaces/:id/documents
 * Fetch all documents within a workspace (across all projects).
 */
export const getWorkspaceDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const documents = await prisma.document.findMany({
            where: {
                project: {
                    workspaceId: id,
                },
            },
            include: {
                project: {
                    select: {
                        name: true,
                        code: true,
                        status: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        const formatted = documents.map((doc: any) => ({
            ...doc,
            projectId: doc.projectId,
            projectName: doc.project.name,
            projectCode: doc.project.code,
            projectStatus: doc.project.status,
        }));

        res.status(200).json({ success: true, data: formatted });
    } catch (error: any) {
        console.error("Error fetching workspace documents:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch workspace documents" });
    }
};

/**
 * GET /api/workspaces/:id/files
 * Fetch all files within a workspace (across all projects).
 */
export const getWorkspaceFiles = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const files = await prisma.file.findMany({
            where: {
                project: {
                    workspaceId: id,
                },
            },
            include: {
                project: {
                    select: {
                        name: true,
                        code: true,
                        status: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        const formatted = files.map((file: any) => ({
            ...file,
            projectId: file.projectId,
            projectName: file.project.name,
            projectCode: file.project.code,
            projectStatus: file.project.status,
        }));

        res.status(200).json({ success: true, data: formatted });
    } catch (error: any) {
        console.error("Error fetching workspace files:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch workspace files" });
    }
};

/**
 * GET /api/workspaces/:id/messages
 * Fetch all chat messages within a workspace (across all accessible projects).
 */
export const getWorkspaceMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const workspaceRole = (req as any).workspaceRole; // Set by requireWorkspaceAccess

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const isAdmin = workspaceRole === "WORKSPACE_ADMIN" || req.user?.role === "SUPER_ADMIN" || (req as any).orgRole === "ORG_ADMIN";

        // Query messages associated with workspace channels or project channels in this workspace
        const messages = await prisma.chatMessage.findMany({
            where: {
                channel: {
                    OR: [
                        { workspaceId: id },
                        {
                            project: {
                                workspaceId: id,
                                ...(isAdmin ? {} : {
                                    OR: [
                                        { ownerId: userId },
                                        { members: { some: { userId } } }
                                    ]
                                })
                            }
                        }
                    ]
                }
            },
            include: {
                sender: {
                    select: { id: true, firstName: true, lastName: true, email: true, avatar: true }
                },
                channel: {
                    include: {
                        project: {
                            select: { id: true, name: true, code: true, status: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: "desc" },
        });

        // Collect unique accessible project IDs for real-time socket subscription
        const accessibleProjectIds = Array.from(
            new Set(messages.map((m: any) => m.channel?.projectId).filter(Boolean))
        );

        const formatted = messages.map((msg: any) => {
            const sender = msg.sender || {};
            const fn = sender.firstName || "";
            const ln = sender.lastName || "";
            const senderInitials = ((fn[0] || "") + (ln[0] || "")).toUpperCase() || (sender.email ? sender.email.slice(0, 2).toUpperCase() : "UN");
            const senderName = `${fn} ${ln}`.trim() || sender.email || "Unknown User";

            const proj = msg.channel?.project;

            return {
                id: msg.id,
                text: msg.text || "",
                senderInitials,
                senderName,
                timestamp: msg.createdAt ? msg.createdAt.toISOString() : new Date().toISOString(),
                projectId: msg.channel?.projectId || null,
                projectName: proj?.name || "General",
                projectCode: proj?.code || null,
                projectStatus: proj?.status || "ACTIVE",
                createdAt: msg.createdAt,
                updatedAt: msg.updatedAt,
                project: proj ? {
                    id: proj.id,
                    name: proj.name,
                    code: proj.code,
                    status: proj.status
                } : null,
            };
        });

        res.status(200).json({ 
            success: true, 
            data: formatted,
            accessibleProjectIds 
        });
    } catch (error: any) {
        console.error("Error fetching workspace messages:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch workspace messages" });
    }
};
