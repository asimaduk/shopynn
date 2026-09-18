-- Cart snapshot for parked POS MoMo payments (serve next customer while waiting)

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS pos_cart_snapshot jsonb;

COMMENT ON COLUMN payments.pos_cart_snapshot IS
    'POS cart JSON parked with an unlinked MoMo payment so cashiers can resume/complete later.';

CREATE INDEX IF NOT EXISTS index_payments_pos_unlinked
    ON payments (tenant_id, created_at DESC)
    WHERE coalesce(payment_source, '') = 'pos_sale'
      AND sale_id IS NULL
      AND order_id IS NULL;
