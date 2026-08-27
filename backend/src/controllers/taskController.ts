import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { TaskStatus, TaskPriority, NotificationType, AuditAction } from "../../generated/prisma/enums";
import { getIO } from "../lib/socket";
import { createAndSendNotification } from "../services/notificationService";
import { logAuditAction } from "../services/auditService";

// Non-sensitive fields — identical to projectController.safeUserSelect
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
 * Format a raw Prisma Task record into the public API shape.
 * Excludes no fields — all task fields are non-sensitive.
 */
function formatTask(task: any) {
    return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        projectId: task.projectId,
        assigneeId: task.assigneeId,
        assignee: task.assignee ?? null,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
    };
}

/**
 * GET /api/tasks/my-tasks?workspaceId=<workspaceId>
 * Returns all tasks assigned to the authenticated user within the specified workspace.
 */
export const getMyTasks = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Authentication required" });
            return;
        }

        const workspaceId = req.query.workspaceId as string;
        if (!workspaceId) {
            res.status(400).json({ success: false, error: "workspaceId query parameter is required" });
            return;
        }

        // Verify the user is a member of the workspace
        const wsMember = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
        });

        if (!wsMember) {
            res.status(403).json({ success: false, error: "Forbidden: You do not have access to this workspace" });
            return;
        }

        // Fetch all tasks in projects belonging to this workspace assigned to this user
        const tasks = await prisma.task.findMany({
            where: {
                assigneeId: userId,
                project: {
                    workspaceId,
                },
            },
            include: {
                assignee: { select: safeUserSelect },
                project: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        status: true,
                    },
                },
            },
            orderBy: [
                { dueDate: "asc" },
                { updatedAt: "desc" },
            ],
        });

        const formatted = tasks.map((task: any) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            projectId: task.projectId,
            projectName: task.project.name,
            projectCode: task.project.code,
            projectStatus: task.project.status,
            assigneeId: task.assigneeId,
            assignee: task.assignee ?? null,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
        }));

        res.status(200).json({
            success: true,
            count: formatted.length,
            data: formatted,
        });
    } catch (error: any) {
        console.error("getMyTasks error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch user tasks" });
    }
};

/**
 * GET /api/projects/:projectId/tasks
 * Returns all tasks belonging to a project, ordered oldest-first.
 * Each task includes the assignee's safe user fields.
 */
export const getTasksByProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;

        // requireProjectAccess has verified access and project existence.

        const tasks = await prisma.task.findMany({
            where: { projectId },
            include: {
                assignee: { select: safeUserSelect },
            },
            orderBy: { createdAt: "asc" },
        });

        res.status(200).json({
            success: true,
            count: tasks.length,
            data: tasks.map(formatTask),
        });
    } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).json({ success: false, error: "Failed to fetch tasks" });
    }
};

/**
 * POST /api/projects/:projectId/tasks
 * Create a new task under a project.
 * Required body fields: title
 * Optional body fields: description, status, priority, dueDate, assigneeId
 */
