-- Idempotent follow-up: Super Admin roles often missed store-order permission rows
-- after EC2 restores (API auth uses a Super Admin shortcut; /users/me reads role_permissions).
-- Grant the same store-order codes as 20260909_online_orders_nav_entitlements.sql.

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid()::text, r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE lower(trim(r.name)) = 'super admin'
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
