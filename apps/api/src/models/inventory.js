import pool from "../config/db.js";
import { v4 as uuidv4 } from 'uuid';
import { normalizeInventoryListRow } from "../util/inventoryNormalize.js";

export const getAllInventoriesService = async (warehouse_id, tenant_id = null, queryParams = {}) => {
    const filterByTenant = tenant_id != null;
    const stockStatus = (queryParams.stockStatus || "").toLowerCase();
    const isLow = stockStatus === "low";
    const isNearLow = stockStatus === "nearlow" || stockStatus === "near_low";

    let where = "inv.warehouse_id=$1";
    const params = [warehouse_id];
    if (filterByTenant) {
        where += " AND inv.tenant_id=$2";
        params.push(tenant_id);
    }
    if (isLow) {
        where += " AND inv.quantity_available <= COALESCE(inv.minimum_stock_level, 0)";
    } else if (isNearLow) {
        where += " AND inv.quantity_available > COALESCE(inv.minimum_stock_level, 0) AND inv.quantity_available <= 2 * COALESCE(inv.minimum_stock_level, 0)";
    }

    const query = `SELECT 
        inv.quantity_available AS inventory, 
        inv.minimum_stock_level AS minimum, 
        pro.id, 
        pro.name, 
        pro.sku, 
        pro.unit_price, 
        pro.alt_price, 
        pro.categories, 
        pro.slug, 
        pro.thumbnail, 
        pro.is_active AS active 
        FROM inventories inv 
        LEFT JOIN products pro ON inv.product_id = pro.id 
        WHERE ${where} 
        ORDER BY inv.updated_at DESC`;
    const result = await pool.query(query, params);
    return result.rows.map(normalizeInventoryListRow);
};

/**
 * Stock summary for a tenant (optionally filtered by warehouse).
 * Returns:
 *  - inventoryCount: number of distinct products in inventory
 *  - totalUnits: total quantity_available across inventories
 *  - stockValue: total inventory value (quantity * unit_price)
 *  - lowStockCount: number of low-stock inventory rows
 *  - items: list of inventories with their stock values
 */
export const getStockSummaryService = async (tenant_id, queryParams = {}) => {
    const warehouseId = queryParams.warehouse_id ?? queryParams.warehouseId;
    const params = [tenant_id];
    let where = "inv.tenant_id = $1";
    let paramIndex = 2;
    if (warehouseId) {
        where += ` AND inv.warehouse_id = $${paramIndex}`;
        params.push(warehouseId);
        paramIndex++;
    }

    const summaryQuery = `
        SELECT
            COUNT(DISTINCT inv.product_id)::int AS inventory_count,
            COALESCE(SUM(inv.quantity_available), 0)::int AS total_units,
            COALESCE(SUM(inv.quantity_available * p.unit_price), 0)::numeric AS stock_value,
            COALESCE(SUM(CASE WHEN inv.quantity_available <= COALESCE(inv.minimum_stock_level, 0) THEN 1 ELSE 0 END), 0)::int AS low_stock_count
        FROM inventories inv
        JOIN products p ON inv.product_id = p.id AND p.tenant_id = inv.tenant_id
        WHERE ${where}
    `;
    const summaryResult = await pool.query(summaryQuery, params);
    const summary = summaryResult.rows[0] || {
        inventory_count: 0,
        total_units: 0,
        stock_value: 0,
        low_stock_count: 0,
    };

    const itemsQuery = `
        SELECT
            inv.id,
            inv.product_id,
            inv.quantity_available,
            inv.minimum_stock_level,
            inv.warehouse_id,
            w.name AS warehouse_name,
            p.name AS product_name,
            p.sku,
            p.unit_price,
            (inv.quantity_available * p.unit_price)::numeric AS stock_value
        FROM inventories inv
        JOIN products p ON inv.product_id = p.id AND p.tenant_id = inv.tenant_id
        LEFT JOIN warehouses w ON inv.warehouse_id = w.id
        WHERE ${where}
        ORDER BY stock_value DESC, p.name ASC
    `;
    const itemsResult = await pool.query(itemsQuery, params);

    return {
        inventoryCount: Number(summary.inventory_count || 0),
        totalUnits: Number(summary.total_units || 0),
        stockValue: Number(summary.stock_value || 0),
        lowStockCount: Number(summary.low_stock_count || 0),
        items: itemsResult.rows,
    };
};

