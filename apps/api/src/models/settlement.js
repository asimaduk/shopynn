import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import {
    assertTenantPayoutProfileComplete,
    payoutProfileToSnapshot,
} from "./payoutProfile.js";
import {
    executePaystackWithdrawal,
    applyPaystackTransferResult,
} from "../services/paystackPayout.js";
import { isAutoWithdrawalEnabled } from "../services/paymentGateway.js";

const SUCCESS_STATUSES = new Set(["success", "paid", "completed"]);
const ACTIVE_SETTLEMENT_STATUSES = new Set(["requested", "pending", "paid"]);
const RESERVED_SETTLEMENT_STATUSES = new Set(["requested", "pending", "processing"]);
function settlementChangedError() {
    const err = new Error("This withdrawal was just updated by someone else. Refresh and try again.");
    err.status = 409;
    return err;
}

function toMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
}

/**
 * Runs fn(client) in a transaction holding the tenant's settlement lock, so a balance check and
 * the withdrawal it allows can't interleave with another request for the same shop.
 */
async function withTenantSettlementLock(tenantId, fn) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`tenant_settlement:${tenantId}`]);
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

async function sumDigitalCollections(tenantId, db = pool) {
    const res = await db.query(
        `SELECT COALESCE(SUM(
            CASE
              WHEN p.face_amount IS NOT NULL THEN p.face_amount
              ELSE p.amount
            END
         ), 0)::numeric AS total
         FROM payments p
         WHERE p.tenant_id = $1
           AND (p.order_id IS NOT NULL OR p.sale_id IS NOT NULL)
           AND lower(coalesce(p.status, '')) = ANY($2::text[])
           AND lower(coalesce(p.payment_method_type, '')) <> 'cash'`,
        [tenantId, [...SUCCESS_STATUSES]]
    );
    return toMoney(res.rows[0]?.total);
}

