-- Ready-made staff roles for existing shops (new shops get them at sign-up via
-- seedDefaultStaffRolesService). Generated from src/constants/defaultRoles.js.

INSERT INTO roles (id, name, description, tenant_id, created_at)
SELECT gen_random_uuid()::text, 'Manager', 'Runs the shop day to day: stock, purchases, suppliers, expenses and reports.', t.id, now()
FROM tenants t
WHERE EXISTS (SELECT 1 FROM roles sa WHERE sa.tenant_id = t.id AND lower(sa.name) = 'super admin')
  AND NOT EXISTS (SELECT 1 FROM roles r WHERE r.tenant_id = t.id AND lower(r.name) = lower('Manager'));

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid()::text, r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('dashboard.view', 'profile.view', 'profile.update', 'products.view', 'products.by_category.view', 'inventory.view', 'categories.view', 'customers.view', 'customers.create', 'customers.details.view', 'sales.view', 'sales.create', 'sales.details.view', 'sales.share_receipt', 'sales.pending.view', 'sales.pending.retry', 'returns.view', 'returns.create', 'returns.details.view', 'sales.view_all', 'sales.by_date.view', 'sales.daily_summary.view', 'sales.return.create', 'products.create', 'products.update', 'products.update_images', 'products.change_price', 'products.toggle_status', 'products.transactions.view', 'categories.create', 'categories.update', 'customers.update', 'customers.sales.view', 'customers.payments.view', 'purchases.view', 'purchases.view_all', 'purchases.create', 'purchases.details.view', 'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.details.view', 'suppliers.purchases.view', 'expenses.view', 'expenses.create', 'expenses.details.view', 'inventory.low_stock.view', 'inventory.reorder.view', 'inventory.expiring.view', 'adjustments.view', 'adjustments.create', 'adjustments.details.view', 'stock_counts.view', 'stock_counts.create', 'stock_counts.details.view', 'transfers.view', 'transfers.create', 'transfers.receive', 'transfers.details.view', 'reports.view', 'payments.view', 'payments.initiate')
WHERE lower(r.name) = lower('Manager')
  AND r.tenant_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id);

INSERT INTO roles (id, name, description, tenant_id, created_at)
SELECT gen_random_uuid()::text, 'Cashier', 'Sells at the counter and serves customers.', t.id, now()
FROM tenants t
WHERE EXISTS (SELECT 1 FROM roles sa WHERE sa.tenant_id = t.id AND lower(sa.name) = 'super admin')
  AND NOT EXISTS (SELECT 1 FROM roles r WHERE r.tenant_id = t.id AND lower(r.name) = lower('Cashier'));

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid()::text, r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('dashboard.view', 'profile.view', 'profile.update', 'products.view', 'products.by_category.view', 'inventory.view', 'categories.view', 'customers.view', 'customers.create', 'customers.details.view', 'sales.view', 'sales.create', 'sales.details.view', 'sales.share_receipt', 'sales.pending.view', 'sales.pending.retry', 'returns.view', 'returns.create', 'returns.details.view')
WHERE lower(r.name) = lower('Cashier')
  AND r.tenant_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id);
