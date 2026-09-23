-- Marketing names: Starter / Business / Scale (plan_tier codes unchanged).
UPDATE billing_catalog_items SET label = 'Starter monthly', updated_at = NOW()
WHERE code = 'plan_basic_monthly';

UPDATE billing_catalog_items SET label = 'Business monthly', updated_at = NOW()
WHERE code = 'plan_standard_monthly';

UPDATE billing_catalog_items SET label = 'Scale monthly', updated_at = NOW()
WHERE code = 'plan_premium_monthly';
