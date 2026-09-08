/** subscription_type (1–4) ↔ catalog plan_tier */
export const SUBSCRIPTION_TYPE_TO_TIER = {
    1: "free",
    2: "basic",
    3: "standard",
    4: "premium",
};

export const TIER_TO_SUBSCRIPTION_TYPE = {
    free: 1,
    basic: 2,
    standard: 3,
    premium: 4,
};

/** Fallback amounts if DB catalog is empty (matches seed migration). */
export const FALLBACK_CATALOG_AMOUNTS = {
    subscription_monthly: { free: 0, basic: 229, standard: 429, premium: 799 },
    onboarding: { basic: 1000, standard: 2500, premium: 4000 },
};

/** One-time assisted onboarding line commission (15%). */
export const ONBOARDING_COMMISSION_RATE = 0.15;
/**
 * Residual commission on paid subscription months (including first), while a serving agent is assigned.
 * Replaces the former one-time 10% first-month special.
 */
export const SUBSCRIPTION_RESIDUAL_COMMISSION_RATE = 0.05;
/** @deprecated Use SUBSCRIPTION_RESIDUAL_COMMISSION_RATE — kept for older quote line tags. */
export const SUBSCRIPTION_FIRST_MONTH_COMMISSION_RATE = SUBSCRIPTION_RESIDUAL_COMMISSION_RATE;
export const ONBOARDING_COMMISSION_CLAWBACK_DAYS = 30;

export const COMMISSION_KIND = {
    ACQUISITION: "acquisition",
    RESIDUAL: "residual",
};

export const COMMISSION_ELIGIBLE = {
    ONBOARDING_15: "onboarding_15",
    SUBSCRIPTION_RESIDUAL_5: "subscription_residual_5",
    /** Legacy quote snapshots — treated as residual 5%. */
    SUBSCRIPTION_FIRST_MONTH_10: "subscription_first_month_10",
    NONE: "none",
};

export const QUOTE_STATUS = {
    PENDING_PAYMENT: "pending_payment",
    PAID: "paid",
    NOT_REQUIRED: "not_required",
    CANCELLED: "cancelled",
};

export const QUOTE_KIND = {
    FULL_ONBOARD: "full_onboard",
    ADDON_ONLY: "addon_only",
    /** Paid plan + onboarding for an existing tenant (e.g. after Free trial demo). */
    UPGRADE_COLLECT: "upgrade_collect",
};
