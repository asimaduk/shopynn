/**
 * Authenticated user phone change — SMS OTP to the new number.
 */

import pool from "../config/db.js";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { sendSmsService } from "../services/sms.js";
import { normalizeStorefrontPhone } from "./storefront.js";

const PURPOSE = "change_phone";
const OTP_TTL_MS = 10 * 60 * 1000;
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
        throw new Error("Enter a valid mobile number.");
    }
}

function allowDevOtpInResponse() {
    if (process.env.STOREFRONT_OTP_DEV === "true") return true;
    if (process.env.STOREFRONT_OTP_DEV === "false") return false;
    return process.env.NODE_ENV !== "production";
}

async function assertActiveUser(userId) {
    const id = String(userId || "").trim();
    if (!id) throw new Error("Not authenticated.");
    const res = await pool.query(
        `SELECT id, email, phone
         FROM users
         WHERE id = $1 AND deleted IS NOT TRUE
         LIMIT 1`,
        [id]
    );
    if (!res.rowCount) throw new Error("Not authenticated.");
    return res.rows[0];
}

export async function sendChangePhoneOtpService({ userId, phone }) {
    const user = await assertActiveUser(userId);
    const normalized = normalizeStorefrontPhone(phone);
    assertValidPhone(normalized);

    const current = normalizeStorefrontPhone(user.phone);
    if (current && current === normalized) {
        throw new Error("That is already your phone number.");
    }

    const existing = await pool.query(
        `SELECT id FROM users WHERE phone = $1 AND id <> $2 AND deleted IS NOT TRUE LIMIT 1`,
        [normalized, user.id]
    );
    if (existing.rowCount > 0) {
        throw new Error("An account with this phone number already exists. Use a different number.");
    }

    const recent = await pool.query(
        `SELECT created_at FROM email_verification_codes
         WHERE lower(email) = $1 AND purpose = $2
         ORDER BY created_at DESC LIMIT 1`,
        [normalized, PURPOSE]
    );
    if (recent.rowCount > 0) {
        const last = new Date(recent.rows[0].created_at).getTime();
        const elapsed = Date.now() - last;
        if (elapsed < RESEND_COOLDOWN_MS) {
            const retryAfter = Math.max(1, Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000));
            throw new Error(`Please wait ${retryAfter}s before requesting another code.`);
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
        message: `Your Shopynn phone change code is ${code}. It expires in 10 minutes.`,
    });

    if (!sms.ok) {
        console.info(`[change phone OTP] phone=${normalized} code=${code} sms=${sms.error || "n/a"}`);
    }

    const result = {
        phone: normalized,
        expires_in_seconds: Math.floor(OTP_TTL_MS / 1000),
        resend_cooldown_seconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
        sms_sent: Boolean(sms.ok),
    };
    if (allowDevOtpInResponse() && !sms.ok) {
        result.dev_code = code;
        result.dev_hint = "SMS not configured — use dev_code in non-production.";
    }
    return result;
}

export async function verifyChangePhoneOtpService({ userId, phone, otp }) {
    const user = await assertActiveUser(userId);
    const normalized = normalizeStorefrontPhone(phone);
    assertValidPhone(normalized);
    const code = String(otp || "").trim();
    if (!/^\d{6}$/.test(code)) {
        throw new Error("Enter the 6-digit code from your SMS.");
    }

    const current = normalizeStorefrontPhone(user.phone);
    if (current && current === normalized) {
        throw new Error("That is already your phone number.");
    }

    const existing = await pool.query(
        `SELECT id FROM users WHERE phone = $1 AND id <> $2 AND deleted IS NOT TRUE LIMIT 1`,
        [normalized, user.id]
    );
    if (existing.rowCount > 0) {
        throw new Error("An account with this phone number already exists. Use a different number.");
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
        throw new Error("No active verification code. Request a new code.");
    }

    const row = rowRes.rows[0];
    if (new Date(row.expires_at).getTime() < Date.now()) {
        throw new Error("This code has expired. Request a new code.");
    }
    if (Number(row.attempts) >= MAX_ATTEMPTS) {
        throw new Error("Too many attempts. Request a new code.");
    }

    const match = hashOtp(normalized, code) === row.code_hash;
    await pool.query(`UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    if (!match) {
        throw new Error("Incorrect code. Check your SMS and try again.");
    }

    await pool.query(`UPDATE email_verification_codes SET verified_at = now() WHERE id = $1`, [row.id]);

    const updated = await pool.query(
        `UPDATE users
         SET phone = $1, updated_at = now()
         WHERE id = $2
         RETURNING id, email, first_name, last_name, phone`,
        [normalized, user.id]
    );
    if (!updated.rowCount) {
        throw new Error("Could not update phone. Try again.");
    }

    return {
        phone: updated.rows[0].phone,
        user: updated.rows[0],
    };
}
