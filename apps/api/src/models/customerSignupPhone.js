/**
 * Mobile customer signup via store reference + phone OTP (aligned with WhatsApp storefront).
 */

import pool from "../config/db.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { sendSmsService } from "../services/sms.js";
import { resolveStoreReferencePublicService } from "./customerProfile.js";
import {
    ensureStorefrontCustomer,
    normalizeStorefrontPhone,
} from "./storefront.js";

const PURPOSE = "customer_signup_phone";
const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashOtp = (phone, code) =>
    crypto
        .createHash("sha256")
        .update(`${process.env.OTP_SECRET || "ims-email-otp"}:${PURPOSE}:${phone}:${code}`)
        .digest("hex");

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

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

export async function sendCustomerSignupPhoneOtpService({ phone, reference_code }) {
    const store = await resolveStoreReferencePublicService(reference_code);
    const normalized = normalizeStorefrontPhone(phone);
    assertValidPhone(normalized);

    const recent = await pool.query(
        `SELECT created_at FROM email_verification_codes
         WHERE lower(email) = $1 AND purpose = $2
         ORDER BY created_at DESC LIMIT 1`,
        [normalized, PURPOSE]
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
        [id, normalized, PURPOSE, hashOtp(normalized, code), expiresAt]
    );

    const sms = await sendSmsService({
        to: normalized,
        message: `Your Shopynn signup code is ${code}. It expires in 10 minutes.`,
    });

    if (!sms.ok) {
        console.info(
            `[customer signup OTP] phone=${normalized} store=${store.reference_code} code=${code} sms=${sms.error || "n/a"}`
        );
    }

    const result = {
        phone: normalized,
        reference_code: store.reference_code,
        store_name: store.store?.name || null,
        expires_in_seconds: Math.floor(OTP_TTL_MS / 1000),
        sms_sent: Boolean(sms.ok),
    };
    if (allowDevOtpInResponse() && !sms.ok) {
        result.dev_code = code;
        result.dev_hint = "SMS not configured — use dev_code in non-production.";
    }
    return result;
}

export async function verifyCustomerSignupPhoneOtpService({ phone, otp, reference_code }) {
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
        [normalized, PURPOSE]
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
        `SELECT id, first_name, last_name FROM users WHERE phone = $1 LIMIT 1`,
        [normalized]
    );

    return {
        phone: normalized,
        session_token: sessionToken,
        expires_in_seconds: Math.floor(SESSION_TTL_MS / 1000),
        existing_customer: Boolean(existing.rowCount),
        first_name: existing.rows[0]?.first_name || null,
        last_name: existing.rows[0]?.last_name || null,
    };
}

async function assertCustomerSignupSession(phone, sessionToken) {
    const normalized = normalizeStorefrontPhone(phone);
    const token = String(sessionToken || "").trim();
    if (!token) {
        const err = new Error("Phone verification required.");
        err.status = 401;
        err.code = "SESSION_REQUIRED";
        throw err;
    }
    const res = await pool.query(
        `SELECT id, expires_at FROM email_verification_codes
         WHERE lower(email) = $1 AND purpose = $2 AND verification_token = $3 AND verified_at IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`,
        [normalized, PURPOSE, token]
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
 * Complete customer signup after phone OTP: create/link account, return JWT for immediate login.
 */
export async function completeCustomerSignupPhoneService(payload = {}) {
    const store = await resolveStoreReferencePublicService(payload.reference_code);
    const phone = await assertCustomerSignupSession(payload.phone, payload.session_token);

    const firstName = String(payload.first_name || "").trim();
    const lastName = String(payload.last_name || "").trim();

    const existing = await pool.query(`SELECT id, first_name, last_name FROM users WHERE phone = $1 LIMIT 1`, [
        phone,
    ]);
    if (!existing.rowCount && (!firstName || !lastName)) {
        const err = new Error("First and last name are required for new customers.");
        err.status = 400;
        err.code = "NAME_REQUIRED";
        throw err;
    }

    const user = await ensureStorefrontCustomer({
        phone,
        firstName: firstName || existing.rows[0]?.first_name || "",
        lastName: lastName || existing.rows[0]?.last_name || "",
        store,
    });

    const token = jwt.sign(
        { id: user.id, warehouse_id: user.warehouse_id, tenant_id: user.tenant_id },
        process.env.JWT_SECRET
    );

    await pool.query(`UPDATE users SET last_login = now() WHERE id = $1`, [user.id]);

    return {
        token,
        phone,
        reference_code: store.reference_code,
        warehouse_id: store.warehouse_id,
        warehouse_name: store.store?.name || null,
        user: {
            id: user.id,
            first_name: firstName || existing.rows[0]?.first_name || null,
            last_name: lastName || existing.rows[0]?.last_name || null,
            phone,
        },
    };
}
