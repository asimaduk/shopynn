-- Online orders record a sale once completed and paid, so they count in Sales, dashboard, reports and profit.

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS order_id varchar(40) REFERENCES orders(id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_order_id
    ON sales(order_id) WHERE order_id IS NOT NULL;

ALTER TABLE saledetails
  ADD COLUMN IF NOT EXISTS order_item_id varchar(40) REFERENCES order_items(id);

CREATE INDEX IF NOT EXISTS idx_saledetails_order_item
    ON saledetails(order_item_id) WHERE order_item_id IS NOT NULL;

-- Cash "mark paid" on full-pay orders left amount_paid at 0 and balance_due at the total.
UPDATE orders o
SET amount_paid = o.total_amount,
    balance_due = 0
WHERE lower(coalesce(o.payment_status, '')) = 'paid'
  AND lower(coalesce(o.payment_mode, 'full')) <> 'installment'
  AND coalesce(o.amount_paid, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM returns r WHERE r.order_id = o.id);
