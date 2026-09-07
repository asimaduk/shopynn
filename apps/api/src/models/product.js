import pool from "../config/db.js";
import { v4 as uuidv4 } from 'uuid';
import { deleteS3Objects } from "../util/s3Delete.js";
import { normalizeProductRow, toNum } from "../util/productNormalize.js";

export const getAllProductsCountService = async (user) => {
    const query = `SELECT COUNT(id) FROM products WHERE tenant_id = '${user.tenant_id}'`
    const result = await pool.query(query);
    if(result.rowCount) return {count: result.rows[0].count}  
    return {count: 0}
}

export const getCatalogService = async (user, queryParams = {}) => {
    const warehouseId = queryParams.warehouse_id || queryParams.warehouseId;
    if (!warehouseId) throw new Error("warehouse_id is required.");

    const profile = await pool.query(
        `SELECT id FROM customer_profiles WHERE user_id = $1 AND tenant_id = $2 LIMIT 1`,
        [user.id, user.tenant_id]
    );
    if (!profile.rowCount) return [];

    const access = await pool.query(
        `SELECT 1
         FROM customer_store_access
         WHERE customer_profile_id = $1 AND tenant_id = $2 AND warehouse_id = $3
         LIMIT 1`,
        [profile.rows[0].id, user.tenant_id, warehouseId]
    );
    if (!access.rowCount) return [];

    const searchKey = String(queryParams.search || queryParams.q || queryParams.searchKey || "").trim();
    const params = [user.tenant_id, warehouseId];
    let where = `p.tenant_id = $1 AND inv.warehouse_id = $2 AND coalesce(inv.quantity_available, 0) > 0`;
    if (searchKey) {
        params.push(`%${searchKey}%`);
        where += ` AND (p.name ILIKE $3 OR p.sku ILIKE $3)`;
    }

    const result = await pool.query(
        `SELECT
            p.id, p.name, p.sku, p.unit_price, p.alt_price, p.actual_cost, p.thumbnail, p.slug,
            p.product_type, p.measurement_unit, p.allows_fractional_qty, p.min_order_qty, p.qty_step,
            p.installment_enabled, p.installment_min_initial_percent, p.installment_min_payment_amount,
            inv.quantity_available, inv.warehouse_id, w.name AS warehouse_name
         FROM products p
         JOIN inventories inv ON inv.product_id = p.id AND inv.tenant_id = p.tenant_id
         LEFT JOIN warehouses w ON w.id = inv.warehouse_id
         WHERE ${where}
         ORDER BY p.updated_at DESC`,
        params
    );
    return result.rows.map(normalizeProductRow);
};

export const getCatalogProductByIdService = async (user, productId, queryParams = {}) => {
    const warehouseId = queryParams.warehouse_id || queryParams.warehouseId;
    if (!warehouseId) throw new Error("warehouse_id is required.");

    const profile = await pool.query(
        `SELECT id FROM customer_profiles WHERE user_id = $1 AND tenant_id = $2 LIMIT 1`,
        [user.id, user.tenant_id]
    );
    if (!profile.rowCount) return null;

    const access = await pool.query(
        `SELECT 1
         FROM customer_store_access
         WHERE customer_profile_id = $1 AND tenant_id = $2 AND warehouse_id = $3
         LIMIT 1`,
        [profile.rows[0].id, user.tenant_id, warehouseId]
    );
    if (!access.rowCount) return null;

    const result = await pool.query(
        `SELECT
            p.id, p.name, p.sku, p.unit_price, p.alt_price, p.actual_cost, p.thumbnail, p.slug,
            p.product_type, p.measurement_unit, p.allows_fractional_qty, p.min_order_qty, p.qty_step,
            p.description, p.picture1, p.picture2, p.picture3, p.picture4,
            p.installment_enabled, p.installment_min_initial_percent, p.installment_min_payment_amount,
            inv.quantity_available, inv.warehouse_id, w.name AS warehouse_name
         FROM products p
         JOIN inventories inv ON inv.product_id = p.id AND inv.tenant_id = p.tenant_id
         LEFT JOIN warehouses w ON w.id = inv.warehouse_id
         WHERE p.tenant_id = $1
           AND p.id = $2
           AND inv.warehouse_id = $3
         LIMIT 1`,
        [user.tenant_id, productId, warehouseId]
    );

    const row = result.rows[0];
    return row ? normalizeProductRow(row) : null;
};

