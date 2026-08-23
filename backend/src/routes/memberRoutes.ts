import { Router } from "express";
import { getMembers, addMember, removeMember } from "../controllers/memberController";

const router = Router({ mergeParams: true });

router.get("/", getMembers);
router.post("/", addMember);
router.delete("/:memberId", removeMember);

export default router;
