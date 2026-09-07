-- Free tier: allow creating/editing products (inventory FAB on mobile + POST /products).
-- Run: psql -U postgres -d <your_db> -f migrations/20260524_free_tier_products_create.sql

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
