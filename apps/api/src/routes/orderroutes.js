import express from "express";
import {
    cancelOrder,
    createOrder,
    getOrderById,
    getOrderStatusHistory,
    getMyOrders,
    getOrders,
    initiateOrderPayment,
    initiatePartialOrderPayment,
    submitOrderPaymentOtp,
    updateOrder,
    updateOrderStatus,
} from "../controllers/order.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";
import requireFeature from "../middleware/requireFeature.js";

const router = express.Router();

router.post("/", requireFeature("orders.create"), requirePermission("orders.create"), createOrder);
router.get(
    "/",
    requireFeature("orders.view"),
    requireAnyPermission("orders.view", "orders.details.view"),
    getOrders
);
router.get(
    "/my",
    requireFeature("orders.view"),
    requireAnyPermission("orders.view", "orders.details.view"),
    getMyOrders
);
router.post(
    "/:id/payments/initiate",
    requireFeature("orders.details.view"),
    requireAnyPermission("orders.details.view", "orders.view"),
    initiateOrderPayment
);
router.post(
    "/:id/payments/partial/initiate",
    requireFeature("orders.details.view"),
    requireAnyPermission("orders.details.view", "orders.view"),
    initiatePartialOrderPayment
);
router.post(
    "/:id/payments/submit-otp",
    requireFeature("orders.details.view"),
    requireAnyPermission("orders.details.view", "orders.view"),
    submitOrderPaymentOtp
);
router.get(
    "/:id",
    requireFeature("orders.details.view"),
    requireAnyPermission("orders.details.view", "orders.view"),
    getOrderById
);
router.get(
    "/:id/history",
    requireFeature("orders.details.view"),
    requireAnyPermission("orders.details.view", "orders.view"),
    getOrderStatusHistory
);
router.patch("/:id", requireFeature("orders.update"), requirePermission("orders.update"), updateOrder);
router.patch(
    "/:id/status",
    requireFeature("orders.status.update"),
    requirePermission("orders.status.update"),
    updateOrderStatus
);
router.post("/:id/cancel", requireFeature("orders.cancel"), requirePermission("orders.cancel"), cancelOrder);

export default router;
