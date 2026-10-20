/**
 * Reorder level for a product's first stock row in a store: the product's
 * reorder level, else the level another store uses for it, else 0.
 */
export async function defaultMinimumStockLevel(db, tenantId, productId) {
    const res = await db.query(
        `SELECT COALESCE(
            (SELECT reorder_quantity FROM products WHERE id = $1 AND tenant_id = $2),
            (SELECT minimum_stock_level FROM inventories
              WHERE product_id = $1 AND tenant_id = $2 AND minimum_stock_level IS NOT NULL
              ORDER BY updated_at DESC NULLS LAST LIMIT 1),
            0
         )::numeric AS level`,
        [productId, tenantId]
    );
    return Number(res.rows[0]?.level) || 0;
}
