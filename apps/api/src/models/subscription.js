import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { resolveSubscriptionTypeConfigService } from "./billingCatalog.js";

/** Tier metadata (duration); amounts come from billing_catalog_items. */
const SUBSCRIPTION_TYPES = {
    1: { name: "Free", amount: 0, durationDays: 14 },
    2: { name: "Basic", amount: 229, durationDays: 30 },
    3: { name: "Standard", amount: 429, durationDays: 30 },
    4: { name: "Premium", amount: 799, durationDays: 30 },
};

const NAME_TO_DURATION_DAYS = { Free: 14, Basic: 30, Standard: 30, Premium: 30 };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseSubscriptionFeaturesMeta = (raw) => {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
};

/** Tier rank for upgrade comparisons (higher = more capable). */
export const getSubscriptionTypeRank = (nameOrTypeNum) => {
    if (typeof nameOrTypeNum === "number" && SUBSCRIPTION_TYPES[nameOrTypeNum]) {
        return nameOrTypeNum;
    }
    const key = normalizeTierCode(nameOrTypeNum);
    if (key === "free") return 1;
    if (key === "basic") return 2;
    if (key === "standard") return 3;
    if (key === "premium") return 4;
    return 0;
};

/**
 * Remaining paid time on the current plan → GHS credit → equivalent days on the new plan.
 * @returns {{ creditDays: number, creditValueGhs: number, remainingDays: number }}
 */
export const computeUpgradeCreditDays = (currentSub, newConfig) => {
    const now = new Date();
    const endAt = currentSub?.end_at ? new Date(currentSub.end_at) : now;
    if (endAt <= now) {
        return { creditDays: 0, creditValueGhs: 0, remainingDays: 0 };
    }

    const remainingDays = (endAt.getTime() - now.getTime()) / MS_PER_DAY;
    const oldAmount = Number(currentSub?.amount) || 0;
    const oldPeriodDays = NAME_TO_DURATION_DAYS[currentSub?.name] ?? 30;
    const newAmount = Number(newConfig?.amount) || 0;
    const newPeriodDays = Number(newConfig?.durationDays) || 30;

    if (remainingDays <= 0 || oldAmount <= 0 || newAmount <= 0) {
        return { creditDays: 0, creditValueGhs: 0, remainingDays: 0 };
    }

    const creditValueGhs = remainingDays * (oldAmount / oldPeriodDays);
    const creditDays = creditValueGhs / (newAmount / newPeriodDays);

    return {
        creditDays: Math.max(0, Math.round(creditDays * 100) / 100),
        creditValueGhs: Math.round(creditValueGhs * 100) / 100,
        remainingDays: Math.round(remainingDays * 100) / 100,
    };
};

export const getTenantLinkedSubscriptionService = async (tenant_id) => {
    const result = await pool.query(
        `SELECT s.id, s.name, s.amount, s.billing_interval, s.status, s.start_at, s.end_at, s.features
         FROM tenants t
         INNER JOIN subscriptions s ON s.id = t.subscription_id
         WHERE t.id = $1`,
        [tenant_id]
    );
    return result.rows[0] || null;
};

/** Max users / warehouses (branches) per tier — align with docs/PRICING_PACKAGES.md */
const TIER_LIMITS = {
    free: { maxUsers: 3, maxWarehouses: 1 },
    basic: { maxUsers: 3, maxWarehouses: 1 },
    standard: { maxUsers: 12, maxWarehouses: 5 },
    premium: { maxUsers: 25, maxWarehouses: 10 },
};

const normalizeTierCode = (name) => String(name || "").trim().toLowerCase();

const parseFeatureList = (value) => {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map((f) => String(f).trim().toLowerCase()).filter(Boolean);
        return [String(parsed).trim().toLowerCase()].filter(Boolean);
    } catch {
        return String(value)
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
    }
};

/**
 * Resolve plan caps for a tenant from linked subscription name.
 * Unknown / missing subscription defaults to Basic limits.
 */
