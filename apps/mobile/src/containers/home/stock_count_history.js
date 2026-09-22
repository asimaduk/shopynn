import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import { FlashList } from '@shopify/flash-list';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { stockCounts as stockCountsApi, normalizeList } from '../../services/api';
import { hasPermission } from '../../utils/permissions';
import { useFocusEffect } from '@react-navigation/native';

const StockCountHistory = ({ navigation }) => {
    const { colors } = useTheme();
    const user = useSelector(({ user }) => user);
    const canCreateStockCount = hasPermission(user, ['stock_counts.create']);
    const [data, setData] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const loadHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const raw = await stockCountsApi.list();
            const list = normalizeList(raw);
            setData(Array.isArray(list) ? list : []);
        } catch (_) {
            setData([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadHistory();
        }, [loadHistory]),
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadHistory();
        setRefreshing(false);
    };

    const filteredData = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return data;
        return data.filter((item) => {
            const creator = `${item.creator_first_name || ''} ${item.creator_last_name || ''}`.toLowerCase();
            return (
                String(item.reference_number || '').toLowerCase().includes(q) ||
                String(item.warehouse_name || '').toLowerCase().includes(q) ||
                String(item.status || '').toLowerCase().includes(q) ||
                creator.includes(q) ||
                String(item.id || '').toLowerCase().includes(q)
            );
        });
    }, [data, searchQuery]);

    const filtering = searchQuery.trim().length > 0;

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Stock count history">
                {canCreateStockCount ? (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('StockCount')}
                        style={[styles.headerBtn, { backgroundColor: colors.surface }]}
                    >
                        <Lucide name="plus" color={config.THEME_COLOR} size={18} />
                    </TouchableOpacity>
                ) : null}
            </ScreenHeader>

            <View style={styles.summaryRow}>
                <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="clipboard-check" size={14} color={config.THEME_COLOR} />
                    <AppText
                        label={`${filteredData.length} count${filteredData.length === 1 ? '' : 's'}`}
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
                    placeholder="Search reference, warehouse, or user"
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

            {isLoading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading..." color={colors.textTertiary} style={{ marginTop: 10 }} />
                </View>
            ) : (
                <View style={styles.listWrap}>
                    <FlashList
                        style={styles.list}
                        data={filteredData}
                        estimatedItemSize={120}
                        keyExtractor={(item, index) => String(item.id ?? `sc-${index}`)}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.THEME_COLOR} />}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyWrap}>
                                <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="clipboard-check" size={28} color={colors.textTertiary} />
                                </View>
                                <AppText
                                    label={filtering ? 'No stock counts match' : 'No stock counts yet'}
                                    variant={1}
                                    fontSize={16}
                                    color={colors.text}
                                    style={{ marginTop: 12 }}
                                />
                                <AppText
                                    label={filtering ? 'Try another search' : 'Create a stock count to get started'}
                                    fontSize={13}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 4, textAlign: 'center' }}
                                />
                                {!filtering && canCreateStockCount ? (
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={() => navigation.navigate('StockCount')}
                                        style={[styles.emptyCta, { backgroundColor: config.THEME_COLOR }]}
                                    >
                                        <Lucide name="plus" size={16} color="#fff" />
                                        <AppText label="Create stock count" fontSize={14} color="#fff" variant={1} style={{ marginLeft: 6 }} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        )}
                        renderItem={({ item }) => {
                            const creator = `${item.creator_first_name || ''} ${item.creator_last_name || ''}`.trim();
                            const productCount = Number(item.number_of_items || 0);
                            return (
                                <TouchableOpacity
                                    activeOpacity={0.75}
                                    onPress={() => navigation.navigate('StockCountDetails', { stockCount: item })}
                                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                >
                                    <View style={styles.cardTop}>
                                        <View style={[styles.iconWrap, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                                            <Lucide name="clipboard-check" size={18} color={config.THEME_COLOR} />
                                        </View>
                                        <View style={styles.main}>
                                            <AppText
                                                label={item.reference_number || 'Stock count'}
                                                variant={1}
                                                fontSize={15}
                                                color={colors.text}
                                                numberOfLines={1}
                                            />
                                            <AppText
                                                label={item.warehouse_name || '—'}
                                                fontSize={12}
                                                color={colors.textSecondary}
                                                style={{ marginTop: 3 }}
                                                numberOfLines={1}
                                            />
                                        </View>
                                        {item.status ? (
                                            <View style={[styles.statusBadge, { backgroundColor: `${config.GREEN_COLOR || '#16a34a'}18` }]}>
                                                <AppText label={item.status} fontSize={11} color={config.GREEN_COLOR || '#16a34a'} variant={1} />
                                            </View>
                                        ) : null}
                                    </View>
                                    <View style={styles.cardRow}>
                                        <View style={styles.cardInfo}>
                                            <Lucide name="package" size={12} color={colors.textTertiary} />
                                            <AppText
                                                label={`${productCount} product${productCount === 1 ? '' : 's'}`}
                                                fontSize={12}
                                                color={colors.textTertiary}
                                                style={{ marginLeft: 6 }}
                                            />
                                        </View>
                                        {Number(item.varianceCount) > 0 ? (
                                            <View style={styles.cardInfo}>
                                                <Lucide name="circle-alert" size={12} color="#f59e0b" />
                                                <AppText
                                                    label={`${item.varianceCount} variances`}
                                                    fontSize={12}
                                                    color="#f59e0b"
                                                    style={{ marginLeft: 6 }}
                                                />
                                            </View>
                                        ) : null}
                                        {item.date ? (
                                            <AppText label={item.date} fontSize={12} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
                                        ) : null}
                                    </View>
                                    {creator ? (
                                        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                                            <Lucide name="user" size={12} color={colors.textTertiary} />
                                            <AppText label={creator} fontSize={12} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                                        </View>
                                    ) : null}
                                </TouchableOpacity>
                            );
                        }}
                    />
                </View>
            )}
        </SafeAreaView>
    );
};

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
    searchInput: { flex: 1, marginLeft: 8, fontFamily: 'FiraSans-Regular', fontSize: 14 },
    listWrap: { flex: 1, minHeight: 0 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 15, paddingBottom: 28 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyWrap: { paddingTop: 48, paddingHorizontal: 24, alignItems: 'center' },
    emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    emptyCta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 18,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
    },
    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        marginBottom: 10,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    main: { flex: 1, minWidth: 0, marginRight: 8 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    cardInfo: { flexDirection: 'row', alignItems: 'center', marginRight: 14 },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 10,
        marginTop: 6,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
});

export default StockCountHistory;
