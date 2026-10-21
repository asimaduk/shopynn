import 'react-native-get-random-values'; //polyfill for crypto.getRandomValues
import AsyncStorage from '@react-native-async-storage/async-storage'
import { legacy_createStore as createStore } from 'redux'
import { persistStore, persistReducer, createTransform } from 'redux-persist'
import * as Keychain from 'react-native-keychain';
import Aes from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';

import rootReducer from './reducers'

const KEY_SERVICE = 'com.shopynn.persist.key';
// Static key used before per-device keys. Read only to migrate existing installs, and used when
// the Keychain is unavailable.
const LEGACY_KEY = __DEV__ ? '__test__' : 'change-me-in-production-use-env-or-build-secret';

let secretKey = null;
let keyPromise = null;

const randomKey = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');

function loadSecretKey() {
    if (!keyPromise) {
        keyPromise = (async () => {
            try {
                const creds = await Keychain.getGenericPassword({ service: KEY_SERVICE });
                if (creds?.password) return creds.password;
                const key = randomKey();
                await Keychain.setGenericPassword('persist', key, {
                    service: KEY_SERVICE,
                    accessible: Keychain.ACCESSIBLE?.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
                });
                return key;
            } catch {
                return LEGACY_KEY;
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
    (state) => Aes.encrypt(JSON.stringify(state), secretKey || LEGACY_KEY).toString(),
    (stored) => {
        if (typeof stored !== 'string') return undefined;
        const key = secretKey || LEGACY_KEY;
        const state = decrypt(stored, key);
        return state !== undefined || key === LEGACY_KEY ? state : decrypt(stored, LEGACY_KEY);
    },
);

// Rehydration waits for the key; writes only start after rehydration, so they always have it.
const storage = {
    getItem: async (name) => {
        await loadSecretKey();
        return AsyncStorage.getItem(name);
    },
    setItem: (name, value) => AsyncStorage.setItem(name, value),
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
