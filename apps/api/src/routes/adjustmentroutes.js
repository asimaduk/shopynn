import express from "express";
import { createAdjustment, getAdjustmentsSummary, getAllAdjustmentDetails, getAllAdjustments } from "../controllers/adjustment.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.post("/", requirePermission("adjustments.create"), createAdjustment);
router.get("/summary", requirePermission("adjustments.view"), getAdjustmentsSummary);
router.get("/", requirePermission("adjustments.view"), getAllAdjustments);
router.get("/details-list", requireAnyPermission("adjustments.details.view", "adjustments.view"), getAllAdjustmentDetails);

export default router;