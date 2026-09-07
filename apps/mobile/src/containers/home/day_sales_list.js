import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import ScreenHeader from '../../components/screen_header';
import SaleItem from './sale_item';
import { sales as salesApi, normalizeList } from '../../services/api';

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});

function formatDayTotal(value) {
    if (value >= 1000000) return `GHS ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `GHS ${(value / 1000).toFixed(1)}K`;
    return formatter.format(value).replace('GH₵', 'GHS ').trim();
}

// Match sales.js display shape
const STATUS_MAP = { 0: 'Pending', 1: 'Delivered', 2: 'Cancelled' };
const formatTime = (isoStr) => {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
};
const formatSaleForDisplay = (row, fallbackDateISO) => ({
    id: row.id,
    customer: row.customer ?? row.customer_name ?? 'Walk-In',
    itemCount: row.number_of_items ?? row.itemCount ?? 0,
    time: formatTime(row.sale_date || row.created_at),
    amount: row.total_amount ?? row.amount ?? '0.00',
    status: STATUS_MAP[row.current_status] ?? row.status ?? 'Delivered',
    user: `${row.attendant_first_name ?? ''} ${row.attendant_last_name ?? ''}`.trim() || row.user || '—',
    date: fallbackDateISO || row.sale_date || row.created_at,
    invoice_number: row.invoice_number,
    _raw: row,
});

const DaySalesList = ({ navigation, route }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { date = '', label = '', dayTotal = 0 } = route.params || {};
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState([]);

    const computedDayTotal = useMemo(() => {
        // if parent passed a number, keep it; otherwise compute from loaded list
        const direct = Number(dayTotal);
        if (!Number.isNaN(direct) && direct > 0) return direct;
        return sales.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    }, [dayTotal, sales]);

    const loadSalesForDay = useCallback(async () => {
        if (!date) {
            setSales([]);
            return;
        }
        try {
            // backend expects a date; support multiple param names defensively
            const raw = await salesApi.byDate({ date, sale_date: date, day: date });
            const list = normalizeList(raw);
            const mapped = list.map((row) => formatSaleForDisplay(row, date));
            setSales(mapped);
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || 'Failed to load sales for this day.';
            Alert.alert('Error', msg);
            setSales([]);
        }
    }, [date]);

    useEffect(() => {
        setLoading(true);
        loadSalesForDay().finally(() => setLoading(false));
    }, [loadSalesForDay]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadSalesForDay();
        setRefreshing(false);
    };

    const onSalePress = (item) => {
        navigation.navigate('SaleDetails', { item });
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader
                label={label ? `Sales – ${label}` : 'Sales for day'}
                onPress={() => navigation.goBack()}
            />

            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.summaryRow}>
                    <Lucide name="trending-up" color={config.THEME_COLOR} size={20} />
                    <AppText label="Day total" fontSize={14} color={colors.textSecondary} style={{ marginLeft: 8 }} />
                </View>
                <AppText label={formatDayTotal(computedDayTotal)} variant={1} fontSize={22} color={colors.text} style={{ marginTop: 6 }} />
                <AppText label={`${sales.length} sale(s)`} fontSize={13} color={colors.textTertiary} style={{ marginTop: 4 }} />
            </View>

            {loading && !refreshing ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading sales..." fontSize={14} color={colors.textTertiary} style={{ marginTop: 10 }} />
                </View>
            ) : null}

            {sales.length === 0 ? (
                <View style={[styles.empty, { backgroundColor: colors.surface }]}>
                    <Lucide name="shopping-bag" size={48} color={colors.border} />
                    <AppText label="No sales for this day" variant={1} fontSize={16} color={colors.textSecondary} style={{ marginTop: 12 }} />
                </View>
            ) : (
                <FlashList
                    data={sales}
                    keyExtractor={(item) => item.id}
                    estimatedItemSize={120}
                    contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
                    style={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.THEME_COLOR} />
                    }
                    renderItem={({ item }) => (
                        <SaleItem item={item} onPress={() => onSalePress(item)} />
                    )}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    summaryCard: {
        marginHorizontal: 16,
        marginTop: 12,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center' },
    list: { flex: 1, marginTop: 8 },
    listContent: { paddingHorizontal: 16, paddingTop: 8 },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 24,
        borderRadius: 12,
        paddingVertical: 48,
    },
});

export default DaySalesList;
