-- Link POS customers row to app-signup customer_profiles (walk-in + online identity).
-- Run: psql ... -f migrations/20260924_customers_customer_profile_id.sql

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS customer_profile_id varchar(40) REFERENCES customer_profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_tenant_customer_profile
    ON customers (tenant_id, customer_profile_id)
    WHERE customer_profile_id IS NOT NULL;

COMMENT ON COLUMN customers.customer_profile_id IS
    'When set, this POS customer mirrors an app-signup customer_profiles row (same shopper).';

-- Backfill from prior note-based linking.
UPDATE customers c
SET customer_profile_id = cp.id
FROM customer_profiles cp
WHERE c.customer_profile_id IS NULL
  AND c.tenant_id = cp.tenant_id
  AND c.notes = 'Linked from app signup profile ' || cp.id;
