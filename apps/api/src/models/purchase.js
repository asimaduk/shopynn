import pool from "../config/db.js";
import { v4 as uuidv4 } from 'uuid';
import { getUserPermissionsService } from "./userRole.js";

const canViewAllPurchasesForUser = async (user) => {
    if (user.user_type === 1) return true;
    const permissionCodes = Array.isArray(user.permissions)
        ? user.permissions
        : await getUserPermissionsService(user.id, user.tenant_id).catch(() => []);
    return permissionCodes.includes("purchases.view_all");
};

export const getAllPurchasesService = async (user, requestQuery) => {
    let query = `SELECT purchases.id, purchases.number_of_items, purchases.total_amount, purchases.discount_amount, purchases.invoice_number, purchases.created_at, purchases.created_at, purchases.current_status, purchases.notes, suppliers.name as supplier, users.first_name as receiver_name FROM purchases LEFT JOIN suppliers ON purchases.supplier_id = suppliers.id LEFT JOIN users ON purchases.receiver_id = users.id WHERE purchases.tenant_id = '${user.tenant_id}'`;

    const canViewAll = await canViewAllPurchasesForUser(user);

    if (!canViewAll) {
        query += ` AND purchases.receiver_id = '${user.id}'`;
    }

    if(requestQuery && requestQuery.suppliedBy) {
        query += ` AND purchases.supplier_id = '${requestQuery.suppliedBy}'`;
    }

    if(requestQuery && requestQuery.receivedBy && canViewAll) {
        query += ` AND purchases.receiver_id = '${requestQuery.receivedBy}'`;
    }

    if(requestQuery && requestQuery.startDate) {
        query += ` AND purchases.created_at BETWEEN '${requestQuery.startDate}' AND '${requestQuery.endDate}'`;
    }

    const currentStatus = requestQuery?.current_status ?? requestQuery?.currentStatus;
    if (currentStatus !== undefined && currentStatus !== null && currentStatus !== '') {
        const cs = parseInt(currentStatus, 10);
        if (!Number.isNaN(cs)) {
            query += ` AND purchases.current_status = ${cs}`;
        }
    }

    query += ' ORDER BY created_at DESC';
    // console.log('purchases query...',query);

    const result = await pool.query(query);
    return result.rows;
};

/**
 * Purchases summary (MTD by default) for a tenant.
 * Returns:
 *  - totalPurchases: sum of total_amount
 *  - purchaseCount: number of purchase records
 *  - supplierCount: distinct suppliers in the period
 *  - supplierPurchases: list of purchases with supplier info (invoice_number, total_amount, date)
 * Date range:
 *  - default: current month (date_trunc('month', CURRENT_DATE) to today)
 *  - override via startDate/endDate or from/to in query
 * Respects user_type: non-admin only sees purchases where receiver_id = user.id.
 */
