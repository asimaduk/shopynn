/**
 * An online order becomes a sale once it is fulfilled and paid, so it counts in Sales, the dashboard,
 * reports and profit. Stock was already taken when the order was placed, so this never touches inventory.
 */
import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import {
    resolvePosCustomerIdForSale,
    resolveUniqueInvoiceNumber,
    resolveProductUnitCost,
} from "./sale.js";
import { toMoney, normalizeSalePaymentMethod, paymentTypeFromMethod } from "./saleCredit.js";

const isFulfilled = (order) => {
    const status = String(order.status || "").toLowerCase();
    if (status === "completed") return true;
    return status === "delivered" && String(order.fulfillment_type || "").toLowerCase() === "delivery";
};

const isPaid = (order) => String(order.payment_status || "").toLowerCase() === "paid";

async function loadOrderPayments(client, order) {
    if (String(order.payment_mode || "").toLowerCase() === "installment") {
        const { rows } = await client.query(
            `SELECT ip.amount, ip.payment_method, ip.payments_id,
                    p.payment_method_type, p.transaction_ref, p.payment_number
             FROM order_installment_payments ip
             LEFT JOIN payments p ON p.id = ip.payments_id
             WHERE ip.order_id = $1 AND ip.tenant_id = $2 AND ip.status = 'completed'
             ORDER BY ip.created_at ASC`,
            [order.id, order.tenant_id]
        );
        return rows.map((r) => ({
            amount: toMoney(r.amount),
            method: r.payment_method_type || (r.payment_method === "checkout_initial" ? "other" : r.payment_method),
            payments_id: r.payments_id || null,
            reference: r.transaction_ref || null,
            number: r.payment_number || null,
        }));
    }
    const { rows } = await client.query(
        `SELECT id, COALESCE(face_amount, amount) AS amount, payment_method_type, transaction_ref, payment_number
         FROM payments
         WHERE order_id = $1 AND tenant_id = $2 AND lower(coalesce(status, '')) = 'success'
         ORDER BY created_at ASC`,
        [order.id, order.tenant_id]
    );
    return rows.map((r) => ({
        amount: toMoney(r.amount),
        method: r.payment_method_type || "other",
        payments_id: r.id,
        reference: r.transaction_ref || null,
        number: r.payment_number || null,
    }));
}

async function resolveSaleCreator(client, order, actorUserId) {
    if (actorUserId) return actorUserId;
    const { rows } = await client.query(
        `SELECT changed_by FROM order_status_history
         WHERE order_id = $1 AND tenant_id = $2 AND to_status IN ('completed', 'delivered') AND changed_by IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`,
        [order.id, order.tenant_id]
    );
    return rows[0]?.changed_by || order.created_by_user_id || null;
}

