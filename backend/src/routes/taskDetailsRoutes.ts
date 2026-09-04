import { Router } from "express";
import { 
    addLabelToTask, 
    removeLabelFromTask,
    getTaskChecklists,
    createChecklist, 
    deleteChecklist,
    addChecklistItem, 
    updateChecklistItem, 
    deleteChecklistItem,
    getTimeEntries,
    addTimeEntry,
    deleteTimeEntry,
    getTaskAttachments,
    uploadTaskAttachment,
    deleteTaskAttachment,
    getTaskActivity,
} from "../controllers/taskDetailsController";

import {
    getComments,
    createComment,
    deleteComment
} from "../controllers/taskDiscussionController";

import { requireTaskAccess } from "../middleware/rbac";
import { upload } from "../middleware/upload";

const router = Router({ mergeParams: true });

// Labels
router.post("/:taskId/labels", requireTaskAccess, addLabelToTask);
router.delete("/:taskId/labels/:labelId", requireTaskAccess, removeLabelFromTask);

// Checklists
router.get("/:taskId/checklists", requireTaskAccess, getTaskChecklists);
router.post("/:taskId/checklists", requireTaskAccess, createChecklist);
router.delete("/checklists/:checklistId", deleteChecklist);
router.post("/checklists/:checklistId/items", addChecklistItem);
router.patch("/checklists/items/:itemId", updateChecklistItem);
router.delete("/checklists/items/:itemId", deleteChecklistItem);

// Time Tracking
router.get("/:taskId/time-entries", requireTaskAccess, getTimeEntries);
router.post("/:taskId/time-entries", requireTaskAccess, addTimeEntry);
router.delete("/time-entries/:entryId", deleteTimeEntry);

// Attachments
router.get("/:taskId/attachments", requireTaskAccess, getTaskAttachments);
router.post("/:taskId/attachments", requireTaskAccess, upload.single("file"), uploadTaskAttachment);
router.delete("/:taskId/attachments/:attachmentId", requireTaskAccess, deleteTaskAttachment);

// Activity Trail
router.get("/:taskId/activity", requireTaskAccess, getTaskActivity);

// Comments
router.get("/:taskId/comments", requireTaskAccess, getComments);
router.post("/:taskId/comments", requireTaskAccess, createComment);
router.delete("/comments/:commentId", deleteComment);

export default router;