export const getProductsForExportService = async (user) => {
    const result = await pool.query(`
        SELECT 
            p.name,
            p.sku,
            p.unit_price,
            p.actual_cost,
            p.unit,
            COALESCE(SUM(inv.quantity_available), 0)::int AS inventory,
            p.reorder_quantity,
            p.alt_price
        FROM products p
        LEFT JOIN inventories inv ON inv.product_id = p.id AND inv.tenant_id = p.tenant_id
        WHERE p.tenant_id = $1
        GROUP BY p.id
        ORDER BY p.name ASC
    `, [user.tenant_id]);
    return result.rows;
}

export const getAllProductsService = async (user, queryParams) => {
    queryParams = queryParams || {};

    // Paginate only when pageSize or page_size is a positive number; otherwise return all matching rows.
    const rawPageSize = queryParams.pageSize ?? queryParams.page_size;
    const pageSizeNum =
        rawPageSize != null && rawPageSize !== '' ? Number(rawPageSize) : NaN;
    const paginate = Number.isFinite(pageSizeNum) && pageSizeNum > 0;
    const page_size = paginate ? Math.floor(pageSizeNum) : 0;

    let page_number = 1;
    const rawPageNum = queryParams.pageNumber ?? queryParams.page_number;
    if (rawPageNum != null && rawPageNum !== '' && Number(rawPageNum) > 0) {
        page_number = Number(rawPageNum);
    }

    const limitOffsetClause = paginate
        ? `\n            LIMIT ${page_size} OFFSET ${(page_number - 1) * page_size}`
        : '';

    let query = '';

    if (queryParams.pageType === 'pos') {
        // console.log('for pos');
        
        query = `SELECT 
                p.id, 
                p.name, 
                p.sku, 
                p.unit_price,
                p.actual_cost,
                p.unit,
                p.alt_price, 
                p.bar_code,
                p.description, 
                p.categories, 
                array_remove(array_agg(DISTINCT c.name), NULL) AS category_names,
                p.slug,  
                p.thumbnail, 
                p.tags, 
                p.picture1, 
                p.reorder_quantity,
                p.is_active AS active,
                COALESCE(inv.quantity_available, 0) AS quantity_available,
                inv.id AS inventory_id,
                inv.warehouse_id,
		        COALESCE(wh.name, '') AS store_name,
                inv.expiration_date AS expiry_date
            FROM products p
            LEFT JOIN inventories inv ON inv.product_id = p.id
            LEFT JOIN warehouses wh ON inv.warehouse_id = wh.id
            LEFT JOIN categories c ON c.tenant_id = p.tenant_id AND c.id = ANY(p.categories)
            WHERE p.tenant_id = '${user.tenant_id}'
              ${queryParams.searchKey ? (`AND (p.name ILIKE '%${queryParams.searchKey}%' OR sku ILIKE '%${queryParams.searchKey}%')`):''}
              ${queryParams.warehouse_id ? (`AND inv.warehouse_id = '${queryParams.warehouse_id}'`) : ''}
            GROUP BY p.id, inv.id, wh.name, inv.expiration_date
            ORDER BY p.updated_at DESC${limitOffsetClause}
        `;
    } else {
        query = `SELECT 
                p.id, 
                p.name, 
                p.sku, 
                p.unit_price,
                p.actual_cost,
                p.unit,
                p.alt_price, 
                p.bar_code,
                p.description, 
                p.categories, 
                array_remove(array_agg(DISTINCT c.name), NULL) AS category_names,
                p.slug, 
                p.thumbnail, 
                p.tags, 
                p.picture1, 
                p.reorder_quantity,
                p.is_active AS active,
                COALESCE(inv.quantity_available, 0) AS quantity_available,
                inv.id AS inventory_id,
                inv.warehouse_id,
		        COALESCE(wh.name, '') AS store_name,
                inv.expiration_date AS expiry_date
            FROM products p
            LEFT JOIN inventories inv ON inv.product_id = p.id
            LEFT JOIN warehouses wh ON inv.warehouse_id = wh.id
            LEFT JOIN categories c ON c.tenant_id = p.tenant_id AND c.id = ANY(p.categories)
            WHERE p.tenant_id = '${user.tenant_id}'
              ${queryParams.searchText ? (`AND (p.name ILIKE '%${queryParams.searchText}%' OR sku ILIKE '%${queryParams.searchText}%')`):''}
              ${queryParams.warehouse_id ? (`AND inv.warehouse_id = '${queryParams.warehouse_id}'`) : ''}
            GROUP BY p.id, inv.id, wh.name, inv.expiration_date
            ORDER BY p.updated_at DESC${limitOffsetClause};
        `;
    }

    // console.log('query prod',query);
    
    const result = await pool.query(query);
    if(result.rows) {
        const tmp = {};
        // console.log('rows.len',result.rows.length);
        
        result.rows.forEach(r=> {
            const qtyAvailable = toNum(r.quantity_available);
            const minStock = r.minimum_stock_level != null ? toNum(r.minimum_stock_level) : null;
            if(tmp[r.id]) {
                tmp[r.id].stores_quantities.push({
                    id: r.inventory_id,
                    name: r.store_name,
                    quantity_available: qtyAvailable,
                    minimum_stock_level: minStock,
                    warehouse_id: r.warehouse_id
                });
            }
            else if(r.store_name) {
                tmp[r.id] = {
                    ...r,
                    stores_quantities: [{
                        id: r.inventory_id,
                        name: r.store_name,
                        quantity_available: qtyAvailable,
                        minimum_stock_level: minStock,
                        warehouse_id: r.warehouse_id
                    }]
                }
            }
            else {
                tmp[r.id] = {
                    ...r,
                    stores_quantities: []
                }
            }
        })
        const data = Object.values(tmp);
        // console.log('data.len',data.length);
        
        const cleaned_data = data.map((d) => {
            delete d['store_name'];
            delete d['quantity_available'];
            delete d['warehouse_id'];
            d.inventory = (d.stores_quantities || []).reduce(
                (a, b) => toNum(a, { defaultValue: 0 }) + toNum(b?.quantity_available, { defaultValue: 0 }),
                0
            );
            return normalizeProductRow(d);
        });
        return cleaned_data;
    }

    return [];
}

