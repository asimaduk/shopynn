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
    onboarding: { basic: 2000, standard: 4000, premium: 6000 },
};

/** One-time onboarding line commission (15%). */
export const ONBOARDING_COMMISSION_RATE = 0.15;
/** First subscription month line commission (10%) — not 12%. */
export const SUBSCRIPTION_FIRST_MONTH_COMMISSION_RATE = 0.1;
export const ONBOARDING_COMMISSION_CLAWBACK_DAYS = 30;

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
