import { Router } from "express";
import { globalSearch, searchUsers } from "../controllers/searchController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

// GET /api/search - Global multi-entity search with filters and date range
router.get("/", globalSearch);

// GET /api/search/users - Search users for filtering and autocomplete
router.get("/users", searchUsers);

export default router;
