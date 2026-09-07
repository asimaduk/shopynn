import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

/**
 * List notifications for the tenant. Shows notifications where user_id is null (tenant-wide) or user_id = current user.
 * Optional filters: startDate, endDate, read (true/false).
 */
export const getNotificationsService = async (user, requestQuery = {}) => {
    const conditions = ["(n.tenant_id = $1 AND (n.user_id IS NULL OR n.user_id = $2))"];
    const params = [user.tenant_id, user.id];
    let paramIndex = 3;

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`n.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const readFilter = requestQuery.read;
    if (readFilter === "true" || readFilter === true) {
        conditions.push("n.read_at IS NOT NULL");
    } else if (readFilter === "false" || readFilter === false) {
        conditions.push("n.read_at IS NULL");
    }

    conditions.push("n.deleted = false");

    const where = conditions.join(" AND ");
    const limit = Math.min(Number(requestQuery.limit) || 50, 100);
    const query = `
        SELECT n.id, n.type, n.title, n.message, n.read_at, n.metadata, n.created_at, n.icon, n.link, n.link_params, n.mobile_params, n.mobile_screen
        FROM notifications n
        WHERE ${where}
        ORDER BY n.created_at DESC
        LIMIT $${paramIndex}
    `;
    params.push(limit);
    const result = await pool.query(query, params);
    return result.rows;
};

export const getNotificationByIdService = async (id, tenant_id, user_id) => {
    const result = await pool.query(
        `SELECT n.* FROM notifications n
         WHERE n.id = $1 AND n.tenant_id = $2 AND (n.user_id IS NULL OR n.user_id = $3)`,
        [id, tenant_id, user_id]
    );
    return result.rows[0];
};

export const createNotificationService = async (payload) => {
    const { tenant_id, user_id, type, title, message, metadata, icon, link, link_params, mobile_params, mobile_screen } = payload;
    const id = uuidv4();
    await pool.query(
        `INSERT INTO notifications (id, tenant_id, user_id, type, title, message, metadata, created_at, icon, link, link_params, mobile_params, mobile_screen)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [id, tenant_id, user_id || null, type || "info", title || "", message || "", metadata || null, new Date(), icon || null, link || null, link_params || null, mobile_params || null, mobile_screen || null]
    );
    // const result = await pool.query("SELECT * FROM notifications WHERE id = $1", [id]);
    // return result.rows[0];
    return { id };
};

export const markNotificationReadService = async (id, tenant_id, user_id) => {
    const result = await pool.query(
        `UPDATE notifications SET read_at = $1, updated_at = $1
         WHERE id = $2 AND tenant_id = $3 AND (user_id IS NULL OR user_id = $4)
         RETURNING read_at`,
        [new Date(), id, tenant_id, user_id]
    );
    return result.rows[0];
};
