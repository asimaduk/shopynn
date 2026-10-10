-- Free tier: re-assert product create/edit (databases seeded from alt.sql missed 20260524).
-- Without these, new Free owners cannot add their first product.

INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, f.code, now()
FROM subscription_tiers t
CROSS JOIN (
    VALUES
        ('products.create'),
        ('products.update')
) AS f(code)
WHERE lower(t.code) = 'free'
  AND NOT EXISTS (
    SELECT 1
    FROM subscription_tier_features stf
    WHERE stf.tier_id = t.id
      AND lower(stf.feature_code) = lower(f.code)
  );
