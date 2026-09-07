import { handleResponse } from "../util/handleresponse.js";
import {
    getPaymentsHistoryService,
    getPaymentsByTenantIdService,
    getPaymentsByCustomerIdService,
    getPaymentByIdService,
    createPaymentService,
    createPendingPaymentForCheckoutService,
    getPaymentByTransactionRefService,
    updatePaymentStatusByTransactionRefService,
    applyPaymentGatewaySuccess,
    syncOrderPaymentAfterFailure,
    getPaymentReceiptService,
    getPaymentEventsService,
    reverseCashOrderPaymentService,
} from "../models/payment.js";
import { initiateCheckout, submitChargeOtp, verifyTransaction } from "../services/paymentGateway.js";

export const getPaymentsHistory = async (req, res, next) => {
    try {
        const history = await getPaymentsHistoryService(req.user, req.query);
        handleResponse(res, 200, "Payments history.", history);
    } catch (error) {
        next(error);
    }
};

export const getPaymentsByTenantId = async (req, res, next) => {
    try {
        if (req.params.tenantId !== req.user?.tenant_id) {
            return handleResponse(res, 403, "Access denied. You can only view payments for your tenant.");
        }
        const payments = await getPaymentsByTenantIdService(req.user, req.params.tenantId, req.query);
        handleResponse(res, 200, "Tenant payments.", payments);
    } catch (error) {
        next(error);
    }
};

export const getPaymentsByCustomerId = async (req, res, next) => {
    try {
        const payments = await getPaymentsByCustomerIdService(req.user, req.params.customerId, req.query);
        handleResponse(res, 200, "Customer payments.", payments);
    } catch (error) {
        next(error);
    }
};

export const getPaymentById = async (req, res, next) => {
    try {
        const payment = await getPaymentByIdService(req.params.id, req.user.tenant_id);
        if (!payment) return handleResponse(res, 404, "Payment not found.");
        handleResponse(res, 200, "Payment.", payment);
    } catch (error) {
        next(error);
    }
};

export const getPaymentReceipt = async (req, res, next) => {
    try {
        const receipt = await getPaymentReceiptService(req.params.id, req.user.tenant_id);
        if (!receipt) return handleResponse(res, 404, "Payment not found.");
        handleResponse(res, 200, "Payment receipt.", receipt);
    } catch (error) {
        next(error);
    }
};

export const getPaymentEvents = async (req, res, next) => {
    try {
        const events = await getPaymentEventsService(req.params.id, req.user.tenant_id);
        handleResponse(res, 200, "Payment events.", events);
    } catch (error) {
        next(error);
    }
};

export const reverseCashPayment = async (req, res, next) => {
    try {
        const reason = req.body?.reason != null ? String(req.body.reason).trim() : "";
        const reversed = await reverseCashOrderPaymentService(req.user, req.params.id, reason);
        handleResponse(res, 200, "Payment reversed.", reversed);
    } catch (error) {
        const message = String(error?.message || "");
        if (
            message.includes("not found") ||
            message.includes("Only order-linked") ||
            message.includes("Only cash") ||
            message.includes("Only successful")
        ) {
            return handleResponse(res, 400, message);
        }
        next(error);
    }
};

export const createPayment = async (req, res, next) => {
    try {
        const payload = {
            ...req.body,
            creator_id: req.user?.id,
            tenant_id: req.user?.tenant_id,
        };
        const created = await createPaymentService(payload);
        handleResponse(res, 201, "Payment created.", created);
    } catch (error) {
        next(error);
    }
};

/**
 * Initiate payment: card (redirect URL for web checkout) or mobile_money (Charge API, no redirect).
 * Body: { amount, payment_method: 'card' | 'mobile_money', email?, callback_url?, subscription_id?, customer_id?, phone?, provider? }
 * For mobile_money: phone and provider (mtn, tgo, vod for Ghana; mpesa for Kenya) are required.
 */
