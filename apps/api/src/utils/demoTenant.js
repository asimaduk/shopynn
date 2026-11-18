/**
 * Shopynn Demo Store — shared sandbox for field agents and public "Try live demo".
 */

export const DEMO_OWNER_EMAIL = "demo@shopynn.app";
export const DEMO_TENANT_NAME = "Shopynn Demo Store";

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
