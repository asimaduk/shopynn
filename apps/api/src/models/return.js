import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { applyStoreCreditEntry, toMoney } from "./storeCredit.js";
import { refundTransaction } from "../services/paymentGateway.js";
import { salePaymentStatusFromAmounts } from "./saleCredit.js";

const COMPLETED = "completed";

function httpError(message, status = 400, code = null) {
    const err = new Error(message);
    err.status = status;
    if (code) err.code = code;
    return err;
}

function normalizeRefundMethod(raw) {
    const m = String(raw || "").trim().toLowerCase();
    if (m === "cash" || m === "momo" || m === "store_credit" || m === "credit") {
        return m === "credit" ? "store_credit" : m;
    }
    return null;
}

/**
 * List returns history with optional filters.
 */
export const getReturnsHistoryService = async (user, requestQuery = {}) => {
    const conditions = ["r.tenant_id = $1"];
    const params = [user.tenant_id];
    let paramIndex = 2;

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`r.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const warehouseId = requestQuery.warehouse_id ?? requestQuery.warehouseId;
    if (warehouseId) {
        conditions.push(`r.warehouse_id = $${paramIndex}`);
        params.push(warehouseId);
        paramIndex += 1;
    }

    const status = requestQuery.status;
    if (status !== undefined && status !== null && status !== "") {
        conditions.push(`r.status = $${paramIndex}`);
        params.push(String(status).trim());
        paramIndex += 1;
    }

    const search = requestQuery.name ?? requestQuery.search ?? requestQuery.q;
    if (search && String(search).trim()) {
        const term = `%${String(search).trim()}%`;
        conditions.push(
            `(r.reference_number ILIKE $${paramIndex} OR r.notes ILIKE $${paramIndex} OR r.reason ILIKE $${paramIndex})`
        );
        params.push(term);
        paramIndex += 1;
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT r.id, r.reference_number, r.sale_id, r.order_id, r.customer_id, r.warehouse_id,
               r.status, r.total_amount, r.refund_method, r.refund_amount, r.refund_status,
               r.reason, r.notes, r.created_at,
               w.name AS warehouse_name,
               c.name AS customer_name,
               s.invoice_number AS sale_invoice_number,
               o.order_number AS order_number,
               u.first_name AS creator_first_name, u.last_name AS creator_last_name,
               (SELECT COALESCE(SUM(rd.quantity), 0) FROM return_details rd WHERE rd.return_id = r.id) AS items_count
        FROM returns r
        LEFT JOIN warehouses w ON r.warehouse_id = w.id
        LEFT JOIN customers c ON r.customer_id = c.id
        LEFT JOIN sales s ON r.sale_id = s.id
        LEFT JOIN orders o ON r.order_id = o.id
        LEFT JOIN users u ON r.creator_id = u.id
        WHERE ${where}
        ORDER BY r.created_at DESC
    `;
    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
        ...row,
        total_amount: toMoney(row.total_amount),
        refund_amount: toMoney(row.refund_amount),
        type: row.order_id ? "order" : "sales",
        items: Number(row.items_count) || 0,
    }));
};

export const getReturnByIdService = async (id, tenant_id) => {
    const result = await pool.query(
        `SELECT r.*, w.name AS warehouse_name, c.name AS customer_name,
                s.invoice_number AS sale_invoice_number,
                o.order_number AS order_number
         FROM returns r
         LEFT JOIN warehouses w ON r.warehouse_id = w.id
         LEFT JOIN customers c ON r.customer_id = c.id
         LEFT JOIN sales s ON r.sale_id = s.id
         LEFT JOIN orders o ON r.order_id = o.id
         WHERE r.id = $1 AND r.tenant_id = $2`,
        [id, tenant_id]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
        ...row,
        total_amount: toMoney(row.total_amount),
        refund_amount: toMoney(row.refund_amount),
        type: row.order_id ? "order" : "sales",
    };
};

