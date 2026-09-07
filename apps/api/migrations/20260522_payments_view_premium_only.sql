-- Order payment history (Order Payments nav + GET /payments/*): Premium tier only.
-- Free/Basic/Standard keep payments.initiate / payments.verify for subscription checkout.

DELETE FROM subscription_tier_features stf
USING subscription_tiers t
WHERE stf.tier_id = t.id
  AND lower(t.code) <> 'premium'
  AND lower(stf.feature_code) = 'payments.view';
