import { useCallback } from 'react';
import { NativeModules, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

const ScreenSecurity = Platform.OS === 'android' ? NativeModules.ScreenSecurity : null;

/**
 * Blocks screenshots, recording and the app-switcher preview while the screen is focused.
 * Android only: iOS covers the app-switcher preview for every screen in AppDelegate.
 */
const useSecureScreen = () => {
    useFocusEffect(
        useCallback(() => {
            if (!ScreenSecurity) return undefined;
            ScreenSecurity.enable();
            return () => ScreenSecurity.disable();
        }, []),
    );
};

export default useSecureScreen;
