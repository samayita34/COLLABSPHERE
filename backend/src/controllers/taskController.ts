import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { TaskPriority, NotificationType, AuditAction } from "../../generated/prisma/enums";
import { getIO } from "../lib/socket";
import { createAndSendNotification } from "../services/notificationService";
import { logAuditAction } from "../services/auditService";
import xss from "xss";

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

const taskFullInclude = {
    assignee: { select: safeUserSelect },
    column: { select: { id: true, name: true, order: true, boardId: true } },
    swimlane: { select: { id: true, name: true, order: true, boardId: true } },
    labels: { include: { label: true } },
    checklists: {
        include: {
            items: { orderBy: { createdAt: "asc" as const } }
        },
        orderBy: { createdAt: "asc" as const }
    },
    attachments: {
        include: { uploadedBy: { select: safeUserSelect } },
        orderBy: { createdAt: "desc" as const }
    },
    timeEntries: {
        include: { user: { select: safeUserSelect } },
        orderBy: { date: "desc" as const }
    },
    _count: {
        select: {
            comments: true,
            attachments: true,
        }
    }
};

/**
 * Format a raw Prisma Task record into the public API shape.
 */
function formatTask(task: any) {
    const labels = (task.labels || []).map((tl: any) => (tl.label ? tl.label : tl));
    const checklists = task.checklists || [];
    const totalChecklistItems = checklists.reduce((acc: number, cl: any) => acc + (cl.items?.length || 0), 0);
    const completedChecklistItems = checklists.reduce((acc: number, cl: any) => acc + (cl.items?.filter((it: any) => it.isCompleted)?.length || 0), 0);
    const totalTimeSpentMinutes = (task.timeEntries || []).reduce((acc: number, entry: any) => acc + (entry.duration || 0), 0);

    return {
        id: task.id,
        title: task.title,
        description: task.description,
        columnId: task.columnId,
        column: task.column ? { id: task.column.id, name: task.column.name, order: task.column.order, boardId: task.column.boardId } : null,
        swimlaneId: task.swimlaneId,
        swimlane: task.swimlane ? { id: task.swimlane.id, name: task.swimlane.name, order: task.swimlane.order, boardId: task.swimlane.boardId } : null,
        order: task.order ?? 0,
        priority: task.priority,
        dueDate: task.dueDate,
        projectId: task.projectId,
        assigneeId: task.assigneeId,
        assignee: task.assignee ?? null,
        labels,
        checklists,
        checklistStats: {
            total: totalChecklistItems,
            completed: completedChecklistItems,
            progress: totalChecklistItems > 0 ? Math.round((completedChecklistItems / totalChecklistItems) * 100) : 0,
        },
        attachmentsCount: task._count?.attachments ?? task.attachments?.length ?? 0,
        attachments: task.attachments || [],
        timeEntries: task.timeEntries || [],
        totalTimeSpentMinutes,
        commentsCount: task._count?.comments ?? task.comments?.length ?? 0,
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

        const scope = (req.query.scope as string) || "all";

        let whereClause: any = {
            project: { workspaceId },
        };

        if (scope === "assigned") {
            whereClause.assigneeId = userId;
        } else if (scope === "created") {
            whereClause.project = { workspaceId, ownerId: userId };
        } else if (scope === "mine") {
            whereClause.OR = [
                { assigneeId: userId },
                { assigneeId: null, project: { ownerId: userId } }
            ];
        }

        const tasks = await prisma.task.findMany({
            where: whereClause,
            include: {
                ...taskFullInclude,
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
            ...formatTask(task),
            columnName: task.column?.name || "Unknown",
            projectName: task.project?.name || "Project",
            projectCode: task.project?.code || null,
            projectStatus: task.project?.status || "ACTIVE",
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
 * Returns all tasks belonging to a project, with full details.
 */
export const getTasksByProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;

        const tasks = await prisma.task.findMany({
            where: { projectId },
            include: taskFullInclude,
            orderBy: [
                { order: "asc" },
                { createdAt: "asc" }
            ],
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
 * GET /api/tasks/:id
 * Get single task by ID with full details.
 */
export const getTaskById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const task = await prisma.task.findUnique({
            where: { id },
            include: taskFullInclude,
        });

        if (!task) {
            res.status(404).json({ success: false, error: "Task not found" });
            return;
        }

        res.status(200).json({
            success: true,
            data: formatTask(task),
        });
    } catch (error) {
        console.error("Error fetching task:", error);
        res.status(500).json({ success: false, error: "Failed to fetch task" });
    }
};

/**
 * POST /api/projects/:projectId/tasks
 * Create a new task under a project.
 */
export const createTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { title, description, priority, dueDate, assigneeId, columnId, swimlaneId, order, labelIds } = req.body;

        if (!title || typeof title !== "string" || title.trim() === "") {
            res.status(400).json({
                success: false,
                error: "Task title is required and must be a non-empty string",
            });
            return;
        }

        if (priority !== undefined && !Object.values(TaskPriority).includes(priority)) {
            res.status(400).json({
                success: false,
                error: `Invalid priority. Allowed values are: ${Object.values(TaskPriority).join(", ")}`,
            });
            return;
        }

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

        if (assigneeId !== undefined && assigneeId !== null && assigneeId !== "") {
            const assigneeExists = await prisma.user.findUnique({
                where: { id: String(assigneeId).trim() },
            });
            if (!assigneeExists) {
                res.status(400).json({
                    success: false,
                    error: `User specified by assigneeId '${assigneeId}' does not exist`,
                });
                return;
            }
        }

        // Validate and resolve columnId safely
        let targetColumnId: string | null = columnId && typeof columnId === "string" && columnId.trim() ? columnId.trim() : null;

        if (targetColumnId) {
            const colExists = await prisma.column.findUnique({ where: { id: targetColumnId } });
            if (!colExists) {
                targetColumnId = null;
            }
        }

        if (!targetColumnId) {
            const board = await prisma.board.findFirst({
                where: { projectId },
                include: { columns: { orderBy: { order: "asc" } } },
            });
            if (board && board.columns.length > 0) {
                targetColumnId = board.columns[0].id;
            } else {
                const newBoard = await prisma.board.create({
                    data: {
                        name: "Main Board",
                        projectId,
                        columns: {
                            create: [
                                { name: "To Do", order: 1000 },
                                { name: "In Progress", order: 2000 },
                                { name: "Review", order: 3000 },
                                { name: "Done", order: 4000 },
                            ],
                        },
                    },
                    include: { columns: true },
                });
                targetColumnId = newBoard.columns[0].id;
            }
        }

        let targetSwimlaneId: string | null = swimlaneId && typeof swimlaneId === "string" && swimlaneId.trim() ? swimlaneId.trim() : null;
        if (targetSwimlaneId) {
            const swimlaneExists = await prisma.swimlane.findUnique({ where: { id: targetSwimlaneId } });
            if (!swimlaneExists) {
                targetSwimlaneId = null;
            }
        }

        const task = await prisma.task.create({
            data: {
                title: xss(title.trim()),
                description: description ? xss(String(description).trim()) : null,
                priority: priority ?? TaskPriority.MEDIUM,
                dueDate: parsedDueDate,
                projectId,
                assigneeId: assigneeId ? String(assigneeId).trim() : null,
                columnId: targetColumnId,
                swimlaneId: targetSwimlaneId,
                order: typeof order === "number" ? order : 0,
                labels: Array.isArray(labelIds) && labelIds.length > 0 ? {
                    create: labelIds.map((lid: string) => ({ labelId: lid }))
                } : undefined,
            },
            include: taskFullInclude,
        });

        const formattedTask = formatTask(task);
        
        try {
            getIO().to(projectId).emit("taskUpdated", formattedTask);
            getIO().to(projectId).emit("taskCreated", formattedTask);
        } catch (e) {
            console.error("Failed to emit task socket events", e);
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
            details: { title: task.title, columnId: task.columnId, swimlaneId: task.swimlaneId, assigneeId: task.assigneeId },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

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
 */
export const updateTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { title, description, priority, dueDate, assigneeId, columnId, swimlaneId, order, semanticStatus, labelIds } = req.body;

        const existingTask = await prisma.task.findUnique({
            where: { id },
            include: { labels: true },
        });

        if (!existingTask) {
            res.status(404).json({ success: false, error: "Task not found" });
            return;
        }

        let finalColumnId = columnId;
        if (semanticStatus) {
            const boards = await prisma.board.findMany({ where: { projectId: existingTask.projectId }, include: { columns: true } });
            if (boards.length > 0) {
                const targetCol = boards[0].columns.find((c: any) => c.name.toLowerCase().includes(semanticStatus.toLowerCase()) || c.name.toLowerCase() === semanticStatus.toLowerCase());
                if (targetCol) finalColumnId = targetCol.id;
            }
        }

        const updateData: Record<string, unknown> = {};

        if (title !== undefined) {
            if (typeof title !== "string" || title.trim() === "") {
                res.status(400).json({ success: false, error: "title must be a non-empty string" });
                return;
            }
            updateData.title = xss(title.trim());
        }

        if (description !== undefined) {
            updateData.description = description ? xss(String(description).trim()) : null;
        }

        if (finalColumnId !== undefined) {
            if (finalColumnId === null) {
                updateData.columnId = null;
            } else {
                updateData.columnId = String(finalColumnId).trim();
            }
        }

        if (swimlaneId !== undefined) {
            updateData.swimlaneId = swimlaneId === null ? null : String(swimlaneId).trim();
        }

        if (order !== undefined) {
            if (typeof order !== "number") {
                res.status(400).json({ success: false, error: "order must be a number" });
                return;
            }
            updateData.order = order;
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
            if (dueDate === null || dueDate === "") {
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
            if (assigneeId === null || assigneeId === "") {
                updateData.assigneeId = null;
            } else {
                updateData.assigneeId = String(assigneeId).trim();
            }
        }

        // Handle labelIds array replacement if provided
        if (Array.isArray(labelIds)) {
            await prisma.taskLabel.deleteMany({ where: { taskId: id } });
            if (labelIds.length > 0) {
                await prisma.taskLabel.createMany({
                    data: labelIds.map((lid: string) => ({ taskId: id, labelId: lid })),
                    skipDuplicates: true,
                });
            }
        }

        const updated = await prisma.task.update({
            where: { id },
            data: updateData,
            include: taskFullInclude,
        });

        const formattedTask = formatTask(updated);

        try {
            getIO().to(updated.projectId).emit("taskUpdated", formattedTask);
        } catch (e) {
            console.error("Failed to emit taskUpdated event", e);
        }

        // Trigger Notifications
        if (updated.assigneeId && updated.assigneeId !== req.user?.id) {
            const isNewAssignee = existingTask && existingTask.assigneeId !== updated.assigneeId;
            const statusChanged = columnId !== undefined && existingTask?.columnId !== updated.columnId;
            const priorityChanged = priority !== undefined && existingTask?.priority !== updated.priority;

            let notifType: NotificationType = NotificationType.TASK_UPDATED;
            let notifTitle = "Task Updated";
            let notifMessage = `Task "${updated.title}" was updated`;

            if (isNewAssignee) {
                notifType = NotificationType.TASK_ASSIGNED;
                notifTitle = "Task Assigned";
                notifMessage = `You were assigned to task "${updated.title}"`;
            } else if (statusChanged) {
                notifType = NotificationType.TASK_STATUS_CHANGED;
                notifTitle = "Task Status Changed";
                notifMessage = `Task "${updated.title}" moved to a new column`;
            } else if (priorityChanged) {
                notifType = NotificationType.TASK_PRIORITY_CHANGED;
                notifTitle = "Task Priority Changed";
                notifMessage = `Task "${updated.title}" priority updated to ${updated.priority}`;
            }

            createAndSendNotification({
                userId: updated.assigneeId,
                workspaceId: req.workspace?.id,
                projectId: updated.projectId,
                taskId: updated.id,
                type: notifType,
                title: notifTitle,
                message: notifMessage,
                link: `/projects/${updated.projectId}`,
            }).catch((err) => console.error("Notification error:", err));
        }

        // Audit Logs
        if (columnId !== undefined && existingTask?.columnId !== updated.columnId) {
            logAuditAction({
                userId: req.user?.id,
                workspaceId: req.workspace?.id,
                projectId: updated.projectId,
                action: "TASK_STATUS_CHANGED",
                entityType: "Task",
                entityId: updated.id,
                details: { title: updated.title, oldColumnId: existingTask?.columnId, newColumnId: updated.columnId },
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"] as string,
            }).catch((err) => console.error("Audit log error:", err));
        }

        if (assigneeId !== undefined && existingTask?.assigneeId !== updated.assigneeId && updated.assigneeId) {
            logAuditAction({
                userId: req.user?.id,
                workspaceId: req.workspace?.id,
                projectId: updated.projectId,
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
            projectId: updated.projectId,
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

        const taskToDelete = await prisma.task.findUnique({ where: { id } });
        if (!taskToDelete) {
            res.status(404).json({ success: false, error: "Task not found" });
            return;
        }

        await prisma.task.delete({ where: { id } });

        try {
            getIO().to(taskToDelete.projectId).emit("taskDeleted", id);
        } catch (e) {
            console.error("Failed to emit taskDeleted event", e);
        }

        logAuditAction({
            userId: req.user?.id,
            workspaceId: req.workspace?.id,
            projectId: taskToDelete.projectId,
            action: "TASK_DELETED",
            entityType: "Task",
            entityId: id as string,
            details: { title: taskToDelete.title },
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
