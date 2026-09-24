-- Competitive packaging: Starter/Business get reports view + CSV/Excel export.
-- Scale keeps advanced data_export / orders export as today.
-- Run: psql ... -f migrations/20260924_starter_business_reports_export.sql

-- Starter (basic): reports.view + reports.export
INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, f.code, now()
FROM subscription_tiers t
CROSS JOIN (
    VALUES
        ('reports.view'),
        ('reports.export')
) AS f(code)
WHERE lower(t.code) = 'basic'
  AND NOT EXISTS (
    SELECT 1
    FROM subscription_tier_features stf
    WHERE stf.tier_id = t.id
      AND lower(stf.feature_code) = lower(f.code)
  );

-- Business (standard): reports.export (reports.view already present)
INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, f.code, now()
FROM subscription_tiers t
CROSS JOIN (
    VALUES
        ('reports.export')
) AS f(code)
WHERE lower(t.code) = 'standard'
  AND NOT EXISTS (
    SELECT 1
    FROM subscription_tier_features stf
    WHERE stf.tier_id = t.id
      AND lower(stf.feature_code) = lower(f.code)
  );
