import { Router } from "express";
import { getFilesByProject, createFile } from "../controllers/fileController";
import { upload } from "../middleware/upload";

import { Permission } from "../lib/permissions";
import { requirePermission } from "../middleware/rbac";

const router = Router({ mergeParams: true });

router.get("/", getFilesByProject);
router.post("/", requirePermission(Permission.UPLOAD_FILES), upload.single("file"), createFile);

export default router;