export const createTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { title, description, status, priority, dueDate, assigneeId } = req.body;

        // requireProjectAccess has verified access and project existence.

        // title is required
        if (!title || typeof title !== "string" || title.trim() === "") {
            res.status(400).json({
                success: false,
                error: "Task title is required and must be a non-empty string",
            });
            return;
        }

        // Validate status enum if provided
        if (status !== undefined && !Object.values(TaskStatus).includes(status)) {
            res.status(400).json({
                success: false,
                error: `Invalid status. Allowed values are: ${Object.values(TaskStatus).join(", ")}`,
            });
            return;
        }

        // Validate priority enum if provided
        if (priority !== undefined && !Object.values(TaskPriority).includes(priority)) {
            res.status(400).json({
                success: false,
                error: `Invalid priority. Allowed values are: ${Object.values(TaskPriority).join(", ")}`,
            });
            return;
        }

        // Validate dueDate if provided
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

        // Validate assigneeId if provided
        if (assigneeId !== undefined && assigneeId !== null) {
            if (typeof assigneeId !== "string" || assigneeId.trim() === "") {
                res.status(400).json({
                    success: false,
                    error: "assigneeId must be a non-empty string",
                });
                return;
            }
            const assigneeExists = await prisma.user.findUnique({
                where: { id: assigneeId.trim() },
            });
            if (!assigneeExists) {
                res.status(400).json({
                    success: false,
                    error: `User specified by assigneeId '${assigneeId}' does not exist`,
                });
                return;
            }
        }

        const task = await prisma.task.create({
            data: {
                title: title.trim(),
                description: description ? String(description).trim() : null,
                status: status ?? TaskStatus.TODO,
                priority: priority ?? TaskPriority.MEDIUM,
                dueDate: parsedDueDate,
                projectId,
                assigneeId: assigneeId ? assigneeId.trim() : null,
            },
            include: {
                assignee: { select: safeUserSelect },
            },
        });

        const formattedTask = formatTask(task);
        
        try {
            getIO().to(projectId).emit("taskUpdated", formattedTask);
        } catch (e) {
            console.error("Failed to emit taskUpdated event", e);
        }

        // Notification: Task Assigned
        if (task.assigneeId && task.assigneeId !== req.user?.id) {
            createAndSendNotification({
                userId: task.assigneeId,
                workspaceId: req.workspace?.id,
                type: NotificationType.TASK_ASSIGNED,
                title: "New Task Assigned",
                message: `You were assigned to task "${task.title}" in ${req.project?.name || "a project"}`,
                link: `/projects/${projectId}`,
            }).catch((err) => console.error("Notification error:", err));
        }

        // Audit Log: TASK_CREATED
        logAuditAction({
            userId: req.user?.id,
            workspaceId: req.workspace?.id,
            projectId: projectId as string,
            action: "TASK_CREATED",
            entityType: "Task",
            entityId: task.id,
            details: { title: task.title, status: task.status, assigneeId: task.assigneeId },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        if (task.assigneeId) {
            logAuditAction({
                userId: req.user?.id,
                workspaceId: req.workspace?.id,
                projectId: projectId as string,
                action: "TASK_ASSIGNED",
                entityType: "Task",
                entityId: task.id,
                details: { title: task.title, assigneeId: task.assigneeId },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"] as string,
            }).catch((err) => console.error("Audit log error:", err));
        }

        res.status(201).json({
            success: true,
            message: "Task created successfully",
            data: formattedTask,
        });
    } catch (error) {
        console.error("Error creating task:", error);
        res.status(500).json({ success: false, error: "Failed to create task" });
    }
};

/**
 * PATCH /api/tasks/:id
 * Partially update a task's fields.
 * All body fields are optional; only provided fields are updated.
 */
