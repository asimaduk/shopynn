import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

/**
 * List roles for a tenant (and optionally system roles where tenant_id is null).
 */
export const getAllRolesService = async (tenant_id, requestQuery = {}) => {
    const conditions = ["(r.tenant_id = $1 OR r.tenant_id IS NULL)"];
    const params = [tenant_id];
    let paramIndex = 2;
    const search = requestQuery.search ?? requestQuery.q ?? requestQuery.name;
    if (search && String(search).trim()) {
        conditions.push(`(r.name ILIKE $${paramIndex} OR r.description ILIKE $${paramIndex})`);
        params.push(`%${String(search).trim()}%`);
        paramIndex++;
    }
    const where = conditions.join(" AND ");
    const query = `
        SELECT r.id, r.name, r.description, r.tenant_id, r.created_at, r.updated_at,
               (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count,
               (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
        FROM roles r
        WHERE ${where}
        ORDER BY r.name
    `;
    const result = await pool.query(query, params);
    return result.rows;
};

export const getRoleByIdService = async (id, tenant_id) => {
    const result = await pool.query(
        "SELECT id, name, description, tenant_id, created_at, updated_at FROM roles WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)",
        [id, tenant_id]
    );
    return result.rows[0];
};

/**
 * Get permissions for a role.
 */
export const getRolePermissionsService = async (role_id, tenant_id) => {
    const result = await pool.query(
        `SELECT p.id, p.code, p.name, p.description
         FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         JOIN roles r ON rp.role_id = r.id
         WHERE rp.role_id = $1 AND (r.tenant_id = $2 OR r.tenant_id IS NULL)
         ORDER BY p.code`,
        [role_id, tenant_id]
    );
    return result.rows;
};

export const createRoleService = async (payload) => {
    const { name, description, tenant_id } = payload;
    const id = uuidv4();
    await pool.query(
        `INSERT INTO roles (id, name, description, tenant_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [id, name, description || null, tenant_id || null, new Date()]
    );
    return getRoleByIdService(id, tenant_id);
};

export const updateRoleService = async (id, payload, tenant_id) => {
    const { name, description } = payload;
    // If provided, treat as "replace role permissions" (including empty array).
    const permission_ids = payload.permission_ids ?? payload.permissionIds ?? payload.permissions;
    const updates = [];
    const values = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }
    // If no role fields are being updated but permissions are, still proceed.
    const hasRoleUpdates = updates.length > 0;
    const hasPermissionUpdates = permission_ids !== undefined;
    if (!hasRoleUpdates && !hasPermissionUpdates) return getRoleByIdService(id, tenant_id);

    // Normalize permissions input into an array of ids.
    let normalizedPermissionIds = undefined;
    if (hasPermissionUpdates) {
        const list = Array.isArray(permission_ids) ? permission_ids : [];
        normalizedPermissionIds = list
            .map((p) => (typeof p === "string" ? p : p?.id))
            .filter(Boolean);
    }

    // Use a transaction so permission replacement is atomic.
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        if (hasRoleUpdates) {
            updates.push(`updated_at = $${i++}`);
            values.push(new Date(), id, tenant_id);
            await client.query(
                `UPDATE roles SET ${updates.join(", ")} WHERE id = $${i} AND (tenant_id = $${i + 1} OR tenant_id IS NULL)`,
                values
            );
        }

        if (hasPermissionUpdates) {
            // Replace role permissions set (supports clearing by passing []).
            await client.query("DELETE FROM role_permissions WHERE role_id = $1", [id]);
            for (const pid of normalizedPermissionIds) {
                await client.query(
                    "INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1, $2, $3) ON CONFLICT (role_id, permission_id) DO NOTHING",
                    [uuidv4(), id, pid]
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
    return getRoleByIdService(id, tenant_id);
};

export const deleteRoleService = async (id, tenant_id) => {
    const assignedUsersResult = await pool.query(
        `SELECT COUNT(*)::int AS assigned_users
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.role_id = $1
           AND (r.tenant_id = $2 OR r.tenant_id IS NULL)`,
        [id, tenant_id]
    );

    const assignedUsers = Number(assignedUsersResult.rows[0]?.assigned_users || 0);
    if (assignedUsers > 0) {
        return {
            message: "Role is assigned to users and cannot be deleted.",
            status: 400
        }
    }

    const result = await pool.query(
        "DELETE FROM roles WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL) RETURNING id",
        [id, tenant_id]
    );
    return result.rowCount > 0;
};

/**
 * Add a permission to a role.
 */
export const addPermissionToRoleService = async (role_id, permission_id, tenant_id) => {
    const role = await getRoleByIdService(role_id, tenant_id);
    if (!role) return null;
    const id = uuidv4();
    await pool.query(
        `INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1, $2, $3)
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [id, role_id, permission_id]
    );
    return getRolePermissionsService(role_id, tenant_id);
};

/**
 * Remove a permission from a role.
 */
export const removePermissionFromRoleService = async (role_id, permission_id, tenant_id) => {
    const result = await pool.query(
        `DELETE FROM role_permissions rp
         USING roles r
         WHERE rp.role_id = r.id AND rp.role_id = $1 AND rp.permission_id = $2
           AND (r.tenant_id = $3 OR r.tenant_id IS NULL)
         RETURNING rp.id`,
        [role_id, permission_id, tenant_id]
    );
    return result.rowCount > 0;
};

/**
 * Set all permissions for a role (replaces existing).
 */
export const setRolePermissionsService = async (role_id, permission_ids, tenant_id) => {
    const role = await getRoleByIdService(role_id, tenant_id);
    if (!role) return null;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("DELETE FROM role_permissions WHERE role_id = $1", [role_id]);
        if (permission_ids && permission_ids.length > 0) {
            for (const pid of permission_ids) {
                await client.query(
                    "INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1, $2, $3) ON CONFLICT (role_id, permission_id) DO NOTHING",
                    [uuidv4(), role_id, pid]
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
    return getRolePermissionsService(role_id, tenant_id);
}
