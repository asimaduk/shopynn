import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { createTenantService } from "./tenant.js";
import { createUserService } from "./user.js";
import { QUOTE_STATUS, QUOTE_KIND } from "../constants/billingCatalog.js";
import {
    buildQuoteLinesForOnboardService,
    insertOnboardingQuoteService,
    getPendingQuoteForTenantService,
    createAddonOnlyQuoteForTenantService,
    createUpgradeCollectQuoteForTenantService,
    merchantCanAccessTenantService,
    getOnboardingQuoteByIdService,
} from "./onboardingQuote.js";

/** Tenant role reused for every field agent; only `merchants.operate` is attached (plus any you add manually). */
export const FIELD_AGENT_ROLE_NAME = "Field agent";

/** Default % stored on `merchants.default_commission_percent` when promote/create omits a value (display only; payout uses line rates below). */
function defaultCommissionPercent() {
    const v = Number(process.env.MERCHANT_DEFAULT_COMMISSION_PERCENT);
    if (Number.isFinite(v) && v >= 0) return v;
    return 10;
}

function resolveMerchantDefaultCommissionPercent(default_commission_percent) {
    if (default_commission_percent != null && default_commission_percent !== "") {
        const n = Number(default_commission_percent);
        if (Number.isFinite(n) && n >= 0) return n;
    }
    return defaultCommissionPercent();
}

export const getMerchantByUserId = async (userId) => {
    const r = await pool.query(`SELECT * FROM merchants WHERE user_id = $1`, [userId]);
    return r.rows[0] || null;
};

export const getMerchantById = async (merchantId) => {
    const r = await pool.query(`SELECT * FROM merchants WHERE id = $1`, [merchantId]);
    return r.rows[0] || null;
};

/**
 * Admin: create a merchants row for an existing user.
 */
export const createMerchantRecordService = async ({ user_id, default_commission_percent }) => {
    if (!user_id) {
        throw new Error("user_id is required.");
    }
    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [user_id]);
    if (userCheck.rowCount === 0) {
        throw new Error("User not found.");
    }
    const existing = await pool.query("SELECT id FROM merchants WHERE user_id = $1", [user_id]);
    if (existing.rowCount > 0) {
        throw new Error("User is already registered as a merchant.");
    }
    const id = uuidv4();
    const now = new Date();
    const pct = resolveMerchantDefaultCommissionPercent(default_commission_percent);
    await pool.query(
        `INSERT INTO merchants (id, user_id, default_commission_percent, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)`,
        [id, user_id, pct, now]
    );
    return { id, user_id };
};

/**
 * Runs full tenant setup then links tenant to merchant and inserts pending commission from subscription amount.
 */
export const onboardBusinessForMerchantService = async (merchantRow, payload) => {
    const subscription_type = Number(payload.subscription_type);
    const addon_codes = Array.isArray(payload.addon_codes) ? payload.addon_codes : [];

    const result = await createTenantService({
        ...payload,
        skip_owner_email_verification: true,
    });
    const tenantId = result.tenant?.id;
    if (!tenantId) {
        throw new Error("Tenant creation returned no tenant id.");
    }
    const subscriptionId = result.subscription?.id ?? null;
    const ownerEmail = String(payload.owner_email || payload.email || result.tenant?.email || "").trim();

    const { lines, total_ghs } = await buildQuoteLinesForOnboardService(subscription_type, addon_codes);
    const isFreeNoCharge = total_ghs <= 0;
    const quoteStatus = isFreeNoCharge ? QUOTE_STATUS.NOT_REQUIRED : QUOTE_STATUS.PENDING_PAYMENT;

    const quote = await insertOnboardingQuoteService({
        tenant_id: tenantId,
        merchant_id: merchantRow.id,
        subscription_type,
        subscription_id: subscriptionId,
        owner_email: ownerEmail,
        lines,
        total_ghs,
        status: quoteStatus,
        quote_kind: QUOTE_KIND.FULL_ONBOARD,
    });

    return {
        ...result,
        quote,
        commission: null,
        payment_required: quoteStatus === QUOTE_STATUS.PENDING_PAYMENT,
    };
};

