import pool from "../config/db.js";

export const OTP_QUOTA_PER_HOUR = 5;
export const OTP_QUOTA_PER_DAY = 10;

/**
 * Caps codes sent to one phone number or email across every purpose and every client IP, so the
 * send endpoints can't be used to flood someone's phone or inbox from rotating addresses.
 * `target` is the value stored in email_verification_codes.email (normalized phone or email).
 */
export async function assertOtpQuota(target, db = pool) {
    const r = await db.query(
        `SELECT count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS last_hour,
                count(*)::int AS last_day
         FROM email_verification_codes
         WHERE lower(email) = lower($1) AND created_at > now() - interval '24 hours'`,
        [String(target || "")]
    );
    const { last_hour: lastHour, last_day: lastDay } = r.rows[0];
    if (lastHour >= OTP_QUOTA_PER_HOUR || lastDay >= OTP_QUOTA_PER_DAY) {
        const err = new Error(
            lastDay >= OTP_QUOTA_PER_DAY
                ? "Too many codes have been sent to this number or email today. Try again tomorrow."
                : "Too many codes have been sent to this number or email. Try again in an hour."
        );
        err.status = 429;
        err.code = "OTP_QUOTA";
        throw err;
    }
}