async function sumSettlements(tenantId, statuses, db = pool) {
    const list = [...statuses];
    const res = await db.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS total
         FROM tenant_settlements
         WHERE tenant_id = $1
           AND lower(status) = ANY($2::text[])`,
        [tenantId, list]
    );
    return toMoney(res.rows[0]?.total);
}

export const getTenantSettlementSummaryService = async (tenantId, db = pool) => {
    // Sequential: a transaction client can't run queries in parallel.
    const digitalCollected = await sumDigitalCollections(tenantId, db);
    const settledPaid = await sumSettlements(tenantId, ["paid"], db);
    const reservedPending = await sumSettlements(tenantId, [...RESERVED_SETTLEMENT_STATUSES], db);
    const availableBalance = toMoney(Math.max(0, digitalCollected - settledPaid - reservedPending));
    return {
        digital_collected: digitalCollected,
        settled_paid: settledPaid,
        pending_settlements: reservedPending,
        available_balance: availableBalance,
        currency: "GHS",
    };
};

export const listTenantSettlementsService = async (tenantId, { limit = 50 } = {}) => {
    const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const res = await pool.query(
        `SELECT ts.id, ts.tenant_id, ts.amount, ts.currency, ts.status, ts.note, ts.payout_reference,
                ts.source, ts.requested_by, ts.payout_snapshot, ts.rejection_reason,
                ts.payout_channel, ts.paystack_transfer_code, ts.paystack_transfer_reference,
                ts.created_by, ts.paid_by, ts.paid_at, ts.created_at, ts.updated_at,
                u.first_name AS created_by_first_name, u.last_name AS created_by_last_name,
                pu.first_name AS paid_by_first_name, pu.last_name AS paid_by_last_name,
                ru.first_name AS requested_by_first_name, ru.last_name AS requested_by_last_name
         FROM tenant_settlements ts
         LEFT JOIN users u ON u.id = ts.created_by
         LEFT JOIN users pu ON pu.id = ts.paid_by
         LEFT JOIN users ru ON ru.id = ts.requested_by
         WHERE ts.tenant_id = $1
         ORDER BY ts.created_at DESC
         LIMIT $2`,
        [tenantId, cap]
    );
    return res.rows;
};

export const createTenantSettlementService = async (user, tenantId, body = {}) => {
    const amount = toMoney(body.amount);
    if (!amount || amount <= 0) {
        throw new Error("Settlement amount must be greater than zero.");
    }
    const note = body.note != null ? String(body.note).trim() : "";
    return withTenantSettlementLock(tenantId, async (db) => {
        const summary = await getTenantSettlementSummaryService(tenantId, db);
        const available = toMoney(summary.available_balance);
        if (available <= 0) {
            throw new Error("No available balance to pay out.");
        }
        if (amount > available + 0.01) {
            throw new Error(
                `Amount exceeds available balance (GHS ${available.toFixed(2)}).`
            );
        }
        const res = await db.query(
            `INSERT INTO tenant_settlements (
                id, tenant_id, amount, currency, status, note, source, created_by, created_at, updated_at
             ) VALUES ($1, $2, $3, 'GHS', 'pending', $4, 'admin', $5, now(), now())
             RETURNING *`,
            [uuidv4(), tenantId, amount, note || null, user?.id || null]
        );
        return res.rows[0];
    });
};

async function assertNoInFlightMerchantWithdrawal(tenantId, db = pool) {
    const res = await db.query(
        `SELECT id FROM tenant_settlements
         WHERE tenant_id = $1
           AND source = 'merchant'
           AND lower(status) = ANY($2::text[])
         LIMIT 1`,
        [tenantId, ["requested", "pending", "processing"]]
    );
    if (res.rows[0]) {
        throw new Error("You already have a withdrawal in progress. Wait for it to complete before requesting another.");
    }
}

export const requestMerchantWithdrawalService = async (user, tenantId, body = {}) => {
    const amount = toMoney(body.amount);
    if (!amount || amount <= 0) {
        throw new Error("Withdrawal amount must be greater than zero.");
    }
    const profile = await assertTenantPayoutProfileComplete(tenantId);
    const note = body.note != null ? String(body.note).trim() : "";
    const snapshot = payoutProfileToSnapshot(profile);
    const id = uuidv4();
    const transferReference = `wd_${id.replace(/-/g, "").slice(0, 24)}`;
    const autoPay = isAutoWithdrawalEnabled();
    const initialStatus = autoPay ? "processing" : "requested";

    const settlement = await withTenantSettlementLock(tenantId, async (db) => {
        await assertNoInFlightMerchantWithdrawal(tenantId, db);
        const summary = await getTenantSettlementSummaryService(tenantId, db);
        if (amount > summary.available_balance + 0.01) {
            throw new Error(
                `Amount exceeds available balance (GHS ${summary.available_balance.toFixed(2)}).`
            );
        }
        const insertRes = await db.query(
            `INSERT INTO tenant_settlements (
                id, tenant_id, amount, currency, status, note, source, requested_by, payout_snapshot,
                payout_channel, paystack_transfer_reference, created_at, updated_at
             ) VALUES ($1, $2, $3, 'GHS', $4, $5, 'merchant', $6, $7::jsonb, $8, $9, now(), now())
             RETURNING *`,
            [
                id,
                tenantId,
                amount,
                initialStatus,
                note || null,
                user?.id || null,
                JSON.stringify(snapshot),
                autoPay ? "paystack" : "manual",
                autoPay ? transferReference : null,
            ]
        );
        return insertRes.rows[0];
    });

    if (!autoPay) {
        return settlement;
    }

    try {
        const transferResult = await executePaystackWithdrawal({
            tenantId,
            settlement: { ...settlement, paystack_transfer_reference: transferReference },
            profile,
        });
        return applyPaystackTransferResult(settlement.id, transferResult, { userId: user?.id || null });
    } catch (error) {
        await pool.query(
            `UPDATE tenant_settlements
             SET status = 'failed',
                 rejection_reason = $2,
                 updated_at = now()
             WHERE id = $1`,
            [settlement.id, String(error.message || "Paystack payout failed.").slice(0, 500)]
        );
        throw error;
    }
};

export const retryMerchantWithdrawalService = async (user, tenantId, settlementId) => {
    if (!isAutoWithdrawalEnabled()) {
        throw new Error("Automatic Paystack withdrawals are not enabled.");
    }
    const profile = await assertTenantPayoutProfileComplete(tenantId);
    const transferReference = `wd_${String(settlementId).replace(/-/g, "").slice(0, 20)}_${Date.now().toString(36).slice(-6)}`;

    const row = await withTenantSettlementLock(tenantId, async (db) => {
        const existing = await db.query(
            `SELECT * FROM tenant_settlements WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [settlementId, tenantId]
        );
        const current = existing.rows[0];
        if (!current) throw new Error("Withdrawal not found.");
        if (String(current.source || "").toLowerCase() !== "merchant") {
            throw new Error("This withdrawal cannot be retried.");
        }
        if (String(current.status || "").toLowerCase() !== "failed") {
            throw new Error("Only failed withdrawals can be retried.");
        }

        await assertNoInFlightMerchantWithdrawal(tenantId, db);

        const summary = await getTenantSettlementSummaryService(tenantId, db);
        if (toMoney(current.amount) > summary.available_balance + 0.01) {
            throw new Error(
                `Amount exceeds available balance (GHS ${summary.available_balance.toFixed(2)}).`
            );
        }

        await db.query(
            `UPDATE tenant_settlements
             SET status = 'processing',
                 rejection_reason = NULL,
                 payout_channel = 'paystack',
                 paystack_transfer_reference = $2,
                 paystack_transfer_code = NULL,
                 payout_reference = NULL,
                 updated_at = now()
             WHERE id = $1`,
            [settlementId, transferReference]
        );
        return current;
    });
    const amount = toMoney(row.amount);

    try {
        const transferResult = await executePaystackWithdrawal({
            tenantId,
            settlement: { ...row, amount, paystack_transfer_reference: transferReference },
            profile,
        });
        return applyPaystackTransferResult(settlementId, transferResult, { userId: user?.id || null });
    } catch (error) {
        await pool.query(
            `UPDATE tenant_settlements
             SET status = 'failed',
                 rejection_reason = $2,
                 updated_at = now()
             WHERE id = $1`,
            [settlementId, String(error.message || "Paystack payout failed.").slice(0, 500)]
        );
        throw error;
    }
};

