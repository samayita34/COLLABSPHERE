import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { redisClient } from "../lib/redis";
import { ProjectStatus } from "../../generated/prisma/enums";
import { Permission, hasPermission } from "../lib/permissions";
import { logAuditAction } from "../services/auditService";

// Non-sensitive fields select for User
const safeUserSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true,
    role: true,
    isEmailVerified: true,
    isGoogleUser: true,
    createdAt: true,
    updatedAt: true,
};

/**
 * Helper to calculate derived task progress statistics.
 * Progress = Math.round((completedTasks / totalTasks) * 100) if totalTasks > 0, else 0.
 */
function calculateTaskProgress(tasks: Array<{ column?: { name: string } | null; status?: string }> = []) {
    const total = tasks.length;
    const completed = tasks.filter((t) => {
        if (t.status) return t.status === "DONE";
        const name = t.column?.name?.toLowerCase().trim() || "";
        return ["done", "completed", "finished", "resolved"].includes(name);
    }).length;

    return {
        tasksTotal: total,
        tasksCompleted: completed,
        progress: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
}

/**
 * Helper to format project response object with derived progress.
 */
function formatProject(project: any, includeTasks = false, userContext?: { userId?: string; userRole?: string; isWsAdmin?: boolean }) {
    const { tasksTotal, tasksCompleted, progress } = calculateTaskProgress(project.tasks || []);

    const isOwner = userContext?.userId ? project.ownerId === userContext.userId : false;
    const projectMember = userContext?.userId
        ? (project.members || []).find((m: any) => m.userId === userContext.userId)
        : null;
    const isProjAdmin = isOwner || projectMember?.role === "ADMIN";
    const canEdit = !!(userContext?.isWsAdmin || isOwner || isProjAdmin);
    const canDelete = !!(userContext?.isWsAdmin || isOwner || isProjAdmin);
    const currentUserRole = isOwner ? "OWNER" : (projectMember?.role || (userContext?.isWsAdmin ? "ADMIN" : "VIEWER"));

    const rawMembers = (project.members || []).map((m: any) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
    }));

    if (project.owner && !rawMembers.some((m: any) => m.userId === project.ownerId)) {
        rawMembers.unshift({
            id: `owner-${project.owner.id}`,
            userId: project.owner.id,
            role: "ADMIN",
            joinedAt: project.createdAt,
            user: project.owner,
        });
    }

    const formatted: any = {
        id: project.id,
        name: project.name,
        description: project.description,
        category: project.category,
        status: project.status,
        code: project.code,
        dueDate: project.dueDate,
        completedDate: project.completedDate,
        ownerId: project.ownerId,
        owner: project.owner,
        members: rawMembers,
        tasksTotal,
        tasksCompleted,
        progress,
        canEdit,
        canDelete,
        currentUserRole,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
    };

    if (includeTasks) {
        formatted.tasks = project.tasks || [];
    }

    return formatted;
}

/**
 * GET /api/projects
 * Get list of all projects with owner, members, and derived task progress.
 */
export const getProjects = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = req.query.workspaceId as string;
        if (!workspaceId) {
            res.status(400).json({ success: false, error: "workspaceId query parameter is required" });
            return;
        }

        // Verify workspace access (ideally using the middleware, but since this route doesn't have it mounted globally, we check here)
        const wsMember = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: req.user!.id } },
        });

        if (!wsMember) {
            res.status(403).json({ success: false, error: "Forbidden: No access to this workspace" });
            return;
        }

        const whereClause: any = { workspaceId };
        
        // If not a workspace admin, restrict to projects they own or are members of
        if (wsMember.role !== "WORKSPACE_ADMIN") {
            whereClause.OR = [
                { ownerId: req.user!.id },
                { members: { some: { userId: req.user!.id } } },
            ];
        }

        const cacheKey = `projects:ws:${workspaceId}:user:${req.user!.id}`;
        
        // Try getting from cache
        if (redisClient.isOpen) {
            const cachedProjects = await redisClient.get(cacheKey);
            if (cachedProjects) {
                res.status(200).json(JSON.parse(cachedProjects));
                return;
            }
        }

        const projects = await prisma.project.findMany({
            where: whereClause,
            include: {
                owner: {
                    select: safeUserSelect,
                },
                members: {
                    include: {
                        user: {
                            select: safeUserSelect,
                        },
                    },
                },
                tasks: {
                    select: {
                        id: true,
                        column: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        const isWsAdmin = wsMember.role === "WORKSPACE_ADMIN" || req.user?.role === "SUPER_ADMIN";
        const userContext = {
            userId: req.user!.id,
            isWsAdmin,
        };

        const formattedProjects = projects.map((p: any) => formatProject(p, false, userContext));

        const responseData = {
            success: true,
            count: formattedProjects.length,
            data: formattedProjects,
        };

        // Save to cache for 60 seconds
        if (redisClient.isOpen) {
            await redisClient.setEx(cacheKey, 60, JSON.stringify(responseData));
        }

        res.status(200).json(responseData);
    } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch projects",
        });
    }
};

