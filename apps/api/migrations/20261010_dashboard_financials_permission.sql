-- Dashboard money cards (purchases, expenses, stock valuation, profit) are shop-wide, so they
-- get their own permission. Cashiers keep the dashboard but no longer see shop finances.

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'dashboard.financials.view', 'View dashboard finances',
       'See purchases, expenses, stock value and profit on the dashboard', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'dashboard.financials.view');

INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, 'dashboard.financials.view', now()
FROM subscription_tiers t
WHERE lower(t.code) IN ('free', 'basic', 'standard', 'premium')
  AND NOT EXISTS (
    SELECT 1 FROM subscription_tier_features stf
    WHERE stf.tier_id = t.id AND lower(stf.feature_code) = 'dashboard.financials.view'
  );

-- Existing roles that can open the dashboard keep seeing finances, except Cashier and Customer.
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid()::text, r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'dashboard.financials.view'
WHERE r.tenant_id IS NOT NULL
  AND lower(r.name) NOT IN ('cashier', 'customer', 'super admin')
  AND EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN permissions dp ON dp.id = rp.permission_id
    WHERE rp.role_id = r.id AND dp.code = 'dashboard.view'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