export const getReturnDetailsService = async (return_id, tenant_id) => {
    const result = await pool.query(
        `SELECT rd.id, rd.quantity, rd.unit_price, rd.line_total, rd.reason, rd.notes,
                rd.restock, rd.write_off_reason, rd.sale_detail_id, rd.order_item_id,
                p.id AS product_id, p.name AS product_name, p.sku
         FROM return_details rd
         JOIN returns r ON rd.return_id = r.id AND r.tenant_id = $2
         LEFT JOIN products p ON rd.product_id = p.id
         WHERE rd.return_id = $1
         ORDER BY rd.created_at ASC`,
        [return_id, tenant_id]
    );
    return result.rows.map((row) => ({
        ...row,
        quantity: Number(row.quantity) || 0,
        unit_price: toMoney(row.unit_price),
        line_total: toMoney(row.line_total != null ? row.line_total : toMoney(row.unit_price) * Number(row.quantity || 0)),
        restock: row.restock !== false,
    }));
};

async function alreadyReturnedQty(client, { saleDetailId, orderItemId }) {
    if (saleDetailId) {
        const r = await client.query(
            `SELECT COALESCE(SUM(rd.quantity), 0)::numeric AS qty
             FROM return_details rd
             JOIN returns r ON r.id = rd.return_id
             WHERE rd.sale_detail_id = $1 AND r.status = $2`,
            [saleDetailId, COMPLETED]
        );
        return Number(r.rows[0]?.qty) || 0;
    }
    if (orderItemId) {
        const r = await client.query(
            `SELECT COALESCE(SUM(rd.quantity), 0)::numeric AS qty
             FROM return_details rd
             JOIN returns r ON r.id = rd.return_id
             WHERE rd.order_item_id = $1 AND r.status = $2`,
            [orderItemId, COMPLETED]
        );
        return Number(r.rows[0]?.qty) || 0;
    }
    return 0;
}

/** Returnable lines for a POS sale. */
export const getSaleReturnableLinesService = async (user, saleId) => {
    const saleRes = await pool.query(
        `SELECT s.id, s.invoice_number, s.customer_id, s.warehouse_id, s.total_amount,
                s.amount_paid, s.balance_due, s.payment_status, s.payment_reference, s.payment_number,
                c.name AS customer_name, c.phone AS customer_phone, c.store_credit_balance
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         WHERE s.id = $1 AND s.tenant_id = $2`,
        [saleId, user.tenant_id]
    );
    const sale = saleRes.rows[0];
    if (!sale) return null;

    const linesRes = await pool.query(
        `SELECT sd.id AS sale_detail_id, sd.product_id, sd.quantity, sd.unit_price, sd.warehouse_id,
                p.name AS product_name, p.sku, p.thumbnail,
                COALESCE((
                    SELECT SUM(rd.quantity) FROM return_details rd
                    JOIN returns r ON r.id = rd.return_id
                    WHERE rd.sale_detail_id = sd.id AND r.status = 'completed'
                ), 0)::numeric AS returned_qty
         FROM saledetails sd
         LEFT JOIN products p ON p.id = sd.product_id
         WHERE sd.sale_id = $1
         ORDER BY sd.created_at ASC`,
        [saleId]
    );

    const lines = linesRes.rows.map((row) => {
        const sold = Number(row.quantity) || 0;
        const returned = Number(row.returned_qty) || 0;
        const returnable = Math.max(0, sold - returned);
        return {
            sale_detail_id: row.sale_detail_id,
            product_id: row.product_id,
            product_name: row.product_name,
            sku: row.sku,
            thumbnail: row.thumbnail,
            unit_price: toMoney(row.unit_price),
            quantity_sold: sold,
            quantity_returned: returned,
            returnable_qty: returnable,
            warehouse_id: row.warehouse_id || sale.warehouse_id,
        };
    });

    const momoPayment = await pool.query(
        `SELECT id, transaction_ref, status, face_amount, amount, payment_method_type
         FROM payments
         WHERE sale_id = $1 AND tenant_id = $2
           AND LOWER(COALESCE(status,'')) = 'success'
           AND transaction_ref IS NOT NULL
           AND LOWER(COALESCE(payment_method_type,'')) IN ('mobile_money', 'momo', 'card')
         ORDER BY created_at DESC LIMIT 1`,
        [saleId, user.tenant_id]
    );

    const face = toMoney(momoPayment.rows[0]?.face_amount ?? momoPayment.rows[0]?.amount);
    const priorRefunds = momoPayment.rows[0]
        ? await pool.query(
              `SELECT COALESCE(SUM(refund_amount), 0)::numeric AS refunded
               FROM returns
               WHERE tenant_id = $1 AND sale_id = $2
                 AND LOWER(COALESCE(refund_method,'')) = 'momo'
                 AND LOWER(COALESCE(refund_status,'')) IN ('completed', 'pending')
                 AND status = 'completed'`,
              [user.tenant_id, saleId]
          )
        : { rows: [{ refunded: 0 }] };
    const refundedSoFar = toMoney(priorRefunds.rows[0]?.refunded);
    const refundableFace = toMoney(Math.max(0, face - refundedSoFar));

    return {
        sale: {
            id: sale.id,
            invoice_number: sale.invoice_number,
            customer_id: sale.customer_id,
            customer_name: sale.customer_name,
            customer_phone: sale.customer_phone,
            warehouse_id: sale.warehouse_id,
            total_amount: toMoney(sale.total_amount),
            amount_paid: toMoney(sale.amount_paid),
            balance_due: toMoney(sale.balance_due),
            payment_status: sale.payment_status,
            store_credit_balance: toMoney(sale.store_credit_balance),
        },
        lines,
        can_momo_refund: Boolean(momoPayment.rows[0]?.transaction_ref) && refundableFace > 0.02,
        momo_payment: momoPayment.rows[0]
            ? {
                  id: momoPayment.rows[0].id,
                  transaction_ref: momoPayment.rows[0].transaction_ref,
                  face_amount: face,
                  refundable_face_amount: refundableFace,
              }
            : null,
    };
};

