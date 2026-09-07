/** Coerce low-stock / inventory list numeric fields from API (pg decimals as strings). */

export function toNum(value, defaultValue = 0) {
    if (value == null || value === '') return defaultValue;
    const n = Number(value);
    return Number.isFinite(n) ? n : defaultValue;
}

export function toNumOrNull(value) {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

export function normalizeLowStockItem(item) {
    if (!item || typeof item !== 'object') return item;
    return {
        ...item,
        id: item.id ?? item.product_id ?? item.inventory_id,
        name: item.name ?? item.product_name ?? 'Unknown Product',
        sku: item.sku ?? item.product_sku ?? '-',
        category: item.category ?? item.category_name ?? '',
        inventory: toNum(item.inventory ?? item.quantity_available),
        minimum: toNum(item.minimum ?? item.minimum_stock_level ?? item.reorder_quantity),
        unit_price: toNumOrNull(item.unit_price),
        alt_price: toNumOrNull(item.alt_price),
    };
}

export function normalizeLowStockList(list) {
    return (Array.isArray(list) ? list : []).map(normalizeLowStockItem);
}
