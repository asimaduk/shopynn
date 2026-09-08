import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import {
    QUOTE_STATUS,
    QUOTE_KIND,
    ONBOARDING_COMMISSION_RATE,
    SUBSCRIPTION_RESIDUAL_COMMISSION_RATE,
    ONBOARDING_COMMISSION_CLAWBACK_DAYS,
    SUBSCRIPTION_TYPE_TO_TIER,
    COMMISSION_KIND,
    COMMISSION_ELIGIBLE,
} from "../constants/billingCatalog.js";
import {
    resolveSubscriptionTypeConfigService,
    getOnboardingFeeForTypeService,
    resolveAddonItemsByCodesService,
} from "./billingCatalog.js";
import {
    changeSubscriptionPlanService,
    getTenantLinkedSubscriptionService,
    getSubscriptionTypeRank,
} from "./subscription.js";

const round2 = (n) => Math.round(Number(n) * 100) / 100;

const mapQuote = (row, lines = []) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    merchant_id: row.merchant_id,
    subscription_type: row.subscription_type,
    subscription_id: row.subscription_id,
    status: row.status,
    total_ghs: Number(row.total_ghs),
    owner_email: row.owner_email,
    quote_kind: row.quote_kind,
    paid_at: row.paid_at,
    created_at: row.created_at,
    lines,
});

export const buildQuoteLinesForOnboardService = async (subscription_type, addon_codes = []) => {
    const typeNum = Number(subscription_type);
    const tier = SUBSCRIPTION_TYPE_TO_TIER[typeNum];
    const lines = [];
    let sort = 0;

    if (typeNum === 1) {
        const addons = await resolveAddonItemsByCodesService(addon_codes);
        for (const a of addons) {
            lines.push({
                catalog_item_id: a.id,
                code: a.code,
                line_type: "addon",
                label: a.label,
                amount_ghs: a.amount_ghs,
                commission_eligible: "none",
                sort_order: sort++,
            });
        }
        return { lines, total_ghs: round2(lines.reduce((s, l) => s + l.amount_ghs, 0)), tier };
    }

    const subConfig = await resolveSubscriptionTypeConfigService(typeNum);
    const onboardingAmount = await getOnboardingFeeForTypeService(typeNum);

    if (onboardingAmount > 0) {
        lines.push({
            code: `onboarding_${tier}`,
            line_type: "onboarding",
            label: `${subConfig.name} onboarding`,
            amount_ghs: onboardingAmount,
            commission_eligible: "onboarding_15",
            sort_order: sort++,
        });
    }

    if (subConfig.amount > 0) {
        lines.push({
            code: `plan_${tier}_monthly`,
            line_type: "subscription_monthly",
            label: `${subConfig.name} — first month`,
            amount_ghs: subConfig.amount,
            commission_eligible: COMMISSION_ELIGIBLE.SUBSCRIPTION_RESIDUAL_5,
            sort_order: sort++,
        });
    }

    const addons = await resolveAddonItemsByCodesService(addon_codes);
    for (const a of addons) {
        lines.push({
            catalog_item_id: a.id,
            code: a.code,
            line_type: "addon",
            label: a.label,
            amount_ghs: a.amount_ghs,
            commission_eligible: "none",
            sort_order: sort++,
        });
    }

    const total_ghs = round2(lines.reduce((s, l) => s + l.amount_ghs, 0));
    return { lines, total_ghs, tier };
};

export const buildQuoteLinesAddonOnlyService = async (addon_codes = []) => {
    const addons = await resolveAddonItemsByCodesService(addon_codes);
    const lines = addons.map((a, i) => ({
        catalog_item_id: a.id,
        code: a.code,
        line_type: "addon",
        label: a.label,
        amount_ghs: a.amount_ghs,
        commission_eligible: "none",
        sort_order: i,
    }));
    const total_ghs = round2(lines.reduce((s, l) => s + l.amount_ghs, 0));
    if (total_ghs <= 0) throw new Error("Select at least one paid add-on.");
    return { lines, total_ghs };
};

