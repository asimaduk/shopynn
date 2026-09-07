import React, { useState, useEffect, useCallback } from 'react';
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
import homeStyles from './styles';
import { hasPermission } from '../../utils/permissions';

const StockCountHistory = ({ navigation }) => {
    const { colors } = useTheme();
    const user = useSelector(({ user }) => user);
    const canCreateStockCount = hasPermission(user, ['stock_counts.create']);
    const [data, setData] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const raw = await stockCountsApi.list();
            const list = normalizeList(raw);
            // console.log('stock count history list', list);
            setData(Array.isArray(list) && list.length > 0 ? list : []);
        } catch (_) {
            setData([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadHistory();
        setRefreshing(false);
    };

    const filteredData = data.filter(item => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return item.id.toLowerCase().includes(q) ||
               item.warehouse.toLowerCase().includes(q) ||
               item.user.toLowerCase().includes(q);
    });

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Stock count history">
                <View style={homeStyles.headerActions}>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => {
                            setShowSearch((prev) => {
                                const next = !prev;
                                if (!next) setSearchQuery('');
                                return next;
                            });
                        }}
                        style={[homeStyles.actionButton, { backgroundColor: colors.surface }]}
                    >
                        <Lucide name={showSearch ? 'x' : 'search'} color={colors.text} size={20} />
                    </TouchableOpacity>
                    {canCreateStockCount && (
                        <TouchableOpacity
                            activeOpacity={0.6}
                            onPress={() => navigation.navigate('StockCount')}
                            style={[homeStyles.actionButton, { backgroundColor: colors.surface }]}
                        >
                            <Lucide name="plus" color={config.THEME_COLOR} size={20} />
                        </TouchableOpacity>
                    )}
                </View>
            </ScreenHeader>

            {showSearch ? (
                <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="search" color={colors.textTertiary} size={18} style={{ marginLeft: 12 }} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search by ID, warehouse or user..."
                        placeholderTextColor={colors.placeholder}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCorrect={false}
                        autoCapitalize="none"
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8, marginRight: 8 }}>
                            <Lucide name="x" color={colors.textTertiary} size={16} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}

            {isLoading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading..." color={colors.textTertiary} style={{ marginTop: 10 }} />
                </View>
            ) : (
                <FlashList
                    data={filteredData}
                    estimatedItemSize={100}
                    keyExtractor={(item) => item.id}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.THEME_COLOR} />}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyContainer}>
                            <Lucide name="clipboard-check" size={48} color={colors.border} />
                            <AppText label={searchQuery ? 'No stock counts found' : 'No stock counts yet'} variant={1} fontSize={16} color={colors.textTertiary} style={{ marginTop: 12 }} />
                            {canCreateStockCount && (
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => navigation.navigate('StockCount')}
                                    style={[styles.emptyBtn, { backgroundColor: config.THEME_COLOR }]}
                                >
                                    <Lucide name="plus" size={18} color="#fff" />
                                    <AppText label="Create first stock count" fontSize={14} color="#fff" style={{ marginLeft: 8 }} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate('StockCountDetails', { stockCount: item })}
                            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                            <View style={styles.cardTop}>
                                <View style={[styles.iconWrap, { backgroundColor: config.THEME_COLOR + '18' }]}>
                                    <Lucide name="clipboard-check" size={20} color={config.THEME_COLOR} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <AppText label={item.reference_number} variant={1} fontSize={16} color={colors.text} />
                                    <AppText label={item.warehouse_name} fontSize={13} color={colors.textSecondary} style={{ marginTop: 2 }} />
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: config.GREEN_COLOR + '18' }]}>
                                    <AppText label={item.status} fontSize={11} color={colors.successLight} />
                                </View>
                            </View>
                            <View style={styles.cardRow}>
                                <View style={styles.cardInfo}>
                                    <Lucide name="package" size={14} color={colors.textTertiary} />
                                    <AppText
                                        label={`${item.number_of_items || 0} unique product${(item.number_of_items || 0) === 1 ? '' : 's'}`}
                                        fontSize={12}
                                        color={colors.textTertiary}
                                        style={{ marginLeft: 6 }}
                                    />
                                </View>
                                {item.varianceCount > 0 && (
                                    <View style={styles.cardInfo}>
                                        <Lucide name="circle-alert" size={14} color="#f59e0b" />
                                        <AppText label={`${item.varianceCount} variances`} fontSize={12} color="#f59e0b" style={{ marginLeft: 6 }} />
                                    </View>
                                )}
                                <AppText label={item.date} fontSize={12} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
                            </View>
                            <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                                <Lucide name="user" size={14} color={colors.textTertiary} />
                                <AppText label={item.creator_first_name + ' ' + item.creator_last_name} fontSize={12} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                            </View>
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={{ paddingBottom: 24 }}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 12,
        marginTop: 8,
        marginBottom: 8,
        borderRadius: 30,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        height: 44,
        marginLeft: 8,
        marginRight: 8,
        fontSize: 15,
        paddingRight: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    emptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    card: {
        marginHorizontal: 12,
        marginBottom: 10,
        padding: 14,
        borderRadius: 10,
        borderWidth: 1,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 1,
    },
});

export default StockCountHistory;
