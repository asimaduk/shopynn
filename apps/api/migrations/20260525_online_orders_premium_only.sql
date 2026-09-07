-- Customer online orders (merchant store queue) are Premium-only per docs/PRICING_PACKAGES.md.
-- Run: psql -U postgres -d <your_db> -f migrations/20260525_online_orders_premium_only.sql

DELETE FROM subscription_tier_features stf
USING subscription_tiers t
WHERE stf.tier_id = t.id
  AND lower(t.code) IN ('free', 'basic', 'standard')
  AND lower(stf.feature_code) IN (
    'orders.view',
    'orders.details.view',
    'orders.create',
    'orders.update',
    'orders.cancel',
    'orders.status.update',
    'orders.process',
    'orders.store.view',
    'orders.store.manage',
    'orders.delivery.view',
    'orders.delivery.manage',
    'orders.fulfillment.assign',
    'orders.export',
    'orders.analytics.view',
    'orders.automation.manage',
    'orders.multi_store.manage'
  );
