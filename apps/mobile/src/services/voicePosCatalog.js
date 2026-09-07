/**
 * Offline POS product matching: load cached catalog + fuzzy rank with fuse.js.
 */
import Fuse from 'fuse.js';
import { loadProductsCache } from './productCacheStorage';

const fuseOptionsStrict = {
    keys: [
        { name: 'name', weight: 0.55 },
        { name: 'sku', weight: 0.25 },
        { name: 'bar_code', weight: 0.1 },
        { name: 'description', weight: 0.1 },
    ],
    threshold: 0.38,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
};

const fuseOptionsLoose = {
    ...fuseOptionsStrict,
    threshold: 0.52,
    minMatchCharLength: 1,
};

/** Fuse score at or below this is a confident match */
const GOOD_MATCH_SCORE = 0.34;

function toSearchRecord(p) {
    return {
        ...p,
        name: String(p?.name ?? ''),
        sku: String(p?.sku ?? ''),
        bar_code: String(p?.bar_code ?? p?.barcode ?? ''),
        description: String(p?.description ?? ''),
    };
}

let fuseStrict = null;
let fuseLoose = null;
let catalogSignature = '';

function catalogSig(list) {
    if (!Array.isArray(list) || list.length === 0) return '0';
    const a = list[0];
    const b = list[list.length - 1];
    return `${list.length}:${a?.id}:${b?.id}`;
}

function ensureFuse(list, loose = false) {
    const sig = catalogSig(list);
    if (loose) {
        if (fuseLoose && sig === catalogSignature) return fuseLoose;
        const records = list.map(toSearchRecord);
        fuseLoose = new Fuse(records, fuseOptionsLoose);
        catalogSignature = sig;
        return fuseLoose;
    }
    if (fuseStrict && sig === catalogSignature) return fuseStrict;
    const records = list.map(toSearchRecord);
    fuseStrict = new Fuse(records, fuseOptionsStrict);
    fuseLoose = null;
    catalogSignature = sig;
    return fuseStrict;
}

function mergeCandidates(primary, extra) {
    const byId = new Map();
    for (const c of [...primary, ...extra]) {
        const id = c?.item?.id ?? c?.item?.sku ?? c?.item?.name;
        if (id == null) continue;
        const prev = byId.get(id);
        if (!prev || c.score < prev.score) {
            byId.set(id, c);
        }
    }
    return [...byId.values()].sort((a, b) => a.score - b.score);
}

function substringCatalogHits(haystack, list, limit) {
    const hay = String(haystack || '').toLowerCase();
    if (!hay) return [];
    const hits = [];
    for (const p of list) {
        const name = String(p?.name ?? '').toLowerCase().trim();
        if (name.length < 3 || !hay.includes(name)) continue;
        hits.push({ item: p, score: 0.08 });
        if (hits.length >= limit) break;
    }
    return hits;
}

/**
 * Product names for Whisper initial prompt (improves recognition of catalog terms).
 * @param {any[]} products
 * @param {number} [maxNames=40]
 */
export function buildCatalogWhisperPrompt(products, maxNames = 40) {
    const names = [
        ...new Set(
            (products || [])
                .map((p) => String(p?.name ?? '').trim())
                .filter((n) => n.length >= 2 && n.length <= 48),
        ),
    ].slice(0, maxNames);
    const sample = names.slice(0, 3);
    const productHint = names.length ? names.join(', ') : 'water, bread, rice, soap, milk';
    const exA = sample[0] || 'water';
    const exB = sample[1] || 'bread';
    return (
        `Retail store order with quantities. Products: ${productHint}. ` +
        `Example phrases: two ${exA}, three ${exB}, five ${exA} and one ${exB}.`
    );
}

/**
 * @returns {Promise<any[]>}
 */
export async function getVoiceCatalogProducts() {
    return loadProductsCache();
}

/**
 * @param {string} query
 * @param {number} [limit=5]
 * @param {any[]|null} [catalogOverride]
 * @param {{ loose?: boolean }} [options]
 */
export async function findVoiceProductCandidates(query, limit = 5, catalogOverride = null, options = {}) {
    const q = String(query || '').trim();
    if (!q) return [];

    const list = catalogOverride != null ? catalogOverride : await loadProductsCache();
    if (!Array.isArray(list) || list.length === 0) return [];

    const fuse = ensureFuse(list, options.loose === true);
    const results = fuse.search(q, { limit: Math.min(limit, 50) });
    return results.map((r) => ({
        item: r.item,
        score: typeof r.score === 'number' ? r.score : 1,
    }));
}

/**
 * Match one parsed line with fallbacks when STT or parse is imperfect.
 * @param {string} rawItem
 * @param {{ catalog?: any[], fullTranscript?: string, limit?: number }} [opts]
 */
export async function resolveVoiceLineItem(rawItem, opts = {}) {
    const limit = opts.limit ?? 5;
    const list = opts.catalog != null ? opts.catalog : await loadProductsCache();
    if (!Array.isArray(list) || list.length === 0) return [];

    const q = String(rawItem || '').trim();
    const full = String(opts.fullTranscript || '').trim();

    let candidates = await findVoiceProductCandidates(q, limit, list);
    const best = candidates[0]?.score;

    if (!candidates.length || (typeof best === 'number' && best > GOOD_MATCH_SCORE)) {
        const loose = await findVoiceProductCandidates(q, limit, list, { loose: true });
        candidates = mergeCandidates(candidates, loose);
    }

    if (full && full.toLowerCase() !== q.toLowerCase()) {
        const fromFull = await findVoiceProductCandidates(full, limit, list, { loose: true });
        candidates = mergeCandidates(candidates, fromFull);
    }

    const subHits = substringCatalogHits(`${q} ${full}`, list, limit);
    candidates = mergeCandidates(candidates, subHits);

    return candidates.slice(0, limit);
}

/** Invalidate in-memory fuse when catalog refreshed elsewhere */
export function resetVoiceCatalogIndex() {
    fuseStrict = null;
    fuseLoose = null;
    catalogSignature = '';
}
