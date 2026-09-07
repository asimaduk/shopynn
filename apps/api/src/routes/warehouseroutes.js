import express from "express";
import { createWarehouse, getAllWarehouses, getWarehouseById, updateWarehouse } from "../controllers/warehouse.js";
import { requirePermission } from "../middleware/requirePermission.js";
const router = express.Router();

router.post("/", requirePermission("warehouses.create"), createWarehouse);
router.get("/", requirePermission("warehouses.view"), getAllWarehouses);
router.get("/:id", requirePermission("warehouses.view"), getWarehouseById);
router.put("/:id", requirePermission("warehouses.update"), updateWarehouse);

export default router;