/** Returnable lines for a store order. */
export const getOrderReturnableLinesService = async (user, orderId) => {
    const orderRes = await pool.query(
        `SELECT o.id, o.order_number, o.customer_id, o.warehouse_id, o.total_amount,
                o.amount_paid, o.balance_due, o.payment_status, o.status,
                c.name AS customer_name, c.phone AS customer_phone, c.store_credit_balance
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
         WHERE o.id = $1 AND o.tenant_id = $2`,
        [orderId, user.tenant_id]
    );
    const order = orderRes.rows[0];
    if (!order) return null;

    const linesRes = await pool.query(
        `SELECT oi.id AS order_item_id, oi.product_id, oi.quantity, oi.unit_price, oi.line_total, oi.warehouse_id,
                p.name AS product_name, p.sku, p.thumbnail,
                COALESCE((
                    SELECT SUM(rd.quantity) FROM return_details rd
                    JOIN returns r ON r.id = rd.return_id
                    WHERE rd.order_item_id = oi.id AND r.status = 'completed'
                ), 0)::numeric AS returned_qty
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1
         ORDER BY oi.created_at ASC`,
        [orderId]
    );

    const lines = linesRes.rows.map((row) => {
        const sold = Number(row.quantity) || 0;
        const returned = Number(row.returned_qty) || 0;
        const returnable = Math.max(0, sold - returned);
        return {
            order_item_id: row.order_item_id,
            product_id: row.product_id,
            product_name: row.product_name,
            sku: row.sku,
            thumbnail: row.thumbnail,
            unit_price: toMoney(row.unit_price),
            quantity_sold: sold,
            quantity_returned: returned,
            returnable_qty: returnable,
            warehouse_id: row.warehouse_id || order.warehouse_id,
        };
    });

    const momoPayment = await pool.query(
        `SELECT id, transaction_ref, status, face_amount, amount, payment_method_type
         FROM payments
         WHERE order_id = $1 AND tenant_id = $2
           AND LOWER(COALESCE(status,'')) = 'success'
           AND transaction_ref IS NOT NULL
           AND LOWER(COALESCE(payment_method_type,'')) IN ('mobile_money', 'momo', 'card')
         ORDER BY created_at DESC LIMIT 1`,
        [orderId, user.tenant_id]
    );

    const face = toMoney(momoPayment.rows[0]?.face_amount ?? momoPayment.rows[0]?.amount);
    const priorRefunds = momoPayment.rows[0]
        ? await pool.query(
              `SELECT COALESCE(SUM(refund_amount), 0)::numeric AS refunded
               FROM returns
               WHERE tenant_id = $1 AND order_id = $2
                 AND LOWER(COALESCE(refund_method,'')) = 'momo'
                 AND LOWER(COALESCE(refund_status,'')) IN ('completed', 'pending')
                 AND status = 'completed'`,
              [user.tenant_id, orderId]
          )
        : { rows: [{ refunded: 0 }] };
    const refundedSoFar = toMoney(priorRefunds.rows[0]?.refunded);
    const refundableFace = toMoney(Math.max(0, face - refundedSoFar));

    return {
        order: {
            id: order.id,
            order_number: order.order_number,
            customer_id: order.customer_id,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            warehouse_id: order.warehouse_id,
            status: order.status,
            total_amount: toMoney(order.total_amount),
            amount_paid: toMoney(order.amount_paid),
            balance_due: toMoney(order.balance_due),
            payment_status: order.payment_status,
            store_credit_balance: toMoney(order.store_credit_balance),
        },
        lines,
        can_momo_refund: Boolean(momoPayment.rows[0]?.transaction_ref) && refundableFace > 0.02,
        momo_payment: momoPayment.rows[0]
            ? {
                  id: momoPayment.rows[0].id,
                  transaction_ref: momoPayment.rows[0].transaction_ref,
                  face_amount: face,
                  refundable_face_amount: refundableFace,
              }
            : null,
        /** Orders reserve inventory at place-order — default restock on for returned lines. */
        default_restock: true,
    };
};

