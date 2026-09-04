import { Router } from "express";
import { signup, login, getMe, logout, refresh, googleLogin, googleCallback, forgotPassword, resetPassword, verifyEmail, getSessions, revokeSession, changePassword } from "../controllers/authController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", authenticate, getMe);
router.post("/logout", logout);
router.post("/refresh", refresh);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/verify-email", verifyEmail);

router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);

router.get("/sessions", authenticate, getSessions);
router.delete("/sessions/:id", authenticate, revokeSession);
router.post("/change-password", authenticate, changePassword);

export default router;
