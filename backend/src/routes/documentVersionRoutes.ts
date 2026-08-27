import { Router } from "express";
import { getDocumentVersions, createDocumentVersion, restoreDocumentVersion } from "../controllers/documentVersionController";
import { requirePermission } from "../middleware/rbac";
import { Permission } from "../lib/permissions";

const router = Router({ mergeParams: true });

router.get("/", getDocumentVersions);
router.post("/", requirePermission(Permission.EDIT_DOCUMENT), createDocumentVersion);
router.post("/:versionId/restore", requirePermission(Permission.EDIT_DOCUMENT), restoreDocumentVersion);

export default router;
