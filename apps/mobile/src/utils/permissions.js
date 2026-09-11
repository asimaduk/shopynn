import {
    getMinimumTierDisplayForFeatures,
    userMeetsFeatureTier,
} from './subscriptionFeatureTiers';

export const ROLES = { Admin: 'Admin', Manager: 'Manager', Staff: 'Staff' };

/** Premium: customer ordering + per-store signup codes (`warehouse_reference_codes`). */
export const CUSTOMER_SIGNUP_CODES_FEATURE = 'orders.create';

export function canManageCustomerSignupCodes(user, contextFeatures) {
    return hasFeature(user, CUSTOMER_SIGNUP_CODES_FEATURE, contextFeatures);
}

/** System permissions for user management. Keys are permission IDs, values are display labels. */
export const PERMISSIONS = {
    inventory_view: 'View inventory',
    inventory_edit: 'Edit inventory & stock',
    sales_view: 'View sales',
    sales_create: 'Create & edit sales',
    purchases_view: 'View purchases',
    purchases_create: 'Create & edit purchases',
    returns_view: 'View returns',
    returns_create: 'Create returns',
    reports_view: 'View reports',
    customers_manage: 'Manage customers',
    suppliers_manage: 'Manage suppliers',
    warehouses_manage: 'Manage warehouses',
    users_manage: 'Manage users & roles',
    settings_manage: 'App & company settings',
};

const SCREEN_PERMISSION_MAP = {
    Dashboard: ['dashboard.view'],
    Inventory: ['inventory.view'],
    Sales: ['sales.view'],
    Purchases: ['purchases.view'],
    More: ['settings.view'],
    Users: ['users.view'],
    Roles: ['roles.view', 'users.roles.view', 'users.view'],
    UserDetails: ['users.details.view', 'users.view'],
    UserForm: ['users.create', 'users.update'],
    Customers: ['customers.view'],
    CustomerDetails: ['customers.details.view', 'customers.view'],
    CustomerForm: ['customers.create', 'customers.update'],
    Suppliers: ['suppliers.view'],
    SupplierDetails: ['suppliers.details.view', 'suppliers.view'],
    SupplierForm: ['suppliers.create', 'suppliers.update'],
    Expenditures: ['expenses.view'],
    ExpenditureDetails: ['expenses.details.view', 'expenses.view'],
    CreateExpenditure: ['expenses.create', 'expenses.update'],
    Warehouses: ['warehouses.view'],
    CreateWarehouse: ['warehouses.create'],
    EditWarehouse: ['warehouses.update'],
    Reports: ['reports.view'],
    ReportDetail: ['reports.view'],
    AuditLogDetails: ['audit_logs.details.view', 'audit.view'],
    DailySales: ['sales.daily_summary.view', 'sales.view'],
    DaySalesList: ['sales.daily_summary.view', 'sales.view'],
    Notifications: ['notifications.view', 'notifications.mark_read', 'notifications.settings.view'],
    NotificationsSetup: ['notifications.settings.view', 'notifications.settings.update'],
    ProductTransactions: ['products.transactions.view'],
    ProductForm: ['products.create', 'products.update'],
    ProductCategories: ['categories.view'],
    Subscription: ['subscription.view'],
    Payment: ['payments.initiate'],
    PaymentHistory: ['subscription.view'],
    OrderPayments: ['payments.view'],
    OrderSettlements: ['payments.view'],
    PendingSales: ['sales.pending.view', 'sales.view'],
    NewSale: ['sales.create'],
    NewPurchase: ['purchases.create'],
    PurchaseOrders: ['purchase_orders.view', 'purchases.view'],
    Orders: ['orders.store.view'],
    ForYou: ['orders.create'],
    Cart: ['orders.create'],
    Checkout: ['orders.create'],
    MyOrders: ['orders.view'],
    MyOrderDetails: ['orders.details.view', 'orders.view'],
    CreateOrder: ['orders.create'],
    OrderDetails: ['orders.store.view', 'orders.details.view'],
    CreatePurchaseOrder: ['purchase_orders.create', 'purchases.create'],
    PurchaseOrderDetails: ['purchase_orders.view', 'purchases.view'],
    ReceiveAgainstPO: ['purchase_orders.receive', 'purchases.create'],
    MerchantPortal: ['merchants.operate', 'merchants.view'],
    MerchantDetail: ['merchants.view'],
    MerchantAdd: ['merchants.view'],
    MerchantOnboard: ['merchants.operate', 'merchants.view'],
    TenantsDirectory: ['tenants.directory.view'],
    BillingCatalog: ['tenants.directory.view'],
    ProductTransfers: ['transfers.view'],
    NewTransfer: ['transfers.create'],
    AdjustedQuantities: ['adjustments.view'],
    NewAdjustments: ['adjustments.create'],
    StockCountHistory: ['stock_counts.view'],
    StockCountDetails: ['stock_counts.view'],
    StockCount: ['stock_counts.create'],
    ItemsToReorder: ['inventory.reorder.view', 'inventory.view'],
    ExpiringSoon: ['inventory.expiring.view', 'inventory.view'],
    Returns: ['returns.view'],
    NewSaleReturn: ['returns.create'],
    NewPurchaseReturn: ['returns.create'],
    ReturnDetails: ['returns.details.view', 'returns.view'],
    InvoiceReceiptSettings: ['receipt_settings.view', 'settings_manage'],
    DataExportBackup: ['data_export.view', 'settings_manage'],
};