export const getTenantSubscriptionLimitsService = async (tenant_id) => {
    const { rows } = await pool.query(
        `SELECT s.name AS subscription_name
         FROM tenants t
         LEFT JOIN subscriptions s ON s.id = t.subscription_id
         WHERE t.id = $1`,
        [tenant_id]
    );
    const rawName = rows[0]?.subscription_name;
    const key = normalizeTierCode(rawName) || "basic";
    const lim = TIER_LIMITS[key] ?? TIER_LIMITS.basic;
    const tierDisplay =
        rawName != null && String(rawName).trim() !== "" ? String(rawName).trim() : "Basic";
    return {
        tierCode: key,
        tierDisplay,
        maxUsers: lim.maxUsers,
        maxWarehouses: lim.maxWarehouses,
        /** Same numeric cap as branches (warehouses); used for locations.create */
        maxLocations: lim.maxWarehouses,
    };
};

/**
 * Plan caps plus current counts (users, warehouses, locations) for a tenant.
 */
export const getTenantSubscriptionUsageService = async (tenant_id) => {
    if (!tenant_id) {
        return {
            tierCode: "basic",
            tierDisplay: "Basic",
            maxUsers: TIER_LIMITS.basic.maxUsers,
            maxWarehouses: TIER_LIMITS.basic.maxWarehouses,
            maxLocations: TIER_LIMITS.basic.maxWarehouses,
            userCount: 0,
            warehouseCount: 0,
            locationCount: 0,
        };
    }
    const limits = await getTenantSubscriptionLimitsService(tenant_id);
    const [userCountRes, warehouseCountRes, locationCountRes] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE tenant_id = $1 AND (deleted IS NOT TRUE)`, [tenant_id]),
        pool.query(`SELECT COUNT(*)::int AS n FROM warehouses WHERE tenant_id = $1`, [tenant_id]),
        pool.query(`SELECT COUNT(*)::int AS n FROM locations WHERE tenant_id = $1`, [tenant_id]),
    ]);
    return {
        tierCode: limits.tierCode,
        tierDisplay: limits.tierDisplay,
        maxUsers: limits.maxUsers,
        maxWarehouses: limits.maxWarehouses,
        maxLocations: limits.maxLocations,
        userCount: userCountRes.rows[0]?.n ?? 0,
        warehouseCount: warehouseCountRes.rows[0]?.n ?? 0,
        locationCount: locationCountRes.rows[0]?.n ?? 0,
    };
};

/** @returns {{ ok: true } | { ok: false, message: string }}} */
export const checkTenantCanAddUser = async (tenant_id, { isOnboarding = false } = {}) => {
    if (!tenant_id) return { ok: false, message: "Invalid tenant." };
    if (isOnboarding) return { ok: true };
    const limits = await getTenantSubscriptionLimitsService(tenant_id);
    const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM users WHERE tenant_id = $1 AND (deleted IS NOT TRUE)`,
        [tenant_id]
    );
    const n = rows[0]?.n ?? 0;
    if (n >= limits.maxUsers) {
        return {
            ok: false,
            message: `Your ${limits.tierDisplay} plan allows up to ${limits.maxUsers} users. Remove a user or upgrade your subscription to add more.`,
        };
    }
    return { ok: true };
};

