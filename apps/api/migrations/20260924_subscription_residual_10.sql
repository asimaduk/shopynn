-- Raise subscription residual commission tag to 10% (rate is enforced in app code).
-- Run: psql ... -f migrations/20260924_subscription_residual_10.sql

UPDATE billing_catalog_items
SET commission_eligible = 'subscription_residual_10',
    updated_at = now()
WHERE item_type = 'subscription_monthly'
  AND commission_eligible IN (
      'subscription_residual_5',
      'subscription_residual_10',
      'subscription_first_month_10'
  );
