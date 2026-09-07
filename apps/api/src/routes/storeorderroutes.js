import express from "express";
import {
    getStoreOrderDelivery,
    getStoreOrderById,
    getStoreOrderHistory,
    getStoreOrders,
    markStoreOrderPaid,
    recordStoreOrderPartialCash,
    upsertStoreOrderDelivery,
    updateStoreOrderStatus,
} from "../controllers/storeOrder.js";
import requireFeature from "../middleware/requireFeature.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.get(
    "/",
    requireFeature("orders.store.view"),
    requirePermission("orders.store.view"),
    getStoreOrders
);
router.get(
    "/:id",
    requireFeature("orders.store.view"),
    requirePermission("orders.store.view"),
    getStoreOrderById
);
router.patch(
    "/:id/status",
    requireFeature("orders.status.update"),
    requirePermission("orders.status.update"),
    updateStoreOrderStatus
);
router.get(
    "/:id/history",
    requireFeature("orders.store.view"),
    requirePermission("orders.store.view"),
    getStoreOrderHistory
);
router.get(
    "/:id/delivery",
    requireFeature("orders.delivery.view"),
    requirePermission("orders.delivery.view"),
    getStoreOrderDelivery
);
router.patch(
    "/:id/delivery",
    requireFeature("orders.delivery.manage"),
    requirePermission("orders.delivery.manage"),
    upsertStoreOrderDelivery
);
router.post(
    "/:id/payments/mark-paid",
    requireFeature("orders.status.update"),
    requirePermission("orders.status.update"),
    markStoreOrderPaid
);
router.post(
    "/:id/payments/partial/record",
    requireFeature("orders.status.update"),
    requirePermission("orders.status.update"),
    recordStoreOrderPartialCash
);

export default router;
