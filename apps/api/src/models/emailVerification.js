import pool from "../config/db.js";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { sendEmailService } from "./mail.js";

const PURPOSE_SHOP_OWNER = "shop_owner_signup";
const OTP_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const hashOtp = (email, code, purpose) =>
    crypto
        .createHash("sha256")
        .update(`${process.env.OTP_SECRET || "ims-email-otp"}:${purpose}:${email}:${code}`)
        .digest("hex");

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

export async function sendShopOwnerEmailOtpService(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new Error("Email is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        throw new Error("Enter a valid email address.");
    }

    const existing = await pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [normalized]);
    if (existing.rowCount > 0) {
        throw new Error("An account with this email already exists. Sign in or use a different email.");
    }

    const recent = await pool.query(
        `SELECT created_at FROM email_verification_codes
         WHERE lower(email) = $1 AND purpose = $2
         ORDER BY created_at DESC LIMIT 1`,
        [normalized, PURPOSE_SHOP_OWNER]
    );
    if (recent.rowCount > 0) {
        const last = new Date(recent.rows[0].created_at).getTime();
        if (Date.now() - last < RESEND_COOLDOWN_MS) {
            throw new Error("Please wait a minute before requesting another code.");
        }
    }

    const code = generateOtp();
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await pool.query(
        `INSERT INTO email_verification_codes (
            id, email, purpose, code_hash, attempts, expires_at, created_at
        ) VALUES ($1, $2, $3, $4, 0, $5, now())`,
        [id, normalized, PURPOSE_SHOP_OWNER, hashOtp(normalized, code, PURPOSE_SHOP_OWNER), expiresAt]
    );

    await sendEmailService({
        sender_name: "Shopynn",
        receipient: normalized,
        subject: "Verify your email — Shopynn shop signup",
        title: "Your verification code",
        message: `Use this code to verify your owner login email:\n\n${code}\n\nThis code expires in 10 minutes. If you did not request this, you can ignore this email.`,
        text: `Your Shopynn verification code is ${code}. It expires in 10 minutes.`,
        html: `<p>Use this code to verify your owner login email:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes.</p>`,
    });

    return { email: normalized, expires_in_seconds: Math.floor(OTP_TTL_MS / 1000) };
}

export async function verifyShopOwnerEmailOtpService(email, otp) {
    const normalized = normalizeEmail(email);
    const code = String(otp || "").trim();
    if (!normalized) throw new Error("Email is required.");
    if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code from your email.");

    const rowRes = await pool.query(
        `SELECT id, code_hash, attempts, expires_at, verified_at, verification_token
         FROM email_verification_codes
         WHERE lower(email) = $1 AND purpose = $2 AND verified_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [normalized, PURPOSE_SHOP_OWNER]
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

    const match = hashOtp(normalized, code, PURPOSE_SHOP_OWNER) === row.code_hash;
    await pool.query(
        `UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1`,
        [row.id]
    );

    if (!match) {
        throw new Error("Incorrect code. Check your email and try again.");
    }

    const verificationToken = uuidv4().replace(/-/g, "");
    const verifiedAt = new Date();
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await pool.query(
        `UPDATE email_verification_codes
         SET verified_at = $1,
             verification_token = $2,
             expires_at = $3
         WHERE id = $4`,
        [verifiedAt, verificationToken, tokenExpiresAt, row.id]
    );

    return {
        email: normalized,
        verification_token: verificationToken,
        expires_in_seconds: Math.floor(TOKEN_TTL_MS / 1000),
    };
}

export async function assertShopOwnerEmailVerified(ownerEmail, verificationToken) {
    const normalized = normalizeEmail(ownerEmail);
    const token = String(verificationToken || "").trim();
    if (!normalized || !token) {
        throw new Error("Owner email verification is required. Verify your email with the code we sent.");
    }

    const res = await pool.query(
        `SELECT id, expires_at FROM email_verification_codes
         WHERE lower(email) = $1
           AND purpose = $2
           AND verification_token = $3
           AND verified_at IS NOT NULL
         ORDER BY verified_at DESC
         LIMIT 1`,
        [normalized, PURPOSE_SHOP_OWNER, token]
    );
    if (!res.rowCount) {
        throw new Error("Email verification is invalid or expired. Verify your owner email again.");
    }
    if (new Date(res.rows[0].expires_at).getTime() < Date.now()) {
        throw new Error("Email verification has expired. Verify your owner email again.");
    }
}
