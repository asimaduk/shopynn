import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import styles from './styles';
import { payments } from '../../services/api';

const STATUS_TABS = [
    { id: 'all', label: 'All' },
    { id: 'paid', label: 'Paid' },
    { id: 'pending', label: 'Pending' },
    { id: 'failed', label: 'Failed' },
];

const formatAmount = (amount) => `GHS ${Number(amount || 0).toFixed(2)}`;

const normalizeStatus = (raw) => String(raw || '').trim().toLowerCase();

const isPaidStatus = (status) => ['paid', 'success', 'completed'].includes(normalizeStatus(status));

const isPendingStatus = (status) => normalizeStatus(status) === 'pending';

const isFailedStatus = (status) => ['failed', 'cancelled', 'reversed', 'declined'].includes(normalizeStatus(status));

const statusBadgeStyle = (status) => {
    if (isPaidStatus(status)) return { bg: '#dcfce7', color: '#16a34a', label: 'Paid' };
    if (isFailedStatus(status)) return { bg: '#fee2e2', color: '#dc2626', label: 'Failed' };
    if (isPendingStatus(status)) return { bg: '#fef3c7', color: '#d97706', label: 'Pending' };
    const label = String(status || '—')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    return { bg: '#f3f4f6', color: '#6b7280', label: label || '—' };
};

const methodMeta = (raw) => {
    const v = normalizeStatus(raw);
    if (v.includes('mobile') || v.includes('momo')) {
        return { label: 'Mobile money', icon: 'smartphone', tint: '#7c3aed' };
    }
    if (v.includes('cash')) {
        return { label: 'Cash', icon: 'banknote', tint: '#16a34a' };
    }
    return { label: 'Card', icon: 'credit-card', tint: config.THEME_COLOR };
};

