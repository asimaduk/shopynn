/**
 * Secure token storage using OS Keychain/Keystore.
 * Falls back to AsyncStorage if Keychain is unavailable.
 * Use for BRS_ACCESS_TOKEN and BRS_REFRESH_TOKEN only.
 */
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVICE_ACCESS = 'com.cheqstock.auth.access';
const SERVICE_REFRESH = 'com.cheqstock.auth.refresh';
const ACCESS_TOKEN_KEY = 'BRS_ACCESS_TOKEN';
const REFRESH_TOKEN_KEY = 'BRS_REFRESH_TOKEN';
const MIGRATION_DONE_KEY = 'BRS_KEYCHAIN_MIGRATION_DONE';

let useKeychain = true;

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
        await Keychain.setGenericPassword(service, value || '', { service });
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
 * One-time migration: move tokens from AsyncStorage to Keychain.
 */
async function migrateFromAsyncStorage() {
    try {
        const done = await AsyncStorage.getItem(MIGRATION_DONE_KEY);
        if (done === 'true') return;
        const access = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
        const refresh = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
        if (access) await setKeychain(SERVICE_ACCESS, access);
        if (refresh) await setKeychain(SERVICE_REFRESH, refresh);
        await AsyncStorage.setItem(MIGRATION_DONE_KEY, 'true');
        if (access) await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
        if (refresh) await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch (_) {}
}

/**
 * Get access token (Keychain first, then AsyncStorage fallback).
 */
export async function getAccessToken() {
    await migrateFromAsyncStorage();
    const value = await getKeychain(SERVICE_ACCESS);
    if (value) return value;
    return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Get refresh token.
 */
export async function getRefreshToken() {
    await migrateFromAsyncStorage();
    const value = await getKeychain(SERVICE_REFRESH);
    if (value) return value;
    return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Set access and optional refresh token after login/refresh.
 */
export async function setTokens(accessToken, refreshToken = null) {
    await setKeychain(SERVICE_ACCESS, accessToken);
    if (refreshToken != null) await setKeychain(SERVICE_REFRESH, refreshToken);
    if (!useKeychain) {
        await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        if (refreshToken != null) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
}

/**
 * Clear all auth tokens (logout / session expired).
 */
export async function clearTokens() {
    await removeKeychain(SERVICE_ACCESS);
    await removeKeychain(SERVICE_REFRESH);
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}
