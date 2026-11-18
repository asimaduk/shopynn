/**
 * Shopynn Demo Store — shared sandbox for field agents and public "Try live demo".
 */

export const DEMO_OWNER_EMAIL = "demo@shopynn.app";
export const DEMO_VISITOR_EMAIL = "demo-visitor@shopynn.app";
export const DEMO_AGENT_EMAIL = "demo-agent@shopynn.app";
export const DEMO_TENANT_NAME = "Shopynn Demo Store";

/**
 * Public one-click demo user — browse a lived-in shop + try POS.
 * Prefer view/read codes so seeded activity shows; keep create only for sell/returns/customers.
 * No staff admin, catalog edits, purchases/expenses writes, or money initiation.
 */
export const DEMO_VISITOR_PERMISSION_CODES = Object.freeze([
    // Core + POS
    "dashboard.view",
    "dashboard.financials.view",
    "profile.view",
    "sales.view",
    "sales.view_all",
    "sales.create",
    "sales.details.view",
    "sales.by_date.view",
    "sales.daily_summary.view",
    "sales.pending.view",
    "sales.pending.retry",
    "returns.view",
    "returns.create",
    "returns.details.view",
    "reports.view",
    // Catalog / stock (browse)
    "products.view",
    "products.by_category.view",
    "products.transactions.view",
    "inventory.view",
    "inventory.low_stock.view",
    "inventory.reorder.view",
    "inventory.expiring.view",
    "categories.view",
    "adjustments.view",
    "adjustments.details.view",
    "stock_counts.view",
    "stock_counts.details.view",
    "transfers.view",
    "transfers.details.view",
    // People
    "customers.view",
    "customers.create",
    "customers.details.view",
    "customers.sales.view",
    "customers.payments.view",
    // Purchases / suppliers / expenses (browse only)
    "purchases.view",
    "purchases.view_all",
    "purchases.details.view",
    "suppliers.view",
    "suppliers.details.view",
    "suppliers.purchases.view",
    "expenses.view",
    "expenses.details.view",
    // Online storefront story
    "orders.store.view",
    "orders.delivery.view",
    "payments.view",
    // Setups (view-only; updates blocked by blockDemoSensitive)
    "company_profile.view",
    "warehouses.view",
    "locations.view",
    "receipt_settings.view",
    "settings.view",
    "notifications.view",
]);

export function settingsIndicateDemo(settings) {
    return Boolean(settings && typeof settings === "object" && !Array.isArray(settings) && settings.demo === true);
}

let cachedDemoTenantId = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000;

export function clearDemoTenantCache() {
    cachedDemoTenantId = null;
    cacheExpiresAt = 0;
}

/**
 * Resolve the demo tenant id (settings.demo or owner email). Cached briefly.
 * @param {import('pg').Pool} pool
 * @returns {Promise<string|null>}
 */
export async function resolveDemoTenantId(pool) {
    const now = Date.now();
    if (cachedDemoTenantId && now < cacheExpiresAt) {
        return cachedDemoTenantId;
    }

    const byFlag = await pool.query(
        `SELECT id FROM tenants WHERE (settings->>'demo') = 'true' ORDER BY updated_at DESC NULLS LAST LIMIT 1`
    );
    if (byFlag.rowCount > 0) {
        cachedDemoTenantId = byFlag.rows[0].id;
        cacheExpiresAt = now + CACHE_TTL_MS;
        return cachedDemoTenantId;
    }

    const byOwner = await pool.query(
        `SELECT t.id
         FROM tenants t
         INNER JOIN users u ON u.tenant_id = t.id
         WHERE lower(u.email) = lower($1)
         LIMIT 1`,
        [DEMO_OWNER_EMAIL]
    );
    cachedDemoTenantId = byOwner.rows[0]?.id ?? null;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cachedDemoTenantId;
}

/**
 * @param {string|null|undefined} tenantId
 * @param {import('pg').Pool} pool
 */
export async function isDemoTenantId(tenantId, pool) {
    if (!tenantId) return false;
    const demoId = await resolveDemoTenantId(pool);
    return Boolean(demoId && String(demoId) === String(tenantId));
}
