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
    findOpenPosMomoPaymentService,
    abandonPosMomoPaymentService,
    parkPosMomoPaymentService,
    listUnlinkedPosMomoPaymentsService,
} from "../models/payment.js";
import { initiateCheckout, submitChargeOtp, verifyTransaction } from "../services/paymentGateway.js";
import { computeChargeForFaceAmountService } from "../models/platformSettings.js";

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
 * Body: {
 *   amount | face_amount,
 *   payment_method: 'card' | 'mobile_money',
 *   source?: 'pos_sale' | 'subscription' | ...,
 *   apply_platform_fee?: boolean,
 *   email?, callback_url?, subscription_id?, customer_id?, phone?, provider?
 * }
 * Platform fee applies when source=pos_sale or apply_platform_fee=true (not for subscription billing).
 */
export const initiatePayment = async (req, res, next) => {
    try {
        const {
            amount,
            face_amount,
            payment_method,
            email,
            callback_url,
            subscription_id,
            customer_id,
            phone,
            provider,
            source,
            apply_platform_fee,
            payment_number,
            force_new,
        } = req.body;

        const rawFace = face_amount != null ? Number(face_amount) : Number(amount);
        if (!Number.isFinite(rawFace) || rawFace <= 0) {
            return handleResponse(res, 400, "Invalid or missing amount.");
        }

        const tenant_id = req.user?.tenant_id;
        const creator_id = req.user?.id;
        const payment_method_type = payment_method === "mobile_money" ? "mobile_money" : "card";
        const payment_source = source ? String(source).trim().toLowerCase() : null;
        const shouldApplyPlatformFee =
            apply_platform_fee === true || payment_source === "pos_sale";

        if (payment_method_type === "mobile_money") {
            if (!phone || !provider) {
                return handleResponse(res, 400, "For mobile money, phone and provider (e.g. mtn, tgo, vod) are required.");
            }
        }

        let face = Math.round(rawFace * 100) / 100;
        let fee = 0;
        let charge = face;
        let chargeMeta = null;
        if (shouldApplyPlatformFee) {
            chargeMeta = await computeChargeForFaceAmountService(face);
            face = chargeMeta.face_amount;
            fee = chargeMeta.fee_amount;
            charge = chargeMeta.charge_amount;
        }

        const feeBreakdown = {
            face_amount: face,
            fee_amount: fee,
            charge_amount: charge,
            percent: chargeMeta?.percent ?? 0,
        };

        // POS MoMo: reuse confirmed orphan payments / resume open pending instead of double-charging.
        if (payment_source === "pos_sale" && payment_method_type === "mobile_money") {
            const open = await findOpenPosMomoPaymentService({
                tenant_id,
                face_amount: face,
                phone: payment_number || phone,
            });

            if (open?.reuse_mode === "success") {
                return handleResponse(res, 200, "Existing confirmed MoMo payment reused.", {
                    transaction_ref: open.transaction_ref,
                    payment_id: open.id,
                    status: "success",
                    reused: true,
                    resume: false,
                    display_text: "Previous MoMo payment already confirmed. Complete the sale.",
                    ...feeBreakdown,
                    face_amount: Number(open.face_amount) || face,
                    fee_amount: Number(open.fee_amount) || fee,
                    charge_amount: Number(open.amount) || charge,
                });
            }

            if (open?.reuse_mode === "pending" && !force_new) {
                return handleResponse(res, 200, "Resuming open MoMo payment.", {
                    transaction_ref: open.transaction_ref,
                    payment_id: open.id,
                    status: open.status || "pending",
                    reused: false,
                    resume: true,
                    display_text:
                        "A MoMo prompt is already open for this amount. Ask the customer to approve it, or use Check status.",
                    ...feeBreakdown,
                    face_amount: Number(open.face_amount) || face,
                    fee_amount: Number(open.fee_amount) || fee,
                    charge_amount: Number(open.amount) || charge,
                });
            }

            if (open?.reuse_mode === "pending" && force_new) {
                await abandonPosMomoPaymentService({
                    tenant_id,
                    transaction_ref: open.transaction_ref,
                    actor_user_id: creator_id,
                });
            }
        }

        const { id: payment_id, transaction_ref } = await createPendingPaymentForCheckoutService({
            amount: charge,
            face_amount: face,
            fee_amount: fee,
            subscription_id: subscription_id || null,
            customer_id: customer_id || null,
            tenant_id,
            creator_id,
            payment_method_type,
            payment_source: payment_source || (shouldApplyPlatformFee ? "pos_sale" : null),
            payment_number: payment_number || (payment_method_type === "mobile_money" ? phone : null),
        });

        const payload = {
            amount: charge,
            email: email || req.user?.email || "customer@example.com",
            reference: transaction_ref,
            callback_url: callback_url || undefined,
            payment_method: payment_method_type,
            metadata: {
                payment_id,
                tenant_id,
                face_amount: face,
                fee_amount: fee,
                payment_source: payment_source || null,
            },
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
                reused: false,
                resume: false,
                ...feeBreakdown,
            });
        } else {
            handleResponse(res, 200, "Checkout session created.", {
                redirect_url: result.redirect_url,
                transaction_ref: result.reference,
                payment_id,
                reused: false,
                resume: false,
                ...feeBreakdown,
            });
        }
    } catch (error) {
        const msg = error?.message || "Could not start payment.";
        const status = Number(error?.status) || 0;
        if (status >= 400 && status < 500) {
            return handleResponse(res, status, msg, {
                code: error?.code || "PAYMENT_INIT_FAILED",
            });
        }
        // Gateway / validation failures often arrive as plain Error — surface the real reason.
        if (
            error?.code === "MOMO_CHARGE_FAILED" ||
            /mobile money|paystack|charge|phone|provider|momo|invalid/i.test(msg)
        ) {
            return handleResponse(res, 400, msg, { code: error?.code || "MOMO_CHARGE_FAILED" });
        }
        next(error);
    }
};

