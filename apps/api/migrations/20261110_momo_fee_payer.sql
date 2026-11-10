-- Per-shop choice: customer pays the collection surcharge, or the shop absorbs it from withdrawal.
-- Stored on each payment so later setting changes do not rewrite past settlements.

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS fee_payer varchar(20) NOT NULL DEFAULT 'customer';

ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS payments_fee_payer_check;

ALTER TABLE payments
    ADD CONSTRAINT payments_fee_payer_check
    CHECK (fee_payer IN ('customer', 'shop'));

COMMENT ON COLUMN payments.fee_payer IS
    'customer = charge face+fee, settle face. shop = charge face, settle face-fee.';

COMMENT ON COLUMN payments.fee_amount IS
    'Platform collection surcharge. Gross Paystack amount is face+fee when fee_payer=customer, else face.';
