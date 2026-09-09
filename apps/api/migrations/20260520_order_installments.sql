-- Pay-over-time (flexible partial payments) for customer store orders.
-- EC2 / older DBs may not have the online-orders tables yet — create them first.

CREATE TABLE IF NOT EXISTS warehouse_reference_codes (
    id varchar(40) PRIMARY KEY,
    warehouse_id varchar(40) NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    tenant_id varchar(40) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    reference_code varchar(80) NOT NULL,
    created_at timestamp,
    updated_at timestamp,
    is_active boolean DEFAULT true,
    UNIQUE (tenant_id, reference_code)
);

CREATE TABLE IF NOT EXISTS customer_profiles (
    id varchar(40) PRIMARY KEY,
    user_id varchar(40) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    tenant_id varchar(40) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    signup_reference_code varchar(80),
    default_warehouse_id varchar(40) REFERENCES warehouses(id),
    profile_type varchar(20) DEFAULT 'customer',
    created_at timestamp,
    updated_at timestamp
);

CREATE TABLE IF NOT EXISTS customer_store_access (
    id varchar(40) PRIMARY KEY,
    customer_profile_id varchar(40) NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
    warehouse_id varchar(40) NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    tenant_id varchar(40) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    access_source varchar(20) DEFAULT 'reference',
    created_at timestamp,
    updated_at timestamp,
    UNIQUE (customer_profile_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS user_warehouse_access (
    id varchar(40) PRIMARY KEY,
    user_id varchar(40) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    warehouse_id varchar(40) NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    tenant_id varchar(40) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    assigned_role varchar(30),
    created_at timestamp,
    updated_at timestamp,
    UNIQUE (user_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id varchar(40) PRIMARY KEY,
    order_number varchar(50) NOT NULL UNIQUE,
    tenant_id varchar(40) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id varchar(40) REFERENCES customers(id),
    customer_profile_id varchar(40) REFERENCES customer_profiles(id),
    warehouse_id varchar(40) NOT NULL REFERENCES warehouses(id),
    status varchar(30) NOT NULL DEFAULT 'pending',
    fulfillment_type varchar(20) NOT NULL DEFAULT 'pickup',
    subtotal_amount decimal(12,2) NOT NULL DEFAULT 0,
    discount_amount decimal(12,2) NOT NULL DEFAULT 0,
    delivery_fee decimal(12,2) NOT NULL DEFAULT 0,
    total_amount decimal(12,2) NOT NULL DEFAULT 0,
    notes varchar(500),
    delivery_address varchar(500),
    expected_at timestamp,
    cancelled_at timestamp,
    cancelled_by varchar(40) REFERENCES users(id),
    created_by_user_id varchar(40) REFERENCES users(id),
    created_at timestamp,
    updated_at timestamp,
    payment_status varchar(20) NOT NULL DEFAULT 'unpaid',
    payment_mode varchar(20) NOT NULL DEFAULT 'full',
    amount_paid decimal(12,2) NOT NULL DEFAULT 0,
    balance_due decimal(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_deliveries (
    id varchar(40) PRIMARY KEY,
    order_id varchar(40) NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    tenant_id varchar(40) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    warehouse_id varchar(40) NOT NULL REFERENCES warehouses(id),
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
    id varchar(40) PRIMARY KEY,
    order_id varchar(40) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id varchar(40) NOT NULL REFERENCES products(id),
    tenant_id varchar(40) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    warehouse_id varchar(40) NOT NULL REFERENCES warehouses(id),
    quantity numeric(12,3) NOT NULL,
    unit_price decimal(12,2) NOT NULL,
    line_total decimal(12,2) NOT NULL,
    notes varchar(255),
    created_at timestamp,
    updated_at timestamp
);

CREATE TABLE IF NOT EXISTS order_status_history (
    id varchar(40) PRIMARY KEY,
    order_id varchar(40) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tenant_id varchar(40) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_status varchar(30),
    to_status varchar(30) NOT NULL,
    reason varchar(300),
    changed_by varchar(40) REFERENCES users(id),
    created_at timestamp
);

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS installment_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS installment_min_initial_percent numeric(5,2);

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS installment_min_payment_amount numeric(12,2);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_mode varchar(20) NOT NULL DEFAULT 'full';

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS balance_due numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_status varchar(20) NOT NULL DEFAULT 'unpaid';

CREATE TABLE IF NOT EXISTS order_installment_payments (
    id varchar(40) PRIMARY KEY,
    order_id varchar(40) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tenant_id varchar(40) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL,
    payment_method varchar(30) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending',
    payments_id varchar(40) REFERENCES payments(id),
    recorded_by varchar(40) REFERENCES users(id),
    note varchar(300),
    created_at timestamp NOT NULL DEFAULT now(),
    completed_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_order_installment_payments_order
    ON order_installment_payments(order_id, created_at DESC);
