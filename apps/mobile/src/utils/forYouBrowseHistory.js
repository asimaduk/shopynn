import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = (warehouseId) => `SHOPYNN_FOR_YOU_BROWSE_HISTORY_V1:${warehouseId || 'all'}`;
const MAX_HISTORY = 16;

const getProductImageUri = (item) =>
    item?.thumbnail || item?.picture1 || item?.picture2 || item?.image || item?.image_url || item?.photo || null;

export async function loadBrowseHistory(warehouseId) {
    try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY(warehouseId));
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch (_) {
        return [];
    }
}

export async function clearBrowseHistory(warehouseId) {
    try {
        await AsyncStorage.removeItem(HISTORY_KEY(warehouseId));
    } catch (_) {
        /* ignore */
    }
}

/** Record a product view for Temu-style search browsing history. */
export async function recordBrowseHistory(warehouseId, product) {
    if (!product?.id) return [];
    const entry = {
        id: product.id,
        name: product.name,
        thumbnail: getProductImageUri(product),
        unit_price: Number(product.base_price_per_unit || product.unit_price || 0),
        sold_count: product.sold_count || product.sold || product.orders_count || 0,
        quantity_available: product.quantity_available,
        measurement_unit: product.measurement_unit,
        min_order_qty: product.min_order_qty,
        installment_enabled: product.installment_enabled,
        installment_min_initial_percent: product.installment_min_initial_percent,
        installment_min_payment_amount: product.installment_min_payment_amount,
        at: Date.now(),
        product,
    };
    try {
        const prev = await loadBrowseHistory(warehouseId);
        const next = [entry, ...prev.filter((h) => String(h.id) !== String(product.id))].slice(0, MAX_HISTORY);
        await AsyncStorage.setItem(HISTORY_KEY(warehouseId), JSON.stringify(next));
        return next;
    } catch (_) {
        return [];
    }
}
