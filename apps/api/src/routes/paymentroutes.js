import express from "express";
import {
    getPaymentsHistory,
    getPosSalePayments,
    getPaymentsByTenantId,
    getPaymentsByCustomerId,
    getPaymentById,
    initiatePayment,
    submitOtp,
    verifyPayment,
    getPaymentReceipt,
    getPaymentEvents,
    reverseCashPayment,
    getOpenPosMomoPayment,
    abandonPosMomoPayment,
    parkPosMomoPayment,
    listPendingPosMomoPayments,
} from "../controllers/payment.js";
import { requirePermission, requireAnyPermission } from "../middleware/requirePermission.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import requireFeature from "../middleware/requireFeature.js";

const router = express.Router();
const requireOrderPaymentHistory = [
    requireActiveSubscription,
    requireFeature("payments.view"),
    requirePermission("payments.view"),
];
const requirePosSalePaymentHistory = [
    requireActiveSubscription,
    requireAnyPermission("sales.view", "payments.view"),
];

router.get("/", ...requireOrderPaymentHistory, getPaymentsHistory);
router.get("/pos-sale", ...requirePosSalePaymentHistory, getPosSalePayments);
// Plan payments must work on an expired plan, so only POS MoMo routes need an active subscription.
const canStartPayment = requireAnyPermission("sales.create", "payments.initiate", "subscription.manage", "orders.create");
const posMomo = [requireActiveSubscription, requireAnyPermission("sales.create", "payments.initiate")];

router.post("/initiate", canStartPayment, initiatePayment);
router.post("/submit-otp", canStartPayment, submitOtp);
router.get("/pos-open", ...posMomo, getOpenPosMomoPayment);
router.post("/pos-abandon", ...posMomo, abandonPosMomoPayment);
router.post("/pos-park", ...posMomo, parkPosMomoPayment);
router.get("/pos-pending", ...posMomo, listPendingPosMomoPayments);
router.get("/verify", canStartPayment, verifyPayment);
router.get("/verify/:reference", canStartPayment, verifyPayment);
router.get("/tenant/:tenantId", ...requireOrderPaymentHistory, getPaymentsByTenantId);
router.get("/customer/:customerId", ...requireOrderPaymentHistory, getPaymentsByCustomerId);
router.get("/:id/receipt", requireActiveSubscription, requireAnyPermission("payments.view", "sales.view"), getPaymentReceipt);
router.get("/:id/events", requireActiveSubscription, requireAnyPermission("payments.view", "sales.view"), getPaymentEvents);
router.post("/:id/reverse", requireActiveSubscription, requirePermission("payments.initiate"), reverseCashPayment);
router.get("/:id", requireActiveSubscription, requireAnyPermission("payments.view", "sales.view"), getPaymentById);

export default router;
