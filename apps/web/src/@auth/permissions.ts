import { User } from '@auth/user';
import { FeatureFlagKey, isFeatureEnabled } from 'src/configs/featureFlags';
import { buildUpgradeUrl, getMinimumTierDisplayForFeatures, userMeetsFeatureTier } from 'src/configs/subscriptionFeatureTiers';
import type { FuseNavItemType } from '@fuse/core/FuseNavigation/types/FuseNavItemType';

export type FeatureAccessDeniedBy = 'permission' | 'plan' | 'flag';

export type FeatureAccessResult = {
	allowed: boolean;
	deniedBy?: FeatureAccessDeniedBy;
	missingFeatures: string[];
	requiredPlanName?: string;
};

export function normalizePermissionCodes(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((p) => {
			if (typeof p === 'string') return p;
			if (p && typeof p === 'object' && 'code' in (p as Record<string, unknown>)) {
				return String((p as Record<string, unknown>).code || '');
			}
			return '';
		})
		.filter(Boolean)
		.map((c) => c.trim().toLowerCase());
}

export function getUserPermissionCodes(user: User | null | undefined): string[] {
	if (!user) return [];
	const direct = normalizePermissionCodes(user.permissions);
	if (direct.length > 0) return direct;
	return normalizePermissionCodes(user.settings?.permissions);
}

export function getUserEntitledFeatures(user: User | null | undefined): string[] {
	if (!user) return [];
	const fromSubscription = Array.isArray(user.subscription?.features)
		? user.subscription.features
		: [];
	const fromSettings = Array.isArray(user.settings?.subscription?.features)
		? user.settings.subscription.features
		: [];
	// Intersect API entitlements with the canonical tier map so stale DB rows
	// (e.g. after an EC2 restore) cannot unlock Premium-only nav on Basic.
	return [
		...new Set(
			[...fromSubscription, ...fromSettings]
				.map((f) => String(f).trim().toLowerCase())
				.filter(Boolean)
				.filter((f) => userMeetsFeatureTier(user, f))
		)
	];
}

export function hasPermissionCodes(
	user: User | null | undefined,
	requiredCodes?: string[] | string,
	opts?: { allowWhenMissingUserPermissions?: boolean }
): boolean {
	if (!requiredCodes) return true;
	const required = Array.isArray(requiredCodes) ? requiredCodes : [requiredCodes];
	const normalizedRequired = required.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
	if (!normalizedRequired.length) return true;

	const available = getUserPermissionCodes(user);
	const allowWhenMissing = opts?.allowWhenMissingUserPermissions ?? false;
	if (!available.length) return allowWhenMissing;

	return normalizedRequired.some((code) => available.includes(code));
}

const BILLING_ADMIN_ROLE_NAMES = new Set(['super admin', 'owner', 'administrator', 'admin']);

export function isBillingAdminUser(user: User | null | undefined): boolean {
	if (!user) return false;
	const roles = Array.isArray(user.settings?.roles) ? user.settings.roles : [];
	return roles.some((r) => {
		const name = String((r as { name?: string })?.name ?? '').trim().toLowerCase();
		return BILLING_ADMIN_ROLE_NAMES.has(name);
	});
}

/** Premium: customer ordering + per-store signup codes (`warehouse_reference_codes`). */
export const CUSTOMER_SIGNUP_CODES_FEATURE = 'orders.create';

export function canManageCustomerSignupCodes(user: User | null | undefined): boolean {
	return hasFeatureAndPermission(user, undefined, undefined, CUSTOMER_SIGNUP_CODES_FEATURE);
}

/** Tenant billing (plan, checkout, subscription payment history) — billing admin roles with subscription.view. */
export function canManageSubscription(
	user: User | null | undefined,
	opts?: { allowWhenSubscriptionExpired?: boolean }
): boolean {
	if (!isBillingAdminUser(user)) return false;
	if (opts?.allowWhenSubscriptionExpired) {
		return hasPermissionCodes(user, 'subscription.view');
	}
	return hasFeatureAndPermission(user, 'subscription.view', undefined, 'subscription.view');
}

