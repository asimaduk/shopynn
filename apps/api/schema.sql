create table tenants (
    id varchar(40) primary key,
    name varchar(100),
    organization varchar(50),
    created_at timestamp,
    updated_at timestamp,
    phone varchar(30) unique,
    notes varchar,
    product_categorization integer,
    address varchar(200),
    city varchar(100),
    state varchar(100),
    country varchar(100),
    postal_code varchar(10),
    website varchar(200),
    logo varchar(200),
    email varchar(300),
    industry_id varchar(40)
);

create table subscriptions (
    id varchar(40) primary key,
    name varchar(50), --Free / Basic / Standard / Premium
    description varchar(500),
    amount decimal(10,2),
    billing_interval varchar(20),
    status varchar(20) default 'active',
    created_at timestamp,
    updated_at timestamp,
    start_at timestamp,
    end_at timestamp,
    features varchar(1000),
    tenant_id varchar(40) references tenants(id)
);

create table subscription_tiers (
    id varchar(40) primary key,
    code varchar(30) not null unique, -- basic / standard / premium / free
    name varchar(50) not null unique,
    description varchar(500),
    created_at timestamp,
    updated_at timestamp
);

create table subscription_tier_features (
    id varchar(40) primary key,
    tier_id varchar(40) not null references subscription_tiers(id) on delete cascade,
    feature_code varchar(100) not null,
    created_at timestamp,
    unique (tier_id, feature_code)
);

create table industries (
    id varchar(40) primary key,
    name varchar(150) unique,
    code varchar(50),
    description varchar(500),
    product_categorization integer,
    created_at timestamp,
    updated_at timestamp
);

create table users (
    id varchar(40) primary key,
    first_name varchar(100),
    last_name varchar(200),
    email varchar(300) unique,
    phone varchar(30) unique,
    tenant_id varchar(40) references tenants(id),
    password varchar(255),
    temporary_password varchar(255),
    password_expires_at timestamp,
    created_at timestamp,
    updated_at timestamp,
    last_login timestamp,
    is_active boolean,
    user_type integer, -- 1 admin, 2 manager, 3 staff
    signup_reference_code varchar(80),
    registration_method varchar(50) default 'manual',
    fcm_token varchar(500),
    deleted boolean default false,
    deleted_at timestamp,
    deleted_by varchar(40) references users(id),    
    deleted_reason varchar(255)
);

create table locations (
    id varchar(40) primary key,
    name varchar(100),
    manager varchar(100),
    phone varchar(30),
    address varchar(200),
    created_at timestamp,
    updated_at timestamp,
    creator_id varchar(40) references users(id),
    notes varchar(300),
    tenant_id varchar(40) references tenants(id)
);

create table warehouses (
    id varchar(40) primary key,
    name varchar(100),
    manager varchar(100),
    phone varchar(30),
    address varchar(200),
    is_refrigerated boolean,
    location_id varchar(40) references locations(id),
    created_at timestamp,
    updated_at timestamp,
    creator_id varchar(40) references users(id),
    notes varchar(300),
    printer_type varchar(20) default 'any',
    tenant_id varchar(40) references tenants(id),
    minimum_order_amount decimal(12,2) not null default 0
);

create table products (
    id varchar(40) primary key,
    product_categorization integer,
    name varchar(200),
    slug varchar(255),
    sku varchar(100) unique,
    unit_price decimal(10,2),
    alt_price decimal(10,2),
    actual_cost decimal(10,2),
    inventory integer,
    unit varchar(50),
    bar_code varchar(100),
    description varchar(2000),
    reorder_quantity numeric(12,3),
    packed_weight decimal(10,2),
    packed_height decimal(10,2),
    packed_width decimal(10,2),
    packed_depth decimal(10,2),
    is_refrigerated boolean,
    created_at timestamp,
    updated_at timestamp,
    notes varchar(300),
    creator_id varchar(40) references users(id),
    warehouse_id varchar(40) references warehouses(id),
    tenant_id varchar(40) references tenants(id),
    thumbnail varchar(40),
    picture1 varchar(40),
    picture2 varchar(40),
    picture3 varchar(40),
    picture4 varchar(40),
    is_active boolean,
    tags varchar[],
    categories varchar[]
);

