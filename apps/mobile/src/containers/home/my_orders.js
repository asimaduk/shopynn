import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { orders } from '../../services/api';

const MyOrders = ({ navigation }) => {
    const { colors } = useTheme();
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchText, setSearchText] = useState('');
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
        }, [load])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    useEffect(() => {
        const ids = (Array.isArray(list) ? list : [])
            .map((item) => item?.id)
            .filter(Boolean);
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
                })
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
        if (!q) return list;
        return list.filter((item) => {
            const orderNo = String(item?.order_number || '').toLowerCase();
            const status = String(item?.status || '').toLowerCase();
            const mode = String(item?.fulfillment_type || '').toLowerCase();
            return orderNo.includes(q) || status.includes(q) || mode.includes(q);
        });
    }, [list, searchText]);

    const getStatusStyle = (value) => {
        const status = String(value || '').toLowerCase();
        if (status === 'completed' || status === 'delivered') return { bg: '#dcfce7', color: '#16a34a' };
        if (status === 'cancelled') return { bg: '#fee2e2', color: '#dc2626' };
        if (status === 'processing' || status === 'confirmed' || status === 'shipped') return { bg: '#dbeafe', color: '#2563eb' };
        if (status === 'ready') return { bg: '#ede9fe', color: '#7c3aed' };
        return { bg: '#fef3c7', color: '#d97706' };
    };

    const formatStatusLabel = (value) =>
        String(value || '')
            .toLowerCase()
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

    const getOrderProducts = (order) => {
        const rows = Array.isArray(order?.items)
            ? order.items
            : (Array.isArray(order?.order_items) ? order.order_items : []);
        const deduped = new Map();
        rows.forEach((row) => {
            const key = String(row?.id || row?.product_id || row?.product_name);
            if (!deduped.has(key)) deduped.set(key, row);
        });
        return Array.from(deduped.values());
    };

    const resolveProductImage = (item) => {
        return item?.thumbnail || item?.picture1 || item?.picture || '';
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="My Orders">
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
            {showSearch && (
                <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
                    <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <Lucide name="search" size={16} color={colors.textSecondary} />
                        <TextInput
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholder="Search by order number, status, or mode"
                            placeholderTextColor={colors.placeholder}
                            style={[styles.searchInput, { color: colors.text }]}
                            autoFocus
                        />
                    </View>
                </View>
            )}
            {loading && !refreshing ? (
                <View style={styles.loader}><ActivityIndicator color={config.THEME_COLOR} /></View>
            ) : (
                <FlashList
                    data={filteredList}
                    estimatedItemSize={118}
                    keyExtractor={(item) => String(item.id)}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
                    renderItem={({ item }) => {
                        const detail = item?.id ? orderDetailsById[item.id] : null;
                        const products = getOrderProducts(detail || item);
                        const statusStyle = getStatusStyle(item.status);
                        return (
                            <TouchableOpacity
                                onPress={() => navigation.navigate('MyOrderDetails', { orderId: item.id })}
                                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                activeOpacity={0.85}
                            >
                                <View style={styles.rowBetween}>
                                    <AppText label={item.order_number || 'Order'} variant={1} color={colors.text} fontSize={14} />
                                    {!!item.created_at && (
                                        <AppText
                                            label={new Date(item.created_at).toLocaleString()}
                                            color={colors.textTertiary || colors.textSecondary}
                                            fontSize={14}
                                            style={{ textAlign: 'right' }}
                                        />
                                    )}
                                </View>

                                <View style={[styles.separator, { backgroundColor: colors.borderLight || colors.border }]} />

                                <View style={styles.rowBetween}>
                                    <AppText
                                        label={`${products.length} ${products.length === 1 ? 'Product' : 'Products'}`}
                                        color={colors.textSecondary}
                                        variant={1}
                                        fontSize={13}
                                    />
                                    <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                                        <AppText
                                            label={formatStatusLabel(item.status || 'pending')}
                                            fontSize={10}
                                            color={statusStyle.color}
                                            variant={1}
                                        />
                                    </View>
                                </View>

                                {products.length > 0 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productStrip}>
                                        {products.map((product, idx) => (
                                            <View key={String(product?.product_id || product?.id || idx)} style={styles.productPreview}>
                                                <View style={[styles.productImageWrap, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                                    {resolveProductImage(product) ? (
                                                        <Image source={{ uri: config.BASE_API + '/images?id=' + resolveProductImage(product) }} style={styles.productImage} resizeMode="cover" />
                                                    ) : (
                                                        <Lucide name="image" size={16} color={colors.textSecondary} />
                                                    )}
                                                </View>
                                                <AppText
                                                    label={`${Number(product?.quantity)} x ${product?.product_name || 'Product'}`}
                                                    fontSize={11}
                                                    color={colors.textSecondary}
                                                    numberOfLines={1}
                                                    style={styles.productName}
                                                />
                                            </View>
                                        ))}
                                    </ScrollView>
                                )}

                                <View style={[styles.separator, { backgroundColor: colors.borderLight || colors.border }]} />

                                <View style={styles.rowBetween}>
                                    <AppText label="Order total" color={colors.textSecondary} variant={1} fontSize={14} />
                                    <AppText label={`GHS ${Number(item.total_amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`} color={colors.text} variant={1} fontSize={14} />
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={() => (
                        <View style={{ alignItems: 'center', marginTop: 70 }}>
                            <Lucide name="package-search" size={40} color={colors.border} />
                            <AppText label="No orders yet" color={colors.textSecondary} style={{ marginTop: 8 }} />
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    searchIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    searchWrap: { height: 42, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontFamily: 'FiraSans-Regular' },
    card: { borderRadius: 12, marginBottom: 12, padding: 12 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    separator: { height: 1, marginVertical: 10 },
    productStrip: { paddingTop: 10, paddingBottom: 4 },
    productPreview: { marginRight: 10, width: 72, alignItems: 'center' },
    productImageWrap: { width: 60, height: 60, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    productImage: { width: '100%', height: '100%' },
    productName: { marginTop: 6, textAlign: 'center', width: 72 },
    statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
});

export default MyOrders;
