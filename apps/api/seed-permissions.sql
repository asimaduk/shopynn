-- Seed default permissions. Run after schema. Use UUIDs or generate in app.
-- Example: insert permissions that can be assigned to roles.
INSERT INTO permissions (id, code, name, description, created_at) VALUES
  -- Auth / Profile
(gen_random_uuid()::text, 'profile.view', 'View profile', 'View own profile', now()),
(gen_random_uuid()::text, 'profile.update', 'Update profile', 'Edit own profile details', now()),
(gen_random_uuid()::text, 'auth.reset_password', 'Reset password', 'Reset own password', now()),

-- Dashboard
(gen_random_uuid()::text, 'dashboard.view', 'View dashboard', 'Access dashboard metrics and widgets', now()),

-- Inventory (stock summary, low stock, expiring, reorder)
(gen_random_uuid()::text, 'inventory.view', 'View inventory', 'View inventory list and stock summary', now()),
(gen_random_uuid()::text, 'inventory.low_stock.view', 'View low stock', 'View low stock items', now()),
(gen_random_uuid()::text, 'inventory.low_stock.alerts', 'Minimum stock email alerts', 'Receive email when inventory falls to minimum level', now()),
(gen_random_uuid()::text, 'inventory.expiring.view', 'View expiring items', 'View expiring soon items', now()),
(gen_random_uuid()::text, 'inventory.reorder.view', 'View reorder list', 'View items to reorder', now()),

-- Products
(gen_random_uuid()::text, 'products.view', 'View products', 'List and view products', now()),
(gen_random_uuid()::text, 'products.create', 'Create products', 'Create new products', now()),
(gen_random_uuid()::text, 'products.update', 'Update products', 'Edit product details', now()),
(gen_random_uuid()::text, 'products.delete', 'Delete products', 'Delete products', now()),
(gen_random_uuid()::text, 'products.change_price', 'Change product price', 'Change unit/alt price', now()),
(gen_random_uuid()::text, 'products.toggle_status', 'Toggle product status', 'Activate/deactivate products', now()),
(gen_random_uuid()::text, 'products.update_images', 'Update product images', 'Upload/update product images', now()),
(gen_random_uuid()::text, 'products.import', 'Import products', 'Import products from file', now()),
(gen_random_uuid()::text, 'products.export', 'Export products', 'Export products data', now()),
(gen_random_uuid()::text, 'products.transactions.view', 'View product transactions', 'View product transaction history', now()),
(gen_random_uuid()::text, 'products.by_category.view', 'View products by category', 'Browse products by category', now()),

-- Categories
(gen_random_uuid()::text, 'categories.view', 'View categories', 'List and view product categories', now()),
(gen_random_uuid()::text, 'categories.create', 'Create categories', 'Create product categories', now()),
(gen_random_uuid()::text, 'categories.update', 'Update categories', 'Edit product categories', now()),
(gen_random_uuid()::text, 'categories.delete', 'Delete categories', 'Delete product categories', now()),
(gen_random_uuid()::text, 'categories.toggle_status', 'Toggle category status', 'Enable/disable categories', now()),

-- Warehouses / Stores
(gen_random_uuid()::text, 'warehouses.view', 'View warehouses', 'List and view warehouses/stores', now()),
(gen_random_uuid()::text, 'warehouses.create', 'Create warehouses', 'Create warehouses/stores', now()),
(gen_random_uuid()::text, 'warehouses.update', 'Update warehouses', 'Edit warehouses/stores', now()),
(gen_random_uuid()::text, 'warehouses.delete', 'Delete warehouses', 'Delete warehouses/stores', now()),

-- Locations (if used)
(gen_random_uuid()::text, 'locations.view', 'View locations', 'List and view locations', now()),
(gen_random_uuid()::text, 'locations.create', 'Create locations', 'Create locations', now()),
(gen_random_uuid()::text, 'locations.update', 'Update locations', 'Edit locations', now()),

