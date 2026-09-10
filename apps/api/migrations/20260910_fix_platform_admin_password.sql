-- Fix platform admin bootstrap for asimaduk@gmail.com after EC2 restore.
-- The earlier migration skipped password reset when the email already belonged to a
-- shop tenant, and its bcrypt hash was invalid. This forces:
--   1) correct password hash
--   2) platform operator permissions on the user's Super Admin role
--   3) active Premium on that tenant (feature gates)
--
-- Login (change after first sign-in):
--   email:    asimaduk@gmail.com
--   password: ShopynnAdmin!2026

DO $$
DECLARE
    v_email         text := 'asimaduk@gmail.com';
    v_password_hash text := '$2b$10$kNpfgjnUQKH1CXB7eKXuv.jz5m0.iSxCb1lXlHKHazDkxm09vf1ve';
    v_user_id       varchar(40);
    v_tenant_id     varchar(40);
    v_role_id       varchar(40);
    v_sub_id        varchar(40);
BEGIN
    SELECT id, tenant_id INTO v_user_id, v_tenant_id
    FROM users
    WHERE lower(email) = lower(v_email)
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User % not found — run 20260910_platform_super_admin_kingsford.sql first or create the account', v_email;
    END IF;

    UPDATE users
    SET first_name = 'Kingsford',
        last_name = 'Asimadu',
        password = v_password_hash,
        temporary_password = NULL,
        password_expires_at = NULL,
        is_active = true,
        deleted = false,
        deleted_at = NULL,
        updated_at = now()
    WHERE id = v_user_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'User % has no tenant_id', v_email;
    END IF;

    -- Active Premium so platform feature gates pass.
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
        VALUES (
            v_role_id,
            'Super Admin',
            'Platform super admin (includes operator permissions)',
            v_tenant_id,
            now(),
            now()
        );
    END IF;

    -- All permissions except B2C customer-portal codes.
    INSERT INTO role_permissions (id, role_id, permission_id)
    SELECT gen_random_uuid()::text, v_role_id, p.id
    FROM permissions p
    WHERE p.code NOT IN (
        'orders.view',
        'orders.create',
        'orders.details.view',
        'orders.cancel',
        'notifications.view'
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

    RAISE NOTICE 'Elevated existing user % on tenant % with corrected password + platform perms', v_email, v_tenant_id;
END $$;
