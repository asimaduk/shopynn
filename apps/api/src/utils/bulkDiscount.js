/**
 * Per-tenant bulk / wholesale discount preferences.
 * Default: disabled (opt-in). When enabled, qty >= threshold uses alt_price.
 */

export const DEFAULT_BULK_DISCOUNT = Object.freeze({
    enabled: false,
    quantity_threshold: 10,
});

const PRICE_EPS = 0.009; // ~1 pesewa tolerance for float/rounding

function toPositiveInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(9999, Math.floor(n));
}

/**
 * Normalize bulk_discount from tenant.settings (or partial update payload).
 */
export function normalizeBulkDiscount(raw) {
    if (!raw || typeof raw !== 'object') {
        return { ...DEFAULT_BULK_DISCOUNT };
    }
    return {
        enabled: Boolean(raw.enabled),
        quantity_threshold: toPositiveInt(raw.quantity_threshold, DEFAULT_BULK_DISCOUNT.quantity_threshold),
    };
}

/**
 * Merge settings update into existing tenant settings JSON.
 * Only known keys are merged; unknown keys in existing are preserved.
 */
export function mergeTenantSettings(existing, patch) {
    const base =
        existing && typeof existing === 'object' && !Array.isArray(existing)
            ? { ...existing }
            : {};
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return base;
    }
    const next = { ...base };
    if (patch.bulk_discount !== undefined) {
        next.bulk_discount = normalizeBulkDiscount({
            ...normalizeBulkDiscount(base.bulk_discount),
            ...patch.bulk_discount,
        });
    }
    return next;
}

export function getBulkDiscountFromSettings(settings) {
    return normalizeBulkDiscount(settings?.bulk_discount);
}

/**
 * Effective unit price for a sale line given product prices + tenant rule.
 */
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

export function pricesMatch(expected, actual) {
    return Math.abs(Number(expected) - Number(actual)) <= PRICE_EPS;
}

/**
 * Build a reject Error for client/server price mismatch.
 */
export function priceMismatchError(message, details = {}) {
    const err = new Error(message);
    err.code = 'PRICE_MISMATCH';
    err.status = 400;
    err.details = details;
    return err;
}
