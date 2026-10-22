import 'react-native-get-random-values'; //polyfill for crypto.getRandomValues
import AsyncStorage from '@react-native-async-storage/async-storage'
import { legacy_createStore as createStore } from 'redux'
import { persistStore, persistReducer, createTransform } from 'redux-persist'
import * as Keychain from 'react-native-keychain';
import Aes from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';

import rootReducer from './reducers'

const KEY_SERVICE = 'com.shopynn.persist.key';
// Static key used before per-device keys. Only used to read state saved by older builds.
const LEGACY_KEY = __DEV__ ? '__test__' : 'change-me-in-production-use-env-or-build-secret';

let secretKey = null;
let keyPromise = null;

const randomKey = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');

async function withRetry(fn) {
    try {
        return await fn();
    } catch {
        return fn();
    }
}

/**
 * Per-device key from the Keychain. Null when the Keychain can't be read: state is then not saved
 * this session (rather than saved under a weak key), and the stored copy is left for next launch.
 */
function loadSecretKey() {
    if (!keyPromise) {
        keyPromise = (async () => {
            let creds;
            try {
                creds = await withRetry(() => Keychain.getGenericPassword({ service: KEY_SERVICE }));
            } catch {
                return null;
            }
            if (creds?.password) return creds.password;
            try {
                const key = randomKey();
                await withRetry(() =>
                    Keychain.setGenericPassword('persist', key, {
                        service: KEY_SERVICE,
                        accessible: Keychain.ACCESSIBLE?.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
                    }),
                );
                return key;
            } catch {
                return null;
            }
        })().then((key) => {
            secretKey = key;
            return key;
        });
    }
    return keyPromise;
}

function decrypt(cipher, key) {
    try {
        const json = Aes.decrypt(cipher, key).toString(Utf8);
        return json ? JSON.parse(json) : undefined;
    } catch {
        return undefined;
    }
}

const encryptor = createTransform(
    (state) => (secretKey ? Aes.encrypt(JSON.stringify(state), secretKey).toString() : null),
    (stored) => {
        if (typeof stored !== 'string') return undefined;
        const state = secretKey ? decrypt(stored, secretKey) : undefined;
        return state !== undefined ? state : decrypt(stored, LEGACY_KEY);
    },
);

// Rehydration waits for the key; writes only start after rehydration, so they know whether it exists.
const storage = {
    getItem: async (name) => {
        await loadSecretKey();
        return AsyncStorage.getItem(name);
    },
    setItem: (name, value) => (secretKey ? AsyncStorage.setItem(name, value) : Promise.resolve()),
    removeItem: (name) => AsyncStorage.removeItem(name),
};

const persistConfig = {
    key: 'root',
    storage,
    transforms: [encryptor]
}

const persistedReducer = persistReducer(persistConfig, rootReducer)

export default () => {
    let store = createStore(persistedReducer)
    let persistor = persistStore(store)
    return { store, persistor }
}
