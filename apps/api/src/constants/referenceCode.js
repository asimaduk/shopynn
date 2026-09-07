/** Customer / warehouse signup reference codes (`warehouse_reference_codes.reference_code`). */

export const REFERENCE_CODE_MIN_LENGTH = 6;
export const REFERENCE_CODE_MAX_LENGTH = 80;

/** Letters, numbers, hyphens, underscores; must start and end with alphanumeric. */
export const REFERENCE_CODE_PATTERN = new RegExp(
    `^[A-Z0-9](?:[A-Z0-9_-]{${REFERENCE_CODE_MIN_LENGTH - 2},${REFERENCE_CODE_MAX_LENGTH - 2}}[A-Z0-9])?$`
);

export const REFERENCE_CODE_VALIDATION_MESSAGE = `Use ${REFERENCE_CODE_MIN_LENGTH}–${REFERENCE_CODE_MAX_LENGTH} characters: letters, numbers, hyphens, and underscores. Must start and end with a letter or number.`;

export function normalizeReferenceCode(value) {
    const code = String(value ?? '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '');
    if (!code) return '';
    if (code.length < REFERENCE_CODE_MIN_LENGTH || code.length > REFERENCE_CODE_MAX_LENGTH) {
        return null;
    }
    if (!REFERENCE_CODE_PATTERN.test(code)) {
        return null;
    }
    return code;
}

export function generateWarehouseReferenceCode(name) {
    const base = String(name ?? '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    let code = `${base || 'STORE'}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    while (code.length < REFERENCE_CODE_MIN_LENGTH) {
        code += Math.random().toString(36).slice(2, 3).toUpperCase();
    }
    return code.slice(0, REFERENCE_CODE_MAX_LENGTH);
}
