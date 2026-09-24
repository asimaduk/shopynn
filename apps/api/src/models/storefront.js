/**
 * Public WhatsApp / mobile-web storefront (apps/site).
 * Catalog by store reference_code; phone OTP auth; order into existing orders pipeline.
 */

import pool from "../config/db.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { normalizeProductRow } from "../util/productNormalize.js";
import { resolveStoreReferencePublicService } from "./customerProfile.js";
import { CUSTOMER_PORTAL_PERMISSION_CODES } from "../constants/permissionCodes.js";
import { sendSmsService } from "../services/sms.js";
import { createOrderService, settleOrderPaymentByReference } from "./order.js";

const PURPOSE_PHONE = "storefront_phone";
const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const saltRounds = 12;

const hashOtp = (phone, code) =>
    crypto
        .createHash("sha256")
        .update(`${process.env.OTP_SECRET || "ims-email-otp"}:${PURPOSE_PHONE}:${phone}:${code}`)
        .digest("hex");

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

/** Normalize Ghana-friendly MSISDN to digits starting with 233 when possible. */
export function normalizeStorefrontPhone(raw) {
    let digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("0") && digits.length === 10) digits = `233${digits.slice(1)}`;
    if (digits.length === 9) digits = `233${digits}`;
    return digits;
}

function assertValidPhone(digits) {
    if (!digits || digits.length < 10 || digits.length > 15) {
        const err = new Error("Enter a valid mobile number.");
        err.status = 400;
        err.code = "INVALID_PHONE";
        throw err;
    }
}

function allowDevOtpInResponse() {
    if (process.env.STOREFRONT_OTP_DEV === "true") return true;
    if (process.env.STOREFRONT_OTP_DEV === "false") return false;
    return process.env.NODE_ENV !== "production";
}

