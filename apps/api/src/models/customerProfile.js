import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import { CUSTOMER_PORTAL_PERMISSION_CODES } from "../constants/permissionCodes.js";
import {
    normalizeReferenceCode,
    REFERENCE_CODE_VALIDATION_MESSAGE,
} from "../constants/referenceCode.js";

const saltRounds = 12;

const resolveReferenceStore = async (tenantId, referenceCode) => {
    const code = normalizeReferenceCode(referenceCode);
    if (!code) return null;
    const result = await pool.query(
        `SELECT id, warehouse_id
         FROM warehouse_reference_codes
         WHERE tenant_id = $1 AND reference_code = $2 AND coalesce(is_active, true) = true
         LIMIT 1`,
        [tenantId, code]
    );
    return result.rows[0] ?? null;
};

export const resolveStoreReferencePublicService = async (referenceCode) => {
    const code = normalizeReferenceCode(referenceCode);
    if (!code) {
        throw new Error(
            String(referenceCode || "").trim()
                ? `Invalid store reference code. ${REFERENCE_CODE_VALIDATION_MESSAGE}`
                : "reference_code is required."
        );
    }

    const result = await pool.query(
        `SELECT
            wrc.id,
            wrc.tenant_id,
            wrc.warehouse_id,
            wrc.reference_code,
            w.name AS warehouse_name,
            w.address AS warehouse_address,
            t.name AS company_name
         FROM warehouse_reference_codes wrc
         LEFT JOIN warehouses w ON w.id = wrc.warehouse_id
         LEFT JOIN tenants t ON t.id = wrc.tenant_id
         WHERE wrc.reference_code = $1
           AND coalesce(wrc.is_active, true) = true
         LIMIT 1`,
        [code]
    );

    const row = result.rows[0];
    if (!row) throw new Error("Invalid store reference code.");

    return {
        tenant_id: row.tenant_id,
        warehouse_id: row.warehouse_id,
        reference_code: row.reference_code,
        store: {
            id: row.warehouse_id,
            name: row.warehouse_name || null,
            address: row.warehouse_address || null,
        },
        company: {
            name: row.company_name || null,
        },
    };
};

const ensureCustomerRoleWithPermissions = async (client, tenantId) => {
    const existingRole = await client.query(
        `SELECT id
         FROM roles
         WHERE tenant_id = $1 AND lower(name) = 'customer'
         LIMIT 1`,
        [tenantId]
    );

    const roleId = existingRole.rows[0]?.id || uuidv4();
    if (!existingRole.rowCount) {
        await client.query(
            `INSERT INTO roles (id, name, description, tenant_id, created_at, updated_at)
             VALUES ($1, 'Customer', 'Customer ordering role', $2, now(), now())`,
            [roleId, tenantId]
        );
    }

    const permissionCodes = CUSTOMER_PORTAL_PERMISSION_CODES;
    const perms = await client.query(
        `SELECT id
         FROM permissions
         WHERE code = ANY($1::text[])`,
        [permissionCodes]
    );

    for (const perm of perms.rows) {
        await client.query(
            `INSERT INTO role_permissions (id, role_id, permission_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (role_id, permission_id) DO NOTHING`,
            [uuidv4(), roleId, perm.id]
        );
    }

    return roleId;
};

