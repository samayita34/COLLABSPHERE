import { Router } from "express";
import {
    getProjectLabels,
    createProjectLabel,
    updateProjectLabel,
    deleteProjectLabel,
} from "../controllers/labelController";

const router = Router({ mergeParams: true });

router.get("/", getProjectLabels);
router.post("/", createProjectLabel);
router.patch("/:labelId", updateProjectLabel);
router.delete("/:labelId", deleteProjectLabel);

export default router;
