-- alter table tenants add column phone varchar(10) unique;
-- ALTER TABLE users
-- ADD CONSTRAINT UQ_Emails UNIQUE (email),
-- ADD CONSTRAINT UQ_Phones UNIQUE (phone),
-- ADD CONSTRAINT UQ_Usernames UNIQUE (username);

-- ALTER TABLE inventories ADD COLUMN batch_number varchar(100);
-- ALTER TABLE inventories ADD COLUMN serial_number varchar(100);

-- ALTER TABLE adjustments ADD COLUMN creator_id varchar(40) references users(id);
-- ALTER TABLE adjustmentdetails ADD COLUMN adjustment_type varchar(20);

-- users: remove username, add fcm_token (run if table already exists)
-- ALTER TABLE users DROP COLUMN IF EXISTS username;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token varchar(500);

-- users: add password_expires_at (run if table already exists)
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS password_expires_at timestamp;

-- users: add registration_method ('manual' | 'google' | 'facebook' | 'apple' etc.)
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_method varchar(50) DEFAULT 'manual';

-- subscriptions: add missing columns (run if table already exists)
-- ALTER TABLE subscriptions ADD COLUMN description varchar(500);
-- ALTER TABLE subscriptions ADD COLUMN amount decimal(10,2);
-- ALTER TABLE subscriptions ADD COLUMN billing_interval varchar(20);
-- ALTER TABLE subscriptions ADD COLUMN status varchar(20) DEFAULT 'active';
-- ALTER TABLE subscriptions ALTER COLUMN updated_at TYPE timestamp;  -- fix typo if needed

-- adjustmentdetails: add system_quantity (quantity before adjustment)
-- ALTER TABLE adjustmentdetails ADD COLUMN IF NOT EXISTS system_quantity integer;

-- adjustmentdetails: add adjustment_type ('addition' | 'subtraction')
-- ALTER TABLE adjustmentdetails ADD COLUMN IF NOT EXISTS adjustment_type varchar(20);

-- stock_counts: add number_of_items (how many lines/items in the count)
-- ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS number_of_items integer;
-- users: soft-delete columns
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted boolean default false;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamp;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by varchar(40) references users(id);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_reason varchar(255);

-- payments: add payment_number (human-readable receipt/number)
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_number varchar(50);

-- ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted boolean default false;
-- ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at timestamp;
-- ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_by varchar(40) references users(id);
-- ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_reason varchar(255);
-- ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes varchar(300);

-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_number varchar(50);

-- user_preferences (run if table does not exist)
-- create table user_preferences (
--     id varchar(40) primary key,
--     user_id varchar(40) not null unique references users(id) on delete cascade,
--     preferences jsonb default '{}',
--     created_at timestamp,
--     updated_at timestamp
-- );

-- roles and permissions (run if tables do not exist; then run seed-permissions.sql)
-- create table roles (...);
-- create table permissions (...);
-- create table role_permissions (...);
-- create table user_roles (...);
-- create table audit_logs (...);
-- See schema.sql for full definitions.


-- Add industry_id column to tenants table (if not already present)
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS unit varchar(50);

-- expenses: add description and payment_method
-- ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description varchar(255);
-- ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method varchar(50);

-- Create industries table (if it does not exist)
-- CREATE TABLE IF NOT EXISTS industries (
--     id varchar(40) PRIMARY KEY,
--     name varchar(150) UNIQUE,
--     code varchar(50),
--     description varchar(500),
--     product_categorization integer,
--     created_at timestamp,
--     updated_at timestamp
-- );


-- create table categories (
--     id varchar(40) primary key,
--     name varchar(100),
--     description varchar(300),
--     full_picture varchar(40),
--     thumbnail varchar(40),
--     is_active boolean,
--     creator_id varchar(40) references users(id),
--     tenant_id varchar(40) references tenants(id),
--     created_at timestamp,
--     updated_at timestamp
-- );


-- notifications: add description and payment_method
-- ALTER TABLE notifications ADD COLUMN IF NOT EXISTS icon varchar(50);
-- ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link varchar(255);
-- ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_params varchar(255);
-- ALTER TABLE notifications ADD COLUMN IF NOT EXISTS mobile_params jsonb default '{}';
-- ALTER TABLE notifications ADD COLUMN IF NOT EXISTS mobile_screen varchar(50);    
-- ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted boolean default false;
-- ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at timestamp;


