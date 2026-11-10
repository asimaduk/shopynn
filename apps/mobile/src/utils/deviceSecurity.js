import { Platform } from 'react-native';
import JailMonkey from 'jail-monkey';
import DeviceInfo from 'react-native-device-info';

/**
 * Release builds refuse to run on rooted/jailbroken devices and Android emulators.
 * Debug builds are never blocked so simulators and dev phones keep working.
 * @returns {'emulator'|'rooted'|null}
 */
export function getDeviceBlockReason() {
    if (__DEV__) return null;
    try {
        // Checked first: emulator images also trip the root heuristics.
        if (Platform.OS === 'android' && typeof DeviceInfo.isEmulatorSync === 'function' && DeviceInfo.isEmulatorSync()) {
            return 'emulator';
        }
        if (JailMonkey.isJailBroken()) return 'rooted';
    } catch (_) {}
    return null;
}

export function getDeviceSecurityState() {
    try {
        // Simulators/emulators trip jailbreak heuristics; only warn on real devices.
        const isEmulator =
            typeof DeviceInfo.isEmulatorSync === 'function'
                ? !!DeviceInfo.isEmulatorSync()
                : false;
        if (isEmulator) {
            return {
                isCompromised: false,
                checks: { isEmulator: true },
            };
        }

        const jailBroken = !!JailMonkey.isJailBroken();
        // Avoid JailMonkey.trustFall() — it folds in canMockLocation and over-alerts on some builds.
        const onExternalStorage =
            Platform.OS === 'android' && typeof JailMonkey.isOnExternalStorage === 'function'
                ? !!JailMonkey.isOnExternalStorage()
                : false;
        const canMockLocation =
            Platform.OS === 'android' && typeof JailMonkey.canMockLocation === 'function'
                ? !!JailMonkey.canMockLocation()
                : false;

        const isCompromised = jailBroken || onExternalStorage || canMockLocation;

        return {
            isCompromised,
            checks: {
                isEmulator: false,
                jailBroken,
                onExternalStorage,
                canMockLocation,
            },
        };
    } catch (_) {
        return {
            isCompromised: false,
            checks: {},
        };
    }
}
