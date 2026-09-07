/**
 * Persisted product list cache (shared by API and offline voice POS).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PRODUCTS_CACHE_KEY = 'CHEQSTOCK_PRODUCTS_CACHE_V1';
export const PRODUCTS_CACHE_META_KEY = 'CHEQSTOCK_PRODUCTS_CACHE_META_V1';

export async function saveProductsCache(products) {
    try {
        const list = Array.isArray(products) ? products : [];
        await AsyncStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(list));
        await AsyncStorage.setItem(
            PRODUCTS_CACHE_META_KEY,
            JSON.stringify({ lastSyncedAt: new Date().toISOString(), count: list.length }),
        );
    } catch (_) {
        // Best-effort cache
    }
}

export async function loadProductsCache() {
    try {
        const raw = await AsyncStorage.getItem(PRODUCTS_CACHE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch (_) {
        return [];
    }
}
