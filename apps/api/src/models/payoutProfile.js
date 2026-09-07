import pool from "../config/db.js";

const PAYOUT_METHODS = new Set(["momo", "bank"]);
const MOMO_NETWORKS = new Set(["mtn", "vodafone", "airteltigo"]);

function normalizeMethod(value) {
    const v = String(value || "").trim().toLowerCase();
    return PAYOUT_METHODS.has(v) ? v : null;
}

function normalizeNetwork(value) {
    const v = String(value || "").trim().toLowerCase();
    return MOMO_NETWORKS.has(v) ? v : null;
}

function cleanText(value, maxLen = 120) {
    const v = value != null ? String(value).trim() : "";
    return v ? v.slice(0, maxLen) : "";
}

function validateProfile(body = {}) {
    const payoutMethod = normalizeMethod(body.payout_method);
    if (!payoutMethod) {
        throw new Error("Payout method must be momo or bank.");
    }
    const accountHolderName = cleanText(body.account_holder_name);
    if (!accountHolderName) {
        throw new Error("Account holder name is required.");
    }

    if (payoutMethod === "momo") {
        const momoNetwork = normalizeNetwork(body.momo_network);
        const momoNumber = cleanText(body.momo_number, 30).replace(/\s+/g, "");
        if (!momoNetwork) throw new Error("Mobile money network is required (mtn, vodafone, airteltigo).");
        if (!/^\d{9,15}$/.test(momoNumber)) throw new Error("Enter a valid mobile money number.");
        return {
            payout_method: payoutMethod,
            momo_network: momoNetwork,
            momo_number: momoNumber,
            bank_name: null,
            bank_account_number: null,
            bank_account_name: null,
            account_holder_name: accountHolderName,
        };
    }

    const bankName = cleanText(body.bank_name);
    const bankAccountNumber = cleanText(body.bank_account_number, 40).replace(/\s+/g, "");
    const bankAccountName = cleanText(body.bank_account_name || accountHolderName);
    if (!bankName) throw new Error("Bank name is required.");
    if (!bankAccountNumber) throw new Error("Bank account number is required.");
    if (!bankAccountName) throw new Error("Bank account name is required.");

    return {
        payout_method: payoutMethod,
        momo_network: null,
        momo_number: null,
        bank_name: bankName,
        bank_account_number: bankAccountNumber,
        bank_account_name: bankAccountName,
        account_holder_name: accountHolderName,
        paystack_bank_code: cleanText(body.paystack_bank_code, 40) || null,
    };
}

export function payoutProfileToSnapshot(profile) {
    if (!profile) return null;
    return {
        payout_method: profile.payout_method,
        momo_network: profile.momo_network,
        momo_number: profile.momo_number,
        bank_name: profile.bank_name,
        bank_account_number: profile.bank_account_number,
        bank_account_name: profile.bank_account_name,
        account_holder_name: profile.account_holder_name,
    };
}

export function formatPayoutSnapshotLabel(snapshot) {
    if (!snapshot) return "—";
    const method = String(snapshot.payout_method || "").toLowerCase();
    if (method === "momo") {
        const network = String(snapshot.momo_network || "").toUpperCase();
        return `${network} MoMo · ${snapshot.momo_number || "—"}`;
    }
    if (method === "bank") {
        return `${snapshot.bank_name || "Bank"} · ${snapshot.bank_account_number || "—"}`;
    }
    return "—";
}

export const getTenantPayoutProfileService = async (tenantId) => {
    const res = await pool.query(
        `SELECT tenant_id, payout_method, momo_network, momo_number, bank_name,
                bank_account_number, bank_account_name, account_holder_name,
                paystack_recipient_code, paystack_bank_code, updated_at
         FROM tenant_payout_profiles
         WHERE tenant_id = $1
         LIMIT 1`,
        [tenantId]
    );
    return res.rows[0] || null;
};

export const upsertTenantPayoutProfileService = async (user, tenantId, body = {}) => {
    const profile = validateProfile(body);
    const existing = await getTenantPayoutProfileService(tenantId);
    const nextFingerprint =
        profile.payout_method === "momo"
            ? `momo|${profile.momo_network}|${profile.momo_number}`
            : `bank|${profile.paystack_bank_code || profile.bank_name}|${profile.bank_account_number}`;
    const prevFingerprint = existing
        ? existing.payout_method === "momo"
            ? `momo|${existing.momo_network}|${existing.momo_number}`
            : `bank|${existing.paystack_bank_code || existing.bank_name}|${existing.bank_account_number}`
        : null;
    const clearRecipient = prevFingerprint && prevFingerprint !== nextFingerprint;

    const res = await pool.query(
        `INSERT INTO tenant_payout_profiles (
            tenant_id, payout_method, momo_network, momo_number, bank_name,
            bank_account_number, bank_account_name, account_holder_name, paystack_bank_code,
            paystack_recipient_code, payout_details_fingerprint, updated_by, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
         ON CONFLICT (tenant_id) DO UPDATE SET
            payout_method = EXCLUDED.payout_method,
            momo_network = EXCLUDED.momo_network,
            momo_number = EXCLUDED.momo_number,
            bank_name = EXCLUDED.bank_name,
            bank_account_number = EXCLUDED.bank_account_number,
            bank_account_name = EXCLUDED.bank_account_name,
            account_holder_name = EXCLUDED.account_holder_name,
            paystack_bank_code = EXCLUDED.paystack_bank_code,
            paystack_recipient_code = CASE WHEN $13 THEN NULL ELSE tenant_payout_profiles.paystack_recipient_code END,
            payout_details_fingerprint = CASE WHEN $13 THEN NULL ELSE tenant_payout_profiles.payout_details_fingerprint END,
            updated_by = EXCLUDED.updated_by,
            updated_at = now()
         RETURNING *`,
        [
            tenantId,
            profile.payout_method,
            profile.momo_network,
            profile.momo_number,
            profile.bank_name,
            profile.bank_account_number,
            profile.bank_account_name,
            profile.account_holder_name,
            profile.paystack_bank_code,
            clearRecipient ? null : existing?.paystack_recipient_code || null,
            clearRecipient ? null : existing?.payout_details_fingerprint || null,
            user?.id || null,
            clearRecipient,
        ]
    );
    return res.rows[0];
};

export const assertTenantPayoutProfileComplete = async (tenantId) => {
    const profile = await getTenantPayoutProfileService(tenantId);
    if (!profile) {
        throw new Error("Add your payout details before requesting a withdrawal.");
    }
    validateProfile(profile);
    return profile;
};
