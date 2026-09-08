-- Fold CSV import + opening stock into assisted go-live; keep only true extras as add-ons.
-- Run via db-migrate / Railway boot.

UPDATE billing_catalog_items
SET is_active = false,
    description = 'Included in assisted go-live — no longer sold separately.',
    updated_at = now()
WHERE code IN ('addon_csv_import', 'addon_opening_stock');

UPDATE billing_catalog_items
SET label = 'Basic assisted go-live',
    description = 'Setup & training including product import and opening stock for a typical single shop.',
    updated_at = now()
WHERE code = 'onboarding_basic';

UPDATE billing_catalog_items
SET label = 'Standard assisted go-live',
    description = 'Setup & training including product import and opening stock; multi-branch basics as needed.',
    updated_at = now()
WHERE code = 'onboarding_standard';

UPDATE billing_catalog_items
SET label = 'Premium assisted go-live',
    description = 'Setup & training including product import and opening stock; multi-user / multi-branch handoff.',
    updated_at = now()
WHERE code = 'onboarding_premium';

UPDATE billing_catalog_items
SET description = 'Migrate products/stock from another system (beyond normal CSV / opening stock included in go-live).',
    updated_at = now()
WHERE code = 'addon_data_migration';

UPDATE billing_catalog_items
SET description = 'Additional training day beyond assisted go-live.',
    updated_at = now()
WHERE code = 'addon_extra_training_day';
