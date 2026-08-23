import { Router } from "express";
import { getDocumentsByProject, createDocument } from "../controllers/documentController";

const router = Router({ mergeParams: true });

router.get("/", getDocumentsByProject);
router.post("/", createDocument);

export default router;
