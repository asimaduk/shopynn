import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

/**
 * List returns history with optional filters: tenant_id (via user), startDate, endDate, warehouse_id, status.
 */
export const getReturnsHistoryService = async (user, requestQuery = {}) => {
    const conditions = ["r.tenant_id = $1"];
    const params = [user.tenant_id];
    let paramIndex = 2;

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`r.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const warehouseId = requestQuery.warehouse_id ?? requestQuery.warehouseId;
    if (warehouseId) {
        conditions.push(`r.warehouse_id = $${paramIndex}`);
        params.push(warehouseId);
        paramIndex += 1;
    }

    const status = requestQuery.status;
    if (status !== undefined && status !== null && status !== "") {
        conditions.push(`r.status = $${paramIndex}`);
        params.push(String(status).trim());
        paramIndex += 1;
    }

    const search = requestQuery.name ?? requestQuery.search ?? requestQuery.q;
    if (search && String(search).trim()) {
        const term = `%${String(search).trim()}%`;
        conditions.push(`(r.reference_number ILIKE $${paramIndex} OR r.notes ILIKE $${paramIndex})`);
        params.push(term);
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT r.id, r.reference_number, r.sale_id, r.customer_id, r.warehouse_id, r.status, r.total_amount, r.notes, r.created_at,
               w.name AS warehouse_name,
               c.name AS customer_name,
               u.first_name AS creator_first_name, u.last_name AS creator_last_name
        FROM returns r
        LEFT JOIN warehouses w ON r.warehouse_id = w.id
        LEFT JOIN customers c ON r.customer_id = c.id
        LEFT JOIN users u ON r.creator_id = u.id
        WHERE ${where}
        ORDER BY r.created_at DESC
    `;
    const result = await pool.query(query, params);
    return result.rows;
};

export const getReturnByIdService = async (id, tenant_id) => {
    const result = await pool.query(
        `SELECT r.*, w.name AS warehouse_name, c.name AS customer_name
         FROM returns r
         LEFT JOIN warehouses w ON r.warehouse_id = w.id
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.id = $1 AND r.tenant_id = $2`,
        [id, tenant_id]
    );
    return result.rows[0];
};

export const getReturnDetailsService = async (return_id, tenant_id) => {
    const result = await pool.query(
        `SELECT rd.id, rd.quantity, rd.unit_price, rd.reason, rd.notes,
                p.id AS product_id, p.name AS product_name, p.sku
         FROM return_details rd
         JOIN returns r ON rd.return_id = r.id AND r.tenant_id = $2
         LEFT JOIN products p ON rd.product_id = p.id
         WHERE rd.return_id = $1`,
        [return_id, tenant_id]
    );
    return result.rows;
};

export const createReturnService = async (payload) => {
    const { reference_number, sale_id, customer_id, warehouse_id, tenant_id, creator_id, status, total_amount, notes, details } = payload;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const id = uuidv4();
        await client.query(
            `INSERT INTO returns (id, reference_number, sale_id, customer_id, warehouse_id, tenant_id, creator_id, status, total_amount, notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
            [id, reference_number || null, sale_id || null, customer_id || null, warehouse_id, tenant_id, creator_id, status || "draft", total_amount ?? 0, notes || null, new Date()]
        );
        if (details && details.length > 0) {
            for (const d of details) {
                const detailId = uuidv4();
                await client.query(
                    `INSERT INTO return_details (id, return_id, product_id, quantity, unit_price, reason, notes, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
                    [detailId, id, d.product_id, d.quantity ?? 0, d.unit_price ?? null, d.reason || null, d.notes || null, new Date()]
                );
            }
        }
        await client.query("COMMIT");
        const created = await getReturnByIdService(id, tenant_id);
        return created;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
};