/**
 * Look up a reusable/resumable POS MoMo payment for this sale total + phone.
 */
export const getOpenPosMomoPayment = async (req, res, next) => {
    try {
        const face_amount = Number(req.query.face_amount);
        const phone = req.query.phone || req.query.payment_number || "";
        if (!Number.isFinite(face_amount) || face_amount <= 0) {
            return handleResponse(res, 400, "face_amount is required.");
        }
        const open = await findOpenPosMomoPaymentService({
            tenant_id: req.user.tenant_id,
            face_amount,
            phone,
        });
        handleResponse(res, 200, open ? "Open POS MoMo payment found." : "No open POS MoMo payment.", open);
    } catch (error) {
        next(error);
    }
};

/**
 * Abandon a pending POS MoMo payment so a new prompt can be sent.
 */
export const abandonPosMomoPayment = async (req, res, next) => {
    try {
        const reference = req.body?.reference || req.body?.transaction_ref;
        if (!reference) {
            return handleResponse(res, 400, "reference is required.");
        }
        const result = await abandonPosMomoPaymentService({
            tenant_id: req.user.tenant_id,
            transaction_ref: reference,
            actor_user_id: req.user?.id,
        });
        handleResponse(res, 200, "Payment abandoned.", result);
    } catch (error) {
        if (error?.status) {
            return handleResponse(res, error.status, error.message);
        }
        next(error);
    }
};

/**
 * Park an unlinked POS MoMo payment with a cart snapshot so the cashier can serve others.
 */
export const parkPosMomoPayment = async (req, res, next) => {
    try {
        const reference = req.body?.reference || req.body?.transaction_ref;
        const cart_snapshot = req.body?.cart_snapshot || req.body?.cartSnapshot;
        if (!reference) {
            return handleResponse(res, 400, "reference is required.");
        }
        const result = await parkPosMomoPaymentService({
            tenant_id: req.user.tenant_id,
            transaction_ref: reference,
            cart_snapshot,
            actor_user_id: req.user?.id,
        });
        handleResponse(res, 200, "Payment parked.", result);
    } catch (error) {
        if (error?.status) {
            return handleResponse(res, error.status, error.message);
        }
        next(error);
    }
};

/**
 * List unlinked POS MoMo payments (pending or paid, not yet completed as a sale).
 */
export const listPendingPosMomoPayments = async (req, res, next) => {
    try {
        const list = await listUnlinkedPosMomoPaymentsService(req.user, req.query);
        handleResponse(res, 200, "Pending POS MoMo payments.", list);
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
