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
            organization?: any;
            orgRole?: string;
            workspace?: any;
            workspaceRole?: string;
            project?: any;
            projectRole?: string;
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

        if (req.cookies && req.cookies.accessToken) {
            token = req.cookies.accessToken;
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

