import { Router } from "express";
import { createOrganization, listOrganizations, getOrganization, updateOrganization } from "../controllers/orgController";
import { authenticate } from "../middleware/auth";

import { requireOrganizationAccess, requirePermission } from "../middleware/rbac";
import { Permission } from "../lib/permissions";

const router = Router();

router.use(authenticate);

router.post("/", createOrganization);
router.get("/", listOrganizations);
router.get("/:id", requireOrganizationAccess, getOrganization);
router.put("/:id", requireOrganizationAccess, requirePermission(Permission.MANAGE_ORGANIZATION), updateOrganization);

export default router;
