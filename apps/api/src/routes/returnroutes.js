import express from "express";
import {
    getReturnsHistory,
    getReturnById,
    createReturn,
    getSaleReturnable,
    getOrderReturnable,
} from "../controllers/return.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.get("/", requirePermission("returns.view"), getReturnsHistory);
router.get("/sale/:saleId/returnable", requirePermission("returns.create"), getSaleReturnable);
router.get("/order/:orderId/returnable", requirePermission("returns.create"), getOrderReturnable);
router.get("/:id", requireAnyPermission("returns.details.view", "returns.view"), getReturnById);
router.post("/", requirePermission("returns.create"), createReturn);

export default router;