/** Records the sale for a fulfilled, paid order. Returns the sale id, or null when the order doesn't qualify yet. */
export async function recordSaleForOrderService({ orderId, tenantId, actorUserId = null, saleAt: saleAtIn = null }) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const ordRes = await client.query(
            `SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
            [orderId, tenantId]
        );
        const order = ordRes.rows[0];
        if (!order || !isFulfilled(order) || !isPaid(order)) {
            await client.query("ROLLBACK");
            return null;
        }
        const existing = await client.query(`SELECT id FROM sales WHERE order_id = $1 LIMIT 1`, [orderId]);
        if (existing.rowCount) {
            await client.query("ROLLBACK");
            return existing.rows[0].id;
        }

        const itemsRes = await client.query(
            `SELECT id, product_id, quantity, unit_price, warehouse_id
             FROM order_items WHERE order_id = $1 AND tenant_id = $2
             ORDER BY created_at ASC`,
            [orderId, tenantId]
        );
        if (!itemsRes.rowCount) {
            await client.query("ROLLBACK");
            return null;
        }

        let customerId = order.customer_id || null;
        if (!customerId && order.customer_profile_id) {
            customerId = await resolvePosCustomerIdForSale(client, tenantId, order.customer_profile_id).catch(() => null);
            if (customerId) {
                await client.query(
                    `UPDATE orders SET customer_id = $1 WHERE id = $2 AND tenant_id = $3 AND customer_id IS NULL`,
                    [customerId, orderId, tenantId]
                );
            }
        }

        const creatorId = await resolveSaleCreator(client, order, actorUserId);
        const saleAt = saleAtIn ? new Date(saleAtIn) : new Date();
        const total = toMoney(order.total_amount);
        // Older cash-paid orders can still show 0 paid; a paid order never owes more than its balance.
        const recordedPaid = toMoney(order.amount_paid);
        const amountPaid = recordedPaid > 0.001 ? Math.min(total, recordedPaid) : total;
        const balanceDue = toMoney(Math.max(0, Math.min(total - amountPaid, toMoney(order.balance_due))));
        const paymentStatus = balanceDue > 0.02 ? (amountPaid > 0.02 ? 2 : 0) : 1;
        const numberOfItems = itemsRes.rows.reduce((sum, i) => sum + Number(i.quantity || 0), 0);

        const payments = await loadOrderPayments(client, order);
        const primary = [...payments].sort((a, b) => b.amount - a.amount)[0] || null;
        const primaryMethod = normalizeSalePaymentMethod(primary?.method || "other");

        const saleId = uuidv4();
        const invoiceNumber = await resolveUniqueInvoiceNumber(client, tenantId, order.order_number);
        await client.query(
            `INSERT INTO sales (
                id, number_of_items, total_amount, discount_amount, tenant_id, invoice_number, current_status,
                customer_id, warehouse_id, notes, created_at, creator_id,
                payment_type, payment_number, payment_reference, payment_status, payment_date,
                amount_paid, balance_due, order_id
            ) VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
            [
                saleId,
                numberOfItems,
                total,
                toMoney(order.discount_amount),
                tenantId,
                invoiceNumber,
                customerId,
                order.warehouse_id,
                `Online order ${order.order_number}`,
                saleAt,
                creatorId,
                paymentTypeFromMethod(primaryMethod),
                primary?.number || null,
                primary?.reference || null,
                paymentStatus,
                amountPaid > 0 ? saleAt : null,
                amountPaid,
                balanceDue,
                orderId,
            ]
        );

        let remaining = amountPaid;
        const insertPayment = (amount, method, p) =>
            client.query(
                `INSERT INTO sale_payments (
                    id, sale_id, tenant_id, amount, payment_method, payment_type,
                    payment_number, payment_reference, payments_id, recorded_by, note, created_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
                [
                    uuidv4(),
                    saleId,
                    tenantId,
                    amount,
                    method,
                    paymentTypeFromMethod(method),
                    p?.number || null,
                    p?.reference || null,
                    p?.payments_id || null,
                    creatorId,
                    `Online order ${order.order_number}`,
                    saleAt,
                ]
            );
        for (const p of payments) {
            const amount = toMoney(Math.min(p.amount, remaining));
            if (amount <= 0.001) break;
            await insertPayment(amount, normalizeSalePaymentMethod(p.method), p);
            remaining = toMoney(remaining - amount);
        }
        if (remaining > 0.02) {
            await insertPayment(remaining, "other", null);
        }

        for (const item of itemsRes.rows) {
            const warehouseId = item.warehouse_id || order.warehouse_id;
            const unitCost = await resolveProductUnitCost(client, {
                productId: item.product_id,
                tenantId,
                warehouseId,
                asOfDate: saleAt,
            });
            await client.query(
                `INSERT INTO saledetails (
                    id, sale_id, product_id, quantity, unit_price, unit_cost, warehouse_id,
                    tenant_id, creator_id, created_at, order_item_id
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                [
                    uuidv4(),
                    saleId,
                    item.product_id,
                    item.quantity,
                    item.unit_price,
                    unitCost,
                    warehouseId,
                    tenantId,
                    creatorId,
                    saleAt,
                    item.id,
                ]
            );
        }

        // Returns made on the order before it was paid net off this sale in reports.
        await client.query(
            `UPDATE returns SET sale_id = $1 WHERE order_id = $2 AND tenant_id = $3 AND sale_id IS NULL`,
            [saleId, orderId, tenantId]
        );
        await client.query(
            `UPDATE return_details rd
             SET sale_detail_id = sd.id
             FROM saledetails sd
             WHERE sd.sale_id = $1 AND rd.order_item_id = sd.order_item_id AND rd.sale_detail_id IS NULL`,
            [saleId]
        );

        await client.query("COMMIT");
        return saleId;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Records sales for fulfilled, paid orders that don't have one yet (orders from before sales were
 * recorded, or a live attempt that failed), dated when the order was fulfilled.
 */
export async function backfillOrderSalesService() {
    const { rows } = await pool.query(
        `SELECT o.id, o.tenant_id,
                (SELECT max(h.created_at) FROM order_status_history h
                  WHERE h.order_id = o.id AND h.to_status IN ('completed', 'delivered')) AS fulfilled_at
         FROM orders o
         WHERE lower(coalesce(o.payment_status, '')) = 'paid'
           AND (lower(o.status) = 'completed'
                OR (lower(o.status) = 'delivered' AND lower(o.fulfillment_type) = 'delivery'))
           AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = o.id)
         ORDER BY o.created_at ASC`
    );
    let recorded = 0;
    for (const row of rows) {
        try {
            const id = await recordSaleForOrderService({
                orderId: row.id,
                tenantId: row.tenant_id,
                saleAt: row.fulfilled_at || null,
            });
            if (id) recorded += 1;
        } catch (error) {
            console.error(`[order sale] backfill failed for order ${row.id}:`, error?.message || error);
        }
    }
    if (rows.length) console.log(`[order sale] backfill recorded ${recorded} of ${rows.length} order sale(s).`);
    return recorded;
}

/** Never fails the caller: the order update has already been committed. */
export async function maybeRecordSaleForOrder(orderId, tenantId, actorUserId = null) {
    try {
        return await recordSaleForOrderService({ orderId, tenantId, actorUserId });
    } catch (error) {
        console.error(`[order sale] failed to record sale for order ${orderId}:`, error?.message || error);
        return null;
    }
}
