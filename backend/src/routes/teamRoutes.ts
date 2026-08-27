import { Router } from "express";
import { 
    createTeam, 
    listTeams, 
    updateTeam, 
    deleteTeam,
    addTeamMember,
    removeTeamMember
} from "../controllers/teamController";
import { authenticate } from "../middleware/auth";

import { requireWorkspaceAccess, requireTeamAccess, requirePermission } from "../middleware/rbac";
import { Permission } from "../lib/permissions";

const router = Router();

router.use(authenticate);

router.post("/", requireWorkspaceAccess, requirePermission(Permission.MANAGE_WORKSPACE), createTeam);
router.get("/workspace/:workspaceId", requireWorkspaceAccess, listTeams);
router.put("/:id", requireTeamAccess, requirePermission(Permission.MANAGE_WORKSPACE), updateTeam);
router.delete("/:id", requireTeamAccess, requirePermission(Permission.MANAGE_WORKSPACE), deleteTeam);

// Member management
router.post("/:id/members", requireTeamAccess, requirePermission(Permission.INVITE_MEMBERS), addTeamMember);
router.delete("/:id/members/:targetUserId", requireTeamAccess, requirePermission(Permission.REMOVE_MEMBERS), removeTeamMember);

export default router;
