import {
    approveTenantSettlementService,
    createTenantSettlementService,
    getTenantSettlementSummaryService,
    listAdminWithdrawalRequestsService,
    listTenantSettlementsService,
    markTenantSettlementPaidService,
    rejectTenantSettlementService,
    requestMerchantWithdrawalService,
    retryMerchantWithdrawalService,
} from "../models/settlement.js";
import {
    getTenantPayoutProfileService,
    upsertTenantPayoutProfileService,
} from "../models/payoutProfile.js";
import { getPayoutBankOptionsService } from "../services/paystackPayout.js";
import { handleResponse } from "../util/handleresponse.js";

export const getMySettlementSummary = async (req, res, next) => {
    try {
        const summary = await getTenantSettlementSummaryService(req.user.tenant_id);
        handleResponse(res, 200, "Settlement summary.", summary);
    } catch (error) {
        next(error);
    }
};

export const getMySettlements = async (req, res, next) => {
    try {
        const rows = await listTenantSettlementsService(req.user.tenant_id, {
            limit: req.query?.limit,
        });
        handleResponse(res, 200, "Settlement history.", rows);
    } catch (error) {
        next(error);
    }
};

export const getPayoutBankOptions = async (req, res, next) => {
    try {
        const type = req.query?.type === "mobile_money" ? "mobile_money" : "ghipss";
        const banks = await getPayoutBankOptionsService(type);
        handleResponse(res, 200, "Payout banks.", banks);
    } catch (error) {
        next(error);
    }
};

export const getMyPayoutProfile = async (req, res, next) => {
    try {
        const profile = await getTenantPayoutProfileService(req.user.tenant_id);
        handleResponse(res, 200, "Payout profile.", profile);
    } catch (error) {
        next(error);
    }
};

export const updateMyPayoutProfile = async (req, res, next) => {
    try {
        const profile = await upsertTenantPayoutProfileService(req.user, req.user.tenant_id, req.body || {});
        handleResponse(res, 200, "Payout profile saved.", profile);
    } catch (error) {
        if (
            error.message?.includes("Payout method") ||
            error.message?.includes("required") ||
            error.message?.includes("valid mobile")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const requestMyWithdrawal = async (req, res, next) => {
    try {
        const created = await requestMerchantWithdrawalService(req.user, req.user.tenant_id, req.body || {});
        handleResponse(res, 201, "Withdrawal requested.", created);
    } catch (error) {
        if (
            error.message?.includes("greater than zero") ||
            error.message?.includes("exceeds available balance") ||
            error.message?.includes("payout details") ||
            error.message?.includes("Minimum withdrawal") ||
            error.message?.includes("Paystack") ||
            error.message?.includes("Unsupported mobile money") ||
            error.message?.includes("Could not match bank") ||
            error.message?.includes("withdrawal in progress")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const retryMyWithdrawal = async (req, res, next) => {
    try {
        const updated = await retryMerchantWithdrawalService(
            req.user,
            req.user.tenant_id,
            req.params.id
        );
        handleResponse(res, 200, "Withdrawal retried.", updated);
    } catch (error) {
        if (
            error.message?.includes("not found") ||
            error.message?.includes("cannot be retried") ||
            error.message?.includes("Only failed") ||
            error.message?.includes("exceeds available balance") ||
            error.message?.includes("withdrawal in progress") ||
            error.message?.includes("not enabled") ||
            error.message?.includes("Paystack") ||
            error.message?.includes("payout details")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const getAdminTenantSettlementSummary = async (req, res, next) => {
    try {
        const summary = await getTenantSettlementSummaryService(req.params.tenantId);
        handleResponse(res, 200, "Settlement summary.", summary);
    } catch (error) {
        next(error);
    }
};

export const getAdminTenantSettlements = async (req, res, next) => {
    try {
        const rows = await listTenantSettlementsService(req.params.tenantId, {
            limit: req.query?.limit,
        });
        handleResponse(res, 200, "Settlement history.", rows);
    } catch (error) {
        next(error);
    }
};

export const listAdminWithdrawalRequests = async (req, res, next) => {
    try {
        const rows = await listAdminWithdrawalRequestsService({
            status: req.query?.status,
            limit: req.query?.limit,
        });
        handleResponse(res, 200, "Withdrawal requests.", rows);
    } catch (error) {
        next(error);
    }
};

export const createAdminTenantSettlement = async (req, res, next) => {
    try {
        const created = await createTenantSettlementService(req.user, req.params.tenantId, req.body || {});
        handleResponse(res, 201, "Settlement created.", created);
    } catch (error) {
        if (
            error.message?.includes("greater than zero") ||
            error.message?.includes("exceeds available balance")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const approveAdminSettlement = async (req, res, next) => {
    try {
        const updated = await approveTenantSettlementService(req.user, req.params.id);
        if (!updated) return handleResponse(res, 404, "Settlement not found.");
        handleResponse(res, 200, "Withdrawal approved.", updated);
    } catch (error) {
        if (
            error.message?.includes("already marked") ||
            error.message?.includes("cannot be approved") ||
            error.message?.includes("Rejected")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const rejectAdminSettlement = async (req, res, next) => {
    try {
        const updated = await rejectTenantSettlementService(req.user, req.params.id, req.body || {});
        if (!updated) return handleResponse(res, 404, "Settlement not found.");
        handleResponse(res, 200, "Withdrawal rejected.", updated);
    } catch (error) {
        if (
            error.message?.includes("cannot be rejected") ||
            error.message?.includes("already rejected") ||
            error.message?.includes("Paid settlements")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};

export const markAdminSettlementPaid = async (req, res, next) => {
    try {
        const updated = await markTenantSettlementPaidService(req.user, req.params.id, req.body || {});
        if (!updated) return handleResponse(res, 404, "Settlement not found.");
        handleResponse(res, 200, "Settlement marked paid.", updated);
    } catch (error) {
        if (
            error.message?.includes("already marked") ||
            error.message?.includes("cannot be marked paid") ||
            error.message?.includes("Cancelled settlements")
        ) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
};