export const initiatePayment = async (req, res, next) => {
    try {
        const { amount, payment_method, email, callback_url, subscription_id, customer_id, phone, provider } = req.body;
        if (!amount || (amount !== Number(amount) && isNaN(Number(amount)))) {
            return handleResponse(res, 400, "Invalid or missing amount.");
        }
        const tenant_id = req.user?.tenant_id;
        const creator_id = req.user?.id;
        const payment_method_type = payment_method === "mobile_money" ? "mobile_money" : "card";

        if (payment_method_type === "mobile_money") {
            if (!phone || !provider) {
                return handleResponse(res, 400, "For mobile money, phone and provider (e.g. mtn, tgo, vod) are required.");
            }
        }

        const { id: payment_id, transaction_ref } = await createPendingPaymentForCheckoutService({
            amount: Number(amount),
            subscription_id: subscription_id || null,
            customer_id: customer_id || null,
            tenant_id,
            creator_id,
            payment_method_type,
        });

        const payload = {
            amount: Number(amount),
            email: email || req.user?.email || "customer@example.com",
            reference: transaction_ref,
            callback_url: callback_url || undefined,
            payment_method: payment_method_type,
            metadata: { payment_id, tenant_id },
            phone,
            provider,
        };

        const result = await initiateCheckout(payload);

        if (payment_method_type === "mobile_money") {
            handleResponse(res, 200, "Mobile money charge initiated.", {
                transaction_ref: result.reference,
                payment_id,
                status: result.status,
                display_text: result.display_text ?? undefined,
                ussd_code: result.ussd_code ?? undefined,
            });
        } else {
            handleResponse(res, 200, "Checkout session created.", {
                redirect_url: result.redirect_url,
                transaction_ref: result.reference,
                payment_id,
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Submit OTP for a mobile money charge (e.g. Vodafone voucher after *110#).
 * Body: { reference, otp }
 */
export const submitOtp = async (req, res, next) => {
    try {
        const { reference, otp } = req.body;
        if (!reference || !otp) {
            return handleResponse(res, 400, "reference and otp are required.");
        }
        const payment = await getPaymentByTransactionRefService(reference, req.user.tenant_id);
        if (!payment) {
            return handleResponse(res, 404, "Payment not found for this reference.");
        }
        const result = await submitChargeOtp(reference, otp);
        if (result.status === "success") {
            await updatePaymentStatusByTransactionRefService(reference, "success");
            await applyPaymentGatewaySuccess(reference, req.user.tenant_id);
        }
        handleResponse(res, 200, "OTP submitted.", {
            transaction_ref: result.reference,
            status: result.status,
            display_text: result.display_text ?? undefined,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Verify a payment by transaction reference (e.g. after redirect or to poll status).
 * Query or param: reference
 */
export const verifyPayment = async (req, res, next) => {
    try {
        const reference = req.query.reference || req.params.reference;
        if (!reference) {
            return handleResponse(res, 400, "reference is required (query or path).");
        }
        const payment = await getPaymentByTransactionRefService(reference, req.user.tenant_id);
        if (!payment) {
            return handleResponse(res, 404, "Payment not found for this reference.");
        }
        const result = await verifyTransaction(reference);
        if (result.status === "success") {
            await updatePaymentStatusByTransactionRefService(reference, "success");
            await applyPaymentGatewaySuccess(reference, req.user.tenant_id);
        } else if (result.status === "failed") {
            await updatePaymentStatusByTransactionRefService(reference, "failed");
            await syncOrderPaymentAfterFailure(reference);
        }
        handleResponse(res, 200, "Transaction verified.", {
            transaction_ref: result.reference,
            status: result.status,
            amount: result.amount,
            paid_at: result.paid_at ?? undefined,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Paystack webhook: verify signature, handle charge.success / charge.failed, update payment status.
 * Must be mounted with express.raw({ type: "application/json" }) so req.body is the raw Buffer for signature verification.
 */
export const paymentWebhook = async (req, res, next) => {
    try {
        const crypto = await import("crypto");
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const signature = req.headers["x-paystack-signature"];
        const rawBody = Buffer.isBuffer(req.body) ? req.body : typeof req.body === "string" ? Buffer.from(req.body) : null;
        if (!rawBody || !signature || !secret) {
            res.status(400).send("Bad request");
            return;
        }
        const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
        if (hash !== signature) {
            res.status(401).send("Invalid signature");
            return;
        }
        const payload = JSON.parse(rawBody.toString());
        const event = payload.event;
        const data = payload.data || {};
        const reference = data.reference || data.transfer_code;
        if (!reference) {
            res.status(200).send("OK");
            return;
        }
        if (event === "charge.success") {
            await updatePaymentStatusByTransactionRefService(reference, "success");
            await applyPaymentGatewaySuccess(reference);
        } else if (event === "charge.failed" || event === "charge.failed_charge") {
            await updatePaymentStatusByTransactionRefService(reference, "failed");
            await syncOrderPaymentAfterFailure(reference);
        } else if (event === "transfer.success") {
            const { handlePaystackTransferWebhook } = await import("../services/paystackPayout.js");
            await handlePaystackTransferWebhook({ ...data, status: "success" });
        } else if (event === "transfer.failed") {
            const { handlePaystackTransferWebhook } = await import("../services/paystackPayout.js");
            await handlePaystackTransferWebhook({ ...data, status: "failed" });
        } else if (event === "transfer.reversed") {
            const { handlePaystackTransferWebhook } = await import("../services/paystackPayout.js");
            await handlePaystackTransferWebhook({ ...data, status: "reversed" });
        }
        res.status(200).send("OK");
    } catch (error) {
        next(error);
    }
};
