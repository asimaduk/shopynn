import pool from "../config/db.js";
import { v4 as uuidv4 } from 'uuid';

export const getAllAdjustmentsService = async (user, requestQuery = {}) => {
    const conditions = ["adjustments.tenant_id = $1"];
    const params = [user.tenant_id];
    let paramIndex = 2;

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`adjustments.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const search = requestQuery.name ?? requestQuery.search ?? requestQuery.q;
    if (search && String(search).trim()) {
        const term = `%${String(search).trim()}%`;
        conditions.push(`(adjustments.reference_number ILIKE $${paramIndex} OR adjustments.notes ILIKE $${paramIndex})`);
        params.push(term);
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT 
            adjustments.*, 
            warehouses.name AS warehouse_name,
            users.first_name AS creator_first_name,
            users.last_name AS creator_last_name
        FROM adjustments
        LEFT JOIN warehouses ON adjustments.warehouse_id = warehouses.id
        LEFT JOIN users ON adjustments.creator_id = users.id
        WHERE ${where}
        ORDER BY adjustments.created_at DESC
    `;
    // Add a list of products adjusted for each adjustment
    const productsQuery = `
        SELECT
            ad.adjustment_id,
            ad.product_id,
            p.name AS product_name,
            ad.quantity,
            ad.system_quantity,
            ad.adjustment_type,
            ad.comment
        FROM adjustmentdetails ad
        LEFT JOIN products p ON ad.product_id = p.id
        WHERE ad.adjustment_id = ANY($1::varchar[])
    `;

    // After querying for the adjustments:
    const adjustmentsResult = await pool.query(query, params);
    const adjustments = adjustmentsResult.rows;

    // Gather all adjustment IDs
    const adjustmentIds = adjustments.map(a => a.id);
    let productsByAdjustmentId = {};

    if (adjustmentIds.length > 0) {
        const productsResult = await pool.query(productsQuery, [adjustmentIds]);
        // Group products by adjustment_id
        productsByAdjustmentId = productsResult.rows.reduce((acc, row) => {
            if (!acc[row.adjustment_id]) acc[row.adjustment_id] = [];
            acc[row.adjustment_id].push({
                product_id: row.product_id,
                product_name: row.product_name,
                quantity: row.quantity,
                system_quantity: row.system_quantity,
                adjustment_type: row.adjustment_type,
                category: row.category,
                comment: row.comment
            });
            return acc;
        }, {});
    }

    // Attach products array to each adjustment
    const adjustmentsWithProducts = adjustments.map(adj => ({
        ...adj,
        products: productsByAdjustmentId[adj.id] || []
    }));

    return adjustmentsWithProducts;
}

/**
 * Adjustments summary for a tenant over a date range.
 * Returns:
 *  - adjustmentCount: number of distinct adjustments
 *  - totalItemsAdjusted: total quantity across all adjustment lines
 *  - items: list of adjusted inventories with product & adjustment info
 * Date range:
 *  - default: current month (MTD) based on adjustments.created_at
 *  - override via startDate/endDate or from/to in query
 * Filters:
 *  - tenant_id: from authenticated user
 *  - optional warehouse_id
 *  - optional product_id
 *  - optional category (type of adjustment)
 */