const SCREEN_FEATURE_MAP = {
    Dashboard: ['dashboard.view'],
    Inventory: ['inventory.view'],
    Sales: ['sales.view'],
    Purchases: ['purchases.view'],
    Users: ['users.view'],
    Roles: ['roles.view'],
    UserDetails: ['users.details.view'],
    UserForm: ['users.create'],
    Customers: ['customers.view'],
    CustomerDetails: ['customers.details.view'],
    CustomerForm: ['customers.create'],
    Suppliers: ['suppliers.view'],
    SupplierDetails: ['suppliers.details.view'],
    SupplierForm: ['suppliers.create'],
    Expenditures: ['expenses.view'],
    ExpenditureDetails: ['expenses.details.view'],
    CreateExpenditure: ['expenses.create'],
    Warehouses: ['stores.multi_access'],
    CreateWarehouse: ['stores.multi_access'],
    EditWarehouse: ['stores.multi_access'],
    Reports: ['reports.view'],
    ReportDetail: ['reports.view'],
    AuditLogDetails: ['audit_logs.details.view'],
    DailySales: ['sales.daily_summary.view'],
    DaySalesList: ['sales.daily_summary.view'],
    Notifications: ['notifications.view', 'notifications.mark_read', 'notifications.settings.view'],
    NotificationsSetup: ['notifications.settings.view', 'notifications.settings.update'],
    ProductTransactions: ['products.transactions.view'],
    ProductForm: ['products.create'],
    ProductCategories: ['categories.view'],
    Subscription: ['subscription.view'],
    Payment: ['payments.initiate'],
    PaymentHistory: ['subscription.view'],
    OrderPayments: ['payments.view'],
    OrderSettlements: ['payments.view'],
    PendingSales: ['sales.pending.view'],
    NewSale: ['sales.create'],
    NewPurchase: ['purchases.create'],
    PurchaseOrders: ['purchase_orders.view'],
    Orders: ['orders.store.view'],
    ForYou: ['orders.create'],
    Cart: ['orders.create'],
    Checkout: ['orders.create'],
    MyOrders: ['orders.view'],
    MyOrderDetails: ['orders.details.view'],
    CreateOrder: ['orders.create'],
    OrderDetails: ['orders.store.view', 'orders.details.view'],
    CreatePurchaseOrder: ['purchase_orders.create'],
    PurchaseOrderDetails: ['purchase_orders.view'],
    ReceiveAgainstPO: ['purchase_orders.receive'],
    MerchantPortal: ['merchants.operate', 'merchants.view'],
    MerchantDetail: ['merchants.view'],
    MerchantAdd: ['merchants.view'],
    MerchantOnboard: ['merchants.operate', 'merchants.view'],
    TenantsDirectory: ['tenants.directory.view'],
    BillingCatalog: ['tenants.directory.view'],
    ProductTransfers: ['transfers.view'],
    NewTransfer: ['transfers.create'],
    AdjustedQuantities: ['adjustments.view'],
    NewAdjustments: ['adjustments.create'],
    StockCountHistory: ['stock_counts.view'],
    StockCountDetails: ['stock_counts.view'],
    StockCount: ['stock_counts.create'],
    ItemsToReorder: ['inventory.reorder.view'],
    ExpiringSoon: ['inventory.expiring.view'],
    Returns: ['returns.view'],
    NewSaleReturn: ['returns.create'],
    NewPurchaseReturn: ['returns.create'],
    ReturnDetails: ['returns.details.view'],
    InvoiceReceiptSettings: ['receipt_settings.view'],
    DataExportBackup: ['data_export.view'],
};

