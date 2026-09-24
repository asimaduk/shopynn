import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { orders } from '../../services/api';

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'active', label: 'In progress' },
    { id: 'completed', label: 'Done' },
];

const formatStatusLabel = (value) =>
    String(value || '')
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

const getStatusStyle = (value) => {
    const status = String(value || '').toLowerCase();
    if (status === 'completed' || status === 'delivered') return { bg: '#dcfce7', color: '#16a34a' };
    if (status === 'cancelled') return { bg: '#fee2e2', color: '#dc2626' };
    if (status === 'processing' || status === 'confirmed' || status === 'shipped') {
        return { bg: '#dbeafe', color: '#2563eb' };
    }
    if (status === 'ready') return { bg: '#ede9fe', color: '#7c3aed' };
    return { bg: '#fef3c7', color: '#d97706' };
};

const getPaymentStyle = (value) => {
    const status = String(value || '').toLowerCase();
    if (status === 'paid') return { bg: '#dcfce7', color: '#16a34a', label: 'Paid' };
    if (status === 'pending') return { bg: '#e0f2fe', color: '#0284c7', label: 'Payment pending' };
    if (status === 'failed') return { bg: '#fee2e2', color: '#dc2626', label: 'Payment failed' };
    if (status === 'installment_active') return { bg: '#ede9fe', color: '#7c3aed', label: 'Paying over time' };
    return { bg: '#f3f4f6', color: '#6b7280', label: 'Unpaid' };
};

