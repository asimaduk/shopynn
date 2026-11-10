import React from 'react';
import { BackHandler, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import useTheme from '../hooks/useTheme';
import AppText from './text';

const MESSAGES = {
    emulator: 'Shopynn cannot run on an emulator. Install the app on a physical phone or tablet to continue.',
    rooted: 'This device is rooted or jailbroken, so Shopynn cannot keep your shop and payment data safe on it. Use a device that has not been modified.',
};

const DeviceBlockedScreen = ({ reason }) => {
    const { colors } = useTheme();

    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            <View style={styles.iconWrap}>
                <Lucide name="shield-alert" size={32} color="#dc2626" />
            </View>
            <AppText label="Device not supported" variant={1} fontSize={22} color={colors.text} style={styles.title} />
            <AppText
                label={MESSAGES[reason] || MESSAGES.rooted}
                fontSize={15}
                color={colors.textSecondary}
                style={styles.message}
            />
            {Platform.OS === 'android' ? (
                <TouchableOpacity activeOpacity={0.85} onPress={() => BackHandler.exitApp()} style={styles.button}>
                    <AppText label="Close app" variant={1} fontSize={16} color="#fff" />
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: 18,
        backgroundColor: '#fee2e2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },
    title: {
        marginBottom: 10,
        textAlign: 'center',
    },
    message: {
        textAlign: 'center',
        lineHeight: 22,
    },
    button: {
        marginTop: 28,
        height: 50,
        paddingHorizontal: 36,
        borderRadius: 999,
        backgroundColor: '#dc2626',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default DeviceBlockedScreen;