export const getAdjustmentsSummaryService = async (user, requestQuery = {}) => {
    const { tenant_id } = user;

    const today = new Date();
    const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const startDate =
        requestQuery.startDate 
        // ||
        // requestQuery.from ||
        // defaultStart.toISOString().slice(0, 10);
    const endDate =
        requestQuery.endDate 
        // ||
        // requestQuery.to ||
        // today.toISOString().slice(0, 10);

    // const conditions = ["a.tenant_id = $1", "a.created_at BETWEEN $2 AND $3"];
    const conditions = ["a.tenant_id = $1"];
    const params = [tenant_id];
    let paramIndex = 2;

    if (startDate && endDate) {
        conditions.push(`a.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(startDate, endDate);
        paramIndex += 2;
    } else if (startDate) {
        conditions.push(`a.created_at >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
    } else if (endDate) {
        conditions.push(`a.created_at <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
    }

    const warehouseId = requestQuery.warehouseId ?? requestQuery.warehouse_id;
    if (warehouseId) {
        conditions.push(`a.warehouse_id = $${paramIndex}`);
        params.push(warehouseId);
        paramIndex++;
    }

    const productId = requestQuery.productId ?? requestQuery.product_id;
    if (productId) {
        conditions.push(`ad.product_id = $${paramIndex}`);
        params.push(productId);
        paramIndex++;
    }

    const category = requestQuery.category ?? requestQuery.type;
    if (category !== undefined && category !== null && category !== "") {
        conditions.push(`ad.category = $${paramIndex}`);
        params.push(category);
        paramIndex++;
    }

    const where = conditions.join(" AND ");

    const summaryQuery = `
        SELECT
            COUNT(DISTINCT a.id)::int AS adjustment_count,
            COALESCE(SUM(a.number_of_items), 0)::int AS total_items,
            COALESCE(SUM(ad.quantity), 0)::int AS total_items_adjusted
        FROM adjustments a
        LEFT JOIN adjustmentdetails ad ON ad.adjustment_id = a.id
        WHERE ${where}
    `;
    // console.log('summaryQuery',summaryQuery);
    // console.log('params',params);
    const summaryResult = await pool.query(summaryQuery, params);
    // console.log('summaryResult',summaryResult.rows);
    const summaryRow = summaryResult.rows[0] || {
        adjustment_count: 0,
        total_items: 0,
        total_items_adjusted: 0,
    };

    const listQuery = `
        SELECT
            ad.id,
            ad.adjustment_id,
            ad.product_id,
            p.name AS product_name,
            ad.quantity,
            ad.system_quantity,
            ad.adjustment_type,
            a.notes,
            a.reference_number,
            a.created_at,
            a.warehouse_id,
            w.name AS warehouse_name
        FROM adjustments a
        JOIN adjustmentdetails ad ON ad.adjustment_id = a.id
        LEFT JOIN products p ON p.id = ad.product_id
        LEFT JOIN warehouses w ON w.id = a.warehouse_id
        WHERE ${where}
        ORDER BY a.created_at DESC, p.name ASC
    `;
    const listResult = await pool.query(listQuery, params);

    return {
        startDate,
        endDate,
        adjustment_count: Number(summaryRow.adjustment_count || 0),
        total_items: Number(summaryRow.total_items || 0),
        total_items_adjusted: Number(summaryRow.total_items_adjusted || 0),
        items: listResult.rows.map((row) => ({
            adjustment_detail_id: row.id,
            adjustment_id: row.adjustment_id,
            reference_number: row.reference_number,
            product_id: row.product_id,
            product_name: row.product_name,
            adjustment_type: row.adjustment_type,
            quantity_adjusted: Number(row.quantity || 0),
            system_quantity: row.system_quantity != null ? Number(row.system_quantity) : null,
            created_at: row.created_at,
            reason: row.notes,
            warehouse_id: row.warehouse_id,
            warehouse_name: row.warehouse_name,
        })),
    };
};

export const getAdjustmentByIdService = async (id) => {
    const result = await pool.query("SELECT * FROM adjustments where id = $1", [id]);
    return result.rows[0];
}

export const createAdjustmentService = async (payload) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const { reference_number, tenant_id, warehouse_id, products, notes, creator_id } = payload;
        
        if(!products) {
            throw new Error("Products list cannot be empty.");
        }

        const total_amount = products.reduce(
            (acc, prod) => acc + prod.quantity * (Number(prod.unit_price) || 0),
            0
        );

        const id = uuidv4();
        const result = await client.query(`
            INSERT INTO adjustments (id, number_of_items, total_amount, reference_number, tenant_id, warehouse_id, notes, creator_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [id, products.length, total_amount, reference_number, tenant_id, warehouse_id, notes, creator_id, new Date()]
        );

        for (const prod of products) {
            const type = String(prod.adjustment_type || "subtraction").toLowerCase();
            const isAddition = type === "addition";
            const qty = Number(prod.quantity) || 0;

            const r1 = await client.query(
                "SELECT id, quantity_available FROM inventories WHERE product_id = $1 AND warehouse_id = $2",
                [prod.id, warehouse_id]
            );
            const systemQuantity = r1.rowCount ? r1.rows[0].quantity_available : null;

            if (r1.rowCount) {
                if (isAddition) {
                    await client.query(
                        "UPDATE inventories SET quantity_available = quantity_available + $1, updated_at = $2 WHERE id = $3",
                        [qty, new Date(), r1.rows[0].id]
                    );
                } else {
                    await client.query(
                        "UPDATE inventories SET quantity_available = quantity_available - $1, updated_at = $2 WHERE id = $3",
                        [qty, new Date(), r1.rows[0].id]
                    );
                }
            } else {
                if (isAddition) {
                    const invId = uuidv4();
                    const now = new Date();
                    await client.query(
                        `INSERT INTO inventories (id, quantity_available, minimum_stock_level, product_id, warehouse_id, tenant_id, creator_id, created_at, updated_at)
                         VALUES ($1, $2, 0, $3, $4, $5, $6, $7, $7)`,
                        [invId, qty, prod.id, warehouse_id, tenant_id, creator_id, now]
                    );
                }
            }

            const _newId = uuidv4();
            await client.query(
                "INSERT INTO adjustmentdetails (id, adjustment_id, product_id, quantity, system_quantity, adjustment_type, category, comment, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
                [_newId, result.rows[0].id, prod.id, prod.quantity, systemQuantity, type, prod.category, prod.comment, new Date()]
            );
        }

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export const updateAdjustmentService = async (payload) => {
    const { id, number_of_items, total_amount, notes } = payload;
    const result = await pool.query(`
        UPDATE adjustments SET number_of_items=$1, total_amount=$2, notes=$3, updated_at=$4  WHERE id=$5 RETURNING *`,
        [number_of_items, total_amount, notes, new Date(), id]
    );

    return result.rows[0];
}

//to be reviewed
export const deleteAdjustmentService = async (id) => {
    const result = await pool.query(`
        UPDATE adjustments SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING *`,
        [ false, new Date(), id]
    );

    return result.rows[0];
}

export const getAllAdjustmentDetailsService = async () => {
    const result = await pool.query("SELECT * FROM adjustmentdetails");
    return result.rows;
}