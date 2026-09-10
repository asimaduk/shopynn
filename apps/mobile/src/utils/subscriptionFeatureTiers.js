/** Minimum tier per feature — mirrors ims-services/alt.sql tier seeds. */

const TIER_RANK = { free: 1, basic: 2, standard: 3, premium: 4 };

const TIER_DISPLAY = { free: 'Free', basic: 'Basic', standard: 'Standard', premium: 'Premium' };

const TIER_BADGE_LETTER = { free: 'F', basic: 'B', standard: 'S', premium: 'P' };

export function getTierBadgeLetter(tier) {
    return TIER_BADGE_LETTER[tier] || 'P';
}

export function getTierBadgeLetterForPlanName(planName) {
    const key = String(planName || '').trim().toLowerCase();
    if (key.includes('premium')) return getTierBadgeLetter('premium');
    if (key.includes('standard')) return getTierBadgeLetter('standard');
    if (key.includes('basic')) return getTierBadgeLetter('basic');
    return getTierBadgeLetter('free');
}

const FREE_TIER_FEATURES = new Set([
    'profile.view', 'profile.update', 'auth.reset_password', 'dashboard.view', 'inventory.view',
    'products.view', 'categories.view', 'sales.view', 'sales.create', 'purchases.view', 'purchases.create',
    'customers.view', 'suppliers.view', 'company_profile.view', 'subscription.view', 'payments.initiate', 'payments.verify',
]);

const BASIC_EXCLUDED = new Set([
    'stores.multi_access', 'reports.view', 'reports.export', 'sales.share_receipt', 'inventory.reorder.view',
    'inventory.expiring.view', 'transfers.view', 'transfers.details.view', 'transfers.create', 'adjustments.view',
    'adjustments.details.view', 'adjustments.create', 'roles.view', 'roles.create', 'roles.update', 'roles.delete', 'permissions.view',
    'users.roles.view', 'locations.view', 'locations.create', 'locations.update', 'stock_counts.view', 'stock_counts.details.view',
    'stock_counts.create', 'notifications.view', 'notifications.mark_read', 'notifications.settings.view',
    'notifications.settings.update', 'notifications.push.send', 'audit_logs.view', 'audit_logs.details.view', 'audit.view',
    'purchase_orders.create', 'purchase_orders.receive', 'purchase_orders.view', 'orders.view', 'orders.details.view',
    'orders.create', 'orders.update', 'orders.cancel', 'orders.export', 'orders.store.manage', 'orders.store.view',
    'orders.analytics.view', 'orders.automation.manage', 'orders.multi_store.manage', 'orders.delivery.manage',
    'data_export.run', 'data_export.view', 'merchants.view', 'merchants.operate', 'tenants.directory.view',
    'newsletter.subscribers.view', 'newsletter.campaigns.view', 'newsletter.campaigns.send', 'broadcasts.send', 'contact_requests.view',
    'contact_requests.respond', 'site_chat.sessions.view', 'site_chat.sessions.respond', 'payments.view',
]);

const STANDARD_EXCLUDED = new Set([
    'reports.export', 'orders.view', 'orders.details.view', 'orders.create', 'orders.update', 'orders.cancel',
    'orders.export', 'orders.store.manage', 'orders.store.view', 'orders.analytics.view', 'orders.automation.manage',
    'orders.multi_store.manage', 'orders.delivery.manage', 'data_export.run', 'data_export.view', 'stock_counts.view',
    'stock_counts.details.view', 'stock_counts.create', 'notifications.view', 'notifications.mark_read',
    'notifications.settings.view', 'notifications.settings.update', 'notifications.push.send', 'audit_logs.view',
    'audit_logs.details.view', 'audit.view', 'merchants.view', 'merchants.operate', 'tenants.directory.view',
    'newsletter.subscribers.view', 'newsletter.campaigns.view', 'newsletter.campaigns.send', 'broadcasts.send', 'contact_requests.view',
    'contact_requests.respond', 'site_chat.sessions.view', 'site_chat.sessions.respond', 'payments.view',
]);

export function getMinimumTierForFeature(featureCode) {
    const code = String(featureCode || '').trim().toLowerCase();
    if (!code) return 'basic';
    if (FREE_TIER_FEATURES.has(code)) return 'free';
    if (STANDARD_EXCLUDED.has(code)) return 'premium';
    if (BASIC_EXCLUDED.has(code)) return 'standard';
    return 'basic';
}

export function getMinimumTierForFeatures(featureCodes) {
    let maxRank = 1;
    for (const f of featureCodes || []) {
        maxRank = Math.max(maxRank, TIER_RANK[getMinimumTierForFeature(f)] || 1);
    }
    return Object.keys(TIER_RANK).find((k) => TIER_RANK[k] === maxRank) || 'basic';
}

export function getMinimumTierDisplayForFeatures(featureCodes) {
    return TIER_DISPLAY[getMinimumTierForFeatures(featureCodes)] || 'Standard';
}
