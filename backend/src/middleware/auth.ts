import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

export interface SafeUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string | null;
    role: string;
    isEmailVerified: boolean;
    isGoogleUser: boolean;
    createdAt: Date;
    updatedAt: Date;
}

declare global {
    namespace Express {
        interface Request {
            user?: SafeUser;
        }
    }
}

export const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET environment variable is missing in backend configuration.");
    }
    return secret;
};

export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        let token: string | undefined;

        if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            res.status(401).json({
                success: false,
                error: "Authentication required. Please log in.",
            });
            return;
        }

        const secret = getJwtSecret();
        const decoded = jwt.verify(token, secret) as { userId: string; email: string };

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
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
            },
        });

        if (!user) {
            res.status(401).json({
                success: false,
                error: "User associated with this token no longer exists.",
            });
            return;
        }

        req.user = user as SafeUser;
        next();
    } catch (error: any) {
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            res.status(401).json({
                success: false,
                error: "Invalid or expired authentication token.",
            });
            return;
        }

        console.error("Auth middleware error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Authentication error",
        });
    }
};

/**
 * Check if a user is either the owner or a member of a project.
 */
export async function isUserProjectMemberOrOwner(userId: string, projectId: string): Promise<boolean> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
            ownerId: true,
            members: {
                where: { userId },
                select: { id: true },
            },
        },
    });

    if (!project) return false;
    if (project.ownerId === userId) return true;
    return project.members.length > 0;
}

/**
 * Authorization middleware enforcing project membership or ownership.
 * Checks params: projectId or id.
 */
export const authorizeProjectAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "Authentication required" });
            return;
        }

        const rawProjectId = req.params.projectId || req.params.id;
        if (!rawProjectId) {
            next();
            return;
        }

        const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;

        const hasAccess = await isUserProjectMemberOrOwner(req.user.id, projectId);
        if (!hasAccess) {
            res.status(403).json({
                success: false,
                error: "Access denied. You are not a member or owner of this project.",
            });
            return;
        }

        next();
    } catch (error) {
        console.error("Project authorization error:", error);
        res.status(500).json({ success: false, error: "Authorization error" });
    }
};

