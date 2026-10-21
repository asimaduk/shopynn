/**
 * Secure token storage using OS Keychain/Keystore.
 * Tokens are kept in memory for the session so reads right after login never race the Keychain.
 * AsyncStorage (unencrypted) is only used when the Keychain is unavailable on the device.
 * Use for BRS_ACCESS_TOKEN and BRS_REFRESH_TOKEN only.
 */
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVICE_ACCESS = 'com.shopynn.auth.access';
const SERVICE_REFRESH = 'com.shopynn.auth.refresh';
const ACCESS_TOKEN_KEY = 'BRS_ACCESS_TOKEN';
const REFRESH_TOKEN_KEY = 'BRS_REFRESH_TOKEN';
const MIGRATION_DONE_KEY = 'BRS_KEYCHAIN_MIGRATION_V2';

// Not restored from backups or onto another device.
const KEYCHAIN_OPTIONS = { accessible: Keychain.ACCESSIBLE?.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

let useKeychain = true;
const memory = { access: undefined, refresh: undefined };

async function getKeychain(service) {
    if (!useKeychain) return null;
    try {
        const creds = await Keychain.getGenericPassword({ service });
        return creds ? creds.password : null;
    } catch {
        useKeychain = false;
        return null;
    }
}

async function setKeychain(service, value) {
    if (!useKeychain) return false;
    try {
        await Keychain.setGenericPassword(service, value || '', { service, ...KEYCHAIN_OPTIONS });
        return true;
    } catch {
        useKeychain = false;
        return false;
    }
}

async function removeKeychain(service) {
    try {
        await Keychain.resetGenericPassword({ service });
    } catch (_) {}
}

/**
 * One-time migration: move plaintext tokens from AsyncStorage into the Keychain, then delete them.
 */
async function migrateFromAsyncStorage() {
    try {
        const done = await AsyncStorage.getItem(MIGRATION_DONE_KEY);
        if (done === 'true') return;
        const access = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
        const refresh = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
        const movedAccess = access ? await setKeychain(SERVICE_ACCESS, access) : true;
        const movedRefresh = refresh ? await setKeychain(SERVICE_REFRESH, refresh) : true;
        if (movedAccess && movedRefresh) {
            await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
            await AsyncStorage.setItem(MIGRATION_DONE_KEY, 'true');
        }
    } catch (_) {}
}

async function readToken(slot, service, fallbackKey) {
    if (memory[slot] !== undefined) return memory[slot];
    await migrateFromAsyncStorage();
    const value = (await getKeychain(service)) ?? (await AsyncStorage.getItem(fallbackKey));
    memory[slot] = value || null;
    return memory[slot];
}

async function writeToken(slot, service, fallbackKey, value) {
    memory[slot] = value;
    if (await setKeychain(service, value)) {
        await AsyncStorage.removeItem(fallbackKey);
    } else {
        await AsyncStorage.setItem(fallbackKey, value);
    }
}

/**
 * Get access token (memory, then Keychain, then the AsyncStorage fallback).
 */
export function getAccessToken() {
    return readToken('access', SERVICE_ACCESS, ACCESS_TOKEN_KEY);
}

/**
 * Get refresh token.
 */
export function getRefreshToken() {
    return readToken('refresh', SERVICE_REFRESH, REFRESH_TOKEN_KEY);
}

/**
 * Set access and optional refresh token after login/refresh.
 */
export async function setTokens(accessToken, refreshToken = null) {
    if (!accessToken) return;
    await writeToken('access', SERVICE_ACCESS, ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken != null) {
        await writeToken('refresh', SERVICE_REFRESH, REFRESH_TOKEN_KEY, refreshToken);
    }
}

/**
 * Clear all auth tokens (logout / session expired).
 */
export async function clearTokens() {
    memory.access = null;
    memory.refresh = null;
    await removeKeychain(SERVICE_ACCESS);
    await removeKeychain(SERVICE_REFRESH);
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}
