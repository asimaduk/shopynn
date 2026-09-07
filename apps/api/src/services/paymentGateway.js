/**
 * Payment gateway service (Paystack-style).
 * Set PAYSTACK_SECRET_KEY in env for live; otherwise returns stub for development.
 *
 * Card: Initialize Transaction → returns redirect URL for web checkout.
 * Mobile money: Charge API → no redirect; returns reference + status + display_text for user to complete on phone.
 */

const PAYSTACK_BASE = "https://api.paystack.co";
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const DEFAULT_CALLBACK_URL = process.env.PAYMENT_CALLBACK_URL || process.env.FRONTEND_URL || "http://localhost:3000/payment/callback";
const MOBILE_MONEY_CURRENCY = process.env.PAYSTACK_MOBILE_MONEY_CURRENCY || "GHS"; // GHS Ghana, KES Kenya

/**
 * Initialize a transaction and get redirect URL for card web checkout.
 * @param {object} opts - { amount (number, in major unit e.g. 10.50), email, reference, callback_url?, metadata? }
 * @returns {Promise<{ redirect_url: string, reference: string }>}
 */
export async function getCheckoutRedirectUrl(opts) {
    const { amount, email, reference, callback_url = DEFAULT_CALLBACK_URL } = opts;
    const amountInMinor = Math.round(Number(amount) * 100); // Paystack uses pesewas/cents

    if (!PAYSTACK_SECRET) {
        const stubUrl = `${callback_url}?reference=${reference}&status=stub`;
        return { redirect_url: stubUrl, reference };
    }

    const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
        body: JSON.stringify({
            email: email || "customer@example.com",
            amount: amountInMinor,
            reference,
            callback_url,
            channels: ["card"],
            metadata: opts.metadata || {},
        }),
    });

    const data = await res.json();
    if (!data.status || !data.data?.authorization_url) {
        throw new Error(data.message || "Payment gateway failed to create checkout session.");
    }

    return {
        redirect_url: data.data.authorization_url,
        reference: data.data.reference || reference,
    };
}

/**
 * Charge via Paystack Charge API (mobile money). No redirect; user completes on phone.
 * Ghana providers: mtn, tgo (AirtelTigo), vod (Vodafone). Kenya: mpesa.
 * @param {object} opts - { amount (major unit), email, reference, phone, provider, metadata? }
 * @returns {Promise<{ reference: string, status: string, display_text?: string }>}
 */
export async function chargeMobileMoney(opts) {
    const { amount, email, reference, phone, provider } = opts;
    const amountInMinor = Math.round(Number(amount) * 100); // pesewas (GHS) or cents (KES)

    if (!PAYSTACK_SECRET) {
        return {
            reference,
            status: "pay_offline",
            display_text: `[Stub] Complete payment on your phone. Ref: ${reference}`,
        };
    }

    const res = await fetch(`${PAYSTACK_BASE}/charge`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
        body: JSON.stringify({
            email: email || "customer@example.com",
            amount: amountInMinor,
            currency: MOBILE_MONEY_CURRENCY,
            reference,
            mobile_money: {
                phone: String(phone).trim(),
                provider: String(provider).toLowerCase(),
            },
            metadata: opts.metadata || {},
        }),
    });

    const data = await res.json();
    if (!data.status) {
        throw new Error(data.message || "Mobile money charge failed.");
    }

    const d = data.data || {};
    return {
        reference: d.reference || reference,
        status: d.status || "pending",
        display_text: d.display_text ?? null,
        ussd_code: d.ussd_code ?? null,
    };
}

/**
 * Initiate payment: card → redirect URL; mobile_money → Charge API (no redirect).
 * @param {object} opts - { amount, email, reference, callback_url?, payment_method: 'card' | 'mobile_money', phone?, provider? }
 * @returns {Promise<{ redirect_url?: string, reference: string, status?: string, display_text?: string, ussd_code?: string }>}
 */
export async function initiateCheckout(opts) {
    const paymentMethod = (opts.payment_method || "card").toLowerCase();
    if (paymentMethod === "mobile_money") {
        return chargeMobileMoney(opts);
    }
    return getCheckoutRedirectUrl({ ...opts, channels: ["card"] });
}

/**
 * Submit OTP for a charge (e.g. Vodafone voucher code after dialling *110#).
 * @param {string} reference - Transaction reference from initiate/charge response.
 * @param {string} otp - OTP/voucher code from user.
 * @returns {Promise<{ reference: string, status: string, display_text?: string }>}
 */
export async function submitChargeOtp(reference, otp) {
    if (!PAYSTACK_SECRET) {
        return { reference, status: "pending", display_text: "[Stub] OTP submitted." };
    }
    const res = await fetch(`${PAYSTACK_BASE}/charge/submit_otp`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
        body: JSON.stringify({ reference, otp: String(otp).trim() }),
    });
    const data = await res.json();
    if (!data.status) {
        throw new Error(data.message || "Submit OTP failed.");
    }
    const d = data.data || {};
    return {
        reference: d.reference || reference,
        status: d.status || "pending",
        display_text: d.display_text ?? null,
    };
}

/**
 * Verify a transaction by reference (e.g. after redirect or to poll mobile money status).
 * @param {string} reference - Transaction reference.
 * @returns {Promise<{ reference: string, status: string, amount?: number, paid_at?: string }>}
 */
