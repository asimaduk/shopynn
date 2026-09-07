/**
 * Canonical paid-tier monthly prices (GHS).
 * Keep in sync with `ims-services/src/models/subscription.js` SUBSCRIPTION_TYPES.
 */
export const MONTHLY_SUBSCRIPTION_AMOUNTS_GHS = {
	basic: 229,
	standard: 429,
	premium: 799
} as const;

export type ChooseableSubscriptionType = 2 | 3 | 4;

export type ChooseablePlan = {
	key: ChooseableSubscriptionType;
	name: 'Basic' | 'Standard' | 'Premium';
	amount: number;
	billing: string;
	/** Short summary shown above the feature list. */
	description: string;
	/** Major capabilities included on this tier (aligned with docs/PRICING_PACKAGES.md). */
	features: readonly string[];
};

export const CHOOSEABLE_SUBSCRIPTION_PLANS: readonly ChooseablePlan[] = [
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
			'Dashboard, company profile & receipt settings'
		]
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
			'Locations within branches'
		]
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
		]
	}
];
