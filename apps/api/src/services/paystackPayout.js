import pool from "../config/db.js";
import {
    createTransferRecipient,
    getMinWithdrawalAmount,
    initiateTransfer,
    isAutoWithdrawalEnabled,
    isPaystackConfigured,
    listPayoutBanks,
} from "../services/paymentGateway.js";
import { payoutProfileToSnapshot } from "../models/payoutProfile.js";

const MOMO_NETWORK_ALIASES = {
    mtn: ["mtn"],
    vodafone: ["vod", "vodafone", "telecel"],
    airteltigo: ["atl", "tgo", "airtel", "airteltigo", "at"],
};

function profileFingerprint(profile) {
    const method = String(profile.payout_method || "").toLowerCase();
    if (method === "momo") {
        return `momo|${profile.momo_network}|${profile.momo_number}`;
    }
    return `bank|${profile.paystack_bank_code || profile.bank_name}|${profile.bank_account_number}`;
}

function normalizePhoneForPaystack(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.startsWith("233") && digits.length >= 12) {
        return `0${digits.slice(3)}`;
    }
    if (digits.startsWith("0")) return digits;
    if (digits.length === 9) return `0${digits}`;
    return digits;
}

function matchBankCode(banks, { network, bankName, bankCode }) {
    if (bankCode) {
        const byCode = banks.find(
            (b) =>
                String(b.code || "").toLowerCase() === String(bankCode).toLowerCase() ||
                String(b.slug || "").toLowerCase() === String(bankCode).toLowerCase()
        );
        if (byCode) return byCode.code || byCode.slug;
    }
    const needle = String(network || bankName || "")
        .trim()
        .toLowerCase();
    if (!needle) return null;
    const aliases = network ? MOMO_NETWORK_ALIASES[String(network).toLowerCase()] || [needle] : [needle];
    for (const bank of banks) {
        const name = String(bank.name || "").toLowerCase();
        const code = String(bank.code || bank.slug || "").toLowerCase();
        if (aliases.some((a) => name.includes(a) || code === a || name === a)) {
            return bank.code || bank.slug;
        }
    }
    const fuzzy = banks.find((b) => {
        const name = String(b.name || "").toLowerCase();
        return name.includes(needle) || needle.includes(name);
    });
    return fuzzy ? fuzzy.code || fuzzy.slug : null;
}

export async function getPayoutBankOptionsService(type = "ghipss") {
    const normalized = type === "mobile_money" ? "mobile_money" : "ghipss";
    const banks = await listPayoutBanks({ type: normalized });
    return banks.map((b) => ({
        name: b.name,
        code: b.code || b.slug,
        slug: b.slug || null,
    }));
}

export async function resolvePaystackBankCode(profile) {
    const method = String(profile.payout_method || "").toLowerCase();
    if (profile.paystack_bank_code) return profile.paystack_bank_code;

    if (method === "momo") {
        const banks = await listPayoutBanks({ type: "mobile_money" });
        const code = matchBankCode(banks, { network: profile.momo_network });
        if (!code) {
            throw new Error(`Unsupported mobile money network: ${profile.momo_network || "unknown"}.`);
        }
        return code;
    }

    const banks = await listPayoutBanks({ type: "ghipss" });
    const code = matchBankCode(banks, {
        bankName: profile.bank_name,
        bankCode: profile.paystack_bank_code,
    });
    if (!code) {
        throw new Error(
            `Could not match bank "${profile.bank_name || ""}" to Paystack. Select your bank from the list.`
        );
    }
    return code;
}

async function getOrCreatePaystackRecipient(tenantId, profile) {
    const fingerprint = profileFingerprint(profile);
    const bankCode = await resolvePaystackBankCode(profile);

    if (
        profile.paystack_recipient_code &&
        profile.payout_details_fingerprint === fingerprint &&
        profile.paystack_bank_code === bankCode
    ) {
        return profile.paystack_recipient_code;
    }

    const method = String(profile.payout_method || "").toLowerCase();
    const recipient = await createTransferRecipient({
        payout_method: method,
        account_holder_name: profile.account_holder_name,
        momo_number: method === "momo" ? normalizePhoneForPaystack(profile.momo_number) : undefined,
        bank_code: bankCode,
        bank_account_number: profile.bank_account_number,
        bank_account_name: profile.bank_account_name || profile.account_holder_name,
    });

    await pool.query(
        `UPDATE tenant_payout_profiles
         SET paystack_recipient_code = $2,
             paystack_bank_code = $3,
             payout_details_fingerprint = $4,
             updated_at = now()
         WHERE tenant_id = $1`,
        [tenantId, recipient.recipient_code, bankCode, fingerprint]
    );

    return recipient.recipient_code;
}