/** @returns {{ ok: true } | { ok: false, message: string }}} */
export const checkTenantCanAddWarehouse = async (tenant_id) => {
    if (!tenant_id) return { ok: false, message: "Invalid tenant." };
    const limits = await getTenantSubscriptionLimitsService(tenant_id);
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM warehouses WHERE tenant_id = $1`, [tenant_id]);
    const n = rows[0]?.n ?? 0;
    if (n >= limits.maxWarehouses) {
        return {
            ok: false,
            message: `Your ${limits.tierDisplay} plan allows up to ${limits.maxWarehouses} branches (warehouses). Remove or merge a branch or upgrade your subscription.`,
        };
    }
    return { ok: true };
};

/** @returns {{ ok: true } | { ok: false, message: string }}} */
export const checkTenantCanAddLocation = async (tenant_id) => {
    if (!tenant_id) return { ok: false, message: "Invalid tenant." };
    const limits = await getTenantSubscriptionLimitsService(tenant_id);
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM locations WHERE tenant_id = $1`, [tenant_id]);
    const n = rows[0]?.n ?? 0;
    if (n >= limits.maxLocations) {
        return {
            ok: false,
            message: `Your ${limits.tierDisplay} plan allows up to ${limits.maxLocations} locations. Remove a location or upgrade your subscription.`,
        };
    }
    return { ok: true };
};

export const resolveSubscriptionFeatureCodesService = async ({ subscriptionId, subscriptionName, fallbackFeatures }) => {
    const tierCode = normalizeTierCode(subscriptionName);
    let mappedFeatures = [];
    if (tierCode) {
        const tierFeaturesRes = await pool.query(
            `SELECT sf.feature_code
             FROM subscription_tiers st
             INNER JOIN subscription_tier_features sf ON sf.tier_id = st.id
             WHERE lower(st.code) = $1 OR lower(st.name) = $1`,
            [tierCode]
        );
        mappedFeatures = tierFeaturesRes.rows
            .map((r) => String(r.feature_code || "").trim().toLowerCase())
            .filter(Boolean);
    }

    if (mappedFeatures.length > 0) {
        return [...new Set(mappedFeatures)];
    }

    const fallback = parseFeatureList(fallbackFeatures);
    return [...new Set(fallback)];
};

/**
 * Upgrade to a higher paid tier: create a pending subscription with prorated bonus days.
 * Tenant keeps the current active plan until payment succeeds.
 */
export const upgradeSubscriptionService = async (tenant_id, subscription_type) => {
    const typeNum = Number(subscription_type);
    if (!Number.isInteger(typeNum) || typeNum < 1 || typeNum > 4) {
        throw new Error("subscription_type must be 1 (Free), 2 (Basic), 3 (Standard), or 4 (Premium).");
    }

    const config = await resolveSubscriptionTypeConfigService(typeNum);
    const current = await getTenantLinkedSubscriptionService(tenant_id);
    if (!current) {
        const created = await onboardSubscriptionService(tenant_id, subscription_type);
        return { ...created, is_upgrade: false, upgrade_credit_days: 0, upgrade_credit_value_ghs: 0 };
    }

    const currentRank = getSubscriptionTypeRank(current.name);
    if (typeNum <= currentRank) {
        throw new Error("Choose a plan tier above your current subscription to upgrade.");
    }

    const now = new Date();
    const isActive =
        String(current.status || "").toLowerCase() === "active" &&
        (!current.end_at || new Date(current.end_at) > now);

    if (!isActive) {
        const created = await onboardSubscriptionService(tenant_id, subscription_type);
        return { ...created, is_upgrade: false, upgrade_credit_days: 0, upgrade_credit_value_ghs: 0 };
    }

    const { creditDays, creditValueGhs, remainingDays } = computeUpgradeCreditDays(current, config);
    const bonusDays = Math.floor(creditDays);
    const features = JSON.stringify({
        upgrade_credit_days: creditDays,
        upgrade_bonus_days: bonusDays,
        upgrade_credit_value_ghs: creditValueGhs,
        upgraded_from_subscription_id: current.id,
        upgraded_from_plan: current.name,
        remaining_days_on_old_plan: remainingDays,
    });

    const id = uuidv4();
    const placeholderEnd = new Date();
    await pool.query(
        `INSERT INTO subscriptions (id, name, amount, billing_interval, status, start_at, end_at, features, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $8)`,
        [id, config.name, config.amount, "monthly", now, placeholderEnd, features, new Date()]
    );

    const projectedEnd = new Date();
    projectedEnd.setDate(projectedEnd.getDate() + config.durationDays + bonusDays);

    return {
        id,
        name: config.name,
        amount: config.amount,
        billing_interval: "monthly",
        status: "pending",
        start_at: now,
        end_at: projectedEnd,
        tenant_id,
        is_upgrade: true,
        upgrade_credit_days: creditDays,
        upgrade_bonus_days: bonusDays,
        upgrade_credit_value_ghs: creditValueGhs,
        current_subscription_id: current.id,
        current_plan: current.name,
        projected_end_at: projectedEnd,
    };
};

