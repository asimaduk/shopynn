import { sendSmsService, isSmsConfigured } from "../services/sms.js";
import {
    resolveSubscriptionTypeConfigService,
    getOnboardingFeeForTypeService,
    getPrinterSetupFeeService,
} from "../models/billingCatalog.js";

/**
 * Official Shopynn fee disclosure for shops onboarded by a field agent.
 * Aims to stop agents collecting unofficial cash "fees" from merchants.
 */
export function buildAgentOnboardWelcomeSms({
    businessName,
    planName,
    monthlyGhs,
    assistedGoLiveGhs,
    printerSetupGhs,
}) {
    const biz = String(businessName || "your shop").trim().slice(0, 40) || "your shop";
    const plan = String(planName || "plan").trim();
    const monthly = Number(monthlyGhs) || 0;
    const goLive = Number(assistedGoLiveGhs) || 0;
    const printer = Number(printerSetupGhs) || 0;

    const monthlyPart =
        monthly > 0 ? `${plan} GHS ${monthly}/mo` : `${plan} (trial) — monthly fee when you choose a paid plan`;
    const goLivePart =
        goLive > 0
            ? `Assisted go-live GHS ${goLive} (incl. printer help)`
            : `Assisted go-live: optional fee by plan when you upgrade`;

    return (
        `Shopynn: Welcome ${biz}. ` +
        `Pay fees to Shopynn only (never cash to an agent for Shopynn fees). ` +
        `${monthlyPart}. ${goLivePart}. ` +
        `Printer setup alone GHS ${printer}. ` +
        `If an agent asks for more, refuse and contact Shopynn.`
    );
}

/**
 * Resolve phones: prefer owner user phone, then tenant phone.
 */
function pickWelcomePhone({ ownerPhone, tenantPhone, payloadPhone }) {
    const candidates = [ownerPhone, tenantPhone, payloadPhone];
    for (const raw of candidates) {
        const s = String(raw || "").trim();
        if (s) return s;
    }
    return "";
}

/**
 * Fire-and-forget safe: never throws to caller. Returns send result for logging.
 */
export async function sendAgentOnboardWelcomeSmsService({
    subscription_type,
    businessName,
    ownerPhone,
    tenantPhone,
    payloadPhone,
}) {
    if (!isSmsConfigured()) {
        return { ok: false, skipped: true, error: "SMS not configured" };
    }
    const to = pickWelcomePhone({ ownerPhone, tenantPhone, payloadPhone });
    if (!to) {
        return { ok: false, skipped: true, error: "No phone for welcome SMS" };
    }

    const config = await resolveSubscriptionTypeConfigService(subscription_type);
    const [assistedGoLiveGhs, printerSetupGhs] = await Promise.all([
        getOnboardingFeeForTypeService(subscription_type),
        getPrinterSetupFeeService(),
    ]);

    const message = buildAgentOnboardWelcomeSms({
        businessName,
        planName: config.name,
        monthlyGhs: config.amount,
        assistedGoLiveGhs,
        printerSetupGhs,
    });

    return sendSmsService({ to, message });
}

export default {
    buildAgentOnboardWelcomeSms,
    sendAgentOnboardWelcomeSmsService,
};