export const getProductsByCategoryService = async (user, category_id, queryParams = {}) => {
    const pageSize = queryParams.pageSize && Number(queryParams.pageSize) > 0 ? Number(queryParams.pageSize) : 50;
    const pageNumber = queryParams.pageNumber && Number(queryParams.pageNumber) > 0 ? Number(queryParams.pageNumber) : 1;

    const searchText = queryParams.searchText ?? queryParams.search ?? queryParams.q;

    const params = [user.tenant_id, category_id];
    let where = "p.tenant_id = $1 AND $2 = ANY(p.categories)";
    let paramIndex = 3;

    if (searchText && String(searchText).trim()) {
        where += ` AND (p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`;
        params.push(`%${String(searchText).trim()}%`);
        paramIndex += 1;
    }

    const query = `
        SELECT 
            p.id,
            p.name,
            p.sku,
            p.unit_price,
            p.actual_cost,
            p.unit,
            p.alt_price,
            p.bar_code,
            p.description,
            p.categories,
            array_remove(array_agg(DISTINCT c.name), NULL) AS category_names,
            p.slug,
            p.thumbnail,
            p.tags,
            p.picture1,
            p.reorder_quantity,
            p.is_active AS active,
            COALESCE(inv.quantity_available, 0) AS quantity_available,
            inv.id AS inventory_id,
            inv.warehouse_id,
            COALESCE(wh.name, '') AS store_name,
            inv.expiration_date AS expiry_date
        FROM products p
        LEFT JOIN inventories inv ON inv.product_id = p.id
        LEFT JOIN warehouses wh ON inv.warehouse_id = wh.id
        LEFT JOIN categories c ON c.tenant_id = p.tenant_id AND c.id = ANY(p.categories)
        WHERE ${where}
        GROUP BY p.id, inv.id, wh.name, inv.expiration_date
        ORDER BY p.updated_at DESC
        LIMIT ${pageSize}
        OFFSET ${(pageNumber - 1) * pageSize};
    `;

    const result = await pool.query(query, params);
    if (!result.rows) return [];

    const tmp = {};
    result.rows.forEach((r) => {
        if (tmp[r.id]) {
            tmp[r.id].stores_quantities.push({
                id: r.inventory_id,
                name: r.store_name,
                quantity_available: r.quantity_available,
                minimum_stock_level: r.minimum_stock_level,
                warehouse_id: r.warehouse_id,
            });
        } else if (r.store_name) {
            tmp[r.id] = {
                ...r,
                stores_quantities: [
                    {
                        id: r.inventory_id,
                        name: r.store_name,
                        quantity_available: r.quantity_available,
                        minimum_stock_level: r.minimum_stock_level,
                        warehouse_id: r.warehouse_id,
                    },
                ],
            };
        } else {
            tmp[r.id] = {
                ...r,
                stores_quantities: [],
            };
        }
    });

    const data = Object.values(tmp);
    const cleaned = data.map((d) => {
        delete d.store_name;
        delete d.quantity_available;
        delete d.warehouse_id;
        d.inventory = (d.stores_quantities || []).reduce(
            (a, b) => toNum(a, { defaultValue: 0 }) + toNum(b?.quantity_available, { defaultValue: 0 }),
            0
        );
        return normalizeProductRow(d);
    });

    return cleaned;
}

