import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, Image, RefreshControl, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { addToCart, getCartItems, removeCartItem, subscribeCart, updateCartItemQty } from '../../store/cartStore';
import { catalog, customerProfiles } from '../../services/api';

const { width } = Dimensions.get('window');
const SUGGESTION_CARD_WIDTH = (width - 36) / 2;
const getBrickMetrics = (index) => {
    const pattern = index % 4;
    if (pattern === 0) return { imageHeight: 132 };
    if (pattern === 1) return { imageHeight: 162 };
    if (pattern === 2) return { imageHeight: 144 };
    return { imageHeight: 176 };
};

const Cart = ({ navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [items, setItems] = useState(getCartItems());
    const [refreshing, setRefreshing] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [suggestionWarehouseId, setSuggestionWarehouseId] = useState('');

    useEffect(() => subscribeCart(setItems), []);

    const resolveProductImageUri = (product) => {
        const raw = product?.thumbnail || product?.picture1 || product?.image || product?.image_uri || '';
        if (!raw) return '';
        if (/^(https?:|data:|file:)/i.test(String(raw))) return String(raw);
        return `${config.BASE_API}/images?id=${raw}`;
    };

    const loadSuggestions = useCallback(async () => {
        setSuggestionsLoading(true);
        try {
            const stores = await customerProfiles.stores();
            const firstWarehouseId = Array.isArray(stores) && stores.length > 0 ? stores[0]?.warehouse_id : '';
            if (!firstWarehouseId) {
                setSuggestions([]);
                setSuggestionWarehouseId('');
                return;
            }
            setSuggestionWarehouseId(firstWarehouseId);
            const res = await catalog.list(firstWarehouseId);
            const list = Array.isArray(res) ? res.slice(0, 10) : [];
            setSuggestions(list);
        } catch (_) {
            setSuggestions([]);
            setSuggestionWarehouseId('');
        } finally {
            setSuggestionsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSuggestions();
    }, [loadSuggestions]);

    const total = useMemo(
        () => items.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.unit_price || 0), 0),
        [items]
    );
    const totalItems = useMemo(
        () => items.reduce((sum, it) => sum + Number(it.quantity || 0), 0),
        [items]
    );

    const onCheckout = () => {
        if (!items.length) return;
        const warehouses = [...new Set(items.map((i) => i.warehouse_id))];
        if (warehouses.length > 1) {
            Alert.alert('Multiple stores', 'Please checkout items from one store at a time.');
            return;
        }
        navigation.navigate('Checkout');
    };

    const onRefresh = async () => {
        setRefreshing(true);
        setItems(getCartItems());
        if (!items.length) await loadSuggestions();
        setRefreshing(false);
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.navigate('ForYou')} label="Cart" />
            <FlashList
                data={items}
                estimatedItemSize={90}
                keyExtractor={(item) => item.key}
                contentContainerStyle={{ padding: 12, paddingBottom: 210 + insets.bottom }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                renderItem={({ item, index }) => (
                    <View style={[styles.rowWrap, { borderBottomColor: colors.border }]}>
                        <View style={[styles.imageWrap, { backgroundColor: colors.surfaceSecondary }]}>
                            {item.image_uri ? (
                                <Image source={{ uri: config.BASE_API + '/images?id=' + item.image_uri }} style={styles.image} resizeMode="cover" />
                            ) : (
                                <Lucide name="image" size={18} color={colors.textTertiary} />
                            )}
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <AppText label={item.name || 'Item'} variant={1} color={colors.text} numberOfLines={2} />
                            <AppText
                                label={`GHS ${Number(item.unit_price || 0).toFixed(2)} / ${item.measurement_unit || 'unit'}`}
                                color={colors.textSecondary}
                                fontSize={12}
                                style={{ marginTop: 2 }}
                            />
                            <View style={styles.controlsRow}>
                                <TextInput
                                    value={String(item.quantity || 1)}
                                    onChangeText={(text) => {
                                        const raw = text.replace(/[^0-9.]/g, '');
                                        const parsed = Number(raw || 0);
                                        const maxAvailable = Number(item.available_quantity || item.quantity_available || 0);
                                        const hasStockCap = Number.isFinite(maxAvailable) && maxAvailable > 0;
                                        const nextQty = hasStockCap ? Math.min(parsed, maxAvailable) : parsed;
                                        updateCartItemQty(item.key, nextQty);
                                    }}
                                    keyboardType="decimal-pad"
                                    style={[styles.qty, { borderColor: colors.border, color: colors.text }]}
                                />
                                <AppText
                                    label={`GHS ${(Number(item.unit_price || 0) * Number(item.quantity || 0)).toFixed(2)}`}
                                    color={config.THEME_COLOR}
                                    variant={1}
                                />
                                <TouchableOpacity onPress={() => removeCartItem(item.key)}>
                                    <Lucide name="trash-2" size={18} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                            {Number(item.available_quantity || item.quantity_available || 0) > 0 && (
                                <AppText
                                    label={`Max available: ${Number(item.available_quantity || item.quantity_available || 0)}`}
                                    color={colors.textTertiary || colors.textSecondary}
                                    fontSize={11}
                                    style={{ marginTop: 4 }}
                                />
                            )}
                        </View>
                    </View>
                )}
                ListEmptyComponent={() => (
                    <View style={{ marginTop: 40 }}>
                        <View style={{ alignItems: 'center' }}>
                            <Lucide name="shopping-cart" size={40} color={colors.border} />
                            <AppText label="Your cart is empty" color={colors.textSecondary} style={{ marginTop: 8 }} />
                        </View>

                        <View style={{ marginTop: 50 }}>
                            <AppText label="You may like" variant={1} color={colors.text} fontSize={15} style={{ marginBottom: 10 }} />
                            {suggestionsLoading ? (
                                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                                    <Lucide name="loader-circle" size={22} color={config.THEME_COLOR} />
                                </View>
                            ) : suggestions.length > 0 ? (
                                <View style={styles.masonryRow}>
                                    {[0, 1].map((col) => (
                                        <View key={`col-${col}`} style={styles.masonryCol}>
                                            {suggestions
                                                .filter((_p, idx) => idx % 2 === col)
                                                .map((product, idxInCol) => {
                                                    const sourceIndex = suggestions.findIndex((p) => p?.id === product?.id);
                                                    const metrics = getBrickMetrics(sourceIndex);
                                                    const uri = resolveProductImageUri(product);
                                                    return (
                                                        <TouchableOpacity
                                                            key={String(product.id || `${col}-${idxInCol}`)}
                                                            activeOpacity={0.85}
                                                            onPress={() =>
                                                                navigation.navigate('ForYouProductDetails', {
                                                                    product,
                                                                    warehouseId: suggestionWarehouseId || product?.warehouse_id,
                                                                })
                                                            }
                                                            style={[styles.suggestionCard, { backgroundColor: colors.surface }]}
                                                        >
                                                            <View style={[styles.suggestionImageWrap, { backgroundColor: colors.surfaceSecondary, height: metrics.imageHeight }]}>
                                                                {uri ? (
                                                                    <Image source={{ uri }} style={styles.suggestionImage} resizeMode="cover" />
                                                                ) : (
                                                                    <Lucide name="image" size={18} color={colors.textTertiary} />
                                                                )}
                                                            </View>
                                                            <View style={{ padding: 8 }}>
                                                                <AppText label={product.name || 'Product'} color={colors.text} variant={1} numberOfLines={2} />
                                                                <View style={styles.suggestionFooterRow}>
                                                                    <AppText
                                                                        label={`GHS ${Number(product.base_price_per_unit || product.unit_price || 0).toFixed(2)}`}
                                                                        color={config.THEME_COLOR}
                                                                        fontSize={13}
                                                                        style={{ marginTop: 4 }}
                                                                    />
                                                                    <TouchableOpacity
                                                                        activeOpacity={0.8}
                                                                        onPress={() => {
                                                                            const key = `${suggestionWarehouseId || product?.warehouse_id}:${product.id}`;
                                                                            const alreadyInCart = getCartItems().some((it) => it.key === key);
                                                                            if (alreadyInCart) {
                                                                                removeCartItem(key);
                                                                                return;
                                                                            }
                                                                            addToCart({
                                                                                warehouse_id: suggestionWarehouseId || product?.warehouse_id,
                                                                                product_id: product.id,
                                                                                name: product.name,
                                                                                image_uri:
                                                                                    product?.thumbnail ||
                                                                                    product?.picture1 ||
                                                                                    product?.image ||
                                                                                    product?.image_uri ||
                                                                                    null,
                                                                                measurement_unit: product.measurement_unit || 'unit',
                                                                                unit_price: Number(product.base_price_per_unit || product.unit_price || 0),
                                                                                quantity: Number(product.min_order_qty || 1),
                                                                                available_quantity: Number(product.quantity_available || 0),
                                                                            });
                                                                        }}
                                                                        style={[
                                                                            styles.suggestionAddBtn,
                                                                            {
                                                                                backgroundColor: getCartItems().some(
                                                                                    (it) =>
                                                                                        it.key ===
                                                                                        `${suggestionWarehouseId || product?.warehouse_id}:${product.id}`
                                                                                )
                                                                                    ? config.THEME_COLOR
                                                                                    : colors.surfaceSecondary,
                                                                            },
                                                                        ]}
                                                                    >
                                                                        <Lucide
                                                                            name={
                                                                                getCartItems().some(
                                                                                    (it) =>
                                                                                        it.key ===
                                                                                        `${suggestionWarehouseId || product?.warehouse_id}:${product.id}`
                                                                                )
                                                                                    ? 'check'
                                                                                    : 'shopping-cart'
                                                                            }
                                                                            size={16}
                                                                            color={
                                                                                getCartItems().some(
                                                                                    (it) =>
                                                                                        it.key ===
                                                                                        `${suggestionWarehouseId || product?.warehouse_id}:${product.id}`
                                                                                )
                                                                                    ? '#fff'
                                                                                    : colors.text
                                                                            }
                                                                        />
                                                                    </TouchableOpacity>
                                                                </View>
                                                            </View>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                        </View>
                    </View>
                )}
            />
            <View
                style={[
                    styles.checkoutBar,
                    {
                        borderTopColor: colors.border,
                        backgroundColor: colors.surface,
                        bottom: 60 + insets.bottom,
                    },
                ]}
            >
                <View>
                    <AppText label={`${totalItems} item(s)`} color={colors.textSecondary} fontSize={12} />
                    <AppText label={`GHS ${total.toFixed(2)}`} variant={1} color={colors.text} />
                </View>
                <TouchableOpacity onPress={onCheckout} disabled={!items.length} style={[styles.checkoutBtn, { backgroundColor: config.THEME_COLOR, opacity: items.length ? 1 : 0.5 }]}>
                    <AppText label="Checkout" color="#fff" variant={1} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    rowWrap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    imageWrap: { width: 72, height: 72, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    image: { width: '100%', height: '100%' },
    controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    qty: { width: 56, height: 38, borderWidth: 1, borderRadius: 8, textAlign: 'center' },
    masonryRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    masonryCol: { width: SUGGESTION_CARD_WIDTH },
    suggestionCard: { borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
    suggestionImageWrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
    suggestionImage: { width: '100%', height: '100%' },
    suggestionFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    suggestionAddBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    checkoutBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    checkoutBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
});

export default Cart;
