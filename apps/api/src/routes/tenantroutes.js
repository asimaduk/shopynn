import express from "express";
import auth from "../middleware/auth.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import requireFeature from "../middleware/requireFeature.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
    createTenant,
    getTenantById,
    getTenants,
    setupTenant,
    updateTenant,
    updateMyCompanyInfo,
    listTenantsDirectory,
    getTenantDirectoryDetail,
    assignTenantServingMerchant,
} from "../controllers/tenant.js";
import {
    createAdminTenantSettlement,
    getAdminTenantSettlementSummary,
    getAdminTenantSettlements,
    getMyPayoutProfile,
    getPayoutBankOptions,
    getMySettlementSummary,
    getMySettlements,
    listAdminWithdrawalRequests,
    approveAdminSettlement,
    rejectAdminSettlement,
    markAdminSettlementPaid,
    requestMyWithdrawal,
    retryMyWithdrawal,
    updateMyPayoutProfile,
} from "../controllers/settlement.js";

const router = express.Router();

router.post("/setup", setupTenant);
router.post("/", createTenant);
router.get("/", getTenants);
router.put("/update-my-company-info", auth, requireActiveSubscription, updateMyCompanyInfo);
router.get(
    "/me/settlements/summary",
    auth,
    requireActiveSubscription,
    requireFeature("payments.view"),
    requirePermission("payments.view"),
    getMySettlementSummary
);
router.get(
    "/me/settlements",
    auth,
    requireActiveSubscription,
    requireFeature("payments.view"),
    requirePermission("payments.view"),
    getMySettlements
);
router.get(
    "/payout-banks",
    auth,
    requireActiveSubscription,
    requireFeature("payments.view"),
    requirePermission("payments.view"),
    getPayoutBankOptions
);
router.get(
    "/me/payout-profile",
    auth,
    requireActiveSubscription,
    requireFeature("payments.view"),
    requirePermission("payments.view"),
    getMyPayoutProfile
);
router.put(
    "/me/payout-profile",
    auth,
    requireActiveSubscription,
    requireFeature("payments.view"),
    requirePermission("payments.view"),
    updateMyPayoutProfile
);
router.post(
    "/me/withdrawals",
    auth,
    requireActiveSubscription,
    requireFeature("payments.view"),
    requirePermission("payments.view"),
    requestMyWithdrawal
);
router.post(
    "/me/withdrawals/:id/retry",
    auth,
    requireActiveSubscription,
    requireFeature("payments.view"),
    requirePermission("payments.view"),
    retryMyWithdrawal
);
router.get(
    "/admin/list",
    auth,
    requireActiveSubscription,
    requireFeature("tenants.directory.view"),
    requirePermission("tenants.directory.view"),
    listTenantsDirectory
);
router.get(
    "/admin/withdrawals",
    auth,
    requireActiveSubscription,
    requireFeature("tenants.directory.view"),
    requirePermission("tenants.directory.view"),
    listAdminWithdrawalRequests
);
router.get(
    "/admin/:id",
    auth,
    requireActiveSubscription,
    requireFeature("tenants.directory.view"),
    requirePermission("tenants.directory.view"),
    getTenantDirectoryDetail
);
router.put(
    "/admin/:id/serving-merchant",
    auth,
    requireActiveSubscription,
    requireFeature("tenants.directory.view"),
    requirePermission("tenants.directory.view"),
    assignTenantServingMerchant
);
router.get(
    "/admin/:tenantId/settlements/summary",
    auth,
    requireActiveSubscription,
    requireFeature("tenants.directory.view"),
    requirePermission("tenants.directory.view"),
    getAdminTenantSettlementSummary
);
router.get(
    "/admin/:tenantId/settlements",
    auth,
    requireActiveSubscription,
    requireFeature("tenants.directory.view"),
    requirePermission("tenants.directory.view"),
    getAdminTenantSettlements
);
router.post(
    "/admin/:tenantId/settlements",
    auth,
    requireActiveSubscription,
    requireFeature("tenants.directory.view"),
    requirePermission("tenants.directory.view"),
    createAdminTenantSettlement
);
router.patch(
    "/admin/settlements/:id/approve",
    auth,
    requireActiveSubscription,
    requireFeature("tenants.directory.view"),
    requirePermission("tenants.directory.view"),
    approveAdminSettlement
);
router.patch(
    "/admin/settlements/:id/reject",
    auth,
    requireActiveSubscription,
    requireFeature("tenants.directory.view"),
    requirePermission("tenants.directory.view"),
    rejectAdminSettlement
);
router.patch(
    "/admin/settlements/:id/mark-paid",
    auth,
    requireActiveSubscription,
    requireFeature("tenants.directory.view"),
    requirePermission("tenants.directory.view"),
    markAdminSettlementPaid
);
router.put("/:id", updateTenant);
router.get("/:id", getTenantById);

export default router;
