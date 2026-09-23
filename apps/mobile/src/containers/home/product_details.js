import React, { useState, useEffect, useCallback } from 'react';
import {
    Image,
    TouchableOpacity,
    ScrollView,
    View,
    ActivityIndicator,
    useWindowDimensions,
    Alert,
    Linking,
    Share,
    Modal,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { products as productsApi, warehouses as warehousesApi } from '../../services/api';
import { normalizeProduct } from '../../utils/normalizeProduct';
import { formatQuantity } from '../../utils/format';
import { getScreenPlanAccess, canManageCustomerSignupCodes } from '../../utils/permissions';
import { buildWhatsAppUrl } from '../../utils/invoice';
import { storefrontProductUrl, storefrontShareMessage } from '../../utils/storefrontLinks';

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});

/** API stores image ids; full URLs are served from /images?id= */
const resolveProductImageUri = (ref) => {
    if (ref == null || ref === '') return null;
    const s = String(ref).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    return `${config.BASE_API}/images?id=${encodeURIComponent(s)}`;
};

const ProductDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { width } = useWindowDimensions();
    const user = useSelector(({ user }) => user);
    const currentUser = user?.data || user;
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const adjustAccess = getScreenPlanAccess(user, 'NewAdjustments', subscriptionFeatures);
    const canShareOrderLink = canManageCustomerSignupCodes(currentUser, subscriptionFeatures);
    const { product: paramProduct, productId } = route.params || {};
    const [product, setProduct] = useState(() => normalizeProduct(paramProduct || {}));
    const [loading, setLoading] = useState(!!(productId || paramProduct?.id));
    const [sharing, setSharing] = useState(false);
    const [shareStores, setShareStores] = useState(null); // null | warehouse[]
    const sharePickResolveRef = React.useRef(null);

    const loadProduct = useCallback(() => {
        const id = productId || paramProduct?.id;
        if (!id) return;
        setLoading(true);
        productsApi
            .get(id)
            .then((data) => {
                if (data) setProduct((prev) => normalizeProduct({ ...prev, ...data }));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [productId, paramProduct?.id]);

    useFocusEffect(
        useCallback(() => {
            loadProduct();
        }, [loadProduct])
    );

    const name = product.name || '';
    const sku = product.sku || '';
    const price = Number(product.unit_price) || 0;
    const altPrice = Number(product.alt_price) || 0;
    const actualCost =
        product.actual_cost != null && product.actual_cost !== ''
            ? Number(product.actual_cost)
            : null;
    const totalQty = Number(product.inventory ?? product.initial_stock) || 0;
    const reorderLevel = Number(product.reorder_quantity) || 0;
    const batchNumber = product.batch_number || '';
    const expiryDate = product.expiry_date || '';
    const tagList = Array.isArray(product.tags) ? product.tags : (product.tags ? String(product.tags).split(',').map((t) => t.trim()).filter(Boolean) : []);

    const categoryNames =
        Array.isArray(product.category_names) && product.category_names.length > 0
            ? product.category_names
            : Array.isArray(product.categories)
                ? product.categories.map((c) => c?.name).filter(Boolean)
                : [];
    const storesQuantities = product.stores_quantities || [];
    const galleryRefs = (() => {
        const refs = [
            product.thumbnail,
            product.picture1,
            product.picture2,
            product.picture3,
            product.picture4,
        ].filter(Boolean);
        const seen = new Set();
        return refs.filter((r) => {
            const k = String(r);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    })();
    const [activeImage, setActiveImage] = useState(null);
    const isActive = product.is_active === true;
    const isLowStock = reorderLevel > 0 && totalQty <= reorderLevel;
    const formatGhs = (amount) => formatter.format(amount).replace('GH₵', 'GHS ');
    const priceStr = formatGhs(price);
    const altPriceStr = altPrice > 0 ? formatGhs(altPrice) : '—';
    const costStr =
        actualCost != null && Number.isFinite(actualCost) ? formatGhs(actualCost) : '—';
    const mainImageRef = activeImage ?? galleryRefs[0] ?? null;
    const mainImageUri = mainImageRef ? resolveProductImageUri(mainImageRef) : null;

    useEffect(() => {
        setActiveImage(null);
    }, [product.id]);

    const backPress = () => navigation.goBack();

    const resolveStoreCodeForShare = async () => {
        const list = await warehousesApi.list();
        const rows = Array.isArray(list) ? list : list?.warehouses || list?.data || [];
        const userWh = currentUser?.warehouse_id;
        const withCode = rows.filter((w) => String(w?.reference_code || '').trim());
        if (!withCode.length) return null;
        if (withCode.length === 1) return withCode[0].reference_code;

        const userMatch = userWh
            ? withCode.find((w) => String(w.id) === String(userWh))
            : null;
        const storesQty = product.stores_quantities || [];
        const stocked = withCode.filter((w) =>
            storesQty.some(
                (s) =>
                    String(s?.warehouse_id) === String(w.id) &&
                    Number(s?.quantity_available ?? 0) > 0
            )
        );
        const preferred = userMatch
            ? [userMatch, ...withCode.filter((w) => w.id !== userMatch.id)]
            : stocked.length
              ? [...stocked, ...withCode.filter((w) => !stocked.some((s) => s.id === w.id))]
              : withCode;

        return new Promise((resolve) => {
            sharePickResolveRef.current = resolve;
            setShareStores(preferred);
        });
    };

    const finishShareStorePick = (code) => {
        const resolve = sharePickResolveRef.current;
        sharePickResolveRef.current = null;
        setShareStores(null);
        resolve?.(code || null);
    };

    const shareProductLink = async () => {
        if (!canShareOrderLink || sharing) return;
        const id = product.id || productId;
        if (!id) return;
        setSharing(true);
        try {
            const code = await resolveStoreCodeForShare();
            if (!code) {
                Alert.alert(
                    'Store code needed',
                    'Set a customer signup code on your store (Scale) before sharing a product order link.'
                );
                return;
            }
            const url = storefrontProductUrl(code, product.slug || id);
            const message = storefrontShareMessage({
                storeName: currentUser?.company?.name || currentUser?.companyName,
                productName: product.name || 'this product',
                url,
            });
            try {
                const wa = buildWhatsAppUrl(null, message);
                const canOpen = await Linking.canOpenURL(wa);
                if (canOpen) {
                    await Linking.openURL(wa);
                    return;
                }
            } catch (_) {
                /* Share sheet fallback */
            }
            await Share.share({ message, title: product.name || 'Share product' });
        } catch (e) {
            if (e?.message !== 'User did not share') {
                Alert.alert('Share failed', e?.message || 'Could not share link.');
            }
        } finally {
            setSharing(false);
        }
    };

    const HeaderActions = () => (
        <View style={styles.headerActions}>
            {canShareOrderLink ? (
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={shareProductLink}
                    disabled={sharing}
                    style={styles.headerBtn}
                >
                    {sharing ? (
                        <ActivityIndicator size="small" color={config.THEME_COLOR} />
                    ) : (
                        <Lucide name="share-2" color={config.THEME_COLOR} size={22} />
                    )}
                </TouchableOpacity>
            ) : null}
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ProductTransactions', { product })}
                style={styles.headerBtn}
            >
                <Lucide name="list-ordered" color={config.THEME_COLOR} size={22} />
            </TouchableOpacity>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ProductForm', { product })}
                style={styles.headerBtn}
            >
                <Lucide name="pencil" color={config.THEME_COLOR} size={22} />
            </TouchableOpacity>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.loadingRoot, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading product..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    const imageSize = width - 32;

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label="Product details">
                <HeaderActions />
            </ScreenHeader>

            <Modal
                visible={Array.isArray(shareStores)}
                transparent
                animationType="fade"
                onRequestClose={() => finishShareStorePick(null)}
            >
                <Pressable
                    style={styles.shareModalBackdrop}
                    onPress={() => finishShareStorePick(null)}
                >
                    <Pressable
                        style={[styles.shareModalSheet, { backgroundColor: colors.surface }]}
                        onPress={(e) => e.stopPropagation?.()}
                    >
                        <AppText
                            label="Share from which store?"
                            variant={1}
                            fontSize={17}
                            color={colors.text}
                            style={{ marginBottom: 6 }}
                        />
                        <AppText
                            label="Choose the store signup code for this product order link."
                            fontSize={13}
                            color={colors.textSecondary}
                            style={{ marginBottom: 12 }}
                        />
                        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                            {(shareStores || []).map((w) => (
                                <TouchableOpacity
                                    key={String(w.id)}
                                    activeOpacity={0.75}
                                    onPress={() => finishShareStorePick(w.reference_code)}
                                    style={[
                                        styles.shareStoreRow,
                                        { borderBottomColor: colors.border || colors.surfaceSecondary },
                                    ]}
                                >
                                    <AppText
                                        label={w.name || 'Store'}
                                        variant={1}
                                        fontSize={15}
                                        color={colors.text}
                                    />
                                    <AppText
                                        label={String(w.reference_code || '').toLowerCase()}
                                        fontSize={12}
                                        color={colors.textSecondary}
                                        style={{ marginTop: 2 }}
                                    />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => finishShareStorePick(null)}
                            style={{ marginTop: 12, alignItems: 'center', paddingVertical: 10 }}
                        >
                            <AppText label="Cancel" color={config.THEME_COLOR} fontSize={15} variant={1} />
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Hero: main image + gallery + name + price */}
                <View style={[styles.hero, { backgroundColor: colors.surface }]}>
                    <View style={[styles.imageWrap, { width: imageSize, height: imageSize, backgroundColor: colors.surfaceSecondary }]}>
                        {mainImageUri ? (
                            <Image source={{ uri: mainImageUri }} style={styles.heroImage} resizeMode="cover" />
                        ) : (
                            <Image
                                source={require('../../assets/images/product-image-placeholder.png')}
                                style={{width: 70, height: 70, borderRadius: 12}}
                                resizeMode="contain"
                            />
                        )}
                    </View>
                    {galleryRefs.length > 0 && (
                        <View style={styles.thumbnailRow}>
                            {galleryRefs.map((ref, idx) => {
                                const uri = resolveProductImageUri(ref);
                                if (!uri) return null;
                                const selected = mainImageRef != null && String(ref) === String(mainImageRef);
                                return (
                                    <TouchableOpacity
                                        key={String(ref) + idx}
                                        activeOpacity={0.8}
                                        onPress={() => setActiveImage(ref)}
                                        style={[
                                            styles.thumbnailItem,
                                            { borderColor: selected ? config.THEME_COLOR : 'transparent' },
                                        ]}
                                    >
                                        <Image source={{ uri }} style={styles.thumbnailImage} resizeMode="cover" />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                    <AppText label={name} fontSize={22} fontFamily="FiraSans-Bold" color={colors.text} style={styles.heroName} numberOfLines={2} />
                    <View style={styles.heroMeta}>
                        <View style={[styles.badge, { backgroundColor: colors.surfaceSecondary }]}>
                            <AppText label={sku ? `SKU: ${sku}` : 'No SKU'} fontSize={12} color={colors.textSecondary} />
                        </View>
                        <View style={[styles.badge, { backgroundColor: isActive ? (config.GREEN_COLOR || colors.success) + '22' : (colors.textTertiary || '#94a3b8') + '22' }]}>
                            <Lucide name={isActive ? 'circle-check-big' : 'circle-x'} size={12} color={isActive ? '#fff' : colors.textSecondary} />
                            <AppText
                                label={isActive ? 'Active' : 'Inactive'}
                                fontSize={12}
                                color={isActive ? '#fff' : colors.textSecondary}
                                style={{ marginLeft: 4 }}
                            />
                        </View>
                    </View>
                    <AppText label={priceStr} fontSize={24} fontFamily="FiraSans-Bold" color={config.THEME_COLOR} style={{ marginTop: 8 }} />
                </View>

                {/* Key stats row */}
                <View style={styles.statsRow}>
                    <View style={[styles.statBox, { backgroundColor: colors.surface }]}>
                        <Lucide name="boxes" size={20} color={config.THEME_COLOR} />
                        <AppText label={String(totalQty)} fontSize={20} fontFamily="FiraSans-Bold" color={colors.text} />
                        <AppText label="In stock" fontSize={11} color={colors.textTertiary} />
                    </View>
                    <View style={[styles.statBox, { backgroundColor: colors.surface }]}>
                        <Lucide name="triangle-alert" size={20} color={colors.textSecondary} />
                        <AppText label={String(reorderLevel || 0)} fontSize={20} fontFamily="FiraSans-Bold" color={colors.text} />
                        <AppText label="Reorder at" fontSize={11} color={colors.textTertiary} />
                    </View>
                    <View style={[styles.statBox, { backgroundColor: colors.surface }]}>
                        <Lucide name="coins" size={20} color={config.THEME_COLOR} />
                        <AppText label={costStr} fontSize={20} fontFamily="FiraSans-SemiBold" color={colors.text} numberOfLines={1} />
                        <AppText label="Cost" fontSize={11} color={colors.textTertiary} />
                    </View>
                </View>

                {/* Low stock banner */}
                {isLowStock && (
                    <View style={[styles.alertBanner, { backgroundColor: (colors.error || '#dc2626') + '18', borderColor: colors.error }]}>
                        <Lucide name="triangle-alert" size={20} color={colors.error} />
                        <AppText label="At or below reorder level" fontSize={14} color={colors.error} style={{ marginLeft: 10 }} fontFamily="FiraSans-Medium" />
                    </View>
                )}

                {/* Details card: description, batch, expiry, categories, tags */}
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <AppText label="Details" fontSize={16} fontFamily="FiraSans-SemiBold" color={colors.text} style={{ marginBottom: 14 }} />
                    <DetailRow icon="file-text" label="Description" value={product.description?.trim() || '-'} colors={colors} />
                    <DetailRow icon="badge-percent" label="Wholesale" value={altPriceStr} colors={colors} />
                    <DetailRow icon="barcode" label="Batch" value={batchNumber || '—'} colors={colors} />
                    {expiryDate && expiryDate !== '—' && <DetailRow icon="calendar" label="Expiry" value={expiryDate || '—'} colors={colors} />}
                    {categoryNames.length > 0 && (
                        <View style={styles.detailBlock}>
                            <View style={styles.detailLabelRow}>
                                <Lucide name="folder" size={16} color={colors.textSecondary} />
                                <AppText label="Categories" fontSize={13} color={colors.textSecondary} style={{ marginLeft: 8 }} />
                            </View>
                            <View style={styles.chipWrap}>
                                {categoryNames.map((c, i) => (
                                    <View key={i} style={[styles.chip, { backgroundColor: colors.surfaceSecondary }]}>
                                        <AppText label={c} fontSize={12} color={colors.text} />
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                    {tagList.length > 0 && (
                        <View style={styles.detailBlock}>
                            <View style={styles.detailLabelRow}>
                                <Lucide name="tags" size={16} color={colors.textSecondary} />
                                <AppText label="Tags" fontSize={13} color={colors.textSecondary} style={{ marginLeft: 8 }} />
                            </View>
                            <View style={styles.chipWrap}>
                                {tagList.map((t, i) => (
                                    <View key={i} style={[styles.chip, { backgroundColor: colors.surfaceSecondary }]}>
                                        <AppText label={t} fontSize={12} color={colors.text} />
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                {/* Stock by location */}
                {storesQuantities.length > 0 && (
                    <View style={[styles.card, { backgroundColor: colors.surface }]}>
                        <View style={styles.cardTitleRow}>
                            <Lucide name="map-pin" size={18} color={colors.text} />
                            <AppText label="Stock by location" fontSize={16} fontFamily="FiraSans-SemiBold" color={colors.text} style={{ marginLeft: 8 }} />
                        </View>
                        {storesQuantities.map((sq, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.locationRow,
                                    { borderBottomColor: colors.border },
                                    i === storesQuantities.length - 1 && { borderBottomWidth: 0 },
                                ]}
                            >
                                <AppText label={sq.name || sq.warehouse_name || 'Warehouse'} fontSize={14} color={colors.text} />
                                <AppText label={`${formatQuantity(sq.quantity_available ?? sq.quantity ?? 0)} units`} fontSize={14} fontFamily="FiraSans-SemiBold" color={config.THEME_COLOR} />
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: 24 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

function DetailRow({ icon, label, value, colors }) {
    return (
        <View style={styles.detailRow}>
            <View style={styles.detailLabelRow}>
                <Lucide name={icon} size={16} color={colors.textSecondary} />
                <AppText label={label} fontSize={13} color={colors.textSecondary} style={{ marginLeft: 8 }} />
            </View>
            <AppText label={value} fontSize={14} color={colors.text} style={{ marginTop: 2 }} numberOfLines={3} />
        </View>
    );
}

const styles = {
    loadingRoot: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    safe: {
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginRight: 10
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    hero: {
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    imageWrap: {
        borderRadius: 12,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    thumbnailRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 10,
        marginBottom: 4,
        gap: 8,
    },
    thumbnailItem: {
        width: 56,
        height: 56,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 2,
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
    },
    heroName: {
        textAlign: 'center',
        marginTop: 16,
        paddingHorizontal: 8,
    },
    heroMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        gap: 8,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    statBox: {
        flex: 1,
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    alertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 12,
    },
    card: {
        borderRadius: 16,
        padding: 18,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    detailRow: {
        marginBottom: 14,
    },
    detailBlock: {
        marginBottom: 4,
    },
    detailLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    locationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    shareModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
        padding: 16,
    },
    shareModalSheet: {
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 10,
        maxHeight: '80%',
    },
    shareStoreRow: {
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
};

export default ProductDetails;
