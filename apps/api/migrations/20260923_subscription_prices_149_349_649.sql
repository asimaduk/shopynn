-- Monthly subscription catalog: Basic 149, Standard 349, Premium 649 (GHS).
-- Existing tenant subscription rows keep their historical amount until renew/upgrade.

UPDATE billing_catalog_items
SET amount_ghs = 149, updated_at = NOW()
WHERE code = 'plan_basic_monthly' AND item_type = 'subscription_monthly';

UPDATE billing_catalog_items
SET amount_ghs = 349, updated_at = NOW()
WHERE code = 'plan_standard_monthly' AND item_type = 'subscription_monthly';

UPDATE billing_catalog_items
SET amount_ghs = 649, updated_at = NOW()
WHERE code = 'plan_premium_monthly' AND item_type = 'subscription_monthly';
