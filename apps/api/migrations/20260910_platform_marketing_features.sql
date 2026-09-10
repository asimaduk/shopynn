-- Ensure platform-operator feature codes exist on Premium after restores, and that
-- asimaduk@gmail.com's Super Admin role retains explicit platform permissions.
-- Without these feature rows, marketing nav (newsletter / talk-to-us / live chat)
-- stays hidden even when role_permissions are present.

INSERT INTO permissions (id, code, name, description, created_at)
SELECT gen_random_uuid()::text, v.code, v.name, v.description, now()
FROM (
    VALUES
        ('merchants.view', 'View merchant admin', 'Register merchants and manage partner admin'),
        ('merchants.operate', 'Merchant partner operations', 'Onboard linked businesses and view own commissions'),
        ('tenants.directory.view', 'View tenant directory', 'List all businesses (tenants), subscriptions, and related details'),
        ('newsletter.subscribers.view', 'View newsletter subscribers', 'List marketing newsletter subscribers'),
        ('newsletter.campaigns.view', 'View newsletters', 'List sent and draft marketing newsletters'),
        ('newsletter.campaigns.send', 'Send newsletters', 'Create and send marketing newsletters'),
        ('broadcasts.send', 'Send platform broadcasts', 'Broadcast push, email, and SMS messages to Shopynn users'),
        ('contact_requests.view', 'View contact requests', 'List Talk to us submissions from the public site'),
        ('contact_requests.respond', 'Respond to contact requests', 'Reply to Talk to us messages by email'),
        ('site_chat.sessions.view', 'View site chat sessions', 'List live chat conversations from the marketing site'),
        ('site_chat.sessions.respond', 'Respond to site chat', 'Reply to marketing site live chat messages')
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

INSERT INTO subscription_tier_features (id, tier_id, feature_code, created_at)
SELECT gen_random_uuid()::text, t.id, v.code, now()
FROM subscription_tiers t
CROSS JOIN (
    VALUES
        ('merchants.view'),
        ('merchants.operate'),
        ('tenants.directory.view'),
        ('newsletter.subscribers.view'),
        ('newsletter.campaigns.view'),
        ('newsletter.campaigns.send'),
        ('broadcasts.send'),
        ('contact_requests.view'),
        ('contact_requests.respond'),
        ('site_chat.sessions.view'),
        ('site_chat.sessions.respond')
) AS v(code)
WHERE lower(t.code) = 'premium'
  AND NOT EXISTS (
      SELECT 1 FROM subscription_tier_features stf
      WHERE stf.tier_id = t.id AND stf.feature_code = v.code
  );

-- Reaffirm platform perms on Super Admin for the restored platform operator account.
DO $$
DECLARE
    v_user_id   varchar(40);
    v_tenant_id varchar(40);
    v_role_id   varchar(40);
    v_sub_id    varchar(40);
BEGIN
    SELECT id, tenant_id INTO v_user_id, v_tenant_id
    FROM users
    WHERE lower(email) = 'asimaduk@gmail.com'
    LIMIT 1;

    IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
        RAISE NOTICE 'asimaduk@gmail.com not found — skipped platform perm reaffirm';
        RETURN;
    END IF;

    SELECT subscription_id INTO v_sub_id FROM tenants WHERE id = v_tenant_id;
    IF v_sub_id IS NOT NULL THEN
        UPDATE subscriptions
        SET name = 'Premium',
            status = 'active',
            start_at = COALESCE(start_at, now()),
            end_at = GREATEST(COALESCE(end_at, now()), now() + interval '1 year'),
            updated_at = now()
        WHERE id = v_sub_id;
    END IF;

    SELECT id INTO v_role_id
    FROM roles
    WHERE tenant_id = v_tenant_id AND lower(trim(name)) = 'super admin'
    LIMIT 1;

    IF v_role_id IS NULL THEN
        v_role_id := gen_random_uuid()::text;
        INSERT INTO roles (id, name, description, tenant_id, created_at, updated_at)
        VALUES (v_role_id, 'Super Admin', 'Platform super admin', v_tenant_id, now(), now());
    END IF;

    INSERT INTO role_permissions (id, role_id, permission_id)
    SELECT gen_random_uuid()::text, v_role_id, p.id
    FROM permissions p
    WHERE p.code IN (
        'merchants.view',
        'merchants.operate',
        'tenants.directory.view',
        'newsletter.subscribers.view',
        'newsletter.campaigns.view',
        'newsletter.campaigns.send',
        'broadcasts.send',
        'contact_requests.view',
        'contact_requests.respond',
        'site_chat.sessions.view',
        'site_chat.sessions.respond'
    )
    AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp
        WHERE rp.role_id = v_role_id AND rp.permission_id = p.id
    );

    INSERT INTO user_roles (id, user_id, role_id, created_at)
    SELECT gen_random_uuid()::text, v_user_id, v_role_id, now()
    WHERE NOT EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = v_user_id AND ur.role_id = v_role_id
    );

    RAISE NOTICE 'Platform marketing features + perms reaffirmed for asimaduk@gmail.com';
END $$;
