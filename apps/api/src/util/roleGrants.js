import pool from "../config/db.js";
import { getUserPermissionsService } from "../models/userRole.js";

export const isReservedRoleName = (name) => String(name || "").trim().toLowerCase() === "super admin";

/** Permission codes in `permissionIds` that the caller does not hold. */
export const findUngrantablePermissionIds = async (user, permissionIds) => {
    const ids = (permissionIds || []).filter(Boolean);
    if (ids.length === 0) return [];
    const [callerCodes, requested] = await Promise.all([
        getUserPermissionsService(user.id, user.tenant_id),
        pool.query(`SELECT code FROM permissions WHERE id = ANY($1::text[])`, [ids]),
    ]);
    const held = new Set(callerCodes);
    return requested.rows.map((r) => r.code).filter((code) => !held.has(code));
};

export const isSuperAdminUser = async (userId, tenantId) => {
    const r = await pool.query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         JOIN users u ON u.id = ur.user_id
         WHERE ur.user_id = $1 AND u.tenant_id = $2 AND r.tenant_id = $2 AND lower(r.name) = 'super admin' LIMIT 1`,
        [userId, tenantId]
    );
    return r.rowCount > 0;
};

/**
 * Whether `user` may give `roleId` to someone: the role must belong to their shop and
 * carry no permission the caller lacks (so only a Super Admin can hand out Super Admin).
 */
export const canAssignRole = async (user, roleId) => {
    const role = await pool.query(`SELECT name FROM roles WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [roleId, user.tenant_id]);
    if (role.rowCount === 0) return false;
    const callerCodes = new Set(await getUserPermissionsService(user.id, user.tenant_id));
    if (isReservedRoleName(role.rows[0].name)) return isSuperAdminUser(user.id, user.tenant_id);
    const rolePerms = await pool.query(
        `SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1`,
        [roleId]
    );
    return rolePerms.rows.every((r) => callerCodes.has(r.code));
};