-- Sales
(gen_random_uuid()::text, 'sales.view', 'View sales', 'List and view sales', now()),
(gen_random_uuid()::text, 'sales.view_all', 'View all sales', 'View all tenant sales (not only own sales)', now()),
(gen_random_uuid()::text, 'sales.details.view', 'View sale details', 'View sale details screen', now()),
(gen_random_uuid()::text, 'sales.create', 'Create sales', 'Create new sale', now()),
(gen_random_uuid()::text, 'sales.return.create', 'Create sale return', 'Create sales returns', now()),
(gen_random_uuid()::text, 'sales.pending.view', 'View pending sales', 'View pending sales upload queue', now()),
(gen_random_uuid()::text, 'sales.pending.retry', 'Retry pending sales', 'Retry uploading pending sales', now()),
(gen_random_uuid()::text, 'sales.daily_summary.view', 'View daily sales summary', 'View daily sales summary chart', now()),
(gen_random_uuid()::text, 'sales.by_date.view', 'View sales by date', 'View sales list filtered by a specific date', now()),
(gen_random_uuid()::text, 'sales.share_receipt', 'Share receipt', 'Share/print sales receipt', now()),

-- Purchases
(gen_random_uuid()::text, 'purchases.view', 'View purchases', 'List and view purchases', now()),
(gen_random_uuid()::text, 'purchases.details.view', 'View purchase details', 'View purchase details screen', now()),
(gen_random_uuid()::text, 'purchases.create', 'Create purchases', 'Create new purchase', now()),
(gen_random_uuid()::text, 'purchases.return.create', 'Create purchase return', 'Create purchase returns', now()),
(gen_random_uuid()::text, 'purchase_orders.view', 'View purchase orders', 'List and view purchase orders', now()),
(gen_random_uuid()::text, 'purchase_orders.create', 'Create purchase orders', 'Create purchase orders', now()),
(gen_random_uuid()::text, 'purchase_orders.receive', 'Receive against PO', 'Receive stock against purchase order', now()),

-- Orders (customer/store ordering module)
(gen_random_uuid()::text, 'orders.view', 'View orders', 'List orders visible to current store scope', now()),
(gen_random_uuid()::text, 'orders.details.view', 'View order details', 'View a specific order', now()),
(gen_random_uuid()::text, 'orders.create', 'Create orders', 'Create customer orders', now()),
(gen_random_uuid()::text, 'orders.update', 'Update orders', 'Edit order items before processing', now()),
(gen_random_uuid()::text, 'orders.cancel', 'Cancel orders', 'Cancel pending or confirmed orders', now()),
(gen_random_uuid()::text, 'orders.status.update', 'Update order status', 'Advance order status within workflow rules', now()),
(gen_random_uuid()::text, 'orders.process', 'Process orders', 'Process in-store order workflow', now()),
(gen_random_uuid()::text, 'orders.store.view', 'View store orders', 'View orders for assigned store queue', now()),
(gen_random_uuid()::text, 'orders.store.manage', 'Manage store orders', 'Manage assigned store queue operations', now()),
(gen_random_uuid()::text, 'orders.delivery.view', 'View order deliveries', 'View delivery details and dispatch info', now()),
(gen_random_uuid()::text, 'orders.delivery.manage', 'Manage order deliveries', 'Assign couriers and update delivery details', now()),
(gen_random_uuid()::text, 'orders.fulfillment.assign', 'Assign order fulfillment', 'Set pickup/delivery and store handling details', now()),
(gen_random_uuid()::text, 'orders.export', 'Export orders', 'Export order list and analytics', now()),
(gen_random_uuid()::text, 'orders.analytics.view', 'View order analytics', 'View order analytics and KPIs', now()),
(gen_random_uuid()::text, 'orders.automation.manage', 'Manage order automation', 'Manage order automation and SLA flows', now()),

-- Transfers
(gen_random_uuid()::text, 'transfers.view', 'View transfers', 'List and view stock transfers', now()),
(gen_random_uuid()::text, 'transfers.details.view', 'View transfer details', 'View transfer details screen', now()),
(gen_random_uuid()::text, 'transfers.create', 'Create transfers', 'Create new stock transfer', now()),

-- Adjustments
(gen_random_uuid()::text, 'adjustments.view', 'View adjustments', 'List and view stock adjustments', now()),
(gen_random_uuid()::text, 'adjustments.details.view', 'View adjustment details', 'View adjustment details screen', now()),
(gen_random_uuid()::text, 'adjustments.create', 'Create adjustments', 'Create new stock adjustment', now()),