export const getPurchasesSummaryService = async (user, requestQuery = {}) => {
    const { tenant_id, id: userId } = user;

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

    const conditions = ["p.tenant_id = $1", "p.created_at BETWEEN $2 AND $3"];
    const params = [tenant_id, startDate, endDate];
    let paramIndex = 4;

    const canViewAll = await canViewAllPurchasesForUser(user);
    if (!canViewAll) {
        conditions.push(`p.receiver_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
    }

    const where = conditions.join(" AND ");

    const summaryQuery = `
        SELECT
            COUNT(*)::int AS purchase_count,
            COALESCE(SUM(p.total_amount), 0)::numeric AS total_purchases,
            COUNT(DISTINCT p.supplier_id)::int AS supplier_count
        FROM purchases p
        WHERE ${where}
    `;
    const summaryResult = await pool.query(summaryQuery, params);
    const summaryRow = summaryResult.rows[0] || {
        purchase_count: 0,
        total_purchases: 0,
        supplier_count: 0,
    };

    const listQuery = `
        SELECT
            p.id,
            p.invoice_number,
            p.total_amount,
            p.created_at,
            p.supplier_id,
            s.name AS supplier_name
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE ${where}
        ORDER BY p.created_at DESC, p.invoice_number ASC
    `;
    const listResult = await pool.query(listQuery, params);

    return {
        startDate,
        endDate,
        totalPurchases: Number(summaryRow.total_purchases || 0),
        purchaseCount: Number(summaryRow.purchase_count || 0),
        supplierCount: Number(summaryRow.supplier_count || 0),
        supplierPurchases: listResult.rows.map((row) => ({
            purchase_id: row.id,
            supplier_id: row.supplier_id,
            supplier_name: row.supplier_name,
            invoice_number: row.invoice_number,
            totalAmount: Number(row.total_amount || 0),
            date: row.created_at,
        })),
    };
};

/**
 * Suppliers summary: total purchases, purchase count, and per-supplier totals.
 * Default: MTD (month to date). Override via startDate/endDate or from/to.
 * Filters: tenant_id (from user), optional warehouse_id.
 * Respects user_type: non-admin only sees purchases where receiver_id = user.id.
 */
export const getSuppliersSummaryService = async (user, requestQuery = {}) => {
    const { tenant_id, id: userId } = user;

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

    const conditions = ["p.tenant_id = $1", "p.created_at BETWEEN $2 AND $3"];
    const params = [tenant_id, startDate, endDate];
    let paramIndex = 4;

    const canViewAll = await canViewAllPurchasesForUser(user);
    if (!canViewAll) {
        conditions.push(`p.receiver_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
    }

    const warehouseId = requestQuery.warehouseId ?? requestQuery.warehouse_id;
    if (warehouseId) {
        conditions.push(`p.warehouse_id = $${paramIndex}`);
        params.push(warehouseId);
        paramIndex++;
    }

    const where = conditions.join(" AND ");

    const summaryQuery = `
        SELECT
            COUNT(*)::int AS purchase_count,
            COALESCE(SUM(p.total_amount), 0)::numeric AS total_purchases
        FROM purchases p
        WHERE ${where}
    `;
    const summaryResult = await pool.query(summaryQuery, params);
    const summaryRow = summaryResult.rows[0] || {
        purchase_count: 0,
        total_purchases: 0,
    };

    const listQuery = `
        SELECT
            p.supplier_id,
            s.name AS supplier_name,
            s.phone AS supplier_phone,
            COUNT(p.id)::int AS purchase_count,
            COALESCE(SUM(p.total_amount), 0)::numeric AS total_purchases
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE ${where}
        GROUP BY p.supplier_id, s.name, s.phone
        ORDER BY total_purchases DESC, purchase_count DESC, supplier_name ASC
    `;
    const listResult = await pool.query(listQuery, params);

    const suppliers = listResult.rows.map((row) => ({
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        supplier_phone: row.supplier_phone,
        purchaseCount: Number(row.purchase_count || 0),
        totalPurchases: Number(row.total_purchases || 0),
    }));

    return {
        startDate,
        endDate,
        totalPurchases: Number(summaryRow.total_purchases || 0),
        purchaseCount: Number(summaryRow.purchase_count || 0),
        supplierCount: suppliers.length,
        suppliers,
    };
};

export const getPurchasesBySupplierIdService = async (user, supplier_id, requestQuery = {}) => {
    const conditions = ["purchases.tenant_id = $1", "purchases.supplier_id = $2"];
    const params = [user.tenant_id, supplier_id];
    let paramIndex = 3;

    const canViewAll = await canViewAllPurchasesForUser(user);
    if (!canViewAll) {
        conditions.push("purchases.receiver_id = $" + paramIndex);
        params.push(user.id);
        paramIndex += 1;
    }

    if (requestQuery.startDate && requestQuery.endDate) {
        conditions.push("purchases.created_at BETWEEN $" + paramIndex + " AND $" + (paramIndex + 1));
        params.push(requestQuery.startDate, requestQuery.endDate);
    }

    const where = conditions.join(" AND ");
    const query = `SELECT purchases.id, purchases.number_of_items, purchases.total_amount, purchases.discount_amount, purchases.invoice_number, purchases.created_at, purchases.current_status, purchases.notes,
                          users.first_name AS receiver_first_name, users.last_name AS receiver_last_name
                   FROM purchases
                   LEFT JOIN users ON purchases.receiver_id = users.id
                   WHERE ${where}
                   ORDER BY purchases.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
};

export const getPurchaseByIdService = async (id) => {
    const result = await pool.query("SELECT purchases.id, purchases.number_of_items, purchases.total_amount, purchases.discount_amount, purchases.invoice_number, purchases.created_at, purchases.current_status, purchases.notes, suppliers.name as supplier, suppliers.manager as supplier_manager, suppliers.phone, suppliers.address as supplier_address FROM purchases LEFT JOIN suppliers ON purchases.supplier_id = suppliers.id WHERE purchases.id = $1", [id]);
    const rs = result.rows[0];

    const x = await pool.query("SELECT pd.id, pd.quantity, pd.unit_price, pd.created_at, products.id, products.name, products.thumbnail, products.sku, products.slug, products.thumbnail FROM purchasedetails pd LEFT JOIN products ON pd.product_id = products.id WHERE pd.purchase_id = $1",[id]);
    if(x.rows) {
        rs['products'] = x.rows;
    }
    else {
        rs['products'] = [];
    }
    return rs;
}

export const createPurchaseService = async (payload) => {
    const client = await pool.connect();

    try {        
        await client.query('BEGIN');
        const { discount_amount, tenant_id, invoice_number, current_status, warehouse_id, supplier_id, products, notes, creator_id } = payload;
        
        const total_amount = products.reduce((accumulator, currentItem) => accumulator + Number(currentItem.quantity * currentItem.unit_price), 0);
        
        if(!products) {
            throw new Error("Products list cannot be empty.");
        }

        const number_of_items = products.reduce((accumulator, currentItem) => accumulator + Number(currentItem.quantity), 0);

        const id = uuidv4();
        const result = await client.query(`
            INSERT INTO purchases (id, number_of_items, total_amount, discount_amount, tenant_id, invoice_number, current_status, receiver_id, warehouse_id, supplier_id, notes, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [id, number_of_items, total_amount, discount_amount, tenant_id, invoice_number, current_status, creator_id, warehouse_id, supplier_id, notes, new Date()]
        );

        for (const prod of products) {
            const r1 = await client.query("SELECT id, quantity_available FROM inventories where product_id = $1 AND warehouse_id=$2", [prod.id, warehouse_id]);
            if(r1.rowCount) {
                await client.query("UPDATE inventories SET quantity_available = quantity_available + $1, updated_at=$2 WHERE id=$3 RETURNING *",[prod.quantity, new Date(), r1.rows[0].id]);
            }
            else {
                const newId = uuidv4();
                await client.query("INSERT INTO inventories (id, quantity_available, minimum_stock_level, product_id, warehouse_id, creator_id, tenant_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",[newId, prod.quantity, 10, prod.id, warehouse_id, creator_id, tenant_id, new Date()]);
            }

            const rp = await client.query("UPDATE products SET inventory = inventory + $1, updated_at=$2 WHERE id=$3 RETURNING *",[prod.quantity, new Date(), prod.id]);
            // console.log('X prod. update rp',rp.rows);

            const _newId = uuidv4();
            await client.query("INSERT INTO purchasedetails (id, purchase_id, product_id, unit_price, quantity, supplier_id, warehouse_id, tenant_id, created_at, creator_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id",[_newId, result.rows[0].id, prod.id, prod.unit_price, prod.quantity, supplier_id, warehouse_id, tenant_id, new Date(), creator_id]);
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
}

export const updatePurchaseService = async (payload) => {
    const { id, number_of_items, total_amount, discount_amount } = payload;
    const result = await pool.query(`
        UPDATE purchases SET number_of_items=$1, total_amount=$2, discount_amount=$3, updated_at=$4  WHERE id=$5 RETURNING *`,
        [number_of_items, total_amount, discount_amount, new Date(), id]
    );

    return result.rows[0];
}

//to be reviewed
export const deletePurchaseService = async (id) => {
    const result = await pool.query(`
        UPDATE purchases SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING *`,
        [ false, new Date(), id]
    );

    return result.rows[0];
}

export const getAllPurchaseDetailsService = async () => {
    const result = await pool.query("SELECT * FROM purchasedetails");
    return result.rows;
}