/**
 * Step-up verification: a fresh one-time code (SMS to the account phone, or email when SMS is not set
 * up, fails, or there is no phone) before money-moving actions such as withdrawals and payout account changes. A verified code
 * returns a short-lived step-up token that requireStepUp accepts.
 */

import crypto from "crypto";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import pool from "../config/db.js";
import { generateOtp } from "../util/secureRandom.js";
import { assertOtpQuota } from "../util/otpQuota.js";
import { maskEmail, maskPhone, otpForLog } from "../util/devOtp.js";
import { isSmsConfigured, sendSmsService } from "../services/sms.js";
import { sendEmailService } from "./mail.js";
import { buildVerificationCodeEmail } from "../services/accountEmails.js";
import { normalizeStorefrontPhone } from "./storefront.js";

const PURPOSE = "step_up";
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
export const STEP_UP_TTL_SECONDS = 10 * 60;

// Separate key so a step-up token can never pass as a sign-in token, and vice versa.
const stepUpSecret = () => `${process.env.JWT_SECRET}:step-up`;

const hashOtp = (target, code) =>
    crypto
        .createHash("sha256")
        .update(`${process.env.OTP_SECRET || "ims-email-otp"}:${PURPOSE}:${target}:${code}`)
        .digest("hex");

const validationError = (message) => {
    const err = new Error(message);
    err.isStepUpValidation = true;
    return err;
};

/** Codes are stored under whichever contact they were sent to, so both are checked on verify. */
async function getContacts(userId) {
    const r = await pool.query(
        `SELECT phone, email FROM users WHERE id = $1 AND deleted IS NOT TRUE LIMIT 1`,
        [userId]
    );
    if (!r.rowCount) throw new Error("Not authenticated.");
    const normalized = normalizeStorefrontPhone(r.rows[0].phone);
    const phone = normalized && normalized.length >= 10 ? normalized : null;
    const rawEmail = String(r.rows[0].email || "").trim().toLowerCase();
    const email = rawEmail.includes("@") ? rawEmail : null;
    if (!phone && !email) {
        throw validationError("Add a phone number or email to your profile to confirm this action.");
    }
    return { phone, email, targets: [phone, email].filter(Boolean) };
}

async function issueCode(target) {
    await assertOtpQuota(target);
    const code = generateOtp();
    await pool.query(
        `INSERT INTO email_verification_codes (id, email, purpose, code_hash, attempts, expires_at, created_at)
         VALUES ($1, $2, $3, $4, 0, $5, now())`,
        [uuidv4(), target, PURPOSE, hashOtp(target, code), new Date(Date.now() + OTP_TTL_MS)]
    );
    return code;
}

const codeMessage = (code) =>
    `Your Shopynn confirmation code is ${code}. Only enter it if you are making a withdrawal or changing payout details. It expires in 10 minutes.`;

function emailCode(target, code) {
    // Not awaited: SMTP can hang for longer than the app's request timeout.
    sendEmailService({
        sender_name: "Shopynn",
        receipient: target,
        from: "noreply",
        ...buildVerificationCodeEmail({ purpose: "step_up", code }),
    }).catch((err) => {
        console.info(`[step-up OTP] email=${maskEmail(target)} code=${otpForLog(code)} mail=${err?.message || "n/a"}`);
    });
}

const sentVia = (channel, target) => ({
    channel,
    destination: channel === "sms" ? maskPhone(target) : maskEmail(target),
    expires_in_seconds: Math.floor(OTP_TTL_MS / 1000),
    resend_cooldown_seconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
});

export async function sendStepUpCodeService(userId) {
    const { phone, email, targets } = await getContacts(userId);

    const recent = await pool.query(
        `SELECT created_at FROM email_verification_codes
         WHERE lower(email) = ANY($1) AND purpose = $2
         ORDER BY created_at DESC LIMIT 1`,
        [targets, PURPOSE]
    );
    if (recent.rowCount > 0) {
        const elapsed = Date.now() - new Date(recent.rows[0].created_at).getTime();
        if (elapsed < RESEND_COOLDOWN_MS) {
            const retryAfter = Math.max(1, Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000));
            throw validationError(`Please wait ${retryAfter}s before requesting another code.`);
        }
    }

    // SMS first when it is set up; email whenever SMS is unavailable or fails.
    if (phone && isSmsConfigured()) {
        const code = await issueCode(phone);
        const sms = await sendSmsService({ to: phone, message: codeMessage(code) });
        if (sms.ok) return sentVia("sms", phone);
        console.info(`[step-up OTP] phone=${maskPhone(phone)} code=${otpForLog(code)} sms=${sms.error || "n/a"}`);
        if (!email) throw validationError("We couldn't send the SMS. Try again in a moment.");
    }
    if (!email) {
        throw validationError("We can't send codes by SMS right now. Add an email to your profile to continue.");
    }
    emailCode(email, await issueCode(email));
    return sentVia("email", email);
}

export async function verifyStepUpCodeService(user, otp) {
    const code = String(otp || "").trim();
    if (!/^\d{6}$/.test(code)) throw validationError("Enter the 6-digit code.");
    const { targets } = await getContacts(user.id);

    const rowRes = await pool.query(
        `SELECT id, email, code_hash, attempts, expires_at
         FROM email_verification_codes
         WHERE lower(email) = ANY($1) AND purpose = $2 AND verified_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [targets, PURPOSE]
    );
    if (!rowRes.rowCount) throw validationError("No active code. Request a new code.");
    const row = rowRes.rows[0];
    if (new Date(row.expires_at).getTime() < Date.now()) throw validationError("This code has expired. Request a new code.");
    if (Number(row.attempts) >= MAX_ATTEMPTS) throw validationError("Too many attempts. Request a new code.");

    await pool.query(`UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    if (hashOtp(String(row.email).toLowerCase(), code) !== row.code_hash) throw validationError("Incorrect code. Try again.");
    await pool.query(`UPDATE email_verification_codes SET verified_at = now() WHERE id = $1`, [row.id]);

    const token = jwt.sign(
        { id: user.id, ...(user.sid ? { sid: user.sid } : {}), purpose: PURPOSE },
        stepUpSecret(),
        { expiresIn: STEP_UP_TTL_SECONDS }
    );
    return { step_up_token: token, expires_in_seconds: STEP_UP_TTL_SECONDS };
}

/** True when `token` is a live step-up token for this signed-in user and session. */
export function isValidStepUpToken(token, user) {
    if (!token || !user?.id) return false;
    try {
        const decoded = jwt.verify(String(token), stepUpSecret());
        if (decoded.purpose !== PURPOSE || decoded.id !== user.id) return false;
        return (decoded.sid || null) === (user.sid || null);
    } catch {
        return false;
    }
}
