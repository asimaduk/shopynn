import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBiometrics from 'react-native-biometrics';

const APP_LOCK_ENABLED_KEY = 'APP_LOCK_ENABLED';

/** Locks again after the app has been in the background this long. */
export const APP_LOCK_AFTER_MS = 60 * 1000;

export async function isAppLockEnabled() {
    try {
        return (await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY)) === 'true';
    } catch {
        return false;
    }
}

export async function setAppLockEnabled(enabled) {
    if (enabled) await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, 'true');
    else await AsyncStorage.removeItem(APP_LOCK_ENABLED_KEY);
}

/** Face ID / fingerprint, falling back to the device passcode. Resolves true when unlocked. */
export async function promptAppUnlock(promptMessage = 'Unlock Shopynn') {
    try {
        const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });
        const { success } = await rnBiometrics.simplePrompt({ promptMessage, cancelButtonText: 'Cancel' });
        return success === true;
    } catch {
        return false;
    }
}
