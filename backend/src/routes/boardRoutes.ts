import { Router } from "express";
import { getBoards, createBoard, createColumn, updateColumn } from "../controllers/boardController";

const router = Router({ mergeParams: true });

router.get("/", getBoards);
router.post("/", createBoard);

// Note: In server.ts, this router is mounted at /api/projects/:projectId/boards
// We need endpoints like POST /api/projects/:projectId/boards/:boardId/columns
router.post("/:boardId/columns", createColumn);

export default router;