/**
 * Onboard or upgrade: first plan, renewal-style change, or prorated upgrade from active paid tier.
 */
export const changeSubscriptionPlanService = async (tenant_id, subscription_type) => {
    const typeNum = Number(subscription_type);
    const current = await getTenantLinkedSubscriptionService(tenant_id);
    if (!current) {
        const created = await onboardSubscriptionService(tenant_id, subscription_type);
        return { ...created, is_upgrade: false, upgrade_credit_days: 0, upgrade_credit_value_ghs: 0 };
    }

    const now = new Date();
    const isActive =
        String(current.status || "").toLowerCase() === "active" &&
        (!current.end_at || new Date(current.end_at) > now);
    const isUpgrade = isActive && typeNum > getSubscriptionTypeRank(current.name);

    if (isUpgrade) {
        return upgradeSubscriptionService(tenant_id, subscription_type);
    }
    return onboardSubscriptionService(tenant_id, subscription_type);
};

/**
 * Create a subscription for onboarding and link it to a tenant.
 * subscription_type: 1=Free, 2=Basic, 3=Standard, 4=Premium.
 * amount and duration derived from type (Free=0, 2 weeks; paid tiers=229/429/799 GHS, 1 month).
 * billing_interval = monthly; start_at = now; end_at = start + duration.
 */