-- create table app_versions (
--     id varchar(40) primary key,
--     platform varchar(30) not null, -- ios, android, web
--     latest_version varchar(30) not null,
--     min_supported_version varchar(30) not null,
--     force_update boolean default false,
--     status varchar(20) default 'active', -- active / inactive
--     store_url varchar(300),
--     release_notes varchar(1000),
--     created_at timestamp,
--     updated_at timestamp
-- );

-- alter table warehouses add column if not exists printer_type varchar(20) default 'any';

-- merchants module
-- create table if not exists merchants (
--     id varchar(40) primary key,
--     user_id varchar(40) not null unique references users(id),
--     default_commission_percent decimal(10,4),
--     created_at timestamp,
--     updated_at timestamp
-- );

-- create table if not exists merchant_commissions (
--     id varchar(40) primary key,
--     merchant_id varchar(40) not null references merchants(id),
--     tenant_id varchar(40) not null references tenants(id),
--     subscription_id varchar(40) references subscriptions(id),
--     base_amount decimal(12,2) not null,
--     commission_percent decimal(10,4) not null,
--     commission_amount decimal(12,2) not null,
--     status varchar(20) not null default 'pending',
--     paid_at timestamp,
--     notes varchar(500),
--     created_at timestamp
-- );

-- alter table tenants add column if not exists merchant_id varchar(40) references merchants(id);
-- alter table users add column if not exists merchant_id varchar(40) references merchants(id);

-- Permission: minimum-stock alert emails (assign to admin/ops roles). Safe to re-run.
INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'inventory.low_stock.alerts', 'Minimum stock email alerts', 'Receive email when inventory falls to minimum level', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'inventory.low_stock.alerts');

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

-- Ordering module permissions (safe to re-run)
INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.view', 'View orders', 'List orders visible to current store scope', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.view');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.details.view', 'View order details', 'View a specific order', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.details.view');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.create', 'Create orders', 'Create customer orders', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.create');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.update', 'Update orders', 'Edit order items before processing', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.update');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.cancel', 'Cancel orders', 'Cancel pending or confirmed orders', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.cancel');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.status.update', 'Update order status', 'Advance order status within workflow rules', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.status.update');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.process', 'Process orders', 'Process in-store order workflow', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.process');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.store.view', 'View store orders', 'View orders for assigned store queue', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.store.view');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.store.manage', 'Manage store orders', 'Manage assigned store queue operations', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.store.manage');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.delivery.view', 'View order deliveries', 'View delivery details and dispatch info', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.delivery.view');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.delivery.manage', 'Manage order deliveries', 'Assign couriers and update delivery details', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.delivery.manage');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.fulfillment.assign', 'Assign order fulfillment', 'Set pickup/delivery and store handling details', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.fulfillment.assign');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.export', 'Export orders', 'Export order list and analytics', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.export');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.analytics.view', 'View order analytics', 'View order analytics and KPIs', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.analytics.view');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.automation.manage', 'Manage order automation', 'Manage order automation and SLA flows', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.automation.manage');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'orders.multi_store.manage', 'Manage multi-store order routing', 'Manage customer and staff order access across stores', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'orders.multi_store.manage');

-- Ordering and fabric schema (safe to re-run)
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_reference_code varchar(80);
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type varchar(30) DEFAULT 'standard';
ALTER TABLE products ADD COLUMN IF NOT EXISTS measurement_unit varchar(30) DEFAULT 'units';
ALTER TABLE products ADD COLUMN IF NOT EXISTS allows_fractional_qty boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_order_qty numeric(12,3) DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS qty_step numeric(12,3) DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_price_per_unit decimal(10,2);

CREATE TABLE IF NOT EXISTS warehouse_reference_codes (
    id varchar(40) primary key,
    warehouse_id varchar(40) not null references warehouses(id) on delete cascade,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    reference_code varchar(80) not null,
    created_at timestamp,
    updated_at timestamp,
    is_active boolean default true,
    unique (tenant_id, reference_code)
);

CREATE TABLE IF NOT EXISTS customer_profiles (
    id varchar(40) primary key,
    user_id varchar(40) not null unique references users(id) on delete cascade,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    signup_reference_code varchar(80),
    default_warehouse_id varchar(40) references warehouses(id),
    profile_type varchar(20) default 'customer',
    created_at timestamp,
    updated_at timestamp
);

