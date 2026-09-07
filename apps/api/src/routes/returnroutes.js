import express from "express";
import {
    getReturnsHistory,
    getReturnById,
    createReturn,
} from "../controllers/return.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.get("/", requirePermission("returns.view"), getReturnsHistory);
router.get("/:id", requireAnyPermission("returns.details.view", "returns.view"), getReturnById);
router.post("/", requirePermission("returns.create"), createReturn);

export default router;
