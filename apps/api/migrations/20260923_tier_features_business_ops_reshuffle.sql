-- Reshuffle tier features (Starter/Business/Scale packaging):
-- 1) stock counts → Standard (Business)
-- 2) notifications → Standard (Business)
-- 3) sales.share_receipt → Basic (Starter)
-- 4) ensure customers/suppliers create+update on Basic (Starter)
-- 5) reports.view stays Standard; reports.export stays Premium (no change)

-- Basic: receipt sharing + customer/supplier write
INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, f.code, now()
FROM subscription_tiers t
CROSS JOIN (
    VALUES
        ('sales.share_receipt'),
        ('customers.create'),
        ('customers.update'),
        ('suppliers.create'),
        ('suppliers.update')
) AS f(code)
WHERE lower(t.code) = 'basic'
  AND NOT EXISTS (
    SELECT 1
    FROM subscription_tier_features stf
    WHERE stf.tier_id = t.id
      AND lower(stf.feature_code) = lower(f.code)
  );

-- Standard: stock counts + notifications (moved down from Premium-only)
INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, f.code, now()
FROM subscription_tiers t
CROSS JOIN (
    VALUES
        ('stock_counts.view'),
        ('stock_counts.details.view'),
        ('stock_counts.create'),
        ('notifications.view'),
        ('notifications.mark_read'),
        ('notifications.settings.view'),
        ('notifications.settings.update'),
        ('notifications.push.send')
) AS f(code)
WHERE lower(t.code) = 'standard'
  AND NOT EXISTS (
    SELECT 1
    FROM subscription_tier_features stf
    WHERE stf.tier_id = t.id
      AND lower(stf.feature_code) = lower(f.code)
  );
