import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import { FlashList } from '@shopify/flash-list';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const initialData = [
    { id: '1', name: 'Fan Yogurt', sku: 'FY1', expiryDate: '2025-03-05', daysLeft: 14, qty: 4, category: 'Dairy' },
    { id: '2', name: 'Milk 1L', sku: 'ML1L', expiryDate: '2025-03-15', daysLeft: 24, qty: 24, category: 'Dairy' },
    { id: '3', name: 'Tampico Medium', sku: 'Tam500', expiryDate: '2025-02-28', daysLeft: 9, qty: 21, category: 'Soft Drinks' },
    { id: '4', name: 'Bel Aqua 1L', sku: 'BA1L', expiryDate: '2025-03-20', daysLeft: 29, qty: 12, category: 'Water' },
    { id: '5', name: 'Juice Plus 350ml', sku: 'JP350', expiryDate: '2025-03-08', daysLeft: 17, qty: 60, category: 'Juices' },
];

const ExpiringSoon = ({ navigation, route }) => {
    const { colors } = useTheme();
    const initialItems = route.params?.items || [];
    const [data, setData] = useState(initialItems.length > 0 ? initialItems : initialData);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (initialItems.length === 0) {
            loadExpiringSoon();
        }
    }, []);

    const loadExpiringSoon = async () => {
        setIsLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            setData(initialData);
        } catch (error) {
            console.error('Error loading expiring soon:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadExpiringSoon();
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

    const getUrgency = (daysLeft) => {
        if (daysLeft <= 7) return { label: 'Urgent', color: '#ef4444', bg: '#fef2f2' };
        if (daysLeft <= 14) return { label: 'Soon', color: '#f59e0b', bg: '#fffbeb' };
        return { label: 'This month', color: config.THEME_COLOR, bg: '#e8f4fc' };
    };

    const backPress = () => navigation.goBack();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label="Expiring soon">
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

            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                        <Lucide name="calendar-clock" size={20} color="#f59e0b" />
                        <View style={{ marginLeft: 10 }}>
                            <AppText label="Expiring in 30 days" fontSize={12} color={colors.textSecondary} />
                            <AppText label={filteredData.length.toString()} variant={1} fontSize={18} color={colors.text} />
                        </View>
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.summaryItem}>
                        <Lucide name="circle-alert" size={20} color={colors.error} />
                        <View style={{ marginLeft: 10 }}>
                            <AppText label="Within 7 days" fontSize={12} color={colors.textSecondary} />
                            <AppText label={filteredData.filter(item => item.daysLeft <= 7).length.toString()} variant={1} fontSize={18} color={colors.error} />
                        </View>
                    </View>
                </View>
            </View>

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

            {isLoading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading..." color={colors.textTertiary} style={{ marginTop: 10 }} />
                </View>
            ) : (
                <FlashList
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 10, paddingTop: 0 }}
                    data={filteredData}
                    estimatedItemSize={120}
                    keyExtractor={(item) => item.id}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.THEME_COLOR} />
                    }
                    ListHeaderComponent={() =>
                        filteredData.length > 0 ? (
                            <View style={styles.listHeader}>
                                <AppText
                                    label={`${filteredData.length} item${filteredData.length !== 1 ? 's' : ''} expiring in next 30 days`}
                                    fontSize={13}
                                    color={colors.textTertiary}
                                />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={() => (
                        <View style={styles.emptyContainer}>
                            <Lucide name="calendar-check" color={colors.border} size={48} />
                            <AppText
                                label={searchQuery ? 'No items found' : 'No items expiring soon'}
                                variant={1}
                                fontSize={16}
                                color={colors.textTertiary}
                                style={{ marginTop: 12 }}
                            />
                            <AppText
                                label={searchQuery ? 'Try a different search term' : 'Items expiring in the next 30 days will appear here'}
                                fontSize={13}
                                color={colors.textTertiary}
                                style={{ marginTop: 6, textAlign: 'center' }}
                            />
                        </View>
                    )}
                    renderItem={({ item }) => {
                        const urgency = getUrgency(item.daysLeft);
                        return (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => navigation.navigate('ProductDetails', { product: item })}
                                style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                            >
                                <View style={styles.itemHeader}>
                                    <View style={[styles.statusBadge, { backgroundColor: urgency.bg }]}>
                                        <Lucide name="calendar-clock" size={14} color={urgency.color} />
                                        <AppText label={urgency.label} fontSize={11} color={urgency.color} style={{ marginLeft: 4 }} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <AppText label={item.name} variant={1} fontSize={15} numberOfLines={1} color={colors.text} />
                                        <View style={styles.itemMeta}>
                                            <AppText label={item.sku} fontSize={12} color={colors.textSecondary} />
                                            {item.category && (
                                                <>
                                                    <Lucide name="dot" size={12} color={colors.textTertiary} />
                                                    <AppText label={item.category} fontSize={12} color={colors.textSecondary} />
                                                </>
                                            )}
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.itemBody}>
                                    <View style={styles.stockRow}>
                                        <Lucide name="calendar" size={16} color={colors.textTertiary} />
                                        <AppText label="Expiry" fontSize={12} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                                        <AppText label={item.expiryDate} variant={1} fontSize={14} color={colors.text} style={{ marginLeft: 'auto' }} />
                                    </View>
                                    <View style={styles.stockRow}>
                                        <Lucide name="clock" size={16} color={colors.textTertiary} />
                                        <AppText label="Days left" fontSize={12} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                                        <AppText label={`${item.daysLeft} days`} variant={1} fontSize={14} color={urgency.color} style={{ marginLeft: 'auto' }} />
                                    </View>
                                    <View style={styles.stockRow}>
                                        <Lucide name="package" size={16} color={colors.textTertiary} />
                                        <AppText label="Quantity" fontSize={12} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                                        <AppText label={item.qty.toString()} variant={1} fontSize={14} color={colors.text} style={{ marginLeft: 'auto' }} />
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
    headerActions: { flexDirection: 'row', paddingVertical: 5, marginRight: 10 },
    headerButton: {
        width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 10,
        elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
    },
    summaryCard: { marginHorizontal: 12, marginTop: 8, borderRadius: 12, padding: 16, borderWidth: 1 },
    summaryRow: { flexDirection: 'row', alignItems: 'center' },
    summaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    summaryDivider: { width: 1, height: 40, marginHorizontal: 16 },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center', borderRadius: 12, marginHorizontal: 12, marginTop: 10, marginBottom: 8, borderWidth: 1,
    },
    searchInput: { flex: 1, height: 44, marginLeft: 8, marginRight: 8, fontSize: 15, paddingRight: 10 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
    listHeader: { paddingBottom: 8, marginBottom: 4 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
    itemCard: { borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    itemHeader: { marginBottom: 12 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    itemMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    itemBody: { marginTop: 8 },
    stockRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
});

export default ExpiringSoon;