async function restockProduct(client, { productId, warehouseId, quantity, tenantId, creatorId }) {
    const qty = Number(quantity) || 0;
    if (qty <= 0) return;
    const inv = await client.query(
        `SELECT id, quantity_available FROM inventories
         WHERE product_id = $1 AND warehouse_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [productId, warehouseId]
    );
    if (inv.rowCount) {
        await client.query(
            `UPDATE inventories SET quantity_available = quantity_available + $1, updated_at = $2 WHERE id = $3`,
            [qty, new Date(), inv.rows[0].id]
        );
    } else {
        await client.query(
            `INSERT INTO inventories (
                id, quantity_available, minimum_stock_level, product_id, warehouse_id,
                creator_id, tenant_id, created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [uuidv4(), qty, 10, productId, warehouseId, creatorId || null, tenantId, new Date()]
        );
    }
    await client.query(
        `UPDATE products SET inventory = COALESCE(inventory, 0) + $1, updated_at = $2 WHERE id = $3`,
        [qty, new Date(), productId]
    );
}

/**
 * Create a completed return with stock + refund side effects.
 * Body: sale_id | order_id, details[{sale_detail_id|order_item_id, quantity, restock?, reason?}],
 *       refund_method, refund_amount?, reason?, notes?, reference_number?
 */
