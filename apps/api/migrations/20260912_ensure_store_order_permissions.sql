-- Ensure store-order permission rows exist so Super Admin shortcut (/users/me)
-- and role_permissions grants can include Online Orders. Idempotent.

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, v.code, v.name, v.description, now()
FROM (
    VALUES
        ('orders.status.update', 'Update order status', 'Advance order status within workflow rules'),
        ('orders.process', 'Process orders', 'Process in-store order workflow'),
        ('orders.store.view', 'View store orders', 'View orders for assigned store queue'),
        ('orders.store.manage', 'Manage store orders', 'Manage assigned store queue operations'),
        ('orders.delivery.view', 'View order deliveries', 'View delivery details and dispatch info'),
        ('orders.delivery.manage', 'Manage order deliveries', 'Assign couriers and update delivery details'),
        ('orders.fulfillment.assign', 'Assign order fulfillment', 'Set pickup/delivery and store handling details'),
        ('orders.export', 'Export orders', 'Export order list and analytics'),
        ('orders.analytics.view', 'View order analytics', 'View order analytics and KPIs'),
        ('orders.automation.manage', 'Manage order automation', 'Manage order automation and SLA flows'),
        ('orders.multi_store.manage', 'Manage multi-store orders', 'Operate orders across multiple stores')
) AS v(code, name, description)
WHERE NOT EXISTS (
    SELECT 1 FROM permissions p WHERE lower(p.code) = lower(v.code)
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
