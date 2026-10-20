import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { toMoney } from "./storeCredit.js";
import { getReturnByIdService, getReturnDetailsService } from "./return.js";

const COMPLETED = "completed";

function httpError(message, status = 400, code = null) {
    const err = new Error(message);
    err.status = status;
    if (code) err.code = code;
    return err;
}

/** payment_status: 0=unpaid, 1=paid, 2=partial — mirrors purchase.js. */
function purchasePaymentStatus(netTotal, amountPaid) {
    if (netTotal - amountPaid <= 0.02) return 1;
    return amountPaid > 0.02 ? 2 : 0;
}

async function returnedQtyByPurchaseLine(db, purchaseId) {
    const r = await db.query(
        `SELECT rd.purchase_detail_id, COALESCE(SUM(rd.quantity), 0)::numeric AS qty
         FROM return_details rd
         JOIN returns r ON r.id = rd.return_id
         WHERE r.purchase_id = $1 AND r.status = $2 AND rd.purchase_detail_id IS NOT NULL
         GROUP BY rd.purchase_detail_id`,
        [purchaseId, COMPLETED]
    );
    return new Map(r.rows.map((row) => [row.purchase_detail_id, Number(row.qty) || 0]));
}

/** Lines of a purchase that can still go back to the supplier, capped by what the store still holds. */
export const getPurchaseReturnableLinesService = async (user, purchaseId) => {
    const pRes = await pool.query(
        `SELECT p.id, p.invoice_number, p.supplier_id, p.warehouse_id, p.total_amount, p.discount_amount,
                p.amount_paid, p.payment_status, s.name AS supplier_name, w.name AS warehouse_name
         FROM purchases p
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         LEFT JOIN warehouses w ON w.id = p.warehouse_id
         WHERE p.id = $1 AND p.tenant_id = $2`,
        [purchaseId, user.tenant_id]
    );
    const purchase = pRes.rows[0];
    if (!purchase) return null;

    const linesRes = await pool.query(
        `SELECT pd.id AS purchase_detail_id, pd.product_id, pd.quantity, pd.unit_price,
                COALESCE(pd.warehouse_id, $2) AS warehouse_id,
                pr.name AS product_name, pr.sku, pr.thumbnail,
                COALESCE((
                    SELECT SUM(i.quantity_available) FROM inventories i
                    WHERE i.product_id = pd.product_id AND i.warehouse_id = COALESCE(pd.warehouse_id, $2)
                ), 0)::numeric AS in_stock
         FROM purchasedetails pd
         LEFT JOIN products pr ON pr.id = pd.product_id
         WHERE pd.purchase_id = $1
         ORDER BY pd.created_at ASC`,
        [purchaseId, purchase.warehouse_id]
    );
    const returned = await returnedQtyByPurchaseLine(pool, purchaseId);

    const lines = linesRes.rows.map((row) => {
        const bought = Number(row.quantity) || 0;
        const ret = returned.get(row.purchase_detail_id) || 0;
        const inStock = Math.max(0, Number(row.in_stock) || 0);
        return {
            purchase_detail_id: row.purchase_detail_id,
            product_id: row.product_id,
            product_name: row.product_name,
            sku: row.sku,
            thumbnail: row.thumbnail,
            unit_price: toMoney(row.unit_price),
            quantity_purchased: bought,
            quantity_returned: ret,
            in_stock: inStock,
            returnable_qty: Math.max(0, Math.min(bought - ret, inStock)),
            warehouse_id: row.warehouse_id,
        };
    });

    const total = toMoney(purchase.total_amount);
    const discount = toMoney(purchase.discount_amount);
    const net = toMoney(Math.max(0, total - discount));
    const paid = toMoney(purchase.amount_paid);
    return {
        purchase: {
            id: purchase.id,
            invoice_number: purchase.invoice_number,
            supplier_id: purchase.supplier_id,
            supplier_name: purchase.supplier_name,
            warehouse_id: purchase.warehouse_id,
            warehouse_name: purchase.warehouse_name,
            total_amount: total,
            discount_amount: discount,
            net_total: net,
            amount_paid: paid,
            balance_owed: toMoney(Math.max(0, net - paid)),
            payment_status: purchase.payment_status,
        },
        lines,
    };
};

