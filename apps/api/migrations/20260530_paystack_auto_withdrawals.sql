-- Paystack automatic merchant withdrawals.
-- Run: psql -U postgres -d <your_db> -f migrations/20260530_paystack_auto_withdrawals.sql

ALTER TABLE tenant_payout_profiles
    ADD COLUMN IF NOT EXISTS paystack_recipient_code varchar(80),
    ADD COLUMN IF NOT EXISTS paystack_bank_code varchar(40),
    ADD COLUMN IF NOT EXISTS payout_details_fingerprint varchar(255);

ALTER TABLE tenant_settlements
    ADD COLUMN IF NOT EXISTS paystack_transfer_code varchar(80),
    ADD COLUMN IF NOT EXISTS paystack_transfer_reference varchar(120),
    ADD COLUMN IF NOT EXISTS payout_channel varchar(20) NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_tenant_settlements_transfer_ref ON tenant_settlements(paystack_transfer_reference);
