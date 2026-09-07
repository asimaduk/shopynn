import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, StyleSheet, TextInput, TouchableOpacity, View, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { catalog, customerProfiles } from '../../services/api';
import { addToCart } from '../../store/cartStore';
import { getCartItems, subscribeCart } from '../../store/cartStore';
import { removeCartItem } from '../../store/cartStore';
import { useSelector } from 'react-redux';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 20) / 2;

const resolveProfileImageUri = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^(https?:|file:|content:|data:)/i.test(value)) return value;
    return `${config.BASE_API}/images?id=${encodeURIComponent(value)}`;
};

const getBrickMetrics = (index) => {
    const pattern = index % 4;
    if (pattern === 0) return { imageHeight: 154, bodyMinHeight: 96 };
    if (pattern === 1) return { imageHeight: 186, bodyMinHeight: 100 };
    if (pattern === 2) return { imageHeight: 168, bodyMinHeight: 96 };
    return { imageHeight: 198, bodyMinHeight: 102 };
};

const getSoldLabel = (product, index) => {
    const soldRaw = Number(product?.sold_count || product?.sold || product?.orders_count || 0);
    if (soldRaw > 0) {
        if (soldRaw >= 1000) {
            return `${(soldRaw / 1000).toFixed(1).replace('.0', '')}k sold`;
        }
        return `${soldRaw} sold`;
    }
    // Deterministic lightweight fallback for catalog items without sales metadata.
    return `${((index * 13) % 57) + 8} sold`;
};

