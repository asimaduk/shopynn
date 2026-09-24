import express from "express";
import {
    createTransfer,
    getAllTransferDetails,
    getAllTransfers,
    getTransfersSummary,
    getTransferById,
    receiveTransfer,
} from "../controllers/transfer.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";
import requireFeature from "../middleware/requireFeature.js";

const router = express.Router();

router.post("/", requireFeature("transfers.create"), requirePermission("transfers.create"), createTransfer);
router.post(
    "/:id/receive",
    requireFeature("transfers.create"),
    requireAnyPermission("transfers.receive", "transfers.create"),
    receiveTransfer
);
router.get("/summary", requirePermission("transfers.view"), getTransfersSummary);
router.get("/", requirePermission("transfers.view"), getAllTransfers);
router.get("/details-list", requireAnyPermission("transfers.details.view", "transfers.view"), getAllTransferDetails);
router.get("/:id", requireAnyPermission("transfers.details.view", "transfers.view"), getTransferById);

export default router;