export const signupCustomerAccountService = async (payload = {}) => {
    const firstName = String(payload.first_name || "").trim();
    const lastName = String(payload.last_name || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    const phone = String(payload.phone || "").trim();
    const password = String(payload.password || "");
    const referenceCode = String(payload.reference_code || "").trim();

    if (!firstName || !lastName || !email || !phone || !password || !referenceCode) {
        throw new Error("first_name, last_name, email, phone, password and reference_code are required.");
    }

    const reference = await resolveStoreReferencePublicService(referenceCode);

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const emailExists = await client.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
        if (emailExists.rowCount) throw new Error("An account with this email already exists.");

        const phoneExists = await client.query(`SELECT id FROM users WHERE phone = $1 LIMIT 1`, [phone]);
        if (phoneExists.rowCount) throw new Error("An account with this phone number already exists.");

        const roleId = await ensureCustomerRoleWithPermissions(client, reference.tenant_id);
        const userId = uuidv4();
        const passwordHash = await bcrypt.hash(password, saltRounds);

        await client.query(
            `INSERT INTO users (
                id, first_name, last_name, email, tenant_id, phone, password, temporary_password,
                created_at, is_active, registration_method, warehouse_id, password_expires_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                now(), true, 'manual', $9, NULL
            )`,
            [
                userId,
                firstName,
                lastName,
                email,
                reference.tenant_id,
                phone,
                passwordHash,
                null,
                reference.warehouse_id,
            ]
        );

        await client.query(
            `INSERT INTO user_roles (id, user_id, role_id, assigned_by, created_at)
             VALUES ($1, $2, $3, $2, now())
             ON CONFLICT (user_id, role_id) DO NOTHING`,
            [uuidv4(), userId, roleId]
        );

        const profileId = uuidv4();
        await client.query(
            `INSERT INTO customer_profiles (
                id, user_id, tenant_id, signup_reference_code, default_warehouse_id, profile_type, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, 'customer', now(), now())`,
            [profileId, userId, reference.tenant_id, reference.reference_code, reference.warehouse_id]
        );

        await client.query(
            `INSERT INTO customer_store_access (
                id, customer_profile_id, warehouse_id, tenant_id, access_source, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, 'reference', now(), now())
             ON CONFLICT (customer_profile_id, warehouse_id) DO UPDATE SET updated_at = now()`,
            [uuidv4(), profileId, reference.warehouse_id, reference.tenant_id]
        );

        await client.query("COMMIT");

        return {
            id: userId,
            email,
            first_name: firstName,
            last_name: lastName,
            reference_code: reference.reference_code,
            warehouse_id: reference.warehouse_id,
            warehouse_name: reference.store?.name || null,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

export const signupCustomerProfileService = async (user, payload = {}) => {
    const referenceCode = String(payload.reference_code || payload.signup_reference_code || "").trim();
    if (!referenceCode) throw new Error("reference_code is required.");

    const storeRef = await resolveReferenceStore(user.tenant_id, referenceCode);
    if (!storeRef) throw new Error("Invalid store reference code.");

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const existing = await client.query(
            `SELECT id FROM customer_profiles WHERE user_id = $1 AND tenant_id = $2 LIMIT 1`,
            [user.id, user.tenant_id]
        );

        const profileId = existing.rows[0]?.id || uuidv4();
        if (existing.rowCount === 0) {
            await client.query(
                `INSERT INTO customer_profiles (
                    id, user_id, tenant_id, signup_reference_code, default_warehouse_id, profile_type, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, 'customer', now(), now())`,
                [profileId, user.id, user.tenant_id, referenceCode, storeRef.warehouse_id]
            );
        } else {
            await client.query(
                `UPDATE customer_profiles
                 SET signup_reference_code = $1, default_warehouse_id = $2, updated_at = now()
                 WHERE id = $3`,
                [referenceCode, storeRef.warehouse_id, profileId]
            );
        }

        await client.query(
            `INSERT INTO customer_store_access (
                id, customer_profile_id, warehouse_id, tenant_id, access_source, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, 'reference', now(), now())
            ON CONFLICT (customer_profile_id, warehouse_id)
            DO UPDATE SET updated_at = now()`,
            [uuidv4(), profileId, storeRef.warehouse_id, user.tenant_id]
        );

        await client.query("COMMIT");
        return { profile_id: profileId, warehouse_id: storeRef.warehouse_id, reference_code: referenceCode };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

export const linkCustomerStoreService = async (user, payload = {}) => {
    const referenceCode = String(payload.reference_code || "").trim();
    if (!referenceCode) throw new Error("reference_code is required.");

    const profileResult = await pool.query(
        `SELECT id FROM customer_profiles WHERE user_id = $1 AND tenant_id = $2 LIMIT 1`,
        [user.id, user.tenant_id]
    );
    if (!profileResult.rowCount) throw new Error("Customer profile not found. Complete signup first.");

    const storeRef = await resolveReferenceStore(user.tenant_id, referenceCode);
    if (!storeRef) throw new Error("Invalid store reference code.");

    await pool.query(
        `INSERT INTO customer_store_access (
            id, customer_profile_id, warehouse_id, tenant_id, access_source, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'reference', now(), now())
        ON CONFLICT (customer_profile_id, warehouse_id)
        DO UPDATE SET updated_at = now()`,
        [uuidv4(), profileResult.rows[0].id, storeRef.warehouse_id, user.tenant_id]
    );

    return { warehouse_id: storeRef.warehouse_id, reference_code: referenceCode };
};

export const getCustomerStoresService = async (user) => {
    const result = await pool.query(
        `SELECT csa.warehouse_id, w.name, w.address, w.minimum_order_amount, csa.access_source, csa.created_at
         FROM customer_profiles cp
         JOIN customer_store_access csa ON csa.customer_profile_id = cp.id AND csa.tenant_id = cp.tenant_id
         LEFT JOIN warehouses w ON w.id = csa.warehouse_id
         WHERE cp.user_id = $1 AND cp.tenant_id = $2
         ORDER BY csa.created_at ASC`,
        [user.id, user.tenant_id]
    );
    return result.rows;
};
