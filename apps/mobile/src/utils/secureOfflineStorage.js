import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import Aes from 'react-native-aes-crypto';

export const SECURE_PENDING_SALES_KEY = 'CHEQSTOCK_PENDING_SALES';
export const SECURE_HELD_SALES_KEY = 'CHEQSTOCK_HELD_SALES';

const SERVICE_DATA_KEY = 'com.cheqstock.data.encryption.key';
const ENCRYPTED_PREFIX = 'ENC::';

let keyCache = null;

async function getOrCreateDataKey() {
    if (keyCache) return keyCache;
    try {
        const creds = await Keychain.getGenericPassword({ service: SERVICE_DATA_KEY });
        if (creds?.password) {
            keyCache = creds.password;
            return keyCache;
        }
        const key = await Aes.randomKey(32);
        await Keychain.setGenericPassword(SERVICE_DATA_KEY, key, { service: SERVICE_DATA_KEY });
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

async function encryptPayload(value) {
    const key = await getOrCreateDataKey();
    if (!key) return null;
    const iv = await Aes.randomKey(16);
    const cipher = await Aes.encrypt(value, key, iv, 'aes-256-cbc');
    return `${ENCRYPTED_PREFIX}${JSON.stringify({ iv, cipher })}`;
}

async function decryptPayload(value) {
    const key = await getOrCreateDataKey();
    if (!key) return null;
    const payload = safeParse(value.slice(ENCRYPTED_PREFIX.length), null);
    if (!payload?.iv || !payload?.cipher) return null;
    return Aes.decrypt(payload.cipher, key, payload.iv, 'aes-256-cbc');
}

/**
 * Read secure array value from AsyncStorage.
 * Supports legacy plaintext JSON and auto-migrates to encrypted format.
 */
export async function readSecureList(key) {
    try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return [];

        if (raw.startsWith(ENCRYPTED_PREFIX)) {
            const decrypted = await decryptPayload(raw);
            const parsed = safeParse(decrypted || '[]', []);
            return Array.isArray(parsed) ? parsed : [];
        }

        const legacyParsed = safeParse(raw, []);
        const list = Array.isArray(legacyParsed) ? legacyParsed : [];
        await writeSecureList(key, list);
        return list;
    } catch (_) {
        return [];
    }
}

export async function writeSecureList(key, list) {
    const normalized = Array.isArray(list) ? list : [];
    const serialized = JSON.stringify(normalized);
    try {
        const encrypted = await encryptPayload(serialized);
        if (encrypted) {
            await AsyncStorage.setItem(key, encrypted);
            return;
        }
    } catch (_) {}
    await AsyncStorage.setItem(key, serialized);
}

export async function removeSecureValue(key) {
    await AsyncStorage.removeItem(key);
}

export async function clearSensitiveOfflineData() {
    await AsyncStorage.multiRemove([SECURE_PENDING_SALES_KEY, SECURE_HELD_SALES_KEY]);
}
