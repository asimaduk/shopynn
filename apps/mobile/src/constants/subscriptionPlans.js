/** Paid tiers for in-app choose / upgrade (matches ims-web billing/subscriptionPlans.ts). */
export const MONTHLY_SUBSCRIPTION_AMOUNTS_GHS = {
    basic: 229,
    standard: 429,
    premium: 799,
};

export const CHOOSEABLE_SUBSCRIPTION_PLANS = [
    {
        key: 2,
        name: 'Basic',
        amount: MONTHLY_SUBSCRIPTION_AMOUNTS_GHS.basic,
        billing: 'Monthly',
        description: 'Best for a single store getting started.',
        features: [
            '1 branch · up to 3 users',
            'Inventory, products & categories (create, import, export)',
            'Sales & purchases with returns',
            'Daily sales trends & sales-by-date history',
            'Customers, suppliers & expenditures',
            'Dashboard, company profile & receipt settings',
        ],
    },
    {
        key: 3,
        name: 'Standard',
        amount: MONTHLY_SUBSCRIPTION_AMOUNTS_GHS.standard,
        billing: 'Monthly',
        description: 'Best for multi-branch teams that need controls and reporting.',
        features: [
            'Up to 5 branches · up to 12 users',
            'Everything in Basic',
            'Multi-store switching',
            'Stock transfers & adjustments',
            'Reorder list, expiring stock & low-stock alerts',
            'Purchase orders (create & receive stock)',
            'Share or print sales receipts',
            'Reports (view) · roles & permissions',
            'Locations within branches',
        ],
    },
    {
        key: 4,
        name: 'Premium',
        amount: MONTHLY_SUBSCRIPTION_AMOUNTS_GHS.premium,
        billing: 'Monthly',
        description: 'Best for full operations, customer ordering at scale, and administration.',
        features: [
            'Up to 10 branches · up to 25 users',
            'Everything in Standard',
            'Customer online orders (store queue, fulfilment & delivery)',
            'Stock counts & audit logs',
            'Staff notifications inbox',
            'Order payment history · order & report export',
            'Data export & backup',
            'Order analytics & automation',
            'Multi-store order routing'
        ],
    },
];

export const PLAN_RANK_BY_NAME = { Free: 1, Basic: 2, Standard: 3, Premium: 4 };

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
        label: 'Basic — GHS 229/mo',
        description:
            'Account is created now. Access starts after you complete payment in the app.',
        activatesImmediately: false,
    },
    {
        value: 3,
        slug: 'standard',
        label: 'Standard — GHS 429/mo',
        description: 'Account is created now. Complete payment in the app to activate Standard.',
        activatesImmediately: false,
    },
    {
        value: 4,
        slug: 'premium',
        label: 'Premium — GHS 799/mo',
        description: 'Account is created now. Complete payment in the app to activate Premium.',
        activatesImmediately: false,
    },
];

export function getSubscriptionPlan(value) {
    const n = Number(value);
    return SUBSCRIPTION_PLANS.find((p) => p.value === n) ?? SUBSCRIPTION_PLANS[0];
}
