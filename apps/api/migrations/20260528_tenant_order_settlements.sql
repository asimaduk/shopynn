-- Tenant order payment settlements (Shopynn → business owner payouts for digital order revenue).
-- Run: psql -U postgres -d <your_db> -f migrations/20260528_tenant_order_settlements.sql

CREATE TABLE IF NOT EXISTS tenant_settlements (
    id varchar(40) PRIMARY KEY,
    tenant_id varchar(40) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    amount numeric(14, 2) NOT NULL,
    currency varchar(8) NOT NULL DEFAULT 'GHS',
    status varchar(20) NOT NULL DEFAULT 'pending',
    note text,
    payout_reference varchar(255),
    created_by varchar(40) REFERENCES users(id),
    paid_by varchar(40) REFERENCES users(id),
    paid_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_settlements_tenant_id ON tenant_settlements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_settlements_status ON tenant_settlements(status);
