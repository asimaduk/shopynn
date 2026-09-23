/**
 * SMS send via configured provider.
 *
 * Hubtel (recommended for Ghana):
 *   SMS_PROVIDER=hubtel
 *   SMS_CLIENT_ID=...          # or SMS_API_KEY
 *   SMS_CLIENT_SECRET=...      # or SMS_API_SECRET
 *   SMS_SENDER_ID=Shopynn      # approved sender ID
 *   SMS_HUBTEL_URL=https://smsc.hubtel.com/v1/messages/send  # optional override
 *
 * Placeholders (not implemented yet):
 *   SMS_PROVIDER=africastalking|twilio
 */

const HUBTEL_DEFAULT_URL = "https://smsc.hubtel.com/v1/messages/send";

function providerName() {
    return String(process.env.SMS_PROVIDER || "")
        .trim()
        .toLowerCase();
}

function hubtelClientId() {
    return String(process.env.SMS_CLIENT_ID || process.env.SMS_API_KEY || "").trim();
}

function hubtelClientSecret() {
    return String(process.env.SMS_CLIENT_SECRET || process.env.SMS_API_SECRET || "").trim();
}

function senderId() {
    return String(process.env.SMS_SENDER_ID || "").trim();
}

/** Normalize to digits; convert Ghana local 0XXXXXXXXX → 233XXXXXXXXX. */
export function normalizeSmsPhone(raw) {
    let digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("0") && digits.length === 10) digits = `233${digits.slice(1)}`;
    if (digits.length === 9) digits = `233${digits}`;
    return digits;
}

export function isSmsConfigured() {
    const provider = providerName();
    if (!provider) return false;
    if (provider === "hubtel") {
        return Boolean(hubtelClientId() && hubtelClientSecret() && senderId());
    }
    // Future providers: require at least an API key so callers can detect intent.
    return Boolean(String(process.env.SMS_API_KEY || "").trim());
}

async function sendViaHubtel({ to, message }) {
    const clientId = hubtelClientId();
    const clientSecret = hubtelClientSecret();
    const from = senderId();
    const phone = normalizeSmsPhone(to);
    if (!phone) return { ok: false, error: "Missing phone number", provider: "hubtel" };
    if (!from) return { ok: false, error: "SMS_SENDER_ID is not set", provider: "hubtel" };
    if (!clientId || !clientSecret) {
        return { ok: false, error: "Hubtel client id/secret not set", provider: "hubtel" };
    }

    const base = String(process.env.SMS_HUBTEL_URL || HUBTEL_DEFAULT_URL).trim() || HUBTEL_DEFAULT_URL;
    const url = new URL(base);
    url.searchParams.set("From", from);
    url.searchParams.set("To", phone);
    url.searchParams.set("Content", message);

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    let res;
    try {
        res = await fetch(url.toString(), {
            method: "GET",
            headers: {
                Authorization: `Basic ${auth}`,
                Accept: "application/json",
            },
        });
    } catch (e) {
        return {
            ok: false,
            provider: "hubtel",
            error: e?.message || "Hubtel request failed",
        };
    }

    let data = null;
    const text = await res.text();
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { raw: text };
    }

    // Hubtel often returns HTTP 201 / 200 with status 0 on success.
    const statusCode = data?.status ?? data?.Status ?? data?.statusCode;
    const successHttp = res.ok || res.status === 201;
    const successBody =
        statusCode === 0 ||
        statusCode === "0" ||
        String(data?.statusDescription || data?.StatusDescription || "")
            .toLowerCase()
            .includes("success");

    if (successHttp && (successBody || statusCode == null)) {
        return {
            ok: true,
            provider: "hubtel",
            id: String(data?.messageId || data?.MessageId || data?.rate || "") || undefined,
            raw: data,
        };
    }

    const errMsg =
        data?.statusDescription ||
        data?.StatusDescription ||
        data?.message ||
        data?.Message ||
        text ||
        `Hubtel SMS failed (HTTP ${res.status})`;

    return {
        ok: false,
        provider: "hubtel",
        error: String(errMsg).slice(0, 300),
        raw: data,
    };
}

/**
 * @param {{ to: string, message: string }} payload
 * @returns {Promise<{ ok: boolean, provider?: string, id?: string, error?: string }>}
 */
export async function sendSmsService({ to, message }) {
    const phone = String(to || "").trim();
    const body = String(message || "").trim();
    if (!phone) return { ok: false, error: "Missing phone number" };
    if (!body) return { ok: false, error: "Missing message" };

    const provider = providerName();
    if (!provider) {
        return { ok: false, error: "SMS not configured" };
    }

    if (provider === "hubtel") {
        if (!isSmsConfigured()) {
            return { ok: false, error: "SMS not configured" };
        }
        return sendViaHubtel({ to: phone, message: body });
    }

    if (provider === "africastalking" || provider === "twilio") {
        return {
            ok: false,
            error: `SMS provider "${provider}" is not implemented yet. Use hubtel.`,
            provider,
        };
    }

    return { ok: false, error: `Unknown SMS provider "${provider}"` };
}

export default { sendSmsService, isSmsConfigured, normalizeSmsPhone };