const formatOrderWhen = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (sameDay) return `Today · ${time}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
        d.getFullYear() === yesterday.getFullYear() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getDate() === yesterday.getDate();
    if (isYesterday) return `Yesterday · ${time}`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatMoney = (n) =>
    `GHS ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MyOrders = ({ navigation }) => {
    const { colors } = useTheme();
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [orderDetailsById, setOrderDetailsById] = useState({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await orders.my();
            setList(Array.isArray(data) ? data : []);
            setOrderDetailsById({});
        } catch (_) {
            setList([]);
            setOrderDetailsById({});
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    useEffect(() => {
        const ids = (Array.isArray(list) ? list : []).map((item) => item?.id).filter(Boolean);
        const missingIds = ids.filter((id) => !orderDetailsById[id]);
        if (!missingIds.length) return undefined;

        let cancelled = false;
        const hydrate = async () => {
            const detailPairs = await Promise.all(
                missingIds.map(async (id) => {
                    try {
                        const detail = await orders.get(id);
                        return [id, detail];
                    } catch (_) {
                        return [id, null];
                    }
                }),
            );
            if (cancelled) return;
            setOrderDetailsById((prev) => {
                const next = { ...prev };
                detailPairs.forEach(([id, detail]) => {
                    next[id] = detail;
                });
                return next;
            });
        };

        hydrate();
        return () => {
            cancelled = true;
        };
    }, [list, orderDetailsById]);

    const filteredList = useMemo(() => {
        const q = searchText.trim().toLowerCase();
        return list.filter((item) => {
            const status = String(item?.status || '').toLowerCase();
            if (statusFilter === 'pending' && status !== 'pending') return false;
            if (statusFilter === 'confirmed' && status !== 'confirmed') return false;
            if (
                statusFilter === 'active' &&
                !['processing', 'ready', 'shipped', 'delivered'].includes(status)
            ) {
                return false;
            }
            if (statusFilter === 'completed' && !['completed', 'delivered'].includes(status)) {
                return false;
            }
            if (!q) return true;
            const orderNo = String(item?.order_number || '').toLowerCase();
            const mode = String(item?.fulfillment_type || '').toLowerCase();
            const pay = String(item?.payment_status || '').toLowerCase();
            return (
                orderNo.includes(q) ||
                status.includes(q) ||
                mode.includes(q) ||
                pay.includes(q)
            );
        });
    }, [list, searchText, statusFilter]);

    const getOrderProducts = (order) => {
        const rows = Array.isArray(order?.items)
            ? order.items
            : Array.isArray(order?.order_items)
              ? order.order_items
              : [];
        const deduped = new Map();
        rows.forEach((row) => {
            const key = String(row?.id || row?.product_id || row?.product_name);
            if (!deduped.has(key)) deduped.set(key, row);
        });
        return Array.from(deduped.values());
    };

    const resolveProductImage = (item) =>
        item?.thumbnail || item?.picture1 || item?.picture || '';

    const pendingCount = useMemo(
        () => list.filter((o) => String(o?.status || '').toLowerCase() === 'pending').length,
        [list],
    );

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader hideBack label="My Orders">
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                        const next = !showSearch;
                        setShowSearch(next);
                        if (!next) setSearchText('');
                    }}
                    style={[styles.searchIconBtn, { backgroundColor: colors.surfaceSecondary }]}
                >
                    <Lucide name={showSearch ? 'x' : 'search'} size={18} color={colors.text} />
                </TouchableOpacity>
            </ScreenHeader>

            <View style={styles.summaryRow}>
                <AppText
                    label={
                        list.length
                            ? `${list.length} order${list.length === 1 ? '' : 's'}${
                                  pendingCount ? ` · ${pendingCount} pending` : ''
                              }`
                            : 'Your store orders'
                    }
                    fontSize={13}
                    color={colors.textSecondary}
                />
            </View>

            {showSearch ? (
                <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                    <View
                        style={[
                            styles.searchWrap,
                            { borderColor: colors.border, backgroundColor: colors.surface },
                        ]}
                    >
                        <Lucide name="search" size={16} color={colors.textSecondary} />
                        <TextInput
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholder="Search order #, status, payment…"
                            placeholderTextColor={colors.placeholder}
                            style={[styles.searchInput, { color: colors.text }]}
                            autoFocus
                        />
                    </View>
                </View>
            ) : null}

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                style={{ flexGrow: 0, marginBottom: 4 }}
            >
                {FILTERS.map((f) => {
                    const active = statusFilter === f.id;
                    return (
                        <TouchableOpacity
                            key={f.id}
                            activeOpacity={0.85}
                            onPress={() => setStatusFilter(f.id)}
                            style={[
                                styles.filterChip,
                                {
                                    backgroundColor: active ? config.THEME_COLOR : colors.surface,
                                    borderColor: active ? config.THEME_COLOR : colors.border,
                                },
                            ]}
                        >
                            <AppText
                                label={f.label}
                                fontSize={12}
                                variant={active ? 1 : 0}
                                color={active ? '#fff' : colors.text}
                            />
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {loading && !refreshing ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={config.THEME_COLOR} />
                </View>
            ) : (
                <FlashList
                    data={filteredList}
                    estimatedItemSize={180}
                    keyExtractor={(item) => String(item.id)}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 96 }}
                    renderItem={({ item }) => {
                        const detail = item?.id ? orderDetailsById[item.id] : null;
                        const products = getOrderProducts(detail || item);
                        const statusStyle = getStatusStyle(item.status);
                        const payStyle = getPaymentStyle(item.payment_status);
                        const fulfillment = String(item.fulfillment_type || 'pickup').toLowerCase();
                        const productCount = products.length || Number(item.item_count || 0);

                        return (
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('MyOrderDetails', { orderId: item.id })
                                }
                                style={[
                                    styles.card,
                                    {
                                        backgroundColor: colors.surface,
                                        borderColor: colors.border,
                                    },
                                ]}
                                activeOpacity={0.88}
                            >
                                <View style={styles.cardTop}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
                                        <AppText
                                            label={item.order_number || 'Order'}
                                            variant={1}
                                            color={colors.text}
                                            fontSize={15}
                                            numberOfLines={1}
                                        />
                                        <AppText
                                            label={formatOrderWhen(item.created_at)}
                                            color={colors.textSecondary}
                                            fontSize={12}
                                            style={{ marginTop: 3 }}
                                        />
                                    </View>
                                    <View
                                        style={[
                                            styles.statusPill,
                                            { backgroundColor: statusStyle.bg },
                                        ]}
                                    >
                                        <AppText
                                            label={formatStatusLabel(item.status || 'pending')}
                                            fontSize={11}
                                            color={statusStyle.color}
                                            variant={1}
                                        />
                                    </View>
                                </View>

                                <View style={styles.metaRow}>
                                    <View
                                        style={[
                                            styles.metaChip,
                                            { backgroundColor: colors.surfaceSecondary },
                                        ]}
                                    >
                                        <Lucide
                                            name={fulfillment === 'delivery' ? 'bike' : 'store'}
                                            size={12}
                                            color={colors.textSecondary}
                                        />
                                        <AppText
                                            label={fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}
                                            fontSize={11}
                                            color={colors.textSecondary}
                                            style={{ marginLeft: 4 }}
                                        />
                                    </View>
                                    <View
                                        style={[
                                            styles.metaChip,
                                            { backgroundColor: payStyle.bg },
                                        ]}
                                    >
                                        <AppText
                                            label={payStyle.label}
                                            fontSize={11}
                                            color={payStyle.color}
                                            variant={1}
                                        />
                                    </View>
                                </View>

                                {products.length > 0 ? (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.productStrip}
                                    >
                                        {products.slice(0, 6).map((product, idx) => {
                                            const img = resolveProductImage(product);
                                            return (
                                                <View
                                                    key={String(
                                                        product?.product_id || product?.id || idx,
                                                    )}
                                                    style={styles.productPreview}
                                                >
                                                    <View
                                                        style={[
                                                            styles.productImageWrap,
                                                            {
                                                                backgroundColor: colors.surfaceSecondary,
                                                            },
                                                        ]}
                                                    >
                                                        {img ? (
                                                            <Image
                                                                source={{
                                                                    uri: `${config.BASE_API}/images?id=${img}`,
                                                                }}
                                                                style={styles.productImage}
                                                                resizeMode="cover"
                                                            />
                                                        ) : (
                                                            <Lucide
                                                                name="package"
                                                                size={16}
                                                                color={colors.textSecondary}
                                                            />
                                                        )}
                                                        <View style={styles.qtyBadge}>
                                                            <AppText
                                                                label={`×${Number(product?.quantity || 1)}`}
                                                                fontSize={9}
                                                                color="#fff"
                                                                variant={1}
                                                            />
                                                        </View>
                                                    </View>
                                                    <AppText
                                                        label={product?.product_name || 'Product'}
                                                        fontSize={11}
                                                        color={colors.textSecondary}
                                                        numberOfLines={1}
                                                        style={styles.productName}
                                                    />
                                                </View>
                                            );
                                        })}
                                        {products.length > 6 ? (
                                            <View style={styles.moreProducts}>
                                                <AppText
                                                    label={`+${products.length - 6}`}
                                                    fontSize={12}
                                                    color={colors.textSecondary}
                                                    variant={1}
                                                />
                                            </View>
                                        ) : null}
                                    </ScrollView>
                                ) : (
                                    <View style={styles.skeletonProducts}>
                                        <AppText
                                            label={
                                                productCount > 0
                                                    ? `${productCount} item${productCount === 1 ? '' : 's'}`
                                                    : 'Loading items…'
                                            }
                                            fontSize={12}
                                            color={colors.textSecondary}
                                        />
                                    </View>
                                )}

                                <View
                                    style={[
                                        styles.cardFooter,
                                        { borderTopColor: colors.border },
                                    ]}
                                >
                                    <View>
                                        <AppText
                                            label="Order total"
                                            color={colors.textSecondary}
                                            fontSize={11}
                                        />
                                        <AppText
                                            label={formatMoney(item.total_amount)}
                                            color={config.THEME_COLOR}
                                            variant={1}
                                            fontSize={16}
                                            style={{ marginTop: 2 }}
                                        />
                                    </View>
                                    <View
                                        style={[
                                            styles.viewBtn,
                                            { backgroundColor: `${config.THEME_COLOR}14` },
                                        ]}
                                    >
                                        <AppText
                                            label="View"
                                            color={config.THEME_COLOR}
                                            variant={1}
                                            fontSize={12}
                                        />
                                        <Lucide
                                            name="chevron-right"
                                            size={16}
                                            color={config.THEME_COLOR}
                                            style={{ marginLeft: 2 }}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={() => (
                        <View style={styles.empty}>
                            <View
                                style={[
                                    styles.emptyIcon,
                                    { backgroundColor: colors.surfaceSecondary },
                                ]}
                            >
                                <Lucide name="package-search" size={28} color={config.THEME_COLOR} />
                            </View>
                            <AppText
                                label={searchText || statusFilter !== 'all' ? 'No matching orders' : 'No orders yet'}
                                variant={1}
                                color={colors.text}
                                fontSize={16}
                                style={{ marginTop: 14 }}
                            />
                            <AppText
                                label={
                                    searchText || statusFilter !== 'all'
                                        ? 'Try another filter or search term.'
                                        : 'Orders you place from For You will show up here.'
                                }
                                color={colors.textSecondary}
                                fontSize={13}
                                style={{ marginTop: 6, textAlign: 'center', paddingHorizontal: 28 }}
                            />
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    summaryRow: { paddingHorizontal: 16, paddingBottom: 8 },
    searchIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    searchWrap: {
        height: 44,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontFamily: 'FiraSans-Regular' },
    filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
    filterChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    card: {
        borderRadius: 16,
        marginBottom: 12,
        paddingTop: 14,
        paddingHorizontal: 14,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    metaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 5,
    },
    productStrip: { paddingTop: 14, paddingBottom: 4 },
    productPreview: { marginRight: 10, width: 64, alignItems: 'center' },
    productImageWrap: {
        width: 56,
        height: 56,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    productImage: { width: '100%', height: '100%' },
    qtyBadge: {
        position: 'absolute',
        right: 3,
        bottom: 3,
        backgroundColor: 'rgba(0,0,0,0.62)',
        borderRadius: 6,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    productName: { marginTop: 6, textAlign: 'center', width: 64 },
    moreProducts: {
        width: 56,
        height: 56,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.04)',
        marginTop: 0,
    },
    skeletonProducts: { paddingVertical: 14 },
    cardFooter: {
        marginTop: 12,
        paddingTop: 12,
        paddingBottom: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    viewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 20 },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default MyOrders;
