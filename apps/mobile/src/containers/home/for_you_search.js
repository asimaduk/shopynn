import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Keyboard,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { catalog } from '../../services/api';
import { addToCart, getCartItems, removeCartItem, subscribeCart } from '../../store/cartStore';
import { loadBrowseHistory, recordBrowseHistory } from '../../utils/forYouBrowseHistory';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 8;
const GRID_PAD = 12;
const CARD_W = (SCREEN_W - GRID_PAD * 2 - GRID_GAP) / 2;

const RECENT_KEY = (wh) => `SHOPYNN_FOR_YOU_RECENT_SEARCH_V1:${wh || 'all'}`;
const MAX_RECENT = 12;

const getProductImageUri = (item) =>
    item?.thumbnail || item?.picture1 || item?.picture2 || item?.image || item?.image_url || item?.photo || null;

const resolveImageUrl = (raw) => {
    if (!raw) return '';
    if (/^(https?:|data:|file:)/i.test(String(raw))) return String(raw);
    return `${config.BASE_API}/images?id=${encodeURIComponent(raw)}`;
};

const formatMoney = (n) => `GHS ${Number(n || 0).toFixed(2)}`;

const getSoldLabel = (product, index = 0) => {
    const soldRaw = Number(product?.sold_count || product?.sold || product?.orders_count || 0);
    if (soldRaw > 0) {
        if (soldRaw >= 1000) return `${(soldRaw / 1000).toFixed(1).replace('.0', '')}k sold`;
        return `${soldRaw} sold`;
    }
    return `${((index * 13) % 57) + 8} sold`;
};

const productMatchesQuery = (p, q) => {
    const needle = String(q || '')
        .trim()
        .toLowerCase();
    if (!needle) return true;
    const name = String(p?.name || '').toLowerCase();
    const sku = String(p?.sku || '').toLowerCase();
    const barCode = String(p?.bar_code || '').toLowerCase();
    const description = String(p?.description || '').toLowerCase();
    const category = String(p?.category_name || p?.product_type || '').toLowerCase();
    return (
        name.includes(needle) ||
        sku.includes(needle) ||
        barCode.includes(needle) ||
        description.includes(needle) ||
        category.includes(needle)
    );
};

const SORTS = [
    { id: 'relevance', label: 'Relevance' },
    { id: 'price_asc', label: 'Price ↑' },
    { id: 'price_desc', label: 'Price ↓' },
    { id: 'in_stock', label: 'In stock' },
];

