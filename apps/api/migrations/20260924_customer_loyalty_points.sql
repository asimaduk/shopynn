-- Customer loyalty points (simple earn on paid sales).
-- Run: psql ... -f migrations/20260924_customer_loyalty_points.sql

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS loyalty_points integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN customers.loyalty_points IS 'Simple loyalty balance; earned on successful POS sales with a customer.';
