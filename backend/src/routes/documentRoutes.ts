import { Router } from "express";
import {
    getDocumentsByProject,
    createDocument,
    uploadDocumentFile,
    getDocumentRawFile,
    updateDocument,
    deleteDocument,
} from "../controllers/documentController";
import { upload } from "../middleware/upload";
import { Permission } from "../lib/permissions";
import { requirePermission } from "../middleware/rbac";

const router = Router({ mergeParams: true });

router.get("/", getDocumentsByProject);
router.post("/", requirePermission(Permission.EDIT_DOCUMENT), createDocument);
router.post("/upload", requirePermission(Permission.UPLOAD_FILES), upload.single("file"), uploadDocumentFile);
router.get("/:id/raw", getDocumentRawFile);
router.patch("/:id", requirePermission(Permission.EDIT_DOCUMENT), updateDocument);
router.delete("/:id", requirePermission(Permission.DELETE_DOCUMENT), deleteDocument);

export default router;
