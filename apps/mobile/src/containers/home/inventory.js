import React, { useState, useEffect } from 'react';
import { Image, Modal, StyleSheet, TouchableOpacity, View, TextInput, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import Header from '../../components/main_header';
import AppText from '../../components/text';
import { FlashList } from "@shopify/flash-list";
import config from '../../config';
import AppModal from '../../components/app_modal';
import useTheme from '../../hooks/useTheme';
import { products as productsApi, normalizeList } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { useSelector } from 'react-redux';
import { canAccessScreen } from '../../utils/permissions';

// Mock data - replace with actual API call
const mockProducts = [
    {
        id: 1,
        name: 'Tampico Medium',
        sku: 'Tam500',
        price: 1162.00,
        stock: 21,
        category: 'Soft Drinks',
        thumbnail: null,
        lowStock: true
    },
    {
        id: 2,
        name: '5star 350ml',
        sku: '5S350',
        price: 46.00,
        stock: 264,
        category: 'Energy Drinks',
        thumbnail: null,
        lowStock: false
    },
    {
        id: 3,
        name: 'Bel Aqua',
        sku: 'BA500',
        price: 57.00,
        stock: 45,
        category: 'Water',
        thumbnail: null,
        lowStock: false
    },
    {
        id: 4,
        name: 'Tampico Medium',
        sku: 'Tam500',
        price: 1162.00,
        stock: 21,
        category: 'Soft Drinks',
        thumbnail: null,
        lowStock: true
    },
    {
        id: 5,
        name: '5star 350ml',
        sku: '5S350',
        price: 46.00,
        stock: 264,
        category: 'Energy Drinks',
        thumbnail: null,
        lowStock: false
    },
    {
        id: 6,
        name: 'Bel Aqua',
        sku: 'BA500',
        price: 57.00,
        stock: 45,
        category: 'Water',
        thumbnail: null,
        lowStock: false
    }
];

const TAB_BAR_HEIGHT = 60;

const productImageUri = (imageId) => {
    if (imageId == null || imageId === '') return null;
    return `${config.BASE_API}/images?id=${encodeURIComponent(String(imageId))}`;
};

/** Total units: per-store breakdown when present, otherwise aggregate inventory. */
const productListedQuantity = (item) => {
    const stores = item?.stores_quantities;
    if (Array.isArray(stores) && stores.length > 0) {
        return stores.reduce((acc, curr) => acc + (Number(curr?.quantity_available) || 0), 0);
    }
    return Number(item?.inventory ?? 0);
};

const isProductLowStock = (item) => {
    const stock = productListedQuantity(item);
    if (stock === 0) return false;
    const reorder = Number(item?.reorder_quantity ?? 0);
    if (reorder > 0) return stock <= reorder;
    return stock < 50;
};

const stockStatusForItem = (item) => {
    const stock = productListedQuantity(item);
    const reorder = Number(item?.reorder_quantity ?? 0);
    if (stock === 0) return { label: 'Out of Stock', color: '#ef4444', bg: '#fef2f2' };
    const isLow = reorder > 0 ? stock <= reorder : stock < 50;
    if (isLow) return { label: 'Low Stock', color: '#f59e0b', bg: '#fffbeb' };
    return { label: 'In Stock', color: '#10b981', bg: '#f0fdf4' };
};

const Inventory = ({ navigation, route }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const user = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const canCreateProduct = canAccessScreen(user, 'ProductForm', subscriptionFeatures);
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showPriceChange, setShowPriceChange] = useState(false);
    const [priceForm, setPriceForm] = useState({ retailPrice: '', wholesalePrice: '' });
    const [savingPrice, setSavingPrice] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [stockFilter, setStockFilter] = useState('all'); // all, low, inStock

    useEffect(() => {
        loadProducts();
    }, []);

    useEffect(() => {
        filterProducts();
    }, [searchQuery, selectedCategory, stockFilter, products]);

    const loadProducts = async () => {
        setIsLoading(true);
        try {
            const raw = await productsApi.list();
            // console.log('products raw', raw);
            const list = normalizeList(raw);
            setProducts(Array.isArray(list) && list.length > 0 ? list : []);
        } catch (error) {
            setProducts([]);
        } finally {
            setIsLoading(false);
        }
    }

    const onRefresh = async () => {
        setRefreshing(true);
        await loadProducts();
        setRefreshing(false);
    }

    const filterProducts = () => {
        let filtered = [...products];

        // Search filter
        if (searchQuery.trim()) {
            filtered = filtered.filter(product =>
                product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (product.category && product.category.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        // Category filter
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(product => product.category === selectedCategory);
        }

        // Stock filter
        if (stockFilter === 'low') {
            filtered = filtered.filter((product) => isProductLowStock(product));
        } else if (stockFilter === 'inStock') {
            filtered = filtered.filter(product => product.inventory > 0);
        }
        else if (stockFilter === 'outStock') {
            filtered = filtered.filter(product => product.inventory === 0);
        }

        setFilteredProducts(filtered);
    }

    const totalProducts = products.length;
    const lowStockCount = products.filter((p) => isProductLowStock(p)).length;
    const outStockCount = products.filter(p => p.inventory === 0).length;

    const closeMenuThen = (action) => {
        setShowMenu(false);
        setTimeout(action, 100);
    };

    const openPriceChangeModal = () => {
        if (!selectedItem) return;
        setPriceForm({
            retailPrice: String(selectedItem.retail_price ?? selectedItem.unit_price ?? ''),
            wholesalePrice: selectedItem.wholesale_price != null ? String(selectedItem.wholesale_price) : '',
        });
        setShowMenu(false);
        setTimeout(() => setShowPriceChange(true), 150);
    };

    const selectedStockStatus = selectedItem ? stockStatusForItem(selectedItem) : null;
    const selectedUnitPrice =
        Number(String(selectedItem?.unit_price ?? 0).replace(/,/g, '')) || 0;

    return (
        <SafeAreaView style={{flex:1,backgroundColor:colors.background,paddingBottom:0}} edges={['left', 'right']}>
            <Header navigation={navigation} screen="inventory"/>
            
            {/* Header Stats */}
            <View style={styles.headerStats}>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                    <Lucide name="package" color={config.THEME_COLOR} size={18} />
                    <View style={{marginLeft:8}}>
                        <AppText label={totalProducts.toString()} variant={1} fontSize={18} color={colors.text} />
                        <AppText label={'Products'} fontSize={11} color={colors.textTertiary} />
                    </View>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                    <Lucide name="triangle-alert" color="#f59e0b" size={18} />
                    <View style={{marginLeft:8}}>
                        <AppText label={lowStockCount.toString()} variant={1} fontSize={18} color={colors.text} />
                        <AppText label={'Low Stock'} fontSize={11} color={colors.textTertiary} />
                    </View>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                    <Lucide name="package-x" color="#f00" size={18} />
                    <View style={{marginLeft:8}}>
                        <AppText label={outStockCount.toString()} variant={1} fontSize={18} color={colors.text} />
                        <AppText label={'Out of Stock'} fontSize={11} color={colors.textTertiary} />
                    </View>
                </View>
            </View>

            {/* Search Bar */}
            {/* <View style={styles.searchContainer}>
                <Lucide name="search" color="#999" size={18} style={{marginLeft:12}} />
                <TextInput
                    style={styles.searchInput}
                    placeholder='Search products...'
                    placeholderTextColor={'#999'}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity
                        activeOpacity={.6}
                        onPress={() => setSearchQuery('')}
                        style={{padding:8,marginRight:8}}>
                        <Lucide name="x" color="#999" size={16} />
                    </TouchableOpacity>
                )}
            </View> */}

            {/* Scan + Filters */}
            <View style={styles.filtersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0}}>
                    <TouchableOpacity
                        activeOpacity={.6}
                        onPress={() => navigation.navigate('BarcodeScanner', { returnScreen: 'Search' })}
                        style={[styles.filterChip, { backgroundColor: '#0ea5e918', borderColor: '#0ea5e9' }]}>
                        <Lucide name="scan-barcode" color="#0ea5e9" size={16} style={{marginRight:6}} />
                        <AppText label={'Scan'} fontSize={12} variant={1} color="#0ea5e9" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={.6}
                        onPress={() => setStockFilter('all')}
                        style={[styles.filterChip, { backgroundColor: colors.surface, borderColor: colors.border }, stockFilter === 'all' && { backgroundColor: config.THEME_COLOR, borderColor: config.THEME_COLOR }]}>
                        <AppText label={'All'} fontSize={12} variant={stockFilter === 'all' ? 1 : 2} color={stockFilter === 'all' ? colors.textInverse : colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={.6}
                        onPress={() => setStockFilter('low')}
                        style={[styles.filterChip, { backgroundColor: colors.surface, borderColor: colors.border }, stockFilter === 'low' && { backgroundColor: config.THEME_COLOR, borderColor: config.THEME_COLOR }]}>
                        <Lucide name="triangle-alert" color={stockFilter === 'low' ? colors.textInverse : '#f59e0b'} size={14} style={{marginRight:4}} />
                        <AppText label={'Low Stock'} fontSize={12} variant={stockFilter === 'low' ? 1 : 2} color={stockFilter === 'low' ? colors.textInverse : colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={.6}
                        onPress={() => setStockFilter('outStock')}
                        style={[styles.filterChip, { backgroundColor: colors.surface, borderColor: colors.border }, stockFilter === 'outStock' && { backgroundColor: config.THEME_COLOR, borderColor: config.THEME_COLOR }]}>
                        <Lucide name="package-x" color={stockFilter === 'outStock' ? colors.textInverse : '#f00'} size={14} style={{marginRight:4}} />
                        <AppText label={'Out of Stock'} fontSize={12} variant={stockFilter === 'outStock' ? 1 : 2} color={stockFilter === 'outStock' ? colors.textInverse : colors.textSecondary} />
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* Products List */}
            {isLoading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label={'Loading products...'} color={colors.textTertiary} style={{marginTop:10}} />
                </View>
            ) : (
                <FlashList
                    style={{flex:1}}
                    contentContainerStyle={{ padding: 10, paddingBottom: TAB_BAR_HEIGHT + 56 + 24 }}
                    data={filteredProducts}
                    keyExtractor={(item) => `product-${item.id}`}
                    estimatedItemSize={90}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.THEME_COLOR} />
                    }
                    ListEmptyComponent={() => (
                        <View style={styles.emptyContainer}>
                            <Lucide name="package-x" color={colors.border} size={48} />
                            <AppText label={searchQuery ? 'No products found' : 'No products yet'} variant={1} fontSize={16} color={colors.textTertiary} style={{marginTop:12}} />
                            <AppText label={searchQuery ? 'Try a different search term' : 'Tap the + button to add your first product'} fontSize={13} color={colors.textTertiary} style={{marginTop:6,textAlign:'center'}} />
                        </View>
                    )}
                    ListHeaderComponent={() => (
                        filteredProducts.length > 0 && (
                            <View style={styles.listHeader}>
                                <AppText label={`${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''}`} fontSize={13} color={colors.textTertiary} />
                            </View>
                        )
                    )}
                    renderItem={({ item }) => {
                        const stockStatus = stockStatusForItem(item);
                        const qtyDisplay = productListedQuantity(item);
                        return (
                            <TouchableOpacity
                                activeOpacity={.7}
                                onPress={() => {
                                    setSelectedItem(item);
                                    setShowMenu(true);
                                }} 
                                style={[styles.productCard, { backgroundColor: colors.surface }]}>
                                <View style={[styles.productImageContainer, { backgroundColor: colors.surfaceSecondary }]}>
                                    {item.thumbnail ? (
                                        <Image
                                            source={{ uri: productImageUri(item.thumbnail) }}
                                            style={styles.productImage}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={[styles.productImageFallback, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                                            <Lucide name="image" size={22} color={colors.textTertiary} />
                                        </View>
                                    )}
                                </View>
                                <View style={styles.productInfo}>
                                    <View style={styles.productHeader}>
                                        <AppText label={item.name} variant={1} fontSize={15} color={colors.text} numberOfLines={1} />
                                    </View>
                                    <AppText
                                        label={
                                            Array.isArray(item.category_names) && item.category_names.length > 0
                                                ? item.category_names.filter(Boolean).join(', ')
                                                : 'No category'
                                        }
                                        variant={2}
                                        fontSize={12}
                                        color={colors.textTertiary}
                                        style={{ marginTop: 2 }}
                                    />
                                    <View style={styles.productMeta}>
                                        <View style={styles.metaItem}>
                                            <Lucide name="hash" color={colors.textTertiary} size={12} />
                                            <AppText label={item.sku} fontSize={11} color={colors.textSecondary} style={{marginLeft:4}} />
                                        </View>
                                        <View style={styles.metaItem}>
                                            <Lucide name="package" color={colors.textTertiary} size={12} />
                                            <AppText label={`${qtyDisplay} units`} fontSize={11} color={colors.textSecondary} style={{marginLeft:4}} />
                                        </View>
                                        <View style={[styles.stockBadge, {backgroundColor: stockStatus.bg}]}>
                                            <View style={[styles.stockDot, {backgroundColor: stockStatus.color}]} />
                                            <AppText label={stockStatus.label} fontSize={10} color={stockStatus.color} style={{marginLeft:4}} />
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.productPrice}>
                                    <AppText
                                        label={formatCurrency(Number(String(item.unit_price ?? 0).replace(/,/g, '')) || 0)}
                                        variant={1}
                                        fontSize={16}
                                        color={colors.text}
                                        style={{ fontVariant: ['tabular-nums'] }}
                                    />
                                    <Lucide name="chevron-right" color={colors.border} size={18} style={{marginTop:2}} />
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}

            {/* Add Product Button - positioned above tab bar */}
            {canCreateProduct && (
                <TouchableOpacity
                    activeOpacity={.8}
                    onPress={() => navigation.navigate("ProductForm")}
                    style={[styles.addButton, { bottom: TAB_BAR_HEIGHT + insets.bottom + 12 }]}>
                    <Lucide name='plus' color={'#fff'} size={24} />
                </TouchableOpacity>
            )}

            {/* Product Menu Modal */}
            <AppModal
                title={selectedItem?.name || 'Product'}
                visible={showMenu}
                handleClose={() => {
                    setShowMenu(false);
                    setSelectedItem(null);
                }}
                onRequestClose={() => {
                    setShowMenu(false);
                    setSelectedItem(null);
                }}>
                <View style={styles.modalContent}>
                    {selectedItem ? (
                        <View style={[styles.modalHeroCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            {selectedItem.thumbnail ? (
                                <Image
                                    source={{ uri: productImageUri(selectedItem.thumbnail) }}
                                    style={[styles.modalHeroImage, { backgroundColor: colors.surface }]}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={[styles.modalHeroImage, styles.modalHeroFallback, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                                    <Lucide name="image" size={28} color={colors.textTertiary} />
                                </View>
                            )}
                            <View style={styles.modalHeroBody}>
                                <AppText
                                    label={selectedItem.name}
                                    variant={1}
                                    fontSize={16}
                                    color={colors.text}
                                    numberOfLines={2}
                                />
                                <AppText
                                    label={`SKU ${selectedItem.sku || '—'}`}
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 4 }}
                                />
                                <View style={styles.modalHeroChips}>
                                    {selectedStockStatus ? (
                                        <View style={[styles.modalStatusChip, { backgroundColor: selectedStockStatus.bg }]}>
                                            <View style={[styles.stockDot, { backgroundColor: selectedStockStatus.color }]} />
                                            <AppText
                                                label={selectedStockStatus.label}
                                                fontSize={11}
                                                variant={1}
                                                color={selectedStockStatus.color}
                                                style={{ marginLeft: 5 }}
                                            />
                                        </View>
                                    ) : null}
                                    <View style={[styles.modalMetaChip, { backgroundColor: colors.surface }]}>
                                        <Lucide name="boxes" size={12} color={colors.textSecondary} />
                                        <AppText
                                            label={`${productListedQuantity(selectedItem)} units`}
                                            fontSize={11}
                                            color={colors.textSecondary}
                                            style={{ marginLeft: 5 }}
                                        />
                                    </View>
                                </View>
                                <AppText
                                    label={formatCurrency(selectedUnitPrice)}
                                    variant={1}
                                    fontSize={18}
                                    color={config.THEME_COLOR}
                                    style={{ marginTop: 10, fontVariant: ['tabular-nums'] }}
                                />
                            </View>
                        </View>
                    ) : null}

                    <AppText
                        label="Quick actions"
                        variant={1}
                        fontSize={12}
                        color={colors.textTertiary}
                        style={styles.modalSectionLabel}
                    />

                    <View style={styles.modalActionGrid}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => closeMenuThen(() => navigation.navigate('ProductDetails', { product: selectedItem }))}
                            style={[styles.modalActionTile, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <View style={[styles.modalActionIconWrap, { backgroundColor: colors.primaryShade }]}>
                                <Lucide name="file-text" color={config.THEME_COLOR} size={22} />
                            </View>
                            <AppText label="Details" variant={1} fontSize={14} color={colors.text} style={{ marginTop: 10 }} />
                            <AppText label="Full product info" fontSize={11} color={colors.textTertiary} style={{ marginTop: 3, textAlign: 'center' }} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => closeMenuThen(() => navigation.navigate('ProductTransactions', { product: selectedItem }))}
                            style={[styles.modalActionTile, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <View style={[styles.modalActionIconWrap, { backgroundColor: colors.successLight || '#ecfdf5' }]}>
                                <Lucide name="history" color="#10b981" size={22} />
                            </View>
                            <AppText label="Transactions" variant={1} fontSize={14} color={colors.text} style={{ marginTop: 10 }} />
                            <AppText label="Sales & stock history" fontSize={11} color={colors.textTertiary} style={{ marginTop: 3, textAlign: 'center' }} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => closeMenuThen(() => navigation.navigate('ProductForm', { product: selectedItem }))}
                            style={[styles.modalActionTile, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <View style={[styles.modalActionIconWrap, { backgroundColor: colors.warningLight || '#fffbeb' }]}>
                                <Lucide name="pencil" color="#f59e0b" size={22} />
                            </View>
                            <AppText label="Edit" variant={1} fontSize={14} color={colors.text} style={{ marginTop: 10 }} />
                            <AppText label="Update product" fontSize={11} color={colors.textTertiary} style={{ marginTop: 3, textAlign: 'center' }} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={openPriceChangeModal}
                            style={[styles.modalActionTile, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <View style={[styles.modalActionIconWrap, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                                <Lucide name="badge-cent" color={config.THEME_COLOR} size={22} />
                            </View>
                            <AppText label="Price" variant={1} fontSize={14} color={colors.text} style={{ marginTop: 10 }} />
                            <AppText label="Retail & wholesale" fontSize={11} color={colors.textTertiary} style={{ marginTop: 3, textAlign: 'center' }} />
                        </TouchableOpacity>
                    </View>
                </View>
            </AppModal>

            {/* Price Change Modal */}
            <AppModal
                title={'Change Price'}
                visible={showPriceChange}
                handleClose={() => {
                    setShowPriceChange(false);
                    setSavingPrice(false);
                }}
                onRequestClose={() => {
                    setShowPriceChange(false);
                    setSavingPrice(false);
                }}>
                <View style={[styles.priceModalContent, { backgroundColor: colors.surface }]}>
                    {selectedItem && (
                        <View style={[styles.priceHeader, { borderBottomColor: colors.border }]}>
                            <View style={styles.priceHeaderTitleRow}>
                                <AppText
                                    label={selectedItem.name}
                                    variant={1}
                                    fontSize={15}
                                    color={colors.text}
                                    numberOfLines={1}
                                    style={{ flex: 1 }}
                                />
                                <AppText
                                    label={`SKU: ${selectedItem.sku}`}
                                    fontSize={11}
                                    color={colors.textTertiary}
                                    style={{ marginLeft: 8 }}
                                />
                            </View>
                            <View style={styles.priceSummaryRow}>
                                <View style={[styles.priceSummaryChip, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="tag" size={14} color={config.THEME_COLOR} />
                                    <AppText
                                        label={`Retail: ${formatCurrency(Number(String(selectedItem.retail_price ?? selectedItem.unit_price ?? 0).replace(/,/g, '')) || 0)}`}
                                        fontSize={11}
                                        color={colors.text}
                                        style={{ marginLeft: 6 }}
                                    />
                                </View>
                                {(selectedItem.wholesale_price ?? null) !== null && (
                                    <View style={[styles.priceSummaryChip, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Lucide name="badge-percent" size={14} color={config.THEME_COLOR} />
                                        <AppText
                                            label={`Wholesale / Alternative: ${formatCurrency(Number(String(selectedItem.wholesale_price || 0).replace(/,/g, '')) || 0)}`}
                                            fontSize={11}
                                            color={colors.text}
                                            style={{ marginLeft: 6 }}
                                        />
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    <AppText
                        label="Update the prices below. Changes apply to all future sales."
                        fontSize={12}
                        color={colors.textTertiary}
                        style={{ marginBottom: 10 }}
                    />

                    <View style={{ marginBottom: 12 }}>
                        <View style={styles.priceLabelRow}>
                            <AppText label={'Retail price'} fontSize={13} color={colors.text} />
                            <AppText
                                label="required"
                                fontSize={11}
                                color={colors.error}
                                style={{ marginLeft: 6 }}
                            />
                        </View>
                        <View style={[styles.priceInputRow, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}>
                            <AppText label={'GHS'} fontSize={12} color={colors.textSecondary} />
                            <TextInput
                                keyboardType="decimal-pad"
                                value={priceForm.retailPrice}
                                onChangeText={(text) => setPriceForm((prev) => ({ ...prev, retailPrice: text }))}
                                style={[styles.priceInput, { color: colors.text }]}
                                placeholder="0.00"
                                placeholderTextColor={colors.placeholder}
                            />
                        </View>
                    </View>
                    <View style={{ marginBottom: 4 }}>
                        <AppText label={'Wholesale price (optional)'} fontSize={13} color={colors.text} />
                        <View style={[styles.priceInputRow, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}>
                            <AppText label={'GHS'} fontSize={12} color={colors.textSecondary} />
                            <TextInput
                                keyboardType="decimal-pad"
                                value={priceForm.wholesalePrice}
                                onChangeText={(text) => setPriceForm((prev) => ({ ...prev, wholesalePrice: text }))}
                                style={[styles.priceInput, { color: colors.text }]}
                                placeholder="0.00"
                                placeholderTextColor={colors.placeholder}
                            />
                        </View>
                    </View>

                    <AppText
                        label="Tip: Leave wholesale empty if you don’t use a separate wholesale price."
                        fontSize={11}
                        color={colors.textTertiary}
                        style={{ marginTop: 6, marginBottom: 10 }}
                    />

                    <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={savingPrice}
                        onPress={async () => {
                            if (!selectedItem) {
                                setShowPriceChange(false);
                                return;
                            }
                            const retail = parseFloat((priceForm.retailPrice || '').replace(/,/g, ''));
                            if (isNaN(retail) || retail <= 0) {
                                alert('Please enter a valid retail price');
                                return;
                            }
                            const wholesaleRaw = (priceForm.wholesalePrice || '').replace(/,/g, '');
                            const wholesale = wholesaleRaw ? parseFloat(wholesaleRaw) : null;
                            if (wholesaleRaw && (isNaN(wholesale) || wholesale <= 0)) {
                                alert('Please enter a valid wholesale price');
                                return;
                            }
                            try {
                                setSavingPrice(true);
                                await productsApi.changePrice({
                                    id: selectedItem.id,
                                    unit_price: retail,
                                    alt_price: wholesale,
                                });
                                await loadProducts();
                                setShowPriceChange(false);
                            } catch (e) {
                                alert('Failed to update price. Please try again.');
                            } finally {
                                setSavingPrice(false);
                            }
                        }}
                        style={[
                            styles.priceSaveButton,
                            { backgroundColor: config.THEME_COLOR },
                            savingPrice && styles.saveButtonDisabled,
                        ]}>
                        {savingPrice ? (
                            <ActivityIndicator color={'#fff'} />
                        ) : (
                            <>
                                <Lucide name="save" size={18} color={'#fff'} style={{ marginRight: 8 }} />
                                <AppText label="Save Price" fontSize={15} color={'#fff'} variant={1} />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </AppModal>
        </SafeAreaView>
    )
}

export default Inventory;

const styles = StyleSheet.create({
    // Header stats
    headerStats: {
        flexDirection:'row',
        padding:10,
        gap:10
    },
    statCard: {
        flex:1,
        flexDirection:'row',
        alignItems:'center',
        padding:12,
        borderRadius:5,
        shadowColor:'#000',
        shadowOffset:{width:0,height:1},
        shadowOpacity:0.05,
        shadowRadius:2,
        elevation:2
    },
    // Search
    searchContainer: {
        flexDirection:'row',
        alignItems:'center',
        backgroundColor:'#fff',
        borderRadius:25,
        marginHorizontal:10,
        marginBottom:10,
        borderWidth:1,
        borderColor:'#eee',
        shadowColor:'#000',
        shadowOffset:{width:0,height:1},
        shadowOpacity:0.05,
        shadowRadius:2,
        elevation:2
    },
    searchInput: {
        flex:1,
        height:45,
        marginLeft:8,
        fontFamily:'FiraSans-Regular',
        fontSize:15,
        color:'#4d4d4d',
        paddingRight:10
    },
    // Filters
    filtersContainer: {
        paddingHorizontal:10,
        marginBottom:5
    },
    filterChip: {
        flexDirection:'row',
        alignItems:'center',
        paddingHorizontal:14,
        paddingVertical:8,
        borderRadius:20,
        marginRight:8,
        borderWidth:1,
    },
    // Loading
    loadingContainer: {
        flex:1,
        justifyContent:'center',
        alignItems:'center',
        paddingVertical:40
    },
    // Empty state
    emptyContainer: {
        flex:1,
        justifyContent:'center',
        alignItems:'center',
        paddingVertical:60,
        paddingHorizontal:40
    },
    // List header
    listHeader: {
        paddingBottom:5,
        marginBottom:5
    },
    // Product card
    productCard: {
        flexDirection:'row',
        alignItems:'center',
        borderRadius:5,
        padding:12,
        marginBottom:10,
        shadowColor:'#000',
        shadowOffset:{width:0,height:1},
        shadowOpacity:0.05,
        shadowRadius:2,
        elevation:2
    },
    productImageContainer: {
        width:60,
        height:60,
        borderRadius:8,
        overflow:'hidden',
    },
    productImage: {
        width:'100%',
        height:'100%'
    },
    productImageFallback: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    productInfo: {
        flex:1,
        marginLeft:12,
        justifyContent:'center'
    },
    productHeader: {
        flexDirection:'row',
        justifyContent:'space-between',
        alignItems:'flex-start',
        marginBottom:4
    },
    stockBadge: {
        flexDirection:'row',
        alignItems:'center',
        paddingHorizontal:6,
        paddingVertical:2,
        borderRadius:10,
        marginLeft:8
    },
    stockDot: {
        width:6,
        height:6,
        borderRadius:3
    },
    productMeta: {
        flexDirection:'row',
        marginTop:6,
        gap:12
    },
    metaItem: {
        flexDirection:'row',
        alignItems:'center'
    },
    productPrice: {
        flexDirection:'row',
        alignItems:'center',
        justifyContent:'center',
        marginLeft:8
    },
    // Add button
    addButton: {
        width:56,
        height:56,
        borderRadius:28,
        justifyContent:'center',
        alignItems:'center',
        backgroundColor:config.THEME_COLOR,
        position:'absolute',
        bottom:20,
        right:20,
        shadowColor:'#000',
        shadowOffset:{width:0,height:4},
        shadowOpacity:0.3,
        shadowRadius:8,
        elevation:8
    },
    // Product options modal
    modalContent: {
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 20,
    },
    modalHeroCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
    },
    modalHeroImage: {
        width: 72,
        height: 72,
        borderRadius: 12,
    },
    modalHeroFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalHeroBody: {
        flex: 1,
        marginLeft: 14,
        minWidth: 0,
    },
    modalHeroChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginTop: 8,
        gap: 6,
    },
    modalStatusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    modalMetaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    modalSectionLabel: {
        marginBottom: 10,
        marginLeft: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    modalActionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    modalActionTile: {
        width: '48%',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 10,
    },
    modalActionIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Price change modal
    priceModalContent: {
        padding:12
    },
    priceHeader: {
        paddingBottom:10,
        marginBottom:10,
        borderBottomWidth:1
    },
    priceHeaderTitleRow: {
        flexDirection:'row',
        alignItems:'center',
        marginBottom:6
    },
    priceSummaryRow: {
        flexDirection:'row',
        flexWrap:'wrap',
        gap:6
    },
    priceSummaryChip: {
        flexDirection:'row',
        alignItems:'center',
        borderRadius:999,
        paddingHorizontal:10,
        paddingVertical:4
    },
    priceLabelRow: {
        flexDirection:'row',
        alignItems:'center',
        marginBottom:2
    },
    priceInputRow: {
        flexDirection:'row',
        alignItems:'center',
        marginTop:4,
        borderWidth:1,
        borderRadius:8,
        paddingHorizontal:10,
        height:44
    },
    priceInput: {
        flex:1,
        marginLeft:6,
        fontFamily:'FiraSans-Regular',
        fontSize:15
    },
    priceSaveButton: {
        flexDirection:'row',
        alignItems:'center',
        justifyContent:'center',
        height:48,
        borderRadius:10,
        marginHorizontal:4,
        marginBottom:6,
        marginTop:4
    }
})