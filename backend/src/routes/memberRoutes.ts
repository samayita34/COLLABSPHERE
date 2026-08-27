import { Router } from "express";
import { getMembers, addMember, removeMember } from "../controllers/memberController";

import { Permission } from "../lib/permissions";
import { requirePermission } from "../middleware/rbac";

const router = Router({ mergeParams: true });

router.get("/", getMembers);
router.post("/", requirePermission(Permission.INVITE_MEMBERS), addMember);
router.delete("/:memberId", requirePermission(Permission.REMOVE_MEMBERS), removeMember);

export default router;
