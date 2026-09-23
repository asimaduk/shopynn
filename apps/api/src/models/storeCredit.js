/** Store credit ledger helpers for returns + checkout apply. */

import { v4 as uuidv4 } from "uuid";

export const toMoney = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

/**
 * Credit (positive amount) or consume (negative amount) customer store credit.
 * Locks customer row.
 */
export async function applyStoreCreditEntry(client, {
    tenantId,
    customerId,
    amount,
    entryType,
    returnId = null,
    saleId = null,
    orderId = null,
    note = null,
    recordedBy = null,
}) {
    const delta = toMoney(amount);
    if (!customerId) {
        const err = new Error("Customer is required for store credit.");
        err.status = 400;
        err.code = "CUSTOMER_REQUIRED_FOR_CREDIT";
        throw err;
    }
    if (Math.abs(delta) < 0.001) {
        const err = new Error("Store credit amount must be non-zero.");
        err.status = 400;
        err.code = "INVALID_CREDIT_AMOUNT";
        throw err;
    }

    const custRes = await client.query(
        `SELECT id, store_credit_balance FROM customers
         WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [customerId, tenantId]
    );
    const customer = custRes.rows[0];
    if (!customer) {
        const err = new Error("Customer not found.");
        err.status = 404;
        err.code = "CUSTOMER_NOT_FOUND";
        throw err;
    }

    const current = toMoney(customer.store_credit_balance);
    const next = toMoney(current + delta);
    if (next < -0.001) {
        const err = new Error(
            `Insufficient store credit (available GHS ${current.toFixed(2)}).`
        );
        err.status = 400;
        err.code = "INSUFFICIENT_STORE_CREDIT";
        throw err;
    }
    const balanceAfter = Math.max(0, next);

    await client.query(
        `UPDATE customers SET store_credit_balance = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
        [balanceAfter, new Date(), customerId, tenantId]
    );

    const id = uuidv4();
    await client.query(
        `INSERT INTO store_credit_ledger (
            id, tenant_id, customer_id, amount, balance_after, entry_type,
            return_id, sale_id, order_id, note, recorded_by, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
            id,
            tenantId,
            customerId,
            delta,
            balanceAfter,
            entryType,
            returnId,
            saleId,
            orderId,
            note,
            recordedBy,
            new Date(),
        ]
    );

    return { ledgerId: id, balanceAfter, amount: delta };
}

export async function getCustomerStoreCredit(clientOrPool, tenantId, customerId) {
    const result = await clientOrPool.query(
        `SELECT store_credit_balance FROM customers WHERE id = $1 AND tenant_id = $2`,
        [customerId, tenantId]
    );
    return toMoney(result.rows[0]?.store_credit_balance);
}
