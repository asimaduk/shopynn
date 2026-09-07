import express from "express";
import {
    getStockCountsHistory,
    getStockCountById,
    createStockCount,
} from "../controllers/stockcount.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.get("/", requirePermission("stock_counts.view"), getStockCountsHistory);
router.get("/:id", requireAnyPermission("stock_counts.details.view", "stock_counts.view"), getStockCountById);
router.post("/", requirePermission("stock_counts.create"), createStockCount);

export default router;
