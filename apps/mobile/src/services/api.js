/**
 * API service for IMS endpoints (see API.md).
 * All paths are relative to BASE_API (interceptor adds base URL).
 * Responses follow { status, message, data }; we return data or the full response.
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveProductsCache, loadProductsCache } from './productCacheStorage';
import { resetVoiceCatalogIndex } from './voicePosCatalog';
import { SECURE_PENDING_SALES_KEY as PENDING_SALES_KEY, readSecureList } from '../utils/secureOfflineStorage';
import { normalizeProduct } from '../utils/normalizeProduct';
import { normalizeLowStockList } from '../utils/normalizeLowStockItem';

const getData = (res) => (res?.data?.data !== undefined ? res.data.data : res?.data);

/** Normalize list responses: API may return array or { list, items, data } */
export const normalizeList = (raw) => (Array.isArray(raw) ? raw : raw?.list ?? raw?.items ?? raw?.data ?? []);

/** Normalize paged list responses: { items, total } when API paginates, else treat as full array. */
export const normalizePagedList = (raw) => {
    const items = normalizeList(raw);
    if (Array.isArray(raw)) {
        return { items, total: items.length, limit: null, offset: 0 };
    }
    const total = Number(raw?.total);
    return {
        items,
        total: Number.isFinite(total) ? total : items.length,
        limit: raw?.limit != null ? Number(raw.limit) : null,
        offset: raw?.offset != null ? Number(raw.offset) : 0,
    };
};

const CATALOG_DETAILS_CACHE_KEY = 'SHOPYNN_CATALOG_DETAILS_CACHE_V1';
const CATALOG_DETAILS_TTL_MS = 1000 * 60 * 10; // 10 minutes
const catalogDetailsMemoryCache = new Map();

const getCatalogCacheEntryKey = (id, warehouseId) => `${String(warehouseId || '')}:${String(id || '')}`;

