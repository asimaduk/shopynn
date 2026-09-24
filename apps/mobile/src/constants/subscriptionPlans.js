/** Paid tiers for in-app choose / upgrade (matches ims-web billing/subscriptionPlans.ts).
 * Marketing names: Starter / Business / Scale (API still uses basic / standard / premium).
 */
export const MONTHLY_SUBSCRIPTION_AMOUNTS_GHS = {
    basic: 149,
    standard: 349,
    premium: 649,
};

export const CHOOSEABLE_SUBSCRIPTION_PLANS = [
    {
        key: 2,
        name: 'Starter',
        amount: MONTHLY_SUBSCRIPTION_AMOUNTS_GHS.basic,
        billing: 'Monthly',
        description: 'Best for a single store getting started.',
        features: [
            '1 branch · up to 3 users',
            'Inventory, products & categories (create, import, export)',
            'Sales & purchases with returns',
            'Share or print sales receipts',
            'Daily sales trends & sales-by-date history',
            'Customers, suppliers & expenditures',
            'Dashboard, company profile & receipt settings',
        ],
    },
    {
        key: 3,
        name: 'Business',
        amount: MONTHLY_SUBSCRIPTION_AMOUNTS_GHS.standard,
        billing: 'Monthly',
        description: 'Best for multi-branch teams that need controls and reporting.',
        features: [
            'Up to 5 branches · up to 12 users',
            'Everything in Starter',
            'Multi-store switching',
            'Stock transfers & adjustments',
            'Stock counts',
            'Reorder list, expiring stock & low-stock alerts',
            'Purchase orders (create & receive stock)',
            'Reports (view) · roles & permissions',
            'Staff notifications · locations within branches',
        ],
    },
    {
        key: 4,
        name: 'Scale',
        amount: MONTHLY_SUBSCRIPTION_AMOUNTS_GHS.premium,
        billing: 'Monthly',
        description: 'Best for full operations, customer ordering at scale, and administration.',
        features: [
            'Up to 10 branches · up to 25 users',
            'Everything in Business',
            'Customer online orders (store queue, fulfilment & delivery)',
            'Audit logs',
            'Order payment history · order & report export',
            'Product export',
            'Order analytics & automation',
            'Multi-store order routing',
        ],
    },
];

/** Rank for upgrade gating — accepts marketing and legacy API names. */
export const PLAN_RANK_BY_NAME = {
    Free: 1,
    Starter: 2,
    Basic: 2,
    Business: 3,
    Standard: 3,
    Scale: 4,
    Premium: 4,
};

export function displayPlanName(name) {
    const raw = String(name || '').trim();
    const map = {
        Basic: 'Starter',
        Standard: 'Business',
        Premium: 'Scale',
        basic: 'Starter',
        standard: 'Business',
        premium: 'Scale',
    };
    return map[raw] || raw || '—';
}

/** Mirrors shopynn landing plans — values map to ims-services subscription_type (1–4). */
export const SUBSCRIPTION_PLANS = [
    {
        value: 1,
        slug: 'free',
        label: 'Free — 14 days',
        description:
            'Active immediately. Explore with Free-tier limits for 14 days. No payment required.',
        activatesImmediately: true,
    },
    {
        value: 2,
        slug: 'basic',
        label: 'Starter — GHS 149/mo',
        description:
            'Account is created now. Access starts after you complete payment in the app.',
        activatesImmediately: false,
    },
    {
        value: 3,
        slug: 'standard',
        label: 'Business — GHS 349/mo',
        description: 'Account is created now. Complete payment in the app to activate Business.',
        activatesImmediately: false,
    },
    {
        value: 4,
        slug: 'premium',
        label: 'Scale — GHS 649/mo',
        description: 'Account is created now. Complete payment in the app to activate Scale.',
        activatesImmediately: false,
    },
];

export function getSubscriptionPlan(value) {
    const n = Number(value);
    return SUBSCRIPTION_PLANS.find((p) => p.value === n) ?? SUBSCRIPTION_PLANS[0];
}
