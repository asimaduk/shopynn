-- Merchant payout profiles + withdrawal requests (in-app; admin pays offline).
-- Run: psql -U postgres -d <your_db> -f migrations/20260529_tenant_payout_profiles_and_withdrawals.sql

CREATE TABLE IF NOT EXISTS tenant_payout_profiles (
    tenant_id varchar(40) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    payout_method varchar(20) NOT NULL DEFAULT 'momo',
    momo_network varchar(30),
    momo_number varchar(30),
    bank_name varchar(120),
    bank_account_number varchar(40),
    bank_account_name varchar(120),
    account_holder_name varchar(120),
    updated_by varchar(40) REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE tenant_settlements
    ADD COLUMN IF NOT EXISTS source varchar(20) NOT NULL DEFAULT 'admin',
    ADD COLUMN IF NOT EXISTS requested_by varchar(40) REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS payout_snapshot jsonb,
    ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS idx_tenant_settlements_source ON tenant_settlements(source);
CREATE INDEX IF NOT EXISTS idx_tenant_settlements_status_tenant ON tenant_settlements(tenant_id, status);
