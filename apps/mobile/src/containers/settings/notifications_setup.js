import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Switch, View, ScrollView, ActivityIndicator, Alert, Platform, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import { Lucide } from '@react-native-vector-icons/lucide';
import useTheme from '../../hooks/useTheme';
import { users as usersApi } from '../../services/api';
import {
    hasAndroidNotificationPermission,
    promptForNotificationPermission,
    syncFcmTokenToServer,
} from '../../utils/pushNotifications';

const DEFAULT_SETTINGS = {
    lowStock: true,
    newSale: true,
    onlineOrders: true,
    dailySummary: false,
    marketing: false,
};

function preferencesToSettings(prefs) {
    const types = prefs?.notifications?.types;
    if (!types) return DEFAULT_SETTINGS;
    if (Array.isArray(types)) {
        return Object.fromEntries(
            Object.keys(DEFAULT_SETTINGS).map((k) => {
                if (k === 'onlineOrders') {
                    return [k, types.includes('onlineOrders') || types.includes('approvals')];
                }
                return [k, types.includes(k)];
            })
        );
    }
    return {
        lowStock: types.lowStock !== false,
        newSale: types.newSale !== false,
        onlineOrders:
            types.onlineOrders === false
                ? false
                : types.onlineOrders === true
                  ? true
                  : types.approvals !== false,
        dailySummary: types.dailySummary === true,
        marketing: types.marketing === true,
    };
}

function settingsToPreferences(settings, existingPrefs) {
    const notif = existingPrefs?.notifications || {};
    const body = {
        notifications: {
            ...notif,
            types: { ...DEFAULT_SETTINGS, ...settings },
        },
    };
    if (existingPrefs?.locale != null) body.locale = existingPrefs.locale;
    if (existingPrefs?.timezone != null) body.timezone = existingPrefs.timezone;
    return body;
}

