import { Router } from "express";
import { 
    addLabelToTask, 
    createChecklist, 
    addChecklistItem, 
    updateChecklistItem, 
    addTimeEntry 
} from "../controllers/taskDetailsController";

import {
    getComments,
    createComment,
    deleteComment
} from "../controllers/taskDiscussionController";

const router = Router({ mergeParams: true });

router.post("/:taskId/labels", addLabelToTask);
router.post("/:taskId/checklists", createChecklist);
router.post("/checklists/:checklistId/items", addChecklistItem);
router.patch("/checklists/items/:itemId", updateChecklistItem);
router.post("/:taskId/time-entries", addTimeEntry);

// Task Discussion Routes
router.get("/:taskId/comments", getComments);
router.post("/:taskId/comments", createComment);
router.delete("/comments/:commentId", deleteComment);

export default router;