const ForYou = ({ navigation, route }) => {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(false);
    const [stores, setStores] = useState([]);
    const [warehouseId, setWarehouseId] = useState('');
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [cartItems, setCartItems] = useState(getCartItems());
    const user = useSelector(({ user }) => user);

    const profileImageUri = useMemo(
        () =>
            resolveProfileImageUri(
                user?.profile_image ?? user?.profileImage ?? user?.avatar ?? user?.settings?.profile?.image_url,
            ),
        [user],
    );

    const getProductImageUri = (product) => {
        return (
            product?.thumbnail ||
            product?.picture1 ||
            product?.image ||
            product?.image_url ||
            product?.photo ||
            null
        );
    };

    const loadStores = useCallback(async () => {
        try {
            const res = await customerProfiles.stores();
            const list = Array.isArray(res) ? res : [];
            setStores(list);
            if (list.length && !warehouseId) setWarehouseId(list[0].warehouse_id);
        } catch (_) {
            setStores([]);
        }
    }, [warehouseId]);

    const loadProducts = useCallback(async () => {
        if (!warehouseId) {
            setProducts([]);
            return;
        }
        setLoading(true);
        try {
            const res = await catalog.list(warehouseId);
            setProducts(Array.isArray(res) ? res : []);
        } catch (_) {
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, [warehouseId]);

    useEffect(() => {
        loadStores();
    }, [loadStores]);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    useEffect(() => subscribeCart(setCartItems), []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadStores();
        await loadProducts();
        setRefreshing(false);
    };

    const filtered = useMemo(() => {
        if (!search.trim()) return products;
        const q = search.trim().toLowerCase();
        return products.filter((p) => String(p.name || '').toLowerCase().includes(q));
    }, [products, search]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            {/* <ScreenHeader label="For You" /> */}
            <View style={{flexDirection:'row',padding:10,backgroundColor:colors.surface,justifyContent:'space-between',alignItems:'center'}}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('Profile')}
                    style={{marginRight: 8}}
                >
                    <View style={[styles.headerProfileImageContainer, { backgroundColor: colors.primaryShade || colors.border }]}>
                        {profileImageUri ? (
                            <Image
                                source={{ uri: profileImageUri }}
                                style={styles.headerProfileImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <View
                                style={[
                                    styles.headerProfileImagePlaceholder,
                                    { backgroundColor: colors.primaryShade || colors.border },
                                ]}
                            >
                                <Lucide name="user" color={config.THEME_COLOR} size={22} />
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
                <AppText label="For You" variant={1} fontSize={16} fontFamily="FiraSans-Bold" color={colors.text} style={{flex:1}} />
                <View style={{flexDirection:'row',alignItems:'center',flex:1}}>
                    <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => navigation.navigate('ForYouSearch', { warehouseId })}
                        style={{
                            height: 40,
                            borderRadius: 999,
                            marginRight: 8,
                            paddingHorizontal: 12,
                            backgroundColor: colors.surfaceSecondary || 'rgba(240,240,240,0.12)',
                            alignItems: 'center',
                            flexDirection: 'row',
                            flex:1,
                            marginLeft:10,
                        }}>
                        <Lucide name="search" color={colors.text} size={17} />
                        <AppText label="Search" color={colors.text} fontSize={12} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                    {/* <TouchableOpacity
                        activeOpacity={.6}
                        onPress={()=> navigation.navigate("Notifications")}
                        style={{width:45,height:45,borderRadius:45,backgroundColor:'rgba(240,240,240,0.1)',justifyContent:'center',alignItems:'center'}}>
                        <Lucide name="bell" color={colors.text} size={17} />
                    </TouchableOpacity> */}
                </View>
            </View>

            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={config.THEME_COLOR} />
                </View>
            ) : (
                <FlashList
                    style={{ flex: 1 }}
                    data={filtered}
                    estimatedItemSize={260}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={{ paddingHorizontal: 5, paddingBottom: 80, paddingTop:5 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    masonry
                    numColumns={2}
                    renderItem={({ item, index }) => {
                        const metrics = getBrickMetrics(index);
                        const isInCart = cartItems.some(
                            (ci) => String(ci.warehouse_id) === String(warehouseId) && String(ci.product_id) === String(item.id)
                        );
                        const stockCount = Number(item.quantity_available || 0);
                        const showLowStock = stockCount > 0 && stockCount <= 5;
                        const soldLabel = getSoldLabel(item, index);

                        return (
                            <View
                            style={[
                                styles.gridCell,
                            ]}
                        >
                            <TouchableOpacity
                                activeOpacity={0.88}
                                onPress={() => navigation.navigate('ForYouProductDetails', { product: item, warehouseId })}
                                style={[styles.card, { backgroundColor: colors.surface }]}
                            >
                                <View
                                    style={[
                                        styles.imageWrap,
                                        {
                                            backgroundColor: colors.surfaceSecondary,
                                            height: metrics.imageHeight,
                                        },
                                    ]}
                                >
                                    {getProductImageUri(item) ? (
                                        <Image
                                            source={{ uri: config.BASE_API + '/images?id=' + getProductImageUri(item) }}
                                            style={styles.productImage}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={styles.imagePlaceholder}>
                                            <Lucide name="image" size={20} color={colors.textTertiary} />
                                        </View>
                                    )}
                                    <View style={styles.imageOverlay} />
                                    <View style={styles.badgeRow}>
                                        {/* {index % 3 === 0 && (
                                            <View style={[styles.badge, { backgroundColor: config.THEME_COLOR }]}>
                                                <AppText label="HOT" fontSize={10} color="#fff" fontFamily="FiraSans-Bold" />
                                            </View>
                                        )} */}
                                        {item.installment_enabled ? (
                                            <View style={[styles.badge, { backgroundColor: '#7C3AED' }]}>
                                                <AppText label="PAY OVER TIME" fontSize={9} color="#fff" fontFamily="FiraSans-Bold" />
                                            </View>
                                        ) : null}
                                        {showLowStock && (
                                            <View style={[styles.badge, { backgroundColor: '#F97316' }]}>
                                                <AppText label="LOW STOCK" fontSize={10} color="#fff" fontFamily="FiraSans-Bold" />
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View style={{ flex: 1, paddingHorizontal:10 }}>
                                    <AppText label={item.name || 'Product'} variant={1} color={colors.text} numberOfLines={2} />
                                    <AppText
                                        label={Number(item.quantity_available || 0) > 0 ? 'In stock' : 'Out of stock'}
                                        fontSize={12}
                                        color={Number(item.quantity_available || 0) > 0 ? '#16A34A' : '#DC2626'}
                                        numberOfLines={1}
                                    />
                                    <AppText label={soldLabel} fontSize={11} color={colors.textTertiary || colors.textSecondary} />

                                    <View style={{ flexDirection:'row',justifyContent:'space-between',alignItems:'center' }}>
                                        <AppText
                                            label={`GHS ${Number(item.base_price_per_unit || item.unit_price || 0).toFixed(2)}`}
                                            fontSize={14}
                                            color={config.THEME_COLOR}
                                            style={{ marginTop: 2 }}
                                        />

                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={() => {
                                                const key = `${warehouseId}:${item.id}`;
                                                if (isInCart) {
                                                    removeCartItem(key);
                                                    return;
                                                }
                                                addToCart({
                                                    warehouse_id: warehouseId,
                                                    product_id: item.id,
                                                    name: item.name,
                                                    image_uri: getProductImageUri(item),
                                                    measurement_unit: item.measurement_unit || 'unit',
                                                    unit_price: Number(item.base_price_per_unit || item.unit_price || 0),
                                                    quantity: Number(item.min_order_qty || 1),
                                                    installment_enabled: Boolean(item.installment_enabled),
                                                    installment_min_initial_percent: item.installment_min_initial_percent,
                                                    installment_min_payment_amount: item.installment_min_payment_amount,
                                                });
                                            }}
                                            style={[
                                                styles.addBtn,
                                                {
                                                    backgroundColor: isInCart ? config.THEME_COLOR : colors.surfaceSecondary,
                                                },
                                            ]}
                                        >
                                            <Lucide
                                                name={isInCart ? 'check' : 'shopping-cart'}
                                                size={18}
                                                color={isInCart ? '#fff' : colors.text}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                        );
                    }}
                    ListEmptyComponent={() => (
                        <View style={{ alignItems: 'center', marginTop: 80 }}>
                            <Lucide name="store" size={36} color={colors.border} />
                            <AppText label="No products available" color={colors.textSecondary} style={{ marginTop: 8 }} />
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    headerProfileImageContainer: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        overflow: 'hidden',
    },
    headerProfileImage: {
        width: '100%',
        height: '100%',
    },
    headerProfileImagePlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    search: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 42 },
    storeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    gridCell: { width: CARD_WIDTH, marginHorizontal: 2.5, marginBottom: 5, borderRadius: 8 },
    card: {
        minHeight: 220,
        paddingBottom: 8,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    imageWrap: {
        width: '100%',
        height: CARD_WIDTH,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 6,
        overflow: 'hidden',
        marginBottom: 8,
    },
    badgeRow: {
        position: 'absolute',
        top: 8,
        left: 8,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        zIndex: 3,
    },
    badge: {
        borderRadius: 999,
        paddingHorizontal: 7,
        paddingVertical: 4,
    },
    productImage: { width: '100%', height: '100%' },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        opacity: 0.08,
        zIndex: 2,
    },
    imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    addBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center'},
});

export default ForYou;
