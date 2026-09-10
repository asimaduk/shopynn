/**
 * B2C storefront / customer-portal permissions (see ensureCustomerRoleWithPermissions).
 * Must not be auto-granted to tenant Super Admin on onboarding.
 */
export const CUSTOMER_PORTAL_PERMISSION_CODES = [
    "orders.view",
    "orders.create",
    "orders.details.view",
    "orders.cancel",
    "notifications.view",
];

/** Platform-operator permissions (not tenant Super Admin defaults). */
export const PLATFORM_PERMISSION_CODES = [
    "merchants.view",
    "merchants.operate",
    "tenants.directory.view",
    "newsletter.subscribers.view",
    "newsletter.campaigns.view",
    "newsletter.campaigns.send",
    "broadcasts.send",
    "contact_requests.view",
    "contact_requests.respond",
    "site_chat.sessions.view",
    "site_chat.sessions.respond",
];

/** Omitted when seeding a new tenant Super Admin role (onboarding + permission shortcut). */
export const SUPER_ADMIN_EXCLUDED_PERMISSION_CODES = [
    ...PLATFORM_PERMISSION_CODES,
    ...CUSTOMER_PORTAL_PERMISSION_CODES,
];
