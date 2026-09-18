-- Cash tender / change tracking on POS sales

ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS amount_tendered decimal(10,2),
    ADD COLUMN IF NOT EXISTS change_amount decimal(10,2);

COMMENT ON COLUMN sales.amount_tendered IS 'Cash handed over by customer (cash sales only).';
COMMENT ON COLUMN sales.change_amount IS 'Change returned (amount_tendered - total_amount) for cash sales.';
