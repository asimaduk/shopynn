-- Lower Starter assisted go-live: Basic 500 / Standard 1300 / Premium 2000.
-- Does not rewrite existing onboarding_quote_lines (amounts are snapshotted at quote time).

UPDATE billing_catalog_items
SET amount_ghs = 500,
    updated_at = now()
WHERE code = 'onboarding_basic';
