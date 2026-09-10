import pool from "../config/db.js";

/**
 * List all permissions (system-defined). Optional filter by code/name search.
 */
/** Hidden from role/permission pickers; still enforced on routes when assigned in DB. */
const PERMISSION_LIST_EXCLUDES = [
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
];

export const getAllPermissionsService = async (requestQuery = {}) => {
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    const search = requestQuery.search ?? requestQuery.q ?? requestQuery.code;
    if (search && String(search).trim()) {
        conditions.push(`(p.code ILIKE $${paramIndex} OR p.name ILIKE $${paramIndex})`);
        params.push(`%${String(search).trim()}%`);
        paramIndex++;
    }
    const excludePlaceholders = PERMISSION_LIST_EXCLUDES.map((_, i) => `$${paramIndex + i}`).join(", ");
    conditions.push(`p.code NOT IN (${excludePlaceholders})`);
    params.push(...PERMISSION_LIST_EXCLUDES);
    paramIndex += PERMISSION_LIST_EXCLUDES.length;

    const where = `WHERE ${conditions.join(" AND ")}`;
    const query = `
        SELECT p.id, p.code, p.name, p.description, p.created_at
        FROM permissions p
        ${where}
        ORDER BY p.code
    `;
    const result = await pool.query(query, params);
    return result.rows;
};

/**
 * Get permission by id or code.
 */
export const getPermissionByIdService = async (idOrCode) => {
    const result = await pool.query(
        "SELECT id, code, name, description, created_at FROM permissions WHERE id = $1 OR code = $1",
        [idOrCode]
    );
    return result.rows[0];
};
