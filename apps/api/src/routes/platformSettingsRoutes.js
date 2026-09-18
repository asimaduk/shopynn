import express from "express";
import auth from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
    getMomoPaymentCharge,
    updateMomoPaymentCharge,
} from "../controllers/platformSettings.js";

const router = express.Router();

router.get("/momo-payment-charge", auth, getMomoPaymentCharge);
router.put(
    "/momo-payment-charge",
    auth,
    requirePermission("tenants.directory.view"),
    updateMomoPaymentCharge
);

export default router;
