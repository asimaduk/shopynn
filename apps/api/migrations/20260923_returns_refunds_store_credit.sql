-- Returns/refunds v1: link sale or order, restock flags, refund fields, store credit ledger.

ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS order_id varchar(40) REFERENCES orders(id);

ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS refund_method varchar(20);

ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS refund_amount decimal(12,2) NOT NULL DEFAULT 0;

ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS refund_status varchar(20) NOT NULL DEFAULT 'pending';

ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS payments_id varchar(40) REFERENCES payments(id);

ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS refund_reference varchar(80);

ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS reason varchar(300);

COMMENT ON COLUMN returns.refund_method IS 'cash | momo | store_credit';
COMMENT ON COLUMN returns.refund_status IS 'pending | completed | failed | none';
COMMENT ON COLUMN returns.status IS 'draft | completed | cancelled';

ALTER TABLE return_details
  ADD COLUMN IF NOT EXISTS sale_detail_id varchar(40) REFERENCES saledetails(id);

ALTER TABLE return_details
  ADD COLUMN IF NOT EXISTS order_item_id varchar(40) REFERENCES order_items(id);

ALTER TABLE return_details
  ADD COLUMN IF NOT EXISTS restock boolean NOT NULL DEFAULT true;

ALTER TABLE return_details
  ADD COLUMN IF NOT EXISTS line_total decimal(12,2);

ALTER TABLE return_details
  ADD COLUMN IF NOT EXISTS write_off_reason varchar(300);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS store_credit_balance decimal(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS store_credit_ledger (
    id varchar(40) PRIMARY KEY,
    tenant_id varchar(40) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id varchar(40) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL,
    balance_after numeric(12,2) NOT NULL,
    entry_type varchar(30) NOT NULL,
    return_id varchar(40) REFERENCES returns(id),
    sale_id varchar(40) REFERENCES sales(id),
    order_id varchar(40) REFERENCES orders(id),
    note varchar(300),
    recorded_by varchar(40) REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_credit_ledger_customer
    ON store_credit_ledger(tenant_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_returns_sale ON returns(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_return_details_sale_detail
    ON return_details(sale_detail_id) WHERE sale_detail_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_return_details_order_item
    ON return_details(order_item_id) WHERE order_item_id IS NOT NULL;
