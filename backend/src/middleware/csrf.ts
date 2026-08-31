import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

const EXEMPT_PREFIXES = ["/api/auth/"];

export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
    // Check if cookie exists on incoming request
    let csrfCookie = req.cookies[CSRF_COOKIE_NAME];
    const isNewCookie = !csrfCookie;
    
    if (isNewCookie) {
        // Generate a new CSRF token
        csrfCookie = crypto.randomBytes(32).toString("hex");
        res.cookie(CSRF_COOKIE_NAME, csrfCookie, {
            httpOnly: false, // Must be readable by frontend JavaScript to send in the header
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
        });
    }

    // Safe methods bypass CSRF check
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        return next();
    }

    // Public authentication endpoints bypass CSRF check as session is being created/refreshed
    const path = req.originalUrl || req.path;
    if (EXEMPT_PREFIXES.some(prefix => path.startsWith(prefix))) {
        return next();
    }

    // If no cookie was sent in the request, allow this initial request so the browser receives the fresh cookie
    if (isNewCookie) {
        return next();
    }

    // Unsafe methods must include the correct token matching the existing cookie
    const csrfHeader = req.headers[CSRF_HEADER_NAME];
    if (!csrfHeader || csrfHeader !== csrfCookie) {
        res.status(403).json({ success: false, error: "Invalid CSRF token" });
        return;
    }

    next();
};
