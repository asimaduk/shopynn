import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import { FlashList } from '@shopify/flash-list';
import AppModal from '../../components/app_modal';
import useTheme from '../../hooks/useTheme';
import { categories as categoriesApi, normalizeList } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';

const ProductCategories = ({ navigation, route }) => {
    const { colors } = useTheme();
    const [categories, setCategories] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEnabling, setIsEnabling] = useState(false);
    const loadCategories = useCallback(async () => {
        try {
            const raw = await categoriesApi.list();
            // console.log('cat raw',raw);
            const list = normalizeList(raw);
            setCategories(list);
        } catch (_) {
            setCategories([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            setIsLoading(true);
            loadCategories();
        }, [loadCategories]),
    );

    // Filter categories based on search
    const filteredCategories = categories.filter(cat => 
        cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cat.description && cat.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const backPress = () => {
        navigation.goBack();
    }

    const handleEnableCategory = async () => {
        setIsEnabling(true);
        try {
            await categoriesApi.update(selectedCategory.id, { active: true });
            setShowMenu(false);
            setSelectedCategory({});
            setCategories((prev) => prev.map((cat) => cat.id === selectedCategory.id ? { ...cat, active: true } : cat));
            Alert.alert('Success', 'Category enabled successfully');
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to enable category.';  
            Alert.alert('Error', msg);
        }
        finally {
            setIsEnabling(false);
        }
    }

    const handleDisableCategory = () => {
        Alert.alert(
            'Disable Category',
            `Are you sure you want to disable "${selectedCategory.name}"? This action cannot be undone.`,
            [
                {text: 'Cancel', style: 'cancel'},
                {
                    text: 'Disable',
                    style: 'destructive',
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            await categoriesApi.delete(selectedCategory.id);
                            setCategories((prev) => prev.filter((cat) => cat.id !== selectedCategory.id));
                            setShowMenu(false);
                            setSelectedCategory({});
                            loadCategories();
                            Alert.alert('Success', 'Category disabled successfully');
                        } catch (err) {
                            const msg = err?.response?.data?.message || err?.message || 'Failed to disable category.';
                            Alert.alert('Error', msg);
                        } finally {
                            setIsDeleting(false);
                        }
                    }
                }
            ]
        );
    }

    return (
        <SafeAreaView style={{flex:1, backgroundColor: colors.background}}>
            <ScreenHeader onPress={backPress} label={`Product Categories (${categories.length})`}>
                <View style={{ flexDirection: 'row', paddingVertical: 0 }}>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => {
                            setShowSearch((prev) => {
                                const next = !prev;
                                if (!next) setSearchQuery('');
                                return next;
                            });
                        }}
                        style={[styles.addButton, { backgroundColor: colors.surface, marginRight: 10 }]}>
                        <Lucide name={showSearch ? 'x' : 'search'} color={colors.text} size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => navigation.navigate('CategoryForm')}
                        style={[styles.addButton, { backgroundColor: colors.surface }]}>
                        <Lucide name="plus" color={config.THEME_COLOR} size={20} />
                    </TouchableOpacity>
                </View>
            </ScreenHeader>

            {showSearch ? (
                <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="search" color={colors.textTertiary} size={18} style={{ marginLeft: 12 }} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search categories..."
                        placeholderTextColor={colors.placeholder}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCorrect={false}
                        autoCapitalize="none"
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 ? (
                        <TouchableOpacity
                            activeOpacity={0.6}
                            onPress={() => setSearchQuery('')}
                            style={{ padding: 8, marginRight: 8 }}>
                            <Lucide name="x" color={colors.textTertiary} size={16} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}

            {/* Categories List */}
            {isLoading ? (
                <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label={'Loading categories...'} color={colors.textSecondary} style={{marginTop:10}} />
                </View>
            ) : (
                <FlashList
                    style={{flex:1}}
                    contentContainerStyle={{padding:10}}
                    data={filteredCategories}
                    showsVerticalScrollIndicator={false}
                    // ListHeaderComponent={() => {
                    //     const total = categories.length;
                    //     const visible = filteredCategories.length;
                    //     const activeCount = categories.filter((c) => c.is_active !== false && c.active !== false).length;
                    //     return (
                    //         <View style={[styles.headerCard, { backgroundColor: colors.surface }]}>
                    //             <View style={[styles.headerIconContainer, { backgroundColor: colors.primaryShade }]}>
                    //                 <Lucide name="grid-3x3" color={config.THEME_COLOR} size={22} />
                    //             </View>
                    //             <View style={{ flex: 1, marginLeft: 12 }}>
                    //                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    //                     <AppText
                    //                         label="Categories overview"
                    //                         fontSize={15}
                    //                         variant={1}
                    //                         color={colors.text}
                    //                     />
                    //                     <AppText
                    //                         label={`${visible} shown`}
                    //                         fontSize={11}
                    //                         color={colors.textTertiary}
                    //                     />
                    //                 </View>
                    //                 <View style={{ flexDirection: 'row', marginTop: 6 }}>
                    //                     <View
                    //                         style={{
                    //                             flexDirection: 'row',
                    //                             alignItems: 'center',
                    //                             paddingHorizontal: 10,
                    //                             paddingVertical: 3,
                    //                             borderRadius: 999,
                    //                             backgroundColor: colors.surfaceSecondary,
                    //                             marginRight: 8,
                    //                         }}
                    //                     >
                    //                         <Lucide name="layers-3" size={12} color={colors.textSecondary} />
                    //                         <AppText
                    //                             label={`${total} total`}
                    //                             fontSize={11}
                    //                             color={colors.textSecondary}
                    //                             style={{ marginLeft: 4 }}
                    //                         />
                    //                     </View>
                    //                     <View
                    //                         style={{
                    //                             flexDirection: 'row',
                    //                             alignItems: 'center',
                    //                             paddingHorizontal: 10,
                    //                             paddingVertical: 3,
                    //                             borderRadius: 999,
                    //                             backgroundColor: config.GREEN_COLOR + '15',
                    //                         }}
                    //                     >
                    //                         <View
                    //                             style={{
                    //                                 width: 6,
                    //                                 height: 6,
                    //                                 borderRadius: 3,
                    //                                 backgroundColor: config.GREEN_COLOR,
                    //                                 marginRight: 4,
                    //                             }}
                    //                         />
                    //                         <AppText
                    //                             label={`${activeCount} active`}
                    //                             fontSize={11}
                    //                             color={config.GREEN_COLOR}
                    //                         />
                    //                     </View>
                    //                 </View>
                    //             </View>
                    //         </View>
                    //     );
                    // }}
                    ListEmptyComponent={() => (
                        <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
                            <Lucide name="folder-x" color={colors.textTertiary} size={48} />
                            <AppText label={searchQuery ? 'No categories found' : 'No categories yet'} variant={1} fontSize={16} color={colors.textSecondary} style={{marginTop:12}} />
                            <AppText label={searchQuery ? 'Try a different search term' : 'Tap the + button to add your first category'} fontSize={13} color={colors.textSecondary} style={{marginTop:6,textAlign:'center'}} />
                        </View>
                    )}
                    keyExtractor={(item) => `category-${item.id}`}
                    estimatedItemSize={90}
                    renderItem={({ item }) => {
                        const isActive = item.is_active !== false && item.active !== false;
                        const productCount = Number(item.product_count ?? 0);
                        return (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                    setSelectedCategory(item);
                                    setShowMenu(true);
                                }}
                                style={[
                                    styles.categoryCard,
                                    {
                                        backgroundColor: colors.surface,
                                        paddingVertical: 10,
                                        paddingHorizontal: 12,
                                        borderRadius: 8,
                                    },
                                ]}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {/* <View
                                        style={{
                                            width: 3,
                                            height: '100%',
                                            borderRadius: 2,
                                            backgroundColor: isActive ? config.GREEN_COLOR : colors.border,
                                            marginRight: 10,
                                        }}
                                    /> */}
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Lucide
                                                name="folder"
                                                size={16}
                                                color={colors.textTertiary}
                                                style={{ marginRight: 6 }}
                                            />
                                            <AppText
                                                label={item.name}
                                                fontSize={15}
                                                variant={1}
                                                numberOfLines={1}
                                                color={colors.text}
                                                style={{ flex: 1 }}
                                            />
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    marginLeft: 8,
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: 4,
                                                        backgroundColor: isActive ? config.GREEN_COLOR : colors.border,
                                                        marginRight: 4,
                                                    }}
                                                />
                                                <AppText
                                                    label={isActive ? 'Active' : 'Inactive'}
                                                    fontSize={11}
                                                    color={colors.textTertiary}
                                                />
                                            </View>
                                        </View>
                                        {item.description ? (
                                            <AppText
                                                label={item.description}
                                                fontSize={12}
                                                color={colors.textSecondary}
                                                numberOfLines={1}
                                                style={{ marginTop: 2 }}
                                            />
                                        ) : null}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                            <AppText
                                                label={`${productCount} product${productCount !== 1 ? 's' : ''}`}
                                                fontSize={11}
                                                color={colors.textTertiary}
                                            />
                                        </View>
                                    </View>
                                    <Lucide
                                        name="chevron-right"
                                        color={colors.textTertiary}
                                        size={18}
                                        style={{ marginLeft: 8 }}
                                    />
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}

            <AppModal 
                title={selectedCategory.name || 'Category Options'} 
                visible={showMenu} 
                handleClose={()=> {
                    setShowMenu(false);
                    setSelectedCategory({});
                }} 
                onRequestClose={()=> {
                    setShowMenu(false);
                    setSelectedCategory({});
                }}>
                <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                    {selectedCategory.description && (
                        <View style={styles.modalHeader}>
                            <AppText label={selectedCategory.description} fontSize={13} color={colors.textSecondary} numberOfLines={2} />
                        </View>
                    )}

                    {selectedCategory.active !== false && (
                        <TouchableOpacity
                            activeOpacity={.6}
                            onPress={()=> {
                                setShowMenu(false);
                                setTimeout(() => {
                                    navigation.navigate('ProductsByCategory', {category: selectedCategory});
                                }, 100);
                            }}
                            style={[styles.modalOption, { backgroundColor: colors.surface }]}>
                            <View style={[styles.modalOptionIcon, { backgroundColor: colors.primaryShade }]}>
                                <Lucide name="square-stack" color={config.THEME_COLOR} size={20} />
                            </View>
                            <View style={{flex:1,marginLeft:12}}>
                                <AppText label={'View Products'} variant={1} fontSize={15} color={colors.text} />
                                <AppText
                                    label={`${Number(selectedCategory.product_count ?? 0)} products in this category`}
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{marginTop:2}}
                                />
                            </View>
                            <Lucide name="chevron-right" color={colors.border} size={18} />
                        </TouchableOpacity>
                    )}
                    {selectedCategory.active !== false && (
                        <TouchableOpacity
                            activeOpacity={.6}
                            onPress={()=> {
                                setShowMenu(false);
                                setTimeout(() => {
                                    navigation.navigate('CategoryForm', {category: selectedCategory});
                                }, 100);
                            }}
                            style={[styles.modalOption, { backgroundColor: colors.surface }]}>
                            <View style={[styles.modalOptionIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="pencil" color={colors.textSecondary} size={20} />
                            </View>
                            <View style={{flex:1,marginLeft:12}}>
                                <AppText label={'Edit Category'} variant={1} fontSize={15} color={colors.text} />
                                <AppText label={'Update name and description'} fontSize={12} color={colors.textTertiary} style={{marginTop:2}} />
                            </View>
                            <Lucide name="chevron-right" color={colors.border} size={18} />
                        </TouchableOpacity>
                    )}
                    <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />

                    {selectedCategory.active !== false ? (
                        <TouchableOpacity
                            activeOpacity={.6}
                            onPress={handleDisableCategory}
                            disabled={isDeleting}
                            style={[styles.modalOption, styles.deleteOption, { backgroundColor: colors.surface }, isDeleting && styles.deleteOptionDisabled]}>
                            {isDeleting ? (
                                <ActivityIndicator size="small" color={colors.error} style={{marginRight:12}} />
                            ) : (
                                <View style={[styles.modalOptionIcon, { backgroundColor: colors.errorLight }]}>
                                    <Lucide name="trash-2" color={colors.error} size={20} />
                                </View>
                            )}
                            <View style={{flex:1,marginLeft:12}}>
                                <AppText label={isDeleting ? 'Please wait...' : 'Disable Category'} variant={1} fontSize={15} color={colors.error} />
                                <AppText label={'This action will hide the category from users'} fontSize={12} color={colors.textTertiary} style={{marginTop:2}} />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            activeOpacity={.6}
                            onPress={handleEnableCategory}
                            disabled={isEnabling}
                            style={[styles.modalOption, { backgroundColor: colors.surface }]}>
                            <View style={[styles.modalOptionIcon, { backgroundColor: config.THEME_COLOR + '20' }]}>
                                <Lucide name="circle-check" color={config.THEME_COLOR} size={20} />
                            </View>
                            <View style={{flex:1,marginLeft:12}}>
                                <AppText label={isEnabling ? 'Please wait...' : 'Enable Category'} variant={1} fontSize={15} color={config.THEME_COLOR} />
                                <AppText label={'This action will make the category visible to users'} fontSize={12} color={colors.textTertiary} style={{marginTop:2}} />
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </AppModal>
        </SafeAreaView>
    )
}

export default ProductCategories;

const styles = StyleSheet.create({
    // Header button
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        marginBottom: 5
    },
    // Search
    searchContainer: {
        flexDirection:'row',
        alignItems:'center',
        backgroundColor:'#fff',
        borderRadius:25,
        marginTop:10,
        marginHorizontal:10,
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
    // Loading
    loadingContainer: {
        flex:1,
        justifyContent:'center',
        alignItems:'center',
        paddingVertical:40
    },
    // Header card
    headerCard: {
        flexDirection:'row',
        alignItems:'center',
        backgroundColor:'#fff',
        padding:15,
        borderRadius:10,
        marginBottom:10,
        shadowColor:'#000',
        shadowOffset:{width:0,height:1},
        shadowOpacity:0.05,
        shadowRadius:2,
        elevation:2
    },
    headerIconContainer: {
        width:40,
        height:40,
        borderRadius:20,
        backgroundColor:'#f0f7ff',
        justifyContent:'center',
        alignItems:'center'
    },
    // Category card
    categoryCard: {
        flexDirection:'row',
        alignItems:'center',
        backgroundColor:'#fff',
        padding:15,
        borderRadius:10,
        marginBottom:10,
        shadowColor:'#000',
        shadowOffset:{width:0,height:1},
        shadowOpacity:0.05,
        shadowRadius:2,
        elevation:2
    },
    categoryIconContainer: {
        width:48,
        height:48,
        borderRadius:24,
        backgroundColor:'#f0f7ff',
        justifyContent:'center',
        alignItems:'center'
    },
    menuButton: {
        width:32,
        height:32,
        justifyContent:'center',
        alignItems:'center'
    },
    // Empty state
    emptyContainer: {
        flex:1,
        justifyContent:'center',
        alignItems:'center',
        paddingVertical:60,
        paddingHorizontal:40
    },
    // Modal
    modalContent: {
        padding:10
    },
    modalHeader: {
        paddingHorizontal:10,
        marginBottom:5
    },
    modalOption: {
        flexDirection:'row',
        alignItems:'center',
        padding:15,
        borderRadius:10,
        marginBottom:8,
        backgroundColor:'#f8f8f8'
    },
    modalOptionIcon: {
        width:40,
        height:40,
        borderRadius:20,
        justifyContent:'center',
        alignItems:'center'
    },
    modalDivider: {
        height:1,
        backgroundColor:'#eee',
        marginVertical:8,
        marginHorizontal:10
    },
    deleteOption: {
        backgroundColor:'#fff5f5'
    },
    deleteOptionDisabled: {
        opacity:0.6
    }
})