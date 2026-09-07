import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Create an audit log entry.
 */
export const createAuditLogService = async (payload) => {
    const { user_id, tenant_id, action, entity_type, entity_id, details, ip_address } = payload;
    const id = uuidv4();
    await pool.query(
        `INSERT INTO audit_logs (id, user_id, tenant_id, action, entity_type, entity_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, user_id, tenant_id, action || null, entity_type || null, entity_id || null, details || null, ip_address || null, new Date()]
    );
    return id;
};

/**
 * List audit logs for a tenant with optional filters.
 */
export const getAuditLogsService = async (tenant_id, requestQuery = {}) => {
    const conditions = ["al.tenant_id = $1"];
    const params = [tenant_id];
    let paramIndex = 2;
    if (requestQuery.user_id) {
        conditions.push(`al.user_id = $${paramIndex}`);
        params.push(requestQuery.user_id);
        paramIndex++;
    }
    if (requestQuery.action) {
        conditions.push(`al.action = $${paramIndex}`);
        params.push(requestQuery.action);
        paramIndex++;
    }
    if (requestQuery.entity_type) {
        conditions.push(`al.entity_type = $${paramIndex}`);
        params.push(requestQuery.entity_type);
        paramIndex++;
    }
    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`al.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }
    const limit = Math.min(Number(requestQuery.limit) || 50, 200);
    const where = conditions.join(" AND ");
    const query = `
        SELECT al.id, al.user_id, al.action, al.entity_type, al.entity_id, al.details, al.ip_address, al.created_at,
               u.first_name AS user_first_name, u.last_name AS user_last_name, u.email AS user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE ${where}
        ORDER BY al.created_at DESC
        LIMIT $${paramIndex}
    `;
    params.push(limit);
    const result = await pool.query(query, params);
    return result.rows;
}
