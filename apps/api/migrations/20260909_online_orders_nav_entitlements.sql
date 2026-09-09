-- After EC2 data restores, online-order permission/feature rows are often missing.
-- 1) Ensure Premium tier includes store-order features.
-- 2) Grant store-order permissions to Owner / Admin / Administrator roles so
--    Basic/Standard owners see locked nav (upgrade) and Premium owners can open it.

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
WHERE lower(r.name) IN ('owner', 'admin', 'administrator')
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
      SELECT 1
      FROM role_permissions rp
      WHERE rp.role_id = r.id
        AND rp.permission_id = p.id
  );
