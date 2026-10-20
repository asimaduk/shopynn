import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { defaultMinimumStockLevel } from "../util/reorderLevel.js";

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
               u.first_name AS creator_first_name, u.last_name AS creator_last_name,
               (SELECT COALESCE(SUM(scd.variance), 0)::float FROM stock_count_details scd
                 WHERE scd.stock_count_id = sc.id) AS variance
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

const badRequest = (message) => {
    const err = new Error(message);
    err.status = 400;
    return err;
};

export const createStockCountService = async (payload) => {
    const { warehouse_id, tenant_id, creator_id, reference_number, status, notes, items } = payload;
    if (!warehouse_id) throw badRequest("Select a store to count.");
    if (!Array.isArray(items) || items.length === 0) throw badRequest("Enter the actual count for at least one product.");
    for (const d of items) {
        const counted = Number(d?.counted_quantity);
        if (!d?.product_id || !Number.isFinite(counted) || counted < 0) {
            throw badRequest("Each counted product needs a quantity of zero or more.");
        }
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const id = uuidv4();
        const now = new Date();
        await client.query(
            `INSERT INTO stock_counts (id, warehouse_id, tenant_id, creator_id, reference_number, status, number_of_items, notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
            [id, warehouse_id, tenant_id, creator_id, reference_number || null, status || "Completed", items.length, notes || null, now]
        );

        const adjustmentLines = [];
        for (const d of items) {
            const counted = Number(d.counted_quantity);
            const inv = await client.query(
                "SELECT id, quantity_available FROM inventories WHERE product_id = $1 AND warehouse_id = $2 FOR UPDATE",
                [d.product_id, warehouse_id]
            );
            const inventoryId = inv.rows[0]?.id || null;
            const expected = inv.rowCount ? Number(inv.rows[0].quantity_available) || 0 : 0;
            const variance = counted - expected;

            await client.query(
                `INSERT INTO stock_count_details (id, stock_count_id, product_id, inventory_id, expected_quantity, counted_quantity, variance, notes, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
                [uuidv4(), id, d.product_id, inventoryId, expected, counted, variance, d.notes || null, now]
            );

            if (Math.abs(variance) < 1e-9) continue;
            if (inventoryId) {
                await client.query(
                    "UPDATE inventories SET quantity_available = $1, updated_at = $2 WHERE id = $3",
                    [counted, now, inventoryId]
                );
            } else {
                await client.query(
                    `INSERT INTO inventories (id, quantity_available, minimum_stock_level, product_id, warehouse_id, tenant_id, creator_id, created_at, updated_at)
                     VALUES ($1, $2, $8, $3, $4, $5, $6, $7, $7)`,
                    [uuidv4(), counted, d.product_id, warehouse_id, tenant_id, creator_id, now, await defaultMinimumStockLevel(client, tenant_id, d.product_id)]
                );
            }
            adjustmentLines.push({ product_id: d.product_id, variance, expected });
        }

        if (adjustmentLines.length) {
            const adjustmentId = uuidv4();
            const label = reference_number ? `Stock count ${reference_number}` : "Stock count";
            await client.query(
                `INSERT INTO adjustments (id, number_of_items, total_amount, reference_number, tenant_id, warehouse_id, notes, creator_id, created_at)
                 VALUES ($1, $2, 0, $3, $4, $5, $6, $7, $8)`,
                [adjustmentId, adjustmentLines.length, reference_number || null, tenant_id, warehouse_id, notes ? `${label}: ${notes}` : label, creator_id, now]
            );
            for (const line of adjustmentLines) {
                await client.query(
                    `INSERT INTO adjustmentdetails (id, adjustment_id, product_id, quantity, system_quantity, adjustment_type, category, comment, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [uuidv4(), adjustmentId, line.product_id, Math.abs(line.variance), line.expected, line.variance > 0 ? "addition" : "subtraction", null, label, now]
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
