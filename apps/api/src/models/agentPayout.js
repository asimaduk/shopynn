import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import {
    AGENT_PAYOUT_MIN_GHS,
    AGENT_PAYOUT_MOMO_FEE_GHS,
    COMMISSION_KIND,
    MANAGER_OVERRIDE_RATE,
} from "../constants/billingCatalog.js";
import { createTransferRecipient, initiateTransfer, isPaystackConfigured } from "../services/paymentGateway.js";
import { normalizePhoneForPaystack, resolvePaystackBankCode } from "../services/paystackPayout.js";
import { buildAgentPayoutEmail } from "../services/agentPayoutEmail.js";
import { sendEmailService } from "./mail.js";

const round2 = (n) => Math.round(Number(n) * 100) / 100;

export const COMMISSION_STATUS = Object.freeze({
    PENDING: "pending",
    IN_PAYOUT: "in_payout",
    PAID: "paid",
    CANCELLED: "cancelled",
});

export const PAYOUT_STATUS = Object.freeze({
    PENDING_APPROVAL: "pending_approval",
    PROCESSING: "processing",
    PAID: "paid",
    FAILED: "failed",
    REJECTED: "rejected",
});

export const MOMO_NETWORKS = ["mtn", "vodafone", "airteltigo"];

/** A pending commission becomes payable once its hold (payable_after) has passed. */
const PAYABLE_SQL = `mc.status = 'pending' AND COALESCE(mc.payable_after, mc.created_at) <= now()`;

/** held | payable | in_payout | paid | cancelled */
export const COMMISSION_LIFECYCLE_SQL = `
    CASE
        WHEN mc.status = 'pending' AND COALESCE(mc.payable_after, mc.created_at) > now() THEN 'held'
        WHEN mc.status = 'pending' THEN 'payable'
        ELSE mc.status
    END`;

/**
 * Adds the agent manager's override (MANAGER_OVERRIDE_RATE of the agent's commission) on top of a
 * team member's commission. Only while the agent is on an active manager's team; same hold.
 */