export const getAllTransfersService = async (user, queryParams) => {  
    // console.log('x queryParams',queryParams);
    let query = `SELECT 
        trn.id, trn.notes, trn.number_of_items, trn.created_at, wh.name AS source, wh2.name AS destination, u.first_name, u.last_name FROM transfers trn 
        LEFT JOIN warehouses wh ON trn.source_warehouse_id = wh.id 
        LEFT JOIN warehouses wh2 ON trn.destination_warehouse_id = wh2.id 
        LEFT JOIN users u ON trn.creator_id = u.id
        WHERE trn.tenant_id = '${user.tenant_id}'
    `
    
    if(queryParams && queryParams.startDate) {
            query += ` AND trn.created_at BETWEEN '${queryParams.startDate}' AND '${queryParams.endDate}'`
    }

    query += ' GROUP BY trn.id, wh.name, wh2.name, u.first_name, u.last_name ORDER BY trn.updated_at DESC'
    
    
    // console.log('q is',query);
    
    const result = await pool.query(query);
    return result.rows; 
}

export const getProductByIdService = async (id) => {
    const productResult = await pool.query(
        `SELECT id, name, sku, unit_price, actual_cost, unit, bar_code, description, is_active,
                categories, slug, reorder_quantity, alt_price, tags,
                thumbnail, picture1, picture2, picture3, picture4,
                product_type, measurement_unit, allows_fractional_qty, min_order_qty, qty_step
         FROM products
         WHERE id = $1`,
        [id]
    );
    if (!productResult.rows[0]) return null;

    const product = productResult.rows[0];

    const invResult = await pool.query(
        `SELECT inv.id,
                inv.quantity_available,
                inv.minimum_stock_level,
                inv.warehouse_id,
                COALESCE(wh.name, '') AS store_name
         FROM inventories inv
         LEFT JOIN warehouses wh ON inv.warehouse_id = wh.id
         WHERE inv.product_id = $1`,
        [id]
    );

    const stores_quantities = invResult.rows.map((row) => ({
        name: row.store_name,
        quantity_available: toNum(row.quantity_available, { defaultValue: 0 }),
        minimum_stock_level:
            row.minimum_stock_level != null
                ? toNum(row.minimum_stock_level, { defaultValue: null })
                : null,
        warehouse_id: row.warehouse_id,
    }));

    const totalInventory = stores_quantities.reduce(
        (sum, s) => sum + toNum(s.quantity_available, { defaultValue: 0 }),
        0
    );

    return normalizeProductRow({
        ...product,
        inventory: totalInventory,
        stores_quantities,
    });
}

