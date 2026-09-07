-- Billing catalog, onboarding quotes, merchant checkout (one-charge flow).
-- Run: psql -U postgres -d <your_db> -f migrations/20260526_billing_catalog_onboarding_quotes.sql

CREATE TABLE IF NOT EXISTS billing_catalog_items (
    id varchar(40) PRIMARY KEY,
    code varchar(80) NOT NULL UNIQUE,
    item_type varchar(40) NOT NULL,
    plan_tier varchar(20),
    label varchar(200) NOT NULL,
    description varchar(1000),
    amount_ghs decimal(12, 2) NOT NULL DEFAULT 0,
    min_amount_ghs decimal(12, 2),
    max_amount_ghs decimal(12, 2),
    commission_eligible varchar(40) NOT NULL DEFAULT 'none',
    is_active boolean NOT NULL DEFAULT true,
    sort_order int NOT NULL DEFAULT 0,
    updated_by varchar(40) REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_catalog_active_type ON billing_catalog_items (is_active, item_type);
CREATE INDEX IF NOT EXISTS idx_billing_catalog_plan_tier ON billing_catalog_items (plan_tier) WHERE plan_tier IS NOT NULL;

CREATE TABLE IF NOT EXISTS onboarding_quotes (
    id varchar(40) PRIMARY KEY,
    tenant_id varchar(40) NOT NULL REFERENCES tenants(id),
    merchant_id varchar(40) REFERENCES merchants(id),
    subscription_type int NOT NULL,
    subscription_id varchar(40) REFERENCES subscriptions(id),
    status varchar(30) NOT NULL DEFAULT 'pending_payment',
    total_ghs decimal(12, 2) NOT NULL DEFAULT 0,
    owner_email varchar(255),
    quote_kind varchar(30) NOT NULL DEFAULT 'full_onboard',
    paid_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_quotes_tenant_status ON onboarding_quotes (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_onboarding_quotes_merchant ON onboarding_quotes (merchant_id);

CREATE TABLE IF NOT EXISTS onboarding_quote_lines (
    id varchar(40) PRIMARY KEY,
    quote_id varchar(40) NOT NULL REFERENCES onboarding_quotes(id) ON DELETE CASCADE,
    catalog_item_id varchar(40) REFERENCES billing_catalog_items(id),
    code varchar(80) NOT NULL,
    line_type varchar(40) NOT NULL,
    label varchar(200) NOT NULL,
    amount_ghs decimal(12, 2) NOT NULL,
    commission_eligible varchar(40) NOT NULL DEFAULT 'none',
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_quote_lines_quote ON onboarding_quote_lines (quote_id);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS quote_id varchar(40) REFERENCES onboarding_quotes(id);
CREATE INDEX IF NOT EXISTS idx_payments_quote_id ON payments (quote_id) WHERE quote_id IS NOT NULL;

ALTER TABLE merchant_commissions ADD COLUMN IF NOT EXISTS quote_id varchar(40) REFERENCES onboarding_quotes(id);
ALTER TABLE merchant_commissions ADD COLUMN IF NOT EXISTS onboarding_commission_amount decimal(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE merchant_commissions ADD COLUMN IF NOT EXISTS subscription_commission_amount decimal(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE merchant_commissions ADD COLUMN IF NOT EXISTS payable_after timestamp;

-- Seed catalog (idempotent by code)
INSERT INTO billing_catalog_items (id, code, item_type, plan_tier, label, description, amount_ghs, commission_eligible, sort_order)
VALUES
    (gen_random_uuid()::text, 'plan_free_monthly', 'subscription_monthly', 'free', 'Free trial', '14-day trial', 0, 'none', 0),
    (gen_random_uuid()::text, 'plan_basic_monthly', 'subscription_monthly', 'basic', 'Basic monthly', 'Monthly subscription', 229, 'subscription_first_month_10', 10),
    (gen_random_uuid()::text, 'plan_standard_monthly', 'subscription_monthly', 'standard', 'Standard monthly', 'Monthly subscription', 429, 'subscription_first_month_10', 20),
    (gen_random_uuid()::text, 'plan_premium_monthly', 'subscription_monthly', 'premium', 'Premium monthly', 'Monthly subscription', 799, 'subscription_first_month_10', 30),
    (gen_random_uuid()::text, 'onboarding_basic', 'onboarding', 'basic', 'Basic onboarding', 'Setup and training', 2000, 'onboarding_15', 11),
    (gen_random_uuid()::text, 'onboarding_standard', 'onboarding', 'standard', 'Standard onboarding', 'Setup and training', 4000, 'onboarding_15', 21),
    (gen_random_uuid()::text, 'onboarding_premium', 'onboarding', 'premium', 'Premium onboarding', 'Setup and training', 6000, 'onboarding_15', 31),
    (gen_random_uuid()::text, 'addon_csv_import', 'addon', NULL, 'CSV product import', 'Import products from spreadsheet', 500, 'none', 100),
    (gen_random_uuid()::text, 'addon_opening_stock', 'addon', NULL, 'Opening stock setup', 'Initial stock configuration', 1000, 'none', 110),
    (gen_random_uuid()::text, 'addon_data_migration', 'addon', NULL, 'Data migration', 'Migrate from another system', 3000, 'none', 120),
    (gen_random_uuid()::text, 'addon_extra_training_day', 'addon', NULL, 'Extra training day', 'Additional on-site or remote training', 1000, 'none', 130)
ON CONFLICT (code) DO NOTHING;
