-- Re-assert staff and role management on paid tiers. Databases seeded from alt.sql had no
-- users.* permissions when tier features were generated, so 20260527 inserted nothing and
-- Starter owners got "Feature unavailable" when adding staff.

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, p.code, p.name, p.description, now()
FROM (
    VALUES
        ('users.view', 'View users', 'View users'),
        ('users.details.view', 'View user details', 'View user details'),
        ('users.create', 'Create users', 'Create new users'),
        ('users.update', 'Update users', 'Update users'),
        ('users.delete', 'Delete users', 'Delete users'),
        ('users.toggle_active', 'Activate/deactivate users', 'Activate or deactivate users'),
        ('roles.view', 'View roles', 'View roles'),
        ('roles.create', 'Create roles', 'Create roles'),
        ('roles.update', 'Update roles', 'Update roles'),
        ('roles.delete', 'Delete roles', 'Delete roles'),
        ('permissions.view', 'View permissions', 'View permissions'),
        ('users.roles.view', 'View user roles', 'View user roles')
) AS p(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE lower(code) = p.code);

-- Staff management: Starter, Business, Scale
INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, f.code, now()
FROM subscription_tiers t
CROSS JOIN (
    VALUES
        ('users.view'),
        ('users.details.view'),
        ('users.create'),
        ('users.update'),
        ('users.delete'),
        ('users.toggle_active')
) AS f(code)
WHERE lower(t.code) IN ('basic', 'standard', 'premium')
  AND NOT EXISTS (
    SELECT 1
    FROM subscription_tier_features stf
    WHERE stf.tier_id = t.id
      AND lower(stf.feature_code) = lower(f.code)
  );

-- Custom roles: Business, Scale
INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, f.code, now()
FROM subscription_tiers t
CROSS JOIN (
    VALUES
        ('roles.view'),
        ('roles.create'),
        ('roles.update'),
        ('roles.delete'),
        ('permissions.view'),
        ('users.roles.view')
) AS f(code)
WHERE lower(t.code) IN ('standard', 'premium')
  AND NOT EXISTS (
    SELECT 1
    FROM subscription_tier_features stf
    WHERE stf.tier_id = t.id
      AND lower(stf.feature_code) = lower(f.code)
  );