export const getProductBySlugService = async (slug) => {
    const result = await pool.query(
        `SELECT id, name, sku, unit_price, actual_cost, unit, inventory, bar_code, description,
                categories, slug, reorder_quantity, alt_price, tags,
                thumbnail, picture1, picture2, picture3, picture4,
                product_type, measurement_unit, allows_fractional_qty, min_order_qty, qty_step
         FROM products
         WHERE slug = $1`,
        [slug]
    );
    const row = result.rows[0];
    return row ? normalizeProductRow(row) : null;
}


export const getTransferByIdService = async (user, id) => {    
    let query = `SELECT 
        trn.id, trn.notes, trn.number_of_items, trn.created_at, wh.name AS source, wh2.name AS destination, u.first_name, u.last_name FROM transfers trn 
        LEFT JOIN warehouses wh ON trn.source_warehouse_id = wh.id 
        LEFT JOIN warehouses wh2 ON trn.destination_warehouse_id = wh2.id 
        LEFT JOIN users u ON trn.creator_id = u.id
        WHERE trn.tenant_id = '${user.tenant_id}'
        AND trn.id = '${id}'
        GROUP BY trn.id, wh.name, wh2.name, u.first_name, u.last_name ORDER BY trn.updated_at DESC`
    
    
    // console.log('trans q is',query);
    
    const result = await pool.query(query);
    if(result.rowCount) {
        const transfer = result.rows[0];
        let query2 = `SELECT tfd.quantity, pd.name FROM transferdetails tfd LEFT JOIN products pd ON tfd.product_id = pd.id WHERE tfd.transfer_id = '${id}'`;
        // console.log('query2',query2);
        const result2 = await pool.query(query2);
        if(result2.rowCount) {
            return {
                products: result2.rows,
                ...transfer
            }
        }
        // console.log('q2 res count',result2.rows);
        
        return null;
    }

    return null; 
}

