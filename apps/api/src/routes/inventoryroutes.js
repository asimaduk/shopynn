import express from "express";
import auth from "../middleware/auth.js";
import { createBulkUpdates, getAllInventories, getExpiringInventories, getInventoryCount, getLowStockInventories, getSlowMovingInventories, getStockSummary, getTopSellingInventories } from "../controllers/inventory.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.get("/", auth, requirePermission("inventory.view"), getAllInventories);
router.get("/count", auth, requirePermission("inventory.view"), getInventoryCount);
router.get("/low-stock", auth, requireAnyPermission("inventory.low_stock.view", "inventory.view"), getLowStockInventories);
router.get("/slow-moving", auth, requirePermission("inventory.view"), getSlowMovingInventories);
router.get("/expiring", auth, requireAnyPermission("inventory.expiring.view", "inventory.view"), getExpiringInventories);
router.get("/top-selling", auth, requirePermission("inventory.view"), getTopSellingInventories);
router.get("/summary", auth, requirePermission("inventory.view"), getStockSummary);
router.post("/updates", auth, requireAnyPermission("products.update", "adjustments.create", "stock_counts.create"), createBulkUpdates);

export default router;