/**
 * B2C storefront / customer-portal permissions (see ensureCustomerRoleWithPermissions).
 * Includes shared inbox codes (notifications.*) that staff also use.
 */
export const CUSTOMER_PORTAL_PERMISSION_CODES = [
    "orders.view",
    "orders.create",
    "orders.details.view",
    "orders.cancel",
    "notifications.view",
    "notifications.mark_read",
];

/** Shopping-only portal codes — Super Admin must not get these via the full-perms shortcut. */
export const CUSTOMER_SHOPPING_PERMISSION_CODES = [
    "orders.view",
    "orders.create",
    "orders.details.view",
    "orders.cancel",
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
    ...CUSTOMER_SHOPPING_PERMISSION_CODES,
];
