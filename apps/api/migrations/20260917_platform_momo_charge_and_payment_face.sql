-- Platform MoMo/card collection charge + payment face/fee split for settlements

CREATE TABLE IF NOT EXISTS platform_settings (
    key varchar(100) PRIMARY KEY,
    value jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamp NOT NULL DEFAULT now(),
    updated_by varchar(40) REFERENCES users(id)
);

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
    'momo_payment_charge',
    '{"enabled": true, "percent": 2}'::jsonb,
    now()
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS sale_id varchar(40) REFERENCES sales(id),
    ADD COLUMN IF NOT EXISTS face_amount decimal(10,2),
    ADD COLUMN IF NOT EXISTS fee_amount decimal(10,2),
    ADD COLUMN IF NOT EXISTS payment_source varchar(40);

CREATE INDEX IF NOT EXISTS index_payments_sale_id ON payments(sale_id);

COMMENT ON COLUMN payments.face_amount IS 'Merchant-facing amount (sale/order face). Settlements credit this, not gross amount.';
COMMENT ON COLUMN payments.fee_amount IS 'Platform collection surcharge included in amount (gross = face + fee).';
COMMENT ON COLUMN payments.payment_source IS 'pos_sale | order | subscription | quote | etc.';