const NotificationsSetup = ({ navigation, route }) => {
    const { colors } = useTheme();
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [preferences, setPreferences] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pushAllowed, setPushAllowed] = useState(true);
    const [checkingPermission, setCheckingPermission] = useState(false);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        usersApi.mePreferences()
            .then((data) => {
                // console.log('notifications setup data', data);
                if (mounted && data) {
                    setPreferences(data);
                    setSettings(preferencesToSettings(data));
                }
            })
            .catch(() => {
                if (mounted) setSettings(DEFAULT_SETTINGS);
            })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, []);

    const checkNotificationPermission = useCallback(() => {
        if (Platform.OS !== 'android') {
            setPushAllowed(true);
            return;
        }
        setCheckingPermission(true);
        hasAndroidNotificationPermission()
            .then((granted) => {
                setPushAllowed(!!granted);
            })
            .catch(() => {
                setPushAllowed(true);
            })
            .finally(() => setCheckingPermission(false));
    }, []);

    useEffect(() => {
        checkNotificationPermission();
    }, [checkNotificationPermission]);

    const requestNotificationPermission = useCallback(async () => {
        if (Platform.OS !== 'android') {
            return;
        }
        setCheckingPermission(true);
        try {
            const granted = await promptForNotificationPermission({
                title: 'Enable push notifications',
                message:
                    'Allow Shopynn to send alerts for low stock, online orders, and your daily sales summary. You can turn individual alerts on or off below.',
                confirmLabel: 'Allow',
                cancelLabel: 'Not now',
            });
            setPushAllowed(granted);
            if (granted) {
                await syncFcmTokenToServer();
            }
        } finally {
            setCheckingPermission(false);
        }
    }, []);

    const backPress = () => {
        navigation.goBack();
    };

    const savePreferences = useCallback(async (newSettings) => {
        setSaving(true);
        try {
            const body = settingsToPreferences(newSettings, preferences);
            await usersApi.updateMePreferences(body);
            setPreferences((prev) => ({ ...prev, notifications: { ...prev?.notifications, ...body.notifications } }));
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || 'Failed to save preferences';
            Alert.alert('Error', msg);
        } finally {
            setSaving(false);
        }
    }, [preferences]);

    const toggleSetting = async (key) => {
        const turningOn = !settings[key];
        if (turningOn && Platform.OS === 'android' && !pushAllowed) {
            const granted = await promptForNotificationPermission({
                title: 'Notifications are off',
                message:
                    'This alert needs push permission on your device. Enable notifications so Shopynn can reach you.',
                confirmLabel: 'Enable',
                cancelLabel: 'Cancel',
            });
            setPushAllowed(granted);
            if (!granted) return;
            await syncFcmTokenToServer();
        }
        setSettings((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            savePreferences(next);
            return next;
        });
    };

    const SettingRow = ({ label, description, value, onValueChange, icon }) => (
        <View style={[styles.settingRow, { backgroundColor: colors.surface }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
                <Lucide name={icon} size={20} color={colors.textSecondary} />
            </View>
            <View style={{ flex: 1, marginRight: 10 }}>
                <AppText label={label} variant={1} color={colors.text} fontSize={15} />
                <AppText label={description} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: colors.border, true: config.THEME_COLOR + '50' }}
                thumbColor={value ? config.THEME_COLOR : colors.surfaceSecondary}
            />
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading preferences..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label={'Notification Settings'}>
                {saving ? <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginRight: 12 }} /> : null}
            </ScreenHeader>
            <ScrollView contentContainerStyle={{ padding: 15 }}>
                <View style={[styles.infoBox, { backgroundColor: colors.surface, borderLeftColor: config.THEME_COLOR }]}>
                    <Lucide name="info" size={18} color={config.THEME_COLOR} />
                    <AppText
                        label="Choose which notifications you'd like to receive on your device. You can update these settings at any time."
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ flex: 1, marginLeft: 10 }}
                    />
                </View>

                {!pushAllowed && (
                    <View style={[styles.infoBox, { backgroundColor: colors.surfaceSecondary, borderLeftColor: colors.error, marginTop: 8 }]}>
                        <Lucide name="bell-off" size={18} color={colors.error} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <AppText
                                label="Push notifications are off on this device. Enable them to receive the alerts you choose below."
                                fontSize={13}
                                color={colors.textSecondary}
                            />
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 }}>
                                <TouchableOpacity
                                    onPress={requestNotificationPermission}
                                    disabled={checkingPermission}
                                    style={{
                                        alignSelf: 'flex-start',
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 16,
                                        backgroundColor: checkingPermission ? colors.border : config.THEME_COLOR,
                                    }}
                                >
                                    <AppText
                                        label={checkingPermission ? 'Requesting...' : 'Enable notifications'}
                                        fontSize={12}
                                        color={colors.onPrimary || '#fff'}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => Linking.openSettings().catch(() => {})}
                                    style={{
                                        alignSelf: 'flex-start',
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 16,
                                        borderWidth: StyleSheet.hairlineWidth,
                                        borderColor: colors.border,
                                    }}
                                >
                                    <AppText label="Open settings" fontSize={12} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <AppText label="Inventory & Sales" variant={1} fontSize={14} color={colors.textTertiary} style={styles.sectionTitle} />
                    <View style={[styles.card, { backgroundColor: colors.surface }]}>
                        <SettingRow
                            label="Low Stock Alerts"
                            description="Notify me when products fall below their minimum levels."
                            value={settings.lowStock}
                            onValueChange={() => toggleSetting('lowStock')}
                            icon="package-search"
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <SettingRow
                            label="New Sales"
                            description="Instant notification for every new transaction."
                            value={settings.newSale}
                            onValueChange={() => toggleSetting('newSale')}
                            icon="shopping-cart"
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <AppText label="Operations & Reports" variant={1} fontSize={14} color={colors.textTertiary} style={styles.sectionTitle} />
                    <View style={[styles.card, { backgroundColor: colors.surface }]}>
                        <SettingRow
                            label="Online orders"
                            description="Get push alerts for new online store orders."
                            value={settings.onlineOrders}
                            onValueChange={() => toggleSetting('onlineOrders')}
                            icon="package"
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <SettingRow
                            label="Daily Summary"
                            description="Receive an end-of-day business performance report."
                            value={settings.dailySummary}
                            onValueChange={() => toggleSetting('dailySummary')}
                            icon="chart-column"
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 5,
        marginBottom: 20,
        alignItems: 'center',
        borderLeftWidth: 4,
        borderLeftColor: config.THEME_COLOR,
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        marginBottom: 10,
        marginLeft: 5,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 5,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    divider: {
        height: 1,
        marginLeft: 63,
    }
});

export default NotificationsSetup;