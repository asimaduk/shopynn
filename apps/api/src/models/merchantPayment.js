import {
    getPendingQuoteForTenantService,
    getOnboardingQuoteByIdService,
    merchantCanAccessTenantService,
} from "./onboardingQuote.js";
import { createPendingPaymentForCheckoutService } from "./payment.js";
import { initiateCheckout, submitChargeOtp } from "../services/paymentGateway.js";
import pool from "../config/db.js";
import { QUOTE_STATUS } from "../constants/billingCatalog.js";

export const initiateMerchantTenantPaymentService = async ({
    merchantRow,
    tenantId,
    creator_id,
    payment_method,
    email,
    phone,
    provider,
    callback_url,
    quote_id,
}) => {
    const allowed = await merchantCanAccessTenantService(merchantRow.id, tenantId);
    if (!allowed) throw new Error("You do not have access to this business.");

    let quote = quote_id ? await getOnboardingQuoteByIdService(quote_id) : await getPendingQuoteForTenantService(tenantId);
    if (!quote || quote.tenant_id !== tenantId) {
        throw new Error("No pending payment quote for this business.");
    }
    if (quote.status !== QUOTE_STATUS.PENDING_PAYMENT) {
        throw new Error("Quote is not awaiting payment.");
    }
    if (Number(quote.total_ghs) <= 0) {
        throw new Error("Nothing to charge for this quote.");
    }

    const tenantRow = await pool.query(
        `SELECT subscription_id, email FROM tenants WHERE id = $1`,
        [tenantId]
    );
    const subscription_id = quote.subscription_id || tenantRow.rows[0]?.subscription_id;
    const ownerEmail =
        String(email || quote.owner_email || tenantRow.rows[0]?.email || "").trim() || "customer@example.com";

    const payment_method_type = payment_method === "mobile_money" ? "mobile_money" : "card";
    if (payment_method_type === "mobile_money" && (!phone || !provider)) {
        throw new Error("For mobile money, phone and provider are required.");
    }

    const { id: payment_id, transaction_ref } = await createPendingPaymentForCheckoutService({
        amount: Number(quote.total_ghs),
        subscription_id,
        tenant_id: tenantId,
        creator_id,
        payment_method_type,
        quote_id: quote.id,
    });

    const payload = {
        amount: Number(quote.total_ghs),
        email: ownerEmail,
        reference: transaction_ref,
        callback_url: callback_url || undefined,
        payment_method: payment_method_type,
        metadata: { payment_id, tenant_id: tenantId, quote_id: quote.id, merchant_id: merchantRow.id },
        phone,
        provider,
    };

    const result = await initiateCheckout(payload);

    return {
        quote,
        payment_id,
        transaction_ref: result.reference,
        owner_email: ownerEmail,
        payment_method_type,
        redirect_url: result.redirect_url,
        status: result.status,
        display_text: result.display_text,
        ussd_code: result.ussd_code,
    };
};

export const submitMerchantTenantOtpService = async ({ merchantRow, tenantId, reference, otp }) => {
    const allowed = await merchantCanAccessTenantService(merchantRow.id, tenantId);
    if (!allowed) throw new Error("You do not have access to this business.");

    const paymentRes = await pool.query(
        `SELECT id, tenant_id, quote_id FROM payments WHERE transaction_ref = $1 AND tenant_id = $2 LIMIT 1`,
        [reference, tenantId]
    );
    if (!paymentRes.rows[0]) throw new Error("Payment not found for this reference.");

    const result = await submitChargeOtp(reference, otp);
    return { result, tenant_id: tenantId };
};
