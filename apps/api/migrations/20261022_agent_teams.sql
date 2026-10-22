-- Agent managers and teams; agents are deactivated instead of deleted; a shop is credited to an
-- agent only once it pays (onboarded_by records who set it up until then).

ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS agent_type varchar(20) NOT NULL DEFAULT 'agent',
    ADD COLUMN IF NOT EXISTS manager_id varchar(40) REFERENCES merchants(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS recruited_by varchar(40) REFERENCES merchants(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_by varchar(40) REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at timestamp,
    ADD COLUMN IF NOT EXISTS deactivated_by varchar(40) REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deactivated_at timestamp,
    ADD COLUMN IF NOT EXISTS status_reason varchar(500);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merchants_agent_type_check') THEN
        ALTER TABLE merchants ADD CONSTRAINT merchants_agent_type_check
            CHECK (agent_type IN ('agent', 'manager'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merchants_status_check') THEN
        ALTER TABLE merchants ADD CONSTRAINT merchants_status_check
            CHECK (status IN ('pending_approval', 'active', 'rejected', 'deactivated'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merchants_not_own_manager') THEN
        ALTER TABLE merchants ADD CONSTRAINT merchants_not_own_manager
            CHECK (manager_id IS NULL OR manager_id <> id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_merchants_manager ON merchants (manager_id) WHERE manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants (status);

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS onboarded_by_merchant_id varchar(40) REFERENCES merchants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_onboarded_by_merchant
    ON tenants (onboarded_by_merchant_id)
    WHERE onboarded_by_merchant_id IS NOT NULL;

UPDATE tenants t
SET onboarded_by_merchant_id = first_quote.merchant_id
FROM (
    SELECT DISTINCT ON (tenant_id) tenant_id, merchant_id
    FROM onboarding_quotes
    WHERE merchant_id IS NOT NULL
    ORDER BY tenant_id, created_at ASC
) first_quote
WHERE t.id = first_quote.tenant_id
  AND t.onboarded_by_merchant_id IS NULL;

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'merchants.manage_team', 'Manage agent team',
       'Recruit field agents, view the team''s shops and earnings, reassign shops within the team', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'merchants.manage_team');

INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, 'merchants.manage_team', now()
FROM subscription_tiers t
WHERE lower(t.code) = 'premium'
  AND NOT EXISTS (
      SELECT 1 FROM subscription_tier_features stf
      WHERE stf.tier_id = t.id AND stf.feature_code = 'merchants.manage_team'
  );
