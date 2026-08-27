import { Router } from "express";
import {
    getTasksByProject,
    createTask,
} from "../controllers/taskController";

import { Permission } from "../lib/permissions";
import { requirePermission } from "../middleware/rbac";

const router = Router({ mergeParams: true });

router.get("/", getTasksByProject);
router.post("/", requirePermission(Permission.CREATE_TASK), createTask);

export default router;
