-- SKUs are optional and unique per tenant, not across all tenants.
-- Blank SKUs were stored as '' and collided with each other on the global unique constraint.

UPDATE products SET sku = NULL WHERE sku IS NOT NULL AND btrim(sku) = '';

DO $$
DECLARE
    con record;
BEGIN
    FOR con IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'products'::regclass
          AND c.contype = 'u'
          AND array_length(c.conkey, 1) = 1
          AND a.attname = 'sku'
    LOOP
        EXECUTE format('ALTER TABLE products DROP CONSTRAINT %I', con.conname);
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_sku_unique
    ON products (tenant_id, sku)
    WHERE sku IS NOT NULL;
