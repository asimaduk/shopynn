import pool from "../config/db.js";

const TABLE_BY_KIND = {
    warehouseIds: "warehouses",
    productIds: "products",
    supplierIds: "suppliers",
    customerIds: "customers",
};

const uniqueIds = (ids) => [...new Set((ids || []).filter((id) => id != null && id !== "").map(String))];

/**
 * Throws a 404 unless every referenced id belongs to `tenantId`.
 * Call before any write that takes these ids from the request.
 */
export const assertTenantOwnsRecords = async (tenantId, refs = {}, db = pool) => {
    const checks = Object.entries(TABLE_BY_KIND).map(async ([kind, table]) => {
        const ids = uniqueIds(refs[kind]);
        if (!ids.length) return true;
        const r = await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE id = ANY($1::text[]) AND tenant_id = $2`, [ids, tenantId]);
        return r.rows[0].n === ids.length;
    });
    if ((await Promise.all(checks)).includes(false)) {
        const err = new Error("Some records were not found in your shop.");
        err.status = 404;
        err.code = "NOT_IN_SHOP";
        throw err;
    }
};

/** Checks the `{ warehouse_id, supplier_id, customer_id, products: [{ id }] }` shape used by stock writes. */
export const assertOwnStockPayload = (req, body = req.body || {}) =>
    assertTenantOwnsRecords(req.user.tenant_id, {
        warehouseIds: [body.warehouse_id],
        supplierIds: [body.supplier_id],
        customerIds: [body.customer_id],
        productIds: (body.products || body.items || []).map((p) => p?.id ?? p?.product_id),
    });

const SCOPED_TABLES = new Set(["sales", "purchases", "warehouses", "categories", "suppliers", "locations", "expenses", "products"]);

/** Throws a 404 unless the row `id` in `table` belongs to the caller's shop. */
export const assertOwnRecord = async (req, table, id) => {
    if (!SCOPED_TABLES.has(table)) throw new Error(`Unscoped table: ${table}`);
    const r = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [String(id ?? ""), req.user.tenant_id]);
    if (r.rowCount === 0) {
        const err = new Error("Not found.");
        err.status = 404;
        throw err;
    }
};
