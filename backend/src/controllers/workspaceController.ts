import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { logAuditAction } from "../services/auditService";
import { AuditAction } from "../../generated/prisma/enums";

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

        const targetUser = await prisma.user.findUnique({ where: { email } });
        if (!targetUser) {
            res.status(404).json({ success: false, error: "User not found" });
            return;
        }

        const member = await prisma.workspaceMember.create({
            data: {
                workspaceId: id,
                userId: targetUser.id,
                role: memberRole,
            }
        });

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

        res.status(200).json({ success: true, member });
    } catch (error: any) {
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
                allTasks.push({
                    id: t.id,
                    title: t.title,
                    status: t.status,
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

        const recentProjects = projects.slice(0, 6).map((p: any) => {
            const total = p.tasks.length;
            const completed = p.tasks.filter((t: any) => t.status === "DONE").length;
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

        const isAdmin = workspaceRole === "WORKSPACE_ADMIN";

        // Query messages
        const messages = await prisma.chatMessage.findMany({
            where: {
                project: {
                    workspaceId: id,
                    ...(isAdmin ? {} : {
                        OR: [
                            { ownerId: userId },
                            { members: { some: { userId } } }
                        ]
                    })
                }
            },
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        status: true,
                        owner: { select: { firstName: true, lastName: true, email: true } },
                        members: {
                            select: {
                                user: { select: { firstName: true, lastName: true, email: true } }
                            }
                        }
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Collect unique accessible project IDs for the frontend to join via socket
        const accessibleProjectIds = Array.from(new Set(messages.map((m: any) => m.projectId)));

        const getInitials = (fn?: string | null, ln?: string | null, email?: string) => {
            const f = (fn || "").trim()[0] || "";
            const l = (ln || "").trim()[0] || "";
            if (f || l) return (f + l).toUpperCase();
            return (email || "").slice(0, 2).toUpperCase();
        };

        const formatted = messages.map((msg: any) => {
            let senderName: string | undefined = undefined;
            if (msg.project) {
                const owner = msg.project.owner;
                if (owner && getInitials(owner.firstName, owner.lastName, owner.email) === msg.senderInitials) {
                    senderName = `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || owner.email;
                } else if (Array.isArray(msg.project.members)) {
                    const match = msg.project.members.find((m: any) => 
                        m.user && getInitials(m.user.firstName, m.user.lastName, m.user.email) === msg.senderInitials
                    );
                    if (match?.user) {
                        senderName = `${match.user.firstName || ""} ${match.user.lastName || ""}`.trim() || match.user.email;
                    }
                }
            }

            return {
                id: msg.id,
                text: msg.text,
                senderInitials: msg.senderInitials,
                senderName,
                timestamp: msg.createdAt.toISOString(),
                projectId: msg.projectId,
                projectName: msg.project?.name || "",
                projectCode: msg.project?.code || null,
                projectStatus: msg.project?.status || "",
                createdAt: msg.createdAt,
                updatedAt: msg.updatedAt,
                project: {
                    id: msg.project?.id,
                    name: msg.project?.name,
                    code: msg.project?.code,
                    status: msg.project?.status
                },
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