export const updateTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { title, description, status, priority, dueDate, assigneeId } = req.body;

        // requireTaskAccess has already verified task existence and project access.
        const existingTask = await prisma.task.findUnique({ where: { id } });

        const updateData: Record<string, unknown> = {};

        if (title !== undefined) {
            if (typeof title !== "string" || title.trim() === "") {
                res.status(400).json({
                    success: false,
                    error: "title must be a non-empty string",
                });
                return;
            }
            updateData.title = title.trim();
        }

        if (description !== undefined) {
            updateData.description = description ? String(description).trim() : null;
        }

        if (status !== undefined) {
            if (!Object.values(TaskStatus).includes(status)) {
                res.status(400).json({
                    success: false,
                    error: `Invalid status. Allowed values are: ${Object.values(TaskStatus).join(", ")}`,
                });
                return;
            }
            updateData.status = status;
        }

        if (priority !== undefined) {
            if (!Object.values(TaskPriority).includes(priority)) {
                res.status(400).json({
                    success: false,
                    error: `Invalid priority. Allowed values are: ${Object.values(TaskPriority).join(", ")}`,
                });
                return;
            }
            updateData.priority = priority;
        }

        if (dueDate !== undefined) {
            if (dueDate === null) {
                updateData.dueDate = null;
            } else {
                const parsed = new Date(dueDate);
                if (isNaN(parsed.getTime())) {
                    res.status(400).json({
                        success: false,
                        error: "Invalid dueDate format. Must be a valid date string",
                    });
                    return;
                }
                updateData.dueDate = parsed;
            }
        }

        if (assigneeId !== undefined) {
            if (assigneeId === null) {
                updateData.assigneeId = null;
            } else {
                if (typeof assigneeId !== "string" || assigneeId.trim() === "") {
                    res.status(400).json({
                        success: false,
                        error: "assigneeId must be a non-empty string or null",
                    });
                    return;
                }
                const assigneeExists = await prisma.user.findUnique({
                    where: { id: assigneeId.trim() },
                });
                if (!assigneeExists) {
                    res.status(400).json({
                        success: false,
                        error: `User specified by assigneeId '${assigneeId}' does not exist`,
                    });
                    return;
                }
                updateData.assigneeId = assigneeId.trim();
            }
        }

        const updated = await prisma.task.update({
            where: { id },
            data: updateData,
            include: {
                assignee: { select: safeUserSelect },
            },
        });

        const formattedTask = formatTask(updated);

        try {
            getIO().to(req.project.id).emit("taskUpdated", formattedTask);
        } catch (e) {
            console.error("Failed to emit taskUpdated event", e);
        }

        // Trigger Notifications
        if (updated.assigneeId && updated.assigneeId !== req.user?.id) {
            const isNewAssignee = existingTask && existingTask.assigneeId !== updated.assigneeId;
            createAndSendNotification({
                userId: updated.assigneeId,
                workspaceId: req.workspace?.id,
                type: isNewAssignee ? NotificationType.TASK_ASSIGNED : NotificationType.TASK_UPDATED,
                title: isNewAssignee ? "Task Assigned" : "Task Updated",
                message: isNewAssignee
                    ? `You were assigned to task "${updated.title}"`
                    : `Task "${updated.title}" was updated to status ${updated.status}`,
                link: `/projects/${updated.projectId}`,
            }).catch((err) => console.error("Notification error:", err));
        }

        // Audit Logs: TASK_STATUS_CHANGED, TASK_ASSIGNED, TASK_UPDATED
        if (status !== undefined && existingTask?.status !== updated.status) {
            logAuditAction({
                userId: req.user?.id,
                workspaceId: req.workspace?.id,
                projectId: req.project?.id,
                action: "TASK_STATUS_CHANGED",
                entityType: "Task",
                entityId: updated.id,
                details: { title: updated.title, oldStatus: existingTask?.status, newStatus: updated.status },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"] as string,
            }).catch((err) => console.error("Audit log error:", err));
        }

        if (assigneeId !== undefined && existingTask?.assigneeId !== updated.assigneeId && updated.assigneeId) {
            logAuditAction({
                userId: req.user?.id,
                workspaceId: req.workspace?.id,
                projectId: req.project?.id,
                action: "TASK_ASSIGNED",
                entityType: "Task",
                entityId: updated.id,
                details: { title: updated.title, assigneeId: updated.assigneeId },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"] as string,
            }).catch((err) => console.error("Audit log error:", err));
        }

        logAuditAction({
            userId: req.user?.id,
            workspaceId: req.workspace?.id,
            projectId: req.project?.id,
            action: "TASK_UPDATED",
            entityType: "Task",
            entityId: updated.id,
            details: { title: updated.title, updates: updateData },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(200).json({
            success: true,
            message: "Task updated successfully",
            data: formattedTask,
        });
    } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).json({ success: false, error: "Failed to update task" });
    }
};

/**
 * DELETE /api/tasks/:id
 * Permanently delete a task by ID.
 */
export const deleteTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        // requireTaskAccess has already verified task existence and project access.
        const taskToDelete = await prisma.task.findUnique({ where: { id } });

        await prisma.task.delete({ where: { id } });

        try {
            getIO().to(req.project.id).emit("taskDeleted", id);
        } catch (e) {
            console.error("Failed to emit taskDeleted event", e);
        }

        // Audit Log: TASK_DELETED
        logAuditAction({
            userId: req.user?.id,
            workspaceId: req.workspace?.id,
            projectId: req.project?.id,
            action: "TASK_DELETED",
            entityType: "Task",
            entityId: id as string,
            details: { title: taskToDelete?.title || id },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(200).json({
            success: true,
            message: "Task deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).json({ success: false, error: "Failed to delete task" });
    }
};
