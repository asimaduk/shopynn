import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Image, Modal, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { addToCart, clearCart, getCartItems, removeCartItem, subscribeCart, updateCartItemQty } from '../../store/cartStore';
import { catalog } from '../../services/api';

const { width } = Dimensions.get('window');
const CAROUSEL_WIDTH = width;
const CAROUSEL_HEIGHT = Math.round(CAROUSEL_WIDTH * 0.78) + 50;

const pickImageUris = (product) => {
    const refs = [
        product?.thumbnail,
        product?.picture1,
        product?.picture2,
        product?.picture3,
        product?.picture4
    ].filter(Boolean);
    const seen = new Set();
    return refs.filter((r) => {
        const k = String(r);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
};

const resolveImageUri = (uri) => {
    const raw = String(uri || '').trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
        return raw;
    }
    return `${config.BASE_API}/images?id=${encodeURIComponent(raw)}`;
};

const ForYouProductDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { product, warehouseId } = route?.params || {};
    const [index, setIndex] = useState(0);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [fullProduct, setFullProduct] = useState(null);
    const [relatedLoading, setRelatedLoading] = useState(false);
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [cartItems, setCartItems] = useState(getCartItems());
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const actionAnim = useMemo(() => new Animated.Value(0), []);
    const toastAnim = useMemo(() => new Animated.Value(0), []);

    useFocusEffect(
        React.useCallback(() => {
            if (Platform.OS === 'android') {
                StatusBar.setTranslucent(true);
                StatusBar.setBackgroundColor('transparent');
            }
            StatusBar.setBarStyle('light-content');
        }, [])
    );

    useEffect(() => {
        const unsub = subscribeCart(setCartItems);
        return unsub;
    }, []);

    useEffect(() => {
        let mounted = true;
        const loadDetails = async () => {
            if (!product?.id || !warehouseId) return;
            setDetailsLoading(true);
            try {
                const res = await catalog.get(product.id, warehouseId);
                console.log('res', res);
                if (mounted && res) setFullProduct(res);
            } catch (_) {
                // Keep lightweight route payload as fallback.
            } finally {
                if (mounted) setDetailsLoading(false);
            }
        };
        loadDetails();
        return () => {
            mounted = false;
        };
    }, [product?.id, warehouseId]);

    const currentProduct = fullProduct || product || {};
    const getProductImageUri = (item) =>
        item?.thumbnail || item?.picture1 || item?.picture2 || item?.picture3 || item?.picture4 || item?.image || item?.image_url || item?.photo || null;
    const images = useMemo(() => pickImageUris(currentProduct), [currentProduct]);
    const price = Number(currentProduct?.base_price_per_unit || currentProduct?.unit_price || 0);
    const stock = Number(currentProduct?.quantity_available || 0);
    const isInStock = stock > 0;
    const unit = currentProduct?.measurement_unit || 'unit';
    const allowsFractional = Boolean(currentProduct?.allows_fractional_qty);
    const minQty = Number(currentProduct?.min_order_qty || 1);
    const qtyStep = Number(currentProduct?.qty_step || 1);
    const stepValue = qtyStep > 0 ? qtyStep : 1;
    const cartKey = `${warehouseId}:${currentProduct?.id}`;
    const cartEntry = cartItems.find((item) => String(item?.key) === String(cartKey));
    const quantityInCart = Number(cartEntry?.quantity || 0);
    const isInCart = quantityInCart > 0;

    console.log('images', images);
    
    useEffect(() => {
        Animated.timing(actionAnim, {
            toValue: isInCart ? 1 : 0,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [isInCart, actionAnim]);

    useEffect(() => {
        let mounted = true;
        const loadRelated = async () => {
            if (!warehouseId || !currentProduct?.id) return;
            setRelatedLoading(true);
            try {
                const list = await catalog.list(warehouseId);
                const all = Array.isArray(list) ? list : [];
                const others = all.filter((p) => String(p?.id) !== String(currentProduct.id));
                const sameType = others.filter((p) => String(p?.product_type || '') === String(currentProduct?.product_type || ''));
                const fallback = others.filter((p) => !sameType.some((m) => String(m?.id) === String(p?.id)));
                const picked = [...sameType, ...fallback].slice(0, 6);
                if (mounted) setRelatedProducts(picked);
            } catch (_) {
                if (mounted) setRelatedProducts([]);
            } finally {
                if (mounted) setRelatedLoading(false);
            }
        };
        loadRelated();
        return () => {
            mounted = false;
        };
    }, [warehouseId, currentProduct?.id, currentProduct?.product_type]);

    const onScroll = (e) => {
        const offsetX = e.nativeEvent.contentOffset.x;
        const nextIndex = Math.round(offsetX / CAROUSEL_WIDTH);
        setIndex(nextIndex);
    };

    const onViewerScroll = (e) => {
        const offsetX = e.nativeEvent.contentOffset.x;
        const nextIndex = Math.round(offsetX / width);
        setViewerIndex(nextIndex);
    };

    const goToCart = () => {
        // Cart is a tab under the Home navigator.
        navigation.navigate('Home', { screen: 'Cart' });
    };

    const showToast = (message) => {
        setToastMessage(message);
        setToastVisible(true);
        Animated.sequence([
            Animated.timing(toastAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.delay(1300),
            Animated.timing(toastAnim, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }),
        ]).start(() => setToastVisible(false));
    };

    const handleAddToCart = () => {
        if (!isInStock) return;
        const initialQty = Math.min(Number(currentProduct?.min_order_qty || 1), stock);
        if (initialQty <= 0) return;
        addToCart({
            warehouse_id: warehouseId,
            product_id: currentProduct?.id,
            name: currentProduct?.name,
            image_uri: images[0] || null,
            measurement_unit: unit,
            unit_price: price,
            quantity: initialQty,
            available_quantity: stock,
            installment_enabled: Boolean(currentProduct?.installment_enabled),
            installment_min_initial_percent: currentProduct?.installment_min_initial_percent,
            installment_min_payment_amount: currentProduct?.installment_min_payment_amount,
        });
        showToast(`${currentProduct?.name || 'Product'} added to cart`);
    };

    const handleIncreaseQty = () => {
        if (!isInCart) return;
        if (stock <= 0) {
            showToast('Out of stock');
            return;
        }
        if (quantityInCart >= stock) {
            showToast(`Maximum available is ${stock}`);
            return;
        }
        const nextQty = Math.min(Number(quantityInCart + stepValue), stock);
        if (nextQty !== Number(quantityInCart + stepValue)) {
            showToast(`Maximum available is ${stock}`);
        }
        updateCartItemQty(cartKey, nextQty);
    };

    const handleDecreaseQty = () => {
        if (!isInCart) return;
        const next = Number(quantityInCart - stepValue);
        if (next <= 0) {
            removeCartItem(cartKey);
            showToast('Removed from cart');
            return;
        }
        updateCartItemQty(cartKey, next);
    };

    return (
        <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={[styles.card, { backgroundColor: colors.background }]}>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        style={styles.carousel}
                    >
                        {images.length > 0 ? (
                            images.map((uri, i) => (
                                <TouchableOpacity
                                    key={`${uri}-${i}`}
                                    activeOpacity={0.95}
                                    onPress={() => {
                                        setViewerIndex(i);
                                        setViewerVisible(true);
                                    }}
                                >
                                    <Image source={{ uri: resolveImageUri(uri) }} style={styles.carouselImage} resizeMode="cover" />
                                    
                                    <View style={styles.heroOverlay} />
                                    
                                    {images.length > 1 && (
                                        <View style={styles.dots}>
                                            {images.map((_, i) => (
                                                <View
                                                    key={i}
                                                    style={[
                                                        styles.dot,
                                                        {
                                                            backgroundColor: i === index ? config.THEME_COLOR : colors.border,
                                                            width: i === index ? 18 : 6,
                                                        },
                                                    ]}
                                                />
                                            ))}
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={[styles.carouselImage, styles.placeholder, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="image" size={28} color={colors.textTertiary} />
                                <View style={styles.heroOverlay} />
                            </View>
                        )}
                    </ScrollView>
                    
                    <View style={[styles.heroActions, { top: insets.top + 8 }]}>
                        <TouchableOpacity style={styles.heroIconBtn} onPress={() => navigation.goBack()}>
                            <Lucide name="chevron-left" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.heroIconBtn} onPress={() => navigation.navigate('ForYouSearch', { warehouseId })}>
                            <Lucide name="search" size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    

                    <View style={styles.locationRow}>
                        <Lucide name="map-pin" size={14} color={colors.textSecondary} />
                        <AppText
                            label={currentProduct?.warehouse_name || `Warehouse ${warehouseId || ''}`.trim()}
                            color={colors.textSecondary}
                            fontSize={12}
                            style={{ marginLeft: 6 }}
                            numberOfLines={1}
                        />
                    </View>

                    <View style={styles.detailsContent}>
                        <AppText label={currentProduct?.name || 'Product'} variant={1} fontSize={20} color={colors.text} style={{ marginTop: 10 }} />
                        
                        <AppText
                            label={stock > 0 ? 'In stock' : 'Out of stock'}
                            color={stock > 0 ? '#16A34A' : '#DC2626'}
                            style={{ marginTop: 4 }}
                        />
                        <AppText label={`GHS ${price.toFixed(2)}`} fontSize={22} variant={1} color={config.THEME_COLOR} style={{ marginTop: 8 }} />
                        {currentProduct?.installment_enabled ? (
                            <View style={[styles.installmentBanner, { backgroundColor: '#EDE9FE', borderColor: '#C4B5FD' }]}>
                                <Lucide name="wallet" size={14} color="#7C3AED" />
                                <AppText
                                    label="Pay over time — pay any amount until fully paid. Pickup/delivery after balance is cleared."
                                    fontSize={12}
                                    color="#5B21B6"
                                    style={{ flex: 1, marginLeft: 8 }}
                                />
                            </View>
                        ) : null}
                        {detailsLoading && (
                            <View style={styles.loadingRow}>
                                <ActivityIndicator size="small" color={config.THEME_COLOR} />
                                <AppText label="Loading product details..." color={colors.textSecondary} style={{ marginLeft: 8 }} />
                            </View>
                        )}

                        {!!currentProduct?.description && (
                            <View style={[styles.descBox, { backgroundColor: colors.surfaceSecondary }]}>
                                <AppText label={String(currentProduct.description)} color={colors.textSecondary} />
                            </View>
                        )}

                        <View style={[styles.aboutCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <AppText label="About this product" variant={1} fontSize={15} color={colors.text} style={{ marginBottom: 8 }} />
                            <View style={styles.aboutRow}>
                                <AppText label="Category" color={colors.textSecondary} fontSize={13} />
                                <AppText label={String(currentProduct?.category_name || 'General')} color={colors.text} fontSize={13} />
                            </View>
                            <View style={styles.aboutRow}>
                                <AppText label="Minimum order" color={colors.textSecondary} fontSize={13} />
                                <AppText label={`${minQty} ${unit}`} color={colors.text} fontSize={13} />
                            </View>
                            <View style={styles.aboutRow}>
                                <AppText label="Brand" color={colors.textSecondary} fontSize={13} />
                                <AppText label={String(currentProduct?.brand || 'General')} color={colors.text} fontSize={13} />
                            </View>
                            {/* <View style={styles.aboutRow}>
                                <AppText label="Quantity step" color={colors.textSecondary} fontSize={13} />
                                <AppText label={`${qtyStep} ${unit}`} color={colors.text} fontSize={13} />
                            </View> */}
                            {/* <View style={styles.aboutRow}>
                                <AppText label="Fractional quantity" color={colors.textSecondary} fontSize={13} />
                                <AppText label={allowsFractional ? 'Supported' : 'Whole numbers only'} color={colors.text} fontSize={13} />
                            </View> */}
                        </View>

                        <View style={styles.actionSection}>
                            <Animated.View
                                pointerEvents={isInCart ? 'none' : 'auto'}
                                style={[
                                    styles.addBtnWrap,
                                    {
                                        opacity: actionAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                                        transform: [
                                            {
                                                translateY: actionAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }),
                                            },
                                        ],
                                    },
                                ]}
                            >
                                <TouchableOpacity
                                    disabled={!isInStock}
                                    onPress={handleAddToCart}
                                    style={[
                                        styles.addBtn,
                                        { backgroundColor: isInStock ? config.THEME_COLOR : colors.border, opacity: isInStock ? 1 : 0.65 },
                                    ]}
                                >
                                    <Lucide name="shopping-cart" size={16} color="#fff" />
                                    <AppText label={isInStock ? 'Add to cart' : 'Out of stock'} color="#fff" variant={1} style={{ marginLeft: 8 }} />
                                </TouchableOpacity>
                            </Animated.View>

                            <Animated.View
                                pointerEvents={isInCart ? 'auto' : 'none'}
                                style={[
                                    styles.cartControlsWrap,
                                    {
                                        opacity: actionAnim,
                                        transform: [
                                            {
                                                translateY: actionAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
                                            },
                                        ],
                                    },
                                ]}
                            >
                                <View style={[styles.qtyPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                    <TouchableOpacity style={styles.qtyBtn} onPress={handleDecreaseQty}>
                                        <Lucide name="minus" size={15} color={colors.text} />
                                    </TouchableOpacity>
                                    <AppText label={`${quantityInCart}`} variant={1} color={colors.text} style={{ minWidth: 30, textAlign: 'center' }} />
                                    <TouchableOpacity style={styles.qtyBtn} onPress={handleIncreaseQty} disabled={!isInStock}>
                                        <Lucide name="plus" size={15} color={isInStock ? colors.text : colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity style={[styles.goToCartBtn, { backgroundColor: config.THEME_COLOR }]} onPress={goToCart}>
                                    <AppText label="Go to cart" color="#fff" variant={1} style={{ marginRight: 6 }} />
                                    <Lucide name="arrow-right" size={16} color="#fff" />
                                </TouchableOpacity>
                            </Animated.View>
                        </View>
                        <TouchableOpacity
                            disabled={!isInStock}
                            onPress={() => {
                                if (!isInStock) return;
                                clearCart();
                                addToCart({
                                    warehouse_id: warehouseId,
                                    product_id: currentProduct?.id,
                                    name: currentProduct?.name,
                                    image_uri: images[0] || null,
                                    measurement_unit: unit,
                                    unit_price: price,
                                    quantity: Math.min(Number(currentProduct?.min_order_qty || 1), stock),
                                    available_quantity: stock,
                                    installment_enabled: Boolean(currentProduct?.installment_enabled),
                                    installment_min_initial_percent: currentProduct?.installment_min_initial_percent,
                                    installment_min_payment_amount: currentProduct?.installment_min_payment_amount,
                                });
                                navigation.navigate('Checkout');
                            }}
                            style={[
                                styles.buyBtn,
                                {
                                    borderColor: isInStock ? config.THEME_COLOR : colors.border,
                                    opacity: isInStock ? 1 : 0.65,
                                },
                            ]}
                        >
                            <Lucide name="zap" size={16} color={isInStock ? config.THEME_COLOR : colors.textSecondary} />
                            <AppText
                                label={isInStock ? 'Buy now' : 'Unavailable'}
                                color={isInStock ? config.THEME_COLOR : colors.textSecondary}
                                variant={1}
                                style={{ marginLeft: 8 }}
                            />
                        </TouchableOpacity>

                        <View style={styles.relatedWrap}>
                            <AppText label="Related products" variant={1} fontSize={16} color={colors.text} />
                            {relatedLoading ? (
                                <View style={styles.loadingRow}>
                                    <ActivityIndicator size="small" color={config.THEME_COLOR} />
                                    <AppText label="Loading related products..." color={colors.textSecondary} style={{ marginLeft: 8 }} />
                                </View>
                            ) : relatedProducts.length > 0 ? (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.relatedList}
                                >
                                    {relatedProducts.map((item) => (
                                        <TouchableOpacity
                                            key={String(item.id)}
                                            style={[styles.relatedCard, { backgroundColor: colors.surfaceSecondary }]}
                                            activeOpacity={0.88}
                                            onPress={() =>
                                                navigation.push('ForYouProductDetails', {
                                                    product: item,
                                                    warehouseId,
                                                })
                                            }
                                        >
                                            {getProductImageUri(item) ? (
                                                <Image
                                                    source={{ uri: config.BASE_API + '/images?id=' + getProductImageUri(item) }}
                                                    style={styles.relatedImage}
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <View style={[styles.relatedImage, styles.placeholder, { backgroundColor: colors.border }]}>
                                                    <Lucide name="image" size={18} color={colors.textTertiary} />
                                                </View>
                                            )}
                                            <AppText
                                                label={item?.name || 'Product'}
                                                fontSize={12}
                                                color={colors.text}
                                                numberOfLines={2}
                                                style={{ marginTop: 8 }}
                                            />
                                            <AppText
                                                label={`GHS ${Number(item?.base_price_per_unit || item?.unit_price || 0).toFixed(2)}`}
                                                fontSize={12}
                                                color={config.THEME_COLOR}
                                                style={{ marginTop: 4 }}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            ) : (
                                <AppText label="No related products yet." color={colors.textSecondary} style={{ marginTop: 8 }} />
                            )}
                        </View>
                    </View>
                </View>
            </ScrollView>
            <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
                <View style={styles.viewerBackdrop}>
                    <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setViewerVisible(false)}>
                        <Lucide name="x" size={22} color="#fff" />
                    </TouchableOpacity>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        contentOffset={{ x: width * viewerIndex, y: 0 }}
                        onScroll={onViewerScroll}
                        scrollEventThrottle={16}
                    >
                        {images.map((uri, i) => (
                            <View key={`viewer-${uri}-${i}`} style={styles.viewerSlide}>
                                <ScrollView
                                    style={styles.viewerZoomWrap}
                                    contentContainerStyle={styles.viewerZoomContent}
                                    minimumZoomScale={1}
                                    maximumZoomScale={4}
                                    pinchGestureEnabled
                                    showsHorizontalScrollIndicator={false}
                                    showsVerticalScrollIndicator={false}
                                    bouncesZoom
                                    centerContent
                                >
                                    <Image
                                        source={{ uri: resolveImageUri(uri) }}
                                        style={styles.viewerImage}
                                        resizeMode="contain"
                                    />
                                </ScrollView>
                            </View>
                        ))}
                    </ScrollView>
                    {images.length > 1 && (
                        <View style={styles.viewerDots}>
                            {images.map((_, i) => (
                                <View
                                    key={`dot-${i}`}
                                    style={[
                                        styles.dot,
                                        {
                                            backgroundColor: i === viewerIndex ? '#fff' : 'rgba(255,255,255,0.45)',
                                            width: i === viewerIndex ? 18 : 6,
                                        },
                                    ]}
                                />
                            ))}
                        </View>
                    )}
                </View>
            </Modal>
            {toastVisible && (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.toast,
                        {
                            opacity: toastAnim,
                            transform: [
                                {
                                    translateY: toastAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [18, 0],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <Lucide name="circle-check" size={16} color="#fff" />
                    <AppText label={toastMessage} color="#fff" fontSize={12} style={{ marginLeft: 8 }} />
                </Animated.View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    card: { borderWidth: 0, borderRadius: 0, padding: 0 },
    carousel: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden' },
    carouselImage: { width: CAROUSEL_WIDTH, height: CAROUSEL_HEIGHT },
    placeholder: { alignItems: 'center', justifyContent: 'center' },
    dots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, zIndex: 5 },
    dot: { height: 6, borderRadius: 3 },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        height: CAROUSEL_HEIGHT,
        backgroundColor: '#000',
        opacity: 0.05,
        zIndex: 2,
    },
    heroActions: {
        position: 'absolute',
        top: 14,
        left: 12,
        right: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 6,
    },
    heroIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    detailsContent: {
        paddingHorizontal: 12,
    },
    locationRow: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    loadingRow: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    descBox: { marginTop: 12, borderRadius: 5, padding: 10 },
    installmentBanner: {
        marginTop: 10,
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    aboutCard: { marginTop: 10, borderRadius: 5, padding: 10, borderWidth: 1 },
    aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    actionSection: {
        marginTop: 16,
        minHeight: 48,
        justifyContent: 'center',
    },
    addBtnWrap: {
        width: '100%',
    },
    cartControlsWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    qtyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 4,
        height: 42,
    },
    qtyBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    goToCartBtn: {
        flex: 1,
        marginLeft: 12,
        height: 42,
        borderRadius: 999,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    addBtn: { marginTop: 0, borderRadius: 999, height: 46, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
    buyBtn: { marginTop: 10, borderRadius: 999, height: 46, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderWidth: 1.3, },
    viewerBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.94)',
        justifyContent: 'center',
    },
    viewerCloseBtn: {
        position: 'absolute',
        top: 56,
        right: 20,
        zIndex: 5,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    viewerSlide: {
        width,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 18,
    },
    viewerImage: {
        width: width - 20,
        height: '80%'
    },
    viewerZoomWrap: {
        width: width - 20,
        height: '80%',
    },
    viewerZoomContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewerDots: {
        position: 'absolute',
        bottom: 44,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    relatedWrap: {
        marginTop: 16,
        marginBottom: 6,
    },
    relatedList: {
        paddingTop: 10,
        paddingRight: 8,
    },
    relatedCard: {
        width: 136,
        borderRadius: 10,
        padding: 8,
        marginRight: 10,
    },
    relatedImage: {
        width: '100%',
        height: 96,
        borderRadius: 8,
    },
    toast: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 24,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: 'rgba(22, 163, 74, 0.95)',
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default ForYouProductDetails;
