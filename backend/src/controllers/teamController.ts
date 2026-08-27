import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const createTeam = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, workspaceId } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        if (!name || !workspaceId) {
            res.status(400).json({ success: false, error: "Name and workspaceId are required" });
            return;
        }



        const team = await prisma.team.create({
            data: {
                name,
                description,
                workspaceId,
            },
        });

        res.status(201).json({ success: true, team });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to create team" });
    }
};

export const listTeams = async (req: Request, res: Response): Promise<void> => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }



        const teams = await prisma.team.findMany({
            where: { workspaceId },
            include: {
                members: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } },
            },
        });

        res.status(200).json({ success: true, teams });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to fetch teams" });
    }
};

export const updateTeam = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }



        const updated = await prisma.team.update({
            where: { id },
            data: { name, description },
        });

        res.status(200).json({ success: true, team: updated });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to update team" });
    }
};

export const deleteTeam = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }



        await prisma.team.delete({ where: { id } });

        res.status(200).json({ success: true, message: "Team deleted successfully" });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to delete team" });
    }
};

export const addTeamMember = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { userId: targetUserId } = req.body;
        const userId = req.user?.id;

        if (!userId) return;

        const team = await prisma.team.findUnique({ where: { id }, select: { workspaceId: true } });
        if (!team) {
            res.status(404).json({ success: false, error: "Team not found" });
            return;
        }

        // Verify target user is in the workspace
        const targetWsMember = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: team.workspaceId, userId: targetUserId } },
        });

        if (!targetWsMember) {
            res.status(400).json({ success: false, error: "User is not a member of the workspace" });
            return;
        }

        const member = await prisma.teamMember.create({
            data: {
                teamId: id,
                userId: targetUserId,
            }
        });

        res.status(200).json({ success: true, member });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to add team member" });
    }
};

export const removeTeamMember = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id, targetUserId } = req.params;
        const userId = req.user?.id;

        if (!userId) return;



        await prisma.teamMember.delete({
            where: { teamId_userId: { teamId: id, userId: targetUserId } },
        });

        res.status(200).json({ success: true, message: "Member removed from team" });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to remove team member" });
    }
};
