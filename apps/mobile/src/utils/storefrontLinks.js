import config from '../config';

const SITE_BASE = String(config.MARKETING_SITE_URL || 'https://shopynn.vercel.app').replace(/\/$/, '');

export function storefrontStoreUrl(referenceCode) {
    const code = String(referenceCode || '')
        .trim()
        .toLowerCase();
    if (!code) return '';
    return `${SITE_BASE}/s/${encodeURIComponent(code)}`;
}

export function storefrontProductUrl(referenceCode, productSlugOrId, qty) {
    const code = String(referenceCode || '')
        .trim()
        .toLowerCase();
    const key = String(productSlugOrId || '').trim();
    if (!code || !key) return '';
    const q = qty && Number(qty) > 1 ? `?qty=${encodeURIComponent(String(qty))}` : '';
    return `${SITE_BASE}/s/${encodeURIComponent(code)}/p/${encodeURIComponent(key)}${q}`;
}

export function storefrontShareMessage({ storeName, productName, url }) {
    const shop = String(storeName || 'our store').trim() || 'our store';
    if (productName) {
        return `Order ${productName} from ${shop} on Shopynn:\n${url}`;
    }
    return `Order from ${shop} on Shopynn:\n${url}`;
}
