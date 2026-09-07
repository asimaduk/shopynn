import 'react-native-get-random-values'; //polyfill for redux-persist-transform-encrypt
import AsyncStorage from '@react-native-async-storage/async-storage'
import { legacy_createStore as createStore } from 'redux'
import { persistStore, persistReducer } from 'redux-persist'
import { encryptTransform } from 'redux-persist-transform-encrypt';
// import { getUniqueId } from 'react-native-device-info';

// import uuid from 'react-native-uuid';

import rootReducer from './reducers'

// const getID = async () => {
//     const id = await getUniqueId();
//     return id;
// };

// Security: redux-persist encryption key. In production set REDUX_PERSIST_SECRET (e.g. via react-native-config).
// For device-bound key you'd need async store creation (e.g. key from Keychain); sync fallback below.
const getPersistSecret = () => {
    if (__DEV__) return '__test__';
    if (typeof process !== 'undefined' && process.env && process.env.REDUX_PERSIST_SECRET) {
        return process.env.REDUX_PERSIST_SECRET;
    }
    return 'change-me-in-production-use-env-or-build-secret';
};
const params = { secretKey: getPersistSecret() };

// console.log('prms',params);

const encryptor = encryptTransform(params);

// const encryptor = encryptTransform({
//     secretKey: uid, // Replace with a secure, dynamically generated key
//     // onError: function(error) {
//     //     // Handle encryption/decryption errors
//     //     console.error('Encryption/Decryption Error:', error);
//     // }
// });
    
const persistConfig = {
    key: 'root',
    storage: AsyncStorage,
    transforms: [encryptor]
}

const persistedReducer = persistReducer(persistConfig, rootReducer)

export default () => {
    let store = createStore(persistedReducer)
    let persistor = persistStore(store)
    return { store, persistor }
}