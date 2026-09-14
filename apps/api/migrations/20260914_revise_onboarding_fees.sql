-- Lower assisted go-live fees after sales feedback: Basic 700 / Standard 1300 / Premium 2000.
-- Does not rewrite existing onboarding_quote_lines (amounts are snapshotted at quote time).

UPDATE billing_catalog_items
SET amount_ghs = 700,
    updated_at = now()
WHERE code = 'onboarding_basic';

UPDATE billing_catalog_items
SET amount_ghs = 1300,
    updated_at = now()
WHERE code = 'onboarding_standard';

UPDATE billing_catalog_items
SET amount_ghs = 2000,
    updated_at = now()
WHERE code = 'onboarding_premium';
