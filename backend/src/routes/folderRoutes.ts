import { Router } from "express";
import { getFolders, createFolder, renameFolder, moveFolder, deleteFolder } from "../controllers/folderController";
import { Permission } from "../lib/permissions";
import { requirePermission } from "../middleware/rbac";

const router = Router({ mergeParams: true });

router.get("/", requirePermission(Permission.VIEW_PROJECT), getFolders);
router.post("/", requirePermission(Permission.UPLOAD_FILES), createFolder);
router.patch("/:folderId/rename", requirePermission(Permission.UPLOAD_FILES), renameFolder);
router.patch("/:folderId/move", requirePermission(Permission.UPLOAD_FILES), moveFolder);
router.delete("/:folderId", requirePermission(Permission.DELETE_FILES), deleteFolder);

export default router;
