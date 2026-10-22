import { handleResponse } from "../util/handleresponse.js";
import {
    getEarningsSummaryService,
    getPayoutProfileService,
    upsertPayoutProfileService,
    prepareAgentPayoutsService,
    listAgentPayoutsService,
    approveAgentPayoutService,
    rejectAgentPayoutService,
    markAgentPayoutFailedService,
    cancelCommissionService,
    agentPayoutsLiveBlocked,
    notifyAgentPayoutStatus,
} from "../models/agentPayout.js";

export const getMyEarnings = async (req, res, next) => {
    try {
        const earnings = await getEarningsSummaryService(req.merchant.id);
        const profile = await getPayoutProfileService(req.merchant.id);
        handleResponse(res, 200, "Earnings.", { earnings, payout_profile: profile });
    } catch (error) {
        next(error);
    }
};

export const getMyPayoutProfile = async (req, res, next) => {
    try {
        const profile = await getPayoutProfileService(req.merchant.id);
        handleResponse(res, 200, "Payout profile.", { payout_profile: profile });
    } catch (error) {
        next(error);
    }
};

export const saveMyPayoutProfile = async (req, res, next) => {
    try {
        const profile = await upsertPayoutProfileService(req.merchant.id, req.body || {});
        handleResponse(res, 200, "Payout details saved.", { payout_profile: profile });
    } catch (error) {
        if (/momo_network|mobile money|account_holder_name/.test(error.message || "")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const listAgentPayouts = async (req, res, next) => {
    try {
        const payouts = await listAgentPayoutsService({ status: req.query.status });
        handleResponse(res, 200, "Agent payouts.", { payouts, live_transfers_blocked: agentPayoutsLiveBlocked() });
    } catch (error) {
        next(error);
    }
};

export const prepareAgentPayouts = async (req, res, next) => {
    try {
        const result = await prepareAgentPayoutsService({ actorUserId: req.user?.id });
        handleResponse(res, 200, `${result.created.length} payout(s) prepared for approval.`, result);
    } catch (error) {
        next(error);
    }
};

export const approveAgentPayout = async (req, res, next) => {
    try {
        const payout = await approveAgentPayoutService({ payoutId: req.params.id, actorUserId: req.user?.id });
        if (!payout) return handleResponse(res, 404, "No payout awaiting approval or retry with that id.", null);
        await notifyAgentPayoutStatus(payout.id);
        const message =
            payout.status === "paid"
                ? "Payout sent."
                : payout.status === "failed"
                  ? `Payout failed: ${payout.failure_reason || "unknown error"}`
                  : "Payout sent to Paystack; waiting for confirmation.";
        handleResponse(res, 200, message, { payout });
    } catch (error) {
        if (error.message?.includes("switched off")) return handleResponse(res, 400, error.message, null);
        next(error);
    }
};

export const rejectAgentPayout = async (req, res, next) => {
    try {
        const payout = await rejectAgentPayoutService({ payoutId: req.params.id, reason: req.body?.reason });
        if (!payout) return handleResponse(res, 404, "No payout awaiting approval or failed with that id.", null);
        await notifyAgentPayoutStatus(payout.id);
        handleResponse(res, 200, "Payout rejected. Its commissions are payable again.", { payout });
    } catch (error) {
        next(error);
    }
};

export const markAgentPayoutFailed = async (req, res, next) => {
    try {
        const payout = await markAgentPayoutFailedService({ payoutId: req.params.id, reason: req.body?.reason });
        if (!payout) return handleResponse(res, 404, "No processing payout with that id.", null);
        await notifyAgentPayoutStatus(payout.id);
        handleResponse(res, 200, "Payout marked failed.", { payout });
    } catch (error) {
        next(error);
    }
};

export const cancelCommission = async (req, res, next) => {
    try {
        const result = await cancelCommissionService({
            commissionId: req.params.id,
            actorUserId: req.user?.id,
            reason: req.body?.reason,
        });
        if (!result) return handleResponse(res, 404, "Commission not found.", null);
        handleResponse(res, 200, "Commission cancelled.", result);
    } catch (error) {
        if (/payout|already been paid/.test(error.message || "")) return handleResponse(res, 400, error.message, null);
        next(error);
    }
};