async function saveCatalogDetailsCacheEntry(id, warehouseId, data) {
    if (!id || !warehouseId || !data) return;
    const key = getCatalogCacheEntryKey(id, warehouseId);
    const entry = { data, cachedAt: Date.now() };
    catalogDetailsMemoryCache.set(key, entry);
    try {
        const raw = await AsyncStorage.getItem(CATALOG_DETAILS_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed[key] = entry;
        await AsyncStorage.setItem(CATALOG_DETAILS_CACHE_KEY, JSON.stringify(parsed));
    } catch (_) {
        // Best-effort cache
    }
}

function getFreshCatalogEntry(entry) {
    if (!entry || !entry.data || !entry.cachedAt) return null;
    if (Date.now() - Number(entry.cachedAt) > CATALOG_DETAILS_TTL_MS) return null;
    return entry.data;
}

async function loadCatalogDetailsCacheEntry(id, warehouseId) {
    if (!id || !warehouseId) return null;
    const key = getCatalogCacheEntryKey(id, warehouseId);
    const inMemory = getFreshCatalogEntry(catalogDetailsMemoryCache.get(key));
    if (inMemory) return inMemory;
    try {
        const raw = await AsyncStorage.getItem(CATALOG_DETAILS_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        const entry = parsed?.[key];
        const fresh = getFreshCatalogEntry(entry);
        if (fresh) {
            catalogDetailsMemoryCache.set(key, entry);
            return fresh;
        }
        return null;
    } catch (_) {
        return null;
    }
}

const safeNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

async function getPendingSales() {
    try {
        const list = await readSecureList(PENDING_SALES_KEY);
        return Array.isArray(list) ? list : [];
    } catch (_) {
        return [];
    }
}

function buildPendingDeltas(pendingSales) {
    // productId -> totalQty
    const totalByProductId = {};
    // productId -> warehouseId -> qty
    const byProductWarehouse = {};

    pendingSales.forEach((sale) => {
        const payload = sale?.payload || {};
        const warehouseId = payload?.warehouse_id ?? payload?.warehouseId;
        const lines = Array.isArray(payload?.products) ? payload.products : [];

        lines.forEach((line) => {
            const productId = line?.id;
            const qty = safeNumber(line?.quantity ?? line?.qty ?? 0);
            if (!productId || qty <= 0) return;

            const pid = String(productId);
            const wid = warehouseId ? String(warehouseId) : 'unknown';

            totalByProductId[pid] = safeNumber(totalByProductId[pid]) + qty;
            if (!byProductWarehouse[pid]) byProductWarehouse[pid] = {};
            byProductWarehouse[pid][wid] = safeNumber(byProductWarehouse[pid][wid]) + qty;
        });
    });

    return { totalByProductId, byProductWarehouse };
}

function applyDeltasToProducts(products, deltas) {
    const { totalByProductId, byProductWarehouse } = deltas;
    return (Array.isArray(products) ? products : []).map((p) => {
        const productId = p?.id;
        const pid = productId ? String(productId) : null;

        const next = { ...p };

        // Update overall inventory display (Search uses `inventory`)
        if (pid) {
            const deltaTotal = safeNumber(totalByProductId[pid]);
            const baseInv = Number(next.inventory);
            if (!Number.isNaN(baseInv)) {
                next.inventory = Math.max(0, baseInv - deltaTotal);
            }

            // Update store-level quantities (New Sale uses `stores_quantities`)
            const storesQuantities = next.stores_quantities || next.storesQuantities;
            if (Array.isArray(storesQuantities)) {
                const adjusted = storesQuantities.map((sq) => {
                    const warehouseId = sq?.warehouse_id ?? sq?.warehouseId;
                    const wid = warehouseId ? String(warehouseId) : 'unknown';
                    const deltaForStore = safeNumber(byProductWarehouse?.[pid]?.[wid]);

                    const baseQty = safeNumber(sq?.quantity_available ?? sq?.quantityAvailable ?? 0);
                    const newQty = Math.max(0, baseQty - deltaForStore);

                    return {
                        ...sq,
                        quantity_available: newQty,
                        quantityAvailable: newQty,
                    };
                });

                next.stores_quantities = adjusted;
                next.storesQuantities = adjusted;
            }
        }

        return next;
    });
}

async function applyOfflinePendingSalesDeltas(products) {
    const pendingSales = await getPendingSales();
    if (!pendingSales.length) return products;
    const deltas = buildPendingDeltas(pendingSales);
    return applyDeltasToProducts(products, deltas);
}

// —— Auth / Users ——
export const users = {
    login: (email, password) =>
        axios
            .post(
                '/users/login',
                { email, password },
                {
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                }
            )
            .then((res) => ({ token: getData(res)?.token ?? getData(res), ...res.data })),
    forgotPassword: (email) => axios.post('/users/forgot-password', { email }).then((res) => res.data),
    resetPassword: (currentPassword, newPassword) => axios.post('/users/reset-password', { password: newPassword, old_password: currentPassword }).then((res) => res.data),
    changePassword: (currentPassword, newPassword) => axios.post('/users/change-password', { current_password: currentPassword, new_password: newPassword }).then((res) => res.data),
    me: () => axios.get('/users/me').then((res) => getData(res)),
    updateProfileImage: (image) => {
        const form = new FormData();
        const uri = image?.uri;
        if (!uri) {
            return Promise.reject(new Error('Profile image uri is required.'));
        }
        form.append('image', {
            uri,
            type: image?.type || 'image/jpeg',
            name: image?.fileName || `profile_${Date.now()}.jpg`,
        });
        return axios
            .post('/users/me/profile-image', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            .then((res) => getData(res));
    },
    removeProfileImage: () => axios.delete('/users/me/profile-image').then((res) => getData(res)),
    mePreferences: () => axios.get('/users/me/preferences').then((res) => getData(res)),
    updateMePreferences: (body) => axios.put('/users/me/preferences', body).then((res) => res.data),
    updateMyFcmToken: (fcm_token) =>
        axios.put('/users/me/fcm-token', { fcm_token: fcm_token ?? null }).then((res) => getData(res)),
    list: (params) => axios.get('/users', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/users/${id}`).then((res) => getData(res)),
    create: (body) => axios.post('/users', body).then((res) => getData(res)),
    update: (id, body) => axios.put(`/users/${id}`, body).then((res) => getData(res)),
    delete: (id, body) => axios.put(`/users/${id}/delete`, body).then((res) => res.data),
    toggleActive: (body) => axios.put('/users/toggle-active', body).then((res) => getData(res)),
    assignMerchantPermissions: (body) => axios.post('/users/assign-merchant-permissions', body).then((res) => getData(res)),
    verifyStoreReference: (reference_code) =>
        axios.post('/users/customer-signup/verify-reference', { reference_code }).then((res) => getData(res)),
    customerSignup: (body) => axios.post('/users/customer-signup', body).then((res) => getData(res)),
    sendShopOwnerSignupEmailOtp: (email) =>
        axios.post('/users/shop-owner-signup/send-email-otp', { email }).then((res) => getData(res)),
    verifyShopOwnerSignupEmailOtp: (email, otp) =>
        axios.post('/users/shop-owner-signup/verify-email-otp', { email, otp }).then((res) => getData(res)),
};

// —— Dashboard & Reports ——
export const dashboard = {
    get: (params) => axios.get('/dashboard', { params }).then((res) => getData(res)),
    profitAndLoss: (params) => axios.get('/dashboard/profit-and-loss', { params }).then((res) => getData(res)),
    cashFlow: (params) => axios.get('/dashboard/cash-flow', { params }).then((res) => getData(res)),
};

// —— Sales ——
export const sales = {
    list: (params) => axios.get('/sales', { params }).then((res) => getData(res)),
    summary: (params) => axios.get('/sales/summary', { params }).then((res) => getData(res)),
    report: (params) => axios.get('/sales/report', { params }).then((res) => getData(res)),
    topSelling: (params) => axios.get('/sales/top-selling', { params }).then((res) => getData(res)),
    byCustomer: (params) => axios.get('/sales/customers-report', { params }).then((res) => getData(res)),
    byStaff: (params) => axios.get('/sales/staff-report', { params }).then((res) => getData(res)),
    mtdSales: (params) => axios.get('/sales/me/mtd-total', { params }).then((res) => getData(res)),
    revenue: (params) => axios.get('/sales/revenue', { params }).then((res) => getData(res)),
    cogs: (params) => axios.get('/sales/cogs', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/sales/${id}`).then((res) => getData(res)),
    create: (body) => axios.post('/sales', body).then((res) => getData(res)),
    sendInvoice: (id, body = {}) => axios.post(`/sales/${id}/send-invoice`, body).then((res) => getData(res)),
    downloadInvoicePdf: async (id) => {
        const res = await axios.get(`/sales/${id}/invoice.pdf`, { responseType: 'arraybuffer' });
        return res.data;
    },
    dailySales: (params) => axios.get('/sales/daily-summary', { params }).then((res) => getData(res)),
    byDate: (params) => axios.get('/sales/by-date', { params }).then((res) => getData(res)),
};

// —— Purchases ——
export const purchases = {
    list: (params) => axios.get('/purchases', { params }).then((res) => getData(res)),
    summary: (params) => axios.get('/purchases/summary', { params }).then((res) => getData(res)),
    bySupplier: (params) => axios.get('/purchases/suppliers-summary', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/purchases/${id}`).then((res) => getData(res)),
    create: (body) => axios.post('/purchases', body).then((res) => getData(res)),
};

// —— Orders (customer/store ordering) ——
export const orders = {
    list: (params) => axios.get('/orders', { params }).then((res) => getData(res)),
    my: () => axios.get('/orders/my').then((res) => getData(res)),
    get: (id) => axios.get(`/orders/${id}`).then((res) => getData(res)),
    history: (id) => axios.get(`/orders/${id}/history`).then((res) => getData(res)),
    create: (body) => axios.post('/orders', body).then((res) => getData(res)),
    update: (id, body) => axios.patch(`/orders/${id}`, body).then((res) => getData(res)),
    updateStatus: (id, status, reason) =>
        axios.patch(`/orders/${id}/status`, { status, reason }).then((res) => getData(res)),
    cancel: (id, reason) => axios.post(`/orders/${id}/cancel`, { reason }).then((res) => getData(res)),
    initiatePayment: (id, body) =>
        axios.post(`/orders/${id}/payments/initiate`, body).then((res) => getData(res)),
    initiatePartialPayment: (id, body) =>
        axios.post(`/orders/${id}/payments/partial/initiate`, body).then((res) => getData(res)),
    submitPaymentOtp: (id, body) =>
        axios.post(`/orders/${id}/payments/submit-otp`, body).then((res) => getData(res)),
};

export const customerProfiles = {
    signup: (reference_code) => axios.post('/customer-profiles/signup', { reference_code }).then((res) => getData(res)),
    linkStore: (reference_code) => axios.post('/customer-profiles/link-store', { reference_code }).then((res) => getData(res)),
    stores: () => axios.get('/customer-profiles/stores').then((res) => getData(res)),
};

export const catalog = {
    list: (warehouse_id, params = {}) =>
        axios.get('/products/catalog', { params: { warehouse_id, ...params } }).then((res) => getData(res)),
    get: async (id, warehouse_id) => {
        try {
            const res = await axios.get(`/products/catalog/${id}`, { params: { warehouse_id } });
            const data = getData(res);
            await saveCatalogDetailsCacheEntry(id, warehouse_id, data);
            return data;
        } catch (_) {
            const cached = await loadCatalogDetailsCacheEntry(id, warehouse_id);
            if (cached) return cached;
            return null;
        }
    },
};

export const storeOrders = {
    list: (params) => axios.get('/store-orders', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/store-orders/${id}`).then((res) => getData(res)),
    updateStatus: (id, status, reason) =>
        axios.patch(`/store-orders/${id}/status`, { status, reason }).then((res) => getData(res)),
    history: (id) => axios.get(`/store-orders/${id}/history`).then((res) => getData(res)),
    markPaidCash: (id, body) =>
        axios.post(`/store-orders/${id}/payments/mark-paid`, body || {}).then((res) => getData(res)),
    recordPartialCash: (id, body) =>
        axios.post(`/store-orders/${id}/payments/partial/record`, body).then((res) => getData(res)),
};

// —— Inventories ——
export const inventories = {
    list: (params) =>
        axios.get('/inventories', { params }).then((res) => normalizeLowStockList(normalizeList(getData(res)))),
    count: () => axios.get('/inventories/count').then((res) => getData(res)),
    summary: (params) => axios.get('/inventories/summary', { params }).then((res) => getData(res)),
    lowStock: (params) =>
        axios.get('/inventories/low-stock', { params }).then((res) => normalizeLowStockList(normalizeList(getData(res)))),
    expiring: (params) => axios.get('/inventories/expiring', { params }).then((res) => getData(res)),
    topSelling: (params) => axios.get('/inventories/top-selling', { params }).then((res) => getData(res)),
    bulkUpdates: (body) => axios.post('/inventories/updates', body).then((res) => res.data),
};

// —— Adjustments ——
export const adjustments = {
    list: (params) => axios.get('/adjustments', { params }).then((res) => getData(res)),
    summary: (params) => axios.get('/adjustments/summary', { params }).then((res) => getData(res)),
    create: (body) => axios.post('/adjustments', body).then((res) => getData(res)),
};

// —— Transfers ——
export const transfers = {
    list: (params) => axios.get('/transfers', { params }).then((res) => getData(res)),
    summary: (params) => axios.get('/transfers/summary', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/transfers/${id}`).then((res) => getData(res)),
    create: (body) => axios.post('/transfers', body).then((res) => getData(res)),
};

// —— Customers ——
export const customers = {
    list: (params) => axios.get('/customers', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/customers/${id}`).then((res) => getData(res)),
    getSales: (id, params) => axios.get(`/customers/${id}/sales`, { params }).then((res) => getData(res)),
    create: (body) => axios.post('/customers', body).then((res) => getData(res)),
    update: (id, body) => axios.put(`/customers/${id}`, body).then((res) => getData(res)),
    delete: (id) => axios.delete(`/customers/${id}`).then((res) => res.data),
};

// —— Suppliers ——
export const suppliers = {
    list: (params) => axios.get('/suppliers', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/suppliers/${id}`).then((res) => getData(res)),
    getPurchases: (id, params) => axios.get(`/suppliers/${id}/purchases`, { params }).then((res) => getData(res)),
    create: (body) => axios.post('/suppliers', body).then((res) => getData(res)),
    update: (id, body) => axios.put(`/suppliers/${id}`, body).then((res) => getData(res)),
};

function normalizeProductList(list) {
    return (Array.isArray(list) ? list : []).map(normalizeProduct);
}

// —— Products ——
export const products = {
    list: async (params) => {
        try {
            const raw = await axios.get('/products', { params });
            const data = getData(raw);
            const list = normalizeProductList(normalizeList(data));
            await saveProductsCache(list);
            resetVoiceCatalogIndex();
            return applyOfflinePendingSalesDeltas(list);
        } catch (_) {
            const cached = await loadProductsCache();
            return applyOfflinePendingSalesDeltas(normalizeProductList(cached));
        }
    },
    /** Full product export rows for CSV (requires products.export). */
    export: () => axios.get('/products/export').then((res) => normalizeList(getData(res))),
    byCategory: async (categoryId, params) => {
        try {
            const raw = await axios.get(`/products/by-category/${categoryId}`, { params });
            const data = getData(raw);
            const list = normalizeProductList(normalizeList(data));
            // Also refresh the main cache as best-effort; by-category responses can be partial
            // but still useful for offline usage.
            await saveProductsCache(list);
            resetVoiceCatalogIndex();
            return applyOfflinePendingSalesDeltas(list);
        } catch (_) {
            const cached = await loadProductsCache();
            const filtered = cached.filter((p) => {
                const categories = p?.categories || p?.category_ids || [];
                return Array.isArray(categories) && categories.some((c) => String(c) === String(categoryId));
            });
            return applyOfflinePendingSalesDeltas(normalizeProductList(filtered));
        }
    },
    get: async (id) => {
        try {
            const raw = await axios.get(`/products/${id}`);
            const data = normalizeProduct(getData(raw));
            // Merge into cache (best-effort)
            const cached = await loadProductsCache();
            const next = Array.isArray(cached)
                ? [
                      data,
                      ...cached.filter((p) => String(p?.id) !== String(id)),
                  ]
                : [data];
            await saveProductsCache(next);
            resetVoiceCatalogIndex();
            const adjusted = await applyOfflinePendingSalesDeltas([data]);
            return adjusted?.[0] ?? data;
        } catch (_) {
            const cached = await loadProductsCache();
            const hit = cached.find((p) => String(p?.id) === String(id));
            if (!hit) return null;
            const adjusted = await applyOfflinePendingSalesDeltas([hit]);
            return adjusted?.[0] ?? hit;
        }
    },
    create: (body) => axios.post('/products', body).then((res) => getData(res)),
    update: (id, body) => axios.put(`/products/${id}`, body).then((res) => getData(res)),
    /** Body: { id, thumbnail, picture1, picture2, picture3, picture4 } — use null to clear a slot */
    updateImages: (body) => axios.post('/products/update-images', body).then((res) => getData(res)),
    changePrice: (body) => axios.post('/products/change-price', body).then((res) => getData(res)),
    delete: (id) => axios.delete(`/products/${id}`).then((res) => res.data),
};

// —— Warehouses ——
export const warehouses = {
    list: (params) => axios.get('/warehouses', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/warehouses/${id}`).then((res) => getData(res)),
    create: (body) => axios.post('/warehouses', body).then((res) => getData(res)),
    update: (id, body) => axios.put(`/warehouses/${id}`, body).then((res) => getData(res)),
};

// —— Locations ——
export const locations = {
    list: (params) => axios.get('/locations', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/locations/${id}`).then((res) => getData(res)),
    create: (body) => axios.post('/locations', body).then((res) => getData(res)),
    update: (id, body) => axios.put(`/locations/${id}`, body).then((res) => getData(res)),
};

// —— Categories ——
export const categories = {
    list: (params) => axios.get('/categories', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/categories/${id}`).then((res) => getData(res)),
    create: (body) => axios.post('/categories', body).then((res) => getData(res)),
    update: (id, body) => axios.put(`/categories/${id}`, body).then((res) => getData(res)),
    delete: (id) => axios.delete(`/categories/${id}`).then((res) => res.data),
};

// —— Expenses ——
export const expenses = {
    list: (params) => axios.get('/expenses', { params }).then((res) => getData(res)),
    create: (body) => axios.post('/expenses', body).then((res) => getData(res)),
    update: (id, body) => axios.put(`/expenses/${id}`, body).then((res) => getData(res)),
};

// —— Stock Counts ——
export const stockCounts = {
    list: (params) => axios.get('/stock-counts', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/stock-counts/${id}`).then((res) => getData(res)),
    create: (body) => axios.post('/stock-counts', body).then((res) => getData(res)),
};

// —— Returns ——
export const returnsApi = {
    list: (params) => axios.get('/returns', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/returns/${id}`).then((res) => getData(res)),
    create: (body) => axios.post('/returns', body).then((res) => getData(res)),
};

// —— Notifications ——
export const notifications = {
    list: (params) => axios.get('/notifications', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/notifications/${id}`).then((res) => getData(res)),
    markRead: (id) => axios.patch(`/notifications/${id}/read`).then((res) => res.data),
};

// —— Subscriptions ——
export const subscriptions = {
    current: (params) => axios.get('/subscriptions/current', { params }).then((res) => getData(res)),
    onboard: (body) => axios.post('/subscriptions/onboard', body).then((res) => getData(res)),
};

// —— Transactions ——
export const transactions = {
    list: (params) => axios.get('/transactions', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/transactions/${id}`).then((res) => getData(res)),
};

// —— Payments ——
export const payments = {
    list: (params) => axios.get('/payments', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/payments/${id}`).then((res) => getData(res)),
    receipt: (id) => axios.get(`/payments/${id}/receipt`).then((res) => getData(res)),
    events: (id) => axios.get(`/payments/${id}/events`).then((res) => getData(res)),
    reverse: (id, body = {}) => axios.post(`/payments/${id}/reverse`, body).then((res) => getData(res)),
    create: (body) => axios.post('/payments', body).then((res) => getData(res)),
    initiate: (body) => axios.post('/payments/initiate', body).then((res) => getData(res)),
    /** Telecel/Vodafone voucher (Paystack charge/submit_otp) after dialling *110# */
    submitOtp: (body) => axios.post('/payments/submit-otp', body).then((res) => getData(res)),
    byCustomer: (customerId, params) =>
        axios.get(`/payments/customer/${customerId}`, { params }).then((res) => getData(res)),
    verify: (reference) => axios.get('/payments/verify', { params: { reference } }).then((res) => getData(res)),
};

// —— Audit Logs ——
export const auditLogs = {
    list: (params) => axios.get('/audit-logs', { params }).then((res) => getData(res)),
};

// —— Tenants (company / tenant info) ——
export const tenants = {
    /** Public self-serve shop signup: tenant + subscription + owner user */
    setup: (body) => axios.post('/tenants/setup', body).then((res) => getData(res)),
    updateMyCompanyInfo: (body) => axios.put('/tenants/update-my-company-info', body).then((res) => getData(res)),
    /** Platform admin directory — requires tenants.directory.view */
    directoryList: (params) => axios.get('/tenants/admin/list', { params }).then((res) => getData(res)),
    directoryDetail: (id) => axios.get(`/tenants/admin/${id}`).then((res) => getData(res)),
    /** Tenant owner — digital order revenue settlements (Premium payments.view) */
    mySettlementSummary: () => axios.get('/tenants/me/settlements/summary').then((res) => getData(res)),
    mySettlements: (params) => axios.get('/tenants/me/settlements', { params }).then((res) => getData(res)),
    myPayoutProfile: () => axios.get('/tenants/me/payout-profile').then((res) => getData(res)),
    updateMyPayoutProfile: (body) => axios.put('/tenants/me/payout-profile', body).then((res) => getData(res)),
    payoutBanks: (params) => axios.get('/tenants/payout-banks', { params }).then((res) => getData(res)),
    requestWithdrawal: (body) => axios.post('/tenants/me/withdrawals', body).then((res) => getData(res)),
    retryWithdrawal: (id) => axios.post(`/tenants/me/withdrawals/${id}/retry`).then((res) => getData(res)),
    adminSettlementSummary: (tenantId) =>
        axios.get(`/tenants/admin/${tenantId}/settlements/summary`).then((res) => getData(res)),
    adminSettlements: (tenantId, params) =>
        axios.get(`/tenants/admin/${tenantId}/settlements`, { params }).then((res) => getData(res)),
    createAdminSettlement: (tenantId, body) =>
        axios.post(`/tenants/admin/${tenantId}/settlements`, body).then((res) => getData(res)),
    markAdminSettlementPaid: (id, body) =>
        axios.patch(`/tenants/admin/settlements/${id}/mark-paid`, body).then((res) => getData(res)),
    adminWithdrawals: (params) => axios.get('/tenants/admin/withdrawals', { params }).then((res) => getData(res)),
    approveAdminSettlement: (id) => axios.patch(`/tenants/admin/settlements/${id}/approve`).then((res) => getData(res)),
    rejectAdminSettlement: (id, body) => axios.patch(`/tenants/admin/settlements/${id}/reject`, body).then((res) => getData(res)),
};

// —— Billing catalog ——
export const billing = {
    catalog: (params) => axios.get('/billing/catalog', { params }).then((res) => getData(res)),
    updateCatalogItem: (id, body) => axios.patch(`/billing/catalog/${id}`, body).then((res) => getData(res)),
    /** Unauthenticated — shop signup & marketing */
    publicCatalog: () => axios.get('/public/billing/catalog').then((res) => getData(res)),
};

// —— Merchants (partner onboarding & commissions) ——
export const merchants = {
    me: () => axios.get('/merchants/me').then((res) => getData(res)),
    onboard: (body) => axios.post('/merchants/onboard', body).then((res) => getData(res)),
    onboardedTenants: () => axios.get('/merchants/onboarded-tenants').then((res) => getData(res)),
    getQuote: (tenantId) => axios.get(`/merchants/tenants/${tenantId}/quote`).then((res) => getData(res)),
    createQuote: (tenantId, body) =>
        axios.post(`/merchants/tenants/${tenantId}/quotes`, body).then((res) => getData(res)),
    initiatePayment: (tenantId, body) =>
        axios.post(`/merchants/tenants/${tenantId}/payments/initiate`, body).then((res) => getData(res)),
    submitOtp: (tenantId, body) =>
        axios.post(`/merchants/tenants/${tenantId}/payments/submit-otp`, body).then((res) => getData(res)),
    commissions: (params) => axios.get('/merchants/commissions', { params }).then((res) => getData(res)),
    /** Body: `{ user_id, default_commission_percent? }` or `{ create_user: { first_name, last_name, email, phone }, default_commission_percent? }` — password is auto-generated and emailed */
    promote: (body) => axios.post('/merchants/promote', body).then((res) => getData(res)),
    markPaid: (id) => axios.patch(`/merchants/commissions/${id}/mark-paid`).then((res) => getData(res)),
    adminList: () => axios.get('/merchants/admin/list').then((res) => getData(res)),
    eligibleUsers: () => axios.get('/merchants/admin/eligible-users').then((res) => getData(res)),
    adminDetail: (id) => axios.get(`/merchants/admin/${id}`).then((res) => getData(res)),
    revoke: (id) => axios.delete(`/merchants/admin/${id}`).then((res) => getData(res)),
};

// —— Industries ——
export const industries = {
    list: (params) => axios.get('/industries', { params }).then((res) => getData(res)),
    get: (id) => axios.get(`/industries/${id}`).then((res) => getData(res)),
};

/** Multipart upload to S3 via POST /images; returns `{ ids: string[] }` (S3 keys). Use a unique form field name per file (handled in `upload`). */
export const images = {
    upload: (asset) => {
        const field = `u_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        const form = new FormData();
        form.append(field, {
            uri: asset.uri,
            type: asset.type || 'image/jpeg',
            name: asset.fileName || `${field}.jpg`,
        });
        return axios.post('/images', form).then((res) => getData(res));
    },
};

// —— Roles & Permissions ——
export const roles = {
    list: () => axios.get('/roles').then((res) => getData(res)),
    get: (id) => axios.get(`/roles/${id}`).then((res) => getData(res)),
    getPermissions: (id) => axios.get(`/roles/${id}/permissions`).then((res) => getData(res)),
    create: (body) => axios.post('/roles', body).then((res) => getData(res)),
    update: (id, body) => axios.put(`/roles/${id}`, body).then((res) => getData(res)),
    delete: (id) => axios.delete(`/roles/${id}`).then((res) => res.data),
};
export const permissions = {
    list: () => axios.get('/permissions').then((res) => getData(res)),
};

export default {
    users,
    tenants,
    merchants,
    industries,
    images,
    dashboard,
    sales,
    purchases,
    orders,
    customerProfiles,
    catalog,
    storeOrders,
    inventories,
    adjustments,
    transfers,
    customers,
    suppliers,
    products,
    warehouses,
    locations,
    categories,
    expenses,
    stockCounts,
    returnsApi,
    notifications,
    subscriptions,
    transactions,
    payments,
    auditLogs,
    roles,
    permissions,
};
