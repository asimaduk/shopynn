/**
 * Phone OTP login — lets storefront customers sign into the mobile app without knowing
 * the synthetic email/password. Staff and owners must use email and password.
 */

import pool from "../config/db.js";
import crypto from "crypto";
import { generateOtp } from "../util/secureRandom.js";
import { assertOtpQuota } from "../util/otpQuota.js";
import { signUserToken } from "../util/authToken.js";
import { v4 as uuidv4 } from "uuid";
import { sendSmsService } from "../services/sms.js";
import { maskPhone, otpForLog } from "../util/devOtp.js";
import { normalizeStorefrontPhone } from "./storefront.js";
import { isCustomerOnlyAccount } from "../util/customerAccount.js";

const PURPOSE = "phone_login";
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashOtp = (phone, code) =>
    crypto
        .createHash("sha256")
        .update(`${process.env.OTP_SECRET || "ims-email-otp"}:${PURPOSE}:${phone}:${code}`)
        .digest("hex");


function assertValidPhone(digits) {
    if (!digits || digits.length < 10 || digits.length > 15) {
        const err = new Error("Enter a valid mobile number.");
        err.status = 400;
        err.code = "INVALID_PHONE";
        throw err;
    }
}

async function findActiveUserByPhone(normalized) {
    const res = await pool.query(
        `SELECT id, first_name, last_name, email, phone, tenant_id, warehouse_id, is_active, deleted
         FROM users
         WHERE phone = $1
         LIMIT 1`,
        [normalized]
    );
    return res.rows[0] || null;
}

export async function sendPhoneLoginOtpService({ phone }) {
    const normalized = normalizeStorefrontPhone(phone);
    assertValidPhone(normalized);

    // Same response for every number so this endpoint can't be used to find out who has an account;
    // the SMS only goes to active customer accounts. Verify rejects everyone else.
    const user = await findActiveUserByPhone(normalized);
    const eligible = Boolean(user && !user.deleted && user.is_active && (await isCustomerOnlyAccount(user.id)));

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
            const err = new Error(`Please wait ${retryAfter}s before requesting another code.`);
            err.status = 400;
            err.code = "OTP_COOLDOWN";
            err.retry_after_seconds = retryAfter;
            throw err;
        }
    }

    await assertOtpQuota(normalized);
    const code = generateOtp();
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await pool.query(
        `INSERT INTO email_verification_codes (
            id, email, purpose, code_hash, attempts, expires_at, created_at
        ) VALUES ($1, $2, $3, $4, 0, $5, now())`,
        [id, normalized, PURPOSE, hashOtp(normalized, code), expiresAt]
    );

    // Not awaited: response time must not reveal whether the number has an account.
    if (eligible) {
        sendSmsService({
            to: normalized,
            message: `Your Shopynn login code is ${code}. It expires in 10 minutes.`,
        })
            .then((sms) => {
                if (!sms.ok) {
                    console.info(`[phone login OTP] phone=${maskPhone(normalized)} code=${otpForLog(code)} sms=${sms.error || "n/a"}`);
                }
            })
            .catch((err) => {
                console.error(`[phone login OTP] phone=${maskPhone(normalized)} sms failed: ${err?.message || err}`);
            });
    }

    return {
        phone: normalized,
        expires_in_seconds: Math.floor(OTP_TTL_MS / 1000),
        resend_cooldown_seconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
    };
}

export async function verifyPhoneLoginOtpService({ phone, otp }) {
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
        err.code = "OTP_MAX_ATTEMPTS";
        throw err;
    }

    const match = hashOtp(normalized, code) === row.code_hash;
    await pool.query(`UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    if (!match) {
        const attemptsUsed = Number(row.attempts) + 1;
        const remaining = Math.max(0, MAX_ATTEMPTS - attemptsUsed);
        const err = new Error(
            remaining > 0
                ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
                : "Too many attempts. Request a new code."
        );
        err.status = 400;
        err.code = remaining > 0 ? "OTP_INVALID" : "OTP_MAX_ATTEMPTS";
        err.attempts_remaining = remaining;
        throw err;
    }

    // Checked only after a correct code, so a wrong guess can't reveal whether the number has an account.
    const user = await findActiveUserByPhone(normalized);
    if (!user || user.deleted) {
        const err = new Error("No Shopynn account for this number.");
        err.status = 404;
        err.code = "PHONE_NOT_FOUND";
        throw err;
    }
    if (!user.is_active) {
        const err = new Error("Your account is inactive.");
        err.status = 403;
        err.code = "ACCOUNT_INACTIVE";
        throw err;
    }
    if (!(await isCustomerOnlyAccount(user.id))) {
        const err = new Error("Phone sign-in is for customers. Staff, please sign in with your email and password.");
        err.status = 403;
        err.code = "PHONE_LOGIN_CUSTOMERS_ONLY";
        throw err;
    }

    await pool.query(
        `UPDATE email_verification_codes SET verified_at = now() WHERE id = $1`,
        [row.id]
    );

    const token = await signUserToken(user);

    await pool.query(`UPDATE users SET last_login = now() WHERE id = $1`, [user.id]);

    return {
        token,
        phone: normalized,
        user: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone,
        },
    };
}
