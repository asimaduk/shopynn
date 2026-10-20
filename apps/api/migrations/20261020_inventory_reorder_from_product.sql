-- Store stock rows used to be created with a fixed reorder level of 10 (or none).
-- Where the product has its own reorder level, use it for rows still on those defaults.

UPDATE inventories inv
SET minimum_stock_level = p.reorder_quantity,
    updated_at = NOW()
FROM products p
WHERE p.id = inv.product_id
  AND p.tenant_id = inv.tenant_id
  AND p.reorder_quantity IS NOT NULL
  AND (inv.minimum_stock_level IS NULL OR inv.minimum_stock_level = 10)
  AND inv.minimum_stock_level IS DISTINCT FROM p.reorder_quantity;
