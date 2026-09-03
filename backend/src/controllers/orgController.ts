import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const createOrganization = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, slug } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        if (!name || typeof name !== "string" || name.trim() === "" || !slug || typeof slug !== "string" || slug.trim() === "") {
            res.status(400).json({ success: false, error: "Valid name and slug are required" });
            return;
        }

        const existing = await prisma.organization.findUnique({ where: { slug } });
        if (existing) {
            res.status(409).json({ success: false, error: "Organization slug already exists" });
            return;
        }

        const org = await prisma.organization.create({
            data: {
                name,
                slug,
                members: {
                    create: {
                        userId,
                        role: "ORG_ADMIN",
                    },
                },
            },
        });

        res.status(201).json({ success: true, organization: org });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to create organization" });
    }
};

export const listOrganizations = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const orgs = await prisma.organization.findMany({
            where: {
                OR: [
                    { members: { some: { userId } } },
                    { workspaces: { some: { members: { some: { userId } } } } },
                ],
            },
            include: {
                members: {
                    where: { userId },
                    select: { role: true },
                },
            },
        });

        res.status(200).json({ success: true, organizations: orgs });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to fetch organizations" });
    }
};

export const getOrganization = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const org = await prisma.organization.findFirst({
            where: {
                id,
                OR: [
                    { members: { some: { userId } } },
                    { workspaces: { some: { members: { some: { userId } } } } },
                ],
            },
            include: {
                members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } } },
            }
        });

        if (!org) {
            res.status(404).json({ success: false, error: "Organization not found" });
            return;
        }

        res.status(200).json({ success: true, organization: org });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to fetch organization" });
    }
};

export const updateOrganization = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        if (!name || typeof name !== "string" || name.trim() === "") {
            res.status(400).json({ success: false, error: "Valid name is required" });
            return;
        }

        const org = await prisma.organization.update({
            where: { id },
            data: { name },
        });

        res.status(200).json({ success: true, organization: org });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Failed to update organization" });
    }
};
