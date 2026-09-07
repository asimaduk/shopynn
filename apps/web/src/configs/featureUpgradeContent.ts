import { getMinimumTierDisplayForFeatures } from './subscriptionFeatureTiers';

type UpgradeCopy = {
	featureTitle: string;
	description?: string;
	bullets?: string[];
};

const FEATURE_PREFIX_COPY: Record<string, UpgradeCopy> = {
	'orders.': {
		featureTitle: 'Online orders',
		description: 'Accept and manage customer orders from your store — included on Premium.',
		bullets: ['Store order queue', 'Customer checkout', 'Order payments tracking']
	},
	'transfers.': {
		featureTitle: 'Stock transfers',
		description: 'Move inventory between branches with full transfer history.',
		bullets: ['Create transfers between warehouses', 'Track in-transit stock', 'Audit trail per branch']
	},
	'adjustments.': {
		featureTitle: 'Stock adjustments',
		description: 'Correct quantities after counts, damage, or shrinkage.',
		bullets: ['Adjustment history', 'Reason codes', 'Inventory accuracy']
	},
	'stock_counts.': {
		featureTitle: 'Stock count / audit',
		description: 'Run physical counts and reconcile system stock.',
		bullets: ['Count sessions', 'Variance reports', 'Adjustment workflow']
	},
	'inventory.reorder': {
		featureTitle: 'Reorder list',
		description: 'See what is running low and needs replenishment.',
		bullets: ['Low-stock alerts', 'Reorder suggestions', 'Purchasing workflow']
	},
	'inventory.expiring': {
		featureTitle: 'Expiring stock',
		description: 'Track batches nearing expiry before you lose stock.',
		bullets: ['Expiry dates', 'FEFO visibility', 'Waste reduction']
	},
	'reports.': {
		featureTitle: 'Reports',
		description: 'Business reports and analytics for day-to-day decisions.',
		bullets: ['Sales & inventory reports', 'Operational summaries', 'Export on Premium']
	},
	'users.': {
		featureTitle: 'User management',
		description: 'Add staff and manage team access. Basic includes up to 3 users.',
		bullets: ['Create users', 'Deactivate accounts', 'Upgrade for more users and custom roles']
	},
	'roles.': {
		featureTitle: 'Roles & permissions',
		description: 'Fine-grained access control for your team.',
		bullets: ['Custom roles', 'Permission sets', 'Safer multi-user operations']
	},
	'locations.': {
		featureTitle: 'Locations',
		description: 'Manage towns and delivery areas across branches.',
		bullets: ['Location directory', 'Link to warehouses', 'Multi-branch setup']
	},
	'stores.multi_access': {
		featureTitle: 'Multi-store / branches',
		description: 'Run more than one warehouse or branch on one account.',
		bullets: ['Multiple warehouses', 'Per-branch stock', 'Transfers between stores']
	},
	'warehouses.': {
		featureTitle: 'Stores / branches',
		description: 'Manage multiple storage locations on Standard and above.',
		bullets: ['Branch setup', 'Per-store inventory', 'Reference codes on Premium']
	},
	'notifications.': {
		featureTitle: 'Notifications',
		description: 'In-app alerts and notification preferences.',
		bullets: ['Order alerts', 'Low stock signals', 'Push settings']
	},
	'purchase_orders.': {
		featureTitle: 'Purchase orders',
		description: 'PO workflow from order to receive against supplier deliveries.',
		bullets: ['Create POs', 'Receive stock', 'Supplier tracking']
	},
	'payments.view': {
		featureTitle: 'Order payments',
		description: 'View and reconcile payments linked to customer orders.',
		bullets: ['Payment records', 'Order settlement', 'Premium operations']
	},
	'data_export.': {
		featureTitle: 'Data export',
		description: 'Export your business data for backup or analysis.',
		bullets: ['CSV exports', 'Reports export', 'Compliance backups']
	},
	'merchants.': {
		featureTitle: 'Merchant / agent tools',
		description: 'Partner onboarding and commission tools (platform admin).',
		bullets: ['Onboard businesses', 'Collect payments', 'Commission tracking']
	},
	'tenants.directory': {
		featureTitle: 'Tenant directory',
		description: 'Platform-wide tenant administration.',
		bullets: ['All businesses', 'Subscription overview', 'Billing catalog admin']
	},
	'sales.daily_summary': {
		featureTitle: 'Daily sales overview',
		description: 'Full daily sales chart and history beyond the dashboard snapshot.',
		bullets: ['7, 14, and 30-day trends', 'Custom date ranges', 'Drill into sales by day']
	}
};

const NAV_ID_COPY: Record<string, UpgradeCopy> = {
	'inventory.transfers': FEATURE_PREFIX_COPY['transfers.'],
	'inventory.adjust.quantities': FEATURE_PREFIX_COPY['adjustments.'],
	'inventory.stock-count': FEATURE_PREFIX_COPY['stock_counts.'],
	'inventory.reorder': FEATURE_PREFIX_COPY['inventory.reorder'],
	'inventory.expiring': FEATURE_PREFIX_COPY['inventory.expiring'],
	'trading.store-orders': FEATURE_PREFIX_COPY['orders.'],
	'trading.order-payments': FEATURE_PREFIX_COPY['payments.view'],
	'adminTools.reports': FEATURE_PREFIX_COPY['reports.'],
	'adminTools.notifications': FEATURE_PREFIX_COPY['notifications.'],
	'adminTools.rolesPermissions': FEATURE_PREFIX_COPY['roles.'],
	'usage.users': FEATURE_PREFIX_COPY['users.'],
	'setups.locations': FEATURE_PREFIX_COPY['locations.'],
	'setups.stores': FEATURE_PREFIX_COPY['stores.multi_access']
};

function matchPrefixCopy(featureCode: string): UpgradeCopy | null {
	for (const [prefix, copy] of Object.entries(FEATURE_PREFIX_COPY)) {
		if (featureCode.startsWith(prefix)) return copy;
	}
	return null;
}

export function getUpgradePromptProps(
	featureCodes: string[],
	opts?: { navId?: string; backHref?: string }
) {
	const normalized = featureCodes.map((f) => String(f).trim().toLowerCase()).filter(Boolean);
	const requiredPlanName = getMinimumTierDisplayForFeatures(normalized);
	const fromNav = opts?.navId ? NAV_ID_COPY[opts.navId] : null;
	const fromFeature = normalized.length ? matchPrefixCopy(normalized[0]) : null;
	const copy = fromNav || fromFeature;

	const featureTitle = copy?.featureTitle ?? 'This feature';

	return {
		featureTitle,
		requiredPlanName,
		description: copy?.description,
		bullets: copy?.bullets ?? [],
		backHref: opts?.backHref ?? '/dashboards/analytics'
	};
}