export const createReturnService = async (payload) => {
    const tenantId = payload.tenant_id;
    const creatorId = payload.creator_id;
    const saleId = payload.sale_id || payload.saleId || null;
    const orderId = payload.order_id || payload.orderId || null;
    const detailsIn = Array.isArray(payload.details) ? payload.details : [];

    if (!tenantId) throw httpError("tenant_id is required.");
    if (!saleId && !orderId) throw httpError("sale_id or order_id is required.", 400, "SOURCE_REQUIRED");
    if (saleId && orderId) throw httpError("Provide either sale_id or order_id, not both.", 400, "SOURCE_AMBIGUOUS");
    if (!detailsIn.length) throw httpError("At least one return line is required.", 400, "DETAILS_REQUIRED");

    const refundMethod = normalizeRefundMethod(payload.refund_method || payload.refundMethod);
    if (!refundMethod) {
        throw httpError("refund_method must be cash, momo, or store_credit.", 400, "INVALID_REFUND_METHOD");
    }

    const client = await pool.connect();
    let committed = false;
    try {
        await client.query("BEGIN");

        let source;
        let warehouseId;
        let customerId;
        let isSale = Boolean(saleId);

        if (isSale) {
            const r = await client.query(
                `SELECT id, customer_id, warehouse_id, total_amount, amount_paid, balance_due, payment_status
                 FROM sales WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
                [saleId, tenantId]
            );
            source = r.rows[0];
            if (!source) throw httpError("Sale not found.", 404, "SALE_NOT_FOUND");
            warehouseId = payload.warehouse_id || source.warehouse_id;
            customerId = payload.customer_id || source.customer_id;
        } else {
            const r = await client.query(
                `SELECT id, customer_id, warehouse_id, total_amount, amount_paid, balance_due, payment_status, status
                 FROM orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
                [orderId, tenantId]
            );
            source = r.rows[0];
            if (!source) throw httpError("Order not found.", 404, "ORDER_NOT_FOUND");
            const orderStatus = String(source.status || "").toLowerCase();
            if (orderStatus === "cancelled") {
                throw httpError(
                    "Cancelled orders cannot be returned (stock was already released).",
                    400,
                    "ORDER_CANCELLED"
                );
            }
            warehouseId = payload.warehouse_id || source.warehouse_id;
            customerId = payload.customer_id || source.customer_id;
        }

        if (!warehouseId) throw httpError("warehouse_id is required.");

        if (refundMethod === "store_credit" && !customerId) {
            throw httpError("A customer is required for store credit refunds.", 400, "CUSTOMER_REQUIRED_FOR_CREDIT");
        }

        const resolvedLines = [];
        let goodsValue = 0;

        for (const d of detailsIn) {
            const qty = Number(d.quantity);
            if (!Number.isFinite(qty) || qty <= 0) {
                throw httpError("Each line needs a positive quantity.", 400, "INVALID_QTY");
            }

            if (isSale) {
                const detailId = d.sale_detail_id || d.saleDetailId;
                if (!detailId) throw httpError("sale_detail_id is required on each line.", 400, "LINE_ID_REQUIRED");
                const lineRes = await client.query(
                    `SELECT id, product_id, quantity, unit_price, warehouse_id
                     FROM saledetails WHERE id = $1 AND sale_id = $2 FOR UPDATE`,
                    [detailId, saleId]
                );
                const line = lineRes.rows[0];
                if (!line) throw httpError("Sale line not found.", 404, "LINE_NOT_FOUND");
                const prior = await alreadyReturnedQty(client, { saleDetailId: detailId });
                const returnable = Math.max(0, Number(line.quantity) - prior);
                if (qty > returnable + 0.0001) {
                    throw httpError(
                        `Cannot return more than ${returnable} for this line.`,
                        400,
                        "QTY_EXCEEDS_RETURNABLE"
                    );
                }
                const unit = toMoney(d.unit_price != null ? d.unit_price : line.unit_price);
                const lineTotal = toMoney(unit * qty);
                const restock = d.restock === false || d.restock === "false" ? false : true;
                if (!restock && !(d.write_off_reason || d.reason || payload.reason)) {
                    throw httpError("Write-off reason is required when not restocking.", 400, "WRITE_OFF_REASON_REQUIRED");
                }
                resolvedLines.push({
                    sale_detail_id: detailId,
                    order_item_id: null,
                    product_id: line.product_id,
                    quantity: qty,
                    unit_price: unit,
                    line_total: lineTotal,
                    restock,
                    reason: d.reason || payload.reason || null,
                    write_off_reason: restock ? null : (d.write_off_reason || d.reason || payload.reason || null),
                    notes: d.notes || null,
                    warehouse_id: line.warehouse_id || warehouseId,
                });
                goodsValue = toMoney(goodsValue + lineTotal);
            } else {
                const itemId = d.order_item_id || d.orderItemId;
                if (!itemId) throw httpError("order_item_id is required on each line.", 400, "LINE_ID_REQUIRED");
                const lineRes = await client.query(
                    `SELECT id, product_id, quantity, unit_price, line_total, warehouse_id
                     FROM order_items WHERE id = $1 AND order_id = $2 FOR UPDATE`,
                    [itemId, orderId]
                );
                const line = lineRes.rows[0];
                if (!line) throw httpError("Order line not found.", 404, "LINE_NOT_FOUND");
                const prior = await alreadyReturnedQty(client, { orderItemId: itemId });
                const returnable = Math.max(0, Number(line.quantity) - prior);
                if (qty > returnable + 0.0001) {
                    throw httpError(
                        `Cannot return more than ${returnable} for this line.`,
                        400,
                        "QTY_EXCEEDS_RETURNABLE"
                    );
                }
                const unit = toMoney(d.unit_price != null ? d.unit_price : line.unit_price);
                const lineTotal = toMoney(unit * qty);
                // Orders reserve inventory at place-order — default restock on unless explicitly false.
                const restock =
                    d.restock === true || d.restock === "true"
                        ? true
                        : d.restock === false || d.restock === "false"
                          ? false
                          : true;
                if (!restock && !(d.write_off_reason || d.reason || payload.reason)) {
                    throw httpError("Write-off reason is required when not restocking.", 400, "WRITE_OFF_REASON_REQUIRED");
                }
                resolvedLines.push({
                    sale_detail_id: null,
                    order_item_id: itemId,
                    product_id: line.product_id,
                    quantity: qty,
                    unit_price: unit,
                    line_total: lineTotal,
                    restock,
                    reason: d.reason || payload.reason || null,
                    write_off_reason: restock ? null : (d.write_off_reason || d.reason || payload.reason || null),
                    notes: d.notes || null,
                    warehouse_id: line.warehouse_id || warehouseId,
                });
                goodsValue = toMoney(goodsValue + lineTotal);
            }
        }

        let refundAmount =
            payload.refund_amount != null && String(payload.refund_amount).trim() !== ""
                ? toMoney(payload.refund_amount)
                : goodsValue;
        if (refundAmount < 0) refundAmount = 0;
        if (refundAmount > goodsValue + 0.02) {
            throw httpError(
                `Refund cannot exceed returned goods value of GHS ${goodsValue.toFixed(2)}.`,
                400,
                "REFUND_EXCEEDS_GOODS"
            );
        }

        // Allocate: reduce AR first, then remittance from amount paid (capped to gateway face for MoMo)
        const balanceDue = toMoney(source.balance_due);
        const amountPaid = toMoney(source.amount_paid);
        const arReduction = toMoney(Math.min(refundAmount, balanceDue));
        let remittance = toMoney(Math.max(0, refundAmount - arReduction));
        if (remittance > amountPaid + 0.02) {
            remittance = amountPaid;
        }

        let momoOriginal = null;
        let momoRefundableFace = 0;
        if (refundMethod === "momo" && remittance > 0.02) {
            const payRes = await client.query(
                `SELECT id, transaction_ref, status, face_amount, amount, payment_method_type
                 FROM payments
                 WHERE tenant_id = $1
                   AND ${isSale ? "sale_id" : "order_id"} = $2
                   AND LOWER(COALESCE(status,'')) = 'success'
                   AND transaction_ref IS NOT NULL
                   AND LOWER(COALESCE(payment_method_type,'')) IN ('mobile_money', 'momo', 'card')
                 ORDER BY created_at DESC LIMIT 1
                 FOR UPDATE`,
                [tenantId, isSale ? saleId : orderId]
            );
            momoOriginal = payRes.rows[0] || null;
            if (!momoOriginal?.transaction_ref) {
                throw httpError(
                    "MoMo refund requires an original successful MoMo/Paystack payment. Use cash or store credit.",
                    400,
                    "MOMO_REFUND_UNAVAILABLE"
                );
            }
            const face = toMoney(momoOriginal.face_amount ?? momoOriginal.amount);
            const priorRes = await client.query(
                `SELECT COALESCE(SUM(refund_amount), 0)::numeric AS refunded
                 FROM returns
                 WHERE tenant_id = $1
                   AND ${isSale ? "sale_id" : "order_id"} = $2
                   AND LOWER(COALESCE(refund_method,'')) = 'momo'
                   AND LOWER(COALESCE(refund_status,'')) IN ('completed', 'pending')
                   AND status = 'completed'`,
                [tenantId, isSale ? saleId : orderId]
            );
            momoRefundableFace = toMoney(Math.max(0, face - toMoney(priorRes.rows[0]?.refunded)));
            if (remittance > momoRefundableFace + 0.02) {
                remittance = momoRefundableFace;
            }
            if (remittance <= 0.02) {
                throw httpError(
                    `Nothing left to refund via MoMo (gateway face GHS ${face.toFixed(2)} already refunded). Use cash or store credit.`,
                    400,
                    "MOMO_REFUND_EXHAUSTED"
                );
            }
        }

        if (refundMethod === "store_credit" && remittance <= 0.02 && arReduction <= 0.02 && refundAmount > 0.02) {
            // edge: nothing to credit — still OK if only AR reduction
        }

        const returnId = uuidv4();
        const reference =
            payload.reference_number ||
            payload.referenceNumber ||
            `RTN-${Date.now().toString(36).toUpperCase()}`;

        await client.query(
            `INSERT INTO returns (
                id, reference_number, sale_id, order_id, customer_id, warehouse_id,
                tenant_id, creator_id, status, total_amount, refund_method, refund_amount,
                refund_status, reason, notes, created_at, updated_at
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16
            )`,
            [
                returnId,
                reference,
                saleId,
                orderId,
                customerId || null,
                warehouseId,
                tenantId,
                creatorId || null,
                COMPLETED,
                goodsValue,
                refundMethod,
                refundAmount,
                remittance <= 0.02 && arReduction >= refundAmount - 0.02 ? "none" : "pending",
                payload.reason || null,
                payload.notes || null,
                new Date(),
            ]
        );

        for (const line of resolvedLines) {
            const detailId = uuidv4();
            await client.query(
                `INSERT INTO return_details (
                    id, return_id, product_id, quantity, unit_price, line_total, reason, notes,
                    sale_detail_id, order_item_id, restock, write_off_reason, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
                [
                    detailId,
                    returnId,
                    line.product_id,
                    line.quantity,
                    line.unit_price,
                    line.line_total,
                    line.reason,
                    line.notes,
                    line.sale_detail_id,
                    line.order_item_id,
                    line.restock,
                    line.write_off_reason,
                    new Date(),
                ]
            );
            if (line.restock) {
                await restockProduct(client, {
                    productId: line.product_id,
                    warehouseId: line.warehouse_id,
                    quantity: line.quantity,
                    tenantId,
                    creatorId,
                });
            }
        }

        // Update source payment fields
        const newBalance = toMoney(Math.max(0, balanceDue - arReduction));
        const newPaid = toMoney(Math.max(0, amountPaid - remittance));

        if (isSale) {
            const total = toMoney(source.total_amount);
            const payStatus = salePaymentStatusFromAmounts(total, newPaid);
            // If AR cleared via return and paid reduced, prefer status from amounts;
            // when goods returned but we only reduced balance, amount_paid may stay same.
            await client.query(
                `UPDATE sales
                 SET amount_paid = $1, balance_due = $2, payment_status = $3, updated_at = $4
                 WHERE id = $5 AND tenant_id = $6`,
                [newPaid, newBalance, newBalance > 0.02 ? (newPaid > 0.02 ? 2 : 0) : payStatus, new Date(), saleId, tenantId]
            );
        } else {
            const payStatus = newBalance <= 0.02 ? "paid" : newPaid > 0.02 ? "installment_active" : "unpaid";
            await client.query(
                `UPDATE orders
                 SET amount_paid = $1, balance_due = $2, payment_status = $3, updated_at = now()
                 WHERE id = $4 AND tenant_id = $5`,
                [newPaid, newBalance, payStatus, orderId, tenantId]
            );
        }

        let paymentsId = null;
        let refundReference = null;
        let refundStatus = "none";
        let pendingMomoRefund = null;

        if (remittance > 0.02) {
            if (refundMethod === "cash") {
                refundStatus = "completed";
                refundReference = `CASH-REF-${returnId.slice(0, 8)}`;
            } else if (refundMethod === "store_credit") {
                await applyStoreCreditEntry(client, {
                    tenantId,
                    customerId,
                    amount: remittance,
                    entryType: "return_credit",
                    returnId,
                    saleId,
                    orderId,
                    note: `Return ${reference}`,
                    recordedBy: creatorId,
                });
                refundStatus = "completed";
                refundReference = `CREDIT-${returnId.slice(0, 8)}`;
            } else if (refundMethod === "momo") {
                // Do not call Paystack inside the DB transaction — settle after COMMIT.
                paymentsId = momoOriginal.id;
                refundStatus = "pending";
                pendingMomoRefund = {
                    transaction_ref: momoOriginal.transaction_ref,
                    amount: remittance,
                };
            }
        } else {
            refundStatus = "none";
        }

        await client.query(
            `UPDATE returns
             SET refund_status = $1, refund_reference = $2, payments_id = $3, updated_at = $4
             WHERE id = $5`,
            [refundStatus, refundReference, paymentsId, new Date(), returnId]
        );

        await client.query("COMMIT");
        committed = true;

        if (pendingMomoRefund) {
            try {
                const refundResult = await refundTransaction({
                    transaction_ref: pendingMomoRefund.transaction_ref,
                    amount: pendingMomoRefund.amount,
                });
                const statusLc = String(refundResult.status || "").toLowerCase();
                const ok = statusLc !== "failed";
                const nextRef = refundResult.reference || pendingMomoRefund.transaction_ref;
                if (!ok) {
                    await pool.query(
                        `UPDATE returns
                         SET refund_status = 'failed', refund_reference = $1, updated_at = now()
                         WHERE id = $2`,
                        [nextRef, returnId]
                    );
                    if (isSale) {
                        await pool.query(
                            `UPDATE sales
                             SET amount_paid = amount_paid + $1,
                                 balance_due = balance_due + $2,
                                 updated_at = now()
                             WHERE id = $3 AND tenant_id = $4`,
                            [remittance, arReduction, saleId, tenantId]
                        );
                    } else {
                        await pool.query(
                            `UPDATE orders
                             SET amount_paid = amount_paid + $1,
                                 balance_due = balance_due + $2,
                                 updated_at = now()
                             WHERE id = $3 AND tenant_id = $4`,
                            [remittance, arReduction, orderId, tenantId]
                        );
                    }
                    throw httpError(
                        refundResult.message || "MoMo refund failed after return was recorded.",
                        400,
                        "MOMO_REFUND_FAILED"
                    );
                }
                await pool.query(
                    `UPDATE returns
                     SET refund_status = 'completed', refund_reference = $1, updated_at = now()
                     WHERE id = $2`,
                    [nextRef, returnId]
                );
            } catch (e) {
                if (e.code === "MOMO_REFUND_FAILED" || e.status) throw e;
                await pool.query(
                    `UPDATE returns
                     SET refund_status = 'failed', updated_at = now()
                     WHERE id = $1`,
                    [returnId]
                );
                throw httpError(e.message || "MoMo refund failed.", 400, "MOMO_REFUND_FAILED");
            }
        }

        const created = await getReturnByIdService(returnId, tenantId);
        created.details = await getReturnDetailsService(returnId, tenantId);
        created.ar_reduction = arReduction;
        created.remittance = remittance;
        return created;
    } catch (err) {
        if (!committed) {
            await client.query("ROLLBACK").catch(() => null);
        }
        throw err;
    } finally {
        client.release();
    }
};