/**
 * Slow moving inventories: items with stock on hand but low or zero sales in the recent period.
 * Defaults:
 *  - windowDays: 30 (look back 30 days)
 *  - maxSold: 0   (no sales in that window)
 * Optional:
 *  - warehouse_id / warehouseId: limit to a specific warehouse
 */
export const getSlowMovingInventoriesService = async (tenant_id, queryParams = {}) => {
    const windowDaysRaw = queryParams.windowDays ?? queryParams.window_days ?? 30;
    const maxSoldRaw = queryParams.maxSold ?? queryParams.max_sold ?? 0;
    const warehouseId = queryParams.warehouse_id ?? queryParams.warehouseId ?? null;

    const windowDays = Number.isNaN(Number(windowDaysRaw)) ? 30 : Number(windowDaysRaw);
    const maxSold = Number.isNaN(Number(maxSoldRaw)) ? 0 : Number(maxSoldRaw);

    const params = [tenant_id, windowDays];
    let salesWhere = "s.tenant_id = $1 AND s.created_at >= (CURRENT_DATE - ($2 || ' days')::interval)";
    let invWhere = "inv.tenant_id = $1";
    let paramIndex = 3;

    if (warehouseId) {
        salesWhere += ` AND sd.warehouse_id = $${paramIndex}`;
        invWhere += ` AND inv.warehouse_id = $${paramIndex}`;
        params.push(warehouseId);
        paramIndex++;
    }

    params.push(maxSold);

    const query = `
        WITH sales_agg AS (
            SELECT
                sd.product_id,
                sd.warehouse_id,
                COALESCE(SUM(sd.quantity), 0)::int AS sold_qty,
                MAX(s.created_at) AS last_sale_at
            FROM saledetails sd
            JOIN sales s ON sd.sale_id = s.id
            WHERE ${salesWhere}
            GROUP BY sd.product_id, sd.warehouse_id
        )
        SELECT
            inv.id,
            inv.product_id,
            inv.quantity_available,
            inv.minimum_stock_level,
            inv.warehouse_id,
            w.name AS warehouse_name,
            p.name AS product_name,
            p.sku,
            p.unit_price,
            COALESCE(sa.sold_qty, 0) AS sold_last_window,
            sa.last_sale_at,
            (inv.quantity_available * p.unit_price)::numeric AS stock_value
        FROM inventories inv
        JOIN products p ON inv.product_id = p.id AND p.tenant_id = inv.tenant_id
        LEFT JOIN warehouses w ON inv.warehouse_id = w.id
        LEFT JOIN sales_agg sa ON sa.product_id = inv.product_id AND sa.warehouse_id = inv.warehouse_id
        WHERE ${invWhere}
          AND inv.quantity_available > 0
          AND COALESCE(sa.sold_qty, 0) <= $${paramIndex}
        ORDER BY
          COALESCE(sa.sold_qty, 0) ASC,
          sa.last_sale_at ASC NULLS FIRST,
          p.name ASC
    `;

    const result = await pool.query(query, params);
    return result.rows;
};

/**
 * Expiring inventories: items whose expiration_date is within a future window.
 * Defaults:
 *  - windowDays: 30 (next 30 days)
 * Optional:
 *  - warehouse_id / warehouseId: limit to a specific warehouse
 */
