-- Basic tier: user management (up to 3 users per plan limits).
-- Run: psql -U postgres -d <your_db> -f migrations/20260527_basic_tier_users_features.sql

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
WHERE lower(t.code) = 'basic'
  AND NOT EXISTS (
    SELECT 1
    FROM subscription_tier_features stf
    WHERE stf.tier_id = t.id
      AND lower(stf.feature_code) = lower(f.code)
  );
