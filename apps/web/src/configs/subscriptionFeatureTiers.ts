/**
 * Minimum subscription tier per feature code — mirrors ims-services/alt.sql tier seeds.
 * Used for upgrade prompts and locked navigation (not API enforcement).
 */

export type SubscriptionTierCode = 'free' | 'basic' | 'standard' | 'premium';

export const TIER_RANK: Record<SubscriptionTierCode, number> = {
	free: 1,
	basic: 2,
	standard: 3,
	premium: 4
};

export const TIER_DISPLAY: Record<SubscriptionTierCode, string> = {
	free: 'Free',
	basic: 'Basic',
	standard: 'Standard',
	premium: 'Premium'
};

/** Single-letter nav badge (Free is rarely shown on locked items). */
export const TIER_BADGE_LETTER: Record<SubscriptionTierCode, string> = {
	free: 'F',
	basic: 'B',
	standard: 'S',
	premium: 'P'
};

export function getTierBadgeLetter(tier: SubscriptionTierCode): string {
	return TIER_BADGE_LETTER[tier] || 'P';
}

/** Features included on Free (14-day trial). */
const FREE_TIER_FEATURES = new Set([
	'profile.view',
	'profile.update',
	'auth.reset_password',
	'dashboard.view',
	'inventory.view',
	'products.view',
	'categories.view',
	'sales.view',
	'sales.create',
	'purchases.view',
	'purchases.create',
	'customers.view',
	'suppliers.view',
	'company_profile.view',
	'subscription.view',
	'payments.initiate',
	'payments.verify'
]);

/** Not on Basic — requires Standard or Premium. */
const BASIC_EXCLUDED = new Set([
	'stores.multi_access',
	'reports.view',
	'reports.export',
	'sales.share_receipt',
	'inventory.reorder.view',
	'inventory.expiring.view',
	'transfers.view',
	'transfers.details.view',
	'transfers.create',
	'adjustments.view',
	'adjustments.details.view',
	'adjustments.create',
	'roles.view',
	'roles.create',
	'roles.update',
	'roles.delete',
	'permissions.view',
	'users.roles.view',
	'locations.view',
	'locations.create',
	'locations.update',
	'stock_counts.view',
	'stock_counts.details.view',
	'stock_counts.create',
	'notifications.view',
	'notifications.mark_read',
	'notifications.settings.view',
	'notifications.settings.update',
	'notifications.push.send',
	'audit_logs.view',
	'audit_logs.details.view',
	'audit.view',
	'purchase_orders.create',
	'purchase_orders.receive',
	'purchase_orders.view',
	'orders.view',
	'orders.details.view',
	'orders.create',
	'orders.update',
	'orders.cancel',
	'orders.export',
	'orders.store.manage',
	'orders.store.view',
	'orders.analytics.view',
	'orders.automation.manage',
	'orders.multi_store.manage',
	'orders.delivery.manage',
	'data_export.run',
	'data_export.view',
	'merchants.view',
	'merchants.operate',
	'tenants.directory.view',
	'newsletter.subscribers.view',
	'newsletter.campaigns.view',
	'newsletter.campaigns.send',
	'broadcasts.send',
	'contact_requests.view',
	'contact_requests.respond',
	'site_chat.sessions.view',
	'site_chat.sessions.respond',
	'payments.view'
]);

/** Not on Standard — requires Premium. */
const STANDARD_EXCLUDED = new Set([
	'reports.export',
	'orders.view',
	'orders.details.view',
	'orders.create',
	'orders.update',
	'orders.cancel',
	'orders.export',
	'orders.store.manage',
	'orders.store.view',
	'orders.analytics.view',
	'orders.automation.manage',
	'orders.multi_store.manage',
	'orders.delivery.manage',
	'data_export.run',
	'data_export.view',
	'stock_counts.view',
	'stock_counts.details.view',
	'stock_counts.create',
	'notifications.view',
	'notifications.mark_read',
	'notifications.settings.view',
	'notifications.settings.update',
	'notifications.push.send',
	'audit_logs.view',
	'audit_logs.details.view',
	'audit.view',
	'merchants.view',
	'merchants.operate',
	'tenants.directory.view',
	'newsletter.subscribers.view',
	'newsletter.campaigns.view',
	'newsletter.campaigns.send',
	'broadcasts.send',
	'contact_requests.view',
	'contact_requests.respond',
	'site_chat.sessions.view',
	'site_chat.sessions.respond',
	'payments.view'
]);

export function normalizeFeatureCode(code: string): string {
	return String(code || '').trim().toLowerCase();
}

export function getMinimumTierForFeature(featureCode: string): SubscriptionTierCode {
	const code = normalizeFeatureCode(featureCode);
	if (!code) return 'basic';
	if (FREE_TIER_FEATURES.has(code)) return 'free';
	if (STANDARD_EXCLUDED.has(code)) return 'premium';
	if (BASIC_EXCLUDED.has(code)) return 'standard';
	return 'basic';
}

export function getMinimumTierForFeatures(featureCodes: string[]): SubscriptionTierCode {
	let maxRank = 1;
	for (const f of featureCodes) {
		const tier = getMinimumTierForFeature(f);
		maxRank = Math.max(maxRank, TIER_RANK[tier]);
	}
	return (Object.entries(TIER_RANK).find(([, r]) => r === maxRank)?.[0] as SubscriptionTierCode) || 'basic';
}

export function getMinimumTierDisplayForFeatures(featureCodes: string[]): string {
	return TIER_DISPLAY[getMinimumTierForFeatures(featureCodes)];
}

export function normalizePlanTierCode(raw: unknown): SubscriptionTierCode {
	const key = String(raw || '')
		.trim()
		.toLowerCase();
	if (key === 'free' || key === 'basic' || key === 'standard' || key === 'premium') {
		return key;
	}
	if (key.includes('premium')) return 'premium';
	if (key.includes('standard')) return 'standard';
	if (key.includes('basic')) return 'basic';
	return 'free';
}

export function getUserPlanTierCode(user: {
	company?: { plan_usage?: { tierCode?: string }; subscription?: { name?: string } };
	subscription?: { name?: string };
} | null | undefined): SubscriptionTierCode {
	if (!user) return 'free';
	const fromUsage = user.company?.plan_usage?.tierCode;
	if (fromUsage) return normalizePlanTierCode(fromUsage);
	const name = user.company?.subscription?.name ?? user.subscription?.name;
	return normalizePlanTierCode(name);
}

export function userMeetsFeatureTier(
	user: Parameters<typeof getUserPlanTierCode>[0],
	featureCode: string
): boolean {
	const minTier = getMinimumTierForFeature(featureCode);
	const userTier = getUserPlanTierCode(user);
	return TIER_RANK[userTier] >= TIER_RANK[minTier];
}

export function buildUpgradeUrl(features: string[], returnUrl?: string): string {
	const params = new URLSearchParams();
	if (features.length) params.set('features', features.join(','));
	if (returnUrl) params.set('return', returnUrl);
	const q = params.toString();
	return q ? `/upgrade?${q}` : '/upgrade';
}
