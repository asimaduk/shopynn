import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import config from '../config';
import useTheme from '../hooks/useTheme';
import { APP_LOCK_AFTER_MS, isAppLockEnabled, promptAppUnlock } from '../utils/appLock';
import AppText from './text';

/**
 * Full-screen biometric lock over the signed-in app: on launch and after the app has been in the
 * background for APP_LOCK_AFTER_MS. Only 'background' counts, because the biometric prompt itself
 * makes iOS report 'inactive'.
 */
const AppLockGate = ({ isLoggedIn, onSignOut }) => {
    const { colors } = useTheme();
    const [locked, setLocked] = useState(false);
    const backgroundedAt = useRef(null);
    const prompting = useRef(false);
    const launched = useRef(false);

    const unlock = useCallback(async () => {
        if (prompting.current) return;
        prompting.current = true;
        try {
            if (await promptAppUnlock()) setLocked(false);
        } finally {
            prompting.current = false;
        }
    }, []);

    const lockIfEnabled = useCallback(async () => {
        if (await isAppLockEnabled()) {
            setLocked(true);
            unlock();
        }
    }, [unlock]);

    useEffect(() => {
        // Lock on launch with a restored session, but not straight after signing in.
        const isLaunch = !launched.current;
        launched.current = true;
        if (!isLoggedIn) {
            setLocked(false);
            return undefined;
        }
        if (isLaunch) lockIfEnabled();
        const sub = AppState.addEventListener('change', (next) => {
            if (next === 'background') {
                backgroundedAt.current = Date.now();
            } else if (next === 'active' && backgroundedAt.current != null) {
                const away = Date.now() - backgroundedAt.current;
                backgroundedAt.current = null;
                if (away >= APP_LOCK_AFTER_MS) lockIfEnabled();
            }
        });
        return () => sub.remove();
    }, [isLoggedIn, lockIfEnabled]);

    if (!isLoggedIn || !locked) return null;

    return (
        <View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.background }]}>
            <View style={[styles.iconWrap, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                <Lucide name="lock" size={30} color={config.THEME_COLOR} />
            </View>
            <AppText label="Shopynn is locked" variant={1} fontSize={22} color={colors.text} style={styles.title} />
            <AppText
                label="Verify it's you to continue."
                fontSize={15}
                color={colors.textSecondary}
                style={styles.message}
            />
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={unlock}
                style={[styles.button, { backgroundColor: config.THEME_COLOR }]}
            >
                <Lucide name="scan-face" size={18} color="#fff" />
                <AppText label="Unlock" variant={1} fontSize={16} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={onSignOut} style={styles.signOut}>
                <AppText label="Sign out instead" fontSize={15} color={colors.textSecondary} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        zIndex: 1000,
        elevation: 1000,
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },
    title: {
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        textAlign: 'center',
    },
    button: {
        flexDirection: 'row',
        marginTop: 28,
        height: 50,
        paddingHorizontal: 36,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    signOut: {
        paddingVertical: 16,
    },
});

export default AppLockGate;
