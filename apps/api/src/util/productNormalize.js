/** Coerce pg numeric/decimal strings to JS numbers for API responses. */

export function toNum(value, { defaultValue = null } = {}) {
    if (value == null || value === '') return defaultValue;
    const n = Number(value);
    return Number.isFinite(n) ? n : defaultValue;
}

export function normalizeProductRow(product) {
    if (!product || typeof product !== 'object') return product;

    const p = { ...product };
    const numericFields = [
        'unit_price',
        'alt_price',
        'actual_cost',
        'reorder_quantity',
        'min_order_qty',
        'qty_step',
        'inventory',
        'initial_stock',
        'quantity_available',
        'installment_min_initial_percent',
        'installment_min_payment_amount',
    ];

    for (const field of numericFields) {
        if (p[field] != null && p[field] !== '') {
            p[field] = toNum(p[field], { defaultValue: null });
        }
    }

    if (Array.isArray(p.stores_quantities)) {
        p.stores_quantities = p.stores_quantities.map((store) => ({
            ...store,
            quantity_available: toNum(store.quantity_available, { defaultValue: 0 }),
            minimum_stock_level:
                store.minimum_stock_level != null && store.minimum_stock_level !== ''
                    ? toNum(store.minimum_stock_level, { defaultValue: null })
                    : null,
        }));
    }

    if (typeof p.inventory === 'string') {
        p.inventory = toNum(p.inventory, { defaultValue: 0 });
    }

    return p;
}
