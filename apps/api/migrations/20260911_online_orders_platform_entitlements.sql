-- Re-seed Premium online-order features after restores (schema_migrations may already
-- record 20260909_* so those files never re-run), and ensure asimaduk@gmail.com's
-- tenant has an active Premium subscription so Mobile/Web Online Orders unlocks.
-- Idempotent.

INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, f.code, now()
FROM subscription_tiers t
CROSS JOIN (
    VALUES
        ('orders.view'),
        ('orders.details.view'),
        ('orders.create'),
        ('orders.update'),
        ('orders.cancel'),
        ('orders.status.update'),
        ('orders.process'),
        ('orders.store.view'),
        ('orders.store.manage'),
        ('orders.delivery.view'),
        ('orders.delivery.manage'),
        ('orders.fulfillment.assign'),
        ('orders.export'),
        ('orders.analytics.view'),
        ('orders.automation.manage'),
        ('orders.multi_store.manage')
) AS f(code)
WHERE lower(t.code) = 'premium'
  AND NOT EXISTS (
      SELECT 1
      FROM subscription_tier_features stf
      WHERE stf.tier_id = t.id
        AND lower(stf.feature_code) = lower(f.code)
  );

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid()::text, r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE lower(trim(r.name)) IN ('super admin', 'owner', 'admin', 'administrator')
  AND p.code IN (
      'orders.status.update',
      'orders.process',
      'orders.store.view',
      'orders.store.manage',
      'orders.delivery.view',
      'orders.delivery.manage',
      'orders.fulfillment.assign',
      'orders.export',
      'orders.analytics.view',
      'orders.automation.manage',
      'orders.multi_store.manage'
  )
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

DO $$
DECLARE
    v_email     text := 'asimaduk@gmail.com';
    v_user_id   varchar(40);
    v_tenant_id varchar(40);
    v_sub_id    varchar(40);
BEGIN
    SELECT id, tenant_id INTO v_user_id, v_tenant_id
    FROM users
    WHERE lower(email) = lower(v_email)
    LIMIT 1;

    IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
        RAISE NOTICE 'online orders entitlements: % not found — skipped Premium link', v_email;
        RETURN;
    END IF;

    SELECT subscription_id INTO v_sub_id FROM tenants WHERE id = v_tenant_id;

    IF v_sub_id IS NULL THEN
        v_sub_id := gen_random_uuid()::text;
        INSERT INTO subscriptions (
            id, name, description, amount, billing_interval, status,
            created_at, updated_at, start_at, end_at, features, tenant_id
        ) VALUES (
            v_sub_id, 'Premium', 'Platform operator plan', 799.00, 'monthly', 'active',
            now(), now(), now(), now() + interval '10 years', NULL, v_tenant_id
        );
        UPDATE tenants
        SET subscription_id = v_sub_id, updated_at = now()
        WHERE id = v_tenant_id;
    ELSE
        UPDATE subscriptions
        SET name = 'Premium',
            status = 'active',
            start_at = COALESCE(start_at, now()),
            end_at = GREATEST(COALESCE(end_at, now()), now() + interval '1 year'),
            updated_at = now()
        WHERE id = v_sub_id;
    END IF;

    RAISE NOTICE 'online orders entitlements: Premium linked for % on tenant %', v_email, v_tenant_id;
END $$;
