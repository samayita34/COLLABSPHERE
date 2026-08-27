import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { ProjectMemberRole, NotificationType, AuditAction } from "../../generated/prisma/enums";
import { sendEmail } from "../services/emailService";
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
 * Format a raw Prisma ProjectMember record into the public API shape.
 */
function formatMember(m: any) {
    return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
    };
}

/**
 * GET /api/projects/:projectId/members
 * Returns all members of a project with their safe user fields.
 */
export const getMembers = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;

        // requireProjectAccess has verified access and project existence.

        const members = await prisma.projectMember.findMany({
            where: { projectId },
            include: { user: { select: safeUserSelect } },
            orderBy: { joinedAt: "asc" },
        });

        res.status(200).json({
            success: true,
            count: members.length,
            data: members.map(formatMember),
        });
    } catch (error) {
        console.error("Error fetching members:", error);
        res.status(500).json({ success: false, error: "Failed to fetch members" });
    }
};

/**
 * POST /api/projects/:projectId/members
 * Add an existing user to a project by email.
 *
 * Required body: { email }
 * Optional body: { role } — ProjectMemberRole enum (ADMIN | MEMBER | VIEWER). Defaults to MEMBER.
 *
 * Rules:
 *  - User must already exist (looked up by email). Never creates a user.
 *  - Returns 404 if no user found with that email.
 *  - Returns 409 if the user is already a member of this project.
 */
export const addMember = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { email, role } = req.body;

        const project = req.project;

        // email is required
        if (!email || typeof email !== "string" || email.trim() === "") {
            res.status(400).json({
                success: false,
                error: "email is required and must be a non-empty string",
            });
            return;
        }

        // Validate role enum if provided
        if (role !== undefined && !Object.values(ProjectMemberRole).includes(role)) {
            res.status(400).json({
                success: false,
                error: `Invalid role. Allowed values are: ${Object.values(ProjectMemberRole).join(", ")}`,
            });
            return;
        }

        // Look up user by email — do NOT create if missing
        const user = await prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() },
            select: safeUserSelect,
        });

        if (!user) {
            res.status(404).json({
                success: false,
                error: "User not found. They must have an account before being added to a project.",
            });
            return;
        }

        // Check for duplicate membership before attempting insert
        const existing = await prisma.projectMember.findUnique({
            where: { projectId_userId: { projectId, userId: user.id } },
        });

        if (existing) {
            res.status(409).json({
                success: false,
                error: "This user is already a member of the project.",
            });
            return;
        }

        const member = await prisma.projectMember.create({
            data: {
                projectId,
                userId: user.id,
                role: (role as ProjectMemberRole) ?? ProjectMemberRole.MEMBER,
            },
            include: { user: { select: safeUserSelect } },
        });

        // Trigger Notification: Workspace / Project Invitation
        createAndSendNotification({
            userId: user.id,
            workspaceId: req.workspace?.id,
            type: NotificationType.WORKSPACE_INVITATION,
            title: "Project Invitation",
            message: `You were added to project "${project.name}" as ${member.role}`,
            link: `/projects/${projectId}`,
        }).catch((err) => console.error("Notification error:", err));

        // Audit Log: MEMBER_INVITED
        logAuditAction({
            userId: req.user?.id,
            workspaceId: req.workspace?.id,
            projectId: projectId as string,
            action: "MEMBER_INVITED",
            entityType: "ProjectMember",
            entityId: member.id,
            details: { targetUserId: user.id, role: member.role },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(201).json({
            success: true,
            message: "Member added successfully",
            data: formatMember(member),
        });
    } catch (error: any) {
        console.error("Error adding member:", error);

        // Fallback: catch DB-level unique violation (race condition safety net)
        if (error?.code === "P2002") {
            res.status(409).json({
                success: false,
                error: "This user is already a member of the project.",
            });
            return;
        }

        res.status(500).json({ success: false, error: "Failed to add member" });
    }
};

/**
 * DELETE /api/projects/:projectId/members/:memberId
 * Remove a member from a project by their ProjectMember record ID.
 * The project owner cannot be removed.
 */
export const removeMember = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, memberId } = req.params;

        const project = req.project;

        const member = await prisma.projectMember.findUnique({ where: { id: memberId as string } });
        if (!member || member.projectId !== (projectId as string)) {
            res.status(404).json({ success: false, error: "Member not found in this project" });
            return;
        }

        // Prevent removing the project owner
        if (member.userId === project.ownerId) {
            res.status(400).json({
                success: false,
                error: "The project owner cannot be removed from the project.",
            });
            return;
        }

        await prisma.projectMember.delete({ where: { id: memberId as string } });

        // Audit Log: MEMBER_REMOVED
        logAuditAction({
            userId: req.user?.id,
            workspaceId: req.workspace?.id,
            projectId: (Array.isArray(projectId) ? projectId[0] : projectId) as string,
            action: "MEMBER_REMOVED",
            entityType: "ProjectMember",
            entityId: (Array.isArray(memberId) ? memberId[0] : memberId) as string,
            details: { removedUserId: member.userId },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(200).json({
            success: true,
            message: "Member removed successfully",
        });
    } catch (error) {
        console.error("Error removing member:", error);
        res.status(500).json({ success: false, error: "Failed to remove member" });
    }
};
