import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

const DEFAULT_MIN_PARTIAL = 1;

export const normalizePaymentMode = (mode) => String(mode || "full").trim().toLowerCase();

export const isInstallmentOrder = (order) => normalizePaymentMode(order?.payment_mode) === "installment";

export const toMoney = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

export const getOrderBalanceDue = (order) => {
    if (!order) return 0;
    const explicit = order.balance_due;
    if (explicit != null && explicit !== "") return toMoney(explicit);
    return toMoney(toMoney(order.total_amount) - toMoney(order.amount_paid));
};

export async function loadProductsForInstallmentCheck(tenantId, warehouseId, productIds) {
    if (!productIds.length) return [];
    const result = await pool.query(
        `SELECT p.id, p.name, p.installment_enabled,
                coalesce(p.installment_min_initial_percent, 0)::numeric AS installment_min_initial_percent,
                coalesce(p.installment_min_payment_amount, 0)::numeric AS installment_min_payment_amount
         FROM products p
         JOIN inventories inv ON inv.product_id = p.id AND inv.tenant_id = p.tenant_id AND inv.warehouse_id = $2
         WHERE p.tenant_id = $1 AND p.id = ANY($3::varchar[])`,
        [tenantId, warehouseId, productIds]
    );
    return result.rows;
}

export function validateInstallmentCart(products) {
    if (!products.length) throw new Error("Order must include at least one item.");
    const disabled = products.filter((p) => !p.installment_enabled);
    if (disabled.length) {
        const names = disabled.map((p) => p.name).slice(0, 3).join(", ");
        throw new Error(
            `Pay over time requires every item to be eligible. Not eligible: ${names}${disabled.length > 3 ? "…" : ""}`
        );
    }
}

export function computeRequiredInitialPayment(totalAmount, products) {
    let maxPct = 0;
    let minFloor = 0;
    for (const p of products) {
        const pct = Number(p.installment_min_initial_percent);
        if (Number.isFinite(pct) && pct > maxPct) maxPct = pct;
        const floor = Number(p.installment_min_payment_amount);
        if (Number.isFinite(floor) && floor > minFloor) minFloor = floor;
    }
    if (maxPct <= 0) return 0;
    const fromPct = toMoney((totalAmount * maxPct) / 100);
    return toMoney(Math.max(fromPct, minFloor));
}

export function resolveMinPartialPayment(products) {
    let min = DEFAULT_MIN_PARTIAL;
    for (const p of products) {
        const v = Number(p.installment_min_payment_amount);
        if (Number.isFinite(v) && v > min) min = v;
    }
    return toMoney(min);
}

export function validatePartialPaymentAmount(amount, balanceDue, minPartial) {
    const amt = toMoney(amount);
    const balance = toMoney(balanceDue);
    const min = toMoney(minPartial);
    if (balance <= 0) throw new Error("This order is already fully paid.");
    if (amt <= 0) throw new Error("Payment amount must be greater than zero.");
    if (amt < min && amt < balance) {
        throw new Error(`Minimum payment is GHS ${min.toFixed(2)}.`);
    }
    if (amt > balance + 0.02) {
        throw new Error(`Amount cannot exceed remaining balance of GHS ${balance.toFixed(2)}.`);
    }
    return Math.min(amt, balance);
}

export async function getInstallmentPaymentsForOrder(orderId, tenantId) {
    const result = await pool.query(
        `SELECT oip.id, oip.amount, oip.payment_method, oip.status, oip.payments_id,
                oip.recorded_by, oip.note, oip.created_at, oip.completed_at,
                p.transaction_ref, p.status AS gateway_status
         FROM order_installment_payments oip
         LEFT JOIN payments p ON p.id = oip.payments_id
         WHERE oip.order_id = $1 AND oip.tenant_id = $2
         ORDER BY oip.created_at ASC`,
        [orderId, tenantId]
    );
    return result.rows.map((row) => ({
        ...row,
        amount: toMoney(row.amount),
    }));
}

export async function createInstallmentLedgerRow(client, payload) {
    const id = uuidv4();
    const {
        order_id,
        tenant_id,
        amount,
        payment_method,
        status = "pending",
        payments_id = null,
        recorded_by = null,
        note = null,
    } = payload;
    await client.query(
        `INSERT INTO order_installment_payments (
            id, order_id, tenant_id, amount, payment_method, status,
            payments_id, recorded_by, note, created_at, completed_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, now(), CASE WHEN $6 = 'completed' THEN now() ELSE NULL END
        )`,
        [
            id,
            order_id,
            tenant_id,
            toMoney(amount),
            payment_method,
            status,
            payments_id,
            recorded_by,
            note,
        ]
    );
    return id;
}

export async function applyOrderPartialPayment(client, orderId, tenantId, amount) {
    const ordRes = await client.query(
        `SELECT id, total_amount, amount_paid, balance_due, payment_mode, payment_status
         FROM orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [orderId, tenantId]
    );
    const order = ordRes.rows[0];
    if (!order) throw new Error("Order not found.");
    if (!isInstallmentOrder(order)) throw new Error("This order is not on pay-over-time.");

    const payAmount = toMoney(amount);
    const total = toMoney(order.total_amount);
    const newPaid = toMoney(toMoney(order.amount_paid) + payAmount);
    const newBalance = toMoney(Math.max(0, total - newPaid));
    const paymentStatus = newBalance <= 0 ? "paid" : "installment_active";

    const upd = await client.query(
        `UPDATE orders
         SET amount_paid = $1,
             balance_due = $2,
             payment_status = $3,
             updated_at = now()
         WHERE id = $4 AND tenant_id = $5
         RETURNING *`,
        [newPaid, newBalance, paymentStatus, orderId, tenantId]
    );
    return { order: upd.rows[0], newBalance, fullyPaid: newBalance <= 0 };
}

export function enrichOrderInstallmentFields(order, ledgerRows = []) {
    if (!order) return order;
    order.payment_mode = normalizePaymentMode(order.payment_mode);
    order.amount_paid = toMoney(order.amount_paid);
    order.balance_due = getOrderBalanceDue(order);
    order.total_amount = toMoney(order.total_amount);
    order.installment_payments = ledgerRows;
    order.can_pay_partial =
        isInstallmentOrder(order) &&
        order.balance_due > 0 &&
        ["confirmed", "processing", "ready", "shipped", "delivered"].includes(
            String(order.status || "").toLowerCase()
        );
    return order;
}

export function assertFulfillmentAllowedForInstallment(order) {
    if (!isInstallmentOrder(order)) return;
    const balance = getOrderBalanceDue(order);
    if (balance > 0.02) {
        throw new Error(
            `Order cannot move to fulfillment until the balance is paid (GHS ${balance.toFixed(2)} remaining).`
        );
    }
}
