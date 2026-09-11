-- purchases.view_all mirrors sales.view_all so admins/agents see tenant-wide
-- purchase lists (seeded demo purchases use the owner as receiver_id).
-- Idempotent.

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text,
       'purchases.view_all',
       'View all purchases',
       'View all tenant purchases (not only own receipts)',
       now()
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE lower(code) = 'purchases.view_all'
);

-- Explicit grant for Super Admin / Owner style roles (API Super Admin shortcut
-- also picks up the new code automatically once the permissions row exists).
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid()::text, r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE lower(trim(r.name)) IN ('super admin', 'owner', 'admin', 'administrator')
  AND p.code = 'purchases.view_all'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
