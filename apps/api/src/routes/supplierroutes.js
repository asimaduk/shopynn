import express from "express";
import { createSupplier, getAllSuppliers, getSupplierById, getSupplierPurchases, updateSupplier } from "../controllers/supplier.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";
const router = express.Router();

router.post("/", requirePermission("suppliers.create"), createSupplier);
router.get("/", requirePermission("suppliers.view"), getAllSuppliers);
router.get("/:id/purchases", requireAnyPermission("suppliers.purchases.view", "suppliers.view"), getSupplierPurchases);
router.put("/:id", requirePermission("suppliers.update"), updateSupplier);
router.get("/:id", requireAnyPermission("suppliers.details.view", "suppliers.view"), getSupplierById);

export default router;