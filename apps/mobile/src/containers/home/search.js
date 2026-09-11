import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Image, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import AppText from '../../components/text';
import config from '../../config';
import { FlashList } from '@shopify/flash-list';
import Lucide from '@react-native-vector-icons/lucide';
import useTheme from '../../hooks/useTheme';
import { products as productsApi, normalizeList } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
// import Toast from 'react-native-toast-message';
// import { useVoiceSearch } from '../../hooks/useVoiceSearch';

const PRODUCTS_CACHE_META_KEY = 'SHOPYNN_PRODUCTS_CACHE_META_V1';

// Context-specific config when Search is opened from different screens
// const SOURCE_CONFIG = {
//     inventory: {
//         title: 'Search products',
//         subtitle: 'Find products by name, SKU or category',
//         placeholder: 'Search products...',
//         emptyTitle: 'No products found',
//         emptySubtitle: 'Try a different search term',
//         icon: 'package',
//         accentColor: config.THEME_COLOR,
//     },
//     reports: {
//         title: 'Search reports',
//         subtitle: 'Find reports and analytics',
//         placeholder: 'Search reports...',
//         emptyTitle: 'No reports found',
//         emptySubtitle: 'Reports will appear here',
//         icon: 'bar-chart-3',
//         accentColor: '#10b981',
//     },
//     sales: {
//         title: 'Search sales',
//         subtitle: 'Find sales by customer or transaction',
//         placeholder: 'Search sales...',
//         emptyTitle: 'No sales found',
//         emptySubtitle: 'Try a different search term',
//         icon: 'shopping-cart',
//         accentColor: '#0A74DA',
//     },
//     purchases: {
//         title: 'Search purchases',
//         subtitle: 'Find purchase orders',
//         placeholder: 'Search purchases...',
//         emptyTitle: 'No purchases found',
//         emptySubtitle: 'Purchase history will appear here',
//         icon: 'bookmark-check',
//         accentColor: '#f59e0b',
//     },
//     dashboard: {
//         title: 'Search',
//         subtitle: 'Search across the app',
//         placeholder: 'Search...',
//         emptyTitle: 'No results',
//         emptySubtitle: 'Try a different search term',
//         icon: 'search',
//         accentColor: config.THEME_COLOR,
//     },
// };