-- Stock count / audit
(gen_random_uuid()::text, 'stock_counts.view', 'View stock counts', 'View stock count history', now()),
(gen_random_uuid()::text, 'stock_counts.details.view', 'View stock count details', 'View stock count details screen', now()),
(gen_random_uuid()::text, 'stock_counts.create', 'Create stock count', 'Submit stock count', now()),

-- Returns (generic)
(gen_random_uuid()::text, 'returns.view', 'View returns', 'List and view returns', now()),
(gen_random_uuid()::text, 'returns.details.view', 'View return details', 'View return details screen', now()),
(gen_random_uuid()::text, 'returns.create', 'Create returns', 'Create a return record', now()),

-- Customers
(gen_random_uuid()::text, 'customers.view', 'View customers', 'List and view customers', now()),
(gen_random_uuid()::text, 'customers.details.view', 'View customer details', 'View customer details screen', now()),
(gen_random_uuid()::text, 'customers.create', 'Create customers', 'Create new customers', now()),
(gen_random_uuid()::text, 'customers.update', 'Update customers', 'Edit customer details', now()),
(gen_random_uuid()::text, 'customers.delete', 'Delete customers', 'Delete customers', now()),
(gen_random_uuid()::text, 'customers.sales.view', 'View customer sales', 'View sales for a customer', now()),
(gen_random_uuid()::text, 'customers.payments.view', 'View customer payments', 'View payments for a customer', now()),
(gen_random_uuid()::text, 'customers.payments.details.view', 'View customer payment details', 'View a customer payment record', now()),

-- Suppliers
(gen_random_uuid()::text, 'suppliers.view', 'View suppliers', 'List and view suppliers', now()),
(gen_random_uuid()::text, 'suppliers.details.view', 'View supplier details', 'View supplier details screen', now()),
(gen_random_uuid()::text, 'suppliers.create', 'Create suppliers', 'Create new suppliers', now()),
(gen_random_uuid()::text, 'suppliers.update', 'Update suppliers', 'Edit supplier details', now()),
(gen_random_uuid()::text, 'suppliers.purchases.view', 'View supplier supplies', 'View purchases/supplies for a supplier', now()),

-- Expenses / Expenditures
(gen_random_uuid()::text, 'expenses.view', 'View expenses', 'List and view expenditures', now()),
(gen_random_uuid()::text, 'expenses.details.view', 'View expense details', 'View expenditure details screen', now()),
(gen_random_uuid()::text, 'expenses.create', 'Create expenses', 'Create a new expenditure', now()),
(gen_random_uuid()::text, 'expenses.update', 'Update expenses', 'Edit an expenditure', now()),

-- Reports
(gen_random_uuid()::text, 'reports.view', 'View reports', 'Access reports list and report screens', now()),
(gen_random_uuid()::text, 'reports.export', 'Export reports', 'Export report data (CSV/PDF/Share)', now()),

-- Audit logs
(gen_random_uuid()::text, 'audit_logs.view', 'View audit logs', 'List and view audit logs', now()),
(gen_random_uuid()::text, 'audit_logs.details.view', 'View audit log details', 'View a single audit log detail record', now()),

-- Users / Roles / Permissions (Administration)
(gen_random_uuid()::text, 'users.view', 'View users', 'List and view users', now()),
(gen_random_uuid()::text, 'users.details.view', 'View user details', 'View user details screen', now()),
(gen_random_uuid()::text, 'users.create', 'Create users', 'Create new users', now()),
(gen_random_uuid()::text, 'users.update', 'Update users', 'Edit users', now()),
(gen_random_uuid()::text, 'users.delete', 'Delete users', 'Delete/deactivate users', now()),
(gen_random_uuid()::text, 'users.toggle_active', 'Toggle user active', 'Enable/disable users', now()),
(gen_random_uuid()::text, 'roles.view', 'View roles', 'List and view roles', now()),
(gen_random_uuid()::text, 'roles.create', 'Create roles', 'Create new roles', now()),
(gen_random_uuid()::text, 'roles.update', 'Update roles', 'Edit roles', now()),
(gen_random_uuid()::text, 'roles.delete', 'Delete roles', 'Delete roles', now()),
(gen_random_uuid()::text, 'permissions.view', 'View permissions', 'List and view permissions', now()),