const formatPaymentDate = (raw) => {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString('en-GH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const OrderPayments = ({ navigation }) => {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rows, setRows] = useState([]);
    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');

    const load = useCallback(async () => {
        try {
            const data = await payments.list({ order_only: true });
            setRows(Array.isArray(data) ? data : []);
        } catch (_) {
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            load();
        }, [load]),
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const filtered = useMemo(() => {
        let result = [...rows];
        if (statusFilter === 'paid') {
            result = result.filter((r) => isPaidStatus(r?.status));
        } else if (statusFilter === 'pending') {
            result = result.filter((r) => isPendingStatus(r?.status));
        } else if (statusFilter === 'failed') {
            result = result.filter((r) => isFailedStatus(r?.status));
        }
        const q = search.trim().toLowerCase();
        if (!q) return result;
        return result.filter(
            (r) =>
                String(r?.order_number || '').toLowerCase().includes(q) ||
                String(r?.order_id || '').toLowerCase().includes(q) ||
                String(r?.transaction_ref || '').toLowerCase().includes(q) ||
                String(r?.status || '').toLowerCase().includes(q) ||
                String(r?.payment_method_type || '').toLowerCase().includes(q) ||
                String(r?.warehouse_name || '').toLowerCase().includes(q),
        );
    }, [rows, search, statusFilter]);

    const summary = useMemo(() => {
        const paid = rows.filter((r) => isPaidStatus(r?.status)).length;
        const pending = rows.filter((r) => isPendingStatus(r?.status)).length;
        const totalAmount = rows.reduce((sum, r) => sum + Number(r?.amount || 0), 0);
        return { count: rows.length, paid, pending, totalAmount };
    }, [rows]);

    const renderPaymentItem = ({ item }) => {
        const badge = statusBadgeStyle(item?.status);
        const method = methodMeta(item?.payment_method_type);
        const orderLabel = item?.order_number || item?.order_id || 'Order';

        return (
            <TouchableOpacity
                activeOpacity={0.85}
                style={[localStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => item?.id && navigation.navigate('OrderPaymentDetails', { paymentId: item.id })}
            >
                <View style={[localStyles.methodIcon, { backgroundColor: `${method.tint}18` }]}>
                    <Lucide name={method.icon} size={20} color={method.tint} />
                </View>
                <View style={localStyles.cardBody}>
                    <View style={localStyles.cardTop}>
                        <AppText label={orderLabel} variant={1} fontSize={15} color={colors.text} numberOfLines={1} style={{ flex: 1 }} />
                        <View style={[localStyles.statusBadge, { backgroundColor: badge.bg }]}>
                            <AppText label={badge.label} fontSize={10} color={badge.color} fontFamily="FiraSans-SemiBold" />
                        </View>
                    </View>
                    <AppText label={formatAmount(item?.amount)} variant={1} fontSize={16} color={colors.text} style={{ marginTop: 6 }} />
                    <View style={localStyles.metaRow}>
                        <Lucide name={method.icon} size={12} color={colors.textTertiary} />
                        <AppText label={method.label} fontSize={12} color={colors.textSecondary} style={{ marginLeft: 4 }} />
                    </View>
                    {item?.warehouse_name ? (
                        <View style={[localStyles.metaRow, { marginTop: 2 }]}>
                            <Lucide name="store" size={12} color={colors.textTertiary} />
                            <AppText
                                label={item.warehouse_name}
                                fontSize={12}
                                color={colors.textSecondary}
                                numberOfLines={1}
                                style={{ marginLeft: 4, flex: 1 }}
                            />
                        </View>
                    ) : null}
                    <View style={[localStyles.metaRow, { marginTop: 2 }]}>
                        <Lucide name="hash" size={12} color={colors.textTertiary} />
                        <AppText
                            label={item?.transaction_ref || 'No reference'}
                            fontSize={11}
                            color={colors.textTertiary}
                            numberOfLines={1}
                            style={{ marginLeft: 4, flex: 1 }}
                        />
                    </View>
                    <View style={[localStyles.metaRow, { marginTop: 2 }]}>
                        <Lucide name="clock" size={12} color={colors.textTertiary} />
                        <AppText label={formatPaymentDate(item?.created_at)} fontSize={11} color={colors.textTertiary} style={{ marginLeft: 4 }} />
                    </View>
                </View>
                <Lucide name="chevron-right" size={18} color={colors.textTertiary} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Order Payments">
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => navigation.navigate('OrderSettlements')}
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                        <Lucide name="landmark" color={config.THEME_COLOR} size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => {
                            setShowSearch((prev) => {
                                const next = !prev;
                                if (!next) setSearch('');
                                return next;
                            });
                        }}
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                        <Lucide name={showSearch ? 'x' : 'search'} color={colors.text} size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={onRefresh}
                        disabled={refreshing}
                        style={[styles.actionButton, { backgroundColor: colors.surface }, refreshing && { opacity: 0.5 }]}>
                        {refreshing ? (
                            <ActivityIndicator size="small" color={config.THEME_COLOR} />
                        ) : (
                            <Lucide name="refresh-cw" color={config.THEME_COLOR} size={20} />
                        )}
                    </TouchableOpacity>
                </View>
            </ScreenHeader>

            <View style={localStyles.summaryRow}>
                <View style={[localStyles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[localStyles.statIcon, { backgroundColor: colors.primaryShade }]}>
                        <Lucide name="receipt" size={16} color={config.THEME_COLOR} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <AppText label="Records" fontSize={11} color={colors.textTertiary} />
                        <AppText label={String(summary.count)} variant={1} fontSize={17} color={colors.text} style={{ marginTop: 2 }} />
                    </View>
                </View>
                <View style={[localStyles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[localStyles.statIcon, { backgroundColor: '#dcfce7' }]}>
                        <Lucide name="circle-check" size={16} color="#16a34a" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <AppText label="Paid" fontSize={11} color={colors.textTertiary} />
                        <AppText label={String(summary.paid)} variant={1} fontSize={17} color="#16a34a" style={{ marginTop: 2 }} />
                    </View>
                </View>
            </View>

            <View style={[localStyles.summaryRow, { marginTop: 0 }]}>
                <View style={[localStyles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[localStyles.statIcon, { backgroundColor: '#fef3c7' }]}>
                        <Lucide name="clock" size={16} color="#d97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <AppText label="Pending" fontSize={11} color={colors.textTertiary} />
                        <AppText label={String(summary.pending)} variant={1} fontSize={17} color="#d97706" style={{ marginTop: 2 }} />
                    </View>
                </View>
                <View style={[localStyles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[localStyles.statIcon, { backgroundColor: colors.primaryShade }]}>
                        <Lucide name="wallet" size={16} color={config.THEME_COLOR} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <AppText label="Total" fontSize={11} color={colors.textTertiary} />
                        <AppText label={formatAmount(summary.totalAmount)} variant={1} fontSize={14} color={colors.text} style={{ marginTop: 2 }} numberOfLines={1} />
                    </View>
                </View>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={localStyles.statusTabs}
                style={{ flexGrow: 0, marginBottom: 4 }}>
                {STATUS_TABS.map((tab) => {
                    const active = statusFilter === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            activeOpacity={0.85}
                            onPress={() => setStatusFilter(tab.id)}
                            style={[
                                localStyles.statusPill,
                                {
                                    backgroundColor: active ? config.THEME_COLOR : colors.surface,
                                    borderColor: active ? config.THEME_COLOR : colors.border,
                                },
                            ]}>
                            <AppText label={tab.label} fontSize={12} color={active ? '#fff' : colors.text} variant={active ? 1 : 0} />
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {showSearch ? (
                <View style={[styles.searchContainer, { backgroundColor: colors.surface, marginTop: 8 }]}>
                    <Lucide name="search" color={colors.textTertiary} size={18} />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Order no., reference, store..."
                        placeholderTextColor={colors.placeholder}
                        style={[styles.searchInput, { color: colors.text }]}
                        autoCorrect={false}
                        autoCapitalize="none"
                        returnKeyType="search"
                    />
                    {search.length > 0 ? (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Lucide name="x" color={colors.textTertiary} size={18} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}

            {loading && !refreshing ? (
                <View style={localStyles.center}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading payments..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
                </View>
            ) : (
                <FlashList
                    data={filtered}
                    estimatedItemSize={120}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[config.THEME_COLOR]} tintColor={config.THEME_COLOR} />
                    }
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderPaymentItem}
                    ListHeaderComponent={
                        filtered.length > 0 ? (
                            <View style={[localStyles.listHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <Lucide name="banknote" size={18} color={config.THEME_COLOR} />
                                <AppText
                                    label={`${filtered.length} payment${filtered.length === 1 ? '' : 's'}`}
                                    fontSize={14}
                                    variant={1}
                                    color={colors.text}
                                    style={{ marginLeft: 8 }}
                                />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={localStyles.empty}>
                            <View style={[localStyles.emptyIcon, { backgroundColor: colors.primaryShade }]}>
                                <Lucide name="banknote" size={40} color={config.THEME_COLOR} />
                            </View>
                            <AppText
                                label={search || statusFilter !== 'all' ? 'No payments match your filters' : 'No order payments yet'}
                                variant={1}
                                fontSize={16}
                                color={colors.textSecondary}
                                style={{ marginTop: 14 }}
                            />
                            <AppText
                                label={
                                    search || statusFilter !== 'all'
                                        ? 'Try another status or search term.'
                                        : 'Payments from customer orders will appear here.'
                                }
                                fontSize={13}
                                color={colors.textTertiary}
                                style={{ marginTop: 6, textAlign: 'center', paddingHorizontal: 24 }}
                            />
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const localStyles = StyleSheet.create({
    summaryRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        marginTop: 10,
        marginBottom: 8,
        gap: 8,
    },
    statCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 10,
    },
    statIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusTabs: {
        paddingHorizontal: 12,
        gap: 8,
        paddingVertical: 4,
    },
    statusPill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 10,
        marginBottom: 10,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginHorizontal: 10,
        marginBottom: 10,
    },
    methodIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    cardBody: {
        flex: 1,
        minWidth: 0,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 48,
        paddingHorizontal: 20,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default OrderPayments;
