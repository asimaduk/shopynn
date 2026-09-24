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

const PosSalePayments = ({ navigation }) => {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rows, setRows] = useState([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const load = useCallback(async () => {
        try {
            const data = await payments.posSale({});
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
            result = result.filter(
                (r) =>
                    isPendingStatus(r?.status) ||
                    ['otp', 'ongoing', 'send_otp'].includes(normalizeStatus(r?.status)),
            );
        } else if (statusFilter === 'failed') {
            result = result.filter((r) => isFailedStatus(r?.status) || normalizeStatus(r?.status) === 'abandoned');
        }
        const q = search.trim().toLowerCase();
        if (!q) return result;
        return result.filter(
            (r) =>
                String(r?.sale_invoice_number || '').toLowerCase().includes(q) ||
                String(r?.sale_id || '').toLowerCase().includes(q) ||
                String(r?.transaction_ref || '').toLowerCase().includes(q) ||
                String(r?.status || '').toLowerCase().includes(q) ||
                String(r?.sale_customer_name || '').toLowerCase().includes(q) ||
                String(r?.warehouse_name || '').toLowerCase().includes(q),
        );
    }, [rows, search, statusFilter]);

    const summary = useMemo(() => {
        const paid = rows.filter((r) => isPaidStatus(r?.status)).length;
        const pending = rows.filter(
            (r) =>
                isPendingStatus(r?.status) ||
                ['otp', 'ongoing', 'send_otp'].includes(normalizeStatus(r?.status)),
        ).length;
        const totalAmount = rows.reduce((sum, r) => sum + Number(r?.face_amount ?? r?.amount ?? 0), 0);
        return { count: rows.length, paid, pending, totalAmount };
    }, [rows]);

    const filtering = search.trim().length > 0 || statusFilter !== 'all';

    const renderPaymentItem = ({ item }) => {
        const badge = statusBadgeStyle(item?.status);
        const method = methodMeta(item?.payment_method_type || 'mobile_money');
        const saleLabel = item?.sale_invoice_number || item?.sale_id || 'Unlinked';
        const amount = Number(item?.face_amount ?? item?.amount ?? 0);

        return (
            <TouchableOpacity
                activeOpacity={0.75}
                style={[localStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => item?.id && navigation.navigate('OrderPaymentDetails', { paymentId: item.id })}
            >
                <View style={[localStyles.methodIcon, { backgroundColor: `${method.tint}18` }]}>
                    <Lucide name={method.icon} size={18} color={method.tint} />
                </View>
                <View style={localStyles.cardBody}>
                    <View style={localStyles.cardTop}>
                        <AppText label={saleLabel} variant={1} fontSize={15} color={colors.text} numberOfLines={1} style={{ flex: 1 }} />
                        <View style={[localStyles.statusBadge, { backgroundColor: badge.bg }]}>
                            <AppText label={badge.label} fontSize={10} color={badge.color} fontFamily="FiraSans-SemiBold" />
                        </View>
                    </View>
                    <AppText label={formatAmount(amount)} variant={1} fontSize={16} color={colors.text} style={{ marginTop: 6 }} />
                    {item?.sale_customer_name ? (
                        <View style={localStyles.metaRow}>
                            <Lucide name="user" size={12} color={colors.textTertiary} />
                            <AppText label={item.sale_customer_name} fontSize={12} color={colors.textSecondary} style={{ marginLeft: 4 }} />
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
            <ScreenHeader onPress={() => navigation.goBack()} label="POS MoMo payments">
                <View style={localStyles.headerActions}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('PendingMomoPayments')}
                        style={[localStyles.headerBtn, { backgroundColor: colors.surface }]}
                    >
                        <Lucide name="smartphone" color={config.THEME_COLOR} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={onRefresh}
                        disabled={refreshing}
                        style={[
                            localStyles.headerBtn,
                            { backgroundColor: colors.surface },
                            refreshing && { opacity: 0.5 },
                        ]}
                    >
                        {refreshing ? (
                            <ActivityIndicator size="small" color={config.THEME_COLOR} />
                        ) : (
                            <Lucide name="refresh-cw" color={config.THEME_COLOR} size={18} />
                        )}
                    </TouchableOpacity>
                </View>
            </ScreenHeader>

            <View style={localStyles.summaryRow}>
                <View style={[localStyles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="receipt" size={14} color={config.THEME_COLOR} />
                    <AppText
                        label={`${summary.count} record${summary.count === 1 ? '' : 's'}`}
                        fontSize={13}
                        variant={1}
                        color={colors.text}
                        style={{ marginLeft: 6 }}
                    />
                </View>
                <View style={[localStyles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[localStyles.statusDot, { backgroundColor: '#16a34a' }]} />
                    <AppText
                        label={`${summary.paid} paid`}
                        fontSize={13}
                        variant={1}
                        color={colors.text}
                        style={{ marginLeft: 6 }}
                    />
                </View>
                <View style={[localStyles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[localStyles.statusDot, { backgroundColor: '#d97706' }]} />
                    <AppText
                        label={`${summary.pending} pending`}
                        fontSize={13}
                        variant={1}
                        color={colors.text}
                        style={{ marginLeft: 6 }}
                    />
                </View>
                <View style={[localStyles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="wallet" size={14} color={config.THEME_COLOR} />
                    <AppText
                        label={formatAmount(summary.totalAmount)}
                        fontSize={13}
                        variant={1}
                        color={colors.text}
                        style={{ marginLeft: 6 }}
                    />
                </View>
            </View>

            <View style={[localStyles.searchWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Lucide name="search" size={16} color={colors.textTertiary} />
                <TextInput
                    style={[localStyles.searchInput, { color: colors.text }]}
                    placeholder="Invoice, reference, customer..."
                    placeholderTextColor={colors.placeholder}
                    value={search}
                    onChangeText={setSearch}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                />
                {search.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Lucide name="x" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                ) : null}
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={localStyles.statusTabs}
                style={localStyles.statusScroll}
            >
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
                            ]}
                        >
                            <AppText label={tab.label} fontSize={12} color={active ? '#fff' : colors.text} variant={active ? 1 : 0} />
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {loading && !refreshing ? (
                <View style={localStyles.center}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading payments..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
                </View>
            ) : (
                <View style={localStyles.listWrap}>
                    <FlashList
                        style={localStyles.list}
                        data={filtered}
                        estimatedItemSize={120}
                        contentContainerStyle={localStyles.listContent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                colors={[config.THEME_COLOR]}
                                tintColor={config.THEME_COLOR}
                            />
                        }
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderPaymentItem}
                        ListEmptyComponent={
                            <View style={localStyles.emptyWrap}>
                                <View style={[localStyles.emptyIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="banknote" size={28} color={colors.textTertiary} />
                                </View>
                                <AppText
                                    label={filtering ? 'No payments match' : 'No POS MoMo payments yet'}
                                    variant={1}
                                    fontSize={16}
                                    color={colors.text}
                                    style={{ marginTop: 12 }}
                                />
                                <AppText
                                    label={
                                        filtering
                                            ? 'Try another status or search term'
                                            : 'MoMo charges from counter sales will appear here'
                                    }
                                    fontSize={13}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 4, textAlign: 'center' }}
                                />
                            </View>
                        }
                    />
                </View>
            )}
        </SafeAreaView>
    );
};

const localStyles = StyleSheet.create({
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
    headerBtn: {
        height: 34,
        width: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginHorizontal: 15,
        marginTop: 10,
        marginBottom: 10,
    },
    summaryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 15,
        marginBottom: 10,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        height: 46,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontFamily: 'FiraSans-Regular',
        fontSize: 14,
    },
    statusScroll: { flexGrow: 0, marginBottom: 8 },
    statusTabs: {
        paddingHorizontal: 15,
        gap: 8,
        paddingVertical: 2,
    },
    statusPill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    listWrap: { flex: 1, minHeight: 0 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 15, paddingBottom: 28 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
    },
    methodIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
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
    emptyWrap: {
        paddingTop: 48,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    emptyIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default PosSalePayments;
