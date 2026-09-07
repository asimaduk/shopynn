import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import { FlashList } from '@shopify/flash-list';
import { Lucide } from '@react-native-vector-icons/lucide';
import useTheme from '../../hooks/useTheme';
import { notifications as notificationsApi, normalizeList, users as usersApi } from '../../services/api';
import { formatDateAndTime } from '../../utils/format';
import { useSelector } from 'react-redux';
import { canAccessScreen, hasPermission, hasFeature } from '../../utils/permissions';
import { useFocusEffect } from '@react-navigation/native';
import FeatureUpgradePrompt from '../../components/FeatureUpgradePrompt';

const Notifications = ({ navigation, route }) => {
    const { colors } = useTheme();
    const currentUser = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const currentPlanName =
        useSelector(({ appSettings }) => appSettings?.subscriptionPlan?.name) ||
        currentUser?.settings?.subscription?.name ||
        'Free';
    const canViewStaffNotifications = canAccessScreen(currentUser, 'Notifications', subscriptionFeatures);
    const [notifications, setNotifications] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [preferences, setPreferences] = useState(null);
    const [pushEnabled, setPushEnabled] = useState(true);
    const [savingPush, setSavingPush] = useState(false);

    const canOpenNotificationsSettings = hasPermission(currentUser, [
        'notifications.settings.view',
        'notifications.settings.update',
    ]);
    const canOrderPushToggle =
        hasPermission(currentUser, 'orders.create') &&
        hasFeature(currentUser, 'orders.create', subscriptionFeatures) &&
        canViewStaffNotifications;

    const loadNotifications = useCallback(async () => {
        if (!canViewStaffNotifications) return;
        try {
            const raw = await notificationsApi.list({ limit: 50 });
            const list = normalizeList(raw);
            setNotifications(Array.isArray(list) ? list : []);
        } catch (_) {
            setNotifications([]);
        }
    }, [canViewStaffNotifications]);

    const loadPreferences = useCallback(async () => {
        if (!canOrderPushToggle) return;
        try {
            const data = await usersApi.mePreferences();
            setPreferences(data || null);
            setPushEnabled(data?.notifications?.push !== false);
        } catch (_) {
            setPreferences(null);
            setPushEnabled(true);
        }
    }, [canOrderPushToggle]);

    const savePush = useCallback(
        async (next) => {
            if (!canOrderPushToggle) return;
            setSavingPush(true);
            try {
                const notif = preferences?.notifications || {};
                const body = {
                    notifications: {
                        ...notif,
                        push: next,
                    },
                };
                if (preferences?.locale != null) body.locale = preferences.locale;
                if (preferences?.timezone != null) body.timezone = preferences.timezone;
                await usersApi.updateMePreferences(body);
                setPreferences((prev) => ({
                    ...prev,
                    notifications: { ...(prev?.notifications || {}), ...body.notifications },
                }));
                setPushEnabled(next);
            } catch (e) {
                const msg = e?.response?.data?.message || e?.message || 'Could not update settings';
                Alert.alert('Error', msg);
            } finally {
                setSavingPush(false);
            }
        },
        [canOrderPushToggle, preferences],
    );

    useFocusEffect(
        useCallback(() => {
            if (!canViewStaffNotifications) return undefined;
            let cancelled = false;
            (async () => {
                if (canOrderPushToggle) {
                    await loadPreferences();
                }
                if (!cancelled) await loadNotifications();
            })();
            return () => {
                cancelled = true;
            };
        }, [canViewStaffNotifications, canOrderPushToggle, loadPreferences, loadNotifications]),
    );

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([loadNotifications(), canOrderPushToggle ? loadPreferences() : Promise.resolve()]);
        } finally {
            setRefreshing(false);
        }
    }, [loadNotifications, loadPreferences, canOrderPushToggle]);

    const confirmMarkAllRead = useCallback(() => {
        if (!notifications || notifications.length === 0) {
            return;
        }
        const performMarkAll = async () => {
            try {
                const unreadIds = notifications
                    .filter((n) => !n.read && !n.read_at)
                    .map((n) => n.id);
                if (unreadIds.length > 0) {
                    await Promise.all(unreadIds.map((id) => notificationsApi.markRead(id)));
                }
            } catch (e) {
                // ignore errors; UI will still mark local state
            }
            setNotifications((prev) =>
                prev.map((n) => ({
                    ...n,
                    read: true,
                    read_at: n.read_at || new Date().toISOString(),
                })),
            );
        };

        Alert.alert(
            'Mark all as read',
            'Are you sure you want to mark all notifications as read?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Mark all', style: 'destructive', onPress: performMarkAll },
            ],
        );
    }, [notifications]);

    const backPress = () => {
        navigation.goBack();
    };

    const getTypeColor = (type) => {
        if (!type) return colors.textSecondary;
        switch (type) {
            case 'alert': return colors.error;
            case 'error': return colors.error;
            case 'subscription_expiring': return colors.warning;
            case 'subscription_expired': return colors.error;
            case 'subscription_renewed': return config.GREEN_COLOR;
            case 'subscription_cancelled': return colors.error;
            case 'subscription_paused': return colors.warning;
            case 'subscription_resumed': return config.GREEN_COLOR;
            case 'stock_low': return colors.warning;
            case 'stock_out': return colors.error;
            case 'stock_in': return config.GREEN_COLOR;
            case 'stock_adjustment': return colors.info;
            case 'stock_transfer': return colors.info;
            case 'success': return config.GREEN_COLOR;
            case 'action': return colors.info;
            case 'info': return colors.warning;
            case 'warning': return colors.warning;
            case 'payment_received': return config.GREEN_COLOR;
            default: return colors.textSecondary;
        }
    };

    const handleNotificationPress = useCallback(async (item) => {
        if (!item?.id) return;
        try {
            await notificationsApi.markRead(item.id);
            setNotifications((prev) =>
                prev.map((n) =>
                    n.id === item.id ? { ...n, read: true, read_at: n.read_at || new Date().toISOString() } : n
                )
            );
        } catch (e) {
            // fail silently for now
        }
        const screen = item.mobile_screen;
        if (screen && typeof screen === 'string') {
            const params = item.mobile_params && typeof item.mobile_params === 'object' ? item.mobile_params : {};
            try {
                navigation.navigate(screen, params);
            } catch (_) {
                /* unknown route */
            }
        }
    }, [navigation]);

    const pushHeader = useMemo(() => {
        if (!canOrderPushToggle) return null;
        return (
            <View
                style={[
                    styles.pushCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
            >
                <View style={{ flex: 1, marginRight: 12 }}>
                    <AppText label="Push notifications" variant={1} fontSize={15} color={colors.text} />
                    <AppText
                        label="Turn on to receive alerts when your order status changes. In-app messages here are unchanged."
                        fontSize={12}
                        color={colors.textTertiary}
                        style={{ marginTop: 4 }}
                    />
                </View>
                {savingPush ? (
                    <ActivityIndicator color={config.THEME_COLOR} style={{ marginRight: 4 }} />
                ) : (
                    <Switch
                        value={pushEnabled}
                        onValueChange={(v) => savePush(v)}
                        trackColor={{ false: colors.border, true: config.THEME_COLOR + '50' }}
                        thumbColor={pushEnabled ? config.THEME_COLOR : colors.surfaceSecondary}
                    />
                )}
            </View>
        );
    }, [canOrderPushToggle, colors, pushEnabled, savingPush, savePush]);

    const renderNotificationItem = ({ item }) => {
        const typeColor = getTypeColor(item.type);
        const iconName = item.icon && typeof item.icon === 'string' ? item.icon : 'bell';
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleNotificationPress(item)}
                style={[
                    styles.notificationCard,
                    { backgroundColor: colors.surface },
                    !item.read_at && { ...styles.unreadCard, borderLeftColor: config.THEME_COLOR }
                ]}
            >
                <View style={[styles.iconContainer, { backgroundColor: typeColor + '15' }]}>
                    <Lucide name={iconName} size={20} color={ typeColor === config.GREEN_COLOR ? colors.textInverse : typeColor} />
                </View>
                <View style={styles.contentContainer}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <AppText label={item.title} fontSize={15} variant={1} color={colors.text} />
                        {!item.read_at && <View style={[styles.unreadDot, { backgroundColor: config.THEME_COLOR }]} />}
                    </View>
                    <AppText label={item.message} fontSize={13} color={colors.textSecondary} style={{ marginTop: 4 }} numberOfLines={2} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <AppText label={formatDateAndTime(item.created_at)} fontSize={11} color={colors.textTertiary} />
                        {item.type?.toLowerCase().includes('approval') && (
                            <View style={[styles.actionButton, { backgroundColor: config.THEME_COLOR }]}>
                                <AppText label="Review" fontSize={11} color={colors.textInverse} variant={1} />
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (!canViewStaffNotifications) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={backPress} label="Notifications" />
                <FeatureUpgradePrompt
                    navigation={navigation}
                    user={currentUser}
                    featureTitle="In-app notifications"
                    requiredPlanName="Premium"
                    currentPlanName={currentPlanName}
                    description="Staff notification inbox and preferences are available on the Premium plan. Basic and Standard do not include this module."
                    bullets={[
                        'View alerts for sales, stock, and subscription events',
                        'Mark notifications as read',
                        'Configure notification preferences',
                    ]}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label={'Notifications'}>
                <View style={{ flexDirection: 'row', paddingRight: 10 }}>
                    {notifications?.filter((n) => !n.read_at)?.length > 1 && (
                        <TouchableOpacity
                            activeOpacity={0.6}
                            onPress={confirmMarkAllRead}
                            style={[styles.headerIcon, { backgroundColor: colors.surfaceSecondary }]}
                        >
                            <Lucide name="circle-check" color={colors.textSecondary} size={20} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        activeOpacity={0.6}
                        disabled={!canOpenNotificationsSettings}
                        onPress={() => {
                            if (!canOpenNotificationsSettings) {
                                Alert.alert('Permission', 'You are not allowed to update notification settings.');
                                return;
                            }
                            navigation.navigate("NotificationsSetup");
                        }}
                        style={[
                            styles.headerIcon,
                            { backgroundColor: colors.surfaceSecondary, opacity: canOpenNotificationsSettings ? 1 : 0.45 },
                        ]}
                    >
                        <Lucide name="settings-2" color={colors.textSecondary} size={20} />
                    </TouchableOpacity>
                </View>
            </ScreenHeader>

            <View style={{ flex: 1 }}>
                <FlashList
                    data={notifications}
                    estimatedItemSize={100}
                    keyExtractor={(item) => item.id}
                    renderItem={renderNotificationItem}
                    contentContainerStyle={{ padding: 15, paddingBottom: 24 }}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    ListHeaderComponent={pushHeader ? () => pushHeader : undefined}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyContainer}>
                            <Lucide name="bell-off" size={60} color={colors.border} />
                            <AppText label="No notifications yet" fontSize={16} color={colors.textTertiary} style={{ marginTop: 15 }} />
                        </View>
                    )}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    pushCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        padding: 14,
        marginBottom: 14,
    },
    notificationCard: {
        flexDirection: 'row',
        borderRadius: 5,
        padding: 15,
        marginBottom: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    unreadCard: {
        borderLeftWidth: 4,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    contentContainer: {
        flex: 1,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    actionButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 4,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    }
});

export default Notifications;