export const getOnboardedTenantsForMerchantService = async (merchantId) => {
    const r = await pool.query(
        `SELECT * FROM (
             SELECT DISTINCT ON (t.id)
                    t.id, t.name, t.organization, t.phone, t.email, t.created_at, t.updated_at,
                    s.id AS subscription_id, s.name AS subscription_name, s.amount AS subscription_amount,
                    s.status AS subscription_status, s.end_at AS subscription_end_at,
                    oq.id AS quote_id, oq.status AS quote_status, oq.total_ghs AS quote_total_ghs,
                    oq.quote_kind AS quote_kind
             FROM (
                 SELECT tenant_id FROM merchant_commissions WHERE merchant_id = $1
                 UNION
                 SELECT tenant_id FROM onboarding_quotes WHERE merchant_id = $1
             ) links
             INNER JOIN tenants t ON t.id = links.tenant_id
             LEFT JOIN subscriptions s ON t.subscription_id = s.id
             LEFT JOIN LATERAL (
                 SELECT id, status, total_ghs, quote_kind
                 FROM onboarding_quotes
                 WHERE tenant_id = t.id AND merchant_id = $1
                 ORDER BY created_at DESC
                 LIMIT 1
             ) oq ON true
             ORDER BY t.id, t.created_at ASC
         ) onboarded
         ORDER BY onboarded.created_at DESC`,
        [merchantId]
    );
    return r.rows;
};

export const createPayLaterQuoteForTenantService = async (merchantRow, tenantId, addon_codes, owner_email) => {
    const allowed = await merchantCanAccessTenantService(merchantRow.id, tenantId);
    if (!allowed) throw new Error("You do not have access to this business.");
    const pending = await getPendingQuoteForTenantService(tenantId);
    if (pending) {
        throw new Error("This business already has a pending payment quote. Collect or cancel it first.");
    }
    return createAddonOnlyQuoteForTenantService({
        tenant_id: tenantId,
        merchant_id: merchantRow.id,
        owner_email,
        addon_codes,
    });
};

export const createUpgradeCollectQuoteForMerchantService = async (
    merchantRow,
    tenantId,
    { subscription_type, addon_codes, owner_email }
) => {
    const allowed = await merchantCanAccessTenantService(merchantRow.id, tenantId);
    if (!allowed) throw new Error("You do not have access to this business.");
    const pending = await getPendingQuoteForTenantService(tenantId);
    if (pending) {
        throw new Error("This business already has a pending payment quote. Collect or cancel it first.");
    }
    return createUpgradeCollectQuoteForTenantService({
        tenant_id: tenantId,
        merchant_id: merchantRow.id,
        subscription_type,
        addon_codes,
        owner_email,
    });
};

export { getPendingQuoteForTenantService, getOnboardingQuoteByIdService, merchantCanAccessTenantService };

export const getCommissionsForMerchantService = async (merchantId, requestQuery = {}) => {
    const status = requestQuery.status ? String(requestQuery.status).trim() : null;
    const params = [merchantId];
    let where = "mc.merchant_id = $1";
    if (status && (status === "pending" || status === "paid")) {
        params.push(status);
        where += ` AND mc.status = $${params.length}`;
    }
    const r = await pool.query(
        `SELECT mc.id, mc.merchant_id, mc.tenant_id, mc.subscription_id, mc.base_amount, mc.commission_percent,
                mc.commission_amount, mc.status, mc.paid_at, mc.notes, mc.created_at,
                t.name AS tenant_name, t.organization AS tenant_organization
         FROM merchant_commissions mc
         INNER JOIN tenants t ON t.id = mc.tenant_id
         WHERE ${where}
         ORDER BY mc.created_at DESC`,
        params
    );
    return r.rows;
};

export const markCommissionPaidService = async (commissionId) => {
    const r = await pool.query(
        `UPDATE merchant_commissions
         SET status = 'paid', paid_at = $1
         WHERE id = $2 AND status = 'pending'
         RETURNING id, merchant_id, tenant_id, commission_amount, status, paid_at`,
        [new Date(), commissionId]
    );
    return r.rows[0] || null;
};

/** Admin: single merchant with user fields and onboarded tenants. */
export const getMerchantDetailForAdminService = async (merchantId) => {
    if (!merchantId) {
        return null;
    }
    const m = await pool.query(
        `SELECT m.id, m.user_id, m.default_commission_percent, m.created_at, m.updated_at,
                u.first_name, u.last_name, u.email, u.phone
         FROM merchants m
         INNER JOIN users u ON u.id = m.user_id
         WHERE m.id = $1`,
        [merchantId]
    );
    if (m.rowCount === 0) {
        return null;
    }
    const row = m.rows[0];
    const tenants = await getOnboardedTenantsForMerchantService(merchantId);
    const commissions = await getCommissionsForMerchantService(merchantId);
    return { merchant: row, tenants, commissions };
};

