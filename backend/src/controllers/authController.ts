import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { getJwtSecret } from "../middleware/auth";
import { generateToken, hashToken, setAuthCookies, clearAuthCookies } from "../lib/tokens";
import { sendEmail } from "../services/emailService";
import { logAuditAction } from "../services/auditService";

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

async function generateSession(req: Request, res: Response, user: any) {
    const accessToken = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), { expiresIn: "15m" });
    const refreshToken = generateToken();
    const refreshTokenHash = hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.session.create({
        data: {
            userId: user.id,
            refreshTokenHash,
            expiresAt,
            device: req.headers["user-agent"] || "Unknown Device",
            ip: req.ip || "Unknown IP",
        },
    });

    setAuthCookies(res, accessToken, refreshToken);
}

export const signup = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, firstName, lastName, email, password } = req.body;

        if (!email || typeof email !== "string" || !email.includes("@")) {
            res.status(400).json({ success: false, error: "Valid email address is required" });
            return;
        }

        if (!password || typeof password !== "string" || password.length < 6) {
            res.status(400).json({ success: false, error: "Password must be at least 6 characters long" });
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
            res.status(400).json({ success: false, error: "First name is required" });
            return;
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser) {
            res.status(409).json({ success: false, error: "An account with this email address already exists" });
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

        await generateSession(req, res, newUser);

        // Audit Log: User Signup
        logAuditAction({
            userId: newUser.id,
            action: "USER_SIGNUP",
            entityType: "User",
            entityId: newUser.id,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(201).json({
            success: true,
            message: "Account created successfully",
            data: newUser,
        });
    } catch (error: any) {
        console.error("Error signing up:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to create account" });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ success: false, error: "Email and password are required" });
            return;
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

        if (!user || !user.password) {
            res.status(401).json({ success: false, error: "Invalid email or password" });
            return;
        }

        const isPasswordValid = await bcrypt.compare(String(password), user.password);
        if (!isPasswordValid) {
            res.status(401).json({ success: false, error: "Invalid email or password" });
            return;
        }

        await generateSession(req, res, user);
        const { password: _, ...safeUser } = user;

        // Audit Log: User Login
        logAuditAction({
            userId: user.id,
            action: "USER_LOGIN",
            entityType: "User",
            entityId: user.id,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.status(200).json({
            success: true,
            message: "Logged in successfully",
            data: safeUser,
        });
    } catch (error: any) {
        console.error("Error logging in:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to log in" });
    }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            res.status(401).json({ success: false, error: "No refresh token provided" });
            return;
        }

        const hash = hashToken(refreshToken);
        const session = await prisma.session.findUnique({ where: { refreshTokenHash: hash }, include: { user: true } });

        if (!session || session.revokedAt || new Date() > session.expiresAt) {
            clearAuthCookies(res);
            res.status(401).json({ success: false, error: "Invalid or expired session" });
            return;
        }

        const accessToken = jwt.sign({ userId: session.user.id, email: session.user.email }, getJwtSecret(), { expiresIn: "15m" });
        setAuthCookies(res, accessToken, refreshToken);

        res.status(200).json({ success: true, message: "Session refreshed" });
    } catch (error) {
        console.error("Error refreshing token:", error);
        res.status(500).json({ success: false, error: "Failed to refresh session" });
    }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            const hash = hashToken(refreshToken);
            await prisma.session.deleteMany({ where: { refreshTokenHash: hash } });
        }

        if (req.user?.id) {
            logAuditAction({
                userId: req.user.id,
                action: "USER_LOGOUT",
                entityType: "User",
                entityId: req.user.id,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"] as string,
            }).catch((err) => console.error("Audit log error:", err));
        }

        clearAuthCookies(res);
        res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to log out" });
    }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
    }
    res.status(200).json({ success: true, data: req.user });
};

// ======================= OAUTH =======================