CREATE TABLE IF NOT EXISTS customer_store_access (
    id varchar(40) primary key,
    customer_profile_id varchar(40) not null references customer_profiles(id) on delete cascade,
    warehouse_id varchar(40) not null references warehouses(id) on delete cascade,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    access_source varchar(20) default 'reference',
    created_at timestamp,
    updated_at timestamp,
    unique (customer_profile_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS user_warehouse_access (
    id varchar(40) primary key,
    user_id varchar(40) not null references users(id) on delete cascade,
    warehouse_id varchar(40) not null references warehouses(id) on delete cascade,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    assigned_role varchar(30),
    created_at timestamp,
    updated_at timestamp,
    unique (user_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id varchar(40) primary key,
    order_number varchar(50) not null unique,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    customer_id varchar(40) references customers(id),
    customer_profile_id varchar(40) references customer_profiles(id),
    warehouse_id varchar(40) not null references warehouses(id),
    status varchar(30) not null default 'pending',
    fulfillment_type varchar(20) not null default 'pickup',
    subtotal_amount decimal(12,2) not null default 0,
    discount_amount decimal(12,2) not null default 0,
    delivery_fee decimal(12,2) not null default 0,
    total_amount decimal(12,2) not null default 0,
    notes varchar(500),
    delivery_address varchar(500),
    expected_at timestamp,
    cancelled_at timestamp,
    cancelled_by varchar(40) references users(id),
    created_by_user_id varchar(40) references users(id),
    created_at timestamp,
    updated_at timestamp
);

CREATE TABLE IF NOT EXISTS order_deliveries (
    id varchar(40) primary key,
    order_id varchar(40) not null unique references orders(id) on delete cascade,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    warehouse_id varchar(40) not null references warehouses(id),
    courier_name varchar(120),
    courier_phone varchar(40),
    tracking_number varchar(80),
    dispatch_note varchar(500),
    delivery_note varchar(500),
    dispatched_at timestamp,
    delivered_at timestamp,
    created_at timestamp,
    updated_at timestamp
);

CREATE TABLE IF NOT EXISTS order_items (
    id varchar(40) primary key,
    order_id varchar(40) not null references orders(id) on delete cascade,
    product_id varchar(40) not null references products(id),
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    warehouse_id varchar(40) not null references warehouses(id),
    quantity numeric(12,3) not null,
    unit_price decimal(12,2) not null,
    line_total decimal(12,2) not null,
    notes varchar(255),
    created_at timestamp,
    updated_at timestamp
);

CREATE TABLE IF NOT EXISTS order_status_history (
    id varchar(40) primary key,
    order_id varchar(40) not null references orders(id) on delete cascade,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    from_status varchar(30),
    to_status varchar(30) not null,
    reason varchar(300),
    changed_by varchar(40) references users(id),
    created_at timestamp
);

-- Quantity precision migration for fabric/measurement support
ALTER TABLE products
    ALTER COLUMN reorder_quantity TYPE numeric(12,3) USING reorder_quantity::numeric;
ALTER TABLE inventories
    ALTER COLUMN quantity_available TYPE numeric(12,3) USING quantity_available::numeric,
    ALTER COLUMN minimum_stock_level TYPE numeric(12,3) USING minimum_stock_level::numeric,
    ALTER COLUMN maximum_stock_level TYPE numeric(12,3) USING maximum_stock_level::numeric;
ALTER TABLE saledetails
    ALTER COLUMN quantity TYPE numeric(12,3) USING quantity::numeric;
ALTER TABLE purchasedetails
    ALTER COLUMN quantity TYPE numeric(12,3) USING quantity::numeric;
ALTER TABLE transferdetails
    ALTER COLUMN quantity TYPE numeric(12,3) USING quantity::numeric;
ALTER TABLE adjustmentdetails
    ALTER COLUMN quantity TYPE numeric(12,3) USING quantity::numeric,
    ALTER COLUMN system_quantity TYPE numeric(12,3) USING system_quantity::numeric;
ALTER TABLE stock_count_details
    ALTER COLUMN expected_quantity TYPE numeric(12,3) USING expected_quantity::numeric,
    ALTER COLUMN counted_quantity TYPE numeric(12,3) USING counted_quantity::numeric,
    ALTER COLUMN variance TYPE numeric(12,3) USING variance::numeric;
ALTER TABLE return_details
    ALTER COLUMN quantity TYPE numeric(12,3) USING quantity::numeric;

-- Subscription tier feature mapping (idempotent)
CREATE TABLE IF NOT EXISTS subscription_tiers (
    id varchar(40) primary key,
    code varchar(30) not null unique,
    name varchar(50) not null unique,
    description varchar(500),
    created_at timestamp,
    updated_at timestamp
);

CREATE TABLE IF NOT EXISTS subscription_tier_features (
    id varchar(40) primary key,
    tier_id varchar(40) not null references subscription_tiers(id) on delete cascade,
    feature_code varchar(100) not null,
    created_at timestamp,
    unique (tier_id, feature_code)
);

INSERT INTO subscription_tiers (id, code, name, description, created_at, updated_at)
SELECT gen_random_uuid()::text, 'free', 'Free', 'Entry plan', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM subscription_tiers WHERE lower(code) = 'free');

INSERT INTO subscription_tiers (id, code, name, description, created_at, updated_at)
SELECT gen_random_uuid()::text, 'basic', 'Basic', 'Starter paid tier', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM subscription_tiers WHERE lower(code) = 'basic');

INSERT INTO subscription_tiers (id, code, name, description, created_at, updated_at)
SELECT gen_random_uuid()::text, 'standard', 'Standard', 'Growth tier', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM subscription_tiers WHERE lower(code) = 'standard');