export const approveTenantSettlementService = async (user, settlementId) => {
    const existing = await pool.query(`SELECT * FROM tenant_settlements WHERE id = $1 LIMIT 1`, [settlementId]);
    const row = existing.rows[0];
    if (!row) return null;
    const status = String(row.status).toLowerCase();
    if (status === "paid") throw new Error("Settlement is already marked as paid.");
    if (status === "rejected") throw new Error("Rejected withdrawals cannot be approved.");
    if (status !== "requested") throw new Error("Only requested withdrawals can be approved.");
    const res = await pool.query(
        `UPDATE tenant_settlements
         SET status = 'pending',
             created_by = COALESCE(created_by, $2),
             updated_at = now()
         WHERE id = $1 AND lower(status) = 'requested'
         RETURNING *`,
        [settlementId, user?.id || null]
    );
    if (!res.rows[0]) throw settlementChangedError();
    return res.rows[0];
};

export const rejectTenantSettlementService = async (user, settlementId, body = {}) => {
    const existing = await pool.query(`SELECT * FROM tenant_settlements WHERE id = $1 LIMIT 1`, [settlementId]);
    const row = existing.rows[0];
    if (!row) return null;
    const status = String(row.status).toLowerCase();
    if (status === "paid") throw new Error("Paid settlements cannot be rejected.");
    if (status === "rejected") throw new Error("Settlement is already rejected.");
    if (status !== "requested") throw new Error("Only requested withdrawals can be rejected.");
    const reason = body.reason != null ? String(body.reason).trim() : "";
    const res = await pool.query(
        `UPDATE tenant_settlements
         SET status = 'rejected',
             rejection_reason = $2,
             updated_at = now()
         WHERE id = $1 AND lower(status) = 'requested'
         RETURNING *`,
        [settlementId, reason || null]
    );
    if (!res.rows[0]) throw settlementChangedError();
    return res.rows[0];
};

export const listAdminWithdrawalRequestsService = async ({ status = "requested", limit = 50 } = {}) => {
    const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const statusFilter = String(status || "requested").toLowerCase();
    const res = await pool.query(
        `SELECT ts.id, ts.tenant_id, ts.amount, ts.currency, ts.status, ts.note, ts.payout_reference,
                ts.source, ts.requested_by, ts.payout_snapshot, ts.rejection_reason,
                ts.payout_channel, ts.paystack_transfer_code, ts.paystack_transfer_reference,
                ts.created_at, ts.updated_at, ts.paid_at,
                t.name AS tenant_name, t.organization AS tenant_organization,
                ru.first_name AS requested_by_first_name, ru.last_name AS requested_by_last_name
         FROM tenant_settlements ts
         JOIN tenants t ON t.id = ts.tenant_id
         LEFT JOIN users ru ON ru.id = ts.requested_by
         WHERE ts.source = 'merchant'
           AND lower(ts.status) = $1
         ORDER BY ts.created_at ASC
         LIMIT $2`,
        [statusFilter, cap]
    );
    return res.rows;
};

export const markTenantSettlementPaidService = async (user, settlementId, body = {}) => {
    const existing = await pool.query(`SELECT * FROM tenant_settlements WHERE id = $1 LIMIT 1`, [settlementId]);
    const row = existing.rows[0];
    if (!row) return null;
    if (String(row.status).toLowerCase() === "paid") {
        throw new Error("Settlement is already marked as paid.");
    }
    if (String(row.status).toLowerCase() === "requested") {
        throw new Error("Approve the withdrawal request before marking it paid.");
    }
    if (String(row.status).toLowerCase() === "processing") {
        throw new Error("Payout is still processing on Paystack.");
    }
    if (String(row.status).toLowerCase() === "failed") {
        throw new Error("Failed payouts cannot be marked paid. Ask the merchant to submit a new withdrawal.");
    }
    if (String(row.status).toLowerCase() === "rejected") {
        throw new Error("Rejected settlements cannot be marked paid.");
    }
    if (String(row.status).toLowerCase() === "cancelled") {
        throw new Error("Cancelled settlements cannot be marked paid.");
    }
    const payoutReference =
        body.payout_reference != null ? String(body.payout_reference).trim() : "";
    const note = body.note != null ? String(body.note).trim() : "";
    const res = await pool.query(
        `UPDATE tenant_settlements
         SET status = 'paid',
             payout_reference = COALESCE(NULLIF($2, ''), payout_reference),
             note = CASE WHEN $3 <> '' THEN $3 ELSE note END,
             paid_by = $4,
             paid_at = now(),
             updated_at = now()
         WHERE id = $1 AND lower(status) = $5
         RETURNING *`,
        [settlementId, payoutReference, note, user?.id || null, String(row.status).toLowerCase()]
    );
    if (!res.rows[0]) throw settlementChangedError();
    return res.rows[0];
};