export async function executePaystackWithdrawal({ tenantId, settlement, profile }) {
    if (!isAutoWithdrawalEnabled()) {
        throw new Error("Automatic Paystack withdrawals are not enabled.");
    }

    const minAmount = getMinWithdrawalAmount();
    const amount = Number(settlement.amount);
    if (amount < minAmount) {
        throw new Error(`Minimum withdrawal amount is GHS ${minAmount.toFixed(2)}.`);
    }

    const recipientCode = await getOrCreatePaystackRecipient(tenantId, profile);
    const reference =
        settlement.paystack_transfer_reference ||
        `wd_${String(settlement.id || "").replace(/-/g, "").slice(0, 24)}`;

    const transfer = await initiateTransfer({
        amount,
        recipient_code: recipientCode,
        reference,
        reason: settlement.note || "Shopynn order revenue payout",
    });

    return {
        ...transfer,
        recipient_code: recipientCode,
        payout_channel: isPaystackConfigured() ? "paystack" : "paystack_stub",
    };
}

export function mapPaystackTransferToSettlementStatus(transferStatus) {
    const s = String(transferStatus || "").toLowerCase();
    if (s === "success") return "paid";
    if (s === "failed" || s === "reversed") return "failed";
    return "processing";
}

export async function applyPaystackTransferResult(settlementId, transferResult, { userId = null } = {}) {
    const status = mapPaystackTransferToSettlementStatus(transferResult.status);
    const payoutReference =
        transferResult.reference || transferResult.transfer_code || transferResult.transfer_code || null;

    if (status === "paid") {
        const res = await pool.query(
            `UPDATE tenant_settlements
             SET status = 'paid',
                 payout_channel = COALESCE(payout_channel, 'paystack'),
                 paystack_transfer_code = COALESCE($2, paystack_transfer_code),
                 paystack_transfer_reference = COALESCE($3, paystack_transfer_reference),
                 payout_reference = COALESCE($4, payout_reference),
                 paid_by = COALESCE(paid_by, $5),
                 paid_at = now(),
                 updated_at = now()
             WHERE id = $1
             RETURNING *`,
            [
                settlementId,
                transferResult.transfer_code || null,
                transferResult.reference || null,
                payoutReference,
                userId,
            ]
        );
        return res.rows[0];
    }

    if (status === "failed") {
        const res = await pool.query(
            `UPDATE tenant_settlements
             SET status = 'failed',
                 payout_channel = COALESCE(payout_channel, 'paystack'),
                 paystack_transfer_code = COALESCE($2, paystack_transfer_code),
                 paystack_transfer_reference = COALESCE($3, paystack_transfer_reference),
                 rejection_reason = COALESCE($4, rejection_reason),
                 updated_at = now()
             WHERE id = $1
             RETURNING *`,
            [
                settlementId,
                transferResult.transfer_code || null,
                transferResult.reference || null,
                transferResult.message || "Paystack transfer failed.",
            ]
        );
        return res.rows[0];
    }

    const res = await pool.query(
        `UPDATE tenant_settlements
         SET status = 'processing',
             payout_channel = COALESCE(payout_channel, 'paystack'),
             paystack_transfer_code = COALESCE($2, paystack_transfer_code),
             paystack_transfer_reference = COALESCE($3, paystack_transfer_reference),
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [settlementId, transferResult.transfer_code || null, transferResult.reference || null]
    );
    return res.rows[0];
}

export async function findSettlementByTransferReference(reference) {
    if (!reference) return null;
    const res = await pool.query(
        `SELECT * FROM tenant_settlements
         WHERE paystack_transfer_reference = $1
            OR paystack_transfer_code = $1
            OR payout_reference = $1
         LIMIT 1`,
        [reference]
    );
    return res.rows[0] || null;
}

export async function handlePaystackTransferWebhook(data = {}) {
    const reference = data.reference || data.transfer_code;
    if (!reference) return null;

    const settlement = await findSettlementByTransferReference(reference);
    if (!settlement) return null;

    const status = String(data.status || "").toLowerCase();
    return applyPaystackTransferResult(settlement.id, {
        status,
        reference: data.reference,
        transfer_code: data.transfer_code || data.code,
        message: data.complete_message || data.reason || null,
    });
}

