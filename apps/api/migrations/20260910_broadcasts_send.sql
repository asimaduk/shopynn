-- Platform broadcast (push / email / SMS) for operators with directory access.

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text,
       'broadcasts.send',
       'Send platform broadcasts',
       'Broadcast push, email, and SMS messages to Shopynn users',
       now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'broadcasts.send');

-- Premium tier includes platform features (same pattern as newsletter.*).
INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, 'broadcasts.send', now()
FROM subscription_tiers t
WHERE lower(t.code) = 'premium'
  AND NOT EXISTS (
      SELECT 1 FROM subscription_tier_features stf
      WHERE stf.tier_id = t.id AND stf.feature_code = 'broadcasts.send'
  );

-- Grant to roles that already operate the tenant directory (platform operators).
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid()::text, rp.role_id, p_new.id
FROM role_permissions rp
JOIN permissions p_dir ON p_dir.id = rp.permission_id AND p_dir.code = 'tenants.directory.view'
JOIN permissions p_new ON p_new.code = 'broadcasts.send'
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions existing
    WHERE existing.role_id = rp.role_id AND existing.permission_id = p_new.id
);

-- Never leave broadcasts.send on ordinary tenant Super Admin / Owner / Admin roles
-- that do not also hold tenants.directory.view (platform operator signal).
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.tenant_id IS NOT NULL
  AND lower(trim(r.name)) IN ('super admin', 'owner', 'admin', 'administrator')
  AND p.code = 'broadcasts.send'
  AND NOT EXISTS (
      SELECT 1
      FROM role_permissions rp2
      JOIN permissions p2 ON p2.id = rp2.permission_id
      WHERE rp2.role_id = r.id
        AND p2.code = 'tenants.directory.view'
  );
