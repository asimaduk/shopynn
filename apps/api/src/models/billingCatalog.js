import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import {
    SUBSCRIPTION_TYPE_TO_TIER,
    FALLBACK_CATALOG_AMOUNTS,
} from "../constants/billingCatalog.js";

const SUBSCRIPTION_META = {
    1: { name: "Free", durationDays: 14 },
    2: { name: "Basic", durationDays: 30 },
    3: { name: "Standard", durationDays: 30 },
    4: { name: "Premium", durationDays: 30 },
};

const mapRow = (row) => {
    if (!row) return null;
    return {
        ...row,
        amount_ghs: row.amount_ghs != null ? Number(row.amount_ghs) : 0,
        min_amount_ghs: row.min_amount_ghs != null ? Number(row.min_amount_ghs) : null,
        max_amount_ghs: row.max_amount_ghs != null ? Number(row.max_amount_ghs) : null,
        is_active: Boolean(row.is_active),
    };
};

export const listBillingCatalogItemsService = async ({ activeOnly = true, itemType = null } = {}) => {
    const conditions = [];
    const params = [];
    if (activeOnly) {
        conditions.push("is_active = true");
    }
    if (itemType) {
        params.push(itemType);
        conditions.push(`item_type = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const r = await pool.query(
        `SELECT id, code, item_type, plan_tier, label, description, amount_ghs, min_amount_ghs, max_amount_ghs,
                commission_eligible, is_active, sort_order, updated_at, created_at
         FROM billing_catalog_items
         ${where}
         ORDER BY sort_order ASC, label ASC`,
        params
    );
    return r.rows.map(mapRow);
};

export const getBillingCatalogItemByCodeService = async (code) => {
    const r = await pool.query(
        `SELECT id, code, item_type, plan_tier, label, description, amount_ghs, min_amount_ghs, max_amount_ghs,
                commission_eligible, is_active, sort_order
         FROM billing_catalog_items WHERE code = $1 LIMIT 1`,
        [code]
    );
    return mapRow(r.rows[0]);
};

export const getBillingCatalogItemByIdService = async (id) => {
    const r = await pool.query(
        `SELECT id, code, item_type, plan_tier, label, description, amount_ghs, min_amount_ghs, max_amount_ghs,
                commission_eligible, is_active, sort_order
         FROM billing_catalog_items WHERE id = $1 LIMIT 1`,
        [id]
    );
    return mapRow(r.rows[0]);
};

export const updateBillingCatalogItemService = async (id, patch, updatedBy = null) => {
    const existing = await getBillingCatalogItemByIdService(id);
    if (!existing) return null;

    const amount = patch.amount_ghs != null ? Number(patch.amount_ghs) : existing.amount_ghs;
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("amount_ghs must be a non-negative number.");
    }
    if (existing.code === "addon_data_migration") {
        const min = patch.min_amount_ghs != null ? Number(patch.min_amount_ghs) : existing.min_amount_ghs;
        const max = patch.max_amount_ghs != null ? Number(patch.max_amount_ghs) : existing.max_amount_ghs;
        if (min != null && amount < min) throw new Error(`amount_ghs must be at least ${min} for migration.`);
        if (max != null && amount > max) throw new Error(`amount_ghs must be at most ${max} for migration.`);
    }

    const r = await pool.query(
        `UPDATE billing_catalog_items SET
            label = COALESCE($2, label),
            description = COALESCE($3, description),
            amount_ghs = $4,
            min_amount_ghs = COALESCE($5, min_amount_ghs),
            max_amount_ghs = COALESCE($6, max_amount_ghs),
            is_active = COALESCE($7, is_active),
            updated_by = $8,
            updated_at = now()
         WHERE id = $1
         RETURNING id, code, item_type, plan_tier, label, description, amount_ghs, min_amount_ghs, max_amount_ghs,
                   commission_eligible, is_active, sort_order, updated_at`,
        [
            id,
            patch.label ?? null,
            patch.description ?? null,
            amount,
            patch.min_amount_ghs ?? null,
            patch.max_amount_ghs ?? null,
            patch.is_active ?? null,
            updatedBy,
        ]
    );
    return mapRow(r.rows[0]);
};

const monthlyCodeForTier = (tier) => `plan_${tier}_monthly`;
const onboardingCodeForTier = (tier) => `onboarding_${tier}`;

/**
 * Resolve subscription_type config: name, amount, durationDays from catalog + meta.
 */
export const resolveSubscriptionTypeConfigService = async (subscription_type) => {
    const typeNum = Number(subscription_type);
    const meta = SUBSCRIPTION_META[typeNum];
    if (!meta) {
        throw new Error("subscription_type must be 1 (Free), 2 (Basic), 3 (Standard), or 4 (Premium).");
    }
    const tier = SUBSCRIPTION_TYPE_TO_TIER[typeNum];
    let amount = FALLBACK_CATALOG_AMOUNTS.subscription_monthly[tier] ?? 0;

    if (tier !== "free") {
        const code = monthlyCodeForTier(tier);
        const row = await getBillingCatalogItemByCodeService(code);
        if (row?.is_active !== false) amount = row?.amount_ghs ?? amount;
    } else {
        amount = 0;
    }

    return {
        name: meta.name,
        amount,
        durationDays: meta.durationDays,
        tier,
        typeNum,
    };
};

export const getOnboardingFeeForTypeService = async (subscription_type) => {
    const typeNum = Number(subscription_type);
    const tier = SUBSCRIPTION_TYPE_TO_TIER[typeNum];
    if (!tier || tier === "free") return 0;
    const code = onboardingCodeForTier(tier);
    const row = await getBillingCatalogItemByCodeService(code);
    if (row?.is_active) return row.amount_ghs;
    return FALLBACK_CATALOG_AMOUNTS.onboarding[tier] ?? 0;
};

export const getActiveAddonItemsService = async () => {
    return listBillingCatalogItemsService({ activeOnly: true, itemType: "addon" });
};

export const resolveAddonItemsByCodesService = async (addonCodes = []) => {
    const codes = [...new Set((addonCodes || []).map((c) => String(c).trim()).filter(Boolean))];
    if (codes.length === 0) return [];

    const r = await pool.query(
        `SELECT id, code, item_type, plan_tier, label, description, amount_ghs, commission_eligible, sort_order
         FROM billing_catalog_items
         WHERE item_type = 'addon' AND is_active = true AND code = ANY($1::text[])
         ORDER BY sort_order ASC`,
        [codes]
    );
    const found = r.rows.map(mapRow);
    const missing = codes.filter((c) => !found.some((f) => f.code === c));
    if (missing.length) {
        throw new Error(`Unknown or inactive add-on(s): ${missing.join(", ")}`);
    }
    return found;
};

/** Grouped catalog for clients: plans + addons */
export const getBillingCatalogGroupedService = async () => {
    const items = await listBillingCatalogItemsService({ activeOnly: true });
    const plans = {};
    const addons = [];
    for (const item of items) {
        if (item.item_type === "addon") {
            addons.push(item);
            continue;
        }
        const tier = item.plan_tier || "other";
        if (!plans[tier]) plans[tier] = {};
        plans[tier][item.item_type] = item;
    }
    return { items, plans, addons };
};

export const createBillingCatalogItemService = async (payload, updatedBy = null) => {
    if (payload.item_type !== "addon") {
        throw new Error("Only add-on catalog rows can be created via API in v1.");
    }
    const id = uuidv4();
    const code = String(payload.code || "").trim();
    if (!code) throw new Error("code is required.");
    await pool.query(
        `INSERT INTO billing_catalog_items (
            id, code, item_type, plan_tier, label, description, amount_ghs, min_amount_ghs, max_amount_ghs,
            commission_eligible, is_active, sort_order, updated_by, created_at, updated_at
        ) VALUES ($1,$2,'addon',NULL,$3,$4,$5,$6,$7,'none',COALESCE($8,true),COALESCE($9,200),$10,now(),now())`,
        [
            id,
            code,
            payload.label || code,
            payload.description || null,
            Number(payload.amount_ghs) || 0,
            payload.min_amount_ghs ?? null,
            payload.max_amount_ghs ?? null,
            payload.is_active,
            payload.sort_order,
            updatedBy,
        ]
    );
    return getBillingCatalogItemByIdService(id);
};