/**
 * GET /api/projects/:id
 * Get a single project by ID with full details, owner, members, tasks, and derived task progress.
 */
export const getProjectById = async (req: Request, res: Response): Promise<void> => {
    try {
        // req.project is already injected by requireProjectAccess
        const project = req.project;

        // Still need to fetch the full shape with tasks and docs if needed
        // but we know we have access.
        const fullProject = await prisma.project.findUnique({
            where: { id: project.id },
            include: {
                owner: { select: safeUserSelect },
                members: { include: { user: { select: safeUserSelect } } },
                tasks: true,
                documents: true,
            },
        });

        if (!fullProject) {
            res.status(404).json({ success: false, error: "Project not found" });
            return;
        }

        const isWsAdmin = req.workspaceRole === "WORKSPACE_ADMIN" || req.user?.role === "SUPER_ADMIN" || req.orgRole === "ORG_ADMIN";
        const userContext = {
            userId: req.user?.id,
            userRole: req.projectRole,
            isWsAdmin,
        };

        res.status(200).json({
            success: true,
            project: formatProject(fullProject, true, userContext),
        });
    } catch (error: any) {
        console.error("Error fetching project:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch project" });
    }
};

/**
 * POST /api/projects
 * Create a new project.
 */
export const createProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, category, dueDate, workspaceId, code } = req.body;

        if (!name || typeof name !== "string" || name.trim() === "" || !workspaceId) {
            res.status(400).json({ success: false, error: "Valid name and workspaceId are required" });
            return;
        }

        const cleanCode = typeof code === "string" ? code.trim().toUpperCase() : null;
        if (cleanCode) {
            const existing = await prisma.project.findFirst({ where: { code: cleanCode } });
            if (existing) {
                res.status(400).json({ success: false, error: `Project code "${cleanCode}" is already in use` });
                return;
            }
        }

        const project = await prisma.project.create({
            data: {
                name: name.trim(),
                code: cleanCode || null,
                description: description && typeof description === "string" ? description.trim() : null,
                category: category && typeof category === "string" ? category.trim() : null,
                workspaceId,
                ownerId: req.user!.id,
                dueDate: dueDate ? new Date(dueDate) : null,
                members: {
                    create: {
                        userId: req.user!.id,
                        role: "ADMIN",
                    },
                },
                boards: {
                    create: {
                        name: "Default Board",
                        columns: {
                            create: [
                                { name: "To Do", order: 1000 },
                                { name: "In Progress", order: 2000 },
                                { name: "Review", order: 3000 },
                                { name: "Done", order: 4000 },
                            ],
                        },
                    },
                },
            },
        });

        // Invalidate cache
        if (redisClient.isOpen) {
            const keys = await redisClient.keys(`projects:ws:${workspaceId}:user:*`);
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        }

        // Audit Log: PROJECT_CREATED
        logAuditAction({
            userId: req.user!.id,
            workspaceId,
            projectId: project.id,
            action: "PROJECT_CREATED",
            entityType: "Project",
            entityId: project.id,
            details: { name: project.name },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(201).json({ success: true, project: formatProject(project) });
    } catch (error: any) {
        console.error("Error creating project:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to create project" });
    }
};

/**
 * PATCH /api/projects/:id
 * Update an existing project's fields.
 */
