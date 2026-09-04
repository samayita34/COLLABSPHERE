import { Router } from "express";
import {
    getBoards,
    createBoard,
    updateBoard,
    deleteBoard,
    createColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    createSwimlane,
    updateSwimlane,
    deleteSwimlane,
    reorderSwimlanes,
} from "../controllers/boardController";

const router = Router({ mergeParams: true });

// Boards
router.get("/", getBoards);
router.post("/", createBoard);
router.patch("/:boardId", updateBoard);
router.delete("/:boardId", deleteBoard);

// Columns
router.post("/:boardId/columns", createColumn);
router.patch("/:boardId/columns/reorder", reorderColumns);
router.patch("/columns/:columnId", updateColumn);
router.delete("/columns/:columnId", deleteColumn);

// Swimlanes
router.post("/:boardId/swimlanes", createSwimlane);
router.patch("/:boardId/swimlanes/reorder", reorderSwimlanes);
router.patch("/swimlanes/:swimlaneId", updateSwimlane);
router.delete("/swimlanes/:swimlaneId", deleteSwimlane);

export default router;
