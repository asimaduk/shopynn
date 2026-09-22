import React, { useState, useCallback, useMemo } from 'react';
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

const ProductCategories = ({ navigation }) => {
    const { colors } = useTheme();
    const [categories, setCategories] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEnabling, setIsEnabling] = useState(false);

    const loadCategories = useCallback(async () => {
        try {
            const raw = await categoriesApi.list();
            setCategories(normalizeList(raw) || []);
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

    const filteredCategories = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return categories;
        return categories.filter(
            (cat) =>
                cat.name?.toLowerCase().includes(q) ||
                (cat.description && cat.description.toLowerCase().includes(q)),
        );
    }, [categories, searchQuery]);

    const activeCount = useMemo(
        () => categories.filter((c) => c.is_active !== false && c.active !== false).length,
        [categories],
    );

    const filtering = searchQuery.trim().length > 0;

    const backPress = () => navigation.goBack();

    const handleEnableCategory = async () => {
        setIsEnabling(true);
        try {
            await categoriesApi.update(selectedCategory.id, { active: true });
            setShowMenu(false);
            setSelectedCategory({});
            setCategories((prev) =>
                prev.map((cat) => (cat.id === selectedCategory.id ? { ...cat, active: true } : cat)),
            );
            Alert.alert('Success', 'Category enabled successfully');
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to enable category.';
            Alert.alert('Error', msg);
        } finally {
            setIsEnabling(false);
        }
    };

    const handleDisableCategory = () => {
        Alert.alert(
            'Disable Category',
            `Are you sure you want to disable "${selectedCategory.name}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
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
                    },
                },
            ],
        );
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label="Product Categories">
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('CategoryForm')}
                    style={[styles.headerBtn, { backgroundColor: colors.surface }]}
                >
                    <Lucide name="plus" color={config.THEME_COLOR} size={18} />
                </TouchableOpacity>
            </ScreenHeader>

            <View style={styles.summaryRow}>
                <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="layers-3" size={14} color={config.THEME_COLOR} />
                    <AppText
                        label={`${filteredCategories.length} categor${filteredCategories.length === 1 ? 'y' : 'ies'}`}
                        fontSize={13}
                        variant={1}
                        color={colors.text}
                        style={{ marginLeft: 6 }}
                    />
                </View>
                <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.statusDot, { backgroundColor: config.GREEN_COLOR || '#16a34a' }]} />
                    <AppText
                        label={`${activeCount} active`}
                        fontSize={13}
                        variant={1}
                        color={colors.text}
                        style={{ marginLeft: 6 }}
                    />
                </View>
            </View>

            <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Lucide name="search" size={16} color={colors.textTertiary} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search name or description"
                    placeholderTextColor={colors.placeholder}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                />
                {searchQuery.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Lucide name="x" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                ) : null}
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading categories..." color={colors.textTertiary} style={{ marginTop: 10 }} />
                </View>
            ) : (
                <View style={styles.listWrap}>
                    <FlashList
                        style={styles.list}
                        contentContainerStyle={styles.listContent}
                        data={filteredCategories}
                        estimatedItemSize={100}
                        showsVerticalScrollIndicator={false}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item }) => {
                            const isActive = item.is_active !== false && item.active !== false;
                            const productCount = Number(item.product_count ?? 0);
                            const statusColor = isActive ? config.GREEN_COLOR || '#16a34a' : colors.textTertiary;

                            return (
                                <TouchableOpacity
                                    activeOpacity={0.75}
                                    onPress={() => {
                                        setSelectedCategory(item);
                                        setShowMenu(true);
                                    }}
                                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                >
                                    <View style={styles.topRow}>
                                        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary || `${config.THEME_COLOR}12` }]}>
                                            <Lucide name="folder" size={18} color={colors.textTertiary} />
                                        </View>
                                        <View style={styles.main}>
                                            <AppText
                                                label={item.name}
                                                variant={1}
                                                fontSize={15}
                                                color={colors.text}
                                                numberOfLines={1}
                                            />
                                            {item.description ? (
                                                <AppText
                                                    label={item.description}
                                                    fontSize={12}
                                                    color={colors.textSecondary}
                                                    numberOfLines={1}
                                                    style={{ marginTop: 3 }}
                                                />
                                            ) : null}
                                            <View style={styles.metaRow}>
                                                <Lucide name="package" size={12} color={colors.textTertiary} />
                                                <AppText
                                                    label={`${productCount} product${productCount === 1 ? '' : 's'}`}
                                                    fontSize={12}
                                                    color={colors.textTertiary}
                                                    style={{ marginLeft: 6 }}
                                                />
                                            </View>
                                        </View>
                                        <View style={styles.trailing}>
                                            <View style={styles.statusRow}>
                                                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                                <AppText
                                                    label={isActive ? 'Active' : 'Inactive'}
                                                    fontSize={11}
                                                    color={statusColor}
                                                />
                                            </View>
                                            <Lucide name="chevron-right" color={colors.border} size={18} style={{ marginTop: 8 }} />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyWrap}>
                                <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="folder-x" color={colors.textTertiary} size={28} />
                                </View>
                                <AppText
                                    label={filtering ? 'No categories match' : 'No categories yet'}
                                    variant={1}
                                    fontSize={16}
                                    color={colors.text}
                                    style={{ marginTop: 12 }}
                                />
                                <AppText
                                    label={
                                        filtering
                                            ? 'Try another search term'
                                            : 'Add a category to organize your products'
                                    }
                                    fontSize={13}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 4, textAlign: 'center' }}
                                />
                                {!filtering ? (
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={() => navigation.navigate('CategoryForm')}
                                        style={[styles.emptyCta, { backgroundColor: config.THEME_COLOR }]}
                                    >
                                        <Lucide name="plus" size={16} color="#fff" />
                                        <AppText
                                            label="Add category"
                                            color="#fff"
                                            variant={1}
                                            fontSize={14}
                                            style={{ marginLeft: 6 }}
                                        />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        )}
                    />
                </View>
            )}

            <AppModal
                title={selectedCategory.name || 'Category Options'}
                visible={showMenu}
                handleClose={() => {
                    setShowMenu(false);
                    setSelectedCategory({});
                }}
                onRequestClose={() => {
                    setShowMenu(false);
                    setSelectedCategory({});
                }}
            >
                <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                    {selectedCategory.description ? (
                        <View style={styles.modalHeader}>
                            <AppText
                                label={selectedCategory.description}
                                fontSize={13}
                                color={colors.textSecondary}
                                numberOfLines={2}
                            />
                        </View>
                    ) : null}

                    {selectedCategory.active !== false ? (
                        <TouchableOpacity
                            activeOpacity={0.6}
                            onPress={() => {
                                setShowMenu(false);
                                setTimeout(() => {
                                    navigation.navigate('ProductsByCategory', { category: selectedCategory });
                                }, 100);
                            }}
                            style={[styles.modalOption, { backgroundColor: colors.surface }]}
                        >
                            <View style={[styles.modalOptionIcon, { backgroundColor: colors.primaryShade }]}>
                                <Lucide name="square-stack" color={config.THEME_COLOR} size={20} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <AppText label="View Products" variant={1} fontSize={15} color={colors.text} />
                                <AppText
                                    label={`${Number(selectedCategory.product_count ?? 0)} products in this category`}
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 2 }}
                                />
                            </View>
                            <Lucide name="chevron-right" color={colors.border} size={18} />
                        </TouchableOpacity>
                    ) : null}

                    {selectedCategory.active !== false ? (
                        <TouchableOpacity
                            activeOpacity={0.6}
                            onPress={() => {
                                setShowMenu(false);
                                setTimeout(() => {
                                    navigation.navigate('CategoryForm', { category: selectedCategory });
                                }, 100);
                            }}
                            style={[styles.modalOption, { backgroundColor: colors.surface }]}
                        >
                            <View style={[styles.modalOptionIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="pencil" color={colors.textSecondary} size={20} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <AppText label="Edit Category" variant={1} fontSize={15} color={colors.text} />
                                <AppText
                                    label="Update name and description"
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 2 }}
                                />
                            </View>
                            <Lucide name="chevron-right" color={colors.border} size={18} />
                        </TouchableOpacity>
                    ) : null}

                    <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />

                    {selectedCategory.active !== false ? (
                        <TouchableOpacity
                            activeOpacity={0.6}
                            onPress={handleDisableCategory}
                            disabled={isDeleting}
                            style={[
                                styles.modalOption,
                                styles.deleteOption,
                                { backgroundColor: colors.surface },
                                isDeleting && styles.deleteOptionDisabled,
                            ]}
                        >
                            {isDeleting ? (
                                <ActivityIndicator size="small" color={colors.error} style={{ marginRight: 12 }} />
                            ) : (
                                <View style={[styles.modalOptionIcon, { backgroundColor: colors.errorLight }]}>
                                    <Lucide name="trash-2" color={colors.error} size={20} />
                                </View>
                            )}
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <AppText
                                    label={isDeleting ? 'Please wait...' : 'Disable Category'}
                                    variant={1}
                                    fontSize={15}
                                    color={colors.error}
                                />
                                <AppText
                                    label="This action will hide the category from users"
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 2 }}
                                />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            activeOpacity={0.6}
                            onPress={handleEnableCategory}
                            disabled={isEnabling}
                            style={[styles.modalOption, { backgroundColor: colors.surface }]}
                        >
                            <View style={[styles.modalOptionIcon, { backgroundColor: config.THEME_COLOR + '20' }]}>
                                <Lucide name="circle-check" color={config.THEME_COLOR} size={20} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <AppText
                                    label={isEnabling ? 'Please wait...' : 'Enable Category'}
                                    variant={1}
                                    fontSize={15}
                                    color={config.THEME_COLOR}
                                />
                                <AppText
                                    label="This action will make the category visible to users"
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 2 }}
                                />
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </AppModal>
        </SafeAreaView>
    );
};

export default ProductCategories;

const styles = StyleSheet.create({
    safe: { flex: 1 },
    headerBtn: {
        height: 34,
        width: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginHorizontal: 15,
        marginTop: 10,
        marginBottom: 10,
    },
    summaryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        height: 46,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontFamily: 'FiraSans-Regular',
        fontSize: 14,
    },
    listWrap: { flex: 1, minHeight: 0 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 15, paddingBottom: 28 },
    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        marginBottom: 10,
    },
    topRow: { flexDirection: 'row', alignItems: 'flex-start' },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    main: { flex: 1, minWidth: 0, marginRight: 8 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    trailing: { alignItems: 'flex-end' },
    statusRow: { flexDirection: 'row', alignItems: 'center' },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyWrap: {
        paddingTop: 48,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    emptyIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyCta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 18,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
    },
    modalContent: { padding: 10 },
    modalHeader: { paddingHorizontal: 10, marginBottom: 5 },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 10,
        marginBottom: 8,
    },
    modalOptionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalDivider: {
        height: 1,
        marginVertical: 8,
        marginHorizontal: 10,
    },
    deleteOption: {},
    deleteOptionDisabled: { opacity: 0.6 },
});
