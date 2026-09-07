import express from "express";
import { createTransfer, getAllTransferDetails, getAllTransfers, getTransfersSummary, getTransferById } from "../controllers/transfer.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.post("/", requirePermission("transfers.create"), createTransfer);
router.get("/summary", requirePermission("transfers.view"), getTransfersSummary);
router.get("/", requirePermission("transfers.view"), getAllTransfers);
router.get("/details-list", requireAnyPermission("transfers.details.view", "transfers.view"), getAllTransferDetails);
router.get("/:id", requireAnyPermission("transfers.details.view", "transfers.view"), getTransferById);

export default router;