const ForYouSearch = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { warehouseId } = route?.params || {};
    const inputRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [submittedQuery, setSubmittedQuery] = useState('');
    const [products, setProducts] = useState([]);
    const [recent, setRecent] = useState([]);
    const [history, setHistory] = useState([]);
    const [sortId, setSortId] = useState('relevance');
    const [cartItems, setCartItems] = useState(getCartItems());
    const [focused, setFocused] = useState(true);

    useEffect(() => subscribeCart(setCartItems), []);

    const loadLocal = useCallback(async () => {
        try {
            const [rRaw, hist] = await Promise.all([
                AsyncStorage.getItem(RECENT_KEY(warehouseId)),
                loadBrowseHistory(warehouseId),
            ]);
            const r = rRaw ? JSON.parse(rRaw) : [];
            setRecent(Array.isArray(r) ? r : []);
            setHistory(Array.isArray(hist) ? hist : []);
        } catch (_) {
            setRecent([]);
            setHistory([]);
        }
    }, [warehouseId]);

    useEffect(() => {
        loadLocal();
    }, [loadLocal]);

    // Refresh browsing history when returning from a product page.
    useEffect(() => {
        const unsub = navigation.addListener?.('focus', () => {
            loadBrowseHistory(warehouseId).then((hist) => {
                if (Array.isArray(hist)) setHistory(hist);
            });
        });
        return typeof unsub === 'function' ? unsub : undefined;
    }, [navigation, warehouseId]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (!warehouseId) return;
            setLoading(true);
            try {
                const res = await catalog.list(warehouseId);
                if (mounted) setProducts(Array.isArray(res) ? res : []);
            } catch (_) {
                if (mounted) setProducts([]);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => {
            mounted = false;
        };
    }, [warehouseId]);

    const persistRecent = async (next) => {
        setRecent(next);
        try {
            await AsyncStorage.setItem(RECENT_KEY(warehouseId), JSON.stringify(next));
        } catch (_) {
            /* ignore */
        }
    };

    const pushRecent = useCallback(
        async (term) => {
            const t = String(term || '').trim();
            if (!t) return;
            const next = [{ term: t, at: Date.now() }, ...recent.filter((r) => r.term.toLowerCase() !== t.toLowerCase())].slice(
                0,
                MAX_RECENT,
            );
            await persistRecent(next);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [recent, warehouseId],
    );

    const pushHistory = useCallback(
        async (product) => {
            const next = await recordBrowseHistory(warehouseId, product);
            if (Array.isArray(next)) setHistory(next);
        },
        [warehouseId],
    );

    const commitSearch = useCallback(
        async (term) => {
            const t = String(term ?? query).trim();
            setQuery(t);
            setSubmittedQuery(t);
            Keyboard.dismiss();
            if (t) await pushRecent(t);
        },
        [query, pushRecent],
    );

    const clearRecent = () => {
        persistRecent([]);
    };

    const suggestions = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const names = [];
        const seen = new Set();
        for (const p of products) {
            const name = String(p?.name || '').trim();
            if (!name) continue;
            const lower = name.toLowerCase();
            if (!lower.includes(q) && !String(p?.sku || '').toLowerCase().includes(q)) continue;
            const key = lower;
            if (seen.has(key)) continue;
            seen.add(key);
            names.push(name);
            if (names.length >= 10) break;
        }
        // Also suggest truncated query prefixes from catalog words
        return names;
    }, [products, query]);

    const popular = useMemo(() => {
        const ranked = [...products].sort(
            (a, b) =>
                Number(b?.sold_count || b?.sold || b?.orders_count || 0) -
                Number(a?.sold_count || a?.sold || a?.orders_count || 0),
        );
        return ranked.slice(0, 10).map((p) => ({
            term: p.name,
            thumbnail: getProductImageUri(p),
            hot: Number(p?.sold_count || p?.sold || p?.orders_count || 0) > 20,
            product: p,
        }));
    }, [products]);

    const resultList = useMemo(() => {
        const q = submittedQuery.trim();
        let list = products.filter((p) => productMatchesQuery(p, q));
        if (sortId === 'price_asc') {
            list = [...list].sort(
                (a, b) =>
                    Number(a.base_price_per_unit || a.unit_price || 0) -
                    Number(b.base_price_per_unit || b.unit_price || 0),
            );
        } else if (sortId === 'price_desc') {
            list = [...list].sort(
                (a, b) =>
                    Number(b.base_price_per_unit || b.unit_price || 0) -
                    Number(a.base_price_per_unit || a.unit_price || 0),
            );
        } else if (sortId === 'in_stock') {
            list = list.filter((p) => Number(p.quantity_available || 0) > 0);
        }
        return list;
    }, [products, submittedQuery, sortId]);

    const cartCount = useMemo(
        () => cartItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0),
        [cartItems],
    );

    const mode = useMemo(() => {
        if (submittedQuery.trim()) return 'results';
        if (query.trim() && focused) return 'suggest';
        return 'landing';
    }, [submittedQuery, query, focused]);

    const openProduct = async (product) => {
        await pushHistory(product);
        navigation.navigate('ForYouProductDetails', { product, warehouseId });
    };

    const isInCart = (product) => {
        const key = `${warehouseId}:${product.id}`;
        return cartItems.some((it) => it.key === key);
    };

    const toggleCart = (product) => {
        const key = `${warehouseId}:${product.id}`;
        if (isInCart(product)) {
            removeCartItem(key);
            return;
        }
        const stock = Number(product.quantity_available || 0);
        addToCart({
            warehouse_id: warehouseId,
            product_id: product.id,
            name: product.name,
            image_uri: getProductImageUri(product),
            measurement_unit: product.measurement_unit || 'unit',
            unit_price: Number(product.base_price_per_unit || product.unit_price || 0),
            quantity: Math.min(Number(product.min_order_qty || 1), stock > 0 ? stock : 1),
            available_quantity: stock,
            min_order_qty: Number(product.min_order_qty || 1),
            installment_enabled: Boolean(product.installment_enabled),
            installment_min_initial_percent: product.installment_min_initial_percent,
            installment_min_payment_amount: product.installment_min_payment_amount,
        });
    };

    const renderSearchBar = () => (
        <View style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
                <Lucide name="chevron-left" size={22} color={colors.text} />
            </TouchableOpacity>
            <View
                style={[
                    styles.searchWrap,
                    {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                    },
                ]}
            >
                <TextInput
                    ref={inputRef}
                    value={query}
                    onChangeText={(text) => {
                        setQuery(text);
                        if (submittedQuery) setSubmittedQuery('');
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onSubmitEditing={() => commitSearch(query)}
                    placeholder="Search products..."
                    placeholderTextColor={colors.placeholder}
                    style={[styles.searchInput, { color: colors.text }]}
                    returnKeyType="search"
                    autoFocus
                    autoCorrect={false}
                    autoCapitalize="none"
                />
                {!!query && (
                    <TouchableOpacity
                        onPress={() => {
                            setQuery('');
                            setSubmittedQuery('');
                            inputRef.current?.focus();
                        }}
                        style={styles.clearBtn}
                        hitSlop={8}
                    >
                        <View style={[styles.clearCircle, { backgroundColor: colors.border }]}>
                            <Lucide name="x" size={12} color={colors.text} />
                        </View>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    onPress={() => commitSearch(query)}
                    style={[styles.searchBtn, { backgroundColor: colors.textSecondary }]}
                    accessibilityLabel="Search"
                >
                    <Lucide name="search" size={16} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderChip = (item, key, onPress, { hot, thumb, circular } = {}) => {
        const uri = resolveImageUrl(thumb);
        return (
            <TouchableOpacity
                key={key}
                activeOpacity={0.85}
                onPress={onPress}
                style={[styles.chip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
                {uri ? (
                    <Image
                        source={{ uri }}
                        style={[styles.chipThumb, circular && styles.chipThumbRound]}
                        resizeMode="cover"
                    />
                ) : (
                    <View
                        style={[
                            styles.chipThumb,
                            circular && styles.chipThumbRound,
                            { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
                        ]}
                    >
                        <Lucide name="package" size={10} color={colors.textTertiary || colors.textSecondary} />
                    </View>
                )}
                <AppText
                    label={`${hot ? '🔥 ' : ''}${item}`}
                    fontSize={12}
                    color={colors.text}
                    numberOfLines={1}
                    style={{ maxWidth: 140 }}
                />
            </TouchableOpacity>
        );
    };

    const renderLanding = () => (
        <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.landingContent}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.sectionHead}>
                <AppText label="Recently searched" variant={1} fontSize={16} color={colors.text} />
                {recent.length > 0 ? (
                    <TouchableOpacity onPress={clearRecent} hitSlop={10}>
                        <Lucide name="trash-2" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                ) : null}
            </View>
            {recent.length > 0 ? (
                <View style={styles.chipWrap}>
                    {recent.map((r) =>
                        renderChip(r.term, `r-${r.term}`, () => {
                            setQuery(r.term);
                            commitSearch(r.term);
                        }),
                    )}
                </View>
            ) : (
                <AppText
                    label="Your recent searches will show up here."
                    fontSize={12}
                    color={colors.textSecondary}
                    style={{ marginBottom: 18 }}
                />
            )}

            <View style={[styles.sectionHead, { marginTop: 8 }]}>
                <AppText label="Popular right now" variant={1} fontSize={16} color={colors.text} />
            </View>
            {loading && !popular.length ? (
                <ActivityIndicator color={config.THEME_COLOR} style={{ marginVertical: 16 }} />
            ) : (
                <View style={styles.chipWrap}>
                    {popular.map((p, idx) =>
                        renderChip(
                            p.term,
                            `p-${idx}`,
                            () => {
                                setQuery(p.term);
                                commitSearch(p.term);
                            },
                            { hot: p.hot || idx < 2, thumb: p.thumbnail, circular: true },
                        ),
                    )}
                </View>
            )}

            <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.sectionHead, { marginTop: 10 }]}
                onPress={() => navigation.navigate('ForYouBrowseHistory', { warehouseId })}
            >
                <AppText label="Browsing history" variant={1} fontSize={16} color={colors.text} />
                <Lucide name="chevron-right" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            {history.length > 0 ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.historyRow}
                >
                    {history.map((h) => {
                        const uri = resolveImageUrl(h.thumbnail);
                        const name = h.name || h.product?.name || 'Product';
                        return (
                            <TouchableOpacity
                                key={`h-${h.id}`}
                                activeOpacity={0.88}
                                style={[styles.historyCard, { backgroundColor: colors.surface }]}
                                onPress={() => openProduct(h.product || h)}
                            >
                                <View style={[styles.historyImage, { backgroundColor: colors.surfaceSecondary }]}>
                                    {uri ? (
                                        <Image source={{ uri }} style={styles.historyImg} resizeMode="cover" />
                                    ) : (
                                        <Lucide name="package" size={20} color={colors.textTertiary || colors.textSecondary} />
                                    )}
                                </View>
                                <AppText
                                    label={name}
                                    fontSize={12}
                                    color={colors.text}
                                    numberOfLines={1}
                                    style={{ marginTop: 8 }}
                                />
                                <AppText
                                    label={formatMoney(h.unit_price)}
                                    variant={1}
                                    fontSize={13}
                                    color={colors.text}
                                    style={{ marginTop: 4 }}
                                />
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            ) : (
                <AppText
                    label="Products you open will appear here."
                    fontSize={12}
                    color={colors.textSecondary}
                />
            )}
        </ScrollView>
    );

    const renderSuggest = () => (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
            {suggestions.length === 0 ? (
                <TouchableOpacity
                    style={[styles.suggestRow, { borderBottomColor: colors.border }]}
                    onPress={() => commitSearch(query)}
                >
                    <Lucide name="search" size={16} color={colors.textSecondary} />
                    <AppText
                        label={`Search “${query.trim()}”`}
                        color={colors.text}
                        style={{ marginLeft: 12, flex: 1 }}
                        numberOfLines={1}
                    />
                </TouchableOpacity>
            ) : (
                suggestions.map((name) => (
                    <TouchableOpacity
                        key={name}
                        style={[styles.suggestRow, { borderBottomColor: colors.border }]}
                        onPress={() => {
                            setQuery(name);
                            commitSearch(name);
                        }}
                    >
                        <Lucide name="search" size={16} color={colors.textSecondary} />
                        <AppText label={name} color={colors.text} style={{ marginLeft: 12, flex: 1 }} numberOfLines={1} />
                        <Lucide name="arrow-up-left" size={14} color={colors.textTertiary || colors.textSecondary} />
                    </TouchableOpacity>
                ))
            )}
        </ScrollView>
    );

    const renderResults = () => (
        <View style={{ flex: 1 }}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                style={{ flexGrow: 0 }}
            >
                {SORTS.map((s) => {
                    const active = sortId === s.id;
                    return (
                        <TouchableOpacity
                            key={s.id}
                            onPress={() => setSortId(s.id)}
                            style={[
                                styles.filterChip,
                                {
                                    backgroundColor: active ? config.THEME_COLOR : colors.surface,
                                    borderColor: active ? config.THEME_COLOR : colors.border,
                                },
                            ]}
                        >
                            <AppText
                                label={s.label}
                                fontSize={12}
                                variant={active ? 1 : 0}
                                color={active ? '#fff' : colors.text}
                            />
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={config.THEME_COLOR} />
                </View>
            ) : resultList.length === 0 ? (
                <View style={styles.emptyWrap}>
                    <Lucide name="search-x" size={32} color={colors.border} />
                    <AppText label="No products found" color={colors.textSecondary} style={{ marginTop: 8 }} />
                    <AppText
                        label="Try another name, SKU, or browse popular picks."
                        fontSize={12}
                        color={colors.textTertiary || colors.textSecondary}
                        style={{ marginTop: 4, textAlign: 'center', paddingHorizontal: 24 }}
                    />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.gridContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <AppText
                        label={`${resultList.length} result${resultList.length === 1 ? '' : 's'} for “${submittedQuery}”`}
                        fontSize={12}
                        color={colors.textSecondary}
                        style={{ marginBottom: 10, width: '100%' }}
                    />
                    <View style={styles.grid}>
                        {resultList.map((item, index) => {
                            const uri = resolveImageUrl(getProductImageUri(item));
                            const inCart = isInCart(item);
                            const inStock = Number(item.quantity_available || 0) > 0;
                            return (
                                <TouchableOpacity
                                    key={String(item.id)}
                                    activeOpacity={0.9}
                                    style={[styles.card, { backgroundColor: colors.surface }]}
                                    onPress={() => openProduct(item)}
                                >
                                    <View style={[styles.cardImage, { backgroundColor: colors.surfaceSecondary }]}>
                                        {uri ? (
                                            <Image source={{ uri }} style={styles.cardImg} resizeMode="cover" />
                                        ) : (
                                            <Lucide
                                                name="package"
                                                size={28}
                                                color={colors.textTertiary || colors.textSecondary}
                                            />
                                        )}
                                    </View>
                                    <View style={styles.cardBody}>
                                        <AppText
                                            label={item.name || 'Product'}
                                            fontSize={13}
                                            color={colors.text}
                                            numberOfLines={2}
                                            variant={1}
                                        />
                                        <AppText
                                            label={inStock ? 'In stock' : 'Out of stock'}
                                            fontSize={11}
                                            color={inStock ? '#16A34A' : '#DC2626'}
                                            style={{ marginTop: 4 }}
                                        />
                                        <View style={styles.cardFooter}>
                                            <View style={{ flex: 1 }}>
                                                <AppText
                                                    label={formatMoney(item.base_price_per_unit || item.unit_price)}
                                                    variant={1}
                                                    fontSize={15}
                                                    color={config.THEME_COLOR}
                                                />
                                                <AppText
                                                    label={getSoldLabel(item, index)}
                                                    fontSize={11}
                                                    color={colors.textSecondary}
                                                    style={{ marginTop: 2 }}
                                                />
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => toggleCart(item)}
                                                disabled={!inStock && !inCart}
                                                style={[
                                                    styles.addBtn,
                                                    {
                                                        backgroundColor: inCart
                                                            ? config.THEME_COLOR
                                                            : colors.surfaceSecondary,
                                                        opacity: !inStock && !inCart ? 0.4 : 1,
                                                    },
                                                ]}
                                            >
                                                <Lucide
                                                    name={inCart ? 'check' : 'shopping-cart'}
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
                </ScrollView>
            )}

            {cartCount > 0 ? (
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => navigation.navigate('Home', { screen: 'Cart' })}
                    style={[styles.cartFab, { backgroundColor: config.THEME_COLOR }]}
                >
                    <Lucide name="shopping-cart" size={20} color="#fff" />
                    <View style={styles.cartBadge}>
                        <AppText
                            label={cartCount > 99 ? '99+' : String(cartCount)}
                            fontSize={10}
                            color="#fff"
                            variant={1}
                        />
                    </View>
                    <AppText label="Cart" fontSize={11} color="#fff" variant={1} style={{ marginTop: 2 }} />
                </TouchableOpacity>
            ) : null}
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            {renderSearchBar()}
            {mode === 'landing' ? renderLanding() : null}
            {mode === 'suggest' ? renderSuggest() : null}
            {mode === 'results' ? renderResults() : null}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    topBar: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 6,
    },
    searchWrap: {
        flex: 1,
        height: 42,
        borderRadius: 999,
        paddingLeft: 14,
        paddingRight: 4,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'FiraSans-Regular',
        paddingVertical: 0,
        marginRight: 4,
    },
    clearBtn: { paddingHorizontal: 2 },
    clearCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    landingContent: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 40 },
    sectionHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 18,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 8,
        gap: 6,
    },
    chipThumb: { width: 22, height: 22, borderRadius: 4 },
    chipThumbRound: { borderRadius: 11 },
    historyRow: { paddingRight: 12, gap: 12, paddingBottom: 4 },
    historyCard: {
        width: 120,
        padding: 10,
        borderRadius: 12,
    },
    historyImage: {
        width: '100%',
        height: 100,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    historyImg: { width: '100%', height: '100%' },
    suggestRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    filterRow: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        alignItems: 'center',
    },
    filterChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyWrap: { marginTop: 80, alignItems: 'center', paddingHorizontal: 20 },
    gridContent: { paddingHorizontal: GRID_PAD, paddingBottom: 100 },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    card: {
        width: CARD_W,
        marginBottom: GRID_GAP + 4,
        borderRadius: 10,
        overflow: 'hidden',
    },
    cardImage: {
        width: '100%',
        height: CARD_W * 0.95,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardImg: { width: '100%', height: '100%' },
    cardBody: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 10 },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginTop: 8,
    },
    addBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartFab: {
        position: 'absolute',
        right: 16,
        bottom: 24,
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
    },
    cartBadge: {
        position: 'absolute',
        top: 6,
        right: 10,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
});

export default ForYouSearch;
