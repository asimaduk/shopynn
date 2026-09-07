-- Pay-over-time (flexible partial payments) for customer store orders

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
