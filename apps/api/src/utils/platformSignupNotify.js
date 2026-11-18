/**
 * Platform ops notification recipients for new shop signups.
 * Stored in platform_settings under key signup_notification_emails.
 */

export const SIGNUP_NOTIFICATION_EMAILS_KEY = "signup_notification_emails";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function isValidEmail(value) {
    const s = String(value || "").trim();
    return Boolean(s) && EMAIL_RE.test(s) && s.length <= 254;
}

/**
 * Normalize a comma-separated string or array into unique lowercased emails.
 * Invalid entries are dropped.
 */
export function normalizeSignupNotificationEmails(raw) {
    let list = [];
    if (Array.isArray(raw)) {
        list = raw;
    } else if (raw && typeof raw === "object" && Array.isArray(raw.emails)) {
        list = raw.emails;
    } else if (typeof raw === "string") {
        list = raw.split(/[,;\n]+/);
    }

    const seen = new Set();
    const emails = [];
    for (const item of list) {
        const email = String(item || "").trim().toLowerCase();
        if (!isValidEmail(email) || seen.has(email)) continue;
        seen.add(email);
        emails.push(email);
    }
    return { emails };
}

export function signupEmailsToInputValue(settings) {
    const emails = normalizeSignupNotificationEmails(settings).emails;
    return emails.join(", ");
}
