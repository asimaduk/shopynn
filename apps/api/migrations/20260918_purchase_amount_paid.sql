-- Optional purchase payment tracking (amount paid toward supplier invoice).
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS amount_paid decimal(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN purchases.amount_paid IS 'Amount paid toward this purchase (0 when unpaid)';
COMMENT ON COLUMN purchases.payment_status IS '0=unpaid, 1=paid, 2=partial';
COMMENT ON COLUMN purchases.payment_type IS '1=cash, 2=momo, 3=bank, 4=other';
