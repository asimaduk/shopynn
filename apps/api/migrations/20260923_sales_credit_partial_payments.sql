-- POS sale-on-credit / partial payments: track amount paid, balance due, and payment ledger.

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS amount_paid decimal(12,2) NOT NULL DEFAULT 0;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS balance_due decimal(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN sales.amount_paid IS 'Amount collected toward this sale (0 when unpaid / on credit)';
COMMENT ON COLUMN sales.balance_due IS 'Remaining amount owed (total_amount - amount_paid)';
COMMENT ON COLUMN sales.payment_status IS '0=unpaid/on_credit, 1=paid, 2=partial';

-- Backfill: unpaid stays open; everything else treated as historically paid.
UPDATE sales
SET
    amount_paid = CASE
        WHEN payment_status = 0 THEN 0
        ELSE COALESCE(total_amount, 0)
    END,
    balance_due = CASE
        WHEN payment_status = 0 THEN COALESCE(total_amount, 0)
        ELSE 0
    END
WHERE TRUE;

-- Recompute balance_due from amount_paid for consistency
UPDATE sales
SET balance_due = GREATEST(0, ROUND((COALESCE(total_amount, 0) - COALESCE(amount_paid, 0))::numeric, 2));

CREATE TABLE IF NOT EXISTS sale_payments (
    id varchar(40) PRIMARY KEY,
    sale_id varchar(40) NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    tenant_id varchar(40) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL,
    payment_method varchar(30) NOT NULL,
    payment_type integer,
    payment_number varchar(50),
    payment_reference varchar(80),
    payments_id varchar(40) REFERENCES payments(id),
    recorded_by varchar(40) REFERENCES users(id),
    note varchar(300),
    created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale
    ON sale_payments(sale_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sale_payments_tenant
    ON sale_payments(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_balance_due
    ON sales(tenant_id, balance_due)
    WHERE balance_due > 0;
