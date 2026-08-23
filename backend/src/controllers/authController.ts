import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { getJwtSecret } from "../middleware/auth";

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

function setAuthCookie(res: Response, token: string) {
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
}

/**
 * POST /api/auth/signup
 * Create a new user account and set HTTP-only auth token cookie.
 */
export const signup = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, firstName, lastName, email, password } = req.body;

        if (!email || typeof email !== "string" || !email.includes("@")) {
            res.status(400).json({
                success: false,
                error: "Valid email address is required",
            });
            return;
        }

        if (!password || typeof password !== "string" || password.length < 6) {
            res.status(400).json({
                success: false,
                error: "Password must be at least 6 characters long",
            });
            return;
        }

        let first = firstName;
        let last = lastName;

        if (!first && name && typeof name === "string") {
            const parts = name.trim().split(" ");
            first = parts[0];
            last = parts.slice(1).join(" ") || parts[0];
        }

        if (!first || typeof first !== "string" || first.trim() === "") {
            res.status(400).json({
                success: false,
                error: "First name is required",
            });
            return;
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        if (existingUser) {
            res.status(409).json({
                success: false,
                error: "An account with this email address already exists",
            });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                firstName: first.trim(),
                lastName: (last || "").trim(),
                email: normalizedEmail,
                password: hashedPassword,
                role: "MEMBER",
            },
            select: safeUserSelect,
        });

        const secret = getJwtSecret();
        const token = jwt.sign({ userId: newUser.id, email: newUser.email }, secret, {
            expiresIn: "7d",
        });

        setAuthCookie(res, token);

        res.status(201).json({
            success: true,
            message: "Account created successfully",
            data: newUser,
        });
    } catch (error: any) {
        console.error("Error signing up:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to create account",
        });
    }
};

/**
 * POST /api/auth/login
 * Authenticate user credentials and set HTTP-only auth token cookie.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({
                success: false,
                error: "Email and password are required",
            });
            return;
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        if (!user || !user.password) {
            res.status(401).json({
                success: false,
                error: "Invalid email or password",
            });
            return;
        }

        const isPasswordValid = await bcrypt.compare(String(password), user.password);

        if (!isPasswordValid) {
            res.status(401).json({
                success: false,
                error: "Invalid email or password",
            });
            return;
        }

        const secret = getJwtSecret();
        const token = jwt.sign({ userId: user.id, email: user.email }, secret, {
            expiresIn: "7d",
        });

        setAuthCookie(res, token);

        const { password: _, ...safeUser } = user;

        res.status(200).json({
            success: true,
            message: "Logged in successfully",
            data: safeUser,
        });
    } catch (error: any) {
        console.error("Error logging in:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to log in",
        });
    }
};

/**
 * GET /api/auth/me
 * Get current authenticated user profile.
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            error: "Not authenticated",
        });
        return;
    }

    res.status(200).json({
        success: true,
        data: req.user,
    });
};

/**
 * POST /api/auth/logout
 * Clear HTTP-only auth token cookie.
 */
export const logout = async (_req: Request, res: Response): Promise<void> => {
    res.clearCookie("token");
    res.status(200).json({
        success: true,
        message: "Logged out successfully",
    });
};
