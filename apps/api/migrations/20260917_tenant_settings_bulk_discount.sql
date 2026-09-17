-- Per-tenant sale preferences (bulk/wholesale discount, etc.)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tenants.settings IS
  'Tenant preferences JSON. bulk_discount: { enabled: boolean, quantity_threshold: number }';
