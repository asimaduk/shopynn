/**
 * Resolve sale payment method for display.
 * API stores `payment_type`: 1 = cash, 2 = mobile money, 3 = card.
 * Mobile create payload also sends `payment_method`: cash | momo | card
 * (and often `notes`: "Paid with cash" / "Paid with momo …").
 */

const TYPE_BY_CODE = {
    1: 'cash',
    2: 'mobile_money',
    3: 'card',
};

function methodFromString(raw) {
    const m = String(raw || '')
        .trim()
        .toLowerCase()
        .replace(/-/g, '_')
        .replace(/\s+/g, '_');
    if (!m) return null;
    if (m === 'momo' || m === 'mobile_money' || m === 'mobilemoney') return 'mobile_money';
    if (m === 'card') return 'card';
    if (m === 'cash') return 'cash';
    if (m.includes('momo') || m.includes('mobile')) return 'mobile_money';
    if (m.includes('card')) return 'card';
    if (m.includes('cash')) return 'cash';
    return null;
}

function methodFromNotes(notes) {
    const n = String(notes || '').toLowerCase();
    if (!n) return null;
    // new_sale writes: "Paid with cash" | "Paid with momo 024…"
    const paidWith = n.match(/paid\s+with\s+([a-z0-9_ -]+)/i);
    if (paidWith?.[1]) {
        const fromPaid = methodFromString(paidWith[1].split(/\s+/)[0]);
        if (fromPaid) return fromPaid;
    }
    if (n.includes('mobile money') || n.includes('momo')) return 'mobile_money';
    if (n.includes(' card') || n.startsWith('card') || n.includes('paid with card')) return 'card';
    if (n.includes('cash')) return 'cash';
    return null;
}

export function normalizeSalePaymentMethod(sale = {}) {
    const type = sale.payment_type ?? sale.paymentType;
    if (type != null && type !== '') {
        const code = Number(type);
        if (TYPE_BY_CODE[code]) return TYPE_BY_CODE[code];
        // Non-numeric payment_type strings (rare)
        const fromType = methodFromString(type);
        if (fromType) return fromType;
    }

    const fromField = methodFromString(
        sale.payment_method ?? sale.paymentMethod ?? sale.paymentOption?.method,
    );
    if (fromField) return fromField;

    return methodFromNotes(sale.notes);
}

/**
 * @param {object} sale
 * @param {{ withSaleSuffix?: boolean }} [opts]
 * Unknown method → "Unspecified" (chip) / "Unspecified" — never a fake payment type.
 */
export function formatSalePaymentLabel(sale = {}, { withSaleSuffix = false } = {}) {
    const method = normalizeSalePaymentMethod(sale);
    const phone = String(sale.payment_number || sale.paymentOption?.momoNumber || '').trim();

    if (method === 'cash') return withSaleSuffix ? 'Cash Sale' : 'Cash';
    if (method === 'mobile_money') {
        if (withSaleSuffix) return 'Mobile Money Sale';
        return phone ? `Mobile Money (${phone})` : 'Mobile Money';
    }
    if (method === 'card') return withSaleSuffix ? 'Card Sale' : 'Card';

    // Fallback when payment_type is null/unknown and notes don't name a method.
    return 'Unspecified';
}

export function salePaymentIcon(sale = {}) {
    const method = normalizeSalePaymentMethod(sale);
    if (method === 'mobile_money') return 'smartphone';
    if (method === 'card') return 'credit-card';
    if (method === 'cash') return 'banknote';
    return 'wallet';
}
