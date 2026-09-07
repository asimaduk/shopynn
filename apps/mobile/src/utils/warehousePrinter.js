const ALLOWED = new Set(['thermal', 'a4', 'any']);

/**
 * @param {unknown} value
 * @returns {'thermal' | 'a4' | 'any'}
 */
export function normalizeWarehousePrinterType(value) {
    const s =
        value != null && String(value).trim() !== '' ? String(value).toLowerCase() : 'any';
    return ALLOWED.has(s) ? s : 'any';
}
