/**
 * Secure token storage using OS Keychain/Keystore.
 * Tokens are kept in memory for the session so reads right after login never race the Keychain.
 * Tokens are never written to AsyncStorage: if the Keychain can't store them they live in memory
 * only, and the user signs in again after restarting the app.
 * Use for BRS_ACCESS_TOKEN and BRS_REFRESH_TOKEN only.
 */
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVICE_ACCESS = 'com.shopynn.auth.access';
const SERVICE_REFRESH = 'com.shopynn.auth.refresh';
// Older builds kept tokens here in plaintext; read only to move them into the Keychain.
const LEGACY_ACCESS_KEY = 'BRS_ACCESS_TOKEN';
const LEGACY_REFRESH_KEY = 'BRS_REFRESH_TOKEN';
const LEGACY_MIGRATION_FLAG = 'BRS_KEYCHAIN_MIGRATION_V2';

// Not restored from backups or onto another device.
const KEYCHAIN_OPTIONS = { accessible: Keychain.ACCESSIBLE?.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

const memory = { access: undefined, refresh: undefined };

async function withRetry(fn) {
    try {
        return await fn();
    } catch {
        return fn();
    }
}

/** @returns {Promise<{ ok: boolean, value: string|null }>} */
async function getKeychain(service) {
    try {
        const creds = await withRetry(() => Keychain.getGenericPassword({ service }));
        return { ok: true, value: creds ? creds.password : null };
    } catch {
        return { ok: false, value: null };
    }
}

async function setKeychain(service, value) {
    try {
        await withRetry(() => Keychain.setGenericPassword(service, value || '', { service, ...KEYCHAIN_OPTIONS }));
        return true;
    } catch {
        return false;
    }
}

async function removeKeychain(service) {
    try {
        await Keychain.resetGenericPassword({ service });
    } catch (_) {}
}

/** Move any plaintext tokens left by older builds into the Keychain (or memory), then delete them. */
let legacyMigration = null;
function migrateLegacyTokens() {
    if (!legacyMigration) {
        legacyMigration = (async () => {
            try {
                const [[, access], [, refresh]] = await AsyncStorage.multiGet([LEGACY_ACCESS_KEY, LEGACY_REFRESH_KEY]);
                if (access) {
                    if (memory.access === undefined) memory.access = access;
                    await setKeychain(SERVICE_ACCESS, access);
                }
                if (refresh) {
                    if (memory.refresh === undefined) memory.refresh = refresh;
                    await setKeychain(SERVICE_REFRESH, refresh);
                }
                await AsyncStorage.multiRemove([LEGACY_ACCESS_KEY, LEGACY_REFRESH_KEY, LEGACY_MIGRATION_FLAG]);
            } catch (_) {}
        })();
    }
    return legacyMigration;
}

async function readToken(slot, service) {
    if (memory[slot] !== undefined) return memory[slot];
    await migrateLegacyTokens();
    if (memory[slot] !== undefined) return memory[slot];
    const { ok, value } = await getKeychain(service);
    // Don't cache a failed read as "signed out"; the next call tries the Keychain again.
    if (!ok) return null;
    memory[slot] = value || null;
    return memory[slot];
}

async function writeToken(slot, service, value) {
    memory[slot] = value;
    await setKeychain(service, value);
}

/**
 * Get access token (memory, then Keychain).
 */
export function getAccessToken() {
    return readToken('access', SERVICE_ACCESS);
}

/**
 * Get refresh token.
 */
export function getRefreshToken() {
    return readToken('refresh', SERVICE_REFRESH);
}

/**
 * Set access and optional refresh token after login/refresh.
 */
export async function setTokens(accessToken, refreshToken = null) {
    if (!accessToken) return;
    await writeToken('access', SERVICE_ACCESS, accessToken);
    if (refreshToken != null) {
        await writeToken('refresh', SERVICE_REFRESH, refreshToken);
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
    await AsyncStorage.multiRemove([LEGACY_ACCESS_KEY, LEGACY_REFRESH_KEY]);
}