export async function verifyTransaction(reference) {
    if (!PAYSTACK_SECRET) {
        return { reference, status: "pending", amount: null, paid_at: null };
    }
    const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const data = await res.json();
    if (!data.status) {
        throw new Error(data.message || "Verification failed.");
    }
    const d = data.data || {};
    return {
        reference: d.reference || reference,
        status: d.status || "pending",
        amount: d.amount != null ? d.amount / 100 : null,
        paid_at: d.paid_at ?? null,
    };
}

async function paystackRequest(path, { method = "GET", body } = {}) {
    if (!PAYSTACK_SECRET) {
        throw new Error("Paystack is not configured.");
    }
    const res = await fetch(`${PAYSTACK_BASE}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
        body: body != null ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!data.status) {
        throw new Error(data.message || "Paystack request failed.");
    }
    return data.data;
}

/**
 * List Ghana banks or mobile-money providers for payout recipient setup.
 * @param {{ type?: 'ghipss' | 'mobile_money' }} opts
 */
export async function listPayoutBanks(opts = {}) {
    if (!PAYSTACK_SECRET) {
        const stubMomo = [
            { name: "MTN", code: "MTN", slug: "mtn" },
            { name: "Telecel", code: "VOD", slug: "vod" },
            { name: "AT", code: "ATL", slug: "atl" },
        ];
        const stubBanks = [
            { name: "GCB Bank", code: "040", slug: "gcb" },
            { name: "Ecobank Ghana", code: "130", slug: "ecobank-ghana" },
        ];
        return opts.type === "mobile_money" ? stubMomo : stubBanks;
    }
    const params = new URLSearchParams({ country: "ghana", currency: "GHS" });
    if (opts.type) params.set("type", opts.type);
    const data = await paystackRequest(`/bank?${params.toString()}`);
    return Array.isArray(data) ? data : [];
}

/**
 * Create a Paystack transfer recipient from payout profile fields.
 */
export async function createTransferRecipient(opts) {
    const {
        payout_method,
        account_holder_name,
        momo_number,
        bank_code,
        bank_account_number,
        bank_account_name,
    } = opts;

    if (!PAYSTACK_SECRET) {
        return {
            recipient_code: `RCP_STUB_${Date.now()}`,
            details: { account_number: momo_number || bank_account_number },
        };
    }

    const method = String(payout_method || "").toLowerCase();
    let payload;
    if (method === "momo") {
        payload = {
            type: "mobile_money",
            name: account_holder_name,
            account_number: String(momo_number || "").trim(),
            bank_code: String(bank_code || "").trim(),
            currency: "GHS",
        };
    } else {
        payload = {
            type: "ghipss",
            name: bank_account_name || account_holder_name,
            account_number: String(bank_account_number || "").trim(),
            bank_code: String(bank_code || "").trim(),
            currency: "GHS",
        };
    }

    const data = await paystackRequest("/transferrecipient", { method: "POST", body: payload });
    return {
        recipient_code: data.recipient_code,
        details: data.details || null,
    };
}

/**
 * Initiate a transfer from Paystack balance to a recipient.
 * @returns {Promise<{ transfer_code: string, reference: string, status: string, message?: string }>}
 */
export async function initiateTransfer(opts) {
    const { amount, recipient_code, reference, reason = "Order revenue payout" } = opts;
    const amountInMinor = Math.round(Number(amount) * 100);

    if (!PAYSTACK_SECRET) {
        return {
            transfer_code: `TRF_STUB_${Date.now()}`,
            reference: reference || `stub_${Date.now()}`,
            status: "success",
            message: "[Stub] Transfer completed.",
        };
    }

    const data = await paystackRequest("/transfer", {
        method: "POST",
        body: {
            source: "balance",
            amount: amountInMinor,
            recipient: recipient_code,
            reason,
            reference,
            currency: "GHS",
        },
    });

    return {
        transfer_code: data.transfer_code || data.code,
        reference: data.reference || reference,
        status: String(data.status || "pending").toLowerCase(),
        message: data.complete_message || data.message || null,
    };
}

/**
 * Verify transfer status by reference or transfer code.
 */
export async function verifyTransfer(referenceOrCode) {
    if (!PAYSTACK_SECRET) {
        return { status: "success", reference: referenceOrCode, transfer_code: referenceOrCode };
    }
    const data = await paystackRequest(`/transfer/verify/${encodeURIComponent(referenceOrCode)}`);
    return {
        status: String(data.status || "pending").toLowerCase(),
        reference: data.reference,
        transfer_code: data.transfer_code || data.code,
        amount: data.amount != null ? data.amount / 100 : null,
    };
}

export function isPaystackConfigured() {
    return Boolean(PAYSTACK_SECRET);
}

export function getMinWithdrawalAmount() {
    const n = Number(process.env.PAYSTACK_MIN_WITHDRAWAL_GHS || 1);
    return Number.isFinite(n) && n > 0 ? n : 1;
}

export function isAutoWithdrawalEnabled() {
    if (process.env.PAYSTACK_AUTO_WITHDRAWAL === "false") return false;
    return isPaystackConfigured() || process.env.PAYSTACK_AUTO_WITHDRAWAL_STUB === "true";
}