-- Notifications
(gen_random_uuid()::text, 'notifications.view', 'View notifications', 'View notifications screen', now()),
(gen_random_uuid()::text, 'notifications.mark_read', 'Mark notifications read', 'Mark one/all notifications as read', now()),
(gen_random_uuid()::text, 'notifications.settings.view', 'View notification settings', 'View notification preferences', now()),
(gen_random_uuid()::text, 'notifications.settings.update', 'Update notification settings', 'Update notification preferences', now()),
(gen_random_uuid()::text, 'notifications.push.send', 'Send push notifications', 'Send push notifications (admin/system)', now()),

-- Company / Tenant settings
(gen_random_uuid()::text, 'company_profile.view', 'View company profile', 'View company/tenant profile', now()),
(gen_random_uuid()::text, 'company_profile.update', 'Update company profile', 'Update company/tenant profile', now()),

-- Invoice / Receipt settings
(gen_random_uuid()::text, 'receipt_settings.view', 'View receipt settings', 'View invoice/receipt settings', now()),
(gen_random_uuid()::text, 'receipt_settings.update', 'Update receipt settings', 'Update invoice/receipt settings', now()),

-- Data export / backup
(gen_random_uuid()::text, 'data_export.view', 'View data export', 'Access data export/backup screen', now()),
(gen_random_uuid()::text, 'data_export.run', 'Run data export', 'Export/backup data', now()),

-- Subscription / Payments
(gen_random_uuid()::text, 'subscription.view', 'View subscription', 'View subscription status', now()),
(gen_random_uuid()::text, 'payments.view', 'View payments', 'View payment history and invoices', now()),
(gen_random_uuid()::text, 'payments.initiate', 'Initiate payment', 'Start a subscription payment', now()),
(gen_random_uuid()::text, 'payments.verify', 'Verify payment', 'Verify payment reference/status', now()),

-- Merchant partners
(gen_random_uuid()::text, 'merchants.view', 'View merchant admin', 'Register merchants and manage partner admin', now()),
(gen_random_uuid()::text, 'merchants.operate', 'Merchant partner operations', 'Onboard linked businesses and view own commissions', now()),

-- Platform / directory (all tenants)
(gen_random_uuid()::text, 'tenants.directory.view', 'View tenant directory', 'List all businesses (tenants), subscriptions, and related details', now()),
(gen_random_uuid()::text, 'newsletter.subscribers.view', 'View newsletter subscribers', 'List marketing newsletter subscribers', now()),
(gen_random_uuid()::text, 'newsletter.campaigns.view', 'View newsletters', 'List sent and draft marketing newsletters', now()),
(gen_random_uuid()::text, 'newsletter.campaigns.send', 'Send newsletters', 'Create and send marketing newsletters', now()),
(gen_random_uuid()::text, 'broadcasts.send', 'Send platform broadcasts', 'Broadcast push, email, and SMS messages to Shopynn users', now()),
(gen_random_uuid()::text, 'contact_requests.view', 'View contact requests', 'List Talk to us submissions from the public site', now()),
(gen_random_uuid()::text, 'contact_requests.respond', 'Respond to contact requests', 'Reply to Talk to us messages by email', now()),
-- Premium-tier platform marketing (see subscription_tier_features: excluded from Free/Basic/Standard)
(gen_random_uuid()::text, 'site_chat.sessions.view', 'View site chat sessions', 'List live chat conversations from the marketing site (Premium)', now()),
(gen_random_uuid()::text, 'site_chat.sessions.respond', 'Respond to site chat', 'Reply to marketing site live chat messages (Premium)', now()),
(gen_random_uuid()::text, 'stores.multi_access', 'Multi-store access', 'Access multiple stores/warehouses', now()),
(gen_random_uuid()::text, 'orders.multi_store.manage', 'Manage multi-store order routing', 'Manage customer and staff order access across stores', now())
ON CONFLICT (code) DO NOTHING;

-- Compatibility aliases used by some clients/screens
INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'settings.view', 'View settings', 'Access settings areas', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'settings.view');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'users.roles.view', 'View roles (legacy alias)', 'Legacy alias for roles view access', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'users.roles.view');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'audit.view', 'View audit logs (legacy alias)', 'Legacy alias for audit log access', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'audit.view');

