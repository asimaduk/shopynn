import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import {
    PLATFORM_PERMISSION_CODES,
    SUPER_ADMIN_EXCLUDED_PERMISSION_CODES,
} from "../constants/permissionCodes.js";

async function ensureUserInTenant(user_id, tenant_id) {
    const r = await pool.query("SELECT id FROM users WHERE id = $1 AND tenant_id = $2", [user_id, tenant_id]);
    return r.rowCount > 0;
}

/**
 * Get all roles assigned to a user (for the user's tenant and system roles).
 */
export const getUserRolesService = async (user_id, tenant_id) => {
    const result = await pool.query(
        `SELECT r.id, r.name, r.description, r.tenant_id, ur.created_at AS assigned_at
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = $1 AND (r.tenant_id = $2 OR r.tenant_id IS NULL)
         ORDER BY r.name`,
        [user_id, tenant_id]
    );
    return result.rows;
};

/**
 * Get all permission codes the user has (via their roles). Used for authorization.
 */
export const getUserPermissionsService = async (user_id, tenant_id) => {
    // "Super Admin" should behave like full permissions for the tenant.
    // Some older tenants/users may have this role but incomplete role_permissions rows,
    // especially after new permissions are introduced.
    const superAdminRes = await pool.query(
        `SELECT 1
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1
           AND (r.tenant_id = $2 OR r.tenant_id IS NULL)
           AND lower(r.name) = 'super admin'
         LIMIT 1`,
        [user_id, tenant_id]
    );
    if (superAdminRes.rowCount > 0) {
        const excludedPlaceholders = SUPER_ADMIN_EXCLUDED_PERMISSION_CODES.map((_, i) => `$${i + 1}`).join(", ");
        const allPerms = await pool.query(
            `SELECT code
             FROM permissions
             WHERE code NOT IN (${excludedPlaceholders})
             ORDER BY code`,
            SUPER_ADMIN_EXCLUDED_PERMISSION_CODES
        );
        const baseCodes = allPerms.rows.map((r) => r.code);

        // Those platform codes are intentionally excluded from the shortcut above.
        // If they were explicitly assigned on role_permissions, merge them so authorization
        // matches /users/me (which reads role_permissions) and manual grants work.
        const explicitPlatform = await pool.query(
            `SELECT DISTINCT p.code
             FROM user_roles ur
             JOIN role_permissions rp ON rp.role_id = ur.role_id
             JOIN permissions p ON p.id = rp.permission_id
             JOIN roles r ON ur.role_id = r.id
             WHERE ur.user_id = $1
               AND (r.tenant_id = $2 OR r.tenant_id IS NULL)
               AND p.code = ANY($3::text[])`,
            [user_id, tenant_id, PLATFORM_PERMISSION_CODES]
        );
        const merged = [...baseCodes, ...explicitPlatform.rows.map((r) => r.code)];
        return [...new Set(merged)].sort((a, b) => a.localeCompare(b));
    }

    const result = await pool.query(
        `SELECT DISTINCT p.code
         FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p ON p.id = rp.permission_id
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = $1 AND (r.tenant_id = $2 OR r.tenant_id IS NULL)`,
        [user_id, tenant_id]
    );
    return result.rows.map((r) => r.code);
};

/**
 * Users in a tenant who have any of the given permission codes (via roles). Distinct by user id.
 */
export const getUsersWithPermissionCodesForTenant = async (tenant_id, permissionCodes) => {
    if (!tenant_id || !Array.isArray(permissionCodes) || permissionCodes.length === 0) {
        return [];
    }
    const result = await pool.query(
        `SELECT DISTINCT u.id, u.email
         FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         INNER JOIN role_permissions rp ON rp.role_id = r.id
         INNER JOIN permissions p ON p.id = rp.permission_id
         WHERE u.tenant_id = $1
           AND COALESCE(u.is_active, true) = true
           AND COALESCE(u.deleted, false) = false
           AND u.email IS NOT NULL
           AND btrim(u.email) <> ''
           AND (r.tenant_id = u.tenant_id OR r.tenant_id IS NULL)
           AND p.code = ANY($2::text[])`,
        [tenant_id, permissionCodes]
    );
    return result.rows;
};

/**
 * Assign a role to a user. User must belong to same tenant.
 */
export const assignRoleToUserService = async (user_id, role_id, assigned_by, tenant_id) => {
    const ok = await ensureUserInTenant(user_id, tenant_id);
    if (!ok) return null;
    const id = uuidv4();
    await pool.query(
        `INSERT INTO user_roles (id, user_id, role_id, assigned_by, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, role_id) DO UPDATE SET assigned_by = $4`,
        [id, user_id, role_id, assigned_by, new Date()]
    );
    return getUserRolesService(user_id, tenant_id);
};

/**
 * Remove a role from a user. User must belong to same tenant.
 */
export const removeRoleFromUserService = async (user_id, role_id, tenant_id) => {
    const ok = await ensureUserInTenant(user_id, tenant_id);
    if (!ok) return false;
    const result = await pool.query(
        `DELETE FROM user_roles ur
         USING roles r
         WHERE ur.role_id = r.id AND ur.user_id = $1 AND ur.role_id = $2
           AND (r.tenant_id = $3 OR r.tenant_id IS NULL)
         RETURNING ur.id`,
        [user_id, role_id, tenant_id]
    );
    return result.rowCount > 0;
};

/**
 * Set roles for a user (replaces current assignments). User must belong to same tenant.
 */
export const setUserRolesService = async (user_id, role_ids, assigned_by, tenant_id) => {
    const ok = await ensureUserInTenant(user_id, tenant_id);
    if (!ok) return null;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `DELETE FROM user_roles ur
             USING roles r
             WHERE ur.role_id = r.id AND ur.user_id = $1 AND (r.tenant_id = $2 OR r.tenant_id IS NULL)`,
            [user_id, tenant_id]
        );
        if (role_ids && role_ids.length > 0) {
            for (const role_id of role_ids) {
                await client.query(
                    `INSERT INTO user_roles (id, user_id, role_id, assigned_by, created_at)
                     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, role_id) DO NOTHING`,
                    [uuidv4(), user_id, role_id, assigned_by, new Date()]
                );
            }
        }
        await client.query("COMMIT");
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
    return getUserRolesService(user_id, tenant_id);
};

/**
 * List users with their assigned roles (for tenant). Optional filter by role_id.
 */
export const getUsersWithRolesService = async (tenant_id, requestQuery = {}) => {
    const roleId = requestQuery.role_id ?? requestQuery.roleId;
    const conditions = ["u.tenant_id = $1"];
    const params = [tenant_id];
    let paramIndex = 2;
    conditions.push(`NOT EXISTS (
        SELECT 1
        FROM customer_profiles cp
        WHERE cp.user_id = u.id
          AND cp.tenant_id = u.tenant_id
          AND (cp.profile_type IS NULL OR lower(trim(cp.profile_type)) = 'customer')
    )`);
    if (roleId) {
        conditions.push(`EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = $${paramIndex})`);
        params.push(roleId);
        paramIndex++;
    }
    const where = conditions.join(" AND ");
    const query = `
        SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.is_active, u.user_type, u.last_login,
               (SELECT COALESCE(json_agg(json_build_object('id', r.id, 'name', r.name)), '[]')
                FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = u.id AND (r.tenant_id = u.tenant_id OR r.tenant_id IS NULL)) AS roles
        FROM users u
        WHERE ${where}
        ORDER BY u.first_name, u.last_name
    `;
    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
        ...row,
        roles: typeof row.roles === "string" ? JSON.parse(row.roles || "[]") : row.roles || [],
    }));
};
