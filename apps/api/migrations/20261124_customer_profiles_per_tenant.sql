-- Cross-shop storefront: one customer_profiles row per (user, tenant), not per user globally.
-- Fixes: duplicate key value violates unique constraint "customer_profiles_user_id_key"

ALTER TABLE customer_profiles
    DROP CONSTRAINT IF EXISTS customer_profiles_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_profiles_user_tenant
    ON customer_profiles (user_id, tenant_id);

COMMENT ON TABLE customer_profiles IS
    'Per-tenant customer identity for a users row; same phone can shop multiple tenants.';
