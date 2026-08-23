import { Router } from "express";
import {
    getTasksByProject,
    createTask,
} from "../controllers/taskController";

const router = Router({ mergeParams: true });

router.get("/", getTasksByProject);
router.post("/", createTask);

export default router;
