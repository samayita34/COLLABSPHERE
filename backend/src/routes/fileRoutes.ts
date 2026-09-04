import { Router } from "express";
import {
    getFilesByProject,
    createFile,
    deleteFile,
    downloadFile,
    toggleLockFile,
    downloadRawFile,
    getStorageQuota,
    moveFile,
    restoreFileVersion,
    getFileDownloads,
} from "../controllers/fileController";
import { upload } from "../middleware/upload";
import { Permission } from "../lib/permissions";
import { requirePermission } from "../middleware/rbac";

// Used for raw download if local storage is used
const globalRouter = Router();
globalRouter.get("/download/:key", downloadRawFile);

const router = Router({ mergeParams: true });

router.get("/storage-quota", requirePermission(Permission.VIEW_PROJECT), getStorageQuota);
router.get("/", requirePermission(Permission.VIEW_PROJECT), getFilesByProject);
router.post("/", requirePermission(Permission.UPLOAD_FILES), upload.single("file"), createFile);
router.delete("/:fileId", requirePermission(Permission.DELETE_FILES), deleteFile);
router.get("/:fileId/download", requirePermission(Permission.VIEW_PROJECT), downloadFile);
router.patch("/:fileId/lock", requirePermission(Permission.UPLOAD_FILES), toggleLockFile);
router.patch("/:fileId/move", requirePermission(Permission.UPLOAD_FILES), moveFile);
router.post("/:fileId/versions/:versionId/restore", requirePermission(Permission.UPLOAD_FILES), restoreFileVersion);
router.get("/:fileId/downloads", requirePermission(Permission.VIEW_PROJECT), getFileDownloads);

export { globalRouter, router as default };
