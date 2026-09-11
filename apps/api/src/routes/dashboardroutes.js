import express from "express";
import { getDashboard, getProfitAndLoss, getCashFlow, exportReportPdf } from "../controllers/dashboard.js";
import auth from "../middleware/auth.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import requireFeature from "../middleware/requireFeature.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

router.get(
    "/profit-and-loss",
    auth,
    requireActiveSubscription,
    requireFeature("reports.view"),
    requirePermission("reports.view"),
    getProfitAndLoss
);
router.get(
    "/cash-flow",
    auth,
    requireActiveSubscription,
    requireFeature("reports.view"),
    requirePermission("reports.view"),
    getCashFlow
);
router.post(
    "/reports/export.pdf",
    auth,
    requireActiveSubscription,
    requireFeature("reports.export"),
    requirePermission("reports.export"),
    exportReportPdf
);
router.get(
    "/",
    auth,
    requireActiveSubscription,
    requireFeature("dashboard.view"),
    requirePermission("dashboard.view"),
    getDashboard
);

export default router;
