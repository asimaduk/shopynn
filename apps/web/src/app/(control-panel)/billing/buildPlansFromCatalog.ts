import type {
	BillingCatalogGrouped,
	BillingCatalogItem,
	BillingCatalogResponse
} from './BillingCatalogApi';
import { toGroupedBillingCatalog } from './BillingCatalogApi';
import type { ChooseablePlan, ChooseableSubscriptionType } from './subscriptionPlans';

const TIER_TO_TYPE: Record<string, ChooseableSubscriptionType> = {
	basic: 2,
	standard: 3,
	premium: 4
};

const PAID_FEATURES: Record<ChooseableSubscriptionType, ChooseablePlan['features']> = {
	2: [
		'1 branch · up to 3 users',
		'Inventory, products & categories (create, import, export)',
		'Sales & purchases with returns',
		'Daily sales trends & sales-by-date history',
		'Customers, suppliers & expenditures',
		'Dashboard, company profile & receipt settings'
	],
	3: [
		'Up to 5 branches · up to 12 users',
		'Everything in Basic',
		'Multi-store switching',
		'Stock transfers & adjustments',
		'Reorder list, expiring stock & low-stock alerts',
		'Purchase orders (create & receive stock)',
		'Share or print sales receipts',
		'Reports (view) · users, roles & permissions',
		'Locations within branches'
	],
	4: [
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
};

const PAID_DESCRIPTIONS: Record<ChooseableSubscriptionType, string> = {
	2: 'Best for a single store getting started.',
	3: 'Best for multi-branch teams that need controls and reporting.',
	4: 'Best for full operations, customer ordering at scale, and administration.'
};

const PAID_NAMES: Record<ChooseableSubscriptionType, ChooseablePlan['name']> = {
	2: 'Basic',
	3: 'Standard',
	4: 'Premium'
};

export function buildChooseablePlansFromCatalog(
	catalog: BillingCatalogResponse | undefined
): ChooseablePlan[] {
	const grouped = toGroupedBillingCatalog(catalog);
	if (!grouped?.plans) return [];
	const out: ChooseablePlan[] = [];
	for (const tier of ['basic', 'standard', 'premium'] as const) {
		const monthly = grouped.plans[tier]?.subscription_monthly as BillingCatalogItem | undefined;
		const key = TIER_TO_TYPE[tier];
		if (!monthly || !key) continue;
		out.push({
			key,
			name: PAID_NAMES[key],
			amount: Number(monthly.amount_ghs) || 0,
			billing: 'Monthly',
			description: PAID_DESCRIPTIONS[key],
			features: PAID_FEATURES[key]
		});
	}
	return out.sort((a, b) => a.key - b.key);
}

export function getOnboardingAmountFromCatalog(
	catalog: BillingCatalogResponse | undefined,
	subscriptionType: number
): number {
	const grouped = toGroupedBillingCatalog(catalog);
	const tierMap: Record<number, string> = { 2: 'basic', 3: 'standard', 4: 'premium' };
	const tier = tierMap[subscriptionType];
	if (!tier || !grouped?.plans) return 0;
	const row = grouped.plans[tier]?.onboarding as BillingCatalogItem | undefined;
	return row ? Number(row.amount_ghs) : 0;
}

export function formatPlanSignupLabel(
	catalog: BillingCatalogResponse | undefined,
	subscriptionType: number
): string {
	if (subscriptionType === 1) return 'Free — 14 days';
	const plans = buildChooseablePlansFromCatalog(catalog);
	const plan = plans.find((p) => p.key === subscriptionType);
	return plan ? `${plan.name} — GHS ${plan.amount}/mo` : `Plan ${subscriptionType}`;
}
