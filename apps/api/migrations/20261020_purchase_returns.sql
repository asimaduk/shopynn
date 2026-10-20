-- Purchase returns: goods sent back to a supplier, stored alongside sales returns.

ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS purchase_id varchar(40) REFERENCES purchases(id);

ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS supplier_id varchar(40) REFERENCES suppliers(id);

ALTER TABLE return_details
  ADD COLUMN IF NOT EXISTS purchase_detail_id varchar(40) REFERENCES purchasedetails(id);

COMMENT ON COLUMN returns.refund_method IS 'cash | momo | store_credit (sales); cash | balance (purchases)';

CREATE INDEX IF NOT EXISTS idx_returns_purchase ON returns(purchase_id) WHERE purchase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_return_details_purchase_detail
    ON return_details(purchase_detail_id) WHERE purchase_detail_id IS NOT NULL;