/**
 * Send goods from a purchase back to the supplier.
 * Stock leaves the purchase's store, the purchase total drops by the returned value, and anything
 * already paid above the new total comes back from the supplier as cash.
 * Body: purchase_id, details[{purchase_detail_id, quantity, reason?}], reason?, notes?, reference_number?
 */
export const createPurchaseReturnService = async (payload) => {
    const tenantId = payload.tenant_id;
    const creatorId = payload.creator_id;
    const purchaseId = payload.purchase_id || payload.purchaseId;
    const detailsIn = Array.isArray(payload.details) ? payload.details : [];

    if (!tenantId) throw httpError("tenant_id is required.");
    if (!purchaseId) throw httpError("purchase_id is required.", 400, "SOURCE_REQUIRED");
    if (!detailsIn.length) throw httpError("At least one return line is required.", 400, "DETAILS_REQUIRED");

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const pRes = await client.query(
            `SELECT id, supplier_id, warehouse_id, total_amount, discount_amount, amount_paid, number_of_items
             FROM purchases WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
            [purchaseId, tenantId]
        );
        const purchase = pRes.rows[0];
        if (!purchase) throw httpError("Purchase not found.", 404, "PURCHASE_NOT_FOUND");

        const returned = await returnedQtyByPurchaseLine(client, purchaseId);
        const seen = new Set();
        const lines = [];
        let goodsValue = 0;
        let unitsOut = 0;

        for (const d of detailsIn) {
            const detailId = d.purchase_detail_id || d.purchaseDetailId;
            if (!detailId) throw httpError("purchase_detail_id is required on each line.", 400, "LINE_ID_REQUIRED");
            if (seen.has(detailId)) throw httpError("Each purchase line can appear once.", 400, "DUPLICATE_LINE");
            seen.add(detailId);

            const qty = Number(d.quantity);
            if (!Number.isFinite(qty) || qty <= 0) {
                throw httpError("Each line needs a positive quantity.", 400, "INVALID_QTY");
            }

            const lineRes = await client.query(
                `SELECT pd.id, pd.product_id, pd.quantity, pd.unit_price, pd.warehouse_id, pr.name AS product_name
                 FROM purchasedetails pd
                 LEFT JOIN products pr ON pr.id = pd.product_id
                 WHERE pd.id = $1 AND pd.purchase_id = $2`,
                [detailId, purchaseId]
            );
            const line = lineRes.rows[0];
            if (!line) throw httpError("Purchase line not found.", 404, "LINE_NOT_FOUND");

            const remaining = Math.max(0, Number(line.quantity) - (returned.get(detailId) || 0));
            if (qty > remaining + 0.0001) {
                throw httpError(
                    `Cannot return more than ${remaining} of ${line.product_name || "this item"}.`,
                    400,
                    "QTY_EXCEEDS_RETURNABLE"
                );
            }

            const warehouseId = line.warehouse_id || purchase.warehouse_id;
            const inv = await client.query(
                `SELECT id, quantity_available FROM inventories
                 WHERE product_id = $1 AND warehouse_id = $2
                 ORDER BY created_at DESC LIMIT 1
                 FOR UPDATE`,
                [line.product_id, warehouseId]
            );
            const onHand = Number(inv.rows[0]?.quantity_available) || 0;
            if (!inv.rowCount || onHand + 0.0001 < qty) {
                throw httpError(
                    `Only ${Math.max(0, onHand)} of ${line.product_name || "this item"} left in the store to return.`,
                    400,
                    "INSUFFICIENT_STOCK"
                );
            }

            const unit = toMoney(line.unit_price);
            const lineTotal = toMoney(unit * qty);
            lines.push({
                purchase_detail_id: detailId,
                product_id: line.product_id,
                inventory_id: inv.rows[0].id,
                quantity: qty,
                unit_price: unit,
                line_total: lineTotal,
                reason: d.reason || payload.reason || null,
                notes: d.notes || null,
            });
            goodsValue = toMoney(goodsValue + lineTotal);
            unitsOut += qty;
        }

        const total = toMoney(purchase.total_amount);
        const discount = toMoney(purchase.discount_amount);
        const oldNet = toMoney(Math.max(0, total - discount));
        const newTotal = toMoney(Math.max(0, total - goodsValue));
        // The purchase discount shrinks in proportion to the goods kept.
        const newDiscount = total > 0 ? toMoney((discount * newTotal) / total) : 0;
        const newNet = toMoney(Math.max(0, newTotal - newDiscount));
        const credit = toMoney(Math.max(0, oldNet - newNet));
        const paid = toMoney(purchase.amount_paid);
        const cashBack = toMoney(Math.max(0, paid - newNet));
        const newPaid = toMoney(paid - cashBack);

        const returnId = uuidv4();
        const reference =
            payload.reference_number || payload.referenceNumber || `PRN-${Date.now().toString(36).toUpperCase()}`;
        const now = new Date();

        await client.query(
            `INSERT INTO returns (
                id, reference_number, purchase_id, supplier_id, warehouse_id, tenant_id, creator_id,
                status, total_amount, refund_method, refund_amount, refund_status, refund_reference,
                reason, notes, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)`,
            [
                returnId,
                reference,
                purchaseId,
                purchase.supplier_id || null,
                purchase.warehouse_id,
                tenantId,
                creatorId || null,
                COMPLETED,
                credit,
                cashBack > 0.02 ? "cash" : "balance",
                cashBack,
                cashBack > 0.02 ? "completed" : "none",
                cashBack > 0.02 ? `SUPP-REF-${returnId.slice(0, 8)}` : null,
                payload.reason || null,
                payload.notes || null,
                now,
            ]
        );

        for (const line of lines) {
            await client.query(
                `INSERT INTO return_details (
                    id, return_id, product_id, quantity, unit_price, line_total, reason, notes,
                    purchase_detail_id, restock, created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10,$10)`,
                [
                    uuidv4(),
                    returnId,
                    line.product_id,
                    line.quantity,
                    line.unit_price,
                    line.line_total,
                    line.reason,
                    line.notes,
                    line.purchase_detail_id,
                    now,
                ]
            );
            await client.query(
                `UPDATE inventories SET quantity_available = quantity_available - $1, updated_at = $2 WHERE id = $3`,
                [line.quantity, now, line.inventory_id]
            );
            await client.query(
                `UPDATE products SET inventory = GREATEST(COALESCE(inventory, 0) - $1, 0), updated_at = $2
                 WHERE id = $3 AND tenant_id = $4`,
                [line.quantity, now, line.product_id, tenantId]
            );
        }

        await client.query(
            `UPDATE purchases
             SET total_amount = $1, discount_amount = $2, amount_paid = $3, payment_status = $4,
                 number_of_items = GREATEST(COALESCE(number_of_items, 0) - $5, 0), updated_at = $6
             WHERE id = $7 AND tenant_id = $8`,
            [newTotal, newDiscount, newPaid, purchasePaymentStatus(newNet, newPaid), unitsOut, now, purchaseId, tenantId]
        );

        await client.query("COMMIT");

        const created = await getReturnByIdService(returnId, tenantId);
        created.details = await getReturnDetailsService(returnId, tenantId);
        created.balance_reduction = toMoney(credit - cashBack);
        created.cash_back = cashBack;
        return created;
    } catch (err) {
        await client.query("ROLLBACK").catch(() => null);
        throw err;
    } finally {
        client.release();
    }
};
