/**
 * Safe logging: never log Authorization headers, tokens, or full bodies.
 * Use for debugging API requests/responses without leaking secrets.
 */
const SENSITIVE_KEYS = ['authorization', 'Authorization', 'token', 'access_token', 'refresh_token', 'password', 'cookie'];

function stripSensitive(obj) {
    if (obj == null) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(stripSensitive);
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        const lower = k.toLowerCase();
        if (SENSITIVE_KEYS.some((sk) => lower.includes(sk.toLowerCase()))) {
            out[k] = '[REDACTED]';
        } else {
            out[k] = typeof v === 'object' && v !== null ? stripSensitive(v) : v;
        }
    }
    return out;
}

/**
 * Safe request log: method, url path (no query string), and config without auth.
 */
export function safeLogRequest(method, url, config = {}) {
    if (!__DEV__) return;
    try {
        const path = typeof url === 'string' ? url.replace(/\?.*$/, '') : '';
        const headers = config.headers ? stripSensitive(config.headers) : {};
        console.log('[API]', method?.toUpperCase(), path, { headers });
    } catch (_) {}
}

/**
 * Safe response log: status, path; no body (may contain tokens).
 */
export function safeLogResponse(status, url, dataSafe = false) {
    if (!__DEV__) return;
    try {
        const path = typeof url === 'string' ? url.replace(/\?.*$/, '') : '';
        console.log('[API]', status, path, dataSafe ? stripSensitive(dataSafe) : '');
    } catch (_) {}
}

export { stripSensitive };