alter table products add column if not exists product_type varchar(30) default 'standard';
alter table products add column if not exists measurement_unit varchar(30) default 'units';
alter table products add column if not exists allows_fractional_qty boolean default false;
alter table products add column if not exists min_order_qty numeric(12,3) default 1;
alter table products add column if not exists qty_step numeric(12,3) default 1;
alter table products add column if not exists base_price_per_unit decimal(10,2);
alter table products add column if not exists installment_enabled boolean not null default false;
alter table products add column if not exists installment_min_initial_percent numeric(5,2);
alter table products add column if not exists installment_min_payment_amount numeric(12,2);
alter table orders add column if not exists payment_mode varchar(20) not null default 'full';
alter table orders add column if not exists amount_paid decimal(12,2) not null default 0;
alter table orders add column if not exists balance_due decimal(12,2) not null default 0;

create table inventories (
    id varchar(40) primary key,
    quantity_available numeric(12,3),
    minimum_stock_level numeric(12,3),
    maximum_stock_level numeric(12,3),
    created_at timestamp,
    updated_at timestamp,
    notes varchar[],
    creator_id varchar(40) references users(id),
    product_id varchar(40) references products(id),
    warehouse_id varchar(40) references warehouses(id),
    tenant_id varchar(40) references tenants(id),
    expiration_date timestamp,
    batch_number varchar(100),
    serial_number varchar(100)
);

create table suppliers (
    id varchar(40) primary key,
    name varchar(200),
    address varchar(200),
    manager varchar(100),
    phone varchar(30),
    created_at timestamp,
    updated_at timestamp,
    creator_id varchar(40) references users(id),
    notes varchar(300),
    tenant_id varchar(40) references tenants(id)
);

create table purchases (
    id varchar(40) primary key,
    number_of_items integer,
    total_amount decimal(10,2),
    discount_amount decimal(10,2),
    invoice_number varchar(40) unique,
    created_at timestamp,
    updated_at timestamp,
    due_date timestamp,
    current_status integer,
    payment_type integer,
    payment_number varchar(50),
    payment_status integer,
    payment_date timestamp,
    payment_reference varchar(50),
    notes varchar(300),
    updated_by varchar(40) references users(id),
    receiver_id varchar(40) references users(id),
    warehouse_id varchar(40) references warehouses(id),
    supplier_id varchar(40) references suppliers(id),
    tenant_id varchar(40) references tenants(id)
);

create table purchasedetails (
    id varchar(40) primary key,
    purchase_id varchar(40) references purchases(id),
    product_id varchar(40) references products(id),
    supplier_id varchar(40) references suppliers(id),
    unit_price decimal(10,2),
    quantity numeric(12,3),
    created_at timestamp,
    updated_at timestamp,
    warehouse_id varchar(40) references warehouses(id),
    tenant_id varchar(40) references tenants(id),
    creator_id varchar(40) references users(id)
);

create table customers (
    id varchar(40) primary key,
    name varchar(100),
    email varchar(300),
    address varchar(100),
    phone varchar(30),
    customer_group varchar(30),
    tenant_id varchar(40) references tenants(id),
    creator_id varchar(40) references users(id),
    created_at timestamp,
    updated_at timestamp,
    is_active boolean,
    deleted boolean default false,
    deleted_at timestamp,
    deleted_by varchar(40) references users(id),
    deleted_reason varchar(255),
    notes varchar(300)
);

create table warehouse_reference_codes (
    id varchar(40) primary key,
    warehouse_id varchar(40) not null references warehouses(id) on delete cascade,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    reference_code varchar(80) not null,
    created_at timestamp,
    updated_at timestamp,
    is_active boolean default true,
    unique (tenant_id, reference_code)
);

create table customer_profiles (
    id varchar(40) primary key,
    user_id varchar(40) not null unique references users(id) on delete cascade,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    signup_reference_code varchar(80),
    default_warehouse_id varchar(40) references warehouses(id),
    profile_type varchar(20) default 'customer', -- customer / cashier / manager / admin
    created_at timestamp,
    updated_at timestamp
);

