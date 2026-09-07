import express from "express";
import { createPurchase, getAllPurchaseDetails, getAllPurchases, getPurchasesSummary, getSuppliersSummary, getPurchaseById } from "../controllers/purchase.js";
import auth from "../middleware/auth.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.post("/", auth, requirePermission("purchases.create"), createPurchase);
router.get("/", auth, requirePermission("purchases.view"), getAllPurchases);
router.get("/summary", auth, requirePermission("purchases.view"), getPurchasesSummary);
router.get("/suppliers-summary", auth, requirePermission("purchases.view"), getSuppliersSummary);
router.get("/:id", auth, requireAnyPermission("purchases.details.view", "purchases.view"), getPurchaseById);
router.get("/details-list", auth, requireAnyPermission("purchases.details.view", "purchases.view"), getAllPurchaseDetails);

export default router;