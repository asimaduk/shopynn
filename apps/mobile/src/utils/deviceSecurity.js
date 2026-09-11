import { Platform } from 'react-native';
import JailMonkey from 'jail-monkey';
import DeviceInfo from 'react-native-device-info';

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