-- Subscription tiers and feature mapping (Phase 1 core gates)
INSERT INTO subscription_tiers (id, code, name, description, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'free', 'Free', 'Entry plan', now(), now()),
  (gen_random_uuid()::text, 'basic', 'Basic', 'Starter paid tier', now(), now()),
  (gen_random_uuid()::text, 'standard', 'Standard', 'Growth tier', now(), now()),
  (gen_random_uuid()::text, 'premium', 'Premium', 'Full access tier', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, p.feature_code, now()
FROM subscription_tiers t
JOIN (
    SELECT lower(code) AS feature_code
    FROM permissions
) p ON (
    -- Free: strict starter allowlist only
    (
        lower(t.code) = 'free'
        AND p.feature_code IN (
            'profile.view',
            'profile.update',
            'auth.reset_password',
            'dashboard.view',
            'inventory.view',
            'products.view',
            'products.create',
            'products.update',
            'categories.view',
            'sales.view',
            'sales.create',
            'purchases.view',
            'purchases.create',
            'customers.view',
            'suppliers.view',
            'company_profile.view',
            'subscription.view',
            'payments.initiate',
            'payments.verify'
        )
    )
    OR
    -- Basic: single-store operations with core reporting and admin basics
    (
        lower(t.code) = 'basic'
        AND p.feature_code NOT IN (
            'stores.multi_access',
            'reports.view',
            'reports.export',
            'sales.share_receipt',
            'inventory.reorder.view',
            'inventory.expiring.view',
            'transfers.view',
            'transfers.details.view',
            'transfers.create',
            'adjustments.view',
            'adjustments.details.view',
            'adjustments.create',
            'roles.view',
            'roles.create',
            'roles.update',
            'roles.delete',
            'permissions.view',
            'users.roles.view',
            'locations.view',
            'locations.create',
            'locations.update',
            'stock_counts.view',
            'stock_counts.details.view',
            'stock_counts.create',
            'notifications.view',
            'notifications.mark_read',
            'notifications.settings.view',
            'notifications.settings.update',
            'notifications.push.send',
            'audit_logs.view',
            'audit_logs.details.view',
            'audit.view',
            'purchase_orders.create',
            'purchase_orders.receive',
            'orders.view',
            'orders.details.view',
            'orders.create',
            'orders.update',
            'orders.cancel',
            'orders.status.update',
            'orders.process',
            'orders.store.view',
            'orders.delivery.view',
            'orders.delivery.manage',
            'orders.fulfillment.assign',
            'orders.export',
            'orders.store.manage',
            'orders.analytics.view',
            'orders.automation.manage',
            'orders.multi_store.manage',
            'data_export.run',
            'merchants.view',
            'merchants.operate',
            'tenants.directory.view',
            'newsletter.subscribers.view',
            'newsletter.campaigns.view',
            'newsletter.campaigns.send',
            'broadcasts.send',
            'contact_requests.view',
            'contact_requests.respond',
            'site_chat.sessions.view',
            'site_chat.sessions.respond',
            'payments.view'
        )
    )
    OR
    -- Standard: adds multi-store, receipt sharing, and purchase-order workflows
    (
        lower(t.code) = 'standard'
        AND p.feature_code NOT IN (
            'reports.export',
            'orders.view',
            'orders.details.view',
            'orders.create',
            'orders.update',
            'orders.cancel',
            'orders.status.update',
            'orders.process',
            'orders.store.view',
            'orders.delivery.view',
            'orders.delivery.manage',
            'orders.fulfillment.assign',
            'orders.export',
            'orders.store.manage',
            'orders.analytics.view',
            'orders.automation.manage',
            'orders.multi_store.manage',
            'data_export.run',
            'stock_counts.view',
            'stock_counts.details.view',
            'stock_counts.create',
            'notifications.view',
            'notifications.mark_read',
            'notifications.settings.view',
            'notifications.settings.update',
            'notifications.push.send',
            'audit_logs.view',
            'audit_logs.details.view',
            'audit.view',
            'merchants.view',
            'merchants.operate',
            'tenants.directory.view',
            'newsletter.subscribers.view',
            'newsletter.campaigns.view',
            'newsletter.campaigns.send',
            'broadcasts.send',
            'contact_requests.view',
            'contact_requests.respond',
            'site_chat.sessions.view',
            'site_chat.sessions.respond',
            'payments.view'
        )
    )
    OR
    -- Premium: full platform access
    lower(t.code) = 'premium'
)
ON CONFLICT (tier_id, feature_code) DO NOTHING;
