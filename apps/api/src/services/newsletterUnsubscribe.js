import crypto from "node:crypto";
import { normalizeEmail } from "../utils/emailNormalize.js";

const siteUrl = () => (process.env.MAIL_SITE_URL || "https://shopynn.app").replace(/\/$/, "");
const apiUrl = () => (process.env.API_PUBLIC_URL || "https://api.shopynn.app").replace(/\/$/, "");

function secret() {
    const s = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || process.env.JWT_SECRET;
    if (!s) throw new Error("NEWSLETTER_UNSUBSCRIBE_SECRET or JWT_SECRET must be set.");
    return s;
}

/** Stable per-address token; changing the secret invalidates links in already-sent emails. */
export function unsubscribeToken(email) {
    return crypto
        .createHmac("sha256", secret())
        .update(`newsletter-unsubscribe:${normalizeEmail(email)}`)
        .digest("base64url");
}

export function isValidUnsubscribeToken(email, token) {
    if (!email || typeof token !== "string" || !token) return false;
    const expected = Buffer.from(unsubscribeToken(email));
    const given = Buffer.from(token);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

function query(email) {
    return new URLSearchParams({ e: normalizeEmail(email), t: unsubscribeToken(email) }).toString();
}

/** Page where the reader confirms (link scanners only GET, so they can't unsubscribe anyone). */
export const unsubscribePageUrl = (email) => `${siteUrl()}/unsubscribe?${query(email)}`;

/** RFC 8058 one-click target for mail apps (Gmail, Apple Mail) that POST to it. */
export const oneClickUnsubscribeUrl = (email) => `${apiUrl()}/api/public/newsletter/unsubscribe/one-click?${query(email)}`;

export function unsubscribeHeaders(email) {
    return {
        "List-Unsubscribe": `<${oneClickUnsubscribeUrl(email)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
}
