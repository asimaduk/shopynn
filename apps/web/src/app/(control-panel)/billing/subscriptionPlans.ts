/**
 * Canonical paid-tier monthly prices (GHS).
 * Keep in sync with `ims-services/src/models/subscription.js` SUBSCRIPTION_TYPES.
 * Marketing names: Starter / Business / Scale (API still uses basic / standard / premium).
 */
export const MONTHLY_SUBSCRIPTION_AMOUNTS_GHS = {
	basic: 149,
	standard: 349,
	premium: 649
} as const;

export type ChooseableSubscriptionType = 2 | 3 | 4;

export type ChooseablePlan = {
	key: ChooseableSubscriptionType;
	name: 'Starter' | 'Business' | 'Scale';
	amount: number;
	billing: string;
	/** Short summary shown above the feature list. */
	description: string;
	/** Major capabilities included on this tier (aligned with docs/PRICING_PACKAGES.md). */
	features: readonly string[];
};

/** Rank for upgrade gating — accepts marketing and legacy API names. */
export const PLAN_RANK_BY_NAME: Record<string, number> = {
	Free: 1,
	Starter: 2,
	Basic: 2,
	Business: 3,
	Standard: 3,
	Scale: 4,
	Premium: 4
};

/** Map API / legacy plan names to marketing display names. */
export function displayPlanName(name: string | null | undefined): string {
	const raw = String(name || '').trim();
	const map: Record<string, string> = {
		Basic: 'Starter',
		Standard: 'Business',
		Premium: 'Scale',
		basic: 'Starter',
		standard: 'Business',
		premium: 'Scale'
	};
	return map[raw] || raw || '—';
}

export const CHOOSEABLE_SUBSCRIPTION_PLANS: readonly ChooseablePlan[] = [
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
			'Dashboard, company profile & receipt settings'
		]
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
			'Staff notifications · locations within branches'
		]
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
			'Data export & backup',
			'Order analytics & automation',
			'Multi-store order routing'
		]
	}
];
