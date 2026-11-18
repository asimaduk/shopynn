import express from "express";
import auth from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
    getMomoPaymentCharge,
    getSignupNotificationEmails,
    updateMomoPaymentCharge,
    updateSignupNotificationEmails,
} from "../controllers/platformSettings.js";

const router = express.Router();

router.get("/momo-payment-charge", auth, getMomoPaymentCharge);
router.put(
    "/momo-payment-charge",
    auth,
    requirePermission("tenants.directory.view"),
    updateMomoPaymentCharge
);

router.get(
    "/signup-notification-emails",
    auth,
    requirePermission("tenants.directory.view"),
    getSignupNotificationEmails
);
router.put(
    "/signup-notification-emails",
    auth,
    requirePermission("tenants.directory.view"),
    updateSignupNotificationEmails
);

export default router;
