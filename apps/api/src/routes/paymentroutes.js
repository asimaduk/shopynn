import express from "express";
import {
    getPaymentsHistory,
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
} from "../controllers/payment.js";
import { requirePermission } from "../middleware/requirePermission.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import requireFeature from "../middleware/requireFeature.js";

const router = express.Router();
const requireOrderPaymentHistory = [
    requireActiveSubscription,
    requireFeature("payments.view"),
    requirePermission("payments.view"),
];

router.get("/", ...requireOrderPaymentHistory, getPaymentsHistory);
router.post("/initiate", initiatePayment); //requirePermission("payments.initiate")
router.post("/submit-otp", requirePermission("payments.initiate"), submitOtp);
router.get("/verify", verifyPayment); //requirePermission("payments.verify"),
router.get("/verify/:reference", verifyPayment); //requirePermission("payments.verify"),
router.get("/tenant/:tenantId", ...requireOrderPaymentHistory, getPaymentsByTenantId);
router.get("/customer/:customerId", ...requireOrderPaymentHistory, getPaymentsByCustomerId);
router.get("/:id/receipt", ...requireOrderPaymentHistory, getPaymentReceipt);
router.get("/:id/events", ...requireOrderPaymentHistory, getPaymentEvents);
router.post("/:id/reverse", requirePermission("payments.initiate"), reverseCashPayment);
router.get("/:id", ...requireOrderPaymentHistory, getPaymentById);
router.post("/", requirePermission("payments.initiate"), createPayment);

export default router;
