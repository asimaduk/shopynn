import { handleResponse } from "../util/handleresponse.js";
import {
    getCurrentSubscriptionWithPaymentsService,
    changeSubscriptionPlanService,
    activatePendingSubscriptionService,
} from "../models/subscription.js";

export const onboardSubscription = async (req, res, next) => {
    try {
        const tenant_id = req.body.tenant_id ?? req.user?.tenant_id;
        if (!tenant_id) {
            return handleResponse(res, 400, "tenant_id is required (or use authenticated user's tenant).", null);
        }
        if (req.user && req.body.tenant_id && req.body.tenant_id !== req.user.tenant_id) {
            return handleResponse(res, 403, "You can only onboard your own tenant.", null);
        }
        const subscription = await changeSubscriptionPlanService(tenant_id, req.body.subscription_type);
        const message = subscription?.is_upgrade
            ? "Upgrade checkout started. Remaining time on your current plan will be added as extra days after payment."
            : "Subscription created and linked to tenant.";
        handleResponse(res, 201, message, subscription);
    } catch (error) {
        if (error.message?.includes("subscription_type") || error.message?.includes("Tenant not found")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const activateSubscription = async (req, res, next) => {
    try {
        const subscription = await activatePendingSubscriptionService(req.params.id);
        handleResponse(res, 200, "Subscription activated.", subscription);
    } catch (error) {
        if (error.message?.includes("Subscription not found") || error.message?.includes("Only pending")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const getCurrentSubscription = async (req, res, next) => {
    try {
        const paymentsLimit = req.query?.payments_limit ?? req.query?.paymentsLimit;
        const data = await getCurrentSubscriptionWithPaymentsService(req.user, {
            paymentsLimit: paymentsLimit != null ? Number(paymentsLimit) : 4,
        });
        if (!data.subscription) {
            return handleResponse(res, 404, "No subscription found for this tenant.", data);
        }
        handleResponse(res, 200, "Current subscription with recent payments.", data);
    } catch (error) {
        next(error);
    }
};