export const getExpiringInventoriesService = async (tenant_id, queryParams = {}) => {
    const windowDaysRaw = queryParams.windowDays ?? queryParams.window_days ?? 30;
    const warehouseId = queryParams.warehouse_id ?? queryParams.warehouseId ?? null;

    const windowDays = Number.isNaN(Number(windowDaysRaw)) ? 30 : Number(windowDaysRaw);

    const params = [tenant_id, windowDays];
    let where = `
        inv.tenant_id = $1
        AND inv.expiration_date IS NOT NULL
        AND inv.expiration_date >= CURRENT_DATE
        AND inv.expiration_date <= CURRENT_DATE + ($2 || ' days')::interval
    `;
    let paramIndex = 3;

    if (warehouseId) {
        where += ` AND inv.warehouse_id = $${paramIndex}`;
        params.push(warehouseId);
        paramIndex++;
    }

    const query = `
        SELECT
            inv.id,
            inv.product_id,
            inv.quantity_available,
            inv.minimum_stock_level,
            inv.expiration_date,
            inv.warehouse_id,
            w.name AS warehouse_name,
            p.name AS product_name,
            p.sku,
            p.unit_price,
            (inv.quantity_available * p.unit_price)::numeric AS stock_value
        FROM inventories inv
        JOIN products p ON inv.product_id = p.id AND p.tenant_id = inv.tenant_id
        LEFT JOIN warehouses w ON inv.warehouse_id = w.id
        WHERE ${where}
        ORDER BY inv.expiration_date ASC, p.name ASC
    `;

    const result = await pool.query(query, params);
    return result.rows;
};

/**
 * Top selling inventories: most sold products for a tenant.
 * Criteria:
 *  - Sums quantity from saledetails over an optional date range.
 *  - Respects tenant and optional warehouse filter.
 *  - Limited by `limit`/`count` query param (default 10).
 */
