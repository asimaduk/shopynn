import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { createTenantService } from "./tenant.js";
import { createUserService, activateUserWithCredentialsService } from "./user.js";
import { QUOTE_STATUS, QUOTE_KIND, COMMISSION_KIND, SUBSCRIPTION_RESIDUAL_COMMISSION_RATE } from "../constants/billingCatalog.js";
import {
    buildQuoteLinesForOnboardService,
    insertOnboardingQuoteService,
    getPendingQuoteForTenantService,
    createAddonOnlyQuoteForTenantService,
    createUpgradeCollectQuoteForTenantService,
    merchantCanAccessTenantService,
    getOnboardingQuoteByIdService,
} from "./onboardingQuote.js";
import { sendAgentOnboardWelcomeSmsService } from "../services/agentOnboardWelcomeSms.js";

/** Tenant role reused for every field agent; only `merchants.operate` is attached (plus any you add manually). */
export const FIELD_AGENT_ROLE_NAME = "Field agent";

/** Default % stored on `merchants.default_commission_percent` when promote/create omits a value (display only; payout uses line rates). */
function defaultCommissionPercent() {
    const v = Number(process.env.MERCHANT_DEFAULT_COMMISSION_PERCENT);
    if (Number.isFinite(v) && v >= 0) return v;
    return 5;
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

export const AGENT_TYPE = Object.freeze({ AGENT: "agent", MANAGER: "manager" });
export const AGENT_STATUS = Object.freeze({
    PENDING_APPROVAL: "pending_approval",
    ACTIVE: "active",
    REJECTED: "rejected",
    DEACTIVATED: "deactivated",
});

export const AGENT_MANAGER_ROLE_NAME = "Agent manager";

function normalizeAgentType(agent_type) {
    if (agent_type == null || agent_type === "") return AGENT_TYPE.AGENT;
    const t = String(agent_type).trim().toLowerCase();
    if (t !== AGENT_TYPE.AGENT && t !== AGENT_TYPE.MANAGER) {
        throw new Error("agent_type must be 'agent' or 'manager'.");
    }
    return t;
}

/** Throws unless `managerId` is an active manager (and not `selfId`). Returns null for empty input. */
async function resolveManagerId(managerId, selfId = null, db = pool) {
    if (managerId == null || String(managerId).trim() === "") return null;
    const id = String(managerId).trim();
    if (selfId && id === selfId) throw new Error("An agent cannot be their own manager.");
    const r = await db.query(`SELECT id, agent_type, status FROM merchants WHERE id = $1`, [id]);
    const m = r.rows[0];
    if (!m) throw new Error("Manager not found.");
    if (m.agent_type !== AGENT_TYPE.MANAGER) throw new Error("The selected manager is not an agent manager.");
    if (m.status !== AGENT_STATUS.ACTIVE) throw new Error("The selected manager is not active.");
    return id;
}

/**
 * Admin: create a merchants row for an existing user.
 */
export const createMerchantRecordService = async ({
    user_id,
    default_commission_percent,
    agent_type,
    manager_id,
    status = AGENT_STATUS.ACTIVE,
    recruited_by = null,
    approved_by = null,
}) => {
    if (!user_id) {
        throw new Error("user_id is required.");
    }
    const userCheck = await pool.query("SELECT id, tenant_id FROM users WHERE id = $1", [user_id]);
    if (userCheck.rowCount === 0) {
        throw new Error("User not found.");
    }
    const existing = await pool.query("SELECT id FROM merchants WHERE user_id = $1", [user_id]);
    if (existing.rowCount > 0) {
        throw new Error("User is already registered as a merchant.");
    }
    const type = normalizeAgentType(agent_type);
    const managerId = type === AGENT_TYPE.MANAGER ? null : await resolveManagerId(manager_id);
    const id = uuidv4();
    const now = new Date();
    const pct = resolveMerchantDefaultCommissionPercent(default_commission_percent);
    const isActive = status === AGENT_STATUS.ACTIVE;
    await pool.query(
        `INSERT INTO merchants (id, user_id, default_commission_percent, agent_type, manager_id, status,
                                recruited_by, approved_by, approved_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
        [id, user_id, pct, type, managerId, status, recruited_by, isActive ? approved_by : null, isActive ? now : null, now]
    );
    if (type === AGENT_TYPE.MANAGER) {
        await grantAgentManagerRole(user_id, userCheck.rows[0].tenant_id, approved_by);
    }
    return { id, user_id, agent_type: type, manager_id: managerId, status };
};

async function grantAgentManagerRole(userId, tenantId, assignedBy) {
    const role = await ensureRoleWithPermissions(tenantId, AGENT_MANAGER_ROLE_NAME,
        "Agent manager — recruits and supervises field agents.", ["merchants.operate", "merchants.manage_team"]);
    await pool.query(
        `INSERT INTO user_roles (id, user_id, role_id, assigned_by, created_at)
         SELECT $1, $2::varchar, $3::varchar, $4, now()
         WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = $2::varchar AND role_id = $3::varchar)`,
        [uuidv4(), userId, role.id, assignedBy || userId]
    );
}

async function revokeAgentManagerRole(userId, tenantId) {
    await pool.query(
        `DELETE FROM user_roles ur
         USING roles r
         WHERE ur.role_id = r.id AND ur.user_id = $1 AND r.tenant_id = $2 AND r.name = $3`,
        [userId, tenantId, AGENT_MANAGER_ROLE_NAME]
    );
}

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

    // The shop becomes this agent's (serving_merchant_id) only once it pays; see lockServingAgentOnFirstPaymentService.
    await pool.query(
        `UPDATE tenants SET onboarded_by_merchant_id = $2, updated_at = now() WHERE id = $1`,
        [tenantId, merchantRow.id]
    );

    // Official fee disclosure — reduces agents collecting unofficial cash from shops.
    sendAgentOnboardWelcomeSmsService({
        subscription_type,
        businessName: result.tenant?.name || payload.name || payload.organization,
        ownerPhone: result.user?.phone || payload.owner_phone || payload.phone,
        tenantPhone: result.tenant?.phone || payload.phone,
        payloadPhone: payload.owner_phone || payload.phone,
    }).catch((err) => {
        console.warn("[agent onboard welcome SMS]", err?.message || err);
    });

    return {
        ...result,
        quote,
        commission: null,
        payment_required: quoteStatus === QUOTE_STATUS.PENDING_PAYMENT,
    };
};

/** The agent a shop belongs to: its serving agent, or the onboarding agent until the first payment. */
export const TENANT_AGENT_SQL = "COALESCE(t.serving_merchant_id, t.onboarded_by_merchant_id)";

const TENANT_LIST_COLUMNS = `
    t.id, t.name, t.organization, t.phone, t.email, t.created_at, t.updated_at,
    t.serving_merchant_id, t.onboarded_by_merchant_id,
    ${TENANT_AGENT_SQL} AS agent_merchant_id,
    (t.serving_merchant_id IS NULL) AS awaiting_first_payment,
    s.id AS subscription_id, s.name AS subscription_name, s.amount AS subscription_amount,
    s.status AS subscription_status, s.end_at AS subscription_end_at,
    oq.id AS quote_id, oq.status AS quote_status, oq.total_ghs AS quote_total_ghs,
    oq.quote_kind AS quote_kind`;

const TENANT_LIST_JOINS = `
    LEFT JOIN subscriptions s ON t.subscription_id = s.id
    LEFT JOIN LATERAL (
        SELECT id, status, total_ghs, quote_kind
        FROM onboarding_quotes
        WHERE tenant_id = t.id
        ORDER BY created_at DESC
        LIMIT 1
    ) oq ON true`;

export const getOnboardedTenantsForMerchantService = async (merchantId) => {
    const r = await pool.query(
        `SELECT ${TENANT_LIST_COLUMNS},
                (t.serving_merchant_id = $1) AS is_serving_agent
         FROM tenants t
         ${TENANT_LIST_JOINS}
         WHERE ${TENANT_AGENT_SQL} = $1
         ORDER BY t.created_at DESC`,
        [merchantId]
    );
    return r.rows;
};

/**
 * Credits a shop to `merchantId` on its first payment: sets serving_merchant_id only while it is
 * unset and the agent is active. Returns the serving agent id after the call (may be someone else).
 */
export const lockServingAgentOnFirstPaymentService = async (tenantId, merchantId) => {
    if (!tenantId) return null;
    if (merchantId) {
        const locked = await pool.query(
            `UPDATE tenants t
             SET serving_merchant_id = $2, updated_at = now()
             WHERE t.id = $1 AND t.serving_merchant_id IS NULL
               AND EXISTS (SELECT 1 FROM merchants m WHERE m.id = $2 AND m.status = $3)
             RETURNING t.id`,
            [tenantId, merchantId, AGENT_STATUS.ACTIVE]
        );
        if (locked.rowCount > 0) {
            await pool.query(
                `INSERT INTO merchant_tenant_assignments (id, tenant_id, merchant_id, previous_merchant_id, reason, assigned_by, created_at)
                 VALUES ($1, $2, $3, NULL, $4, NULL, now())`,
                [uuidv4(), tenantId, merchantId, "First payment attribution"]
            );
            return merchantId;
        }
    }
    const r = await pool.query(`SELECT serving_merchant_id FROM tenants WHERE id = $1`, [tenantId]);
    return r.rows[0]?.serving_merchant_id || null;
};

export const isMerchantActiveService = async (merchantId) => {
    if (!merchantId) return false;
    const r = await pool.query(`SELECT 1 FROM merchants WHERE id = $1 AND status = $2`, [merchantId, AGENT_STATUS.ACTIVE]);
    return r.rowCount > 0;
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
        `SELECT ${MERCHANT_ADMIN_COLUMNS}
         FROM merchants m
         ${MERCHANT_ADMIN_JOINS}
         WHERE m.id = $1`,
        [merchantId]
    );
    if (m.rowCount === 0) {
        return null;
    }
    const row = m.rows[0];
    const tenants = await getOnboardedTenantsForMerchantService(merchantId);
    const commissions = await getCommissionsForMerchantService(merchantId);
    const team = row.agent_type === AGENT_TYPE.MANAGER ? await listTeamMembersService(merchantId) : [];
    return { merchant: row, tenants, commissions, team };
};

const MERCHANT_ADMIN_COLUMNS = `
    m.id, m.user_id, m.default_commission_percent, m.created_at, m.updated_at,
    m.agent_type, m.manager_id, m.status, m.status_reason, m.recruited_by,
    m.approved_at, m.deactivated_at,
    u.first_name, u.last_name, u.email, u.phone,
    mu.first_name AS manager_first_name, mu.last_name AS manager_last_name,
    ru.first_name AS recruited_by_first_name, ru.last_name AS recruited_by_last_name,
    (SELECT COUNT(*)::int FROM tenants t WHERE t.serving_merchant_id = m.id) AS serving_count,
    (SELECT COUNT(*)::int FROM tenants t
       WHERE t.serving_merchant_id IS NULL AND t.onboarded_by_merchant_id = m.id) AS awaiting_payment_count,
    (SELECT COUNT(DISTINCT mc.tenant_id)::int FROM merchant_commissions mc WHERE mc.merchant_id = m.id) AS onboarded_count,
    (SELECT COUNT(*)::int FROM merchants tm WHERE tm.manager_id = m.id AND tm.status = 'active') AS team_size`;

const MERCHANT_ADMIN_JOINS = `
    INNER JOIN users u ON u.id = m.user_id
    LEFT JOIN merchants mm ON mm.id = m.manager_id
    LEFT JOIN users mu ON mu.id = mm.user_id
    LEFT JOIN merchants rm ON rm.id = m.recruited_by
    LEFT JOIN users ru ON ru.id = rm.user_id`;

export const listMerchantsForAdminService = async () => {
    const r = await pool.query(
        `SELECT ${MERCHANT_ADMIN_COLUMNS}
         FROM merchants m
         ${MERCHANT_ADMIN_JOINS}
         ORDER BY (m.status = 'pending_approval') DESC, m.created_at DESC`
    );
    return r.rows;
};

/** Members whose manager is `managerId`, with shop counts and commission totals. */
export const listTeamMembersService = async (managerId) => {
    const r = await pool.query(
        `SELECT ${MERCHANT_ADMIN_COLUMNS},
                COALESCE((SELECT SUM(mc.commission_amount) FROM merchant_commissions mc
                          WHERE mc.merchant_id = m.id AND mc.status = 'pending'), 0)::numeric(12,2) AS pending_commission_ghs,
                COALESCE((SELECT SUM(mc.commission_amount) FROM merchant_commissions mc
                          WHERE mc.merchant_id = m.id AND mc.status = 'paid'), 0)::numeric(12,2) AS paid_commission_ghs
         FROM merchants m
         ${MERCHANT_ADMIN_JOINS}
         WHERE m.manager_id = $1
         ORDER BY (m.status = 'active') DESC, u.first_name ASC NULLS LAST, u.last_name ASC NULLS LAST`,
        [managerId]
    );
    return r.rows;
};

/** Shops belonging to the manager or anyone on their team, with the owning agent's name. */
export const listTeamTenantsService = async (managerId) => {
    const r = await pool.query(
        `SELECT ${TENANT_LIST_COLUMNS},
                au.first_name AS agent_first_name, au.last_name AS agent_last_name
         FROM tenants t
         INNER JOIN merchants am ON am.id = ${TENANT_AGENT_SQL}
         INNER JOIN users au ON au.id = am.user_id
         ${TENANT_LIST_JOINS}
         WHERE am.id = $1 OR am.manager_id = $1
         ORDER BY t.created_at DESC`,
        [managerId]
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
export const ensureFieldAgentRoleForTenant = async (tenantId) =>
    ensureRoleWithPermissions(
        tenantId,
        FIELD_AGENT_ROLE_NAME,
        "Field agent — merchant partner operations (onboard businesses, commissions).",
        ["merchants.operate"]
    );

async function ensureRoleWithPermissions(tenantId, roleName, description, permissionCodes) {
    if (!tenantId) {
        throw new Error("tenant_id is required.");
    }
    const permRes = await pool.query(`SELECT id, code FROM permissions WHERE code = ANY($1::text[])`, [permissionCodes]);
    if (permRes.rowCount !== permissionCodes.length) {
        throw new Error(`Permissions missing (${permissionCodes.join(", ")}). Run seed-permissions / migrations.`);
    }

    const existingRole = await pool.query(
        `SELECT id FROM roles WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
        [tenantId, roleName]
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
            [roleId, roleName, description, tenantId, now]
        );
    }

    for (const perm of permRes.rows) {
        await pool.query(
            `INSERT INTO role_permissions (id, role_id, permission_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (role_id, permission_id) DO NOTHING`,
            [uuidv4(), roleId, perm.id]
        );
    }

    return { id: roleId };
}

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
    agent_type,
    manager_id,
}) => {
    if (!tenant_id) {
        throw new Error("tenant_id is required.");
    }
    const type = normalizeAgentType(agent_type);
    if (type === AGENT_TYPE.AGENT) await resolveManagerId(manager_id);
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
        await createMerchantRecordService({
            user_id: newUserId,
            default_commission_percent,
            agent_type: type,
            manager_id,
            approved_by: actor_user_id,
        });
    } catch (e) {
        await deleteUserRowHard(newUserId);
        throw e;
    }

    const merchant = await getMerchantByUserId(newUserId);
    return { user_id: newUserId, merchant };
};

