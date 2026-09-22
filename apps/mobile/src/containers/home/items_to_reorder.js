import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    StyleSheet,
    TouchableOpacity,
    View,
    TextInput,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import { FlashList } from '@shopify/flash-list';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { inventories as inventoriesApi } from '../../services/api';
import { normalizeLowStockList } from '../../utils/normalizeLowStockItem';

const getStockLevel = (inventory, minimum) => {
    if (!minimum || minimum <= 0) return 'low';
    const pct = (inventory / minimum) * 100;
    if (pct < 50) return 'critical';
    return 'low';
};

const ItemsToReorder = ({ navigation, route }) => {
    const { colors, isDark } = useTheme();
    const initialItems = normalizeLowStockList(route.params?.items || []);
    const [data, setData] = useState(initialItems);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [filter, setFilter] = useState('all'); // all | critical | low
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const statusTheme = useMemo(
        () => ({
            critical: {
                label: 'Critical',
                color: colors.error,
                soft: isDark ? 'rgba(239,68,68,0.16)' : '#fef2f2',
                bar: '#ef4444',
            },
            low: {
                label: 'Low',
                color: '#d97706',
                soft: isDark ? 'rgba(217,119,6,0.18)' : '#fffbeb',
                bar: '#f59e0b',
            },
        }),
        [colors.error, isDark]
    );

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

    const counts = useMemo(() => {
        let critical = 0;
        let low = 0;
        data.forEach((item) => {
            if (getStockLevel(item.inventory, item.minimum) === 'critical') critical += 1;
            else low += 1;
        });
        return { total: data.length, critical, low };
    }, [data]);

    const filteredData = useMemo(() => {
        let list = data;
        if (filter === 'critical') {
            list = list.filter((item) => getStockLevel(item.inventory, item.minimum) === 'critical');
        } else if (filter === 'low') {
            list = list.filter((item) => getStockLevel(item.inventory, item.minimum) === 'low');
        }
        if (!searchQuery.trim()) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(
            (item) =>
                item.name.toLowerCase().includes(q) ||
                String(item.sku || '')
                    .toLowerCase()
                    .includes(q) ||
                (item.category && item.category.toLowerCase().includes(q))
        );
    }, [data, searchQuery, filter]);

    const backPress = () => navigation.goBack();

    const openProduct = useCallback(
        (item) => {
            navigation.navigate('ProductDetails', { product: item });
        },
        [navigation]
    );

    const renderItem = useCallback(
        ({ item }) => {
            const level = getStockLevel(item.inventory, item.minimum);
            const status = statusTheme[level];
            const shortage = Math.max(0, Number(item.minimum) - Number(item.inventory));
            const percentage =
                item.minimum > 0
                    ? Math.min(100, Math.round((item.inventory / item.minimum) * 100))
                    : 0;

            return (
                <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => openProduct(item)}
                    style={[
                        styles.card,
                        {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <View style={styles.cardTop}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                            <AppText
                                label={item.name}
                                variant={1}
                                fontSize={16}
                                numberOfLines={2}
                                color={colors.text}
                            />
                            <AppText
                                label={[item.sku, item.category].filter(Boolean).join(' · ')}
                                fontSize={12}
                                color={colors.textTertiary}
                                style={{ marginTop: 4 }}
                                numberOfLines={1}
                            />
                        </View>
                        <View style={[styles.badge, { backgroundColor: status.soft }]}>
                            <Lucide
                                name={level === 'critical' ? 'triangle-alert' : 'circle-alert'}
                                size={12}
                                color={status.color}
                            />
                            <AppText
                                label={status.label}
                                fontSize={11}
                                variant={1}
                                color={status.color}
                                style={{ marginLeft: 4 }}
                            />
                        </View>
                    </View>

                    <View style={styles.metrics}>
                        <View style={styles.metric}>
                            <AppText label="On hand" fontSize={11} color={colors.textTertiary} />
                            <AppText
                                label={String(item.inventory ?? 0)}
                                variant={1}
                                fontSize={20}
                                color={colors.text}
                                style={{ marginTop: 2 }}
                            />
                        </View>
                        <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.metric}>
                            <AppText label="Reorder at" fontSize={11} color={colors.textTertiary} />
                            <AppText
                                label={String(item.minimum ?? 0)}
                                variant={1}
                                fontSize={20}
                                color={colors.text}
                                style={{ marginTop: 2 }}
                            />
                        </View>
                        <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.metric}>
                            <AppText label="Need" fontSize={11} color={status.color} />
                            <AppText
                                label={`+${shortage}`}
                                variant={1}
                                fontSize={20}
                                color={status.color}
                                style={{ marginTop: 2 }}
                            />
                        </View>
                    </View>

                    <View style={styles.progressBlock}>
                        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: `${percentage}%`,
                                        backgroundColor: status.bar,
                                    },
                                ]}
                            />
                        </View>
                        <AppText
                            label={`${percentage}% of minimum`}
                            fontSize={11}
                            color={colors.textTertiary}
                            style={{ marginTop: 6 }}
                        />
                    </View>
                </TouchableOpacity>
            );
        },
        [colors, openProduct, statusTheme]
    );

    const FilterChip = ({ id, label, count, accent }) => {
        const active = filter === id;
        return (
            <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setFilter(id)}
                style={[
                    styles.filterChip,
                    {
                        backgroundColor: active
                            ? accent || config.THEME_COLOR
                            : colors.surfaceSecondary,
                        borderColor: active ? accent || config.THEME_COLOR : colors.border,
                    },
                ]}
            >
                <AppText
                    label={label}
                    fontSize={12}
                    variant={1}
                    color={active ? '#fff' : colors.textSecondary}
                />
                <View
                    style={[
                        styles.filterCount,
                        {
                            backgroundColor: active ? 'rgba(255,255,255,0.22)' : colors.surface,
                        },
                    ]}
                >
                    <AppText
                        label={String(count)}
                        fontSize={11}
                        variant={1}
                        color={active ? '#fff' : colors.text}
                    />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView
            edges={['bottom', 'left', 'right']}
            style={{ flex: 1, backgroundColor: colors.background }}
        >
            <ScreenHeader onPress={backPress} label="Items to Reorder">
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                        setShowSearch((v) => {
                            if (v) setSearchQuery('');
                            return !v;
                        });
                    }}
                    style={styles.headerBtn}
                >
                    <Lucide
                        name={showSearch ? 'x' : 'search'}
                        color={config.THEME_COLOR}
                        size={22}
                    />
                </TouchableOpacity>
            </ScreenHeader>

            <View style={styles.topBlock}>
                <View style={styles.filterRow}>
                    <FilterChip id="all" label="All" count={counts.total} />
                    <FilterChip
                        id="critical"
                        label="Critical"
                        count={counts.critical}
                        accent={colors.error}
                    />
                    <FilterChip id="low" label="Low" count={counts.low} accent="#d97706" />
                </View>

                {showSearch ? (
                    <View
                        style={[
                            styles.searchBar,
                            {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <Lucide name="search" color={colors.textTertiary} size={18} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.text }]}
                            placeholder="Search name, SKU, category…"
                            placeholderTextColor={colors.placeholder}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                        {searchQuery.length > 0 ? (
                            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                                <Lucide name="x" color={colors.textTertiary} size={16} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                ) : null}
            </View>

            {isLoading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText
                        label="Loading items…"
                        color={colors.textTertiary}
                        style={{ marginTop: 12 }}
                    />
                </View>
            ) : (
                <FlashList
                    data={filteredData}
                    estimatedItemSize={168}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={config.THEME_COLOR}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View
                                style={[
                                    styles.emptyIcon,
                                    { backgroundColor: colors.surfaceSecondary },
                                ]}
                            >
                                <Lucide
                                    name={searchQuery || filter !== 'all' ? 'search-x' : 'package-check'}
                                    color={colors.textTertiary}
                                    size={28}
                                />
                            </View>
                            <AppText
                                label={
                                    searchQuery || filter !== 'all'
                                        ? 'No matching items'
                                        : 'Stock looks healthy'
                                }
                                variant={1}
                                fontSize={16}
                                color={colors.text}
                                style={{ marginTop: 14 }}
                            />
                            <AppText
                                label={
                                    searchQuery || filter !== 'all'
                                        ? 'Try another filter or search term'
                                        : 'Nothing is below reorder point right now'
                                }
                                fontSize={13}
                                color={colors.textTertiary}
                                style={{ marginTop: 6, textAlign: 'center', paddingHorizontal: 24 }}
                            />
                        </View>
                    }
                    renderItem={renderItem}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    topBlock: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 4,
    },
    filterChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
    },
    filterCount: {
        minWidth: 22,
        height: 22,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 14,
        marginTop: 10,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        fontFamily: 'FiraSans-Regular',
        fontSize: 15,
        paddingVertical: 0,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 28,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 64,
    },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        marginBottom: 10,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
    },
    metrics: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    metric: {
        flex: 1,
        alignItems: 'center',
    },
    metricDivider: {
        width: StyleSheet.hairlineWidth,
        height: 36,
    },
    progressBlock: {
        marginTop: 2,
    },
    progressTrack: {
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
