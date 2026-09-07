import { handleResponse } from "../util/handleresponse.js";
import {
    getMerchantByUserId,
    createMerchantRecordService,
    createFieldAgentUserAndMerchantService,
    onboardBusinessForMerchantService,
    getOnboardedTenantsForMerchantService,
    getCommissionsForMerchantService,
    markCommissionPaidService,
    listMerchantsForAdminService,
    revokeMerchantRecordService,
    getMerchantDetailForAdminService,
    listEligibleUsersForMerchantPromoteService,
    createPayLaterQuoteForTenantService,
    createUpgradeCollectQuoteForMerchantService,
    getPendingQuoteForTenantService,
} from "../models/merchant.js";
import { QUOTE_KIND } from "../constants/billingCatalog.js";
import {
    initiateMerchantTenantPaymentService,
    submitMerchantTenantOtpService,
} from "../models/merchantPayment.js";
import {
    updatePaymentStatusByTransactionRefService,
    applyPaymentGatewaySuccess,
} from "../models/payment.js";

export const getMerchantMe = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return handleResponse(res, 401, "Authentication required.", { merchant: null });
        }
        const merchant = await getMerchantByUserId(req.user.id);
        handleResponse(res, 200, "OK.", { merchant });
    } catch (error) {
        next(error);
    }
};

