import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceAccess } from "../middleware/rbac";
import { getAuditLogs } from "../controllers/auditController";

const router = Router();

router.use(authenticate);

// GET /api/audit-logs?workspaceId=... or /api/audit-logs/workspace/:workspaceId
router.get("/", getAuditLogs);
router.get("/workspace/:workspaceId", requireWorkspaceAccess, getAuditLogs);

export default router;
