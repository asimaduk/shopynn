-- Owner-only billing and payout permissions. Super Admin gets every permission code
-- automatically; staff roles only get these when explicitly granted.

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, v.code, v.name, v.description, now()
FROM (
    VALUES
        ('subscription.manage', 'Manage subscription', 'Choose, upgrade or change the shop''s plan'),
        ('payouts.manage', 'Manage payouts', 'Change the payout account and withdraw the shop''s balance')
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE lower(p.code) = lower(v.code));
