import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { createNotificationService } from "./notification.js";
import { applyOrderPartialPayment } from "./orderInstallment.js";
import { activatePendingSubscriptionService } from "./subscription.js";
import {
    markQuotePaidService,
    finalizeMerchantCommissionForQuoteService,
    getOnboardingQuoteByIdService,
} from "./onboardingQuote.js";
import crypto from "crypto";

const buildTransactionRef = (paymentMethodType = "PAY") => {
    const method = String(paymentMethodType || "PAY").trim().toUpperCase();
    const methodCode = method
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 3)
        .padEnd(3, "X");
    const timePart = Date.now().toString(36).toUpperCase();
    const randPart = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 chars
    // Example: TX-CAR-MA6JYQ7G-9F3A1BCD (27 chars)
    return `TX-${methodCode}-${timePart}-${randPart}`;
};

const createUniqueTransactionRef = async (paymentMethodType) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const ref = buildTransactionRef(paymentMethodType);
        const exists = await pool.query(
            `SELECT 1 FROM payments WHERE transaction_ref = $1 LIMIT 1`,
            [ref]
        );
        if (exists.rowCount === 0) return ref;
    }
    // Last-resort fallback with UUID entropy.
    return `TX-${uuidv4().replace(/-/g, "").slice(0, 20).toUpperCase()}`;
};

/**
 * List payments history with optional filters: tenant_id (via user), startDate, endDate, status.
 */
export const getPaymentsHistoryService = async (user, requestQuery = {}) => {
    const conditions = ["p.tenant_id = $1"];
    const params = [user.tenant_id];
    let paramIndex = 2;

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`p.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const status = requestQuery.status;
    if (status !== undefined && status !== null && status !== "") {
        conditions.push(`p.status = $${paramIndex}`);
        params.push(String(status).trim());
        paramIndex += 1;
    }

    const subscriptionId = requestQuery.subscription_id ?? requestQuery.subscriptionId;
    if (subscriptionId) {
        conditions.push(`p.subscription_id = $${paramIndex}`);
        params.push(subscriptionId);
        paramIndex += 1;
    }

    const customerId = requestQuery.customer_id ?? requestQuery.customerId;
    if (customerId) {
        conditions.push(`p.customer_id = $${paramIndex}`);
        params.push(customerId);
        paramIndex += 1;
    }

    const orderId = requestQuery.order_id ?? requestQuery.orderId;
    if (orderId) {
        conditions.push(`p.order_id = $${paramIndex}`);
        params.push(orderId);
        paramIndex += 1;
    }

    const orderOnlyRaw = requestQuery.order_only ?? requestQuery.orderOnly;
    const method = requestQuery.method ?? requestQuery.payment_method_type ?? requestQuery.paymentMethodType;
    if (method) {
        conditions.push(`lower(coalesce(p.payment_method_type, '')) = $${paramIndex}`);
        params.push(String(method).trim().toLowerCase());
        paramIndex += 1;
    }

    const storeId = requestQuery.store_id ?? requestQuery.warehouse_id ?? requestQuery.warehouseId;
    if (storeId) {
        conditions.push(`o.warehouse_id = $${paramIndex}`);
        params.push(storeId);
        paramIndex += 1;
    }

    const markedBy = requestQuery.marked_by ?? requestQuery.creator_id ?? requestQuery.creatorId;
    if (markedBy) {
        conditions.push(`p.creator_id = $${paramIndex}`);
        params.push(markedBy);
        paramIndex += 1;
    }

    const customerSearch = requestQuery.customer ?? requestQuery.customer_name ?? requestQuery.customerName;
    if (customerSearch) {
        conditions.push(
            `(lower(coalesce(cu.first_name, '') || ' ' || coalesce(cu.last_name, '')) LIKE $${paramIndex} OR lower(coalesce(cu.email, '')) LIKE $${paramIndex})`
        );
        params.push(`%${String(customerSearch).trim().toLowerCase()}%`);
        paramIndex += 1;
    }

    const orderSearch = requestQuery.order ?? requestQuery.order_number ?? requestQuery.orderNumber;
    if (orderSearch) {
        conditions.push(`(lower(coalesce(o.order_number, '')) LIKE $${paramIndex} OR lower(coalesce(p.order_id, '')) LIKE $${paramIndex})`);
        params.push(`%${String(orderSearch).trim().toLowerCase()}%`);
        paramIndex += 1;
    }

    const sortByRaw = String(requestQuery.sort_by ?? requestQuery.sortBy ?? "created_at").trim().toLowerCase();
    const sortDirRaw = String(requestQuery.sort_dir ?? requestQuery.sortDir ?? "desc").trim().toLowerCase();
    const sortDir = sortDirRaw === "asc" ? "ASC" : "DESC";
    const SORT_MAP = {
        created_at: "p.created_at",
        amount: "p.amount",
        status: "p.status",
        method: "p.payment_method_type",
    };
    const sortBy = SORT_MAP[sortByRaw] || SORT_MAP.created_at;

    const orderOnly = String(orderOnlyRaw || "").trim().toLowerCase();
    if (orderOnly === "true" || orderOnly === "1") {
        conditions.push(`p.order_id IS NOT NULL`);
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT p.id, p.amount, p.subscription_id, p.customer_id, p.order_id, p.payment_method_type, p.payment_number, p.transaction_ref, p.status, p.created_at,
               o.order_number, o.warehouse_id, w.name AS warehouse_name,
               p.creator_id,
               u.first_name AS creator_first_name, u.last_name AS creator_last_name,
               cu.id AS customer_user_id, cu.first_name AS customer_first_name, cu.last_name AS customer_last_name, cu.email AS customer_email
        FROM payments p
        LEFT JOIN orders o ON p.order_id = o.id
        LEFT JOIN warehouses w ON o.warehouse_id = w.id
        LEFT JOIN users u ON p.creator_id = u.id
        LEFT JOIN customer_profiles cp ON o.customer_profile_id = cp.id
        LEFT JOIN users cu ON cp.user_id = cu.id
        WHERE ${where}
        ORDER BY ${sortBy} ${sortDir}
    `;
    const result = await pool.query(query, params);
    return result.rows;
};

