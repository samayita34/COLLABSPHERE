import { Router } from "express";
import { getProjectMessages, sendProjectMessage } from "../controllers/chatController";

const router = Router({ mergeParams: true });

router.get("/", getProjectMessages);
router.post("/", sendProjectMessage);

export default router;
