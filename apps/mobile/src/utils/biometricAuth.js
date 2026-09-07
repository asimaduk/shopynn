import * as Keychain from 'react-native-keychain';
import ReactNativeBiometrics from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_CREDENTIALS_SERVICE = 'com.cheqstock.biometric';
const BIOMETRIC_ENABLED_KEY = 'BIOMETRIC_LOGIN_ENABLED';

/** react-native-biometrics v3 uses a class; methods are on the instance, not static. */
function getBiometrics() {
  return new ReactNativeBiometrics();
}

/**
 * Check if the device supports biometrics (Face ID, Touch ID, fingerprint).
 */
export async function isBiometricSupported() {
  try {
    const rnBiometrics = getBiometrics();
    const result = await rnBiometrics.isSensorAvailable();
    return result?.available === true;
  } catch {
    return false;
  }
}

/**
 * Get a user-friendly label for the biometric type (e.g. "Face ID", "Fingerprint").
 */
export async function getBiometricType() {
  try {
    const rnBiometrics = getBiometrics();
    const { biometryType } = await rnBiometrics.isSensorAvailable();
    if (biometryType === 'FaceID') return 'Face ID';
    if (biometryType === 'TouchID') return 'Touch ID';
    if (biometryType === 'Biometrics') return 'Fingerprint';
    return 'Biometrics';
  } catch {
    return 'Biometrics';
  }
}

/**
 * Check if the user has previously enabled biometric login (we have stored credentials).
 */
export async function isBiometricLoginEnabled() {
  try {
    const value = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Store credentials in Keychain with biometric protection, and set the "enabled" flag.
 */
export async function enableBiometricLogin(username, password) {
  try {
    const payload = JSON.stringify({ username, password });
    await Keychain.setGenericPassword('credentials', payload, {
      service: BIOMETRIC_CREDENTIALS_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Remove stored credentials and disable biometric login.
 */
export async function disableBiometricLogin() {
  try {
    await Keychain.resetGenericPassword({ service: BIOMETRIC_CREDENTIALS_SERVICE });
    await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Authenticate with biometrics and return stored credentials.
 * Important: do NOT pre-prompt with rnBiometrics.simplePrompt here, because
 * Keychain accessControl already triggers biometric auth. Pre-prompting causes
 * duplicate face/fingerprint validation dialogs on some devices.
 */
export async function getCredentialsWithBiometric() {
  const enabled = await isBiometricLoginEnabled();
  if (!enabled) return null;

  const rnBiometrics = getBiometrics();
  const { available } = await rnBiometrics.isSensorAvailable();
  if (!available) return null;

  try {
    const result = await Keychain.getGenericPassword({
      service: BIOMETRIC_CREDENTIALS_SERVICE,
      authenticationPrompt: {
        title: 'Sign in to Shopynn',
        subtitle: 'Verify your identity',
        description: 'Use biometrics to access saved credentials',
        cancel: 'Cancel',
      },
    });
    if (!result || !result.password) return null;
    const parsed = JSON.parse(result.password);
    return { username: parsed.username, password: parsed.password };
  } catch {
    return null;
  }
}