export function normalizePermissionCodes(rawPermissions) {
    if (!Array.isArray(rawPermissions)) return [];
    return rawPermissions
        .map((p) => (typeof p === 'string' ? p : p?.code))
        .filter(Boolean)
        .map((c) => String(c).trim().toLowerCase());
}

export function getUserPermissionCodes(user) {
    if (!user) return [];
    const direct = normalizePermissionCodes(user.permissions);
    if (direct.length) return direct;
    return normalizePermissionCodes(user?.settings?.permissions);
}

export function normalizeFeatureCodes(rawFeatures) {
    if (!Array.isArray(rawFeatures)) return [];
    return rawFeatures
        .map((f) => String(f || '').trim().toLowerCase())
        .filter(Boolean);
}

export function getUserFeatureCodes(user, contextFeatures) {
    const fromContext = normalizeFeatureCodes(contextFeatures);
    if (fromContext.length) return fromContext;
    const fromUser = normalizeFeatureCodes(user?.subscription_features);
    if (fromUser.length) return fromUser;
    return normalizeFeatureCodes(user?.settings?.subscription?.features);
}

export function hasPermission(user, requiredCodes) {
    if (!requiredCodes) return true;

    const required = Array.isArray(requiredCodes) ? requiredCodes : [requiredCodes];
    const requiredNorm = required.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
    if (!requiredNorm.length) return true;

    const available = getUserPermissionCodes(user);
    // If backend has not provided permission set yet, keep existing behavior (allow).
    if (!available.length) return true;

    return requiredNorm.some((code) => available.includes(code));
}

export function hasFeature(user, requiredFeatures, contextFeatures, planHint) {
    if (!requiredFeatures) return true;
    const required = Array.isArray(requiredFeatures) ? requiredFeatures : [requiredFeatures];
    const requiredNorm = required.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
    if (!requiredNorm.length) return true;
    const available = getUserFeatureCodes(user, contextFeatures);
    return requiredNorm.some(
        (code) => available.includes(code) || userMeetsFeatureTier(user, code, planHint),
    );
}

export function canAccessScreen(user, screenName, contextFeatures) {
    return getScreenPlanAccess(user, screenName, contextFeatures).allowed;
}

/** Platform-operator tools — never shown as plan upgrade locks to tenants. */
const PLATFORM_NAV_FEATURES = new Set([
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
]);

/** B2C customer-portal — never soft-shown to tenant billing admins (would clutter tabs). */
const CUSTOMER_PORTAL_NAV_FEATURES = new Set([
    'orders.view',
    'orders.details.view',
    'orders.create',
    'orders.cancel',
    'notifications.view',
]);

function normalizeFeatureList(raw) {
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
}

function isPlatformNavItem(features) {
    return features.some((f) => PLATFORM_NAV_FEATURES.has(f));
}

function isCustomerPortalNavItem(features) {
    return features.length > 0 && features.every((f) => CUSTOMER_PORTAL_NAV_FEATURES.has(f));
}

/** Shopynn platform operators — never shown tenant upgrade locks. */
export function isPlatformOperatorUser(user) {
    return hasPermission(user, 'tenants.directory.view');
}

/** Show in UI when user has permission; `locked` when plan upgrade is required.
 *  Billing admins still see sellable plan-locked items (e.g. Online Orders) when the
 *  restored role is missing the permission code — so upgrade CTAs remain visible.
 *  Never soft-unlock without the real permission (pages/APIs still enforce it).
 *  Customer-portal tabs (For You / Cart / My Orders) stay hide-only for admins.
 *  Platform-admin tools stay permission-gated only (never lock-to-upgrade).
 *  Platform operators with the permission skip plan locks (staff are not sold upgrades).
 */
export function getScreenPlanAccess(user, screenName, contextFeatures, planHint) {
    const needed = SCREEN_PERMISSION_MAP[screenName];
    const neededFeatures = SCREEN_FEATURE_MAP[screenName] || needed;
    const features = normalizeFeatureList(neededFeatures);
    if (!hasPermission(user, needed)) {
        if (
            isBillingAdminUser(user) &&
            !isPlatformOperatorUser(user) &&
            features.length > 0 &&
            !isPlatformNavItem(features) &&
            !isCustomerPortalNavItem(features)
        ) {
            return {
                show: true,
                locked: true,
                allowed: false,
                requiredPlanName: getMinimumTierDisplayForFeatures(features),
            };
        }
        return { show: false, locked: false, allowed: false };
    }
    if (!hasFeature(user, neededFeatures, contextFeatures, planHint)) {
        if (isPlatformNavItem(features)) {
            return { show: false, locked: false, allowed: false };
        }
        if (isPlatformOperatorUser(user)) {
            return { show: true, locked: false, allowed: true };
        }
        return {
            show: true,
            locked: true,
            allowed: false,
            requiredPlanName: getMinimumTierDisplayForFeatures(features),
        };
    }
    return { show: true, locked: false, allowed: true };
}

