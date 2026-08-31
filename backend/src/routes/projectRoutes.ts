import { Router } from "express";
import {
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
} from "../controllers/projectController";
import { getProjectMessages, sendProjectMessage } from "../controllers/chatController";
import { requireProjectAccess, requireWorkspaceAccess, requirePermission } from "../middleware/rbac";
import { Permission } from "../lib/permissions";

const router = Router();

router.get("/", getProjects);
router.post("/", requireWorkspaceAccess, requirePermission(Permission.CREATE_PROJECT), createProject);
router.get("/:id", requireProjectAccess, requirePermission(Permission.VIEW_PROJECT), getProjectById);
router.patch("/:id", requireProjectAccess, updateProject);
router.delete("/:id", requireProjectAccess, deleteProject);

router.get("/:id/messages", requireProjectAccess, getProjectMessages);
router.post("/:id/messages", requireProjectAccess, sendProjectMessage);

export default router;