/**
 * List payments for a tenant. Caller must ensure user.tenant_id === tenant_id for authorization.
 */
export const getPaymentsByTenantIdService = async (user, tenant_id, requestQuery = {}) => {
    return getPaymentsHistoryService({ tenant_id }, requestQuery);
};

export const getPaymentsByCustomerIdService = async (user, customer_id, requestQuery = {}) => {
    const conditions = ["p.tenant_id = $1", "p.customer_id = $2"];
    const params = [user.tenant_id, customer_id];
    let paramIndex = 3;

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`p.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const status = requestQuery.status;
    if (status !== undefined && status !== null && status !== "") {
        conditions.push(`p.status = $${paramIndex}`);
        params.push(String(status).trim());
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT p.id, p.amount, p.payment_method_type, p.payment_number, p.transaction_ref, p.status, p.created_at,
               u.first_name AS creator_first_name, u.last_name AS creator_last_name
        FROM payments p
        LEFT JOIN users u ON p.creator_id = u.id
        WHERE ${where}
        ORDER BY p.created_at DESC
    `;
    const result = await pool.query(query, params);
    return result.rows;
};

export const getPaymentByIdService = async (id, tenant_id) => {
    const result = await pool.query(
        `SELECT p.*, u.first_name AS creator_first_name, u.last_name AS creator_last_name,
                o.order_number, o.status AS order_status, o.payment_status AS order_payment_status,
                o.created_at AS ordered_at,
                o.warehouse_id, w.name AS warehouse_name,
                cu.id AS customer_user_id, cu.first_name AS customer_first_name, cu.last_name AS customer_last_name, cu.email AS customer_email
         FROM payments p
         LEFT JOIN users u ON p.creator_id = u.id
         LEFT JOIN orders o ON p.order_id = o.id
         LEFT JOIN warehouses w ON o.warehouse_id = w.id
         LEFT JOIN customer_profiles cp ON o.customer_profile_id = cp.id
         LEFT JOIN users cu ON cp.user_id = cu.id
         WHERE p.id = $1 AND p.tenant_id = $2`,
        [id, tenant_id]
    );
    return result.rows[0];
};

export const logPaymentEventService = async ({
    payment_id,
    order_id = null,
    tenant_id,
    actor_user_id = null,
    event_type,
    note = null,
    metadata = null,
}) => {
    if (!payment_id || !tenant_id || !event_type) return null;
    const id = uuidv4();
    await pool.query(
        `INSERT INTO payment_events (id, payment_id, order_id, tenant_id, actor_user_id, event_type, note, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now())`,
        [id, payment_id, order_id, tenant_id, actor_user_id, event_type, note, metadata ? JSON.stringify(metadata) : null]
    );
    return id;
};