export function navigateToScreenOrUpgrade(navigation, user, screenName, contextFeatures, params, planHint) {
    const access = getScreenPlanAccess(user, screenName, contextFeatures, planHint);
    if (!access.show) return;
    if (access.locked) {
        navigation.navigate('UpgradePrompt', {
            screen: screenName,
            requiredPlanName: access.requiredPlanName,
        });
        return;
    }
    navigation.navigate(screenName, params);
}

const BILLING_ADMIN_ROLE_NAMES = new Set(['super admin', 'owner', 'administrator', 'admin']);

function collectUserRoleNames(user) {
    if (!user) return [];
    const names = [];
    if (typeof user.roles === 'string') {
        names.push(
            ...user.roles
                .split(',')
                .map((r) => String(r || '').trim().toLowerCase())
                .filter(Boolean),
        );
    } else if (Array.isArray(user.roles)) {
        names.push(
            ...user.roles
                .map((r) => String(typeof r === 'string' ? r : r?.name || '').trim().toLowerCase())
                .filter(Boolean),
        );
    }
    if (user.role != null) {
        const single = String(user.role).trim().toLowerCase();
        if (single) names.push(single);
    }
    if (Array.isArray(user?.settings?.roles)) {
        names.push(
            ...user.settings.roles
                .map((r) => String(r?.name || r || '').trim().toLowerCase())
                .filter(Boolean),
        );
    }
    return names;
}

/** Tenant owner / admin roles that can manage subscription billing. */
export function isBillingAdminUser(user) {
    const names = collectUserRoleNames(user);
    return names.some(
        (n) =>
            BILLING_ADMIN_ROLE_NAMES.has(n) ||
            n === 'superadmin' ||
            n.includes('super admin') ||
            n.includes('owner') ||
            n === 'administrator',
    );
}

/** Subscription & billing — billing-admin roles own the tenant plan/checkout.
 *  Do not block upgrade CTAs when subscription.view was omitted after a restore.
 *  Accepts (user), (user, opts), or (user, contextFeatures, opts).
 */
export function canManageSubscription(user, contextFeaturesOrOpts, opts) {
    if (!isBillingAdminUser(user)) return false;
    // Support mistaken (user, { allowWhenSubscriptionExpired }) call sites.
    if (
        contextFeaturesOrOpts &&
        typeof contextFeaturesOrOpts === 'object' &&
        !Array.isArray(contextFeaturesOrOpts) &&
        Object.prototype.hasOwnProperty.call(contextFeaturesOrOpts, 'allowWhenSubscriptionExpired')
    ) {
        return true;
    }
    void contextFeaturesOrOpts;
    void opts;
    return true;
}

function normalizeRoleName(role) {
    return String(role || '').trim().toLowerCase();
}

// Legacy role-based helpers (kept for backwards compatibility in existing screens)
export function canAdjustStock(roleOrUser) {
    if (typeof roleOrUser === 'object') return hasPermission(roleOrUser, ['adjustments.create', 'stock_counts.create']);
    const role = normalizeRoleName(roleOrUser);
    return role === normalizeRoleName(ROLES.Admin) || role === normalizeRoleName(ROLES.Manager);
}
export function canDeleteProducts(roleOrUser) {
    if (typeof roleOrUser === 'object') return hasPermission(roleOrUser, ['products.delete']);
    return normalizeRoleName(roleOrUser) === normalizeRoleName(ROLES.Admin);
}
export function canCreateReturns(roleOrUser) {
    if (typeof roleOrUser === 'object') return hasPermission(roleOrUser, ['returns.create']);
    const role = normalizeRoleName(roleOrUser);
    return role === normalizeRoleName(ROLES.Admin) || role === normalizeRoleName(ROLES.Manager);
}
export function canExportData(roleOrUser) {
    if (typeof roleOrUser === 'object') return hasPermission(roleOrUser, ['data_export.run', 'reports.export']);
    const role = normalizeRoleName(roleOrUser);
    return role === normalizeRoleName(ROLES.Admin) || role === normalizeRoleName(ROLES.Manager);
}
export function canManageUsers(roleOrUser) {
    if (typeof roleOrUser === 'object') return hasPermission(roleOrUser, ['users.view', 'users.create', 'users.update']);
    return normalizeRoleName(roleOrUser) === normalizeRoleName(ROLES.Admin);
}