function normalizeRequiredList(raw?: string[] | string): string[] {
	if (!raw) return [];
	const list = Array.isArray(raw) ? raw : [raw];
	return list.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
}

export function evaluateFeatureAccess(
	user: User | null | undefined,
	requiredCodes?: string[] | string,
	featureFlag?: FeatureFlagKey,
	requiredFeatures?: string[] | string
): FeatureAccessResult {
	if (!isFeatureEnabled(featureFlag)) {
		return { allowed: false, deniedBy: 'flag', missingFeatures: [] };
	}

	const requiredPermissionCodes = normalizeRequiredList(requiredCodes);
	const requiredFeatureCodes = normalizeRequiredList(requiredFeatures);
	const featuresToCheck = requiredFeatureCodes.length ? requiredFeatureCodes : requiredPermissionCodes;

	const permissionOk = hasPermissionCodes(user, requiredCodes);
	const entitled = getUserEntitledFeatures(user);
	const missingFeatures = featuresToCheck.filter((f) => !entitled.includes(f));
	const planOk = featuresToCheck.length === 0 || featuresToCheck.some((f) => entitled.includes(f));

	if (!permissionOk) {
		return { allowed: false, deniedBy: 'permission', missingFeatures };
	}
	if (!planOk) {
		return {
			allowed: false,
			deniedBy: 'plan',
			missingFeatures,
			requiredPlanName: getMinimumTierDisplayForFeatures(featuresToCheck)
		};
	}
	return { allowed: true, missingFeatures: [] };
}

export function hasFeatureAndPermission(
	user: User | null | undefined,
	requiredCodes?: string[] | string,
	featureFlag?: FeatureFlagKey,
	requiredFeatures?: string[] | string
): boolean {
	return evaluateFeatureAccess(user, requiredCodes, featureFlag, requiredFeatures).allowed;
}

export type NavItemAccess = {
	visible: boolean;
	locked: boolean;
	upgradeUrl?: string;
	requiredPlanName?: string;
};

/** Platform-operator tools — never shown as plan upgrade locks to tenants. */
const PLATFORM_NAV_FEATURES = new Set([
	'merchants.view',
	'merchants.operate',
	'tenants.directory.view',
	'newsletter.subscribers.view',
	'newsletter.campaigns.view',
	'newsletter.campaigns.send',
	'contact_requests.view',
	'contact_requests.respond',
	'site_chat.sessions.view',
	'site_chat.sessions.respond'
]);

function isPlatformNavItem(features: string[]): boolean {
	return features.some((f) => PLATFORM_NAV_FEATURES.has(f));
}

/** Nav: hide when role lacks permission; show locked when plan lacks a sellable feature.
 *  Platform-admin items are permission-gated only (hide, never lock-to-upgrade).
 */
export function resolveNavItemAccess(
	user: User | null | undefined,
	item: Pick<FuseNavItemType, 'requiredPermissions' | 'requiredFeatures' | 'featureFlag' | 'url' | 'id'>
): NavItemAccess {
	const access = evaluateFeatureAccess(
		user,
		item.requiredPermissions,
		item.featureFlag,
		item.requiredFeatures
	);
	const features = normalizeRequiredList(item.requiredFeatures ?? item.requiredPermissions);

	if (access.deniedBy === 'permission') {
		return { visible: false, locked: false };
	}
	if (access.deniedBy === 'plan') {
		// Merchants / tenants / marketing admin etc. are not subscription upsells.
		if (isPlatformNavItem(features)) {
			return { visible: false, locked: false };
		}
		return {
			visible: true,
			locked: true,
			upgradeUrl: buildUpgradeUrl(features, item.url),
			requiredPlanName: access.requiredPlanName
		};
	}
	if (!access.allowed) {
		return { visible: false, locked: false };
	}
	return { visible: true, locked: false };
}
