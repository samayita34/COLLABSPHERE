import { Router } from "express";
import { getProjectMessages, sendProjectMessage } from "../controllers/chatController";

import { Permission } from "../lib/permissions";
import { requirePermission } from "../middleware/rbac";

const router = Router({ mergeParams: true });

router.get("/", getProjectMessages);
router.post("/", requirePermission(Permission.SEND_MESSAGES), sendProjectMessage);

export default router;