INSERT INTO subscription_tiers (id, code, name, description, created_at, updated_at)
SELECT gen_random_uuid()::text, 'premium', 'Premium', 'Full access tier', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM subscription_tiers WHERE lower(code) = 'premium');

-- Full-project tier feature gates
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
WHERE NOT EXISTS (
    SELECT 1
    FROM subscription_tier_features sf
    WHERE sf.tier_id = t.id AND lower(sf.feature_code) = p.feature_code
);

-- Store orders: minimum cart total per warehouse + order payment tracking (existing deployments)
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS minimum_order_amount decimal(12,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status varchar(20) NOT NULL DEFAULT 'unpaid';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS order_id varchar(40) REFERENCES orders(id);
CREATE INDEX IF NOT EXISTS index_payments_order_id ON payments(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS index_payments_transaction_ref_unique ON payments(transaction_ref) WHERE transaction_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS index_payments_status_created_at ON payments(status, created_at);
CREATE INDEX IF NOT EXISTS index_payments_method_created_at ON payments(payment_method_type, created_at);

CREATE TABLE IF NOT EXISTS payment_events (
    id varchar(40) primary key,
    payment_id varchar(40) not null references payments(id) on delete cascade,
    order_id varchar(40) references orders(id) on delete set null,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    actor_user_id varchar(40) references users(id),
    event_type varchar(40) not null,
    note varchar(500),
    metadata jsonb,
    created_at timestamp not null default now()
);
CREATE INDEX IF NOT EXISTS index_payment_events_payment_id ON payment_events(payment_id);
CREATE INDEX IF NOT EXISTS index_payment_events_order_id ON payment_events(order_id);
CREATE INDEX IF NOT EXISTS index_payment_events_tenant_created ON payment_events(tenant_id, created_at desc);

-- Marketing: newsletter subscribers & campaigns (platform-wide, public site)
INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'newsletter.subscribers.view', 'View newsletter subscribers', 'List marketing newsletter subscribers', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'newsletter.subscribers.view');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'newsletter.campaigns.view', 'View newsletters', 'List sent and draft marketing newsletters', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'newsletter.campaigns.view');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'newsletter.campaigns.send', 'Send newsletters', 'Create and send marketing newsletters', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'newsletter.campaigns.send');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'contact_requests.view', 'View contact requests', 'List Talk to us submissions from the public site', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'contact_requests.view');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'contact_requests.respond', 'Respond to contact requests', 'Reply to Talk to us messages by email', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'contact_requests.respond');

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id varchar(40) primary key,
    email varchar(255) not null,
    status varchar(20) not null default 'active',
    source varchar(100),
    subscribed_at timestamp not null default now(),
    unsubscribed_at timestamp,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);
CREATE UNIQUE INDEX IF NOT EXISTS index_newsletter_subscribers_email_lower ON newsletter_subscribers (lower(email));