/**
 * Deactivate an agent. Commission history is kept; their shops (served, and onboarded but not yet
 * paid) pass to their manager when the manager is active, otherwise to Shopynn support (NULL).
 * A deactivated manager's team members report directly to Shopynn.
 */
export const deactivateMerchantService = async ({ merchantId, actorUserId = null, reason = null }) => {
    if (!merchantId) {
        throw new Error("merchant id is required.");
    }
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const res = await client.query(
            `SELECT m.id, m.status, m.agent_type, m.user_id, u.tenant_id, mgr.id AS manager_id, mgr.status AS manager_status
             FROM merchants m
             INNER JOIN users u ON u.id = m.user_id
             LEFT JOIN merchants mgr ON mgr.id = m.manager_id
             WHERE m.id = $1
             FOR UPDATE OF m`,
            [merchantId]
        );
        const row = res.rows[0];
        if (!row) {
            await client.query("ROLLBACK");
            return null;
        }
        if (row.status === AGENT_STATUS.DEACTIVATED) {
            await client.query("ROLLBACK");
            return { id: merchantId, status: row.status, unchanged: true, handed_to: null, shops_moved: 0 };
        }
        const heir = row.manager_id && row.manager_status === AGENT_STATUS.ACTIVE ? row.manager_id : null;
        const note = String(reason || "").trim().slice(0, 500) || null;

        const served = await client.query(
            `UPDATE tenants SET serving_merchant_id = $2, updated_at = now()
             WHERE serving_merchant_id = $1
             RETURNING id`,
            [merchantId, heir]
        );
        for (const t of served.rows) {
            await client.query(
                `INSERT INTO merchant_tenant_assignments (id, tenant_id, merchant_id, previous_merchant_id, reason, assigned_by, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, now())`,
                [uuidv4(), t.id, heir, merchantId, heir ? "Agent deactivated — handed to manager" : "Agent deactivated", actorUserId]
            );
        }
        const awaiting = await client.query(
            `UPDATE tenants SET onboarded_by_merchant_id = $2, updated_at = now()
             WHERE onboarded_by_merchant_id = $1 AND serving_merchant_id IS NULL
             RETURNING id`,
            [merchantId, heir]
        );
        if (row.agent_type === AGENT_TYPE.MANAGER) {
            await client.query(`UPDATE merchants SET manager_id = NULL, updated_at = now() WHERE manager_id = $1`, [merchantId]);
        }
        await client.query(
            `UPDATE merchants
             SET status = $2, deactivated_at = now(), deactivated_by = $3, status_reason = $4, updated_at = now()
             WHERE id = $1`,
            [merchantId, AGENT_STATUS.DEACTIVATED, actorUserId, note]
        );
        await client.query("COMMIT");
        return {
            id: merchantId,
            status: AGENT_STATUS.DEACTIVATED,
            handed_to: heir,
            shops_moved: served.rowCount + awaiting.rowCount,
        };
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

/** Admin: bring a deactivated agent back. Shops already handed over stay where they are. */
export const reactivateMerchantService = async ({ merchantId }) => {
    const r = await pool.query(
        `UPDATE merchants
         SET status = $2, deactivated_at = NULL, deactivated_by = NULL, status_reason = NULL, updated_at = now()
         WHERE id = $1 AND status = $3
         RETURNING id, status`,
        [merchantId, AGENT_STATUS.ACTIVE, AGENT_STATUS.DEACTIVATED]
    );
    return r.rows[0] || null;
};

/** Admin: change an agent's type or team. */
export const updateMerchantAdminService = async ({ merchantId, agent_type, manager_id, actorUserId }) => {
    const res = await pool.query(
        `SELECT m.*, u.tenant_id FROM merchants m INNER JOIN users u ON u.id = m.user_id WHERE m.id = $1`,
        [merchantId]
    );
    const m = res.rows[0];
    if (!m) return null;

    const nextType = agent_type === undefined ? m.agent_type : normalizeAgentType(agent_type);
    let nextManagerId = manager_id === undefined ? m.manager_id : await resolveManagerId(manager_id, m.id);
    if (nextType === AGENT_TYPE.MANAGER) nextManagerId = null;

    if (m.agent_type === AGENT_TYPE.MANAGER && nextType === AGENT_TYPE.AGENT) {
        const team = await pool.query(`SELECT 1 FROM merchants WHERE manager_id = $1 LIMIT 1`, [m.id]);
        if (team.rowCount > 0) {
            throw new Error("Move this manager's team to another manager before making them an agent.");
        }
    }

    await pool.query(
        `UPDATE merchants SET agent_type = $2, manager_id = $3, updated_at = now() WHERE id = $1`,
        [m.id, nextType, nextManagerId]
    );
    if (nextType === AGENT_TYPE.MANAGER && m.agent_type !== AGENT_TYPE.MANAGER) {
        await grantAgentManagerRole(m.user_id, m.tenant_id, actorUserId);
    } else if (nextType === AGENT_TYPE.AGENT && m.agent_type === AGENT_TYPE.MANAGER) {
        await revokeAgentManagerRole(m.user_id, m.tenant_id);
    }
    return { id: m.id, agent_type: nextType, manager_id: nextManagerId };
};

/**
 * Manager: recruit a field agent. The account stays inactive (no login, no email) until a
 * platform admin approves it.
 */
export const recruitFieldAgentForManagerService = async ({ managerRow, actorUserId, first_name, last_name, email, phone }) => {
    if (managerRow.agent_type !== AGENT_TYPE.MANAGER || managerRow.status !== AGENT_STATUS.ACTIVE) {
        throw new Error("Only active agent managers can recruit.");
    }
    const mgrUser = await pool.query(`SELECT tenant_id FROM users WHERE id = $1`, [managerRow.user_id]);
    const tenant_id = mgrUser.rows[0]?.tenant_id;
    const role = await ensureFieldAgentRoleForTenant(tenant_id);

    const userResult = await createUserService({
        first_name,
        last_name,
        email,
        tenant_id,
        phone,
        registration_method: "manual",
        role_id: role.id,
        assigned_by_user_id: actorUserId,
        email_credentials: false,
    });
    if (userResult.message) {
        return { error: userResult.message };
    }

    const newUserId = userResult.id;
    try {
        await pool.query(`UPDATE users SET is_active = false, updated_at = now() WHERE id = $1`, [newUserId]);
        await createMerchantRecordService({
            user_id: newUserId,
            agent_type: AGENT_TYPE.AGENT,
            manager_id: managerRow.id,
            status: AGENT_STATUS.PENDING_APPROVAL,
            recruited_by: managerRow.id,
        });
    } catch (e) {
        await deleteUserRowHard(newUserId);
        throw e;
    }
    return { user_id: newUserId, merchant: await getMerchantByUserId(newUserId) };
};

/** Admin: approve a recruit — activates the login and emails a temporary password. */
export const approveRecruitedAgentService = async ({ merchantId, actorUserId }) => {
    const r = await pool.query(
        `UPDATE merchants
         SET status = $2, approved_by = $3, approved_at = now(), status_reason = NULL, updated_at = now()
         WHERE id = $1 AND status = $4
         RETURNING id, user_id, status`,
        [merchantId, AGENT_STATUS.ACTIVE, actorUserId, AGENT_STATUS.PENDING_APPROVAL]
    );
    const row = r.rows[0];
    if (!row) return null;
    await activateUserWithCredentialsService(row.user_id);
    return { id: row.id, status: row.status };
};

export const rejectRecruitedAgentService = async ({ merchantId, actorUserId, reason }) => {
    const r = await pool.query(
        `UPDATE merchants
         SET status = $2, status_reason = $3, deactivated_by = $4, deactivated_at = now(), updated_at = now()
         WHERE id = $1 AND status = $5
         RETURNING id, status`,
        [merchantId, AGENT_STATUS.REJECTED, String(reason || "").trim().slice(0, 500) || null, actorUserId,
            AGENT_STATUS.PENDING_APPROVAL]
    );
    return r.rows[0] || null;
};

/** Manager: the merchants row of a team member, or null when not on this manager's team. */
export const getTeamMemberService = async (managerId, merchantId) => {
    const r = await pool.query(`SELECT * FROM merchants WHERE id = $1 AND manager_id = $2`, [merchantId, managerId]);
    return r.rows[0] || null;
};

/**
 * Manager: hand a team shop to another active agent on the team (or to the manager). A paid shop
 * changes serving agent (future residuals follow it); an unpaid one changes its onboarding agent.
 */
export const reassignTeamTenantService = async ({ managerRow, tenantId, merchantId, reason, actorUserId }) => {
    const target = String(merchantId || "").trim();
    if (!target) throw new Error("merchant_id is required.");
    const scope = await pool.query(
        `SELECT t.id, t.serving_merchant_id, t.onboarded_by_merchant_id
         FROM tenants t
         INNER JOIN merchants am ON am.id = ${TENANT_AGENT_SQL}
         WHERE t.id = $1 AND (am.id = $2 OR am.manager_id = $2)`,
        [tenantId, managerRow.id]
    );
    const tenant = scope.rows[0];
    if (!tenant) throw new Error("Business not found on your team.");

    const targetRes = await pool.query(
        `SELECT id FROM merchants WHERE id = $1 AND status = $2 AND (id = $3 OR manager_id = $3)`,
        [target, AGENT_STATUS.ACTIVE, managerRow.id]
    );
    if (targetRes.rowCount === 0) throw new Error("Choose an active agent on your team.");

    if (tenant.serving_merchant_id) {
        return assignServingMerchantService({
            tenantId,
            merchantId: target,
            reason: reason || "Reassigned by agent manager",
            assignedBy: actorUserId,
        });
    }
    const previous = tenant.onboarded_by_merchant_id;
    if (previous !== target) {
        await pool.query(`UPDATE tenants SET onboarded_by_merchant_id = $2, updated_at = now() WHERE id = $1`, [tenantId, target]);
    }
    return { tenant_id: tenantId, onboarded_by_merchant_id: target, previous_merchant_id: previous, unchanged: previous === target };
};

/**
 * Switch the serving field agent for a shop. Residual commission follows serving_merchant_id.
 * Pass merchant_id null to clear (Shopynn support takes over; no residual).
 */
export const assignServingMerchantService = async ({
    tenantId,
    merchantId,
    reason,
    assignedBy,
}) => {
    if (!tenantId) throw new Error("tenant id is required.");

    const tenantRes = await pool.query(`SELECT id, serving_merchant_id, name FROM tenants WHERE id = $1`, [
        tenantId,
    ]);
    if (tenantRes.rowCount === 0) throw new Error("Tenant not found.");
    const previous = tenantRes.rows[0].serving_merchant_id || null;

    let nextMerchantId = null;
    if (merchantId != null && String(merchantId).trim() !== "") {
        nextMerchantId = String(merchantId).trim();
        const m = await pool.query(`SELECT id, status FROM merchants WHERE id = $1`, [nextMerchantId]);
        if (m.rowCount === 0) throw new Error("Merchant (agent) not found.");
        if (m.rows[0].status !== AGENT_STATUS.ACTIVE) throw new Error("Merchant (agent) is not active.");
    }

    if (previous === nextMerchantId) {
        return {
            tenant_id: tenantId,
            serving_merchant_id: nextMerchantId,
            previous_merchant_id: previous,
            unchanged: true,
        };
    }

    await pool.query(`UPDATE tenants SET serving_merchant_id = $2, updated_at = now() WHERE id = $1`, [
        tenantId,
        nextMerchantId,
    ]);
    await pool.query(
        `INSERT INTO merchant_tenant_assignments (id, tenant_id, merchant_id, previous_merchant_id, reason, assigned_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [
            uuidv4(),
            tenantId,
            nextMerchantId,
            previous,
            reason ? String(reason).slice(0, 500) : "Serving agent reassigned",
            assignedBy || null,
        ]
    );

    return {
        tenant_id: tenantId,
        serving_merchant_id: nextMerchantId,
        previous_merchant_id: previous,
        unchanged: false,
    };
};

export const createResidualCommissionForSubscriptionPaymentService = async ({
    tenantId,
    paymentId,
    subscriptionId,
    amountGhs,
}) => {
    const round2 = (n) => Math.round(Number(n) * 100) / 100;

    if (!tenantId || !paymentId) return null;
    const base = Number(amountGhs);
    if (!Number.isFinite(base) || base <= 0) return null;

    const tenantRes = await pool.query(
        `SELECT serving_merchant_id, onboarded_by_merchant_id, subscription_id FROM tenants WHERE id = $1`,
        [tenantId]
    );
    const tenant = tenantRes.rows[0];
    if (!tenant) return null;
    // A shop an agent onboarded on a free plan becomes theirs when it first pays for a plan itself.
    const servingMerchantId = tenant.serving_merchant_id
        || (await lockServingAgentOnFirstPaymentService(tenantId, tenant.onboarded_by_merchant_id));
    if (!servingMerchantId || !(await isMerchantActiveService(servingMerchantId))) return null;

    const existing = await pool.query(
        `SELECT id FROM merchant_commissions WHERE payment_id = $1 LIMIT 1`,
        [paymentId]
    );
    if (existing.rowCount > 0) return existing.rows[0];

    const commission_amount = round2(base * SUBSCRIPTION_RESIDUAL_COMMISSION_RATE);
    if (commission_amount <= 0) return null;

    const id = uuidv4();
    await pool.query(
        `INSERT INTO merchant_commissions (
            id, merchant_id, tenant_id, subscription_id, quote_id, payment_id,
            base_amount, commission_percent, commission_amount,
            onboarding_commission_amount, subscription_commission_amount,
            status, payable_after, commission_kind, notes, created_at
        ) VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$8,0,$8,'pending',now(),$9,$10,now())`,
        [
            id,
            servingMerchantId,
            tenantId,
            subscriptionId || tenantRes.rows[0]?.subscription_id || null,
            paymentId,
            round2(base),
            SUBSCRIPTION_RESIDUAL_COMMISSION_RATE * 100,
            commission_amount,
            COMMISSION_KIND.RESIDUAL,
            "10% subscription residual",
        ]
    );
    return { id, commission_amount, merchant_id: servingMerchantId };
};
