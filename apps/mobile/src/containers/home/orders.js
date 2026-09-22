import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { storeOrders } from '../../services/api';
import { hasFeature, hasPermission } from '../../utils/permissions';
import { useSelector } from 'react-redux';

const Orders = ({ navigation }) => {
    const { colors } = useTheme();
    const user = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [queueType, setQueueType] = useState('all');
    const [selectedWarehouse] = useState('');
    const [query, setQuery] = useState('');

    const canCreateOrder =
        hasPermission(user, 'orders.create') &&
        hasFeature(user, 'orders.create', subscriptionFeatures);

    const loadOrders = useCallback(async () => {
        setLoading(true);
        try {
            const data = await storeOrders.list({
                status: statusFilter || undefined,
                fulfillment_type:
                    queueType === 'all' ? undefined : String(queueType).trim().toLowerCase(),
                warehouse_id: selectedWarehouse || undefined,
            });
            setList(Array.isArray(data) ? data : []);
        } catch (_) {
            setList([]);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, selectedWarehouse, queueType]);

    useFocusEffect(
        useCallback(() => {
            loadOrders();
        }, [loadOrders]),
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadOrders();
        setRefreshing(false);
    };

    const statusColors = (status) => {
        const value = String(status || '').toLowerCase();
        if (value === 'completed') return { bg: '#dcfce7', color: '#16a34a' };
        if (value === 'cancelled') return { bg: '#fee2e2', color: '#dc2626' };
        if (value === 'processing') return { bg: '#dbeafe', color: '#2563eb' };
        if (value === 'ready') return { bg: '#ede9fe', color: '#7c3aed' };
        return { bg: '#fef3c7', color: '#d97706' };
    };

    const paymentColors = (payment) => {
        const value = String(payment || '').toLowerCase();
        if (value === 'paid') return { bg: '#dcfce7', color: '#16a34a' };
        if (value === 'failed') return { bg: '#fee2e2', color: '#dc2626' };
        if (value === 'pending') return { bg: '#fef3c7', color: '#d97706' };
        return { bg: '#f3f4f6', color: '#6b7280' };
    };

    const formatStatusLabel = (value) =>
        String(value || '')
            .toLowerCase()
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

    const normalizedQuery = String(query || '').trim().toLowerCase();
    const filteredList = normalizedQuery
        ? list.filter((o) => {
              const hay = `${o?.order_number || ''} ${o?.warehouse_name || ''} ${o?.customer_name || ''}`.toLowerCase();
              return hay.includes(normalizedQuery);
          })
        : list;

    const queueTabs = [
        { id: 'all', label: 'All', icon: 'clipboard-list' },
        { id: 'delivery', label: 'For Delivery', icon: 'truck' },
        { id: 'pickup', label: 'For Pickup', icon: 'shopping-cart' },
    ];
    const statusTabs = ['', 'pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'completed', 'cancelled'];

    const summary = filteredList.reduce(
        (acc, o) => {
            const s = String(o?.status || '').toLowerCase();
            const f = String(o?.fulfillment_type || '').toLowerCase();
            acc.total += 1;
            if (s === 'pending') acc.pending += 1;
            if (s === 'ready') acc.ready += 1;
            if (f === 'delivery') acc.delivery += 1;
            return acc;
        },
        { total: 0, pending: 0, ready: 0, delivery: 0 }
    );

    const filtering = normalizedQuery.length > 0 || !!statusFilter || queueType !== 'all';

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Orders">
                {canCreateOrder ? (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('CreateOrder')}
                        style={[styles.headerBtn, { backgroundColor: colors.surface }]}
                    >
                        <Lucide name="plus" color={config.THEME_COLOR} size={18} />
                    </TouchableOpacity>
                ) : null}
            </ScreenHeader>

            <View style={styles.summaryRow}>
                <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="clipboard-list" size={14} color={config.THEME_COLOR} />
                    <AppText
                        label={`${summary.total} order${summary.total === 1 ? '' : 's'}`}
                        fontSize={13}
                        variant={1}
                        color={colors.text}
                        style={{ marginLeft: 6 }}
                    />
                </View>
                <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.statusDot, { backgroundColor: '#d97706' }]} />
                    <AppText
                        label={`${summary.pending} pending`}
                        fontSize={13}
                        variant={1}
                        color={colors.text}
                        style={{ marginLeft: 6 }}
                    />
                </View>
            </View>

            <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Lucide name="search" size={16} color={colors.textTertiary} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search order no., store, customer..."
                    placeholderTextColor={colors.placeholder}
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                />
                {query.length > 0 ? (
                    <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Lucide name="x" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={[styles.queueTabBar, { borderBottomColor: colors.border }]}>
                <View style={styles.queueTabRow}>
                    {queueTabs.map((tab) => {
                        const active = queueType === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setQueueType(tab.id)}
                                activeOpacity={0.7}
                                style={styles.queueTab}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: active }}
                            >
                                <View style={styles.queueTabContent}>
                                    <Lucide
                                        name={tab.icon}
                                        size={15}
                                        color={active ? config.THEME_COLOR : colors.textSecondary}
                                    />
                                    <AppText
                                        label={tab.label}
                                        color={active ? config.THEME_COLOR : colors.textSecondary}
                                        fontSize={12}
                                        variant={active ? 1 : 0}
                                        style={{ marginLeft: 6 }}
                                    />
                                </View>
                                <View
                                    style={[
                                        styles.queueTabUnderline,
                                        { backgroundColor: active ? config.THEME_COLOR : 'transparent' },
                                    ]}
                                />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.statusScroll}
                contentContainerStyle={styles.statusTabs}
            >
                {statusTabs.map((status) => {
                    const active = statusFilter === status;
                    return (
                        <TouchableOpacity
                            key={status || 'all'}
                            onPress={() => setStatusFilter(status)}
                            activeOpacity={0.85}
                            style={[
                                styles.pill,
                                {
                                    backgroundColor: active ? config.THEME_COLOR : colors.surface,
                                    borderColor: active ? config.THEME_COLOR : colors.border,
                                },
                            ]}
                        >
                            <AppText
                                label={status ? formatStatusLabel(status) : 'All status'}
                                color={active ? '#fff' : colors.text}
                                fontSize={12}
                                variant={active ? 1 : 0}
                            />
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {loading && !refreshing ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={config.THEME_COLOR} size="large" />
                    <AppText label="Loading orders..." color={colors.textTertiary} style={{ marginTop: 10 }} />
                </View>
            ) : (
                <View style={styles.listWrap}>
                    <FlashList
                        style={styles.list}
                        contentContainerStyle={styles.listContent}
                        data={filteredList}
                        estimatedItemSize={108}
                        keyExtractor={(item) => String(item.id)}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyWrap}>
                                <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="shopping-basket" size={28} color={colors.textTertiary} />
                                </View>
                                <AppText
                                    label={filtering ? 'No orders match' : 'No orders yet'}
                                    variant={1}
                                    fontSize={16}
                                    color={colors.text}
                                    style={{ marginTop: 12 }}
                                />
                                <AppText
                                    label={
                                        filtering
                                            ? 'Try another search or filter'
                                            : 'Orders will appear here once customers place them'
                                    }
                                    fontSize={13}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 4, textAlign: 'center' }}
                                />
                                {!filtering && canCreateOrder ? (
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={() => navigation.navigate('CreateOrder')}
                                        style={[styles.emptyCta, { backgroundColor: config.THEME_COLOR }]}
                                    >
                                        <Lucide name="plus" size={16} color="#fff" />
                                        <AppText
                                            label="Create order"
                                            color="#fff"
                                            variant={1}
                                            fontSize={14}
                                            style={{ marginLeft: 6 }}
                                        />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        )}
                        renderItem={({ item }) => {
                            const badge = statusColors(item.status);
                            const payBadge = paymentColors(item.payment_status);
                            return (
                                <TouchableOpacity
                                    activeOpacity={0.75}
                                    onPress={() => navigation.navigate('OrderDetails', { orderId: item.id })}
                                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                >
                                    <View style={styles.topRow}>
                                        <View style={{ flex: 1, paddingRight: 10, minWidth: 0 }}>
                                            <AppText label={item.order_number || 'Order'} variant={1} fontSize={15} color={colors.text} />
                                            {!!String(item?.customer_name || '').trim() && (
                                                <View style={[styles.metaRow, { marginTop: 4 }]}>
                                                    <Lucide name="user" size={13} color={colors.textSecondary} />
                                                    <AppText
                                                        label={String(item.customer_name).trim()}
                                                        fontSize={12}
                                                        color={colors.textSecondary}
                                                        style={{ marginLeft: 6 }}
                                                        numberOfLines={1}
                                                    />
                                                </View>
                                            )}
                                            <View style={[styles.metaRow, { marginTop: 4 }]}>
                                                <Lucide name="store" size={13} color={colors.textSecondary} />
                                                <AppText
                                                    label={item.warehouse_name || 'Store'}
                                                    fontSize={12}
                                                    color={colors.textSecondary}
                                                    style={{ marginLeft: 6 }}
                                                    numberOfLines={1}
                                                />
                                            </View>
                                        </View>

                                        <View style={{ alignItems: 'flex-end' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                <View style={[styles.badge, { backgroundColor: payBadge.bg }]}>
                                                    <AppText label={formatStatusLabel(item.payment_status || 'unpaid')} fontSize={10} color={payBadge.color} />
                                                </View>
                                                <View style={[styles.badge, { backgroundColor: badge.bg, marginLeft: 6 }]}>
                                                    <AppText label={formatStatusLabel(item.status || 'pending')} fontSize={10} color={badge.color} />
                                                </View>
                                            </View>
                                            <View style={[styles.metaRow, { marginTop: 8, justifyContent: 'flex-end' }]}>
                                                <Lucide name="wallet" size={13} color={config.THEME_COLOR} />
                                                <AppText
                                                    label={`GHS ${Number(item.total_amount || 0).toFixed(2)}`}
                                                    fontSize={13}
                                                    color={config.THEME_COLOR}
                                                    style={{ marginLeft: 6 }}
                                                    variant={1}
                                                />
                                            </View>
                                        </View>
                                    </View>

                                    <View style={[styles.bottomRow, { marginTop: 10, borderTopColor: colors.border }]}>
                                        <View style={styles.metaRow}>
                                            <Lucide name="truck" size={12} color={colors.textTertiary} />
                                            <AppText
                                                label={String(item.fulfillment_type || 'pickup').replace(/^./, (c) => c.toUpperCase())}
                                                fontSize={11}
                                                color={colors.textTertiary}
                                                style={{ marginLeft: 6 }}
                                            />
                                        </View>
                                        <View style={styles.metaRow}>
                                            <Lucide name="calendar-days" size={12} color={colors.textTertiary} />
                                            <AppText
                                                label={
                                                    item?.created_at
                                                        ? `${new Date(item.created_at).toLocaleDateString()} • ${new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                        : '—'
                                                }
                                                fontSize={11}
                                                color={colors.textTertiary}
                                                style={{ marginLeft: 6 }}
                                            />
                                        </View>
                                        <Lucide name="chevron-right" size={16} color={colors.textTertiary} />
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                    />
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    headerBtn: {
        height: 34,
        width: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
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
    queueTabBar: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        marginHorizontal: 15,
    },
    queueTabRow: { flexDirection: 'row' },
    queueTab: { width: '33.33%', alignItems: 'center', paddingTop: 4, paddingBottom: 0 },
    queueTabContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 10,
    },
    queueTabUnderline: { height: 2, alignSelf: 'stretch', borderRadius: 0 },
    statusScroll: { flexGrow: 0, marginTop: 10, marginBottom: 8 },
    statusTabs: { gap: 8, paddingHorizontal: 15 },
    pill: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    listWrap: { flex: 1, minHeight: 0 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 15, paddingBottom: 28 },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
    emptyCta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 18,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
    },
    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        marginBottom: 10,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center' },
    badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
});

export default Orders;
