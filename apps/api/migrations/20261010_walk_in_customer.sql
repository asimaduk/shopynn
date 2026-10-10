-- One built-in "Walk-in" customer per shop for counter sales without a named buyer.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_walk_in boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_walk_in_unique
    ON customers (tenant_id)
    WHERE is_walk_in;

INSERT INTO customers (id, name, tenant_id, created_at, updated_at, is_active, is_walk_in, notes)
SELECT gen_random_uuid()::text, 'Walk-in', t.id, now(), now(), true, true, 'Default customer for counter sales'
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM customers c WHERE c.tenant_id = t.id AND c.is_walk_in
);
