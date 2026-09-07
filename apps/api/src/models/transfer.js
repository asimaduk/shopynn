import pool from "../config/db.js";
import { v4 as uuidv4 } from 'uuid';

export const getAllTransfersService = async (user, requestQuery = {}) => {
    const conditions = ["transfers.tenant_id = $1"];
    const params = [user.tenant_id];
    let paramIndex = 2;

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push(`transfers.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(requestQuery.startDate, requestQuery.endDate);
        paramIndex += 2;
    }

    const search = requestQuery.name ?? requestQuery.search ?? requestQuery.q;
    if (search && String(search).trim()) {
        conditions.push(`transfers.notes ILIKE $${paramIndex}`);
        params.push(`%${String(search).trim()}%`);
    }

    const where = conditions.join(" AND ");
    const query = `
        SELECT 
            transfers.*,
            sw.name AS source_warehouse_name,
            dw.name AS destination_warehouse_name
        FROM transfers
        LEFT JOIN warehouses sw ON transfers.source_warehouse_id = sw.id
        LEFT JOIN warehouses dw ON transfers.destination_warehouse_id = dw.id
        WHERE ${where}
        ORDER BY transfers.created_at DESC
    `;
    const result = await pool.query(query, params);
    return result.rows;
}

/**
 * Transfers summary for a tenant over a date range.
 * Returns:
 *  - transferCount: number of distinct transfers
 *  - totalUnitsMoved: total quantity moved across all transfer lines
 *  - movements: list of transfer detail lines with product & warehouse info
 * Date range:
 *  - default: current month (MTD) based on transfers.created_at
 *  - override via startDate/endDate or from/to in query
 * Filters:
 *  - tenant_id: from authenticated user
 *  - optional source_warehouse_id / destination_warehouse_id
 *  - optional product_id
 */
export const getTransfersSummaryService = async (user, requestQuery = {}) => {
    const { tenant_id } = user;

    const today = new Date();
    const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const startDate =
        requestQuery.startDate ||
        requestQuery.from ||
        defaultStart.toISOString().slice(0, 10);
    const endDate =
        requestQuery.endDate ||
        requestQuery.to ||
        today.toISOString().slice(0, 10);

    const conditions = ["t.tenant_id = $1", "t.created_at BETWEEN $2 AND $3"];
    const params = [tenant_id, startDate, endDate];
    let paramIndex = 4;

    const sourceWarehouseId =
        requestQuery.sourceWarehouseId ?? requestQuery.source_warehouse_id;
    if (sourceWarehouseId) {
        conditions.push(`t.source_warehouse_id = $${paramIndex}`);
        params.push(sourceWarehouseId);
        paramIndex++;
    }

    const destinationWarehouseId =
        requestQuery.destinationWarehouseId ?? requestQuery.destination_warehouse_id;
    if (destinationWarehouseId) {
        conditions.push(`t.destination_warehouse_id = $${paramIndex}`);
        params.push(destinationWarehouseId);
        paramIndex++;
    }

    const productId = requestQuery.productId ?? requestQuery.product_id;
    if (productId) {
        conditions.push(`td.product_id = $${paramIndex}`);
        params.push(productId);
        paramIndex++;
    }

    const where = conditions.join(" AND ");

    const summaryQuery = `
        SELECT
            COUNT(DISTINCT t.id)::int AS transfer_count,
            COALESCE(SUM(t.number_of_items), 0)::int AS total_items,
            COALESCE(SUM(td.quantity), 0)::int AS total_units_moved
        FROM transfers t
        LEFT JOIN transferdetails td ON td.transfer_id = t.id
        WHERE ${where}
    `;
    const summaryResult = await pool.query(summaryQuery, params);
    const summaryRow = summaryResult.rows[0] || {
        transfer_count: 0,
        total_items: 0,
        total_units_moved: 0,
    };

    const listQuery = `
        SELECT
            td.id,
            td.transfer_id,
            td.product_id,
            p.name AS product_name,
            td.quantity,
            t.sent_date,
            t.created_at,
            t.source_warehouse_id,
            sw.name AS source_warehouse_name,
            t.destination_warehouse_id,
            dw.name AS destination_warehouse_name
        FROM transfers t
        JOIN transferdetails td ON td.transfer_id = t.id
        LEFT JOIN products p ON p.id = td.product_id
        LEFT JOIN warehouses sw ON sw.id = t.source_warehouse_id
        LEFT JOIN warehouses dw ON dw.id = t.destination_warehouse_id
        WHERE ${where}
        ORDER BY t.created_at DESC, p.name ASC
    `;
    const listResult = await pool.query(listQuery, params);

    return {
        startDate,
        endDate,
        transferCount: Number(summaryRow.transfer_count || 0),
        totalItems: Number(summaryRow.total_items || 0),
        totalUnitsMoved: Number(summaryRow.total_units_moved || 0),
        movements: listResult.rows.map((row) => ({
            movement_id: row.id,
            transfer_id: row.transfer_id,
            reference: row.transfer_id,
            product_id: row.product_id,
            product_name: row.product_name,
            quantity: Number(row.quantity || 0),
            sent_date: row.sent_date,
            created_at: row.created_at,
            source_warehouse_id: row.source_warehouse_id,
            source_warehouse_name: row.source_warehouse_name,
            destination_warehouse_id: row.destination_warehouse_id,
            destination_warehouse_name: row.destination_warehouse_name,
        })),
    };
};

export const getTransferByIdService = async (id) => {
    const result = await pool.query("SELECT * FROM transfers where id = $1", [id]);
    return result.rows[0];
}

export const getTransferDetailsByIdService = async (user, id) => {
    const transferResult = await pool.query(
        `SELECT 
            trn.id,
            trn.notes,
            trn.number_of_items,
            trn.sent_date,
            trn.created_at,
            trn.source_warehouse_id,
            trn.destination_warehouse_id,
            sw.name AS source_warehouse_name,
            dw.name AS destination_warehouse_name
         FROM transfers trn
         LEFT JOIN warehouses sw ON trn.source_warehouse_id = sw.id
         LEFT JOIN warehouses dw ON trn.destination_warehouse_id = dw.id
         WHERE trn.tenant_id = $1
           AND trn.id = $2
         ORDER BY trn.updated_at DESC
         LIMIT 1`,
        [user.tenant_id, id]
    );

    if (!transferResult.rowCount) {
        return null;
    }

    const transfer = transferResult.rows[0];

    const productsResult = await pool.query(
        `SELECT 
            td.product_id,
            td.quantity,
            td.created_at,
            p.name AS product_name,
            p.thumbnail
         FROM transferdetails td
         LEFT JOIN products p ON td.product_id = p.id
         WHERE td.transfer_id = $1`,
        [id]
    );

    return {
        ...transfer,
        products: productsResult.rows || [],
    };
};

export const createTransferService = async (payload) => {
    console.log('createTransferService payload', payload);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const { sent_date, source_warehouse_id, destination_warehouse_id, tenant_id, creator_id, products, notes } = payload;

        if(!products) {
            throw new Error("Products list cannot be empty.");
        }

        const id = uuidv4();
        const numberOfItems = products.reduce((acc, prod) => acc + prod.quantity, 0);
        console.log('numberOfItems', numberOfItems);

        const result = await client.query(`
            INSERT INTO transfers (id, sent_date, number_of_items, source_warehouse_id, destination_warehouse_id, tenant_id, creator_id, notes, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [id, sent_date ? new Date(sent_date) : new Date(), numberOfItems, source_warehouse_id, destination_warehouse_id, tenant_id, creator_id, notes, new Date()]
        );

        for (const prod of products) {
            const r1 = await client.query("SELECT id, quantity_available FROM inventories where product_id = $1 AND warehouse_id=$2", [prod.id, source_warehouse_id]);
            if(r1.rowCount) {
                await client.query("UPDATE inventories SET quantity_available = quantity_available - $1, updated_at=$2 WHERE id=$3 RETURNING *",[prod.quantity, new Date(), r1.rows[0].id]);

                const r2 = await client.query("SELECT id, quantity_available FROM inventories where product_id = $1 AND warehouse_id=$2", [prod.id, destination_warehouse_id]);
                if(r2.rowCount) {
                    await client.query("UPDATE inventories SET quantity_available = quantity_available + $1, updated_at=$2 WHERE id=$3 RETURNING *",[prod.quantity, new Date(), r2.rows[0].id]);
                }
                else {
                    const newId = uuidv4();
                    await client.query("INSERT INTO inventories (id, quantity_available, minimum_stock_level, product_id, warehouse_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",[newId, prod.quantity, 10, prod.id, destination_warehouse_id, new Date(), new Date()]);
                }
            }

            const _newId = uuidv4();
            await client.query("INSERT INTO transferdetails (id, transfer_id, product_id, quantity, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id",[_newId, id, prod.id, prod.quantity, new Date()]);
        }

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        console.log('createTransferService error', error);
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export const updateTransferService = async (payload) => {
    const { id, name, source_warehouse_id, destination_warehouse_id, received_date } = payload;
    const result = await pool.query(`
        UPDATE transfers SET name=$1, source_warehouse_id=$2, destination_warehouse_id=$3, received_date=$4, updated_at=$5 WHERE id=$6 RETURNING *`,
        [name, source_warehouse_id, destination_warehouse_id, new Date(received_date), new Date(), id]
    );

    return result.rows[0];
}

//to be reviewed
export const deleteTransferService = async (id) => {
    const result = await pool.query(`
        UPDATE transfers SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING *`,
        [ false, new Date(), id]
    );

    return result.rows[0];
}

export const getAllTransferDetailsService = async () => {
    const result = await pool.query("SELECT * FROM transferdetails");
    return result.rows;
}