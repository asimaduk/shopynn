/** Coerce API product numeric fields (pg decimals often arrive as strings). */

export function toNum(value, defaultValue = null) {
    if (value == null || value === '') return defaultValue;
    const n = Number(value);
    return Number.isFinite(n) ? n : defaultValue;
}

export function normalizeProduct(product) {
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
    ];

    for (const field of numericFields) {
        if (p[field] != null && p[field] !== '') {
            p[field] = toNum(p[field], null);
        }
    }

    if (Array.isArray(p.stores_quantities)) {
        p.stores_quantities = p.stores_quantities.map((store) => ({
            ...store,
            quantity_available: toNum(store.quantity_available, 0),
            minimum_stock_level:
                store.minimum_stock_level != null && store.minimum_stock_level !== ''
                    ? toNum(store.minimum_stock_level, null)
                    : null,
        }));
    }

    if (typeof p.inventory === 'string') {
        p.inventory = toNum(p.inventory, 0);
    }

    return p;
}
