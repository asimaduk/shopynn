-- Ensure billing-admin roles can open subscription checkout after EC2 restores
-- that omit subscription.view / payments.initiate from role_permissions.
-- Idempotent.

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid()::text, r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE lower(trim(r.name)) IN ('super admin', 'owner', 'admin', 'administrator')
  AND p.code IN (
      'subscription.view',
      'payments.initiate',
      'payments.verify'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM role_permissions rp
      WHERE rp.role_id = r.id
        AND rp.permission_id = p.id
  );
