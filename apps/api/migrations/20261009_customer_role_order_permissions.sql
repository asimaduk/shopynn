-- Customer (storefront shopper) roles were created with only notifications.* because the
-- customer order permission rows were missing, so customers saw no Home / Cart / My Orders.
-- Ensure the codes exist, then grant the full customer-portal set to every Customer role. Idempotent.

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, v.code, v.name, v.description, now()
FROM (
    VALUES
        ('orders.view', 'View orders', 'View own customer orders'),
        ('orders.create', 'Create orders', 'Create customer orders'),
        ('orders.details.view', 'View order details', 'View customer order details'),
        ('orders.cancel', 'Cancel orders', 'Cancel own customer orders'),
        ('notifications.view', 'View notifications', 'View notifications'),
        ('notifications.mark_read', 'Mark notifications read', 'Mark notifications as read')
) AS v(code, name, description)
WHERE NOT EXISTS (
    SELECT 1 FROM permissions p WHERE lower(p.code) = lower(v.code)
);

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid()::text, r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE lower(trim(r.name)) = 'customer'
  AND p.code IN (
      'orders.view',
      'orders.create',
      'orders.details.view',
      'orders.cancel',
      'notifications.view',
      'notifications.mark_read'
  )
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
