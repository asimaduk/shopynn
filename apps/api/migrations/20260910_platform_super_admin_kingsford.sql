-- Platform super admin for production: Kingsford Asimadu.
-- Idempotent: safe to re-run. Attaches to (or creates) "Shopynn Platform Admin".
--
-- Login (change password after first sign-in):
--   email:    asimaduk@gmail.com
--   password: ShopynnAdmin!2026
--
-- bcrypt hash below is for ShopynnAdmin!2026 (cost 10).

DO $$
DECLARE
    v_email            text := 'asimaduk@gmail.com';
    v_first_name       text := 'Kingsford';
    v_last_name        text := 'Asimadu';
    v_password_hash    text := '$2b$10$kNpfgjnUQKH1CXB7eKXuv.jz5m0.iSxCb1lXlHKHazDkxm09vf1ve';
    v_tenant_name      text := 'Shopynn Platform Admin';
    v_tenant_phone     text := '233200000098';
    v_user_phone       text := '233244881001';
    v_tenant_id        varchar(40);
    v_user_id          varchar(40);
    v_role_id          varchar(40);
    v_sub_id           varchar(40);
    v_warehouse_id     varchar(40);
    v_existing_tenant  varchar(40);
BEGIN
    -- Prefer existing platform tenant (local seed or prior deploy).
    SELECT id INTO v_tenant_id
    FROM tenants
    WHERE lower(trim(name)) = lower(v_tenant_name)
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        v_tenant_id := gen_random_uuid()::text;
        v_sub_id := gen_random_uuid()::text;

        INSERT INTO subscriptions (
            id, name, description, amount, billing_interval, status,
            created_at, updated_at, start_at, end_at, features, tenant_id
        ) VALUES (
            v_sub_id, 'Premium', 'Platform operator plan', 799.00, 'monthly', 'active',
            now(), now(), now(), now() + interval '10 years', NULL, NULL
        );

        INSERT INTO tenants (
            id, name, organization, phone, email, address, city, country,
            subscription_id, created_at, updated_at
        ) VALUES (
            v_tenant_id, v_tenant_name, 'Shopynn', v_tenant_phone, v_email,
            'Accra', 'Accra', 'Ghana',
            v_sub_id, now(), now()
        );

        UPDATE subscriptions SET tenant_id = v_tenant_id WHERE id = v_sub_id;
    ELSE
        -- Keep platform tenant on active Premium so feature gates pass.
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
    END IF;

    -- Ensure a Main warehouse on the platform tenant.
    SELECT id INTO v_warehouse_id
    FROM warehouses
    WHERE tenant_id = v_tenant_id
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;

    IF v_warehouse_id IS NULL THEN
        v_warehouse_id := gen_random_uuid()::text;
        INSERT INTO warehouses (id, name, tenant_id, created_at, updated_at)
        VALUES (v_warehouse_id, 'Main', v_tenant_id, now(), now());
    END IF;

    -- User: create or refresh.
    SELECT id, tenant_id INTO v_user_id, v_existing_tenant
    FROM users
    WHERE lower(email) = lower(v_email)
    LIMIT 1;

    IF v_user_id IS NULL THEN
        -- Avoid unique phone collisions.
        IF EXISTS (SELECT 1 FROM users WHERE phone = v_user_phone) THEN
            v_user_phone := NULL;
        END IF;

        v_user_id := gen_random_uuid()::text;
        INSERT INTO users (
            id, first_name, last_name, email, phone, tenant_id, password,
            temporary_password, password_expires_at, created_at, updated_at,
            is_active, registration_method, warehouse_id, deleted
        ) VALUES (
            v_user_id, v_first_name, v_last_name, lower(v_email), v_user_phone, v_tenant_id,
            v_password_hash, NULL, NULL, now(), now(),
            true, 'manual', v_warehouse_id, false
        );
    ELSE
        -- Only re-home onto the platform tenant when still unbound or already there.
        IF v_existing_tenant IS NULL OR v_existing_tenant = v_tenant_id THEN
            UPDATE users
            SET first_name = v_first_name,
                last_name = v_last_name,
                tenant_id = v_tenant_id,
                warehouse_id = COALESCE(warehouse_id, v_warehouse_id),
                password = v_password_hash,
                temporary_password = NULL,
                password_expires_at = NULL,
                is_active = true,
                deleted = false,
                deleted_at = NULL,
                updated_at = now()
            WHERE id = v_user_id;
        ELSE
            -- Email already belongs to another shop tenant: do not steal the account.
            RAISE NOTICE 'platform admin email % already exists on tenant % — skipped re-home; granting platform role on current tenant only',
                v_email, v_existing_tenant;
            v_tenant_id := v_existing_tenant;
        END IF;
    END IF;

    -- Super Admin role on this tenant.
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

    -- All permissions except B2C customer-portal codes (matches seed-system-admin.mjs).
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

    RAISE NOTICE 'Platform super admin ready: % (%) on tenant %', v_first_name || ' ' || v_last_name, v_email, v_tenant_id;
END $$;