export const onboardSubscriptionService = async (tenant_id, subscription_type) => {
    const typeNum = Number(subscription_type);
    if (!Number.isInteger(typeNum) || typeNum < 1 || typeNum > 4) {
        throw new Error("subscription_type must be 1 (Free), 2 (Basic), 3 (Standard), or 4 (Premium).");
    }

    const config = await resolveSubscriptionTypeConfigService(typeNum);
    const start_at = new Date();
    const end_at = new Date(start_at);
    end_at.setDate(end_at.getDate() + config.durationDays);
    const status = typeNum === 1 ? "active" : "pending";

    const id = uuidv4();
    await pool.query(
        `INSERT INTO subscriptions (id, name, amount, billing_interval, status, start_at, end_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [id, config.name, config.amount, "monthly", status, start_at, end_at, new Date()]
    );

    const updateResult = await pool.query(
        "UPDATE tenants SET subscription_id = $1, updated_at = $2 WHERE id = $3 RETURNING id",
        [id, new Date(), tenant_id]
    );

    if (updateResult.rowCount === 0) {
        throw new Error("Tenant not found.");
    }

    return {
        id,
        name: config.name,
        amount: config.amount,
        billing_interval: "monthly",
        status,
        start_at,
        end_at,
        tenant_id,
        is_upgrade: false,
        upgrade_credit_days: 0,
        upgrade_credit_value_ghs: 0,
    };
};

/**
 * Get current subscription details for the tenant plus up to 4 recent payments.
 * Returns subscription (with parsed features) and recentPayments array.
 */
export const getCurrentSubscriptionWithPaymentsService = async (user, options = {}) => {
    const tenant_id = user.tenant_id;
    const paymentsLimit = Math.min(Math.max(Number(options.paymentsLimit) || 4, 1), 200);

    const subResult = await pool.query(
        `SELECT s.id, s.name, s.description, s.amount, s.billing_interval, s.status, s.start_at, s.end_at, s.features, s.created_at, s.updated_at
         FROM tenants t
         INNER JOIN subscriptions s ON t.subscription_id = s.id
         WHERE t.id = $1`,
        [tenant_id]
    );

    if (subResult.rows.length === 0) {
        return { subscription: null, recentPayments: [] };
    }

    const sub = subResult.rows[0];
    const features = await resolveSubscriptionFeatureCodesService({
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        fallbackFeatures: sub.features,
    });

    const usage = await getTenantSubscriptionUsageService(tenant_id);

    const subscription = {
        id: sub.id,
        name: sub.name,
        description: sub.description ?? null,
        amount: sub.amount != null ? Number(sub.amount) : null,
        billing_interval: sub.billing_interval ?? null,
        status: sub.status ?? "active",
        start_at: sub.start_at,
        end_at: sub.end_at,
        features,
        created_at: sub.created_at,
        updated_at: sub.updated_at ?? null,
        limits: {
            maxUsers: usage.maxUsers,
            maxWarehouses: usage.maxWarehouses,
            maxLocations: usage.maxLocations,
            userCount: usage.userCount,
            warehouseCount: usage.warehouseCount,
            locationCount: usage.locationCount,
        },
    };

    const paymentsResult = await pool.query(
        `SELECT id, amount, payment_method_type, transaction_ref, status, created_at
         FROM payments
         WHERE tenant_id = $1
           AND order_id IS NULL
         ORDER BY created_at DESC
         LIMIT $2`,
        [tenant_id, paymentsLimit]
    );

    const recentPayments = paymentsResult.rows.map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        payment_method_type: row.payment_method_type,
        transaction_ref: row.transaction_ref,
        status: row.status,
        created_at: row.created_at,
    }));

    return { subscription, recentPayments };
};

/**
 * Activate a pending subscription when payment is made.
 * Sets status to 'active', start_at and end_at to the payment date (end_at = start_at + duration from plan name).
 */
export const activatePendingSubscriptionService = async (subscription_id, tenant_id = null) => {
    const getResult = await pool.query(
        "SELECT id, name, status, features FROM subscriptions WHERE id = $1",
        [subscription_id]
    );
    if (getResult.rows.length === 0) {
        throw new Error("Subscription not found.");
    }
    const row = getResult.rows[0];
    if (String(row.status || "").toLowerCase() === "active") {
        const current = await pool.query(
            "SELECT id, name, amount, billing_interval, status, start_at, end_at, created_at, updated_at FROM subscriptions WHERE id = $1",
            [subscription_id]
        );
        if (tenant_id) {
            await pool.query("UPDATE tenants SET subscription_id = $1, updated_at = $2 WHERE id = $3", [
                subscription_id,
                new Date(),
                tenant_id,
            ]);
        }
        return current.rows[0];
    }
    if (row.status !== "pending") {
        throw new Error("Only pending subscriptions can be activated.");
    }

    const meta = parseSubscriptionFeaturesMeta(row.features);
    const bonusDays = Math.max(0, Math.floor(Number(meta.upgrade_bonus_days ?? meta.upgrade_credit_days) || 0));
    const durationDays = NAME_TO_DURATION_DAYS[row.name] ?? 30;
    const start_at = new Date();
    const end_at = new Date(start_at);
    end_at.setDate(end_at.getDate() + durationDays + bonusDays);
    const now = new Date();

    await pool.query(
        `UPDATE subscriptions SET status = $1, start_at = $2, end_at = $3, updated_at = $4 WHERE id = $5`,
        ["active", start_at, end_at, now, subscription_id]
    );

    if (tenant_id) {
        await pool.query("UPDATE tenants SET subscription_id = $1, updated_at = $2 WHERE id = $3", [
            subscription_id,
            now,
            tenant_id,
        ]);
    }

    const updated = await pool.query(
        "SELECT id, name, amount, billing_interval, status, start_at, end_at, created_at, updated_at FROM subscriptions WHERE id = $1",
        [subscription_id]
    );
    const result = updated.rows[0];
    if (result && bonusDays > 0) {
        result.upgrade_bonus_days = bonusDays;
    }
    return result;
};