async function ensureCustomerRoleWithPermissions(client, tenantId) {
    const existingRole = await client.query(
        `SELECT id FROM roles WHERE tenant_id = $1 AND lower(name) = 'customer' LIMIT 1`,
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
    const perms = await client.query(
        `SELECT id FROM permissions WHERE code = ANY($1::text[])`,
        [CUSTOMER_PORTAL_PERMISSION_CODES]
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
}

export async function getPublicStorefrontService(referenceCode) {
    const store = await resolveStoreReferencePublicService(referenceCode);
    const wh = await pool.query(
        `SELECT id, name, address, coalesce(minimum_order_amount, 0)::numeric AS minimum_order_amount
         FROM warehouses WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [store.warehouse_id, store.tenant_id]
    );
    return {
        ...store,
        store: {
            ...store.store,
            minimum_order_amount: Number(wh.rows[0]?.minimum_order_amount || 0),
        },
        share_path: `/s/${store.reference_code}`,
    };
}

export async function getPublicStoreCatalogService(referenceCode, query = {}) {
    const store = await resolveStoreReferencePublicService(referenceCode);
    const searchKey = String(query.search || query.q || "").trim();
    const params = [store.tenant_id, store.warehouse_id];
    let where = `p.tenant_id = $1 AND inv.warehouse_id = $2 AND coalesce(inv.quantity_available, 0) > 0 AND coalesce(p.is_active, true) = true`;
    if (searchKey) {
        params.push(`%${searchKey}%`);
        where += ` AND (p.name ILIKE $3 OR p.sku ILIKE $3)`;
    }

    // products.is_active may not exist on all DBs — fall back without it
    let result;
    try {
        result = await pool.query(
            `SELECT
                p.id, p.name, p.sku, p.unit_price, p.alt_price, p.thumbnail, p.slug,
                p.product_type, p.measurement_unit, p.allows_fractional_qty, p.min_order_qty, p.qty_step,
                p.installment_enabled, p.installment_min_initial_percent, p.installment_min_payment_amount,
                inv.quantity_available, inv.warehouse_id, w.name AS warehouse_name
             FROM products p
             JOIN inventories inv ON inv.product_id = p.id AND inv.tenant_id = p.tenant_id
             LEFT JOIN warehouses w ON w.id = inv.warehouse_id
             WHERE ${where}
             ORDER BY p.name ASC
             LIMIT 200`,
            params
        );
    } catch (e) {
        if (String(e.message || "").includes("is_active")) {
            where = `p.tenant_id = $1 AND inv.warehouse_id = $2 AND coalesce(inv.quantity_available, 0) > 0`;
            if (searchKey) where += ` AND (p.name ILIKE $3 OR p.sku ILIKE $3)`;
            result = await pool.query(
                `SELECT
                    p.id, p.name, p.sku, p.unit_price, p.alt_price, p.thumbnail, p.slug,
                    p.product_type, p.measurement_unit, p.allows_fractional_qty, p.min_order_qty, p.qty_step,
                    p.installment_enabled, p.installment_min_initial_percent, p.installment_min_payment_amount,
                    inv.quantity_available, inv.warehouse_id, w.name AS warehouse_name
                 FROM products p
                 JOIN inventories inv ON inv.product_id = p.id AND inv.tenant_id = p.tenant_id
                 LEFT JOIN warehouses w ON w.id = inv.warehouse_id
                 WHERE ${where}
                 ORDER BY p.name ASC
                 LIMIT 200`,
                params
            );
        } else {
            throw e;
        }
    }

    const enriched = await getPublicStorefrontService(referenceCode);
    return {
        store: enriched,
        products: result.rows.map(normalizeProductRow),
    };
}

export async function getPublicStoreProductService(referenceCode, productKey) {
    const store = await resolveStoreReferencePublicService(referenceCode);
    const key = String(productKey || "").trim();
    if (!key) return null;

    const baseSelect = `
            p.id, p.name, p.sku, p.unit_price, p.alt_price, p.thumbnail, p.slug, p.description,
            p.picture1, p.picture2, p.picture3, p.picture4,
            p.product_type, p.measurement_unit, p.allows_fractional_qty, p.min_order_qty, p.qty_step,
            p.installment_enabled, p.installment_min_initial_percent, p.installment_min_payment_amount,
            inv.quantity_available, inv.warehouse_id, w.name AS warehouse_name
         FROM products p
         JOIN inventories inv ON inv.product_id = p.id AND inv.tenant_id = p.tenant_id
         LEFT JOIN warehouses w ON w.id = inv.warehouse_id
         WHERE p.tenant_id = $1
           AND inv.warehouse_id = $2
           AND (p.id::text = $3 OR lower(coalesce(p.slug, '')) = lower($3))
           AND coalesce(inv.quantity_available, 0) > 0`;

    let result;
    try {
        result = await pool.query(
            `SELECT ${baseSelect}
           AND coalesce(p.is_active, true) = true
         LIMIT 1`,
            [store.tenant_id, store.warehouse_id, key]
        );
    } catch (e) {
        if (String(e.message || "").includes("is_active")) {
            result = await pool.query(
                `SELECT ${baseSelect}
         LIMIT 1`,
                [store.tenant_id, store.warehouse_id, key]
            );
        } else {
            throw e;
        }
    }
    const row = result.rows[0];
    if (!row) return null;
    const enriched = await getPublicStorefrontService(referenceCode);
    const pathKey = String(row.slug || row.id).trim();
    return {
        store: enriched,
        product: normalizeProductRow(row),
        share_path: `/s/${enriched.reference_code}/p/${pathKey}`,
    };
}

export async function sendStorefrontPhoneOtpService({ phone, reference_code }) {
    const store = await resolveStoreReferencePublicService(reference_code);
    const normalized = normalizeStorefrontPhone(phone);
    assertValidPhone(normalized);

    const recent = await pool.query(
        `SELECT created_at FROM email_verification_codes
         WHERE lower(email) = $1 AND purpose = $2
         ORDER BY created_at DESC LIMIT 1`,
        [normalized, PURPOSE_PHONE]
    );
    if (recent.rowCount > 0) {
        const last = new Date(recent.rows[0].created_at).getTime();
        if (Date.now() - last < RESEND_COOLDOWN_MS) {
            const err = new Error("Please wait a minute before requesting another code.");
            err.status = 400;
            err.code = "OTP_COOLDOWN";
            throw err;
        }
    }

    const code = generateOtp();
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await pool.query(
        `INSERT INTO email_verification_codes (
            id, email, purpose, code_hash, attempts, expires_at, created_at
        ) VALUES ($1, $2, $3, $4, 0, $5, now())`,
        [id, normalized, PURPOSE_PHONE, hashOtp(normalized, code), expiresAt]
    );

    const sms = await sendSmsService({
        to: normalized,
        message: `Your Shopynn code is ${code}. It expires in 10 minutes.`,
    });

    if (!sms.ok) {
        console.info(
            `[storefront OTP] phone=${normalized} store=${store.reference_code} code=${code} sms=${sms.error || "n/a"}`
        );
        if (!allowDevOtpInResponse()) {
            await pool.query(`DELETE FROM email_verification_codes WHERE id = $1`, [id]);
            const err = new Error(
                "We couldn't send an SMS right now. Please try again in a moment."
            );
            err.status = 503;
            err.code = "SMS_SEND_FAILED";
            throw err;
        }
    }

    const result = {
        phone: normalized,
        reference_code: store.reference_code,
        expires_in_seconds: Math.floor(OTP_TTL_MS / 1000),
        sms_sent: Boolean(sms.ok),
    };
    if (allowDevOtpInResponse() && !sms.ok) {
        result.dev_code = code;
        result.dev_hint = "SMS not configured — use dev_code in non-production.";
    }
    return result;
}

export async function verifyStorefrontPhoneOtpService({ phone, otp, reference_code }) {
    await resolveStoreReferencePublicService(reference_code);
    const normalized = normalizeStorefrontPhone(phone);
    assertValidPhone(normalized);
    const code = String(otp || "").trim();
    if (!/^\d{6}$/.test(code)) {
        const err = new Error("Enter the 6-digit code.");
        err.status = 400;
        throw err;
    }

    const rowRes = await pool.query(
        `SELECT id, code_hash, attempts, expires_at
         FROM email_verification_codes
         WHERE lower(email) = $1 AND purpose = $2 AND verified_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [normalized, PURPOSE_PHONE]
    );
    if (!rowRes.rowCount) {
        const err = new Error("No active code. Request a new one.");
        err.status = 400;
        throw err;
    }
    const row = rowRes.rows[0];
    if (new Date(row.expires_at).getTime() < Date.now()) {
        const err = new Error("This code has expired. Request a new one.");
        err.status = 400;
        throw err;
    }
    if (Number(row.attempts) >= MAX_ATTEMPTS) {
        const err = new Error("Too many attempts. Request a new code.");
        err.status = 400;
        throw err;
    }

    const match = hashOtp(normalized, code) === row.code_hash;
    await pool.query(`UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    if (!match) {
        const err = new Error("Incorrect code.");
        err.status = 400;
        throw err;
    }

    const sessionToken = uuidv4().replace(/-/g, "");
    const tokenExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await pool.query(
        `UPDATE email_verification_codes
         SET verified_at = now(), verification_token = $1, expires_at = $2
         WHERE id = $3`,
        [sessionToken, tokenExpiresAt, row.id]
    );

    const existing = await pool.query(
        `SELECT id, first_name, last_name, email FROM users WHERE phone = $1 LIMIT 1`,
        [normalized]
    );
    const user = existing.rows[0] || null;

    return {
        phone: normalized,
        session_token: sessionToken,
        expires_in_seconds: Math.floor(SESSION_TTL_MS / 1000),
        existing_customer: Boolean(user),
        first_name: user?.first_name || null,
        last_name: user?.last_name || null,
    };
}

async function assertStorefrontSession(phone, sessionToken) {
    const normalized = normalizeStorefrontPhone(phone);
    const token = String(sessionToken || "").trim();
    if (!normalized || !token) {
        const err = new Error("Phone verification is required.");
        err.status = 401;
        err.code = "SESSION_REQUIRED";
        throw err;
    }
    const res = await pool.query(
        `SELECT id, expires_at FROM email_verification_codes
         WHERE lower(email) = $1
           AND purpose = $2
           AND verification_token = $3
           AND verified_at IS NOT NULL
         ORDER BY verified_at DESC
         LIMIT 1`,
        [normalized, PURPOSE_PHONE, token]
    );
    if (!res.rowCount || new Date(res.rows[0].expires_at).getTime() < Date.now()) {
        const err = new Error("Phone verification expired. Verify again.");
        err.status = 401;
        err.code = "SESSION_EXPIRED";
        throw err;
    }
    return normalized;
}

/**
 * Ensure user + customer profile linked to store; return JWT-ready user context.
 */
export async function ensureStorefrontCustomer({
    phone,
    firstName,
    lastName,
    store,
}) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        let userRes = await client.query(
            `SELECT id, first_name, last_name, email, tenant_id, warehouse_id
             FROM users WHERE phone = $1 LIMIT 1 FOR UPDATE`,
            [phone]
        );
        let userId;
        if (userRes.rowCount) {
            userId = userRes.rows[0].id;
            // Attach to this tenant if different? Multi-tenant phone is hard —
            // if existing user on another tenant, throw.
            if (userRes.rows[0].tenant_id && userRes.rows[0].tenant_id !== store.tenant_id) {
                const err = new Error(
                    "This phone is already registered with another shop. Contact support or use a different number."
                );
                err.status = 409;
                err.code = "PHONE_OTHER_TENANT";
                throw err;
            }
            if (firstName || lastName) {
                await client.query(
                    `UPDATE users SET
                        first_name = COALESCE(NULLIF($1, ''), first_name),
                        last_name = COALESCE(NULLIF($2, ''), last_name),
                        warehouse_id = COALESCE(warehouse_id, $3),
                        tenant_id = COALESCE(tenant_id, $4),
                        updated_at = now()
                     WHERE id = $5`,
                    [firstName || "", lastName || "", store.warehouse_id, store.tenant_id, userId]
                );
            } else {
                await client.query(
                    `UPDATE users SET
                        warehouse_id = COALESCE(warehouse_id, $1),
                        tenant_id = COALESCE(tenant_id, $2),
                        updated_at = now()
                     WHERE id = $3`,
                    [store.warehouse_id, store.tenant_id, userId]
                );
            }
        } else {
            if (!firstName || !lastName) {
                const err = new Error("First and last name are required for new customers.");
                err.status = 400;
                err.code = "NAME_REQUIRED";
                throw err;
            }
            const roleId = await ensureCustomerRoleWithPermissions(client, store.tenant_id);
            userId = uuidv4();
            const email = `${phone}@otp.shopynn.local`;
            const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), saltRounds);
            await client.query(
                `INSERT INTO users (
                    id, first_name, last_name, email, tenant_id, phone, password, temporary_password,
                    created_at, is_active, registration_method, warehouse_id, password_expires_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, NULL,
                    now(), true, 'storefront_otp', $8, NULL
                )`,
                [
                    userId,
                    firstName,
                    lastName,
                    email,
                    store.tenant_id,
                    phone,
                    passwordHash,
                    store.warehouse_id,
                ]
            );
            await client.query(
                `INSERT INTO user_roles (id, user_id, role_id, assigned_by, created_at)
                 VALUES ($1, $2, $3, $2, now())
                 ON CONFLICT (user_id, role_id) DO NOTHING`,
                [uuidv4(), userId, roleId]
            );
        }

        let profileRes = await client.query(
            `SELECT id FROM customer_profiles WHERE user_id = $1 AND tenant_id = $2 LIMIT 1`,
            [userId, store.tenant_id]
        );
        let profileId = profileRes.rows[0]?.id;
        if (!profileId) {
            profileId = uuidv4();
            await client.query(
                `INSERT INTO customer_profiles (
                    id, user_id, tenant_id, signup_reference_code, default_warehouse_id, profile_type, created_at, updated_at
                 ) VALUES ($1, $2, $3, $4, $5, 'customer', now(), now())`,
                [profileId, userId, store.tenant_id, store.reference_code, store.warehouse_id]
            );
        }

        await client.query(
            `INSERT INTO customer_store_access (
                id, customer_profile_id, warehouse_id, tenant_id, access_source, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, 'reference', now(), now())
             ON CONFLICT (customer_profile_id, warehouse_id) DO UPDATE SET updated_at = now()`,
            [uuidv4(), profileId, store.warehouse_id, store.tenant_id]
        );

        await client.query("COMMIT");

        return {
            id: userId,
            tenant_id: store.tenant_id,
            warehouse_id: store.warehouse_id,
            profile_id: profileId,
        };
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
}

/**
 * Complete WhatsApp/web checkout: verified phone session → ensure customer → create order → JWT.
 */
export async function createStorefrontOrderService(payload = {}) {
    const store = await resolveStoreReferencePublicService(payload.reference_code);
    const phone = await assertStorefrontSession(payload.phone, payload.session_token);

    const firstName = String(payload.first_name || "").trim();
    const lastName = String(payload.last_name || "").trim();

    const user = await ensureStorefrontCustomer({
        phone,
        firstName,
        lastName,
        store,
    });

    const token = jwt.sign(
        { id: user.id, warehouse_id: user.warehouse_id, tenant_id: user.tenant_id },
        process.env.JWT_SECRET
    );

    const authUser = {
        id: user.id,
        tenant_id: user.tenant_id,
        warehouse_id: user.warehouse_id,
    };

    const order = await createOrderService(authUser, {
        warehouse_id: store.warehouse_id,
        fulfillment_type: payload.fulfillment_type || "pickup",
        notes: payload.notes || `Ordered via web storefront (${store.reference_code})`,
        delivery_address: payload.delivery_address || null,
        items: payload.items || [],
        payment_mode: payload.payment_mode || "full",
        initial_payment_amount: payload.initial_payment_amount,
        use_catalog_prices: true,
    });

    return {
        token,
        order,
        store,
        customer: {
            id: user.id,
            phone,
            first_name: firstName || null,
            last_name: lastName || null,
        },
    };
}

/**
 * Card-return / lost-session verify: order must belong to this store; reference is the capability.
 */
export async function publicVerifyStorefrontOrderPaymentService({
    reference_code,
    orderId,
    reference,
}) {
    const store = await resolveStoreReferencePublicService(reference_code);
    const id = String(orderId || "").trim();
    const ref = String(reference || "").trim();
    if (!id) {
        const err = new Error("orderId is required.");
        err.status = 400;
        throw err;
    }
    if (!ref) {
        const err = new Error("reference is required.");
        err.status = 400;
        throw err;
    }

    const orderRes = await pool.query(
        `SELECT id, warehouse_id, tenant_id
         FROM orders
         WHERE id = $1 AND tenant_id = $2
         LIMIT 1`,
        [id, store.tenant_id]
    );
    const order = orderRes.rows[0];
    if (!order) {
        const err = new Error("Order not found.");
        err.status = 404;
        throw err;
    }
    if (String(order.warehouse_id) !== String(store.warehouse_id)) {
        const err = new Error("Order does not belong to this store.");
        err.status = 403;
        throw err;
    }

    return settleOrderPaymentByReference({
        tenant_id: store.tenant_id,
        orderId: id,
        reference: ref,
    });
}
