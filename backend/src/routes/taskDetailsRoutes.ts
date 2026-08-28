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

import { requireTaskAccess } from "../middleware/rbac";

const router = Router({ mergeParams: true });

router.post("/:taskId/labels", requireTaskAccess, addLabelToTask);
router.post("/:taskId/checklists", requireTaskAccess, createChecklist);
router.post("/checklists/:checklistId/items", addChecklistItem);
router.patch("/checklists/items/:itemId", updateChecklistItem);
router.post("/:taskId/time-entries", requireTaskAccess, addTimeEntry);

// Task Discussion Routes
router.get("/:taskId/comments", requireTaskAccess, getComments);
router.post("/:taskId/comments", requireTaskAccess, createComment);
router.delete("/comments/:commentId", deleteComment);

export default router;