export const getPaymentEventsService = async (paymentId, tenantId) => {
    const result = await pool.query(
        `SELECT pe.id, pe.payment_id, pe.order_id, pe.actor_user_id, pe.event_type, pe.note, pe.metadata, pe.created_at,
                u.first_name AS actor_first_name, u.last_name AS actor_last_name
         FROM payment_events pe
         LEFT JOIN users u ON pe.actor_user_id = u.id
         WHERE pe.payment_id = $1 AND pe.tenant_id = $2
         ORDER BY pe.created_at ASC`,
        [paymentId, tenantId]
    );
    return result.rows;
};

export const getPaymentReceiptService = async (paymentId, tenantId) => {
    const payment = await getPaymentByIdService(paymentId, tenantId);
    if (!payment) return null;
    const events = await getPaymentEventsService(paymentId, tenantId);
    return { ...payment, events };
};

export const createPaymentService = async (payload) => {
    const { amount, subscription_id, customer_id, order_id, tenant_id, creator_id, payment_method_type, transaction_ref, payment_number, status } = payload;
    const id = uuidv4();
    const computedTransactionRef = transaction_ref || (await createUniqueTransactionRef(payment_method_type));
    await pool.query(
        `INSERT INTO payments (id, amount, subscription_id, customer_id, order_id, tenant_id, creator_id, payment_method_type, payment_number, transaction_ref, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
        [id, amount ?? 0, subscription_id || null, customer_id || null, order_id || null, tenant_id, creator_id, payment_method_type || null, payment_number || null, computedTransactionRef, status || "pending", new Date()]
    );
    await logPaymentEventService({
        payment_id: id,
        order_id: order_id || null,
        tenant_id,
        actor_user_id: creator_id || null,
        event_type: "payment_recorded",
        note: `Payment recorded with status ${status || "pending"}.`,
        metadata: { amount: amount ?? 0, payment_method_type: payment_method_type || null },
    });
    return getPaymentByIdService(id, tenant_id);
};

/** Create a pending payment and return id + reference for checkout flow. Reference is short for gateway (e.g. Paystack). */
export const createPendingPaymentForCheckoutService = async (payload) => {
    let { amount, subscription_id, customer_id, order_id, tenant_id, creator_id, payment_method_type, quote_id } = payload;
    if (!subscription_id && !order_id && tenant_id) {
        const tenantRow = await pool.query(
            "SELECT subscription_id FROM tenants WHERE id = $1",
            [tenant_id]
        );
        subscription_id = tenantRow.rows[0]?.subscription_id ?? null;
    }
    const id = uuidv4();
    const transaction_ref = await createUniqueTransactionRef(payment_method_type);
    await pool.query(
        `INSERT INTO payments (id, amount, subscription_id, customer_id, order_id, tenant_id, creator_id, payment_method_type, payment_number, transaction_ref, status, quote_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, $10, $11, $12, $12)`,
        [
            id,
            amount ?? 0,
            subscription_id || null,
            customer_id || null,
            order_id || null,
            tenant_id,
            creator_id,
            payment_method_type || null,
            transaction_ref,
            "pending",
            quote_id || null,
            new Date(),
        ]
    );
    await logPaymentEventService({
        payment_id: id,
        order_id: order_id || null,
        tenant_id,
        actor_user_id: creator_id || null,
        event_type: "payment_initiated",
        note: `Payment initiated via ${payment_method_type || "unknown"}.`,
        metadata: {
            transaction_ref,
            amount: amount ?? 0,
            payment_method_type: payment_method_type || null,
            quote_id: quote_id || null,
        },
    });
    return { id, transaction_ref };
};

/** Get payment by gateway transaction reference and tenant (for verify/submit-otp and webhook). */
export const getPaymentByTransactionRefService = async (transaction_ref, tenant_id) => {
    const result = await pool.query(
        `SELECT id, amount, tenant_id, transaction_ref, status, order_id, subscription_id
         FROM payments WHERE transaction_ref = $1 AND tenant_id = $2`,
        [transaction_ref, tenant_id]
    );
    return result.rows[0];
};

/** Webhook: resolve payment row by reference only (reference should be unique). */
export const getPaymentByTransactionRefGlobalService = async (transaction_ref) => {
    const result = await pool.query(
        `SELECT id, amount, tenant_id, transaction_ref, status, order_id, subscription_id
         FROM payments WHERE transaction_ref = $1 LIMIT 1`,
        [transaction_ref]
    );
    return result.rows[0];
};

export const amountsMatchOrderTotal = (paymentAmount, orderTotal) => {
    const a = Number(paymentAmount);
    const b = Number(orderTotal);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return Math.abs(a - b) <= 0.02;
};

/**
 * After gateway reports success for a subscription (non-order) payment: activate pending tenant plan.
 * Idempotent when subscription is already active.
 */
export const syncSubscriptionPaymentAfterSuccess = async (transaction_ref, tenant_id = null) => {
    const paymentRes = tenant_id
        ? await pool.query(
              `SELECT p.id, p.order_id, p.subscription_id, p.tenant_id, t.subscription_id AS tenant_subscription_id
               FROM payments p
               LEFT JOIN tenants t ON t.id = p.tenant_id
               WHERE p.transaction_ref = $1 AND p.tenant_id = $2
               LIMIT 1`,
              [transaction_ref, tenant_id]
          )
        : await pool.query(
              `SELECT p.id, p.order_id, p.subscription_id, p.tenant_id, t.subscription_id AS tenant_subscription_id
               FROM payments p
               LEFT JOIN tenants t ON t.id = p.tenant_id
               WHERE p.transaction_ref = $1
               LIMIT 1`,
              [transaction_ref]
          );
    const payment = paymentRes.rows[0];
    if (!payment?.tenant_id) return null;
    if (payment.order_id) return null;

    const subscriptionId = payment.subscription_id || payment.tenant_subscription_id;
    if (!subscriptionId) return null;

    const activated = await activatePendingSubscriptionService(subscriptionId, payment.tenant_id);
    await logPaymentEventService({
        payment_id: payment.id,
        order_id: null,
        tenant_id: payment.tenant_id,
        actor_user_id: null,
        event_type: "subscription_activated",
        note: activated?.upgrade_bonus_days
            ? `Subscription activated with ${activated.upgrade_bonus_days} bonus day(s) from plan upgrade credit.`
            : "Subscription activated after successful payment.",
        metadata: {
            transaction_ref,
            subscription_id: subscriptionId,
            upgrade_bonus_days: activated?.upgrade_bonus_days ?? 0,
        },
    });
    return activated;
};

/**
 * Onboarding quote checkout: mark quote paid and create merchant commission rows.
 */
export const syncOnboardingQuotePaymentAfterSuccess = async (transaction_ref, tenant_id = null) => {
    const paymentRes = tenant_id
        ? await pool.query(
              `SELECT p.id, p.quote_id, p.tenant_id FROM payments p
               WHERE p.transaction_ref = $1 AND p.tenant_id = $2 AND p.quote_id IS NOT NULL LIMIT 1`,
              [transaction_ref, tenant_id]
          )
        : await pool.query(
              `SELECT p.id, p.quote_id, p.tenant_id FROM payments p
               WHERE p.transaction_ref = $1 AND p.quote_id IS NOT NULL LIMIT 1`,
              [transaction_ref]
          );
    const payment = paymentRes.rows[0];
    if (!payment?.quote_id) return null;

    const quote = await getOnboardingQuoteByIdService(payment.quote_id);
    if (!quote || quote.status === "paid") {
        if (quote?.status === "paid") return quote;
        return null;
    }

    await markQuotePaidService(payment.quote_id);

    if (quote.merchant_id) {
        await finalizeMerchantCommissionForQuoteService(
            payment.quote_id,
            quote.merchant_id,
            quote.tenant_id,
            quote.subscription_id
        );
    }

    return quote;
};

/** Run order + subscription + onboarding quote side effects after Paystack success. */
export const applyPaymentGatewaySuccess = async (transaction_ref, tenant_id = null) => {
    await syncOrderPaymentAfterSuccess(transaction_ref, tenant_id);
    await syncOnboardingQuotePaymentAfterSuccess(transaction_ref, tenant_id);
    await syncSubscriptionPaymentAfterSuccess(transaction_ref, tenant_id);
};

/** After gateway reports success: apply full or partial order payment. Idempotent. */
export const syncOrderPaymentAfterSuccess = async (transaction_ref, tenant_id) => {
    const payment = tenant_id
        ? await getPaymentByTransactionRefService(transaction_ref, tenant_id)
        : await getPaymentByTransactionRefGlobalService(transaction_ref);
    if (!payment?.order_id || !payment.tenant_id) return null;

    const ord = await pool.query(
        `SELECT id, total_amount, payment_status, payment_mode, amount_paid, balance_due
         FROM orders WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [payment.order_id, payment.tenant_id]
    );
    const row = ord.rows[0];
    if (!row) return null;
    if (String(row.payment_status || "").toLowerCase() === "paid") return row;

    const paymentMode = String(row.payment_mode || "full").toLowerCase();

    if (paymentMode === "installment") {
        const ledger = await pool.query(
            `SELECT id, status, amount FROM order_installment_payments
             WHERE payments_id = $1 AND order_id = $2 AND tenant_id = $3 LIMIT 1`,
            [payment.id, payment.order_id, payment.tenant_id]
        );
        const ledgerRow = ledger.rows[0];
        if (!ledgerRow) return null;
        if (ledgerRow.status === "completed") return row;

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(
                `UPDATE order_installment_payments
                 SET status = 'completed', completed_at = now()
                 WHERE id = $1`,
                [ledgerRow.id]
            );
            const { fullyPaid } = await applyOrderPartialPayment(
                client,
                payment.order_id,
                payment.tenant_id,
                ledgerRow.amount
            );
            await client.query("COMMIT");

            if (fullyPaid) {
                const customer = await pool.query(
                    `SELECT cp.user_id, o.order_number
                     FROM orders o
                     LEFT JOIN customer_profiles cp ON cp.id = o.customer_profile_id
                     WHERE o.id = $1 AND o.tenant_id = $2 LIMIT 1`,
                    [payment.order_id, payment.tenant_id]
                );
                const cust = customer.rows[0];
                await createNotificationService({
                    tenant_id: payment.tenant_id,
                    user_id: cust?.user_id ?? null,
                    type: "order_payment_paid",
                    title: `Payment complete for ${cust?.order_number || "order"}`,
                    message: "Your order balance is fully paid. The store can prepare it for pickup or delivery.",
                    mobile_screen: "MyOrderDetails",
                    mobile_params: { order_id: payment.order_id, payment_status: "paid" },
                }).catch(() => null);
            }
            return { id: payment.order_id, payment_status: fullyPaid ? "paid" : "installment_active" };
        } catch (e) {
            await client.query("ROLLBACK");
            throw e;
        } finally {
            client.release();
        }
    }

    if (!amountsMatchOrderTotal(payment.amount, row.total_amount)) return null;

    const upd = await pool.query(
        `UPDATE orders SET payment_status = 'paid', amount_paid = total_amount, balance_due = 0, updated_at = now()
         WHERE id = $1 AND tenant_id = $2 AND lower(coalesce(payment_status, '')) <> 'paid'
         RETURNING id, payment_status`,
        [payment.order_id, payment.tenant_id]
    );
    const updatedOrder = upd.rows[0] ?? null;
    if (updatedOrder) {
        await logPaymentEventService({
            payment_id: payment.id,
            order_id: payment.order_id,
            tenant_id: payment.tenant_id,
            actor_user_id: null,
            event_type: "payment_success",
            note: "Payment confirmed as successful.",
            metadata: { transaction_ref },
        });
        const customer = await pool.query(
            `SELECT cp.user_id, o.order_number
             FROM orders o
             LEFT JOIN customer_profiles cp ON cp.id = o.customer_profile_id
             WHERE o.id = $1 AND o.tenant_id = $2 LIMIT 1`,
            [payment.order_id, payment.tenant_id]
        );
        const cust = customer.rows[0];
        await createNotificationService({
            tenant_id: payment.tenant_id,
            user_id: cust?.user_id ?? null,
            type: "order_payment_paid",
            title: `Payment received for ${cust?.order_number || "order"}`,
            message: "Your order payment is now marked as paid.",
            mobile_screen: "MyOrderDetails",
            mobile_params: { order_id: payment.order_id, payment_status: "paid" },
        }).catch(() => null);
    }
    return updatedOrder;
};

