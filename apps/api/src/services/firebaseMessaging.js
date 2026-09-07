/**
 * Firebase Cloud Messaging (FCM) utility for sending push messages to Android, iOS, and Web.
 *
 * Env:
 *   - GOOGLE_APPLICATION_CREDENTIALS: path to service account JSON file, or
 *   - FIREBASE_SERVICE_ACCOUNT_JSON: stringified JSON of the service account (e.g. from env var)
 *
 * If neither is set, send methods no-op and return stub responses.
 */

import admin from "firebase-admin";

let messaging = null;

function getMessaging() {
    if (messaging) return messaging;
    if (admin.apps.length > 0) {
        messaging = admin.messaging();
        return messaging;
    }
    const cred =
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?
            admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
        : process.env.GOOGLE_APPLICATION_CREDENTIALS ?
            admin.credential.applicationDefault()
        : null;
    if (cred) {
        admin.initializeApp({ credential: cred });
        messaging = admin.messaging();
        return messaging;
    }
    return null;
}

/**
 * Ensure all data payload values are strings (FCM requirement).
 * @param {Record<string, unknown>} data
 * @returns {Record<string, string>}
 */
function stringifyData(data) {
    if (!data || typeof data !== "object") return {};
    const out = {};
    for (const [k, v] of Object.entries(data)) {
        out[k] = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
    }
    return out;
}

/**
 * Build base FCM message payload. notification and data work on Android, iOS, and Web.
 * @param {object} opts
 * @param {{ title: string, body?: string, imageUrl?: string }} [opts.notification]
 * @param {Record<string, unknown>} [opts.data]
 * @param {object} [opts.android] - AndroidConfig overrides
 * @param {object} [opts.apns] - ApnsConfig overrides (iOS)
 * @param {object} [opts.webpush] - WebpushConfig overrides (Web)
 */
function buildMessagePayload(opts) {
    const { notification, data, android, apns, webpush } = opts || {};
    const base = {};
    if (notification && (notification.title || notification.body)) {
        base.notification = {
            title: notification.title || "",
            body: notification.body || "",
            ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
        };
    }
    const dataPayload = stringifyData(data || {});
    if (Object.keys(dataPayload).length > 0) {
        base.data = dataPayload;
    }
    if (android && typeof android === "object") base.android = android;
    if (apns && typeof apns === "object") base.apns = apns;
    if (webpush && typeof webpush === "object") base.webpush = webpush;
    return base;
}

/**
 * Send a message to one or more registration tokens (Android, iOS, Web).
 * @param {string | string[]} tokens - FCM device token(s)
 * @param {object} options - { notification?, data?, android?, apns?, webpush? }
 * @returns {Promise<{ successCount: number, failureCount: number, responses: Array<{ success: boolean, messageId?: string, error?: string }> }>}
 */
export async function sendToTokens(tokens, options = {}) {
    const arr = Array.isArray(tokens) ? tokens : [tokens].filter(Boolean);
    if (arr.length === 0) {
        return { successCount: 0, failureCount: 0, responses: [] };
    }
    const msg = buildMessagePayload(options);
    const m = getMessaging();
    if (!m) {
        return {
            successCount: 0,
            failureCount: arr.length,
            responses: arr.map(() => ({ success: false, error: "Firebase not configured" })),
        };
    }
    if (arr.length === 1) {
        try {
            const messageId = await m.send({ ...msg, token: arr[0] });
            return {
                successCount: 1,
                failureCount: 0,
                responses: [{ success: true, messageId }],
            };
        } catch (err) {
            return {
                successCount: 0,
                failureCount: 1,
                responses: [{ success: false, error: err.message || String(err) }],
            };
        }
    }
    const result = await m.sendEachForMulticast({
        tokens: arr,
        ...msg,
    });
    const responses = result.responses.map((r) =>
        r.success
            ? { success: true, messageId: r.messageId }
            : { success: false, error: r.error?.message || String(r.error) }
    );
    return {
        successCount: result.successCount,
        failureCount: result.failureCount,
        responses,
    };
}

/**
 * Send to a single token (alias; same as sendToTokens with one token).
 */
export async function sendToToken(token, options) {
    return sendToTokens(token, options);
}

/**
 * Send to an FCM topic (all subscribed devices: Android, iOS, Web).
 * @param {string} topic - e.g. "news" or "tenant_<id>"
 * @param {object} options - same as sendToTokens
 * @returns {Promise<{ messageId: string } | { error: string }>}
 */
export async function sendToTopic(topic, options = {}) {
    const msg = buildMessagePayload(options);
    const m = getMessaging();
    if (!m) {
        return { error: "Firebase not configured" };
    }
    try {
        const messageId = await m.send({ ...msg, topic });
        return { messageId };
    } catch (err) {
        return { error: err.message || String(err) };
    }
}

/**
 * Send notification-only message (title/body). Displayed by OS on all platforms.
 * @param {string | string[]} tokens
 * @param {string} title
 * @param {string} [body]
 * @param {{ imageUrl?: string }} [opts]
 */
export async function sendNotification(tokens, title, body = "", opts = {}) {
    return sendToTokens(tokens, {
        notification: { title, body, ...opts },
        ...opts,
    });
}

/**
 * Send data-only message. Client app handles display (background/data handler).
 * All values are stringified. Use for silent updates or custom handling.
 * @param {string | string[]} tokens
 * @param {Record<string, unknown>} data - key-value payload (values stringified)
 */
export async function sendData(tokens, data) {
    return sendToTokens(tokens, { data });
}

/**
 * Send both notification and data. OS can show notification; app receives data when opened.
 * @param {string | string[]} tokens
 * @param {{ title: string, body?: string, imageUrl?: string }} notification
 * @param {Record<string, unknown>} [data]
 * @param {object} [platformOpts] - android, apns, webpush overrides
 */
export async function sendNotificationAndData(tokens, notification, data = {}, platformOpts = {}) {
    return sendToTokens(tokens, {
        notification,
        data,
        ...platformOpts,
    });
}

export default {
    sendToTokens,
    sendToToken,
    sendToTopic,
    sendNotification,
    sendData,
    sendNotificationAndData,
    getMessaging,
};
