import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import {
    addToCart,
    clearCart,
    getCartItems,
    removeCartItem,
    subscribeCart,
    updateCartItemQty,
} from '../../store/cartStore';
import { catalog, customerProfiles } from '../../services/api';

const { width } = Dimensions.get('window');
const SUGGESTION_CARD_WIDTH = (width - 44) / 2;

const getBrickMetrics = (index) => {
    const pattern = index % 4;
    if (pattern === 0) return { imageHeight: 132 };
    if (pattern === 1) return { imageHeight: 162 };
    if (pattern === 2) return { imageHeight: 144 };
    return { imageHeight: 176 };
};

const formatMoney = (n) =>
    `GHS ${Number(n || 0).toLocaleString('en-GH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const resolveProductImageUri = (product) => {
    const raw = product?.thumbnail || product?.picture1 || product?.image || product?.image_uri || '';
    if (!raw) return '';
    if (/^(https?:|data:|file:)/i.test(String(raw))) return String(raw);
    return `${config.BASE_API}/images?id=${encodeURIComponent(raw)}`;
};

const resolveCartImageUri = (item) => {
    const raw = item?.image_uri || item?.thumbnail || item?.image || '';
    if (!raw) return '';
    if (/^(https?:|data:|file:|content:)/i.test(String(raw))) return String(raw);
    return `${config.BASE_API}/images?id=${encodeURIComponent(raw)}`;
};

const QtyStepper = ({ value, onDec, onInc, colors, canInc }) => (
    <View style={[styles.stepper, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
            activeOpacity={0.75}
            onPress={onDec}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.stepperBtn}
        >
            <Lucide name="minus" size={14} color={colors.text} />
        </TouchableOpacity>
        <AppText label={String(value)} variant={1} fontSize={14} color={colors.text} style={styles.stepperValue} />
        <TouchableOpacity
            activeOpacity={0.75}
            onPress={onInc}
            disabled={!canInc}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.stepperBtn, { opacity: canInc ? 1 : 0.35 }]}
        >
            <Lucide name="plus" size={14} color={canInc ? colors.text : colors.textTertiary || colors.textSecondary} />
        </TouchableOpacity>
    </View>
);

const Cart = ({ navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [items, setItems] = useState(getCartItems());
    const [refreshing, setRefreshing] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [suggestionWarehouseId, setSuggestionWarehouseId] = useState('');

    useEffect(() => subscribeCart(setItems), []);

    const loadSuggestions = useCallback(async () => {
        setSuggestionsLoading(true);
        try {
            const stores = await customerProfiles.stores();
            const firstWarehouseId =
                Array.isArray(stores) && stores.length > 0 ? stores[0]?.warehouse_id : '';
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
        [items],
    );
    const totalItems = useMemo(
        () => items.reduce((sum, it) => sum + Number(it.quantity || 0), 0),
        [items],
    );
    const warehouseCount = useMemo(
        () => new Set(items.map((i) => i.warehouse_id).filter(Boolean)).size,
        [items],
    );

    const setQty = (item, nextQty) => {
        const maxAvailable = Number(item.available_quantity || item.quantity_available || 0);
        const hasStockCap = Number.isFinite(maxAvailable) && maxAvailable > 0;
        const minQty = Number(item.min_order_qty || 1);
        let qty = Number(nextQty);
        if (!Number.isFinite(qty) || qty <= 0) {
            removeCartItem(item.key);
            return;
        }
        if (qty < minQty) qty = minQty;
        if (hasStockCap) qty = Math.min(qty, maxAvailable);
        updateCartItemQty(item.key, qty);
    };

    const onCheckout = () => {
        if (!items.length) return;
        if (warehouseCount > 1) {
            Alert.alert('Multiple stores', 'Please checkout items from one store at a time.');
            return;
        }
        navigation.navigate('Checkout');
    };

    const onClearCart = () => {
        if (!items.length) return;
        Alert.alert('Clear cart?', 'Remove all items from your cart.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => clearCart() },
        ]);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        setItems(getCartItems());
        if (!getCartItems().length) await loadSuggestions();
        setRefreshing(false);
    };

    const openProduct = (item) => {
        if (!item?.product_id) return;
        navigation.navigate('ForYouProductDetails', {
            product: {
                id: item.product_id,
                name: item.name,
                thumbnail: item.image_uri,
                measurement_unit: item.measurement_unit,
                base_price_per_unit: item.unit_price,
                quantity_available: item.available_quantity,
            },
            warehouseId: item.warehouse_id,
        });
    };

    const isInCart = (product) => {
        const key = `${suggestionWarehouseId || product?.warehouse_id}:${product.id}`;
        return getCartItems().some((it) => it.key === key);
    };

    const toggleSuggestion = (product) => {
        const key = `${suggestionWarehouseId || product?.warehouse_id}:${product.id}`;
        if (isInCart(product)) {
            removeCartItem(key);
            return;
        }
        addToCart({
            warehouse_id: suggestionWarehouseId || product?.warehouse_id,
            product_id: product.id,
            name: product.name,
            image_uri:
                product?.thumbnail || product?.picture1 || product?.image || product?.image_uri || null,
            measurement_unit: product.measurement_unit || 'unit',
            unit_price: Number(product.base_price_per_unit || product.unit_price || 0),
            quantity: Number(product.min_order_qty || 1),
            available_quantity: Number(product.quantity_available || 0),
            min_order_qty: Number(product.min_order_qty || 1),
        });
    };

    const renderSuggestions = () => (
        <View style={{ marginTop: items.length ? 8 : 28 }}>
            <AppText
                label={items.length ? 'You may also like' : 'You may like'}
                variant={1}
                color={colors.text}
                fontSize={15}
                style={{ marginBottom: 12 }}
            />
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
                                    const inCart = isInCart(product);
                                    return (
                                        <TouchableOpacity
                                            key={String(product.id || `${col}-${idxInCol}`)}
                                            activeOpacity={0.85}
                                            onPress={() =>
                                                navigation.navigate('ForYouProductDetails', {
                                                    product,
                                                    warehouseId:
                                                        suggestionWarehouseId || product?.warehouse_id,
                                                })
                                            }
                                            style={[
                                                styles.suggestionCard,
                                                {
                                                    backgroundColor: colors.surface,
                                                    borderColor: colors.border,
                                                },
                                            ]}
                                        >
                                            <View
                                                style={[
                                                    styles.suggestionImageWrap,
                                                    {
                                                        backgroundColor: colors.surfaceSecondary,
                                                        height: metrics.imageHeight,
                                                    },
                                                ]}
                                            >
                                                {uri ? (
                                                    <Image
                                                        source={{ uri }}
                                                        style={styles.suggestionImage}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <Lucide
                                                        name="package"
                                                        size={20}
                                                        color={colors.textTertiary || colors.textSecondary}
                                                    />
                                                )}
                                            </View>
                                            <View style={{ padding: 10 }}>
                                                <AppText
                                                    label={product.name || 'Product'}
                                                    color={colors.text}
                                                    variant={1}
                                                    fontSize={13}
                                                    numberOfLines={2}
                                                />
                                                <View style={styles.suggestionFooterRow}>
                                                    <AppText
                                                        label={formatMoney(
                                                            product.base_price_per_unit ||
                                                                product.unit_price ||
                                                                0,
                                                        )}
                                                        color={config.THEME_COLOR}
                                                        fontSize={13}
                                                        variant={1}
                                                        style={{ marginTop: 4, flex: 1 }}
                                                    />
                                                    <TouchableOpacity
                                                        activeOpacity={0.8}
                                                        onPress={() => toggleSuggestion(product)}
                                                        style={[
                                                            styles.suggestionAddBtn,
                                                            {
                                                                backgroundColor: inCart
                                                                    ? config.THEME_COLOR
                                                                    : colors.surfaceSecondary,
                                                            },
                                                        ]}
                                                    >
                                                        <Lucide
                                                            name={inCart ? 'check' : 'plus'}
                                                            size={15}
                                                            color={inCart ? '#fff' : colors.text}
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
    );

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader hideBack label="Cart">
                {items.length > 0 ? (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onClearCart}
                        style={[styles.headerAction, { backgroundColor: colors.surfaceSecondary }]}
                    >
                        <Lucide name="trash-2" size={16} color="#ef4444" />
                    </TouchableOpacity>
                ) : null}
            </ScreenHeader>

            {items.length > 0 ? (
                <View style={styles.summaryRow}>
                    <AppText
                        label={`${totalItems} item${totalItems === 1 ? '' : 's'} · ${formatMoney(total)}`}
                        fontSize={13}
                        color={colors.textSecondary}
                    />
                </View>
            ) : null}

            {warehouseCount > 1 ? (
                <View
                    style={[
                        styles.notice,
                        {
                            backgroundColor: '#fef3c7',
                            borderColor: '#fcd34d',
                            marginHorizontal: 16,
                            marginBottom: 8,
                        },
                    ]}
                >
                    <Lucide name="store" size={15} color="#d97706" />
                    <AppText
                        label="Items from multiple stores — checkout one store at a time."
                        fontSize={12}
                        color="#92400e"
                        style={{ flex: 1, marginLeft: 8 }}
                    />
                </View>
            ) : null}

            <FlashList
                data={items}
                estimatedItemSize={120}
                keyExtractor={(item) => item.key}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 4,
                    paddingBottom: 210 + insets.bottom,
                }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                renderItem={({ item }) => {
                    const img = resolveCartImageUri(item);
                    const qty = Number(item.quantity || 1);
                    const maxAvailable = Number(item.available_quantity || item.quantity_available || 0);
                    const hasStockCap = Number.isFinite(maxAvailable) && maxAvailable > 0;
                    const canInc = !hasStockCap || qty < maxAvailable;
                    const lineTotal = Number(item.unit_price || 0) * qty;
                    const unit = item.measurement_unit || 'unit';

                    return (
                        <View
                            style={[
                                styles.card,
                                {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border,
                                },
                            ]}
                        >
                            <TouchableOpacity
                                activeOpacity={0.88}
                                onPress={() => openProduct(item)}
                                style={styles.cardTop}
                            >
                                <View
                                    style={[
                                        styles.thumb,
                                        { backgroundColor: colors.surfaceSecondary },
                                    ]}
                                >
                                    {img ? (
                                        <Image source={{ uri: img }} style={styles.thumbImg} resizeMode="cover" />
                                    ) : (
                                        <Lucide
                                            name="package"
                                            size={20}
                                            color={colors.textTertiary || colors.textSecondary}
                                        />
                                    )}
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <AppText
                                        label={item.name || 'Item'}
                                        variant={1}
                                        fontSize={15}
                                        color={colors.text}
                                        numberOfLines={2}
                                    />
                                    <AppText
                                        label={`${formatMoney(item.unit_price)} / ${unit}`}
                                        color={colors.textSecondary}
                                        fontSize={12}
                                        style={{ marginTop: 3 }}
                                    />
                                    {hasStockCap ? (
                                        <AppText
                                            label={
                                                qty >= maxAvailable
                                                    ? `Only ${maxAvailable} left`
                                                    : `${maxAvailable} available`
                                            }
                                            color={
                                                qty >= maxAvailable
                                                    ? '#d97706'
                                                    : colors.textTertiary || colors.textSecondary
                                            }
                                            fontSize={11}
                                            style={{ marginTop: 4 }}
                                        />
                                    ) : null}
                                </View>
                            </TouchableOpacity>

                            <View style={styles.cardBottom}>
                                <QtyStepper
                                    value={qty}
                                    colors={colors}
                                    canInc={canInc}
                                    onDec={() => setQty(item, qty - 1)}
                                    onInc={() => setQty(item, qty + 1)}
                                />
                                <AppText
                                    label={formatMoney(lineTotal)}
                                    variant={1}
                                    fontSize={15}
                                    color={colors.text}
                                />
                                <TouchableOpacity
                                    activeOpacity={0.75}
                                    onPress={() => removeCartItem(item.key)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    style={[
                                        styles.removeBtn,
                                        { backgroundColor: colors.surfaceSecondary },
                                    ]}
                                >
                                    <Lucide name="trash-2" size={15} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                }}
                ListEmptyComponent={() => (
                    <View style={{ paddingTop: 28 }}>
                        <View style={styles.emptyWrap}>
                            <View
                                style={[
                                    styles.emptyIcon,
                                    { backgroundColor: `${config.THEME_COLOR}14` },
                                ]}
                            >
                                <Lucide name="shopping-bag" size={28} color={config.THEME_COLOR} />
                            </View>
                            <AppText
                                label="Your cart is empty"
                                variant={1}
                                fontSize={18}
                                color={colors.text}
                                style={{ marginTop: 14 }}
                            />
                            <AppText
                                label="Browse products and add items to get started."
                                fontSize={13}
                                color={colors.textSecondary}
                                style={{ marginTop: 6, textAlign: 'center', paddingHorizontal: 24 }}
                            />
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => navigation.navigate('ForYou')}
                                style={[styles.browseBtn, { backgroundColor: config.THEME_COLOR }]}
                            >
                                <AppText label="Browse products" color="#fff" variant={1} fontSize={14} />
                                <View style={{ marginLeft: 6 }}>
                                    <Lucide name="arrow-right" size={16} color="#fff" />
                                </View>
                            </TouchableOpacity>
                        </View>
                        {renderSuggestions()}
                    </View>
                )}
                ListFooterComponent={items.length > 0 ? renderSuggestions : null}
            />

            {items.length > 0 ? (
                <View
                    style={[
                        styles.checkoutBar,
                        {
                            borderTopColor: colors.border,
                            backgroundColor: colors.surface,
                            bottom: 60 + insets.bottom,
                            paddingBottom: 12,
                        },
                    ]}
                >
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <AppText label="Subtotal" color={colors.textSecondary} fontSize={12} />
                        <AppText
                            label={formatMoney(total)}
                            variant={1}
                            fontSize={18}
                            color={colors.text}
                            style={{ marginTop: 2 }}
                        />
                    </View>
                    <TouchableOpacity
                        onPress={onCheckout}
                        activeOpacity={0.88}
                        style={[styles.checkoutBtn, { backgroundColor: config.THEME_COLOR }]}
                    >
                        <AppText label="Checkout" color="#fff" variant={1} fontSize={15} />
                        <View style={{ marginLeft: 6 }}>
                            <Lucide name="arrow-right" size={16} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </View>
            ) : null}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    headerAction: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    summaryRow: {
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 10,
    },
    notice: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    card: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    thumb: {
        width: 76,
        height: 76,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    thumbImg: { width: '100%', height: '100%' },
    cardBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 10,
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        height: 36,
        paddingHorizontal: 4,
    },
    stepperBtn: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperValue: {
        minWidth: 28,
        textAlign: 'center',
    },
    removeBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 'auto',
    },
    emptyWrap: {
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    browseBtn: {
        marginTop: 18,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 12,
    },
    masonryRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    masonryCol: { width: SUGGESTION_CARD_WIDTH },
    suggestionCard: {
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    suggestionImageWrap: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    suggestionImage: { width: '100%', height: '100%' },
    suggestionFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 2,
    },
    suggestionAddBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkoutBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 16,
        paddingTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 12,
    },
});

export default Cart;
