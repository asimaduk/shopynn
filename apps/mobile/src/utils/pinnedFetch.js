/**
 * Optional certificate-pinned fetch.
 * Install react-native-ssl-pinning and add your cert hashes to enable.
 * Without the lib, falls back to global fetch (no pinning).
 *
 * Setup:
 * 1. npm install react-native-ssl-pinning && pod install
 * 2. Add your server's certificate(s) to the app (see lib docs).
 * 3. Set PINNED_CERTS in config below (cert names or SHA256 hashes for public key pinning).
 */
import config from '../config';

let pinnedFetch = null;
try {
    const sslPinning = require('react-native-ssl-pinning');
    pinnedFetch = sslPinning.fetch;
} catch (_) {
    pinnedFetch = null;
}

const PINNED_CERTS = []; // e.g. ['myserver'] or SHA256 hashes for public key pinning

/**
 * Fetch with optional SSL pinning. Use for sensitive API calls when pinning is configured.
 * When react-native-ssl-pinning is not installed or PINNED_CERTS is empty, uses global fetch.
 */
export async function secureFetch(url, options = {}, opts = {}) {
    const timeout = opts.timeout ?? 30000;
    const usePinning = pinnedFetch && PINNED_CERTS.length > 0 && url.startsWith('https');

    const fetchOpts = {
        ...options,
        ...(usePinning && { timeoutInterval: timeout, sslPinning: { certs: PINNED_CERTS } }),
    };

    const fetcher = usePinning ? pinnedFetch : global.fetch;
    return fetcher(url, fetchOpts);
}

export const isPinningAvailable = () => !!pinnedFetch && PINNED_CERTS.length > 0;