export const promoteMerchant = async (req, res, next) => {
    try {
        const tenantId = req.user?.tenant_id;
        const actorId = req.user?.id;

        if (req.body?.create_user && typeof req.body.create_user === "object") {
            if (!tenantId || !actorId) {
                return handleResponse(res, 400, "Tenant context required.", null);
            }
            const { first_name, last_name, email, phone } = req.body.create_user;
            const { default_commission_percent } = req.body;
            if (!String(first_name || "").trim() || !String(last_name || "").trim()) {
                return handleResponse(res, 400, "create_user requires first_name and last_name.", null);
            }
            if (!String(email || "").trim()) {
                return handleResponse(res, 400, "create_user requires email.", null);
            }
            if (!String(phone || "").trim()) {
                return handleResponse(res, 400, "create_user requires phone.", null);
            }
            const result = await createFieldAgentUserAndMerchantService({
                tenant_id: tenantId,
                actor_user_id: actorId,
                first_name: String(first_name).trim(),
                last_name: String(last_name).trim(),
                email: String(email).trim(),
                phone: String(phone).trim(),
                default_commission_percent,
            });
            if (result?.error) {
                return handleResponse(res, 400, result.error, null);
            }
            handleResponse(
                res,
                201,
                "Field agent created. A temporary password was emailed to the new user.",
                result
            );
            return;
        }

        const { user_id, default_commission_percent } = req.body;
        const result = await createMerchantRecordService({ user_id, default_commission_percent });
        handleResponse(res, 201, "Merchant record created.", result);
    } catch (error) {
        if (
            error.message?.includes("required") ||
            error.message?.includes("not found") ||
            error.message?.includes("already registered")
        ) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const onboardBusiness = async (req, res, next) => {
    try {
        const result = await onboardBusinessForMerchantService(req.merchant, req.body);
        handleResponse(res, 201, "Business onboarded.", result);
    } catch (error) {
        if (
            error.message?.includes("required") ||
            error.message?.includes("already exists") ||
            error.message?.includes("subscription_type") ||
            error.message?.includes("User creation") ||
            error.message?.includes("Tenant") ||
            error.message?.includes("add-on")
        ) {
            return handleResponse(res, 400, error.message, null);
        }
        if (error.code === "23505") {
            return handleResponse(res, 400, "Invalid input or duplicate phone or email.", null);
        }
        next(error);
    }
};

export const getOnboardedTenants = async (req, res, next) => {
    try {
        const rows = await getOnboardedTenantsForMerchantService(req.merchant.id);
        handleResponse(res, 200, "Onboarded businesses.", { tenants: rows });
    } catch (error) {
        next(error);
    }
};

export const getMerchantCommissions = async (req, res, next) => {
    try {
        const rows = await getCommissionsForMerchantService(req.merchant.id, req.query);
        handleResponse(res, 200, "Commissions.", { commissions: rows });
    } catch (error) {
        next(error);
    }
};

export const markCommissionPaid = async (req, res, next) => {
    try {
        const updated = await markCommissionPaidService(req.params.id);
        if (!updated) {
            return handleResponse(res, 404, "Commission not found or not pending.", null);
        }
        handleResponse(res, 200, "Commission marked paid.", updated);
    } catch (error) {
        next(error);
    }
};

export const listAdminMerchants = async (req, res, next) => {
    try {
        const merchants = await listMerchantsForAdminService();
        handleResponse(res, 200, "Merchants.", { merchants });
    } catch (error) {
        next(error);
    }
};

export const listEligibleMerchantUsers = async (req, res, next) => {
    try {
        const users = await listEligibleUsersForMerchantPromoteService(req.user?.tenant_id);
        handleResponse(res, 200, "Eligible users.", { users });
    } catch (error) {
        next(error);
    }
};

export const getAdminMerchantDetail = async (req, res, next) => {
    try {
        const detail = await getMerchantDetailForAdminService(req.params.id);
        if (!detail) {
            return handleResponse(res, 404, "Merchant not found.", null);
        }
        handleResponse(res, 200, "Merchant detail.", detail);
    } catch (error) {
        next(error);
    }
};

export const getTenantQuote = async (req, res, next) => {
    try {
        const quote = await getPendingQuoteForTenantService(req.params.tenantId);
        handleResponse(res, 200, "Quote.", { quote });
    } catch (error) {
        next(error);
    }
};

export const createTenantPayLaterQuote = async (req, res, next) => {
    try {
        const { addon_codes, owner_email, subscription_type, quote_kind } = req.body;
        const isUpgradeCollect =
            quote_kind === QUOTE_KIND.UPGRADE_COLLECT || quote_kind === "upgrade_collect";

        let quote;
        if (isUpgradeCollect) {
            if (subscription_type == null) {
                return handleResponse(res, 400, "subscription_type is required for upgrade & collect.", null);
            }
            quote = await createUpgradeCollectQuoteForMerchantService(req.merchant, req.params.tenantId, {
                subscription_type,
                addon_codes,
                owner_email,
            });
        } else {
            quote = await createPayLaterQuoteForTenantService(
                req.merchant,
                req.params.tenantId,
                addon_codes,
                owner_email
            );
        }
        handleResponse(res, 201, "Quote created.", { quote });
    } catch (error) {
        if (
            error.message?.includes("access") ||
            error.message?.includes("pending") ||
            error.message?.includes("add-on") ||
            error.message?.includes("upgrade") ||
            error.message?.includes("Onboarding") ||
            error.message?.includes("paid plan") ||
            error.message?.includes("owner_email") ||
            error.message?.includes("Choose Basic")
        ) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const initiateTenantPayment = async (req, res, next) => {
    try {
        const result = await initiateMerchantTenantPaymentService({
            merchantRow: req.merchant,
            tenantId: req.params.tenantId,
            creator_id: req.user?.id,
            payment_method: req.body.payment_method,
            email: req.body.email,
            phone: req.body.phone,
            provider: req.body.provider,
            callback_url: req.body.callback_url,
            quote_id: req.body.quote_id,
        });
        if (result.payment_method_type === "mobile_money") {
            handleResponse(res, 200, "Mobile money charge initiated.", {
                transaction_ref: result.transaction_ref,
                payment_id: result.payment_id,
                owner_email: result.owner_email,
                quote: result.quote,
                status: result.status,
                display_text: result.display_text,
                ussd_code: result.ussd_code,
            });
        } else {
            handleResponse(res, 200, "Checkout session created.", {
                redirect_url: result.redirect_url,
                transaction_ref: result.transaction_ref,
                payment_id: result.payment_id,
                owner_email: result.owner_email,
                quote: result.quote,
            });
        }
    } catch (error) {
        if (
            error.message?.includes("access") ||
            error.message?.includes("quote") ||
            error.message?.includes("charge") ||
            error.message?.includes("mobile money")
        ) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const submitTenantPaymentOtp = async (req, res, next) => {
    try {
        const { reference, otp } = req.body;
        if (!reference || !otp) {
            return handleResponse(res, 400, "reference and otp are required.", null);
        }
        const { result, tenant_id } = await submitMerchantTenantOtpService({
            merchantRow: req.merchant,
            tenantId: req.params.tenantId,
            reference,
            otp,
        });
        if (result.status === "success") {
            await updatePaymentStatusByTransactionRefService(reference, "success");
            await applyPaymentGatewaySuccess(reference, tenant_id);
        }
        handleResponse(res, 200, "OTP submitted.", {
            transaction_ref: result.reference,
            status: result.status,
            display_text: result.display_text ?? undefined,
        });
    } catch (error) {
        if (error.message?.includes("not found") || error.message?.includes("access")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const revokeMerchant = async (req, res, next) => {
    try {
        const deleted = await revokeMerchantRecordService(req.params.id);
        if (!deleted) {
            return handleResponse(res, 404, "Merchant not found.", null);
        }
        handleResponse(res, 200, "Merchant revoked.", deleted);
    } catch (error) {
        next(error);
    }
};
