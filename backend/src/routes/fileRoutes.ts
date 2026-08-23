import { Router } from "express";
import { getFilesByProject, createFile } from "../controllers/fileController";

const router = Router({ mergeParams: true });

router.get("/", getFilesByProject);
router.post("/", createFile);

export default router;
