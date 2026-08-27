import crypto from "crypto";
import { Response } from "express";

export function generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = process.env.NODE_ENV === "production";
    
    // Access token - short lived
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Refresh token - long lived
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
}

export function clearAuthCookies(res: Response) {
    const isProd = process.env.NODE_ENV === "production";
    const commonOpts = {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax" as const,
        path: "/",
    };
    
    res.clearCookie("accessToken", commonOpts);
    res.clearCookie("refreshToken", commonOpts);
}
