import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Image, TextInput, Platform, ActivityIndicator, KeyboardAvoidingView, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../../components/text';
import config from '../../config';
import { FlashList } from '@shopify/flash-list';
import Lucide from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import useTheme from '../../hooks/useTheme';
import { useFocusEffect } from '@react-navigation/native';
import { products as productsApi, categories as categoriesApi, normalizeList } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { Share } from 'react-native';

const { height } = Dimensions.get('screen');

const ProductsByCategory = ({ navigation, route }) => {
    const { colors } = useTheme();
    const [searchText, setSearchText] = useState('');
    const [showCategories, setShowCategories] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(route.params && route.params.category);
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categoriesSearch, setCategoriesSearch] = useState('');

    const backPress = () => {
        navigation.goBack();
    }

    const handleClose = () => {
        setShowCategories(false);
    };

    // Load categories once
    useFocusEffect(
        React.useCallback(() => {
            let mounted = true;
            categoriesApi
                .list()
                .then((raw) => {
                    if (!mounted) return;
                    const list = normalizeList(raw);
                    const mapped = (Array.isArray(list) ? list : []).map((c) => ({
                        id: c.id,
                        name: c.name || c.label || 'Category',
                    }));
                    setCategories(mapped);
                    if (!selectedCategory && mapped.length > 0) {
                        setSelectedCategory(mapped[0]);
                    }
                })
                .catch(() => {
                    if (!mounted) return;
                    setCategories([]);
                });
            return () => {
                mounted = false;
            };
        }, [selectedCategory]),
    );

    const loadProducts = useCallback(async () => {
        if (!selectedCategory?.id) {
            setItems([]);
            setLoading(false);
            return;
        }
        try {
            const raw = await productsApi.byCategory(selectedCategory.id);
            const list = normalizeList(raw);
            console.log('products',list);
            const mapped = (Array.isArray(list) ? list : []).map((p) => ({
                ...p,
                id: p.id,
                name: p.name || p.product_name || 'Product',
                sku: p.sku,
                unit_price: String(p.unit_price ?? p.price ?? 0),
                inventory: p.inventory ?? p.quantity_available ?? 0,
                thumbnail: p.thumbnail || null,
                categories: p.categories || [],
            }));
            setItems(mapped);
        } catch (err) {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [selectedCategory]);

    useFocusEffect(
        React.useCallback(() => {
            setLoading(true);
            loadProducts();
        }, [loadProducts]),
    );

    const filteredProducts = useMemo(() => {
        let list = [...items];
        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            list = list.filter((item) => {
                const name = (item.name || '').toLowerCase();
                const sku = (item.sku || '').toLowerCase();
                return name.includes(q) || sku.includes(q);
            });
        }
        return list;
    }, [items, searchText]);

    const filteredCategories = useMemo(() => {
        let list = [...categories];
        if (categoriesSearch.trim()) {
            const q = categoriesSearch.toLowerCase();
            list = list.filter((c) => (c.name || '').toLowerCase().includes(q));
        }
        return list;
    }, [categories, categoriesSearch]);

    const generateCSV = () => {
      const headers = 'Name,SKU,Price,Quantity,Category\n';
      const escapeCSV = (str) => {
        if (str == null) return '';
        const string = String(str);
        if (string.includes(',') || string.includes('"') || string.includes('\n')) {
            return `"${string.replace(/"/g, '""')}"`;
        }
        return string;  
      };
      
      const rows = filteredProducts.map((p) => {
        return [
          escapeCSV(p.name),
          escapeCSV(p.sku),
          escapeCSV(p.unit_price),
          escapeCSV(p.inventory),
          escapeCSV(p.category_names.join(', ')),
        ].join(',');
      });
      return headers + rows.join('\n');
    };

    const handleExportProducts = async () => {
      if (filteredProducts.length === 0) {
        Alert.alert('No Data', 'There are no products to export.');
        return;
      }

      const csvContent = generateCSV();
      
      await Share.share({
          message: csvContent,
          title: `Products_${selectedCategory?.name}_${new Date().toISOString().split('T')[0]}.csv`,
      });
    }

    if (loading) {
        return (
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}>
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading products..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
                </SafeAreaView>
            </KeyboardAvoidingView>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{flex:1}}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={backPress} label={`Category: ${selectedCategory?.name}`}>
                    <View style={{ flexDirection: 'row', marginVertical: 5, marginRight: 5 }}>
                        <TouchableOpacity
                            activeOpacity={.6}
                            onPress={() => setShowCategories(true)}
                            style={{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceSecondary }}>
                            <Lucide name="settings-2" color={colors.text} size={20} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={.6}
                            onPress={handleExportProducts}
                            style={{ width: 40, height: 40, borderRadius: 40, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }}>
                            <Lucide name="square-arrow-out-up-right" color={colors.text} size={20} />
                        </TouchableOpacity>
                    </View>
                </ScreenHeader>
                {filteredProducts.length > 0 && (
                    <View style={{ padding: 10, paddingBottom: 0 }}>
                        <AppText label={`${filteredProducts.length} products found`} variant={2} fontSize={14} color={colors.textTertiary} />
                    </View>
                )}
                <FlashList
                    data={filteredProducts}
                    style={{ backgroundColor: colors.background, padding: 10 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    estimatedItemSize={72}
                    keyExtractor={(item) => String(item.id)}
                    ListEmptyComponent={() => {
                        const hasSearch = searchText.trim().length > 0;
                        return (
                            <View style={{ alignItems: 'center', marginTop: 50, paddingHorizontal: 24 }}>
                                <View
                                    style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: 28,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: colors.surfaceSecondary,
                                    }}>
                                    <Lucide name={hasSearch ? 'search-x' : 'package'} size={26} color={config.THEME_COLOR} />
                                </View>
                                <AppText
                                    label={hasSearch ? 'No products found' : 'No products in this category'}
                                    variant={1}
                                    color={colors.text}
                                    style={{ marginTop: 14, textAlign: 'center' }}
                                />
                                <AppText
                                    label={
                                        hasSearch
                                            ? 'Try a different search term.'
                                            : `No items are listed under ${selectedCategory?.name || 'this category'} yet.`
                                    }
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 4, textAlign: 'center' }}
                                />
                            </View>
                        );
                    }}
                    renderItem={({ item, index }) => (
                        <TouchableOpacity
                            key={index}
                            activeOpacity={.6}
                            onPress={() => {
                                navigation.navigate("ProductDetails", { product: item })
                            }}
                            style={{ backgroundColor: colors.surface, padding: 5, borderRadius: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Image source={item.thumbnail ?
                                { uri: config.BASE_API + '/images?id=' + item.thumbnail }
                                :
                                require('../../assets/images/product-image-placeholder.png')}
                                style={{ width: 40, height: 40, borderRadius: 5, backgroundColor: colors.border }} />
                            <View style={{ flex: 1, padding: 4, marginRight: 10 }}>
                                {/* <View style={{ flexDirection: 'row', alignItems: 'center' }}> */}
                                    <AppText label={item.name} variant={1} fontSize={16} color={colors.text} />
                                    {item.category_names?.length > 0 && (<AppText label={'(' + item.category_names.join(', ') + ')'} variant={2} style={{ fontSize: 12 }} color={colors.textTertiary} />)}
                                {/* </View> */}
                                <AppText label={`${item.inventory} in Stock`} variant={2} fontSize={13} style={{  }} color={colors.text} />
                            </View>
                            {/* <View style={{ alignItems: 'center' }}> */}
                                <AppText label={formatCurrency(item.unit_price)} variant={1} color={colors.text} style={{ marginRight: 5 }} />
                                {/* <AppText label={'GHS'} fontSize={10} color={colors.textSecondary} /> */}
                            {/* </View> */}
                        </TouchableOpacity>
                    )}
                />

                <AppModal title={`Select category [${categories.length}]`} handleClose={handleClose} onRequestClose={handleClose} visible={showCategories}>
                    <View style={{ padding: 10, paddingBottom: 0 }}>
                        <TextInput
                            placeholder='Search...'
                            value={categoriesSearch}
                            onChangeText={setCategoriesSearch}
                            style={{ height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 5, paddingHorizontal: 10, fontFamily: 'FiraSans-Regular', color: colors.text }}
                        />

                        <View style={{ padding: 5, height: (filteredCategories.length * 45) > (height / 2.5) ? height / 2.5 : filteredCategories.length * 50 }}>
                            <FlashList
                              keyboardShouldPersistTaps="handled"
                              showsVerticalScrollIndicator={false}
                              data={filteredCategories}
                              keyExtractor={(item) => item.id}
                              renderItem={({ item, index }) => (
                                  <TouchableOpacity
                                      activeOpacity={.6}
                                      onPress={() => {
                                          setSelectedCategory(item);
                                          setTimeout(() => {
                                              setShowCategories(false);
                                          }, 100);
                                      }}
                                      style={{ backgroundColor: colors.surface, height: 45, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: index < categories.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                                      <AppText label={`${index + 1}.`} style={{ width: 18 }} color={colors.textTertiary} />
                                      <AppText label={item.name} style={{ flex: 1, marginLeft: 10 }} color={colors.text} />
                                      {(item.id === selectedCategory.id) && (<Lucide name="check" color={config.THEME_COLOR} size={20} />)}
                                  </TouchableOpacity>
                              )}
                            />
                        </View>
                    </View>
                </AppModal>
            </SafeAreaView>
        </KeyboardAvoidingView>
    )
}

export default ProductsByCategory;