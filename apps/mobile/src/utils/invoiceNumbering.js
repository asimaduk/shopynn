/** Device-local invoice numbering: INV-{register}-{n} */

export const DEFAULT_INVOICE_PREFIX = 'INV';
export const DEFAULT_INVOICE_REGISTER_CODE = 'M';
export const DEFAULT_INVOICE_NEXT_NUMBER = 1001;

/** Uppercase A–Z / 0–9, max 4 chars. */
export function normalizeInvoiceRegisterCode(raw) {
    return String(raw ?? '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 4);
}

export function normalizeInvoicePrefix(raw) {
    const p = String(raw ?? '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 8);
    return p || DEFAULT_INVOICE_PREFIX;
}

export function normalizeInvoiceNextNumber(raw) {
    const n = parseInt(String(raw ?? '').trim(), 10);
    if (!Number.isFinite(n) || n < 0) return DEFAULT_INVOICE_NEXT_NUMBER;
    return n;
}

export function formatInvoiceNumber({ prefix, registerCode, number } = {}) {
    const p = normalizeInvoicePrefix(prefix);
    const r = normalizeInvoiceRegisterCode(registerCode);
    const n = normalizeInvoiceNextNumber(number);
    return r ? `${p}-${r}-${n}` : `${p}-${n}`;
}

/** Series part before the sequence number, e.g. "INV-M-". */
export function invoiceSeriesPrefix(appSettings = {}) {
    const p = normalizeInvoicePrefix(appSettings.invoicePrefix);
    const r = normalizeInvoiceRegisterCode(appSettings.invoiceRegisterCode || DEFAULT_INVOICE_REGISTER_CODE);
    return r ? `${p}-${r}-` : `${p}-`;
}

/**
 * Counter value to store after a sale saved. The server may renumber a taken invoice
 * (INV-M-1005 → INV-M-1006), so continue after whichever number it actually saved.
 */
export function nextInvoiceCounterAfterSale(currentNext, requestedNumber, savedNumber) {
    const current = normalizeInvoiceNextNumber(currentNext);
    const seq = String(savedNumber || '').match(/(\d+)$/);
    if (savedNumber && savedNumber !== requestedNumber && seq) {
        return Math.max(current + 1, Number(seq[1]) + 1);
    }
    return current + 1;
}

export function buildInvoiceNumberFromSettings(appSettings = {}) {
    return formatInvoiceNumber({
        prefix: appSettings.invoicePrefix,
        registerCode: appSettings.invoiceRegisterCode || DEFAULT_INVOICE_REGISTER_CODE,
        number: appSettings.invoiceNextNumber,
    });
}
