import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { ProjectStatus } from "../../generated/prisma/enums";

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
function calculateTaskProgress(tasks: Array<{ status: string }> = []) {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "DONE").length;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    return {
        tasksTotal: total,
        tasksCompleted: completed,
        progress,
    };
}

/**
 * Helper to format project response object with derived progress.
 */
function formatProject(project: any, includeTasks = false) {
    const { tasksTotal, tasksCompleted, progress } = calculateTaskProgress(project.tasks || []);

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
        members: (project.members || []).map((m: any) => ({
            id: m.id,
            userId: m.userId,
            role: m.role,
            joinedAt: m.joinedAt,
            user: m.user,
        })),
        tasksTotal,
        tasksCompleted,
        progress,
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
export const getProjects = async (_req: Request, res: Response): Promise<void> => {
    try {
        const projects = await prisma.project.findMany({
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
                        status: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        const formattedProjects = projects.map((p: any) => formatProject(p, false));

        res.status(200).json({
            success: true,
            count: formattedProjects.length,
            data: formattedProjects,
        });
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
        const id = req.params.id as string;

        const project = await prisma.project.findUnique({
            where: { id },
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
                    include: {
                        assignee: {
                            select: safeUserSelect,
                        },
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                },
            },
        });

        if (!project) {
            res.status(404).json({
                success: false,
                error: "Project not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: formatProject(project, true),
        });
    } catch (error) {
        console.error("Error fetching project:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch project",
        });
    }
};

/**
 * POST /api/projects
 * Create a new project.
 * Required fields in body: name, ownerId
 * Optional fields: description, category, status, code, dueDate
 */
export const createProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, ownerId, description, category, status, code, dueDate } = req.body;

        // Validation
        if (!name || typeof name !== "string" || name.trim() === "") {
            res.status(400).json({
                success: false,
                error: "Project name is required and must be a non-empty string",
            });
            return;
        }

        if (!ownerId || typeof ownerId !== "string" || ownerId.trim() === "") {
            res.status(400).json({
                success: false,
                error: "Owner ID (ownerId) is required and must be a non-empty string",
            });
            return;
        }

        // Validate status enum if provided
        if (status && !Object.values(ProjectStatus).includes(status)) {
            res.status(400).json({
                success: false,
                error: `Invalid status. Allowed values are: ${Object.values(ProjectStatus).join(", ")}`,
            });
            return;
        }

        // Validate date if provided
        let parsedDueDate: Date | null = null;
        if (dueDate) {
            parsedDueDate = new Date(dueDate);
            if (isNaN(parsedDueDate.getTime())) {
                res.status(400).json({
                    success: false,
                    error: "Invalid dueDate format. Must be a valid date string",
                });
                return;
            }
        }

        // Check if owner user exists
        const ownerExists = await prisma.user.findUnique({
            where: { id: ownerId.trim() },
        });

        if (!ownerExists) {
            res.status(400).json({
                success: false,
                error: `User specified by ownerId '${ownerId}' does not exist`,
            });
            return;
        }

        // Create project with owner automatically added as an ADMIN member
        const project = await prisma.project.create({
            data: {
                name: name.trim(),
                description: description ? String(description).trim() : null,
                category: category ? String(category).trim() : null,
                status: status || ProjectStatus.ACTIVE,
                code: code ? String(code).trim() : null,
                dueDate: parsedDueDate,
                ownerId: ownerId.trim(),
                members: {
                    create: {
                        userId: ownerId.trim(),
                        role: "ADMIN",
                    },
                },
            },
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
                tasks: true,
            },
        });

        res.status(201).json({
            success: true,
            message: "Project created successfully",
            data: formatProject(project, true),
        });
    } catch (error: any) {
        console.error("Error creating project:", error);

        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
            res.status(409).json({
                success: false,
                error: "A project with this project code already exists",
            });
            return;
        }

        res.status(500).json({
            success: false,
            error: "Failed to create project",
        });
    }
};

/**
 * PATCH /api/projects/:id
 * Update an existing project's fields.
 */
export const updateProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const { name, description, category, status, code, dueDate, completedDate, ownerId } = req.body;

        // Check if project exists
        const existingProject = await prisma.project.findUnique({
            where: { id },
        });

        if (!existingProject) {
            res.status(404).json({
                success: false,
                error: "Project not found",
            });
            return;
        }

        const updateData: any = {};

        if (name !== undefined) {
            if (typeof name !== "string" || name.trim() === "") {
                res.status(400).json({
                    success: false,
                    error: "Project name must be a non-empty string",
                });
                return;
            }
            updateData.name = name.trim();
        }

        if (description !== undefined) {
            updateData.description = description ? String(description).trim() : null;
        }

        if (category !== undefined) {
            updateData.category = category ? String(category).trim() : null;
        }

        if (status !== undefined) {
            if (!Object.values(ProjectStatus).includes(status)) {
                res.status(400).json({
                    success: false,
                    error: `Invalid status. Allowed values are: ${Object.values(ProjectStatus).join(", ")}`,
                });
                return;
            }
            updateData.status = status;
        }

        if (code !== undefined) {
            updateData.code = code ? String(code).trim() : null;
        }

        if (dueDate !== undefined) {
            if (dueDate === null) {
                updateData.dueDate = null;
            } else {
                const parsed = new Date(dueDate);
                if (isNaN(parsed.getTime())) {
                    res.status(400).json({
                        success: false,
                        error: "Invalid dueDate format",
                    });
                    return;
                }
                updateData.dueDate = parsed;
            }
        }

        if (completedDate !== undefined) {
            if (completedDate === null) {
                updateData.completedDate = null;
            } else {
                const parsed = new Date(completedDate);
                if (isNaN(parsed.getTime())) {
                    res.status(400).json({
                        success: false,
                        error: "Invalid completedDate format",
                    });
                    return;
                }
                updateData.completedDate = parsed;
            }
        }

        if (ownerId !== undefined) {
            if (typeof ownerId !== "string" || ownerId.trim() === "") {
                res.status(400).json({
                    success: false,
                    error: "Owner ID must be a non-empty string",
                });
                return;
            }
            const ownerExists = await prisma.user.findUnique({
                where: { id: ownerId.trim() },
            });
            if (!ownerExists) {
                res.status(400).json({
                    success: false,
                    error: `User specified by ownerId '${ownerId}' does not exist`,
                });
                return;
            }
            updateData.ownerId = ownerId.trim();
        }

        const updatedProject = await prisma.project.update({
            where: { id },
            data: updateData,
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
                    include: {
                        assignee: {
                            select: safeUserSelect,
                        },
                    },
                },
            },
        });

        res.status(200).json({
            success: true,
            message: "Project updated successfully",
            data: formatProject(updatedProject, true),
        });
    } catch (error: any) {
        console.error("Error updating project:", error);

        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
            res.status(409).json({
                success: false,
                error: "A project with this project code already exists",
            });
            return;
        }

        res.status(500).json({
            success: false,
            error: "Failed to update project",
        });
    }
};

/**
 * DELETE /api/projects/:id
 * Delete a project by ID. Cascading relation rules in database handle associated ProjectMember and Task records.
 */
export const deleteProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;

        const existingProject = await prisma.project.findUnique({
            where: { id },
        });

        if (!existingProject) {
            res.status(404).json({
                success: false,
                error: "Project not found",
            });
            return;
        }

        await prisma.project.delete({
            where: { id },
        });

        res.status(200).json({
            success: true,
            message: "Project deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting project:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete project",
        });
    }
};
