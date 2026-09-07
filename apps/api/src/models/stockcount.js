import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

/**
 * List stock count history with optional filters: tenant_id (required via user), startDate, endDate, warehouse_id.
 */
export const getStockCountsHistoryService = async (user, requestQuery = {}) => {
    const conditions = ["sc.tenant_id = $1"];
    const params = [user.tenant_id];
    let paramIndex = 2;

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`sc.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const warehouseId = requestQuery.warehouse_id ?? requestQuery.warehouseId;
    if (warehouseId) {
        conditions.push(`sc.warehouse_id = $${paramIndex}`);
        params.push(warehouseId);
        paramIndex += 1;
    }

    const search = requestQuery.name ?? requestQuery.search ?? requestQuery.q;
    if (search && String(search).trim()) {
        const term = `%${String(search).trim()}%`;
        conditions.push(`(sc.reference_number ILIKE $${paramIndex} OR sc.notes ILIKE $${paramIndex})`);
        params.push(term);
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT sc.id, sc.warehouse_id, sc.reference_number, sc.status, sc.number_of_items, sc.notes, sc.created_at,
               w.name AS warehouse_name,
               u.first_name AS creator_first_name, u.last_name AS creator_last_name
        FROM stock_counts sc
        LEFT JOIN warehouses w ON sc.warehouse_id = w.id
        LEFT JOIN users u ON sc.creator_id = u.id
        WHERE ${where}
        ORDER BY sc.created_at DESC
    `;
    const result = await pool.query(query, params);
    return result.rows;
};

export const getStockCountByIdService = async (id, tenant_id) => {
    const result = await pool.query(
        "SELECT sc.id, sc.warehouse_id, sc.reference_number, sc.status, sc.number_of_items, sc.notes, sc.created_at, sc.updated_at, w.name AS warehouse_name FROM stock_counts sc LEFT JOIN warehouses w ON sc.warehouse_id = w.id WHERE sc.id = $1 AND sc.tenant_id = $2",
        [id, tenant_id]
    );
    return result.rows[0];
};

export const getStockCountDetailsService = async (stock_count_id, tenant_id) => {
    const result = await pool.query(
        `SELECT scd.id, scd.expected_quantity, scd.counted_quantity, scd.variance, scd.notes,
                p.id AS product_id, p.name AS product_name, p.sku
         FROM stock_count_details scd
         JOIN stock_counts sc ON scd.stock_count_id = sc.id AND sc.tenant_id = $2
         LEFT JOIN products p ON scd.product_id = p.id
         WHERE scd.stock_count_id = $1`,
        [stock_count_id, tenant_id]
    );
    return result.rows;
};

export const createStockCountService = async (payload) => {
    console.log('createStockCountService payload', payload);

    const { warehouse_id, tenant_id, creator_id, reference_number, status, notes, items } = payload;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const id = uuidv4();
        const numberOfItems = Array.isArray(items) ? items.length : 0;
        await client.query(
            `INSERT INTO stock_counts (id, warehouse_id, tenant_id, creator_id, reference_number, status, number_of_items, notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
            [id, warehouse_id, tenant_id, creator_id, reference_number || null, status || "Completed", numberOfItems, notes || null, new Date()]
        );
        if (items && items.length > 0) {
            for (const d of items) {
                const detailId = uuidv4();
                const variance = (d.counted_quantity ?? 0) - (d.expected_quantity ?? 0);
                await client.query(
                    `INSERT INTO stock_count_details (id, stock_count_id, product_id, inventory_id, expected_quantity, counted_quantity, variance, notes, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
                    [detailId, id, d.product_id, d.inventory_id || null, d.expected_quantity ?? 0, d.counted_quantity ?? 0, variance, d.notes || null, new Date()]
                );
            }
        }
        await client.query("COMMIT");
        const created = await getStockCountByIdService(id, tenant_id);
        return created;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}
