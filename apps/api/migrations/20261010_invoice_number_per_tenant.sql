-- Invoice numbers are unique per shop, not across all shops (INV-M-1001 is valid in every shop).

DO $$
DECLARE
    tbl text;
    con record;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['sales', 'purchases']
    LOOP
        FOR con IN
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
            WHERE c.conrelid = tbl::regclass
              AND c.contype = 'u'
              AND array_length(c.conkey, 1) = 1
              AND a.attname = 'invoice_number'
        LOOP
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', tbl, con.conname);
        END LOOP;
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS sales_tenant_invoice_number_unique
    ON sales (tenant_id, invoice_number)
    WHERE invoice_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_tenant_invoice_number_unique
    ON purchases (tenant_id, invoice_number)
    WHERE invoice_number IS NOT NULL;