export const googleLogin = (req: Request, res: Response): void => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    if (!clientId) {
        res.redirect(`${frontendUrl}/auth/callback?status=error&reason=oauth_not_configured`);
        return;
    }

    // Generate PKCE verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

    // Generate state nonce for CSRF protection
    const stateNonce = crypto.randomBytes(24).toString("base64url");

    const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/api/auth/google",
        maxAge: 10 * 60 * 1000, // 10 minutes
    };

    // Store PKCE verifier and state nonce in secure HttpOnly cookies
    res.cookie("oauth_pkce_verifier", codeVerifier, cookieOpts);
    res.cookie("oauth_state", stateNonce, cookieOpts);

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "email profile",
        access_type: "offline",
        prompt: "consent",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state: stateNonce,
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};

export const googleCallback = async (req: Request, res: Response): Promise<void> => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const cookieClearOpts = { path: "/api/auth/google" };

    const redirectError = (reason: string) => {
        res.clearCookie("oauth_pkce_verifier", cookieClearOpts);
        res.clearCookie("oauth_state", cookieClearOpts);
        res.redirect(`${frontendUrl}/auth/callback?status=error&reason=${encodeURIComponent(reason)}`);
    };

    try {
        const { code, state: returnedState, error: oauthError } = req.query;

        // Handle Google-side errors (e.g. user denied access)
        if (oauthError) {
            redirectError(String(oauthError));
            return;
        }

        if (!code) {
            redirectError("no_code");
            return;
        }

        // ── CSRF: Validate state nonce ──────────────────────────────────────
        const storedState = req.cookies.oauth_state;
        if (!storedState || !returnedState || storedState !== String(returnedState)) {
            redirectError("state_mismatch");
            return;
        }

        // ── PKCE: Retrieve verifier ─────────────────────────────────────────
        const codeVerifier = req.cookies.oauth_pkce_verifier;
        if (!codeVerifier) {
            redirectError("pkce_expired");
            return;
        }

        // Clear both security cookies immediately after validation
        res.clearCookie("oauth_pkce_verifier", cookieClearOpts);
        res.clearCookie("oauth_state", cookieClearOpts);

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";

        // ── Exchange authorization code for tokens ──────────────────────────
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code: String(code),
                client_id: clientId!,
                client_secret: clientSecret!,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
                code_verifier: codeVerifier,
            }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            console.error("Google token exchange error:", tokenData);
            redirectError("token_exchange_failed");
            return;
        }

        // ── Fetch Google user profile ───────────────────────────────────────
        const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const userData = await userRes.json();
        if (!userData.email) {
            redirectError("no_email");
            return;
        }

        // ── Upsert user (account linking + profile sync) ───────────────────
        const normalizedEmail = userData.email.toLowerCase();
        let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        const isNewUser = !user;

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: normalizedEmail,
                    firstName: userData.given_name || "Google",
                    lastName: userData.family_name || "User",
                    avatar: userData.picture || null,
                    isEmailVerified: true,
                    isGoogleUser: true,
                    role: "MEMBER",
                },
            });
        } else {
            // Account Linking & Profile Synchronization
            user = await prisma.user.update({
                where: { email: normalizedEmail },
                data: {
                    isGoogleUser: true,
                    isEmailVerified: true,
                    avatar: user.avatar || userData.picture || null,
                    firstName: user.firstName || userData.given_name || "Google",
                    lastName: user.lastName || userData.family_name || "User",
                },
            });
        }

        // ── Create session (sets HttpOnly cookies) ──────────────────────────
        await generateSession(req, res, user);

        // ── Audit log ───────────────────────────────────────────────────────
        logAuditAction({
            userId: user.id,
            action: isNewUser ? "GOOGLE_SIGNUP" : "GOOGLE_LOGIN",
            entityType: "User",
            entityId: user.id,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error (Google OAuth):", err));

        // ── Redirect to frontend callback page (not directly to /projects) ──
        res.redirect(`${frontendUrl}/auth/callback?status=success`);
    } catch (error) {
        console.error("Google callback error:", error);
        redirectError("server_error");
    }
};