export const updateProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, description, code, category, status, dueDate } = req.body;

        // Check if user has permission to edit project
        const isOwner = req.project.ownerId === req.user!.id;
        const isWsAdmin = req.workspaceRole === "WORKSPACE_ADMIN" || req.user?.role === "SUPER_ADMIN" || req.orgRole === "ORG_ADMIN";
        const isProjAdmin = req.projectRole === "ADMIN";
        const canEdit = isWsAdmin || isOwner || isProjAdmin || hasPermission(req, Permission.EDIT_PROJECT);

        if (!canEdit) {
            res.status(403).json({ success: false, error: "Only project administrators can update project settings" });
            return;
        }

        const dataToUpdate: any = {};

        // 1. Name validation
        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                res.status(400).json({ success: false, error: "Project name cannot be empty" });
                return;
            }
            dataToUpdate.name = name.trim();
        }

        // 2. Description
        if (description !== undefined) {
            dataToUpdate.description = description && typeof description === "string" ? description.trim() : null;
        }

        // 3. Category
        if (category !== undefined) {
            dataToUpdate.category = category && typeof category === "string" ? category.trim() : null;
        }

        // 4. Code & uniqueness validation
        if (code !== undefined) {
            const cleanCode = typeof code === "string" ? code.trim().toUpperCase() : null;
            // Empty string is converted to null to prevent PostgreSQL unique constraint crash on duplicate empty strings
            dataToUpdate.code = cleanCode || null;

            if (dataToUpdate.code) {
                const existing = await prisma.project.findFirst({
                    where: {
                        code: dataToUpdate.code,
                        id: { not: id },
                    },
                });
                if (existing) {
                    res.status(400).json({ success: false, error: `Project code "${dataToUpdate.code}" is already in use by another project` });
                    return;
                }
            }
        }

        // 5. Status & completedDate handling
        if (status !== undefined) {
            if (!["ACTIVE", "COMPLETED", "ARCHIVED"].includes(status)) {
                res.status(400).json({ success: false, error: "Invalid status. Must be ACTIVE, COMPLETED, or ARCHIVED" });
                return;
            }
            dataToUpdate.status = status as ProjectStatus;
            if (status === "COMPLETED") {
                dataToUpdate.completedDate = new Date();
            } else {
                dataToUpdate.completedDate = null;
            }
        }

        // 6. Due date
        if (dueDate !== undefined) {
            if (!dueDate) {
                dataToUpdate.dueDate = null;
            } else {
                const parsedDate = new Date(dueDate);
                if (isNaN(parsedDate.getTime())) {
                    res.status(400).json({ success: false, error: "Invalid due date format" });
                    return;
                }
                dataToUpdate.dueDate = parsedDate;
            }
        }

        const project = await prisma.project.update({
            where: { id },
            data: dataToUpdate,
            include: {
                owner: { select: safeUserSelect },
                members: { include: { user: { select: safeUserSelect } } },
                tasks: true,
            },
        });

        // Invalidate caches
        if (redisClient.isOpen) {
            const keys = await redisClient.keys(`projects:ws:${project.workspaceId}:user:*`);
            if (keys.length > 0) await redisClient.del(keys);
        }

        const userContext = {
            userId: req.user?.id,
            userRole: req.projectRole,
            isWsAdmin,
        };

        // Audit Log: PROJECT_ARCHIVED or PROJECT_UPDATED
        const actionType = status === "ARCHIVED" ? "PROJECT_ARCHIVED" : "PROJECT_UPDATED";
        logAuditAction({
            userId: req.user?.id,
            workspaceId: project.workspaceId,
            projectId: project.id,
            action: actionType,
            entityType: "Project",
            entityId: project.id,
            details: { name: project.name, status: project.status },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(200).json({ success: true, project: formatProject(project, false, userContext) });
    } catch (error: any) {
        console.error("Error updating project:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to update project" });
    }
};

/**
 * DELETE /api/projects/:id
 * Delete a project by ID. Cascading relation rules in database handle associated ProjectMember, Task, File, Document records.
 */
export const deleteProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const isOwner = req.project.ownerId === req.user!.id;
        const isWsAdmin = req.workspaceRole === "WORKSPACE_ADMIN" || req.user?.role === "SUPER_ADMIN" || req.orgRole === "ORG_ADMIN";
        const isProjAdmin = req.projectRole === "ADMIN";
        const canDelete = isWsAdmin || isOwner || isProjAdmin || hasPermission(req, Permission.DELETE_PROJECT);

        if (!canDelete) {
            res.status(403).json({ success: false, error: "Only project administrators can delete the project" });
            return;
        }

        const project = req.project;

        await prisma.project.delete({
            where: { id },
        });

        // Audit Log: PROJECT_DELETED
        logAuditAction({
            userId: req.user?.id,
            workspaceId: project.workspaceId,
            projectId: project.id,
            action: "PROJECT_DELETED",
            entityType: "Project",
            entityId: project.id,
            details: { name: project.name },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        // Invalidate cache
        if (redisClient.isOpen) {
            const keys = await redisClient.keys(`projects:ws:${project.workspaceId}:user:*`);
            if (keys.length > 0) await redisClient.del(keys);
        }

        res.status(200).json({ success: true, message: "Project deleted successfully" });
    } catch (error: any) {
        console.error("Error deleting project:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to delete project" });
    }
};