export const listMerchantsForAdminService = async () => {
    const r = await pool.query(
        `SELECT m.id, m.user_id, m.default_commission_percent, m.created_at, m.updated_at,
                u.first_name, u.last_name, u.email, u.phone,
                (SELECT COUNT(DISTINCT mc.tenant_id)::int FROM merchant_commissions mc WHERE mc.merchant_id = m.id) AS onboarded_count
         FROM merchants m
         INNER JOIN users u ON u.id = m.user_id
         ORDER BY m.created_at DESC`
    );
    return r.rows;
};

/** Users in tenant who are not already merchants (for promote UI). */
export const listEligibleUsersForMerchantPromoteService = async (tenantId) => {
    if (!tenantId) {
        return [];
    }
    const r = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.phone
         FROM users u
         WHERE u.tenant_id = $1
           AND COALESCE(u.deleted, false) = false
           AND COALESCE(u.is_active, true) = true
           AND NOT EXISTS (SELECT 1 FROM merchants m WHERE m.user_id = u.id)
         ORDER BY u.last_name ASC NULLS LAST, u.first_name ASC NULLS LAST, u.email ASC`,
        [tenantId]
    );
    return r.rows;
};

/**
 * Ensures a tenant-scoped "Field agent" role exists and has `merchants.operate`.
 */
export const ensureFieldAgentRoleForTenant = async (tenantId) => {
    if (!tenantId) {
        throw new Error("tenant_id is required.");
    }
    const permRes = await pool.query(`SELECT id FROM permissions WHERE code = $1`, ["merchants.operate"]);
    if (permRes.rowCount === 0) {
        throw new Error("merchants.operate permission not found. Run seed-permissions.");
    }
    const permId = permRes.rows[0].id;

    const existingRole = await pool.query(
        `SELECT id FROM roles WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
        [tenantId, FIELD_AGENT_ROLE_NAME]
    );
    let roleId;
    if (existingRole.rowCount > 0) {
        roleId = existingRole.rows[0].id;
    } else {
        roleId = uuidv4();
        const now = new Date();
        await pool.query(
            `INSERT INTO roles (id, name, description, tenant_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $5)`,
            [
                roleId,
                FIELD_AGENT_ROLE_NAME,
                "Field agent — merchant partner operations (onboard businesses, commissions).",
                tenantId,
                now,
            ]
        );
    }

    await pool.query(
        `INSERT INTO role_permissions (id, role_id, permission_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [uuidv4(), roleId, permId]
    );

    return { id: roleId };
};

async function deleteUserRowHard(userId) {
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
}

/**
 * Create user in tenant with Field agent role + merchants row (admin flow).
 */
export const createFieldAgentUserAndMerchantService = async ({
    tenant_id,
    actor_user_id,
    first_name,
    last_name,
    email,
    phone,
    default_commission_percent,
}) => {
    if (!tenant_id) {
        throw new Error("tenant_id is required.");
    }
    const role = await ensureFieldAgentRoleForTenant(tenant_id);
    const permRes = await pool.query(`SELECT id FROM permissions WHERE code = $1`, ["merchants.operate"]);
    const operatePermId = permRes.rows[0].id;

    const userResult = await createUserService({
        first_name,
        last_name,
        email,
        tenant_id,
        phone,
        registration_method: "manual",
        role_id: role.id,
        user_permissions: [operatePermId],
        assigned_by_user_id: actor_user_id,
        email_credentials: true,
    });

    if (userResult.message) {
        return { error: userResult.message };
    }

    const newUserId = userResult.id;
    try {
        await createMerchantRecordService({ user_id: newUserId, default_commission_percent });
    } catch (e) {
        await deleteUserRowHard(newUserId);
        throw e;
    }

    const merchant = await getMerchantByUserId(newUserId);
    return { user_id: newUserId, merchant };
};

/**
 * Admin: remove merchant status — clears tenant links, deletes commission rows, then merchants row.
 */
export const revokeMerchantRecordService = async (merchantId) => {
    if (!merchantId) {
        throw new Error("merchant id is required.");
    }
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const exists = await client.query(`SELECT id FROM merchants WHERE id = $1`, [merchantId]);
        if (exists.rowCount === 0) {
            await client.query("ROLLBACK");
            return null;
        }
        await client.query(`DELETE FROM merchant_commissions WHERE merchant_id = $1`, [merchantId]);
        await client.query(`DELETE FROM merchants WHERE id = $1`, [merchantId]);
        await client.query("COMMIT");
        return { id: merchantId };
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};
