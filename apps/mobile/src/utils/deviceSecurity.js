import { Platform } from 'react-native';
import JailMonkey from 'jail-monkey';

export function getDeviceSecurityState() {
    try {
        const jailBroken = !!JailMonkey.isJailBroken();
        const rootedFromTestKeys = typeof JailMonkey.trustFall === 'function' ? !!JailMonkey.trustFall() : false;
        const onExternalStorage =
            Platform.OS === 'android' && typeof JailMonkey.isOnExternalStorage === 'function'
                ? !!JailMonkey.isOnExternalStorage()
                : false;
        const canMockLocation =
            Platform.OS === 'android' && typeof JailMonkey.canMockLocation === 'function'
                ? !!JailMonkey.canMockLocation()
                : false;

        const isCompromised = jailBroken || rootedFromTestKeys || onExternalStorage || canMockLocation;

        return {
            isCompromised,
            checks: {
                jailBroken,
                rootedFromTestKeys,
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
