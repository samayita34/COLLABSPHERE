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

import { hashToken, setAuthCookies, clearAuthCookies } from "../lib/tokens";

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

        const secret = getJwtSecret();

        if (token) {
            try {
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

                if (user) {
                    req.user = user as SafeUser;
                    next();
                    return;
                }
            } catch (e: any) {
                // If token is invalid or expired, fall through to try refreshToken
            }
        }

        // Silent refresh attempt using refreshToken cookie
        if (req.cookies && req.cookies.refreshToken) {
            const refreshToken = req.cookies.refreshToken;
            const hash = hashToken(refreshToken);
            const session = await prisma.session.findUnique({
                where: { refreshTokenHash: hash },
                include: { user: true },
            });

            if (session && !session.revokedAt && new Date() <= session.expiresAt && session.user) {
                const user = session.user;
                const newAccessToken = jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn: "15m" });
                setAuthCookies(res, newAccessToken, refreshToken);

                req.user = {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    avatar: user.avatar,
                    role: user.role,
                    isEmailVerified: user.isEmailVerified,
                    isGoogleUser: user.isGoogleUser,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                };
                next();
                return;
            } else {
                clearAuthCookies(res);
            }
        }

        res.status(401).json({
            success: false,
            error: "Authentication required. Please log in.",
        });
    } catch (error: any) {
        console.error("Auth middleware error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Authentication error",
        });
    }
};

