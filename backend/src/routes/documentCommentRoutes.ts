import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
    getDocumentComments,
    createDocumentComment,
    replyToDocumentComment,
    toggleResolveDocumentComment,
    deleteDocumentComment,
} from "../controllers/documentCommentController";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/:documentId/comments", getDocumentComments);
router.post("/:documentId/comments", createDocumentComment);
router.post("/:documentId/comments/:commentId/replies", replyToDocumentComment);
router.patch("/:documentId/comments/:commentId/resolve", toggleResolveDocumentComment);
router.delete("/:documentId/comments/:commentId", deleteDocumentComment);

export default router;
