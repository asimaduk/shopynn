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
import ConfirmDialog from '../../components/ConfirmDialog';
import { formatUnit } from '../../utils/format';

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
    const panelBorder = `${config.THEME_COLOR}26`;
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
            setSuggestions(Array.isArray(res) ? res.slice(0, 30) : []);
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

    const visibleSuggestions = useMemo(() => {
        const inCartIds = new Set(items.map((it) => String(it.product_id)));
        return suggestions.filter((p) => !inCartIds.has(String(p?.id))).slice(0, 10);
    }, [suggestions, items]);

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

    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const onClearCart = () => {
        if (!items.length) return;
        setShowClearConfirm(true);
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
            <View style={styles.suggestHeader}>
                <View style={[styles.suggestIcon, { backgroundColor: colors.surfaceSecondary }]}>
                    <Lucide name="sparkles" size={15} color={config.THEME_COLOR} />
                </View>
                <View style={{ flex: 1 }}>
                    <AppText
                        label={items.length ? 'You may also like' : 'You may like'}
                        variant={1}
                        color={colors.text}
                        fontSize={15}
                    />
                    <AppText
                        label="Popular picks from this store"
                        color={colors.textTertiary}
                        fontSize={12}
                        style={{ marginTop: 1 }}
                    />
                </View>
            </View>
            {suggestionsLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <Lucide name="loader-circle" size={22} color={config.THEME_COLOR} />
                </View>
            ) : visibleSuggestions.length > 0 ? (
                <View style={styles.masonryRow}>
                    {[0, 1].map((col) => (
                        <View key={`col-${col}`} style={styles.masonryCol}>
                            {visibleSuggestions
                                .filter((_p, idx) => idx % 2 === col)
                                .map((product, idxInCol) => {
                                    const sourceIndex = visibleSuggestions.findIndex((p) => p?.id === product?.id);
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
                    paddingTop: 12,
                    paddingBottom: 210 + insets.bottom,
                }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListHeaderComponent={
                    items.length > 0 ? (
                        <View
                            style={[
                                styles.panelTop,
                                { backgroundColor: colors.primaryShade, borderColor: panelBorder },
                            ]}
                        >
                            <View style={[styles.panelIcon, { backgroundColor: colors.surface }]}>
                                <Lucide name="shopping-bag" size={18} color={config.THEME_COLOR} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <AppText label="Your cart" variant={1} fontSize={16} color={colors.text} />
                                <AppText
                                    label={`${totalItems} item${totalItems === 1 ? '' : 's'} ready for checkout`}
                                    fontSize={12}
                                    color={colors.textSecondary}
                                    style={{ marginTop: 1 }}
                                />
                            </View>
                            <AppText label={formatMoney(total)} variant={1} fontSize={16} color={config.THEME_COLOR} />
                        </View>
                    ) : null
                }
                renderItem={({ item, index }) => {
                    const isLast = index === items.length - 1;
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
                                styles.panelBody,
                                { backgroundColor: colors.primaryShade, borderColor: panelBorder },
                                isLast && styles.panelBottom,
                            ]}
                        >
                        <View
                            style={[
                                styles.card,
                                {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border,
                                },
                                isLast && { marginBottom: 0 },
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
                                        label={`${formatMoney(item.unit_price)} / ${formatUnit(1, unit)}`}
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
                        </View>
                    );
                }}
                ListEmptyComponent={() => (
                    <View style={{ paddingTop: 12 }}>
                        <View
                            style={[
                                styles.emptyCard,
                                {
                                    backgroundColor: colors.primaryShade,
                                    borderColor: `${config.THEME_COLOR}26`,
                                },
                            ]}
                        >
                            <View
                                pointerEvents="none"
                                style={[styles.emptyBlobLarge, { backgroundColor: `${config.THEME_COLOR}12` }]}
                            />
                            <View
                                pointerEvents="none"
                                style={[styles.emptyBlobSmall, { backgroundColor: `${config.THEME_COLOR}1A` }]}
                            />
                            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
                                <Lucide name="shopping-bag" size={30} color={config.THEME_COLOR} />
                                <View style={[styles.emptyBadge, { borderColor: colors.surface }]}>
                                    <AppText label="0" color="#fff" variant={1} fontSize={11} />
                                </View>
                            </View>
                            <AppText
                                label="Your cart is empty"
                                variant={1}
                                fontSize={19}
                                color={colors.text}
                                style={{ marginTop: 16 }}
                            />
                            <AppText
                                label="Add items from the store and they'll show up here, ready for checkout."
                                fontSize={13}
                                color={colors.textSecondary}
                                style={styles.emptySubtitle}
                            />
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => navigation.navigate('ForYou')}
                                style={[styles.browseBtn, { backgroundColor: config.THEME_COLOR }]}
                            >
                                <Lucide name="store" size={16} color="#fff" />
                                <AppText
                                    label="Start shopping"
                                    color="#fff"
                                    variant={1}
                                    fontSize={14}
                                    style={{ marginHorizontal: 8 }}
                                />
                                <Lucide name="arrow-right" size={16} color="#fff" />
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
            <ConfirmDialog
                visible={showClearConfirm}
                destructive
                icon="trash-2"
                title="Clear cart?"
                message={items.length === 1 ? 'Remove this item from your cart.' : `Remove all ${items.length} items from your cart.`}
                confirmLabel="Clear cart"
                onCancel={() => setShowClearConfirm(false)}
                onConfirm={() => {
                    setShowClearConfirm(false);
                    clearCart();
                }}
            />
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
    panelTop: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderBottomWidth: 0,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 12,
    },
    panelIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    panelBody: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        paddingHorizontal: 10,
    },
    panelBottom: {
        borderBottomWidth: 1,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        paddingBottom: 10,
        marginBottom: 12,
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
    emptyCard: {
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: 24,
        overflow: 'hidden',
    },
    emptyBlobLarge: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        top: -70,
        right: -60,
    },
    emptyBlobSmall: {
        position: 'absolute',
        width: 90,
        height: 90,
        borderRadius: 45,
        bottom: -30,
        left: -24,
    },
    emptyIcon: {
        width: 72,
        height: 72,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    emptyBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        backgroundColor: '#94a3b8',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    emptySubtitle: {
        marginTop: 6,
        textAlign: 'center',
        lineHeight: 19,
        paddingHorizontal: 12,
    },
    suggestHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    suggestIcon: {
        width: 30,
        height: 30,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    browseBtn: {
        marginTop: 18,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 999,
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
        borderRadius: 999,
    },
});

export default Cart;