create table customer_store_access (
    id varchar(40) primary key,
    customer_profile_id varchar(40) not null references customer_profiles(id) on delete cascade,
    warehouse_id varchar(40) not null references warehouses(id) on delete cascade,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    access_source varchar(20) default 'reference', -- reference / manual / admin
    created_at timestamp,
    updated_at timestamp,
    unique (customer_profile_id, warehouse_id)
);

create table user_warehouse_access (
    id varchar(40) primary key,
    user_id varchar(40) not null references users(id) on delete cascade,
    warehouse_id varchar(40) not null references warehouses(id) on delete cascade,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    assigned_role varchar(30), -- cashier / manager / picker
    created_at timestamp,
    updated_at timestamp,
    unique (user_id, warehouse_id)
);

create table orders (
    id varchar(40) primary key,
    order_number varchar(50) not null unique,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    customer_id varchar(40) references customers(id),
    customer_profile_id varchar(40) references customer_profiles(id),
    warehouse_id varchar(40) not null references warehouses(id),
    status varchar(30) not null default 'pending', -- pending/confirmed/processing/ready/shipped/delivered/completed/cancelled
    fulfillment_type varchar(20) not null default 'pickup', -- pickup / delivery
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
    updated_at timestamp,
    payment_status varchar(20) not null default 'unpaid',
    payment_mode varchar(20) not null default 'full',
    amount_paid decimal(12,2) not null default 0,
    balance_due decimal(12,2) not null default 0
);

create table order_installment_payments (
    id varchar(40) primary key,
    order_id varchar(40) not null references orders(id) on delete cascade,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    amount decimal(12,2) not null,
    payment_method varchar(30) not null,
    status varchar(20) not null default 'pending',
    payments_id varchar(40) references payments(id),
    recorded_by varchar(40) references users(id),
    note varchar(300),
    created_at timestamp not null default now(),
    completed_at timestamp
);

