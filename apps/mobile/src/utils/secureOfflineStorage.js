import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import Aes from 'react-native-aes-crypto';

export const SECURE_PENDING_SALES_KEY = 'SHOPYNN_PENDING_SALES';
export const SECURE_HELD_SALES_KEY = 'SHOPYNN_HELD_SALES';

const SERVICE_DATA_KEY = 'com.shopynn.data.encryption.key';
const ENCRYPTED_PREFIX = 'ENC::';

let keyCache = null;

async function withRetry(fn) {
    try {
        return await fn();
    } catch {
        return fn();
    }
}

/**
 * The data key from the Keychain, created on first use. Returns null when the Keychain can't be
 * read right now; never creates a new key in that case, which would orphan already-encrypted data.
 */
async function getOrCreateDataKey() {
    if (keyCache) return keyCache;
    let creds;
    try {
        creds = await withRetry(() => Keychain.getGenericPassword({ service: SERVICE_DATA_KEY }));
    } catch (_) {
        return null;
    }
    try {
        if (creds?.password) {
            keyCache = creds.password;
            return keyCache;
        }
        const key = await Aes.randomKey(32);
        await withRetry(() =>
            Keychain.setGenericPassword(SERVICE_DATA_KEY, key, {
                service: SERVICE_DATA_KEY,
                accessible: Keychain.ACCESSIBLE?.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
            }),
        );
        keyCache = key;
        return key;
    } catch (_) {
        return null;
    }
}

function safeParse(value, fallback) {
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}

const asList = (value) => (Array.isArray(value) ? value : []);

/**
 * Lists whose stored copy has been read this session. Every change is mirrored here first, so a
 * stored copy that can't be decrypted right now is never overwritten with a partial list.
 */
const loaded = new Map();
/** Changes made while the stored copy couldn't be read; merged in once it can. */
const unsaved = new Map();

/** @returns {Promise<{ ok: boolean, list: any[], plaintext?: boolean }>} */
async function loadStored(key) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return { ok: true, list: [] };
    if (!raw.startsWith(ENCRYPTED_PREFIX)) {
        // Written by older builds; re-encrypted on the next save.
        return { ok: true, list: asList(safeParse(raw, [])), plaintext: true };
    }
    const dataKey = await getOrCreateDataKey();
    if (!dataKey) return { ok: false, list: [] };
    const payload = safeParse(raw.slice(ENCRYPTED_PREFIX.length), null);
    if (!payload?.iv || !payload?.cipher) return { ok: true, list: [] };
    try {
        const json = await Aes.decrypt(payload.cipher, dataKey, payload.iv, 'aes-256-cbc');
        return { ok: true, list: asList(safeParse(json || '[]', [])) };
    } catch (_) {
        return { ok: true, list: [] };
    }
}

/** Encrypt and store the in-memory list. Without a key the stored copy is left as it was. */
async function persist(key) {
    const dataKey = await getOrCreateDataKey();
    if (!dataKey) return;
    const iv = await Aes.randomKey(16);
    const cipher = await Aes.encrypt(JSON.stringify(loaded.get(key)), dataKey, iv, 'aes-256-cbc');
    await AsyncStorage.setItem(key, `${ENCRYPTED_PREFIX}${JSON.stringify({ iv, cipher })}`);
}

function mergeById(stored, added) {
    const ids = new Set(stored.map((item) => item?.id).filter(Boolean));
    return [...stored, ...added.filter((item) => !item?.id || !ids.has(item.id))];
}

/**
 * Read a list stored encrypted in AsyncStorage. Never returns plaintext from a new write; older
 * plaintext lists are read once and re-encrypted.
 */
export async function readSecureList(key) {
    if (loaded.has(key)) return [...loaded.get(key)];
    try {
        const stored = await loadStored(key);
        if (!stored.ok) return [...(unsaved.get(key) || [])];
        loaded.set(key, mergeById(stored.list, unsaved.get(key) || []));
        unsaved.delete(key);
        if (stored.plaintext || loaded.get(key).length !== stored.list.length) await persist(key);
        return [...loaded.get(key)];
    } catch (_) {
        return [...(unsaved.get(key) || [])];
    }
}

export async function writeSecureList(key, list) {
    const normalized = asList(list);
    if (loaded.has(key)) {
        loaded.set(key, normalized);
    } else {
        // The caller only saw the unsaved items, so its list replaces them on top of the stored copy.
        let stored;
        try {
            stored = await loadStored(key);
        } catch (_) {
            stored = { ok: false };
        }
        if (!stored.ok) {
            unsaved.set(key, normalized);
            return;
        }
        loaded.set(key, mergeById(stored.list, normalized));
        unsaved.delete(key);
    }
    try {
        await persist(key);
    } catch (_) {}
}

export async function removeSecureValue(key) {
    loaded.delete(key);
    unsaved.delete(key);
    await AsyncStorage.removeItem(key);
}

export async function clearSensitiveOfflineData() {
    for (const key of [SECURE_PENDING_SALES_KEY, SECURE_HELD_SALES_KEY]) {
        loaded.delete(key);
        unsaved.delete(key);
    }
    await AsyncStorage.multiRemove([SECURE_PENDING_SALES_KEY, SECURE_HELD_SALES_KEY]);
}
