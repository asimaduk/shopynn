-- Agent serving merchant + residual commission support; refresh onboarding catalog fees.
-- Run: psql ... -f migrations/20260908_agent_serving_residual_commission.sql

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS serving_merchant_id varchar(40) REFERENCES merchants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_serving_merchant
    ON tenants (serving_merchant_id)
    WHERE serving_merchant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS merchant_tenant_assignments (
    id varchar(40) PRIMARY KEY,
    tenant_id varchar(40) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    merchant_id varchar(40) REFERENCES merchants(id) ON DELETE SET NULL,
    previous_merchant_id varchar(40) REFERENCES merchants(id) ON DELETE SET NULL,
    reason varchar(500),
    assigned_by varchar(40) REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_tenant_assignments_tenant
    ON merchant_tenant_assignments (tenant_id, created_at DESC);

ALTER TABLE merchant_commissions
    ADD COLUMN IF NOT EXISTS commission_kind varchar(40) NOT NULL DEFAULT 'acquisition';

ALTER TABLE merchant_commissions
    ADD COLUMN IF NOT EXISTS payment_id varchar(40);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_commissions_payment_id
    ON merchant_commissions (payment_id)
    WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_merchant_commissions_kind_status
    ON merchant_commissions (commission_kind, status);

-- Crisp assisted go-live fees: Basic 1000 / Standard 2500 / Premium 4000
UPDATE billing_catalog_items
SET amount_ghs = 1000,
    label = 'Basic assisted go-live',
    description = 'Optional assisted setup and training (Lite)',
    updated_at = now()
WHERE code = 'onboarding_basic';

UPDATE billing_catalog_items
SET amount_ghs = 2500,
    label = 'Standard assisted go-live',
    description = 'Optional assisted setup and training',
    updated_at = now()
WHERE code = 'onboarding_standard';

UPDATE billing_catalog_items
SET amount_ghs = 4000,
    label = 'Premium assisted go-live',
    description = 'Optional assisted setup and training (multi-branch)',
    updated_at = now()
WHERE code = 'onboarding_premium';

-- Subscription lines earn 5% residual (including first month), not one-time 10%
UPDATE billing_catalog_items
SET commission_eligible = 'subscription_residual_5',
    updated_at = now()
WHERE item_type = 'subscription_monthly'
  AND commission_eligible IN ('subscription_first_month_10', 'subscription_residual_5');

-- Backfill serving agent from most recent quote, else commission row
UPDATE tenants t
SET serving_merchant_id = src.merchant_id
FROM (
    SELECT DISTINCT ON (tenant_id) tenant_id, merchant_id
    FROM (
        SELECT tenant_id, merchant_id, created_at
        FROM onboarding_quotes
        WHERE merchant_id IS NOT NULL
        UNION ALL
        SELECT tenant_id, merchant_id, created_at
        FROM merchant_commissions
        WHERE merchant_id IS NOT NULL
    ) u
    ORDER BY tenant_id, created_at DESC
) src
WHERE t.id = src.tenant_id
  AND t.serving_merchant_id IS NULL;