create table order_deliveries (
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

create table order_items (
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

create table order_status_history (
    id varchar(40) primary key,
    order_id varchar(40) not null references orders(id) on delete cascade,
    tenant_id varchar(40) not null references tenants(id) on delete cascade,
    from_status varchar(30),
    to_status varchar(30) not null,
    reason varchar(300),
    changed_by varchar(40) references users(id),
    created_at timestamp
);

create table sales (
    id varchar(40) primary key,
    number_of_items integer,
    total_amount decimal(10,2),
    discount_amount decimal(10,2),
    invoice_number varchar(40) unique,
    sale_date timestamp,
    created_at timestamp,
    updated_at timestamp,
    due_date timestamp,
    current_status integer,
    payment_type integer,
    payment_number varchar(50),
    payment_status integer,
    payment_date timestamp,
    payment_reference varchar(50),
    notes varchar(300),
    updated_by varchar(40) references users(id),
    creator_id varchar(40) references users(id),
    customer_id varchar(40) references customers(id),
    warehouse_id varchar(40) references warehouses(id),
    tenant_id varchar(40) references tenants(id)
);

create table saledetails (
    id varchar(40) primary key,
    sale_id varchar(40) references sales(id),
    product_id varchar(40) references products(id),
    supplier_id varchar(40) references suppliers(id),
    unit_price decimal(10,2),
    unit_cost decimal(10,2),
    quantity numeric(12,3),
    created_at timestamp,
    updated_at timestamp,
    warehouse_id varchar(40) references warehouses(id),
    tenant_id varchar(40) references tenants(id),
    creator_id varchar(40) references users(id)
);

create table deliveries (
    id varchar(40) primary key,
    current_status integer, 
    created_at timestamp,
    updated_at timestamp,
    sales_date timestamp,
    expected_date timestamp,
    delivered_date timestamp,
    warehouse_id varchar(40) references warehouses(id),
    sender_id varchar(40) references users(id),
    receiver_id varchar(40) references users(id),
    sale_id varchar(40) references sales(id),
    tenant_id varchar(40) references tenants(id)
);

create table transfers (
    id varchar(40) primary key,
    number_of_items integer,
    sent_date timestamp,
    received_date timestamp,
    source_warehouse_id varchar(40) references warehouses(id),
    destination_warehouse_id varchar(40) references warehouses(id),
    creator_id varchar(40) references users(id),
    notes varchar(300),
    created_at timestamp,
    updated_at timestamp,
    tenant_id varchar(40) references tenants(id)
);

create table transferdetails (
    id varchar(40) primary key,
    transfer_id varchar(40) references transfers(id),
    product_id varchar(40) references products(id),
    quantity numeric(12,3),
    created_at timestamp,
    updated_at timestamp,
    tenant_id varchar(40) references tenants(id)
);

create table adjustments (
    id varchar(40) primary key,
    number_of_items integer,
    total_amount decimal(10,2),
    reference_number varchar(40) unique,
    created_at timestamp,
    updated_at timestamp,
    notes varchar(300),
    updated_by varchar(40) references users(id),
    warehouse_id varchar(40) references warehouses(id),
    tenant_id varchar(40) references tenants(id),
    creator_id varchar(40) references users(id)
);

create table adjustmentdetails (
    id varchar(40) primary key,
    adjustment_id varchar(40) references adjustments(id),
    product_id varchar(40) references products(id),
    quantity numeric(12,3),
    system_quantity numeric(12,3),
    adjustment_type varchar(20),
    category integer,
    comment varchar(300),
    created_at timestamp,
    updated_at timestamp
);

create index index_search on products(tenant_id, name, sku);

create table categories (
    id varchar(40) primary key,
    name varchar(100),
    description varchar(300),
    full_picture varchar(40),
    thumbnail varchar(40),
    is_active boolean,
    creator_id varchar(40) references users(id),
    tenant_id varchar(40) references tenants(id),
    created_at timestamp,
    updated_at timestamp
);

create table expenses (
    id varchar(40) primary key,
    amount decimal(10,2),
    voucher varchar(100),
    description varchar(255),
    note varchar(255),
    category varchar(70),
    payment_method varchar(50),
    warehouse_id varchar(40) references warehouses(id),
    tenant_id varchar(40) references tenants(id),
    creator_id varchar(40) references users(id),
    created_at timestamp,
    updated_at timestamp,
    expense_date timestamp,
    expensed_by varchar(255)
);

create table payments (
    id varchar(40) primary key,
    amount decimal(10,2),
    subscription_id varchar(40) references subscriptions(id),
    customer_id varchar(40) references customers(id),
    order_id varchar(40) references orders(id),
    tenant_id varchar(40) references tenants(id),
    creator_id varchar(40) references users(id),
    created_at timestamp,
    updated_at timestamp,
    payment_method_type varchar(20),
    payment_number varchar(50),
    transaction_ref varchar(40),
    status varchar(20)
);

create index index_payments_order_id on payments(order_id);
create unique index index_payments_transaction_ref_unique on payments(transaction_ref) where transaction_ref is not null;
create index index_payments_status_created_at on payments(status, created_at);
create index index_payments_method_created_at on payments(payment_method_type, created_at);

create table payment_events (
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

create index index_payment_events_payment_id on payment_events(payment_id);
create index index_payment_events_order_id on payment_events(order_id);
create index index_payment_events_tenant_created on payment_events(tenant_id, created_at desc);

create table stock_counts (
    id varchar(40) primary key,
    warehouse_id varchar(40) references warehouses(id),
    tenant_id varchar(40) references tenants(id),
    creator_id varchar(40) references users(id),
    reference_number varchar(40),
    status varchar(20),
    number_of_items integer,
    notes varchar(300),
    created_at timestamp,
    updated_at timestamp
);

create table stock_count_details (
    id varchar(40) primary key,
    stock_count_id varchar(40) references stock_counts(id),
    product_id varchar(40) references products(id),
    inventory_id varchar(40) references inventories(id),
    expected_quantity numeric(12,3),
    counted_quantity numeric(12,3),
    variance numeric(12,3),
    notes varchar(300),
    created_at timestamp,
    updated_at timestamp
);

create table returns (
    id varchar(40) primary key,
    reference_number varchar(40),
    sale_id varchar(40) references sales(id),
    customer_id varchar(40) references customers(id),
    warehouse_id varchar(40) references warehouses(id),
    tenant_id varchar(40) references tenants(id),
    creator_id varchar(40) references users(id),
    status varchar(20),
    total_amount decimal(10,2),
    notes varchar(300),
    created_at timestamp,
    updated_at timestamp
);

create table return_details (
    id varchar(40) primary key,
    return_id varchar(40) references returns(id),
    product_id varchar(40) references products(id),
    quantity numeric(12,3),
    unit_price decimal(10,2),
    reason varchar(300),
    notes varchar(300),
    created_at timestamp,
    updated_at timestamp
);

create table notifications (
    id varchar(40) primary key,
    tenant_id varchar(40) references tenants(id),
    user_id varchar(40) references users(id),
    type varchar(50),
    title varchar(255),
    message varchar(1000),
    read_at timestamp,
    metadata varchar(1000),
    created_at timestamp,
    updated_at timestamp,
    deleted boolean default false,
    deleted_at timestamp,
    icon varchar(50),
    link varchar(255),
    link_params varchar(255),
    mobile_params jsonb default '{}',
    mobile_screen varchar(50)
);

create table user_preferences (
    id varchar(40) primary key,
    user_id varchar(40) not null unique references users(id) on delete cascade,
    preferences jsonb default '{}',
    created_at timestamp,
    updated_at timestamp
);

-- roles and permissions (tenant_id null on roles = system role)
create table roles (
    id varchar(40) primary key,
    name varchar(80) not null,
    description varchar(255),
    tenant_id varchar(40) references tenants(id),
    created_at timestamp,
    updated_at timestamp,
    unique (name, tenant_id)
);

create table permissions (
    id varchar(40) primary key,
    code varchar(80) not null unique,
    name varchar(120),
    description varchar(255),
    created_at timestamp
);

create table role_permissions (
    id varchar(40) primary key,
    role_id varchar(40) references roles(id) on delete cascade,
    permission_id varchar(40) references permissions(id) on delete cascade,
    unique (role_id, permission_id)
);

create table user_roles (
    id varchar(40) primary key,
    user_id varchar(40) references users(id) on delete cascade,
    role_id varchar(40) references roles(id) on delete cascade,
    assigned_by varchar(40) references users(id),
    created_at timestamp,
    unique (user_id, role_id)
);

create table app_versions (
    id varchar(40) primary key,
    platform varchar(30) not null, -- ios, android, web
    latest_version varchar(30) not null,
    min_supported_version varchar(30) not null,
    force_update boolean default false,
    status varchar(20) default 'active', -- active / inactive
    store_url varchar(300),
    release_notes varchar(1000),
    created_at timestamp,
    updated_at timestamp
);

create table audit_logs (
    id varchar(40) primary key,
    user_id varchar(40) references users(id),
    tenant_id varchar(40) references tenants(id),
    action varchar(80),
    entity_type varchar(80),
    entity_id varchar(40),
    details varchar(1000),
    ip_address varchar(45),
    created_at timestamp
);

create table merchants (
    id varchar(40) primary key,
    user_id varchar(40) not null unique references users(id),
    default_commission_percent decimal(10,4),
    created_at timestamp,
    updated_at timestamp
);

create table merchant_commissions (
    id varchar(40) primary key,
    merchant_id varchar(40) not null references merchants(id),
    tenant_id varchar(40) not null references tenants(id),
    subscription_id varchar(40) references subscriptions(id),
    base_amount decimal(12,2) not null,
    commission_percent decimal(10,4) not null,
    commission_amount decimal(12,2) not null,
    status varchar(20) not null default 'pending',
    paid_at timestamp,
    notes varchar(500),
    created_at timestamp
);

alter table tenants 
add column creator_id varchar(40) references users(id),
add column updator_id varchar(40) references users(id);

alter table users
add column warehouse_id varchar(40) references warehouses(id),
add column merchant_id varchar(40) references merchants(id);

alter table tenants 
add column subscription_id varchar(40) references subscriptions(id);

create table if not exists email_verification_codes (
    id varchar(40) primary key,
    email varchar(255) not null,
    purpose varchar(50) not null default 'shop_owner_signup',
    code_hash varchar(128) not null,
    verification_token varchar(64),
    attempts int not null default 0,
    expires_at timestamp not null,
    verified_at timestamp,
    created_at timestamp not null default now()
);
