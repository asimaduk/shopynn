-- Idempotency key for balance collections: a retried request must not record the same payment twice.
ALTER TABLE sale_payments ADD COLUMN IF NOT EXISTS client_request_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_payments_client_request
    ON sale_payments(tenant_id, client_request_id)
    WHERE client_request_id IS NOT NULL;