export const createProductService = async (payload) => {
    console.log(' create product payload',payload);
    const {
        name,
        sku,
        unit_price,
        unit,
        tenant_id,
        alt_price,
        actual_cost,
        bar_code,
        slug,
        description,
        categories,
        creator_id,
        tags,
        warehouse_quantities,
        reorder_quantity,
        batch_number,
        serial_number,
        product_type,
        measurement_unit,
        allows_fractional_qty,
        min_order_qty,
        qty_step,
        installment_enabled,
        installment_min_initial_percent,
        installment_min_payment_amount,
    } = payload;
    const id = uuidv4();
    const normalizedMeasurementUnit = measurement_unit || unit || 'units';
    const normalizedProductType = product_type || 'standard';
    const normalizedAllowsFractionalQty = allows_fractional_qty === true;
    const minOrderQtyNumber = Number(min_order_qty);
    const qtyStepNumber = Number(qty_step);
    const normalizedMinOrderQty = Number.isFinite(minOrderQtyNumber) ? Math.max(1, minOrderQtyNumber) : 1;
    const normalizedQtyStep = Number.isFinite(qtyStepNumber) ? Math.max(1, qtyStepNumber) : 1;
    const result = await pool.query(`
        INSERT INTO products (
            id, name, sku, unit_price, actual_cost, unit, tenant_id, alt_price, bar_code, slug,
            description, creator_id, tags, is_active, categories, reorder_quantity,
            product_type, measurement_unit, allows_fractional_qty, min_order_qty, qty_step,
            installment_enabled, installment_min_initial_percent, installment_min_payment_amount, created_at
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21,
            $22, $23, $24, $25
        ) RETURNING id`,
        [
            id, name, sku, unit_price, actual_cost ?? null, normalizedMeasurementUnit, tenant_id, alt_price, bar_code, slug,
            description, creator_id, tags, true, categories, reorder_quantity,
            normalizedProductType, normalizedMeasurementUnit, normalizedAllowsFractionalQty, normalizedMinOrderQty, normalizedQtyStep,
            installment_enabled === true,
            installment_min_initial_percent ?? null,
            installment_min_payment_amount ?? null,
            new Date()
        ]
    );

    if(warehouse_quantities) {
        for(const warehouse_quantity of warehouse_quantities) {
            const { warehouse_id, quantity } = warehouse_quantity;
            const inv_id = uuidv4();
            await pool.query(`
                INSERT INTO inventories (id, quantity_available, product_id, warehouse_id, batch_number, serial_number, creator_id, tenant_id, created_at) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                [inv_id, quantity, id, warehouse_id, batch_number, serial_number, creator_id, tenant_id, new Date()])
        }
    }

    const newProduct = result.rows[0];
    // const newId = uuidv4();
    // const inv = await pool.query("INSERT INTO inventories (id, minimum_stock_level, product_id, created_at) VALUES ($1, $2, $3, $4) RETURNING id",[newId, reorder_quantity, newProduct.id, new Date()]);
    // console.log('inv,,,',inv);

    return newProduct;
}

export const updateProductService = async (payload) => {
    const { id } = payload;
    if (!id) return null;
    if (Object.prototype.hasOwnProperty.call(payload, "min_order_qty")) {
        const n = Number(payload.min_order_qty);
        payload.min_order_qty = Number.isFinite(n) ? Math.max(1, n) : 1;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "qty_step")) {
        const n = Number(payload.qty_step);
        payload.qty_step = Number.isFinite(n) ? Math.max(1, n) : 1;
    }

    const columns = [
        "name",
        "sku",
        "unit",
        "product_type",
        "measurement_unit",
        "allows_fractional_qty",
        "min_order_qty",
        "qty_step",
        "bar_code",
        "slug",
        "description",
        "categories",
        "reorder_quantity",
        "tags",
        "unit_price",
        "alt_price",
        "actual_cost",
        "installment_enabled",
        "installment_min_initial_percent",
        "installment_min_payment_amount",
    ];

    const sets = [];
    const values = [];
    let param = 1;

    for (const col of columns) {
        if (Object.prototype.hasOwnProperty.call(payload, col)) {
            sets.push(`${col} = $${param++}`);
            values.push(payload[col]);
        }
    }

    if (sets.length === 0) {
        const existing = await pool.query(`SELECT id FROM products WHERE id = $1`, [id]);
        return existing.rows[0] || null;
    }

    sets.push(`updated_at = $${param++}`);
    values.push(new Date());
    values.push(id);

    const result = await pool.query(
        `UPDATE products SET ${sets.join(", ")} WHERE id = $${param} RETURNING id`,
        values
    );

    return result.rows[0];
}

export const toggleProductStatusService = async (payload) => {
    const { id, status } = payload;
    const result = await pool.query(`
        UPDATE products SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING id`,
        [status, new Date(), id]
    );

    return result.rows[0];
}

export const changeProductPriceService = async (payload) => {
    const { id, unit_price, alt_price } = payload;

    const currentResult = await pool.query(
        "SELECT id, unit_price, alt_price FROM products WHERE id = $1",
        [id]
    );
    if (!currentResult.rows[0]) {
        return null;
    }
    const before = currentResult.rows[0];

    const result = await pool.query(
        `UPDATE products
         SET unit_price = COALESCE($1, unit_price),
             alt_price = COALESCE($2, alt_price),
             updated_at = $3
         WHERE id = $4
         RETURNING id, unit_price, alt_price`,
        [unit_price ?? null, alt_price ?? null, new Date(), id]
    );

    const after = result.rows[0];
    return { before, after };
}

export const updateProductImagesService = async (payload) => {
    const { id, thumbnail, picture1, picture2, picture3, picture4 } = payload;

    const norm = (v) => {
        if (v === undefined || v === null || v === '') return null;
        const s = String(v).trim();
        return s || null;
    };

    const current = await pool.query(
        `SELECT thumbnail, picture1, picture2, picture3, picture4 FROM products WHERE id = $1`,
        [id]
    );
    if (!current.rows?.[0]) return null;

    const row = current.rows[0];
    const oldKeys = [row.thumbnail, row.picture1, row.picture2, row.picture3, row.picture4]
        .map((k) => (k == null ? null : String(k).trim()))
        .filter(Boolean);

    const newThumb = norm(thumbnail);
    const newP1 = norm(picture1);
    const newP2 = norm(picture2);
    const newP3 = norm(picture3);
    const newP4 = norm(picture4);

    const newKeys = [newThumb, newP1, newP2, newP3, newP4].filter(Boolean);
    const newKeySet = new Set(newKeys);
    const keysToDelete = oldKeys.filter((k) => !newKeySet.has(k));

    if (keysToDelete.length > 0) {
        await deleteS3Objects(keysToDelete);
    }

    const result = await pool.query(
        `
        UPDATE products SET thumbnail=$1, picture1=$2, picture2=$3, picture3=$4, picture4=$5, updated_at=$6  WHERE id=$7 RETURNING id`,
        [newThumb, newP1, newP2, newP3, newP4, new Date(), id]
    );

    return result.rows[0];
}

export const deleteProductService = async (id) => {
    const result = await pool.query(`
        UPDATE products SET is_active=$1, updated_at=$2  WHERE id=$3 RETURNING id`,
        [ false, new Date(), id]
    );

    return result.rows[0];
}

export const createTransferService = async (payload) => {
    const client = await pool.connect();

    try {
        // console.log('pr pal',payload);
        
        await client.query('BEGIN');
        const { tenant_id, source_warehouse_id, destination_warehouse_id, products, note, creator_id } = payload;
        
        if(!products) {
            throw new Error("Products list cannot be empty.");
        }

        const number_of_items = products.reduce((accumulator, currentItem) => accumulator + Number(currentItem.quantity), 0);

        const id = uuidv4();
        const result = await client.query(`
            INSERT INTO transfers (id, number_of_items, tenant_id, source_warehouse_id, destination_warehouse_id, creator_id, notes, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [id, number_of_items, tenant_id, source_warehouse_id, destination_warehouse_id, creator_id, note, new Date()]
        );

        for (const prod of products) {
            const r1 = await client.query("SELECT id, quantity_available FROM inventories where product_id = $1 AND warehouse_id=$2", [prod.id, source_warehouse_id]);
            if(r1.rowCount) {
                // console.log('source found. reduct qty by',prod.quantity);
                
                await client.query("UPDATE inventories SET quantity_available = quantity_available - $1, updated_at=$2 WHERE id=$3 RETURNING *",[prod.quantity, new Date(), r1.rows[0].id]);

                const r2 = await client.query("SELECT id, quantity_available FROM inventories where product_id = $1 AND warehouse_id=$2", [prod.id, destination_warehouse_id]);
                if(r2.rowCount) {
                    // console.log('destination found. increase qty by',prod.quantity);

                    await client.query("UPDATE inventories SET quantity_available = quantity_available + $1, updated_at=$2 WHERE id=$3 RETURNING *",[prod.quantity, new Date(), r2.rows[0].id]);
                }
                else {
                    // console.log('product inv not found creating new');
                    
                    const newId = uuidv4();
                    await client.query("INSERT INTO inventories (id, quantity_available, minimum_stock_level, product_id, warehouse_id, creator_id, tenant_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",[newId, prod.quantity, 10, prod.id, destination_warehouse_id, creator_id, tenant_id, new Date()]);
                }
            }
            // const rp = await client.query("UPDATE products SET inventory = inventory + $1, updated_at=$2 WHERE id=$3 RETURNING *",[prod.quantity, new Date(), prod.id]);
            // // console.log('X prod. update rp',rp.rows);

            const _newId = uuidv4();
            await client.query("INSERT INTO transferdetails (id, transfer_id, product_id, quantity, tenant_id, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",[_newId, result.rows[0].id, prod.id, prod.quantity, tenant_id, new Date()]);
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
