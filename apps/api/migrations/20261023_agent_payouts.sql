-- Agent commission lifecycle, manager override rows, agent MoMo payout profiles and payout batches.
-- Commission status: pending (held until payable_after, then payable) -> in_payout -> paid; or cancelled.

ALTER TABLE merchant_commissions
    ADD COLUMN IF NOT EXISTS source_commission_id varchar(40) REFERENCES merchant_commissions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS payout_id varchar(40),
    ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
    ADD COLUMN IF NOT EXISTS cancelled_by varchar(40) REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cancel_reason varchar(500);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_commissions_override_source
    ON merchant_commissions (source_commission_id)
    WHERE source_commission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_merchant_commissions_merchant_status
    ON merchant_commissions (merchant_id, status, payable_after);

CREATE TABLE IF NOT EXISTS merchant_payout_profiles (
    merchant_id varchar(40) PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
    payout_method varchar(20) NOT NULL DEFAULT 'momo',
    momo_network varchar(20) NOT NULL,
    momo_number varchar(20) NOT NULL,
    account_holder_name varchar(150) NOT NULL,
    paystack_recipient_code varchar(80),
    paystack_bank_code varchar(40),
    payout_details_fingerprint varchar(200),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merchant_payouts (
    id varchar(40) PRIMARY KEY,
    merchant_id varchar(40) NOT NULL REFERENCES merchants(id),
    amount numeric(12,2) NOT NULL,
    fee_absorbed numeric(12,2) NOT NULL DEFAULT 0,
    currency varchar(8) NOT NULL DEFAULT 'GHS',
    status varchar(20) NOT NULL DEFAULT 'pending_approval',
    commission_count integer NOT NULL DEFAULT 0,
    payout_snapshot jsonb,
    payout_channel varchar(20),
    paystack_transfer_code varchar(80),
    paystack_transfer_reference varchar(120),
    attempts integer NOT NULL DEFAULT 0,
    failure_reason text,
    created_by varchar(40) REFERENCES users(id) ON DELETE SET NULL,
    approved_by varchar(40) REFERENCES users(id) ON DELETE SET NULL,
    approved_at timestamp,
    paid_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT merchant_payouts_status_check
        CHECK (status IN ('pending_approval', 'processing', 'paid', 'failed', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_merchant_payouts_status ON merchant_payouts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_payouts_merchant ON merchant_payouts (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_payouts_transfer_ref ON merchant_payouts (paystack_transfer_reference);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merchant_commissions_payout_fk') THEN
        ALTER TABLE merchant_commissions ADD CONSTRAINT merchant_commissions_payout_fk
            FOREIGN KEY (payout_id) REFERENCES merchant_payouts(id) ON DELETE SET NULL;
    END IF;
END $$;

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'merchants.payouts.approve', 'Approve agent payouts',
       'Approve and send agent commission payouts via Paystack', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'merchants.payouts.approve');

INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, 'merchants.payouts.approve', now()
FROM subscription_tiers t
WHERE lower(t.code) = 'premium'
  AND NOT EXISTS (
      SELECT 1 FROM subscription_tier_features stf
      WHERE stf.tier_id = t.id AND stf.feature_code = 'merchants.payouts.approve'
  );

-- Platform admins (roles that already manage agents) may approve payouts.
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid()::text, rp.role_id, p.id
FROM role_permissions rp
INNER JOIN permissions pv ON pv.id = rp.permission_id AND pv.code = 'merchants.view'
CROSS JOIN permissions p
WHERE p.code = 'merchants.payouts.approve'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions x WHERE x.role_id = rp.role_id AND x.permission_id = p.id
  );
