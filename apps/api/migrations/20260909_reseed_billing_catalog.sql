-- Re-seed billing_catalog_items after EC2→Railway restores that leave the table empty
-- or with amount_ghs = 0 (migration seed only runs once via schema_migrations).
-- Idempotent: insert missing codes; restore zero amounts to defaults; keep non-zero custom prices.

INSERT INTO billing_catalog_items (id, code, item_type, plan_tier, label, description, amount_ghs, commission_eligible, is_active, sort_order)
VALUES
    (gen_random_uuid()::text, 'plan_free_monthly', 'subscription_monthly', 'free', 'Free trial', '14-day trial', 0, 'none', true, 0),
    (gen_random_uuid()::text, 'plan_basic_monthly', 'subscription_monthly', 'basic', 'Basic monthly', 'Monthly subscription', 229, 'subscription_residual_5', true, 10),
    (gen_random_uuid()::text, 'plan_standard_monthly', 'subscription_monthly', 'standard', 'Standard monthly', 'Monthly subscription', 429, 'subscription_residual_5', true, 20),
    (gen_random_uuid()::text, 'plan_premium_monthly', 'subscription_monthly', 'premium', 'Premium monthly', 'Monthly subscription', 799, 'subscription_residual_5', true, 30),
    (gen_random_uuid()::text, 'onboarding_basic', 'onboarding', 'basic', 'Basic assisted go-live', 'Setup & training including product import and opening stock for a typical single shop.', 1000, 'onboarding_15', true, 11),
    (gen_random_uuid()::text, 'onboarding_standard', 'onboarding', 'standard', 'Standard assisted go-live', 'Setup & training including product import and opening stock; multi-branch basics as needed.', 2500, 'onboarding_15', true, 21),
    (gen_random_uuid()::text, 'onboarding_premium', 'onboarding', 'premium', 'Premium assisted go-live', 'Setup & training including product import and opening stock; multi-user / multi-branch handoff.', 4000, 'onboarding_15', true, 31),
    (gen_random_uuid()::text, 'addon_csv_import', 'addon', NULL, 'CSV product import', 'Included in assisted go-live — no longer sold separately.', 500, 'none', false, 100),
    (gen_random_uuid()::text, 'addon_opening_stock', 'addon', NULL, 'Opening stock setup', 'Included in assisted go-live — no longer sold separately.', 1000, 'none', false, 110),
    (gen_random_uuid()::text, 'addon_data_migration', 'addon', NULL, 'Data migration', 'Migrate products/stock from another system (beyond normal CSV / opening stock included in go-live).', 3000, 'none', true, 120),
    (gen_random_uuid()::text, 'addon_extra_training_day', 'addon', NULL, 'Extra training day', 'Additional training day beyond assisted go-live.', 1000, 'none', true, 130)
ON CONFLICT (code) DO UPDATE SET
    amount_ghs = CASE
        WHEN billing_catalog_items.amount_ghs = 0 AND EXCLUDED.amount_ghs > 0 THEN EXCLUDED.amount_ghs
        ELSE billing_catalog_items.amount_ghs
    END,
    label = COALESCE(NULLIF(trim(billing_catalog_items.label), ''), EXCLUDED.label),
    description = COALESCE(billing_catalog_items.description, EXCLUDED.description),
    item_type = EXCLUDED.item_type,
    plan_tier = COALESCE(billing_catalog_items.plan_tier, EXCLUDED.plan_tier),
    commission_eligible = COALESCE(NULLIF(billing_catalog_items.commission_eligible, ''), EXCLUDED.commission_eligible),
    is_active = CASE
        WHEN EXCLUDED.code IN ('addon_csv_import', 'addon_opening_stock') THEN false
        WHEN billing_catalog_items.is_active IS FALSE AND EXCLUDED.is_active IS TRUE
             AND billing_catalog_items.code LIKE 'plan_%' THEN true
        ELSE billing_catalog_items.is_active
    END,
    sort_order = COALESCE(billing_catalog_items.sort_order, EXCLUDED.sort_order),
    updated_at = now();
