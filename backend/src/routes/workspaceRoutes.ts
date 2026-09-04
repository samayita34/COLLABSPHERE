import { Router } from "express";
import { 
    createWorkspace, 
    listWorkspacesForOrg, 
    getUserWorkspaces,
    getWorkspace, 
    getWorkspaceOverview,
    updateWorkspace, 
    deleteWorkspace,
    addWorkspaceMember,
    removeWorkspaceMember,
    getWorkspaceDocuments,
    getWorkspaceFiles,
    getWorkspaceMessages
} from "../controllers/workspaceController";
import { getWorkspaceAnalytics } from "../controllers/analyticsController";
import { getAuditLogs } from "../controllers/auditController";
import { authenticate } from "../middleware/auth";
import { validateTenantContext } from "../middleware/tenantValidation";

import { requireWorkspaceAccess, requireOrganizationAccess, requirePermission } from "../middleware/rbac";
import { Permission } from "../lib/permissions";

const router = Router();

router.use(authenticate);
router.use(validateTenantContext);

// Organization-level operations (workspace creation/listing)
router.post("/", requireOrganizationAccess, requirePermission(Permission.MANAGE_WORKSPACE), createWorkspace);
router.get("/org/:orgId", requireOrganizationAccess, listWorkspacesForOrg);

// Current user's workspaces based on WorkspaceMember
router.get("/", getUserWorkspaces);

// Workspace-level operations
router.get("/:id", requireWorkspaceAccess, getWorkspace);
router.get("/:id/overview", requireWorkspaceAccess, getWorkspaceOverview);
router.get("/:id/analytics", requireWorkspaceAccess, getWorkspaceAnalytics);
router.get("/:id/documents", requireWorkspaceAccess, getWorkspaceDocuments);
router.get("/:id/files", requireWorkspaceAccess, getWorkspaceFiles);
router.get("/:id/messages", requireWorkspaceAccess, getWorkspaceMessages);
router.get("/:id/audit-logs", requireWorkspaceAccess, requirePermission(Permission.VIEW_AUDIT_LOGS), getAuditLogs);
router.put("/:id", requireWorkspaceAccess, requirePermission(Permission.MANAGE_WORKSPACE), updateWorkspace);
router.delete("/:id", requireWorkspaceAccess, requirePermission(Permission.DELETE_WORKSPACE), deleteWorkspace);

// Member management
router.post("/:id/members", requireWorkspaceAccess, requirePermission(Permission.INVITE_MEMBERS), addWorkspaceMember);
router.delete("/:id/members/:targetUserId", requireWorkspaceAccess, requirePermission(Permission.REMOVE_MEMBERS), removeWorkspaceMember);

export default router;