/** After gateway reports failure: mark order payment failed so customer can retry (when not already paid). */
export const syncOrderPaymentAfterFailure = async (transaction_ref) => {
    const payment = await getPaymentByTransactionRefGlobalService(transaction_ref);
    if (!payment?.order_id || !payment.tenant_id) return null;

    await pool.query(
        `UPDATE orders SET payment_status = 'failed', updated_at = now()
         WHERE id = $1 AND tenant_id = $2
           AND lower(coalesce(payment_status, '')) NOT IN ('paid')`,
        [payment.order_id, payment.tenant_id]
    );
    await logPaymentEventService({
        payment_id: payment.id,
        order_id: payment.order_id,
        tenant_id: payment.tenant_id,
        actor_user_id: null,
        event_type: "payment_failed",
        note: "Payment failed at gateway.",
        metadata: { transaction_ref },
    });
    const customer = await pool.query(
        `SELECT cp.user_id, o.order_number
         FROM orders o
         LEFT JOIN customer_profiles cp ON cp.id = o.customer_profile_id
         WHERE o.id = $1 AND o.tenant_id = $2 LIMIT 1`,
        [payment.order_id, payment.tenant_id]
    );
    const row = customer.rows[0];
    await createNotificationService({
        tenant_id: payment.tenant_id,
        user_id: row?.user_id ?? null,
        type: "order_payment_failed",
        title: `Payment update for ${row?.order_number || "order"}`,
        message: "Payment failed. Please retry your payment.",
        mobile_screen: "MyOrderDetails",
        mobile_params: { order_id: payment.order_id, payment_status: "failed" },
    }).catch(() => null);
    return payment.order_id;
};

