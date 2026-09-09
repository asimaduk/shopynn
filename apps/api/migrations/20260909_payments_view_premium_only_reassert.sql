-- Re-assert: payments.view (Order Payments / Settlements) is Premium-only.
-- Idempotent. Needed after EC2 data-only restores that reintroduce old tier feature rows.

DELETE FROM subscription_tier_features stf
USING subscription_tiers t
WHERE stf.tier_id = t.id
  AND lower(t.code) <> 'premium'
  AND lower(stf.feature_code) = 'payments.view';
