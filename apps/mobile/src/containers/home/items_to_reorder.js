import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import { FlashList } from '@shopify/flash-list';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { inventories as inventoriesApi } from '../../services/api';
import { normalizeLowStockList } from '../../utils/normalizeLowStockItem';

const ItemsToReorder = ({ navigation, route }) => {
    const { colors } = useTheme();
    const initialItems = normalizeLowStockList(route.params?.items || []);
    const [data, setData] = useState(initialItems);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (initialItems.length === 0) {
            loadItemsToReorder();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadItemsToReorder = async () => {
        setIsLoading(true);
        try {
            const list = await inventoriesApi.lowStock();
            setData(normalizeLowStockList(list));
        } catch (error) {
            console.error('Error loading items to reorder:', error);
            setData([]);
        } finally {
            setIsLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadItemsToReorder();
        setRefreshing(false);
    };

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data;
        const q = searchQuery.toLowerCase();
        return data.filter(item =>
            item.name.toLowerCase().includes(q) ||
            item.sku.toLowerCase().includes(q) ||
            (item.category && item.category.toLowerCase().includes(q))
        );
    }, [data, searchQuery]);

    const getStockStatus = (inventory, minimum) => {
        const percentage = (inventory / minimum) * 100;
        if (percentage < 50) return { label: 'Critical', color: '#ef4444', bg: '#fef2f2' };
        if (percentage < 75) return { label: 'Low', color: '#f59e0b', bg: '#fffbeb' };
        return { label: 'Below Reorder', color: config.THEME_COLOR, bg: '#e8f4fc' };
    };

    const backPress = () => {
        navigation.goBack();
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label="Items to Reorder">
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => navigation.navigate('Search', { source_nav: 'inventory', searchOnly: true })}
                        style={[styles.headerButton, { backgroundColor: colors.surface }]}
                    >
                        <Lucide name="search" color={config.THEME_COLOR} size={20} />
                    </TouchableOpacity>
                </View>
            </ScreenHeader>

            {/* Insights Strip */}
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.summaryRow}
                >
                    <View style={[styles.summaryPill, { backgroundColor: colors.surfaceSecondary }]}>
                        <Lucide name="list-filter" size={15} color={config.THEME_COLOR} />
                        <AppText label={`${filteredData.length} items`} variant={1} fontSize={12} color={colors.text} style={{ marginLeft: 6 }} />
                    </View>
                    <View style={[styles.summaryPill, { backgroundColor: '#fef2f2' }]}>
                        <Lucide name="triangle-alert" size={15} color={colors.error} />
                        <AppText
                            label={`${filteredData.filter(item => item.minimum > 0 && ((item.inventory / item.minimum) * 100) < 50).length} critical`}
                            variant={1}
                            fontSize={12}
                            color={colors.error}
                            style={{ marginLeft: 6 }}
                        />
                    </View>
                    <View style={[styles.summaryPill, { backgroundColor: '#fffbeb' }]}>
                        <Lucide name="rotate-cw" size={15} color="#d97706" />
                        <AppText
                            label={`${filteredData.filter(item => item.minimum > 0 && ((item.inventory / item.minimum) * 100) >= 50).length} low`}
                            fontSize={12}
                            color="#d97706"
                            style={{ marginLeft: 6 }}
                        />
                    </View>
                </ScrollView>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Lucide name="search" color={colors.textTertiary} size={18} style={{ marginLeft: 12 }} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search by name, SKU or category..."
                    placeholderTextColor={colors.placeholder}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8, marginRight: 8 }}>
                        <Lucide name="x" color={colors.textTertiary} size={16} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Items List */}
            {isLoading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading items..." color={colors.textTertiary} style={{ marginTop: 10 }} />
                </View>
            ) : (
                <FlashList
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 10, paddingTop: 0 }}
                    data={filteredData}
                    estimatedItemSize={132}
                    keyExtractor={(item) => item.id}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.THEME_COLOR} />
                    }
                    ListHeaderComponent={() =>
                        filteredData.length > 0 ? (
                            <View style={styles.listHeader}>
                                <AppText
                                    label={`${filteredData.length} item${filteredData.length !== 1 ? 's' : ''} below reorder point`}
                                    fontSize={13}
                                    color={colors.textTertiary}
                                />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={() => (
                        <View style={styles.emptyContainer}>
                            <Lucide name="package-check" color={colors.border} size={48} />
                            <AppText
                                label={searchQuery ? 'No items found' : 'All items are well stocked'}
                                variant={1}
                                fontSize={16}
                                color={colors.textTertiary}
                                style={{ marginTop: 12 }}
                            />
                            <AppText
                                label={searchQuery ? 'Try a different search term' : 'No items need reordering at this time'}
                                fontSize={13}
                                color={colors.textTertiary}
                                style={{ marginTop: 6, textAlign: 'center' }}
                            />
                        </View>
                    )}
                    renderItem={({ item }) => {
                        const status = getStockStatus(item.inventory, item.minimum);
                        const shortage = item.minimum - item.inventory;
                        const percentage = Math.round((item.inventory / item.minimum) * 100);

                        return (
                            <TouchableOpacity
                                activeOpacity={0.75}
                                onPress={() => navigation.navigate('ProductDetails', { product: item })}
                                style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                            >
                                <View style={[styles.priorityStripe, { backgroundColor: status.color }]} />
                                <View style={styles.itemMain}>
                                    <View style={styles.itemTopRow}>
                                        <View style={{ flex: 1, paddingRight: 10 }}>
                                            <AppText label={item.name} variant={1} fontSize={15} numberOfLines={1} color={colors.text} />
                                            <View style={styles.itemMeta}>
                                                <AppText label={item.sku} fontSize={12} color={colors.textSecondary} />
                                                {item.category ? (
                                                    <>
                                                        <Lucide name="dot" size={12} color={colors.textTertiary} />
                                                        <AppText label={item.category} fontSize={12} color={colors.textSecondary} numberOfLines={1} />
                                                    </>
                                                ) : null}
                                            </View>
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                                            <Lucide name="circle-alert" size={13} color={status.color} />
                                            <AppText label={status.label} fontSize={11} color={status.color} style={{ marginLeft: 4 }} />
                                        </View>
                                    </View>

                                    <View style={styles.metricRow}>
                                        <View style={[styles.metricChip, { backgroundColor: colors.surfaceSecondary }]}>
                                            <AppText label="Stock" fontSize={10} color={colors.textTertiary} />
                                            <AppText label={item.inventory ? item.inventory.toString() : '0'} variant={1} fontSize={13} color={colors.text} />
                                        </View>
                                        <View style={[styles.metricChip, { backgroundColor: colors.surfaceSecondary }]}>
                                            <AppText label="Min" fontSize={10} color={colors.textTertiary} />
                                            <AppText label={item.minimum ? item.minimum.toString() : '0'} variant={1} fontSize={13} color={colors.text} />
                                        </View>
                                        <View style={[styles.metricChip, { backgroundColor: '#fef2f2' }]}>
                                            <AppText label="Shortage" fontSize={10} color={colors.error} />
                                            <AppText label={`${shortage}`} variant={1} fontSize={13} color={colors.error} />
                                        </View>
                                    </View>

                                    <View style={styles.progressContainer}>
                                        <View style={[styles.progressBar, { backgroundColor: colors.surfaceSecondary }]}>
                                            <View
                                                style={[
                                                    styles.progressFill,
                                                    {
                                                        width: `${Math.min(percentage, 100)}%`,
                                                        backgroundColor: status.color,
                                                    },
                                                ]}
                                            />
                                        </View>
                                        <AppText label={`${percentage}% toward minimum threshold`} fontSize={11} color={colors.textTertiary} style={{ marginTop: 4 }} />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    headerActions: {
        flexDirection: 'row',
        paddingVertical: 5,
        marginRight: 10,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    summaryCard: {
        backgroundColor: '#fff',
        marginHorizontal: 12,
        marginTop: 8,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#eee',
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 4,
    },
    summaryPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        marginRight: 8,
        marginBottom: 0,
    },
    summaryItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#eee',
        marginHorizontal: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 30,
        marginHorizontal: 12,
        marginTop: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#eee',
    },
    searchInput: {
        flex: 1,
        height: 44,
        marginLeft: 8,
        marginRight: 8,
        fontFamily: 'FiraSans-Regular',
        fontSize: 15,
        color: '#333',
        paddingRight: 10,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    listHeader: {
        paddingBottom: 8,
        marginBottom: 4,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    itemCard: {
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        overflow: 'hidden',
        flexDirection: 'row',
    },
    priorityStripe: {
        width: 5,
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
    },
    itemMain: {
        flex: 1,
        padding: 12,
    },
    itemTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    metricRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    metricChip: {
        flex: 1,
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 8,
        marginRight: 8,
    },
    itemHeader: {
        marginBottom: 12,
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    itemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    itemBody: {
        marginTop: 8,
    },
    stockInfo: {
        gap: 8,
        marginBottom: 12,
    },
    stockRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressContainer: {
        marginTop: 6,
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
});

export default ItemsToReorder;