// ======================= PASSWORD RESET & EMAIL VERIFICATION =======================

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ success: false, error: "Email is required" });
            return;
        }

        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user || user.isGoogleUser) {
            // Do not leak existence, just return success
            res.json({ success: true, message: "If an account exists, a reset link has been sent." });
            return;
        }

        const token = generateToken();
        const hash = hashToken(token);
        
        await prisma.verificationToken.create({
            data: {
                userId: user.id,
                tokenHash: hash,
                type: "PASSWORD_RESET",
                expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
            }
        });

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const resetLink = `${frontendUrl}/reset-password?token=${token}`;

        await sendEmail(
            user.email,
            "Reset your COLLABSPHERE password",
            `Hi ${user.firstName},\n\nClick the link below to reset your password (expires in 1 hour):\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.`,
            `<p>Hi <strong>${user.firstName}</strong>,</p>
<p>Click the button below to reset your COLLABSPHERE password. This link expires in <strong>1 hour</strong>.</p>
<p><a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Reset Password</a></p>
<p>Or copy this URL into your browser:<br><code>${resetLink}</code></p>
<p style="color:#64748b;font-size:0.875rem;">If you did not request a password reset, you can safely ignore this email.</p>`
        );

        res.json({ success: true, message: "If an account exists, a reset link has been sent." });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to request password reset" });
    }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword || newPassword.length < 6) {
            res.status(400).json({ success: false, error: "Valid token and password (min 6 chars) are required" });
            return;
        }

        const hash = hashToken(token);
        const resetRecord = await prisma.verificationToken.findUnique({ where: { tokenHash: hash }, include: { user: true } });

        if (!resetRecord || resetRecord.type !== "PASSWORD_RESET" || resetRecord.usedAt || new Date() > resetRecord.expiresAt) {
            res.status(400).json({ success: false, error: "Invalid or expired token" });
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({ where: { id: resetRecord.userId }, data: { password: hashedPassword } });
        await prisma.verificationToken.update({ where: { id: resetRecord.id }, data: { usedAt: new Date() } });
        // Optionally revoke all active sessions to force login
        await prisma.session.deleteMany({ where: { userId: resetRecord.userId } });

        // Audit Log: Password Reset
        logAuditAction({
            userId: resetRecord.userId,
            action: "PASSWORD_RESET",
            entityType: "User",
            entityId: resetRecord.userId,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to reset password" });
    }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.body;
        if (!token) {
            res.status(400).json({ success: false, error: "Token is required" });
            return;
        }

        const hash = hashToken(token);
        const record = await prisma.verificationToken.findUnique({ where: { tokenHash: hash } });

        if (!record || record.type !== "EMAIL_VERIFICATION" || record.usedAt || new Date() > record.expiresAt) {
            res.status(400).json({ success: false, error: "Invalid or expired token" });
            return;
        }

        await prisma.user.update({ where: { id: record.userId }, data: { isEmailVerified: true } });
        await prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });

        // Audit Log: Email Verified
        logAuditAction({
            userId: record.userId,
            action: "EMAIL_VERIFIED",
            entityType: "User",
            entityId: record.userId,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"] as string,
        }).catch((err) => console.error("Audit log error:", err));

        res.json({ success: true, message: "Email verified successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to verify email" });
    }
};

// ======================= SESSION MANAGEMENT =======================

export const getSessions = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "Not authenticated" });
            return;
        }

        const sessions = await prisma.session.findMany({
            where: { userId: req.user.id },
            select: {
                id: true,
                createdAt: true,
                expiresAt: true,
                device: true,
                ip: true,
            },
            orderBy: { createdAt: "desc" }
        });

        res.status(200).json({ success: true, data: sessions });
    } catch (error) {
        console.error("Error getting sessions:", error);
        res.status(500).json({ success: false, error: "Failed to get sessions" });
    }
};

export const revokeSession = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: "Not authenticated" });
            return;
        }

        const { id } = req.params;
        const session = await prisma.session.findUnique({ where: { id } });

        if (!session || session.userId !== req.user.id) {
            res.status(404).json({ success: false, error: "Session not found" });
            return;
        }

        await prisma.session.delete({ where: { id } });

        res.status(200).json({ success: true, message: "Session revoked" });
    } catch (error) {
        console.error("Error revoking session:", error);
        res.status(500).json({ success: false, error: "Failed to revoke session" });
    }
};
