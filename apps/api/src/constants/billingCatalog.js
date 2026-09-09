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

/**
 * Canonical catalog seed rows (same as migrations/20260526 + 20260909_reseed).
 * Used by ensureBillingCatalogSeededService after restores that wipe the table.
 */
export const DEFAULT_BILLING_CATALOG_SEED = [
    {
        code: "plan_free_monthly",
        item_type: "subscription_monthly",
        plan_tier: "free",
        label: "Free trial",
        description: "14-day trial",
        amount_ghs: 0,
        commission_eligible: "none",
        is_active: true,
        sort_order: 0,
    },
    {
        code: "plan_basic_monthly",
        item_type: "subscription_monthly",
        plan_tier: "basic",
        label: "Basic monthly",
        description: "Monthly subscription",
        amount_ghs: 229,
        commission_eligible: "subscription_residual_5",
        is_active: true,
        sort_order: 10,
    },
    {
        code: "plan_standard_monthly",
        item_type: "subscription_monthly",
        plan_tier: "standard",
        label: "Standard monthly",
        description: "Monthly subscription",
        amount_ghs: 429,
        commission_eligible: "subscription_residual_5",
        is_active: true,
        sort_order: 20,
    },
    {
        code: "plan_premium_monthly",
        item_type: "subscription_monthly",
        plan_tier: "premium",
        label: "Premium monthly",
        description: "Monthly subscription",
        amount_ghs: 799,
        commission_eligible: "subscription_residual_5",
        is_active: true,
        sort_order: 30,
    },
    {
        code: "onboarding_basic",
        item_type: "onboarding",
        plan_tier: "basic",
        label: "Basic assisted go-live",
        description:
            "Setup & training including product import and opening stock for a typical single shop.",
        amount_ghs: 1000,
        commission_eligible: "onboarding_15",
        is_active: true,
        sort_order: 11,
    },
    {
        code: "onboarding_standard",
        item_type: "onboarding",
        plan_tier: "standard",
        label: "Standard assisted go-live",
        description:
            "Setup & training including product import and opening stock; multi-branch basics as needed.",
        amount_ghs: 2500,
        commission_eligible: "onboarding_15",
        is_active: true,
        sort_order: 21,
    },
    {
        code: "onboarding_premium",
        item_type: "onboarding",
        plan_tier: "premium",
        label: "Premium assisted go-live",
        description:
            "Setup & training including product import and opening stock; multi-user / multi-branch handoff.",
        amount_ghs: 4000,
        commission_eligible: "onboarding_15",
        is_active: true,
        sort_order: 31,
    },
    {
        code: "addon_csv_import",
        item_type: "addon",
        plan_tier: null,
        label: "CSV product import",
        description: "Included in assisted go-live — no longer sold separately.",
        amount_ghs: 500,
        commission_eligible: "none",
        is_active: false,
        sort_order: 100,
    },
    {
        code: "addon_opening_stock",
        item_type: "addon",
        plan_tier: null,
        label: "Opening stock setup",
        description: "Included in assisted go-live — no longer sold separately.",
        amount_ghs: 1000,
        commission_eligible: "none",
        is_active: false,
        sort_order: 110,
    },
    {
        code: "addon_data_migration",
        item_type: "addon",
        plan_tier: null,
        label: "Data migration",
        description:
            "Migrate products/stock from another system (beyond normal CSV / opening stock included in go-live).",
        amount_ghs: 3000,
        commission_eligible: "none",
        is_active: true,
        sort_order: 120,
    },
    {
        code: "addon_extra_training_day",
        item_type: "addon",
        plan_tier: null,
        label: "Extra training day",
        description: "Additional training day beyond assisted go-live.",
        amount_ghs: 1000,
        commission_eligible: "none",
        is_active: true,
        sort_order: 130,
    },
];

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
