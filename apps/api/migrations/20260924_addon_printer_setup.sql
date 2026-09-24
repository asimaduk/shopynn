-- Official standalone thermal printer setup add-on (GHS 150).
-- Included in assisted go-live; sold alone for self-serve shops that need pairing help.
-- Run: psql ... -f migrations/20260924_addon_printer_setup.sql

INSERT INTO billing_catalog_items (
    id, code, item_type, plan_tier, label, description, amount_ghs, commission_eligible, is_active, sort_order, created_at, updated_at
) VALUES (
    gen_random_uuid()::text,
    'addon_printer_setup',
    'addon',
    NULL,
    'Thermal printer setup',
    'Standalone help pairing a receipt/thermal printer and test print. Included free when the shop pays for assisted go-live.',
    150,
    'none',
    true,
    140,
    now(),
    now()
)
ON CONFLICT (code) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    amount_ghs = EXCLUDED.amount_ghs,
    commission_eligible = EXCLUDED.commission_eligible,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
