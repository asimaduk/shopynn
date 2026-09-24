import React, { useState } from 'react';
import {
    View,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Linking,
    Alert,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import { Lucide } from '@react-native-vector-icons/lucide';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { customers as customersApi } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';

const customerInitials = (name) => {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length) return 'C';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
};

const sourceMeta = (source, colors) => {
    if (source === 'account') {
        return {
            short: 'App signup',
            detail: 'App signup (linked user)',
            color: config.THEME_COLOR,
            bg: `${config.THEME_COLOR}18`,
        };
    }
    if (source === 'pos') {
        return {
            short: 'POS / admin',
            detail: 'POS / admin',
            color: colors.textSecondary,
            bg: colors.surfaceSecondary || colors.background,
        };
    }
    return {
        short: 'Customer',
        detail: '—',
        color: colors.textTertiary,
        bg: colors.surfaceSecondary || colors.background,
    };
};

const CustomerDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { item: paramItem, customerId } = route.params || {};
    const [item, setItem] = useState(paramItem || {});
    const [loading, setLoading] = useState(!!(customerId || paramItem?.id));

    useFocusEffect(
        React.useCallback(() => {
            const id = customerId || paramItem?.id;
            if (!id) return undefined;
            let mounted = true;
            setLoading(true);
            customersApi
                .get(id)
                .then((data) => {
                    if (mounted && data) setItem((prev) => ({ ...prev, ...data }));
                })
                .catch(() => {})
                .finally(() => {
                    if (mounted) setLoading(false);
                });
            return () => {
                mounted = false;
            };
        }, [customerId, paramItem?.id]),
    );

    const backPress = () => navigation.goBack();

    const handleCall = async () => {
        const phone = String(item.phone || '').trim();
        if (!phone) return;
        const url = `tel:${phone}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) await Linking.openURL(url);
            else Alert.alert('Call', 'This device cannot make phone calls.');
        } catch (err) {
            Alert.alert('Error', err?.message || 'Failed to start the call.');
        }
    };

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={backPress} label="Customer Details" />
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading customer..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
                </View>
            </SafeAreaView>
        );
    }

    if (!item?.name && !item?.id) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={backPress} label="Customer Details" />
                <View style={styles.centered}>
                    <AppText label="Customer not found" fontSize={15} color={colors.textSecondary} />
                </View>
            </SafeAreaView>
        );
    }

    const source = sourceMeta(item.source, colors);
    const isActive = item.is_active !== false && !item.deleted;
    const statusColor = isActive ? config.GREEN_COLOR || '#16a34a' : colors.error;
    const statusLabel = item.deleted ? 'Deleted' : isActive ? 'Active' : 'Inactive';
    const canEdit = item.source !== 'account';
    const details = [
        { label: 'Record type', value: source.detail, icon: 'tag' },
        { label: 'Loyalty points', value: String(Number(item.loyalty_points) || 0), icon: 'star' },
        {
            label: 'Store credit',
            value:
                Number(item.store_credit_balance) > 0
                    ? `GHS ${Number(item.store_credit_balance).toFixed(2)}`
                    : '—',
            icon: 'wallet',
        },
        { label: 'Location', value: item.address || item.location || '—', icon: 'map-pin' },
        { label: 'Phone', value: item.phone || '—', icon: 'phone' },
        { label: 'Email', value: item.email || '—', icon: 'mail' },
        { label: 'Notes', value: item.notes || '—', icon: 'sticky-note' },
    ];

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label="Customer Details">
                {canEdit ? (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('CustomerForm', { item })}
                        style={[styles.headerBtn, { backgroundColor: colors.surface }]}
                    >
                        <Lucide name="pencil" color={config.THEME_COLOR} size={18} />
                    </TouchableOpacity>
                ) : null}
            </ScreenHeader>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <View style={[styles.avatar, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                        {item.image ? (
                            <Image source={{ uri: item.image }} style={styles.avatarImage} />
                        ) : (
                            <AppText
                                label={customerInitials(item.name)}
                                variant={1}
                                fontSize={28}
                                color={config.THEME_COLOR}
                            />
                        )}
                    </View>
                    <AppText
                        label={item.name || 'Unnamed customer'}
                        variant={1}
                        fontSize={22}
                        color={colors.text}
                        style={{ textAlign: 'center' }}
                    />
                    <View style={[styles.sourcePill, { backgroundColor: source.bg, marginTop: 12 }]}>
                        <AppText label={source.short} fontSize={12} color={source.color} variant={1} />
                    </View>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <AppText label={statusLabel} fontSize={13} color={statusColor} />
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {details.map((row, index) => (
                        <View
                            key={row.label}
                            style={[
                                styles.detailRow,
                                index < details.length - 1 && {
                                    borderBottomWidth: StyleSheet.hairlineWidth,
                                    borderBottomColor: colors.border,
                                },
                            ]}
                        >
                            <View style={[styles.detailIcon, { backgroundColor: colors.surfaceSecondary || colors.background }]}>
                                <Lucide name={row.icon} size={16} color={colors.textTertiary} />
                            </View>
                            <View style={styles.detailText}>
                                <AppText label={row.label} fontSize={12} color={colors.textTertiary} />
                                <AppText
                                    label={row.value}
                                    fontSize={15}
                                    color={colors.text}
                                    style={{ marginTop: 3 }}
                                />
                            </View>
                        </View>
                    ))}

                    {item.phone ? (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleCall}
                            style={[styles.callBtn, { backgroundColor: `${config.THEME_COLOR}14` }]}
                        >
                            <Lucide name="phone" size={16} color={config.THEME_COLOR} />
                            <AppText
                                label="Call customer"
                                fontSize={14}
                                variant={1}
                                color={config.THEME_COLOR}
                                style={{ marginLeft: 8 }}
                            />
                        </TouchableOpacity>
                    ) : null}
                </View>

                {canEdit ? (
                    <>
                        <AppText label="Quick links" fontSize={11} variant={1} color={colors.textTertiary} style={styles.sectionLabel} />
                        <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() =>
                                navigation.navigate('CustomerSale', {
                                    customerId: item.id,
                                    customerName: item.name,
                                })
                            }
                            style={[styles.linkCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                            <View style={[styles.linkIcon, { backgroundColor: '#f59e0b18' }]}>
                                <Lucide name="shopping-bag" size={18} color="#f59e0b" />
                            </View>
                            <View style={styles.linkMain}>
                                <AppText label="Transactions" variant={1} fontSize={15} color={colors.text} />
                                <AppText label="Sales history for this customer" fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                            </View>
                            <Lucide name="chevron-right" size={18} color={colors.border} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() =>
                                navigation.navigate('CustomerPayments', {
                                    customerId: item.id,
                                    customerName: item.name,
                                })
                            }
                            style={[styles.linkCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                            <View style={[styles.linkIcon, { backgroundColor: '#16a34a18' }]}>
                                <Lucide name="credit-card" size={18} color="#16a34a" />
                            </View>
                            <View style={styles.linkMain}>
                                <AppText label="Payments & history" variant={1} fontSize={15} color={colors.text} />
                                <AppText label="Payment records and balances" fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                            </View>
                            <Lucide name="chevron-right" size={18} color={colors.border} />
                        </TouchableOpacity>
                    </>
                ) : (
                    <View
                        style={[
                            styles.notice,
                            {
                                backgroundColor: colors.surfaceSecondary || colors.surface,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <Lucide name="info" size={16} color={colors.textSecondary} />
                        <AppText
                            label="App customers place orders from their account. POS sales history applies to POS/admin customers."
                            fontSize={13}
                            color={colors.textSecondary}
                            style={{ flex: 1, marginLeft: 10, lineHeight: 19 }}
                        />
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerBtn: {
        height: 34,
        width: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scroll: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 36 },
    hero: { alignItems: 'center', marginBottom: 20 },
    avatar: {
        width: 84,
        height: 84,
        borderRadius: 42,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
        overflow: 'hidden',
    },
    avatarImage: { width: 84, height: 84, borderRadius: 42 },
    sourcePill: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 999,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    card: {
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 14,
        paddingTop: 4,
        paddingBottom: 14,
        marginBottom: 20,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 14,
    },
    detailIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    detailText: { flex: 1, minWidth: 0 },
    callBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
        paddingVertical: 12,
        borderRadius: 999,
    },
    sectionLabel: {
        marginBottom: 10,
        marginLeft: 4,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    linkCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        marginBottom: 10,
    },
    linkIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    linkMain: { flex: 1, minWidth: 0 },
    notice: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
    },
});

export default CustomerDetails;