/** Update payment status by transaction reference (for webhook and after verify). */
export const updatePaymentStatusByTransactionRefService = async (transaction_ref, status) => {
    const result = await pool.query(
        "UPDATE payments SET status = $1, updated_at = $2 WHERE transaction_ref = $3 RETURNING id, order_id, tenant_id, creator_id",
        [status, new Date(), transaction_ref]
    );
    const row = result.rowCount > 0 ? result.rows[0] : null;
    if (row) {
        await logPaymentEventService({
            payment_id: row.id,
            order_id: row.order_id || null,
            tenant_id: row.tenant_id,
            actor_user_id: row.creator_id || null,
            event_type: `payment_status_${String(status || "updated").toLowerCase()}`,
            note: `Payment status changed to ${status}.`,
            metadata: { transaction_ref, status },
        });
    }
    return row;
};

export const reverseCashOrderPaymentService = async (user, paymentId, reason = "") => {
    const payment = await getPaymentByIdService(paymentId, user.tenant_id);
    if (!payment) throw new Error("Payment not found.");
    if (!payment.order_id) throw new Error("Only order-linked cash payments can be reversed.");
    const method = String(payment.payment_method_type || "").toLowerCase();
    if (method !== "cash") throw new Error("Only cash payments can be reversed.");
    const status = String(payment.status || "").toLowerCase();
    if (!["success", "paid", "completed"].includes(status)) {
        throw new Error("Only successful cash payments can be reversed.");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `UPDATE payments
             SET status = 'voided', updated_at = now()
             WHERE id = $1 AND tenant_id = $2`,
            [paymentId, user.tenant_id]
        );

        const stillPaid = await client.query(
            `SELECT 1
             FROM payments
             WHERE order_id = $1
               AND tenant_id = $2
               AND id <> $3
               AND lower(coalesce(status, '')) IN ('success','paid','completed')
             LIMIT 1`,
            [payment.order_id, user.tenant_id, paymentId]
        );
        const nextOrderStatus = stillPaid.rowCount > 0 ? "paid" : "unpaid";
        await client.query(
            `UPDATE orders
             SET payment_status = $1, updated_at = now()
             WHERE id = $2 AND tenant_id = $3`,
            [nextOrderStatus, payment.order_id, user.tenant_id]
        );
        await client.query("COMMIT");

        await logPaymentEventService({
            payment_id: paymentId,
            order_id: payment.order_id,
            tenant_id: user.tenant_id,
            actor_user_id: user.id,
            event_type: "cash_payment_reversed",
            note: reason ? `Cash payment reversed: ${reason}` : "Cash payment reversed by staff.",
            metadata: { previous_status: status, new_status: "voided" },
        });

        await createNotificationService({
            tenant_id: user.tenant_id,
            user_id: payment.customer_user_id || null,
            type: "order_payment_reversed",
            title: `Payment reversed for ${payment.order_number || "order"}`,
            message: reason
                ? `A staff member reversed a cash payment. Reason: ${reason}`
                : "A staff member reversed a cash payment entry.",
            mobile_screen: "MyOrderDetails",
            mobile_params: { order_id: payment.order_id, payment_status: nextOrderStatus },
        }).catch(() => null);

        return getPaymentReceiptService(paymentId, user.tenant_id);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