export const insertOnboardingQuoteService = async ({
    tenant_id,
    merchant_id,
    subscription_type,
    subscription_id,
    owner_email,
    lines,
    total_ghs,
    status,
    quote_kind,
}) => {
    const quoteId = uuidv4();
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `INSERT INTO onboarding_quotes (
                id, tenant_id, merchant_id, subscription_type, subscription_id, status, total_ghs,
                owner_email, quote_kind, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())`,
            [
                quoteId,
                tenant_id,
                merchant_id || null,
                subscription_type,
                subscription_id || null,
                status,
                total_ghs,
                owner_email || null,
                quote_kind,
            ]
        );
        for (const line of lines) {
            await client.query(
                `INSERT INTO onboarding_quote_lines (
                    id, quote_id, catalog_item_id, code, line_type, label, amount_ghs, commission_eligible, sort_order, created_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
                [
                    uuidv4(),
                    quoteId,
                    line.catalog_item_id || null,
                    line.code,
                    line.line_type,
                    line.label,
                    line.amount_ghs,
                    line.commission_eligible || "none",
                    line.sort_order ?? 0,
                ]
            );
        }
        await client.query("COMMIT");
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
    return getOnboardingQuoteByIdService(quoteId);
};

export const getOnboardingQuoteLinesService = async (quoteId) => {
    const r = await pool.query(
        `SELECT id, quote_id, catalog_item_id, code, line_type, label, amount_ghs, commission_eligible, sort_order
         FROM onboarding_quote_lines WHERE quote_id = $1 ORDER BY sort_order ASC`,
        [quoteId]
    );
    return r.rows.map((row) => ({
        ...row,
        amount_ghs: Number(row.amount_ghs),
    }));
};

export const getOnboardingQuoteByIdService = async (quoteId) => {
    const r = await pool.query(`SELECT * FROM onboarding_quotes WHERE id = $1 LIMIT 1`, [quoteId]);
    if (!r.rows[0]) return null;
    const lines = await getOnboardingQuoteLinesService(quoteId);
    return mapQuote(r.rows[0], lines);
};

export const getPendingQuoteForTenantService = async (tenantId) => {
    const r = await pool.query(
        `SELECT * FROM onboarding_quotes
         WHERE tenant_id = $1 AND status = $2
         ORDER BY created_at DESC LIMIT 1`,
        [tenantId, QUOTE_STATUS.PENDING_PAYMENT]
    );
    if (!r.rows[0]) return null;
    const lines = await getOnboardingQuoteLinesService(r.rows[0].id);
    return mapQuote(r.rows[0], lines);
};

export const merchantCanAccessTenantService = async (merchantId, tenantId) => {
    const serving = await pool.query(
        `SELECT 1 FROM tenants WHERE id = $1 AND serving_merchant_id = $2 LIMIT 1`,
        [tenantId, merchantId]
    );
    if (serving.rowCount > 0) return true;
    const r = await pool.query(
        `SELECT 1 FROM merchant_commissions WHERE merchant_id = $1 AND tenant_id = $2 LIMIT 1`,
        [merchantId, tenantId]
    );
    if (r.rowCount > 0) return true;
    const q = await pool.query(
        `SELECT 1 FROM onboarding_quotes WHERE merchant_id = $1 AND tenant_id = $2 LIMIT 1`,
        [merchantId, tenantId]
    );
    return q.rowCount > 0;
};

const isSubscriptionResidualEligible = (tag) =>
    tag === COMMISSION_ELIGIBLE.SUBSCRIPTION_RESIDUAL_5 ||
    tag === COMMISSION_ELIGIBLE.SUBSCRIPTION_FIRST_MONTH_10;

export const computeCommissionFromLines = (lines) => {
    let onboardingBase = 0;
    let subscriptionBase = 0;
    for (const line of lines) {
        const amt = Number(line.amount_ghs) || 0;
        if (line.commission_eligible === COMMISSION_ELIGIBLE.ONBOARDING_15) onboardingBase += amt;
        if (isSubscriptionResidualEligible(line.commission_eligible)) subscriptionBase += amt;
    }
    const onboarding_commission_amount = round2(onboardingBase * ONBOARDING_COMMISSION_RATE);
    const subscription_commission_amount = round2(subscriptionBase * SUBSCRIPTION_RESIDUAL_COMMISSION_RATE);
    const commission_amount = round2(onboarding_commission_amount + subscription_commission_amount);
    const base_amount = round2(onboardingBase + subscriptionBase);
    return {
        base_amount,
        onboarding_commission_amount,
        subscription_commission_amount,
        commission_amount,
        commission_percent: 0,
    };
};

export const markQuotePaidService = async (quoteId) => {
    await pool.query(
        `UPDATE onboarding_quotes SET status = $2, paid_at = now(), updated_at = now() WHERE id = $1`,
        [quoteId, QUOTE_STATUS.PAID]
    );
};

export const finalizeMerchantCommissionForQuoteService = async (quoteId, merchantId, tenantId, subscriptionId) => {
    const quote = await getOnboardingQuoteByIdService(quoteId);
    if (!quote) return null;
    const comm = computeCommissionFromLines(quote.lines);
    if (comm.commission_amount <= 0) return null;

    const payableAfter = new Date();
    payableAfter.setDate(payableAfter.getDate() + ONBOARDING_COMMISSION_CLAWBACK_DAYS);

    const existing = await pool.query(
        `SELECT id FROM merchant_commissions WHERE quote_id = $1 LIMIT 1`,
        [quoteId]
    );
    if (existing.rowCount > 0) {
        return existing.rows[0];
    }

    const commId = uuidv4();
    await pool.query(
        `INSERT INTO merchant_commissions (
            id, merchant_id, tenant_id, subscription_id, quote_id,
            base_amount, commission_percent, commission_amount,
            onboarding_commission_amount, subscription_commission_amount,
            status, payable_after, commission_kind, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,'pending',$10,$11,now())`,
        [
            commId,
            merchantId,
            tenantId,
            subscriptionId,
            quoteId,
            comm.base_amount,
            comm.commission_amount,
            comm.onboarding_commission_amount,
            comm.subscription_commission_amount,
            payableAfter,
            COMMISSION_KIND.ACQUISITION,
        ]
    );
    return { id: commId, ...comm, status: "pending", payable_after: payableAfter };
};

export const tenantHasPaidOnboardingBundleService = async (tenantId) => {
    const r = await pool.query(
        `SELECT 1 FROM onboarding_quotes
         WHERE tenant_id = $1 AND status = $2
           AND quote_kind IN ($3, $4)
         LIMIT 1`,
        [tenantId, QUOTE_STATUS.PAID, QUOTE_KIND.FULL_ONBOARD, QUOTE_KIND.UPGRADE_COLLECT]
    );
    return r.rowCount > 0;
};

export const createUpgradeCollectQuoteForTenantService = async ({
    tenant_id,
    merchant_id,
    subscription_type,
    addon_codes = [],
    owner_email,
}) => {
    const typeNum = Number(subscription_type);
    if (!Number.isInteger(typeNum) || typeNum < 2 || typeNum > 4) {
        throw new Error("Choose Basic, Standard, or Premium for upgrade & collect.");
    }

    if (await tenantHasPaidOnboardingBundleService(tenant_id)) {
        throw new Error("Onboarding was already paid for this business.");
    }

    const current = await getTenantLinkedSubscriptionService(tenant_id);
    if (current) {
        const rank = getSubscriptionTypeRank(current.name);
        const now = new Date();
        const isActivePaid =
            rank >= 2 &&
            String(current.status || "").toLowerCase() === "active" &&
            (!current.end_at || new Date(current.end_at) > now);
        if (isActivePaid) {
            throw new Error(
                "This business is already on a paid plan. Use Add services for optional setup fees only."
            );
        }
    }

    const pendingSub = await changeSubscriptionPlanService(tenant_id, typeNum);
    const { lines, total_ghs } = await buildQuoteLinesForOnboardService(typeNum, addon_codes);
    if (total_ghs <= 0) {
        throw new Error("Quote total must be greater than zero.");
    }

    let resolvedEmail =
        owner_email != null && String(owner_email).trim() !== "" ? String(owner_email).trim() : null;
    if (!resolvedEmail) {
        const tenantRow = await pool.query(`SELECT email FROM tenants WHERE id = $1`, [tenant_id]);
        resolvedEmail = tenantRow.rows[0]?.email ? String(tenantRow.rows[0].email).trim() : null;
    }
    if (!resolvedEmail) {
        throw new Error("owner_email is required for upgrade & collect.");
    }

    return insertOnboardingQuoteService({
        tenant_id,
        merchant_id,
        subscription_type: typeNum,
        subscription_id: pendingSub.id,
        owner_email: resolvedEmail,
        lines,
        total_ghs,
        status: QUOTE_STATUS.PENDING_PAYMENT,
        quote_kind: QUOTE_KIND.UPGRADE_COLLECT,
    });
};

export const createAddonOnlyQuoteForTenantService = async ({
    tenant_id,
    merchant_id,
    owner_email,
    addon_codes,
}) => {
    const { lines, total_ghs } = await buildQuoteLinesAddonOnlyService(addon_codes);
    const tenantRow = await pool.query(
        `SELECT t.subscription_id, s.name FROM tenants t LEFT JOIN subscriptions s ON s.id = t.subscription_id WHERE t.id = $1`,
        [tenant_id]
    );
    const sub = tenantRow.rows[0];
    return insertOnboardingQuoteService({
        tenant_id,
        merchant_id,
        subscription_type: 1,
        subscription_id: sub?.subscription_id || null,
        owner_email,
        lines,
        total_ghs,
        status: QUOTE_STATUS.PENDING_PAYMENT,
        quote_kind: QUOTE_KIND.ADDON_ONLY,
    });
};
