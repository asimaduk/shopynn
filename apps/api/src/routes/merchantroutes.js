import express from "express";
import auth from "../middleware/auth.js";
import requireMerchant, { requireMerchantRecord, requireAgentManager } from "../middleware/requireMerchant.js";
import requireActiveSubscription from "../middleware/requireActiveSubscription.js";
import requireFeature from "../middleware/requireFeature.js";
import { requirePermission, requireAnyPermission } from "../middleware/requirePermission.js";
import {
    getMerchantMe,
    promoteMerchant,
    onboardBusiness,
    getOnboardedTenants,
    getMerchantCommissions,
    markCommissionPaid,
    listAdminMerchants,
    listEligibleMerchantUsers,
    getAdminMerchantDetail,
    deactivateMerchant,
    reactivateMerchant,
    updateMerchantAdmin,
    approveRecruitedAgent,
    rejectRecruitedAgent,
    getMyTeam,
    getMyTeamTenants,
    recruitTeamAgent,
    reassignTeamTenant,
    deactivateTeamAgent,
    getTenantQuote,
    createTenantPayLaterQuote,
    initiateTenantPayment,
    submitTenantPaymentOtp,
} from "../controllers/merchant.js";

const router = express.Router();

const platformAdmin = [
    auth,
    requireActiveSubscription,
    requireFeature("merchants.view"),
    requirePermission("merchants.view"),
];

const agentManager = [
    auth,
    requireActiveSubscription,
    requireFeature("merchants.operate"),
    requirePermission("merchants.manage_team"),
    requireAgentManager,
];

router.patch("/admin/:id", ...platformAdmin, updateMerchantAdmin);
router.post("/admin/:id/deactivate", ...platformAdmin, deactivateMerchant);
router.post("/admin/:id/reactivate", ...platformAdmin, reactivateMerchant);
router.post("/admin/:id/approve", ...platformAdmin, approveRecruitedAgent);
router.post("/admin/:id/reject", ...platformAdmin, rejectRecruitedAgent);

router.get("/team", ...agentManager, getMyTeam);
router.get("/team/tenants", ...agentManager, getMyTeamTenants);
router.post("/team/recruit", ...agentManager, recruitTeamAgent);
router.put("/team/tenants/:tenantId/serving", ...agentManager, reassignTeamTenant);
router.post("/team/:merchantId/deactivate", ...agentManager, deactivateTeamAgent);

router.get("/me", auth, getMerchantMe);
router.get(
    "/admin/list",
    auth,
    requireActiveSubscription,
    requireFeature("merchants.view"),
    requirePermission("merchants.view"),
    listAdminMerchants
);
router.get(
    "/admin/eligible-users",
    auth,
    requireActiveSubscription,
    requireFeature("merchants.view"),
    requirePermission("merchants.view"),
    listEligibleMerchantUsers
);
router.get(
    "/admin/:id",
    auth,
    requireActiveSubscription,
    requireFeature("merchants.view"),
    requirePermission("merchants.view"),
    getAdminMerchantDetail
);
router.delete(
    "/admin/:id",
    auth,
    requireActiveSubscription,
    requireFeature("merchants.view"),
    requirePermission("merchants.view"),
    deactivateMerchant
);
router.post(
    "/promote",
    auth,
    requireActiveSubscription,
    requireFeature("merchants.view"),
    requirePermission("merchants.view"),
    promoteMerchant
);
router.post(
    "/onboard",
    auth,
    requireActiveSubscription,
    requireFeature("merchants.operate"),
    requireAnyPermission("merchants.operate", "merchants.view"),
    requireMerchant,
    onboardBusiness
);
router.get(
    "/onboarded-tenants",
    auth,
    requireActiveSubscription,
    requireFeature("merchants.operate"),
    requireAnyPermission("merchants.operate", "merchants.view"),
    requireMerchant,
    getOnboardedTenants
);
router.get(
    "/tenants/:tenantId/quote",
    auth,
    requireActiveSubscription,
    requireFeature("merchants.operate"),
    requireAnyPermission("merchants.operate", "merchants.view"),
    requireMerchant,
    getTenantQuote
);
router.post(
    "/tenants/:tenantId/quotes",
    auth,
    requireActiveSubscription,
    requireFeature("merchants.operate"),
    requirePermission("merchants.operate"),
    requireMerchant,
    createTenantPayLaterQuote
);
router.post(
    "/tenants/:tenantId/payments/initiate",
    auth,
    requireActiveSubscription,
    requireFeature("merchants.operate"),
    requirePermission("merchants.operate"),
    requireMerchant,
    initiateTenantPayment
);
router.post(
    "/tenants/:tenantId/payments/submit-otp",
    auth,
    requireActiveSubscription,
    requireFeature("merchants.operate"),
    requirePermission("merchants.operate"),
    requireMerchant,
    submitTenantPaymentOtp
);
router.get(
    "/commissions",
    auth,
    requireActiveSubscription,
    requireFeature("merchants.operate"),
    requireAnyPermission("merchants.operate", "merchants.view"),
    requireMerchantRecord,
    getMerchantCommissions
);
router.patch(
    "/commissions/:id/mark-paid",
    auth,
    requireActiveSubscription,
    requireFeature("merchants.view"),
    requirePermission("merchants.view"),
    markCommissionPaid
);

export default router;