export const getTopSellingInventoriesService = async (tenant_id, queryParams = {}) => {
    const limitRaw = queryParams.limit ?? queryParams.count ?? 10;
    let limit = parseInt(limitRaw, 10);
    if (Number.isNaN(limit) || limit <= 0) limit = 10;
    if (limit > 100) limit = 100;

    const startDate = queryParams.startDate ?? queryParams.from ?? null;
    const endDate = queryParams.endDate ?? queryParams.to ?? null;
    const warehouseId = queryParams.warehouse_id ?? queryParams.warehouseId ?? null;

    const params = [tenant_id];
    let where = "s.tenant_id = $1";
    let paramIndex = 2;

    if (startDate && endDate) {
        where += ` AND s.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(startDate, endDate);
        paramIndex += 2;
    }

    if (warehouseId) {
        where += ` AND sd.warehouse_id = $${paramIndex}`;
        params.push(warehouseId);
        paramIndex++;
    }

    params.push(limit);

    const query = `
        SELECT
            sd.product_id,
            sd.warehouse_id,
            COALESCE(SUM(sd.quantity), 0)::int AS total_sold,
            COALESCE(SUM(sd.quantity * sd.unit_price), 0)::numeric AS total_revenue,
            p.name AS product_name,
            p.sku,
            p.unit_price,
            w.name AS warehouse_name,
            inv.id AS inventory_id,
            inv.quantity_available,
            inv.minimum_stock_level
        FROM saledetails sd
        JOIN sales s ON sd.sale_id = s.id
        JOIN products p ON sd.product_id = p.id AND p.tenant_id = s.tenant_id
        LEFT JOIN warehouses w ON sd.warehouse_id = w.id
        LEFT JOIN inventories inv
            ON inv.product_id = sd.product_id
           AND inv.warehouse_id = sd.warehouse_id
           AND inv.tenant_id = s.tenant_id
        WHERE ${where}
        GROUP BY
            sd.product_id,
            sd.warehouse_id,
            p.name,
            p.sku,
            p.unit_price,
            w.name,
            inv.id,
            inv.quantity_available,
            inv.minimum_stock_level
        ORDER BY total_sold DESC, total_revenue DESC, p.name ASC
        LIMIT $${paramIndex}
    `;

    const result = await pool.query(query, params);
    return result.rows;
};

export const getInventoryByIdService = async (id) => {
    const result = await pool.query("SELECT quantity_available AS quantity, minimum_stock_level AS minimum, maximum_stock_level AS maximum, notes FROM inventories where id = $1", [id]);
    return result.rows[0];
};

export const createInventoryService = async (payload) => {
    const { product_id, quantity_available, minimum_stock_level, tenant_id, maximum_stock_level, creator_id, warehouse_id } = payload;
    const id = uuidv4();
    const result = await pool.query(`
        INSERT INTO inventories (id, product_id, quantity_available, minimum_stock_level, tenant_id, maximum_stock_level, creator_id, warehouse_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [id, product_id, quantity_available, minimum_stock_level, tenant_id, maximum_stock_level, creator_id, warehouse_id, new Date(), new Date()]
    );

    return result.rows[0];
};

export const updateInventoryService = async (payload) => {
    const { id, quantity_available, minimum_stock_level, maximum_stock_level, notes } = payload;
    const result = await pool.query(`
        UPDATE inventories SET quantity_available=$1, minimum_stock_level=$2, maximum_stock_level=$3, notes=$4, updated_at=$5 WHERE id=$6 RETURNING *`,
        [ quantity_available, minimum_stock_level, maximum_stock_level, notes, new Date(), id]
    );

    return result.rows[0];
};

//to be reviewed
export const deleteInventoryService = async (id) => {
    const result = await pool.query(`
        UPDATE inventories SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING *`,
        [ false, new Date(), id]
    );

    return result.rows[0];
};

export const getInventoryCountService = async (tenant_id, queryParams = {}) => {
    const result = await pool.query("SELECT COUNT(id) FROM inventories WHERE tenant_id = $1", [tenant_id]);
    return result.rows[0];
};

export const createBulkUpdatesService = async (payload) => {
    const client = await pool.connect();

    try {
        // console.log('pr pal',payload);
        
        await client.query('BEGIN');
        const { tenant_id, warehouse_id, products, notes, creator_id } = payload;
        
        if(!products) {
            throw new Error("Products list cannot be empty.");
        }

        // const number_of_items = products.reduce((accumulator, currentItem) => accumulator + Number(currentItem.quantity), 0);

        // const id = uuidv4();
        // const result = await client.query(`
        //     INSERT INTO purchases (id, number_of_items, total_amount, discount_amount, tenant_id, invoice_number, current_status, receiver_id, warehouse_id, supplier_id, notes, created_at)
        //     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        //     [id, number_of_items, total_amount, discount_amount, tenant_id, invoice_number, current_status, creator_id, warehouse_id, supplier_id, notes, new Date()]
        // );

        for (const prod of products) {
            const r1 = await client.query("SELECT id, quantity_available FROM inventories where product_id = $1 AND warehouse_id=$2", [prod.id, warehouse_id]);
            if(r1.rowCount) {
                const currentQuantity = r1.rows[0].quantity_available;
                console.log('currentQuantity',currentQuantity);
                
                await client.query("UPDATE inventories SET quantity_available = $1, updated_at=$2 WHERE id=$3 RETURNING *",[prod.quantity, new Date(), r1.rows[0].id]);

                //insert into trans

                //const _newId = uuidv4();
                //await client.query("INSERT INTO purchasedetails (id, purchase_id, product_id, unit_price, quantity, supplier_id, warehouse_id, tenant_id, created_at, creator_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id",[_newId, result.rows[0].id, prod.id, prod.unit_price, prod.quantity, supplier_id, warehouse_id, tenant_id, new Date(), creator_id]);
            }
            else {
                const newId = uuidv4();
                await client.query("INSERT INTO inventories (id, quantity_available, minimum_stock_level, product_id, warehouse_id, creator_id, tenant_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",[newId, prod.quantity, 10, prod.id, warehouse_id, creator_id, tenant_id, new Date()]);

                //insert into trans

                //const _newId = uuidv4();
                //await client.query("INSERT INTO purchasedetails (id, purchase_id, product_id, unit_price, quantity, supplier_id, warehouse_id, tenant_id, created_at, creator_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id",[_newId, result.rows[0].id, prod.id, prod.unit_price, prod.quantity, supplier_id, warehouse_id, tenant_id, new Date(), creator_id]);
            }

            // const rp = await client.query("UPDATE products SET inventory = inventory + $1, updated_at=$2 WHERE id=$3 RETURNING *",[prod.quantity, new Date(), prod.id]);
            // console.log('X prod. update rp',rp.rows);

            // const _newId = uuidv4();
            // await client.query("INSERT INTO purchasedetails (id, purchase_id, product_id, unit_price, quantity, supplier_id, warehouse_id, tenant_id, created_at, creator_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id",[_newId, result.rows[0].id, prod.id, prod.unit_price, prod.quantity, supplier_id, warehouse_id, tenant_id, new Date(), creator_id]);
        }

        await client.query('COMMIT');
        // console.log('committed');
        // return result.rows[0];
        return {status : 201}
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};