-- Transfer handoff: in-transit until destination accepts (with optional qty variance).
-- Run: psql ... -f migrations/20260924_transfer_receive_handoff.sql

ALTER TABLE transfers
    ADD COLUMN IF NOT EXISTS status varchar(20);

ALTER TABLE transfers
    ADD COLUMN IF NOT EXISTS receiver_id varchar(40);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'transfers_receiver_id_fkey'
    ) THEN
        ALTER TABLE transfers
            ADD CONSTRAINT transfers_receiver_id_fkey
            FOREIGN KEY (receiver_id) REFERENCES users(id);
    END IF;
END $$;

-- Existing rows already moved stock on create → treat as received.
UPDATE transfers
SET status = 'received',
    received_date = COALESCE(received_date, created_at, now())
WHERE status IS NULL OR trim(status) = '';

ALTER TABLE transfers
    ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE transfers
    ALTER COLUMN status SET NOT NULL;

ALTER TABLE transferdetails
    ADD COLUMN IF NOT EXISTS quantity_received numeric(12,3);

UPDATE transferdetails td
SET quantity_received = td.quantity
FROM transfers t
WHERE td.transfer_id = t.id
  AND t.status = 'received'
  AND td.quantity_received IS NULL;

COMMENT ON COLUMN transfers.status IS 'pending = in transit (left source); received = destination accepted.';
COMMENT ON COLUMN transfers.receiver_id IS 'User who accepted the transfer at destination.';
COMMENT ON COLUMN transferdetails.quantity_received IS 'Qty confirmed at destination; null while pending.';

-- Permission for receiving (Business+ already has transfers.create; seed also grants receive).
INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'transfers.receive', 'Receive transfers', 'Accept inbound stock transfers and confirm quantities', now()
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE lower(code) = 'transfers.receive'
);

-- Attach to roles that already have transfers.create
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid()::text, rp.role_id, p_recv.id
FROM permissions p_recv
CROSS JOIN (
    SELECT DISTINCT rp.role_id
    FROM role_permissions rp
    INNER JOIN permissions p ON p.id = rp.permission_id
    WHERE lower(p.code) = 'transfers.create'
) rp
WHERE lower(p_recv.code) = 'transfers.receive'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions x
      WHERE x.role_id = rp.role_id AND x.permission_id = p_recv.id
  );

-- Tier feature: same as transfers.create (not on Starter / basic)
INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, 'transfers.receive', now()
FROM subscription_tiers t
WHERE lower(t.code) IN ('standard', 'premium')
  AND NOT EXISTS (
      SELECT 1 FROM subscription_tier_features stf
      WHERE stf.tier_id = t.id AND lower(stf.feature_code) = 'transfers.receive'
  );