export const createManagerOverrideForCommissionService = async (commissionId) => {
    if (!commissionId) return null;
    const r = await pool.query(
        `SELECT mc.*, m.manager_id, mgr.status AS manager_status, u.first_name, u.last_name
         FROM merchant_commissions mc
         INNER JOIN merchants m ON m.id = mc.merchant_id
         INNER JOIN users u ON u.id = m.user_id
         LEFT JOIN merchants mgr ON mgr.id = m.manager_id
         WHERE mc.id = $1`,
        [commissionId]
    );
    const c = r.rows[0];
    if (!c || c.commission_kind === COMMISSION_KIND.OVERRIDE || c.status === COMMISSION_STATUS.CANCELLED) return null;
    if (!c.manager_id || c.manager_status !== "active") return null;

    const amount = round2(Number(c.commission_amount) * MANAGER_OVERRIDE_RATE);
    if (amount <= 0) return null;

    const agentName = [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "team member";
    const id = uuidv4();
    const ins = await pool.query(
        `INSERT INTO merchant_commissions (
            id, merchant_id, tenant_id, subscription_id, quote_id, payment_id,
            base_amount, commission_percent, commission_amount,
            onboarding_commission_amount, subscription_commission_amount,
            status, payable_after, commission_kind, source_commission_id, notes, created_at
        ) VALUES ($1,$2,$3,$4,NULL,NULL,$5,$6,$7,0,0,'pending',$8,$9,$10,$11,now())
        ON CONFLICT (source_commission_id) WHERE source_commission_id IS NOT NULL DO NOTHING
        RETURNING id`,
        [
            id,
            c.manager_id,
            c.tenant_id,
            c.subscription_id,
            round2(c.commission_amount),
            MANAGER_OVERRIDE_RATE * 100,
            amount,
            c.payable_after,
            COMMISSION_KIND.OVERRIDE,
            c.id,
            `${Math.round(MANAGER_OVERRIDE_RATE * 100)}% manager override — ${agentName}`.slice(0, 500),
        ]
    );
    if (ins.rowCount === 0) return null;
    return { id, merchant_id: c.manager_id, commission_amount: amount };
};

/** Admin: cancel a commission that has not been paid out (e.g. the shop's payment was refunded). */
export const cancelCommissionService = async ({ commissionId, actorUserId, reason }) => {
    const r = await pool.query(`SELECT id, status, payout_id FROM merchant_commissions WHERE id = $1`, [commissionId]);
    const c = r.rows[0];
    if (!c) return null;
    if (c.status === COMMISSION_STATUS.IN_PAYOUT) {
        throw new Error("This commission is in a payout. Reject that payout first, then cancel.");
    }
    if (c.status === COMMISSION_STATUS.PAID) throw new Error("This commission has already been paid.");
    if (c.status === COMMISSION_STATUS.CANCELLED) return { id: c.id, status: c.status, overrides_cancelled: 0 };

    const note = String(reason || "").trim().slice(0, 500) || null;
    await pool.query(
        `UPDATE merchant_commissions
         SET status = 'cancelled', cancelled_at = now(), cancelled_by = $2, cancel_reason = $3
         WHERE id = $1`,
        [c.id, actorUserId || null, note]
    );
    const overrides = await pool.query(
        `UPDATE merchant_commissions
         SET status = 'cancelled', cancelled_at = now(), cancelled_by = $2, cancel_reason = $3
         WHERE source_commission_id = $1 AND status = 'pending'
         RETURNING id`,
        [c.id, actorUserId || null, note || "Source commission cancelled"]
    );
    return { id: c.id, status: COMMISSION_STATUS.CANCELLED, overrides_cancelled: overrides.rowCount };
};

export const getEarningsSummaryService = async (merchantId) => {
    const r = await pool.query(
        `SELECT
            COALESCE(SUM(mc.commission_amount) FILTER (WHERE ${COMMISSION_LIFECYCLE_SQL} = 'held'), 0)::numeric(12,2) AS held_ghs,
            COALESCE(SUM(mc.commission_amount) FILTER (WHERE ${PAYABLE_SQL}), 0)::numeric(12,2) AS payable_ghs,
            COALESCE(SUM(mc.commission_amount) FILTER (WHERE mc.status = 'in_payout'), 0)::numeric(12,2) AS in_payout_ghs,
            COALESCE(SUM(mc.commission_amount) FILTER (WHERE mc.status = 'paid'), 0)::numeric(12,2) AS paid_ghs,
            MIN(mc.payable_after) FILTER (WHERE ${COMMISSION_LIFECYCLE_SQL} = 'held') AS next_release_at
         FROM merchant_commissions mc
         WHERE mc.merchant_id = $1`,
        [merchantId]
    );
    const payouts = await pool.query(
        `SELECT id, amount, status, commission_count, failure_reason, created_at, approved_at, paid_at
         FROM merchant_payouts WHERE merchant_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [merchantId]
    );
    return {
        ...r.rows[0],
        payout_min_ghs: AGENT_PAYOUT_MIN_GHS,
        payout_schedule: "Weekly on Mondays, after Shopynn approval",
        payouts: payouts.rows,
    };
};

// ---------------------------------------------------------------- payout profile (MoMo only)

function normalizeMomoNumber(raw) {
    const n = normalizePhoneForPaystack(raw);
    return /^0\d{9}$/.test(n) ? n : null;
}

export const getPayoutProfileService = async (merchantId) => {
    const r = await pool.query(
        `SELECT merchant_id, payout_method, momo_network, momo_number, account_holder_name, updated_at
         FROM merchant_payout_profiles WHERE merchant_id = $1`,
        [merchantId]
    );
    return r.rows[0] || null;
};

export const upsertPayoutProfileService = async (merchantId, { momo_network, momo_number, account_holder_name }) => {
    const network = String(momo_network || "").trim().toLowerCase();
    if (!MOMO_NETWORKS.includes(network)) throw new Error("momo_network must be mtn, vodafone or airteltigo.");
    const number = normalizeMomoNumber(momo_number);
    if (!number) throw new Error("Enter a valid 10-digit mobile money number.");
    const holder = String(account_holder_name || "").trim().slice(0, 150);
    if (!holder) throw new Error("account_holder_name is required.");

    // Changing details drops the cached Paystack recipient so the next payout creates a new one.
    await pool.query(
        `INSERT INTO merchant_payout_profiles (merchant_id, payout_method, momo_network, momo_number, account_holder_name)
         VALUES ($1, 'momo', $2, $3, $4)
         ON CONFLICT (merchant_id) DO UPDATE
         SET momo_network = EXCLUDED.momo_network,
             momo_number = EXCLUDED.momo_number,
             account_holder_name = EXCLUDED.account_holder_name,
             paystack_recipient_code = CASE
                 WHEN merchant_payout_profiles.momo_network = EXCLUDED.momo_network
                  AND merchant_payout_profiles.momo_number = EXCLUDED.momo_number
                  AND merchant_payout_profiles.account_holder_name = EXCLUDED.account_holder_name
                 THEN merchant_payout_profiles.paystack_recipient_code ELSE NULL END,
             updated_at = now()`,
        [merchantId, network, number, holder]
    );
    return getPayoutProfileService(merchantId);
};

async function getOrCreateAgentRecipient(profile) {
    if (profile.paystack_recipient_code) return profile.paystack_recipient_code;
    const bankCode = await resolvePaystackBankCode({ payout_method: "momo", momo_network: profile.momo_network });
    const recipient = await createTransferRecipient({
        payout_method: "momo",
        account_holder_name: profile.account_holder_name,
        momo_number: normalizePhoneForPaystack(profile.momo_number),
        bank_code: bankCode,
    });
    await pool.query(
        `UPDATE merchant_payout_profiles
         SET paystack_recipient_code = $2, paystack_bank_code = $3, updated_at = now()
         WHERE merchant_id = $1`,
        [profile.merchant_id, recipient.recipient_code, bankCode]
    );
    return recipient.recipient_code;
}

// ---------------------------------------------------------------- payouts

/**
 * Weekly batch: one payout (awaiting approval) per agent whose payable commission reaches the
 * minimum and who has a MoMo profile. Agents with an open payout are skipped until it settles.
 */
export const prepareAgentPayoutsService = async ({ actorUserId = null } = {}) => {
    const client = await pool.connect();
    const created = [];
    try {
        await client.query("BEGIN");
        const due = await client.query(
            `SELECT mc.merchant_id, SUM(mc.commission_amount)::numeric(12,2) AS total,
                    (pp.merchant_id IS NOT NULL) AS has_profile,
                    u.first_name, u.last_name
             FROM merchant_commissions mc
             INNER JOIN merchants m ON m.id = mc.merchant_id
             INNER JOIN users u ON u.id = m.user_id
             LEFT JOIN merchant_payout_profiles pp ON pp.merchant_id = mc.merchant_id
             WHERE ${PAYABLE_SQL}
               AND NOT EXISTS (
                   SELECT 1 FROM merchant_payouts p
                   WHERE p.merchant_id = mc.merchant_id AND p.status IN ('pending_approval', 'processing', 'failed')
               )
             GROUP BY mc.merchant_id, pp.merchant_id, u.first_name, u.last_name
             HAVING SUM(mc.commission_amount) >= $1`,
            [AGENT_PAYOUT_MIN_GHS]
        );
        const skippedNoProfile = [];
        for (const row of due.rows) {
            const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
            if (!row.has_profile) {
                skippedNoProfile.push({ merchant_id: row.merchant_id, name, payable_ghs: row.total });
                continue;
            }
            const profile = (
                await client.query(`SELECT * FROM merchant_payout_profiles WHERE merchant_id = $1`, [row.merchant_id])
            ).rows[0];
            const payoutId = uuidv4();
            await client.query(
                `INSERT INTO merchant_payouts (id, merchant_id, amount, fee_absorbed, status, payout_snapshot, created_by)
                 VALUES ($1, $2, 0, $3, 'pending_approval', $4, $5)`,
                [
                    payoutId,
                    row.merchant_id,
                    AGENT_PAYOUT_MOMO_FEE_GHS,
                    JSON.stringify({
                        payout_method: "momo",
                        momo_network: profile.momo_network,
                        momo_number: profile.momo_number,
                        account_holder_name: profile.account_holder_name,
                    }),
                    actorUserId,
                ]
            );
            const claimed = await client.query(
                `UPDATE merchant_commissions mc
                 SET status = 'in_payout', payout_id = $2
                 WHERE mc.merchant_id = $1 AND ${PAYABLE_SQL}
                 RETURNING mc.commission_amount`,
                [row.merchant_id, payoutId]
            );
            const amount = round2(claimed.rows.reduce((s, x) => s + Number(x.commission_amount), 0));
            await client.query(
                `UPDATE merchant_payouts SET amount = $2, commission_count = $3, updated_at = now() WHERE id = $1`,
                [payoutId, amount, claimed.rowCount]
            );
            created.push({ id: payoutId, merchant_id: row.merchant_id, name, amount, commission_count: claimed.rowCount });
        }
        await client.query("COMMIT");
        return { created, skipped_no_profile: skippedNoProfile, min_ghs: AGENT_PAYOUT_MIN_GHS };
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

export const listAgentPayoutsService = async ({ status } = {}) => {
    const params = [];
    let where = "";
    if (status && Object.values(PAYOUT_STATUS).includes(status)) {
        params.push(status);
        where = "WHERE p.status = $1";
    }
    const r = await pool.query(
        `SELECT p.id, p.merchant_id, p.amount, p.fee_absorbed, p.status, p.commission_count, p.payout_snapshot,
                p.payout_channel, p.paystack_transfer_reference, p.attempts, p.failure_reason,
                p.created_at, p.approved_at, p.paid_at,
                u.first_name, u.last_name, u.email, u.phone, m.agent_type,
                au.first_name AS approved_by_first_name, au.last_name AS approved_by_last_name
         FROM merchant_payouts p
         INNER JOIN merchants m ON m.id = p.merchant_id
         INNER JOIN users u ON u.id = m.user_id
         LEFT JOIN users au ON au.id = p.approved_by
         ${where}
         ORDER BY (p.status = 'pending_approval') DESC, (p.status = 'failed') DESC, p.created_at DESC
         LIMIT 200`,
        params
    );
    return r.rows;
};

export function agentPayoutsLiveBlocked() {
    return isPaystackConfigured() && process.env.AGENT_PAYOUTS_ENABLED !== "true";
}

/**
 * Admin: send an approved payout (or retry a failed one) through Paystack. Without a Paystack key
 * the transfer is stubbed; with a key, AGENT_PAYOUTS_ENABLED=true is also required.
 */
export const approveAgentPayoutService = async ({ payoutId, actorUserId }) => {
    if (agentPayoutsLiveBlocked()) {
        throw new Error("Agent payouts are switched off. Set AGENT_PAYOUTS_ENABLED=true on the API to send real transfers.");
    }
    const claim = await pool.query(
        `UPDATE merchant_payouts
         SET status = 'processing', approved_by = $2, approved_at = now(), attempts = attempts + 1,
             failure_reason = NULL, updated_at = now()
         WHERE id = $1 AND status IN ('pending_approval', 'failed')
         RETURNING *`,
        [payoutId, actorUserId]
    );
    const payout = claim.rows[0];
    if (!payout) return null;

    const profile = (await pool.query(`SELECT * FROM merchant_payout_profiles WHERE merchant_id = $1`, [payout.merchant_id]))
        .rows[0];
    if (!profile) {
        return markPayoutFailed(payout.id, "The agent has no mobile money payout details.");
    }

    let recipientCode;
    try {
        recipientCode = await getOrCreateAgentRecipient(profile);
    } catch (e) {
        return markPayoutFailed(payout.id, `Could not set up the MoMo recipient: ${e.message}`);
    }

    // A fresh reference per attempt; Paystack rejects a reused reference.
    const reference = `ap_${String(payout.id).replace(/-/g, "").slice(0, 24)}_${payout.attempts}`;
    await pool.query(
        `UPDATE merchant_payouts
         SET paystack_transfer_reference = $2, payout_channel = $3,
             payout_snapshot = payout_snapshot || jsonb_build_object('momo_number', $4::text, 'momo_network', $5::text),
             updated_at = now()
         WHERE id = $1`,
        [payout.id, reference, isPaystackConfigured() ? "paystack" : "paystack_stub", profile.momo_number, profile.momo_network]
    );

    let transfer;
    try {
        transfer = await initiateTransfer({
            amount: Number(payout.amount),
            recipient_code: recipientCode,
            reference,
            reason: "Shopynn agent commission",
        });
    } catch (e) {
        // Outcome unknown (Paystack may still have accepted it): stay processing until the webhook says.
        const r = await pool.query(
            `UPDATE merchant_payouts SET failure_reason = $2, updated_at = now() WHERE id = $1 RETURNING *`,
            [payout.id, `Transfer request error, waiting for Paystack confirmation: ${e.message}`.slice(0, 1000)]
        );
        return r.rows[0];
    }
    return applyAgentPayoutTransferResult(payout.id, transfer);
};

const NOTIFY_STATUSES = [PAYOUT_STATUS.PAID, PAYOUT_STATUS.FAILED, PAYOUT_STATUS.REJECTED];

/** Email the agent about a paid / failed / rejected payout, once per status. Never throws. */
export async function notifyAgentPayoutStatus(payoutId) {
    try {
        const claim = await pool.query(
            `UPDATE merchant_payouts p
             SET notified_status = p.status
             FROM (SELECT id, notified_status AS previous FROM merchant_payouts WHERE id = $1 FOR UPDATE) prev
             WHERE p.id = prev.id AND p.status = ANY($2::text[]) AND p.notified_status IS DISTINCT FROM p.status
             RETURNING p.*, prev.previous`,
            [payoutId, NOTIFY_STATUSES]
        );
        const payout = claim.rows[0];
        if (!payout) return false;

        const agent = (
            await pool.query(
                `SELECT u.email, u.first_name FROM merchants m INNER JOIN users u ON u.id = m.user_id WHERE m.id = $1`,
                [payout.merchant_id]
            )
        ).rows[0];
        const email = buildAgentPayoutEmail(payout, agent);
        if (!agent?.email || !email) return false;
        try {
            await sendEmailService({ sender_name: "Shopynn", from: "billing", receipient: agent.email, ...email });
            return true;
        } catch (e) {
            await pool.query(`UPDATE merchant_payouts SET notified_status = $2 WHERE id = $1 AND notified_status = $3`, [
                payout.id,
                payout.previous,
                payout.status,
            ]);
            console.error(`[agent-payout] email for payout ${payout.id} (${payout.status}) failed: ${e.message}`);
            return false;
        }
    } catch (e) {
        console.error(`[agent-payout] notify ${payoutId} failed: ${e.message}`);
        return false;
    }
}

async function markPayoutFailed(payoutId, reason) {
    await pool.query(
        `UPDATE merchant_commissions SET status = 'in_payout', paid_at = NULL WHERE payout_id = $1 AND status = 'paid'`,
        [payoutId]
    );
    const r = await pool.query(
        `UPDATE merchant_payouts SET status = 'failed', failure_reason = $2, paid_at = NULL, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [payoutId, String(reason || "Transfer failed.").slice(0, 1000)]
    );
    return r.rows[0];
}

export const applyAgentPayoutTransferResult = async (payoutId, transfer = {}) => {
    const s = String(transfer.status || "").toLowerCase();
    if (transfer.transfer_code) {
        await pool.query(`UPDATE merchant_payouts SET paystack_transfer_code = $2 WHERE id = $1`, [payoutId, transfer.transfer_code]);
    }
    if (s === "success") {
        await pool.query(`UPDATE merchant_commissions SET status = 'paid', paid_at = now() WHERE payout_id = $1 AND status = 'in_payout'`, [
            payoutId,
        ]);
        const r = await pool.query(
            `UPDATE merchant_payouts SET status = 'paid', paid_at = COALESCE(paid_at, now()), failure_reason = NULL, updated_at = now()
             WHERE id = $1 RETURNING *`,
            [payoutId]
        );
        return r.rows[0];
    }
    if (s === "failed" || s === "reversed") {
        return markPayoutFailed(payoutId, transfer.message || `Paystack transfer ${s}.`);
    }
    const r = await pool.query(`UPDATE merchant_payouts SET status = 'processing', updated_at = now() WHERE id = $1 RETURNING *`, [
        payoutId,
    ]);
    return r.rows[0];
};

/** Paystack transfer.* webhook for agent payouts. Returns null when the reference is not ours. */
export const handleAgentPayoutTransferWebhook = async (data = {}) => {
    const refs = [data.reference, data.transfer_code].filter(Boolean);
    if (refs.length === 0) return null;
    const r = await pool.query(
        `SELECT id FROM merchant_payouts
         WHERE paystack_transfer_reference = ANY($1::text[]) OR paystack_transfer_code = ANY($1::text[])
         LIMIT 1`,
        [refs]
    );
    if (!r.rows[0]) return null;
    const payout = await applyAgentPayoutTransferResult(r.rows[0].id, {
        status: data.status,
        transfer_code: data.transfer_code || data.code,
        message: data.complete_message || data.reason || null,
    });
    // Not awaited: Paystack should get its 200 without waiting on the email provider.
    notifyAgentPayoutStatus(r.rows[0].id);
    return payout;
};

/** Admin: drop a payout that is awaiting approval or failed; its commissions become payable again. */
export const rejectAgentPayoutService = async ({ payoutId, reason }) => {
    const r = await pool.query(
        `UPDATE merchant_payouts
         SET status = 'rejected', failure_reason = COALESCE($2, failure_reason), updated_at = now()
         WHERE id = $1 AND status IN ('pending_approval', 'failed')
         RETURNING *`,
        [payoutId, String(reason || "").trim().slice(0, 1000) || null]
    );
    if (!r.rows[0]) return null;
    await pool.query(`UPDATE merchant_commissions SET status = 'pending', payout_id = NULL WHERE payout_id = $1 AND status = 'in_payout'`, [
        payoutId,
    ]);
    return r.rows[0];
};

/** Admin: after checking the Paystack dashboard, mark a stuck processing payout as failed. */
export const markAgentPayoutFailedService = async ({ payoutId, reason }) => {
    const r = await pool.query(`SELECT status FROM merchant_payouts WHERE id = $1`, [payoutId]);
    if (r.rows[0]?.status !== PAYOUT_STATUS.PROCESSING) return null;
    return markPayoutFailed(payoutId, reason || "Marked failed by admin after checking Paystack.");
};
