/**
 * Input validation and sanitization for API request bodies.
 * Use before sending user input to the API to reduce injection and bad data.
 */

const DEFAULT_MAX_STRING_LENGTH = 1000;
const STRIP_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Sanitize a string for API: trim, strip control chars, optional max length.
 */
export function sanitizeString(value, maxLength = DEFAULT_MAX_STRING_LENGTH) {
    if (value == null) return value;
    const s = String(value).replace(STRIP_REGEX, '').trim();
    return maxLength > 0 && s.length > maxLength ? s.slice(0, maxLength) : s;
}

/**
 * Sanitize number: ensure it's a finite number or null.
 */
export function sanitizeNumber(value) {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * Sanitize object keys that are strings (recursive one level for nested objects).
 */
export function sanitizeBody(body, stringKeys = null, maxLength = DEFAULT_MAX_STRING_LENGTH) {
    if (body == null || typeof body !== 'object') return body;
    const out = Array.isArray(body) ? [] : {};
    const keys = stringKeys || Object.keys(body);
    for (const key of Object.keys(body)) {
        const v = body[key];
        if (typeof v === 'string') {
            out[key] = sanitizeString(v, maxLength);
        } else if (v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
            out[key] = sanitizeBody(v, null, maxLength);
        } else if (typeof v === 'number') {
            out[key] = Number.isFinite(v) ? v : null;
        } else {
            out[key] = v;
        }
    }
    return out;
}

/**
 * Validate required string (non-empty after trim).
 */
export function requireNonEmpty(value, fieldName = 'Field') {
    const s = sanitizeString(value);
    if (!s) return { valid: false, error: `${fieldName} is required` };
    return { valid: true, value: s };
}

/**
 * Validate value is one of allowed (for enums).
 */
export function requireOneOf(value, allowed, fieldName = 'Field') {
    const s = sanitizeString(value);
    if (!allowed.includes(s)) return { valid: false, error: `${fieldName} must be one of: ${allowed.join(', ')}` };
    return { valid: true, value: s };
}
