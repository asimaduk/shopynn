import express from "express";
import {
    getPaymentsHistory,
    getPosSalePayments,
    getPaymentsByTenantId,
    getPaymentsByCustomerId,
    getPaymentById,
    createPayment,
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
router.post("/initiate", initiatePayment); //requirePermission("payments.initiate")
router.post("/submit-otp", requirePermission("payments.initiate"), submitOtp);
router.get("/pos-open", getOpenPosMomoPayment);
router.post("/pos-abandon", abandonPosMomoPayment);
router.post("/pos-park", parkPosMomoPayment);
router.get("/pos-pending", listPendingPosMomoPayments);
router.get("/verify", verifyPayment); //requirePermission("payments.verify"),
router.get("/verify/:reference", verifyPayment); //requirePermission("payments.verify"),
router.get("/tenant/:tenantId", ...requireOrderPaymentHistory, getPaymentsByTenantId);
router.get("/customer/:customerId", ...requireOrderPaymentHistory, getPaymentsByCustomerId);
router.get("/:id/receipt", requireActiveSubscription, requireAnyPermission("payments.view", "sales.view"), getPaymentReceipt);
router.get("/:id/events", requireActiveSubscription, requireAnyPermission("payments.view", "sales.view"), getPaymentEvents);
router.post("/:id/reverse", requirePermission("payments.initiate"), reverseCashPayment);
router.get("/:id", requireActiveSubscription, requireAnyPermission("payments.view", "sales.view"), getPaymentById);
router.post("/", requirePermission("payments.initiate"), createPayment);

export default router;