CREATE TABLE IF NOT EXISTS newsletter_campaigns (
    id varchar(40) primary key,
    subject varchar(500) not null,
    body_html text,
    body_text text,
    status varchar(20) not null default 'draft',
    sent_at timestamp,
    sent_by varchar(40) references users(id),
    recipient_count int not null default 0,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);
CREATE INDEX IF NOT EXISTS index_newsletter_campaigns_status_sent ON newsletter_campaigns(status, sent_at desc nulls last);

CREATE TABLE IF NOT EXISTS newsletter_campaign_recipients (
    id varchar(40) primary key,
    campaign_id varchar(40) not null references newsletter_campaigns(id) on delete cascade,
    subscriber_id varchar(40) references newsletter_subscribers(id) on delete set null,
    email varchar(255) not null,
    status varchar(20) not null default 'pending',
    sent_at timestamp,
    error_message varchar(500),
    created_at timestamp not null default now()
);
CREATE INDEX IF NOT EXISTS index_newsletter_campaign_recipients_campaign ON newsletter_campaign_recipients(campaign_id);

CREATE TABLE IF NOT EXISTS contact_requests (
    id varchar(40) primary key,
    name varchar(200) not null,
    email varchar(255) not null,
    message text not null,
    status varchar(20) not null default 'open',
    admin_notes text,
    replied_at timestamp,
    replied_by varchar(40) references users(id),
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);
CREATE INDEX IF NOT EXISTS index_contact_requests_status_created ON contact_requests(status, created_at desc);

CREATE TABLE IF NOT EXISTS contact_request_replies (
    id varchar(40) primary key,
    request_id varchar(40) not null references contact_requests(id) on delete cascade,
    message text not null,
    is_staff boolean not null default true,
    created_by varchar(40) references users(id),
    created_at timestamp not null default now()
);
CREATE INDEX IF NOT EXISTS index_contact_request_replies_request ON contact_request_replies(request_id, created_at);

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'site_chat.sessions.view', 'View site chat sessions', 'List live chat conversations from the marketing site', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'site_chat.sessions.view');

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, 'site_chat.sessions.respond', 'Respond to site chat', 'Reply to marketing site live chat messages', now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'site_chat.sessions.respond');

CREATE TABLE IF NOT EXISTS site_chat_sessions (
    id varchar(40) primary key,
    visitor_token varchar(40) not null unique,
    name varchar(200) not null,
    email varchar(255) not null,
    status varchar(20) not null default 'open',
    source varchar(100),
    admin_notes text,
    replied_at timestamp,
    replied_by varchar(40) references users(id),
    last_message_at timestamp,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);
CREATE INDEX IF NOT EXISTS index_site_chat_sessions_status_last ON site_chat_sessions(status, last_message_at desc nulls last);

CREATE TABLE IF NOT EXISTS site_chat_messages (
    id varchar(40) primary key,
    session_id varchar(40) not null references site_chat_sessions(id) on delete cascade,
    body text not null,
    sender_type varchar(20) not null,
    created_by varchar(40) references users(id),
    created_at timestamp not null default now()
);
CREATE INDEX IF NOT EXISTS index_site_chat_messages_session ON site_chat_messages(session_id, created_at);

-- Order payment history (payments.view): Premium subscription tier only
DELETE FROM subscription_tier_features stf
USING subscription_tiers t
WHERE stf.tier_id = t.id
  AND lower(t.code) <> 'premium'
  AND lower(stf.feature_code) = 'payments.view';

-- Site chat admin features: Premium subscription tier only (remove from Free/Basic/Standard if present)
DELETE FROM subscription_tier_features stf
USING subscription_tiers t
WHERE stf.tier_id = t.id
  AND lower(t.code) <> 'premium'
  AND lower(stf.feature_code) IN ('site_chat.sessions.view', 'site_chat.sessions.respond');

INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, lower(p.code), now()
FROM subscription_tiers t
JOIN permissions p ON lower(p.code) IN ('site_chat.sessions.view', 'site_chat.sessions.respond')
WHERE lower(t.code) = 'premium'
  AND NOT EXISTS (
    SELECT 1
    FROM subscription_tier_features sf
    WHERE sf.tier_id = t.id AND lower(sf.feature_code) = lower(p.code)
  );

-- Product cost & sale-line COGS snapshot
ALTER TABLE products ADD COLUMN IF NOT EXISTS actual_cost decimal(10,2);
ALTER TABLE saledetails ADD COLUMN IF NOT EXISTS unit_cost decimal(10,2);
