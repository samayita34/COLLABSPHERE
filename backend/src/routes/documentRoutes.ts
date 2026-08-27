import { Router } from "express";
import { getDocumentsByProject, createDocument, updateDocument, deleteDocument } from "../controllers/documentController";

import { Permission } from "../lib/permissions";
import { requirePermission } from "../middleware/rbac";

const router = Router({ mergeParams: true });

router.get("/", getDocumentsByProject);
router.post("/", requirePermission(Permission.EDIT_DOCUMENT), createDocument);
router.patch("/:id", requirePermission(Permission.EDIT_DOCUMENT), updateDocument);
router.delete("/:id", requirePermission(Permission.DELETE_DOCUMENT), deleteDocument);

export default router;