const formatCurrency = (value) => {
  const amount = Number(value) || 0;
  if (amount >= 1000000) {
      return `GHS ${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
      return `GHS ${(amount / 1000).toFixed(1)}K`;
  }
  return `GHS ${amount.toFixed(2)}`;
}

// Animated Product Item Component
const ProductItem = ({ item, index, isSelected, multipleSelect, onPress }) => {
    const { colors } = useTheme();
    const scale = useSharedValue(isSelected ? 1 : 0);
    const opacity = useSharedValue(isSelected ? 1 : 0);
    const itemScale = useSharedValue(1);
    const checkWidth = useSharedValue(isSelected ? 24 : 0);

    React.useEffect(() => {
        if (isSelected) {
            scale.value = withSpring(1, { damping: 15, stiffness: 200 });
            opacity.value = withTiming(1, { duration: 200 });
            itemScale.value = withSpring(1.02, { damping: 15, stiffness: 200 });
            checkWidth.value = withTiming(24, { duration: 200 });
        } else {
            scale.value = withSpring(0, { damping: 15, stiffness: 200 });
            opacity.value = withTiming(0, { duration: 150 });
            itemScale.value = withSpring(1, { damping: 15, stiffness: 200 });
            checkWidth.value = withTiming(0, { duration: 150 });
        }
    }, [isSelected]);

    const checkIconStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            opacity: opacity.value,
        };
    });

    const checkContainerStyle = useAnimatedStyle(() => {
        return {
            width: checkWidth.value,
            marginRight: checkWidth.value > 0 ? 8 : 0,
        };
    });

    const itemStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: itemScale.value }],
        };
    });

    const handlePress = () => {
        itemScale.value = withSpring(0.98, { damping: 15, stiffness: 300 }, () => {
            itemScale.value = withSpring(1, { damping: 15, stiffness: 300 });
        });
        onPress();
    };

    const hasThumbnail = Boolean(item.thumbnail);

    return (
        <Animated.View style={[
            {
              backgroundColor: colors.surface,
              padding: 5,
              borderRadius: 5,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            },
            itemStyle
        ]}>
            <TouchableOpacity
                activeOpacity={0.6}
                onPress={handlePress}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}
            >
                <Animated.View style={[{ height: 24, justifyContent: 'center', alignItems: 'center' }, checkContainerStyle, checkIconStyle]}>
                    {isSelected && (
                        <Lucide name='circle-check' color={config.THEME_COLOR} size={22} />
                    )}
                </Animated.View>

                {hasThumbnail ? (
                    <Image
                        source={{ uri: config.BASE_API + '/images?id=' + item.thumbnail }}
                        style={{ width: 40, height: 40, borderRadius: 5, backgroundColor: colors.surfaceSecondary }}
                    />
                ) : (
                    <View
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 5,
                            backgroundColor: `${config.THEME_COLOR}18`,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Lucide name="image" size={18} color={colors.textTertiary} />
                    </View>
                )}
                <View style={{flex:1,padding:4,marginRight:10,minWidth:0}}>
                    <AppText label={item.name} variant={1} fontSize={16} color={colors.text} numberOfLines={1}/> 
                    <AppText label={`${item.inventory} in Stock`} variant={2} fontSize={13} color={colors.textSecondary} /> 
                </View>
                <View style={{flexDirection:'row',alignItems:'center',flexShrink:0}}>
                    <AppText label={formatCurrency(item.unit_price)} variant={1} color={colors.text} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const Search = ({ navigation, route }) => {
    const { colors } = useTheme();
    const [searchText, setSearchText] = useState('');
    const [products, setProducts] = useState([]);
    const [productsLastSyncedAt, setProductsLastSyncedAt] = useState('');
    const [isConnected, setIsConnected] = useState(true);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [refreshingProducts, setRefreshingProducts] = useState(false);
    const [selectedItems, setSelectedItems] = useState({});
    const [multipleSelect, setMultipleSelect] = useState(false);

    const backPress = () => {
        navigation.goBack();
    };

    const source_nav = route.params?.source_nav || 'inventory';
    const searchOnly = route.params?.searchOnly ?? false;
    const onSelect = route.params?.onSelect;
    const onMultiSelect = route.params?.onMultiSelect;
    const barcodeFilter = route.params?.barcodeFilter;
    // const showProductVoice = source_nav === 'inventory' || source_nav === 'purchases';

    // const voiceSearch = useVoiceSearch({
    //     onResult: setSearchText,
    //     onError: (message) => {
    //         if (Toast?.show) Toast.show({ type: 'error', text1: message });
    //     },
    // });

    const sourceConfig = {
      title: 'Search products',
      subtitle: 'Find by name, SKU, code',
      placeholder: 'Name, sku, or code...',
      emptyTitle: 'No products found',
      emptySubtitle: 'Try a different search term',
      icon: 'package',
      accentColor: config.THEME_COLOR,
  }//SOURCE_CONFIG[source_nav] || SOURCE_CONFIG.inventory;

    useEffect(() => {
        if (barcodeFilter && typeof barcodeFilter === 'string') setSearchText(barcodeFilter);
    }, [barcodeFilter]);

    // Load products from API
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                // Best-effort: show cache timestamp for offline clarity.
                const metaRaw = await AsyncStorage.getItem(PRODUCTS_CACHE_META_KEY);
                const meta = metaRaw ? JSON.parse(metaRaw) : null;
                const lastSyncedAt = meta?.lastSyncedAt ? String(meta.lastSyncedAt) : '';
                if (mounted) setProductsLastSyncedAt(lastSyncedAt);

                const raw = await productsApi.list();
                const list = normalizeList(raw);
                if (mounted) {
                    setProducts(Array.isArray(list) && list.length > 0 ? list : []);
                }
            } catch (_) {
                if (mounted) setProducts([]);
            } finally {
                if (mounted) setLoadingProducts(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setIsConnected(!!state?.isConnected);
        });
        return () => unsubscribe && unsubscribe();
    }, []);

    const refreshProducts = async () => {
        if (refreshingProducts) return;
        setRefreshingProducts(true);
        try {
            const raw = await productsApi.list();
            const list = normalizeList(raw);
            setProducts(Array.isArray(list) ? list : []);

            const metaRaw = await AsyncStorage.getItem(PRODUCTS_CACHE_META_KEY);
            const meta = metaRaw ? JSON.parse(metaRaw) : null;
            const lastSyncedAt = meta?.lastSyncedAt ? String(meta.lastSyncedAt) : '';
            setProductsLastSyncedAt(lastSyncedAt);
        } finally {
            setRefreshingProducts(false);
        }
    };

    const filteredProducts = source_nav === 'inventory' || source_nav === 'purchases'
        ? products.filter((p) => {
            const matchBarcode = barcodeFilter
                ? (p.bar_code && String(p.bar_code) === String(barcodeFilter)) || (p.sku && String(p.sku).toLowerCase() === String(barcodeFilter).toLowerCase())
                : true;
            const matchSearch =
                !searchText.trim() ||
                (p.name && p.name.toLowerCase().includes(searchText.toLowerCase())) ||
                (p.sku && p.sku.toLowerCase().includes(searchText.toLowerCase())) ||
                (p.description && p.description.toLowerCase().includes(searchText.toLowerCase())) ||
                (p.bar_code && String(p.bar_code).includes(searchText));
            return matchBarcode && matchSearch;
          })
        : products;

    const handleMultiSelect = () => {
        const records = Object.values(selectedItems);
        if (onMultiSelect) {
            onMultiSelect(records);
        }
        navigation.goBack();
    };

    const selectedCount = Object.keys(selectedItems).length;

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            {/* Context header: title + subtitle based on source */}
            <View style={[styles.contextBanner, { backgroundColor: colors.surface, borderLeftColor: sourceConfig.accentColor }]}>
                <View style={[styles.contextIconWrap, { backgroundColor: sourceConfig.accentColor + '18' }]}>
                    <Lucide name={sourceConfig.icon} size={22} color={sourceConfig.accentColor} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <AppText label={sourceConfig.title} variant={1} fontSize={17} color={colors.text} />
                    <AppText label={sourceConfig.subtitle} fontSize={12} color={colors.textSecondary} style={{ marginTop: 2 }} />
                    {!!productsLastSyncedAt && (
                        <AppText
                            label={`Last synced: ${new Date(productsLastSyncedAt).toLocaleString()}`}
                            fontSize={11}
                            color={colors.textTertiary}
                            style={{ marginTop: 2 }}
                        />
                    )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    {!isConnected && (
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 999,
                                backgroundColor: colors.errorLight,
                            }}>
                            <Lucide name="wifi-off" size={12} color={colors.error} />
                            <AppText label="Offline" fontSize={11} color={colors.error} style={{ marginLeft: 6 }} />
                        </View>
                    )}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={!isConnected || refreshingProducts}
                        onPress={refreshProducts}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            backgroundColor: colors.surfaceSecondary,
                            opacity: !isConnected || refreshingProducts ? 0.5 : 1,
                        }}>
                        <Lucide name="refresh-cw" size={14} color={colors.textSecondary} />
                        <AppText label="Refresh" fontSize={11} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search bar */}
            <View style={[styles.searchRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={backPress}
                    style={styles.backButton}
                >
                    <Lucide name="move-left" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
                <View style={[styles.searchInputWrap, { backgroundColor: colors.inputBackground }]}>
                    <Lucide name="search" size={15} color={colors.textTertiary} style={{ marginLeft: 12 }} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder={sourceConfig.placeholder}
                        placeholderTextColor={colors.placeholder}
                        value={searchText}
                        onChangeText={setSearchText}
                        autoFocus={false}
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity
                            activeOpacity={0.6}
                            onPress={() => setSearchText('')}
                            style={{ padding: 8, marginRight: 4 }}
                        >
                            <Lucide name="x" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                    {/* {showProductVoice && (
                        <TouchableOpacity
                            activeOpacity={0.6}
                            onPress={voiceSearch.toggle}
                            disabled={!voiceSearch.supported}
                            style={{ padding: 8, marginRight: 4, opacity: voiceSearch.supported ? 1 : 0.4 }}
                            accessibilityLabel={voiceSearch.listening ? 'Stop voice search' : 'Voice search'}
                        >
                            <Lucide
                                name={voiceSearch.listening ? 'square' : 'mic'}
                                size={20}
                                color={voiceSearch.listening ? colors.error : config.THEME_COLOR}
                            />
                        </TouchableOpacity>
                    )} */}
                </View>
                {(source_nav === 'inventory' || source_nav === 'purchases') && (
                    <TouchableOpacity activeOpacity={0.6} onPress={() => navigation.navigate('BarcodeScanner', { returnScreen: 'Search', initialBarcode: searchText })} style={[styles.multiSelectButton, { marginRight: searchOnly ? 0 : 8 }]}>
                        <Lucide name="barcode" size={24} color={config.THEME_COLOR} />
                    </TouchableOpacity>
                )}
                {searchOnly && (
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => setMultipleSelect(!multipleSelect)}
                        style={[styles.multiSelectButton, multipleSelect && { backgroundColor: sourceConfig.accentColor + '22' }]}
                    >
                        <Lucide
                            name="square-check-big"
                            size={24}
                            color={multipleSelect ? sourceConfig.accentColor : colors.textTertiary}
                        />
                    </TouchableOpacity>
                )}
            </View>

            {searchOnly && multipleSelect && selectedCount > 0 && (
                <View style={[styles.selectedBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <AppText label={`${selectedCount} selected`} variant={1} fontSize={14} color={sourceConfig.accentColor} />
                    <TouchableOpacity activeOpacity={0.6} onPress={handleMultiSelect} style={[styles.confirmButton, { backgroundColor: sourceConfig.accentColor }]}>
                        <AppText label="Add selected" variant={1} fontSize={14} color={colors.textInverse} />
                        <Lucide name="check" size={18} color={colors.textInverse} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                </View>
            )}

            {loadingProducts ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading products…" fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
                </View>
            ) : (
                <FlashList
                    data={filteredProducts}
                    estimatedItemSize={64}
                    keyExtractor={(item) => String(item.id)}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.listContent}
                    style={[styles.list, { backgroundColor: colors.background }]}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyState}>
                            <Lucide name={sourceConfig.icon} size={44} color={colors.border} />
                            <AppText label={sourceConfig.emptyTitle} variant={1} fontSize={16} color={colors.textTertiary} style={{ marginTop: 12 }} />
                            <AppText label={sourceConfig.emptySubtitle} fontSize={13} color={colors.textTertiary} style={{ marginTop: 6, textAlign: 'center' }} />
                        </View>
                    )}
                    renderItem={({ item, index }) => (
                        <ProductItem
                            key={item.id}
                            item={item}
                            index={index}
                            isSelected={!!selectedItems[item.id]}
                            multipleSelect={multipleSelect}
                            onPress={() => {
                                if (multipleSelect) {
                                    const tmp = { ...selectedItems };
                                    if (tmp[item.id]) {
                                        delete tmp[item.id];
                                    } else {
                                        tmp[item.id] = item;
                                    }
                                    setSelectedItems(tmp);
                                } else if (onSelect) {
                                    onSelect(item);
                                    navigation.goBack();
                                } else if (searchOnly) {
                                    navigation.goBack();
                                    navigation.navigate('NewSale', { selectedProduct: item });
                                } else {
                                    navigation.navigate('ProductDetails', { product: item });
                                }
                            }}
                        />
                    )}
                />
            )}
            {multipleSelect && selectedCount > 0 && (
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleMultiSelect}
                    style={[styles.fab, { backgroundColor: sourceConfig.accentColor }]}
                >
                    <Lucide name="check" color="#fff" size={24} />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    contextBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderLeftWidth: 4,
    },
    contextIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    searchInputWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 5,
        height: 44,
    },
    searchInput: {
        flex: 1,
        height: 44,
        marginLeft: 8,
        marginRight: 8,
        fontFamily: 'FiraSans-Regular',
        fontSize: 15,
        paddingVertical: 0,
    },
    multiSelectButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    selectedBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    confirmButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    listContent: {
        padding: 10,
        paddingBottom: 24,
    },
    list: {
        flex: 1,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        bottom: 24,
        right: 20,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
});

export default Search;