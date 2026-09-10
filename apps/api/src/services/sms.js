/**
 * SMS send stub. Wire a provider (Hubtel / Africa's Talking / Twilio) later via env.
 *
 * Env (future):
 *   SMS_PROVIDER=hubtel|africastalking|twilio
 *   SMS_API_KEY / SMS_SENDER_ID / ...
 *
 * Until configured, sendSmsService returns { ok: false, error: "SMS not configured" }.
 */

export function isSmsConfigured() {
    return Boolean(String(process.env.SMS_PROVIDER || "").trim() && String(process.env.SMS_API_KEY || "").trim());
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
    if (!isSmsConfigured()) {
        return { ok: false, error: "SMS not configured" };
    }
    // Provider integrations intentionally not implemented yet.
    return { ok: false, error: `SMS provider "${process.env.SMS_PROVIDER}" is not implemented` };
}

export default { sendSmsService, isSmsConfigured };
