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
    const [showSearch, setShowSearch] = useState(false);

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

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Orders">
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                        setShowSearch((prev) => {
                            const next = !prev;
                            if (!next) setQuery('');
                            return next;
                        });
                    }}
                    style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                    <Lucide name={showSearch ? 'x' : 'search'} size={18} color={colors.text} />
                </TouchableOpacity>
                {canCreateOrder && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('CreateOrder')}
                        style={[styles.addBtn, { backgroundColor: config.THEME_COLOR }]}
                    >
                        <Lucide name="plus" size={18} color="#fff" />
                        <AppText label="New" color="#fff" fontSize={13} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                )}
            </ScreenHeader>

            {showSearch && (
                <View style={[styles.searchWrap, { paddingHorizontal: 12 }]}>
                    <View style={[styles.searchInputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Lucide name="search" size={16} color={colors.textSecondary} />
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Search by order no., store, customer..."
                            placeholderTextColor={colors.textTertiary}
                            style={[styles.searchInput, { color: colors.text }]}
                            autoCorrect={false}
                            autoCapitalize="none"
                            returnKeyType="search"
                        />
                        {!!query && (
                            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Lucide name="x" size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}

            <View style={{ paddingBottom: 8, marginTop: 10 }}>
                <View style={[styles.queueTabBar, { borderBottomColor: colors.border }]}>
                    <View style={[styles.queueTabRow, { paddingHorizontal: 12 }]}>
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
                                            size={16}
                                            color={active ? config.THEME_COLOR : colors.textSecondary}
                                        />
                                        <AppText
                                            label={tab.label}
                                            color={active ? config.THEME_COLOR : colors.textSecondary}
                                            fontSize={13}
                                            variant={active ? 1 : 0}
                                            style={{ marginLeft: 8 }}
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
                    contentContainerStyle={{ gap: 8, marginTop: 10, paddingHorizontal: 12 }}
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
            </View>

            {/* <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setStatusFilter('')}
                        style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                        <AppText label="Total" color={colors.textSecondary} fontSize={11} />
                        <AppText label={String(summary.total)} color={colors.text} variant={1} fontSize={13} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setStatusFilter('pending')}
                        style={[styles.summaryChip, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}
                    >
                        <AppText label="Pending" color="#9a3412" fontSize={11} />
                        <AppText label={String(summary.pending)} color="#9a3412" variant={1} fontSize={13} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setStatusFilter('ready')}
                        style={[styles.summaryChip, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}
                    >
                        <AppText label="Ready" color="#5b21b6" fontSize={11} />
                        <AppText label={String(summary.ready)} color="#5b21b6" variant={1} fontSize={13} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setQueueType('delivery')}
                        style={[styles.summaryChip, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                    >
                        <AppText label="Delivery" color="#1d4ed8" fontSize={11} />
                        <AppText label={String(summary.delivery)} color="#1d4ed8" variant={1} fontSize={13} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                </ScrollView>
            </View> */}

            {loading && !refreshing ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={config.THEME_COLOR} size="large" />
                </View>
            ) : (
                <FlashList
                    data={filteredList}
                    estimatedItemSize={108}
                    keyExtractor={(item) => String(item.id)}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyWrap}>
                            <Lucide name="shopping-basket" size={42} color={colors.border} />
                            <AppText
                                label={normalizedQuery ? 'No results found' : 'No orders yet'}
                                fontSize={16}
                                color={colors.textSecondary}
                                style={{ marginTop: 10 }}
                            />
                            <AppText
                                label={normalizedQuery ? 'Try a different search term.' : 'Orders will appear here once customers place them.'}
                                fontSize={12}
                                color={colors.textTertiary}
                                style={{ marginTop: 4, textAlign: 'center', maxWidth: 280 }}
                            />
                        </View>
                    )}
                    renderItem={({ item }) => {
                        const badge = statusColors(item.status);
                        const payBadge = paymentColors(item.payment_status);
                        return (
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => navigation.navigate('OrderDetails', { orderId: item.id })}
                                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            >
                                <View style={styles.topRow}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
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
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, marginRight: 10 },
    iconBtn: { width: 36, height: 36, borderRadius: 99, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyWrap: { alignItems: 'center', marginTop: 70, paddingHorizontal: 16 },
    card: { marginHorizontal: 12, marginBottom: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    metaRow: { flexDirection: 'row', alignItems: 'center' },
    badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    searchWrap: { paddingTop: 10 },
    searchInputWrap: {
        borderWidth: 1,
        borderRadius: 99,
        paddingHorizontal: 10,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
    pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
    queueTabBar: { borderBottomWidth: StyleSheet.hairlineWidth },
    queueTabRow: { flexDirection: 'row' },
    queueTab: { width: '33.33%', alignItems: 'center', paddingTop: 8, paddingBottom: 0 },
    queueTabContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 12 },
    queueTabUnderline: { height: 2, alignSelf: 'stretch', borderRadius: 0 },
    summaryChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1 },
});

export default Orders;
