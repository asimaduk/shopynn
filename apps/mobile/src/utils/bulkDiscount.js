/**
 * Per-tenant bulk / wholesale discount helpers (mirrors API bulkDiscount.js).
 * Default: disabled until tenant enables in Company Profile.
 */

export const DEFAULT_BULK_DISCOUNT = Object.freeze({
    enabled: false,
    quantity_threshold: 10,
});

function toPositiveInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(9999, Math.floor(n));
}

export function normalizeBulkDiscount(raw) {
    if (!raw || typeof raw !== 'object') {
        return { ...DEFAULT_BULK_DISCOUNT };
    }
    return {
        enabled: Boolean(raw.enabled),
        quantity_threshold: toPositiveInt(raw.quantity_threshold, DEFAULT_BULK_DISCOUNT.quantity_threshold),
    };
}

export function getBulkDiscountFromCompany(company) {
    return normalizeBulkDiscount(company?.settings?.bulk_discount);
}

export function resolveSaleUnitPrice(quantity, unitPrice, altPrice, bulkDiscount) {
    const qty = Number(quantity) || 0;
    const unit = Number(unitPrice) || 0;
    const alt = altPrice != null && altPrice !== '' ? Number(altPrice) : unit;
    const altSafe = Number.isFinite(alt) ? alt : unit;
    const rule = normalizeBulkDiscount(bulkDiscount);
    if (!rule.enabled || qty < rule.quantity_threshold) {
        return unit;
    }
    return altSafe;
}

export function lineDiscountAmount(quantity, unitPrice, altPrice, bulkDiscount) {
    const qty = Number(quantity) || 0;
    const unit = Number(unitPrice) || 0;
    const effective = resolveSaleUnitPrice(qty, unitPrice, altPrice, bulkDiscount);
    return Math.max(0, qty * (unit - effective));
}

export function lineTotal(quantity, unitPrice, altPrice, bulkDiscount) {
    const qty = Number(quantity) || 0;
    return qty * resolveSaleUnitPrice(qty, unitPrice, altPrice, bulkDiscount);
}

export function isPriceMismatchError(err) {
    const code =
        err?.response?.data?.data?.code ||
        err?.response?.data?.code ||
        err?.data?.data?.code ||
        err?.data?.code ||
        err?.code;
    if (String(code || '').toUpperCase() === 'PRICE_MISMATCH') return true;
    const msg = String(err?.response?.data?.message || err?.data?.message || err?.message || '').toLowerCase();
    return msg.includes('price mismatch') || msg.includes('discount mismatch');
}

export function getSaleApiErrorMessage(err, fallback = 'Could not complete sale.') {
    return err?.response?.data?.message || err?.message || fallback;
}
