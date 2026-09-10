import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl, ScrollView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import Header from '../../components/main_header';
import AppText from '../../components/text';
import { FlashList } from "@shopify/flash-list";
import { useSelector } from 'react-redux';
import config from '../../config';
import SaleItem from './sale_item';
import { sales as salesApi, normalizeList } from '../../services/api';
import AppModal from '../../components/app_modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import useTheme from '../../hooks/useTheme';
import { canAccessScreen, hasPermission } from '../../utils/permissions';

// Map API sale to display shape and group by date (Today / Yesterday / "Mon DD, YYYY")
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

const formatSectionDate = (isoStr) => {
    if (!isoStr) return 'Unknown';
    const d = new Date(isoStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (dDate.getTime() === today.getTime()) return 'Today';
    if (dDate.getTime() === yesterday.getTime()) return 'Yesterday';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const formatSaleForDisplay = (row) => ({
    id: row.id,
    customer: row.customer ?? 'Walk-In',
    customer_email: row.customer_email || '',
    customer_phone: row.customer_phone || '',
    itemCount: row.number_of_items ?? 0,
    time: formatTime(row.sale_date || row.created_at),
    amount: row.total_amount ?? '0.00',
    status: STATUS_MAP[row.current_status] ?? 'Delivered',
    user: row.attendant_first_name + ' ' + row.attendant_last_name ?? '—',
    date: formatSectionDate(row.sale_date || row.created_at),
    invoice_number: row.invoice_number,
    payment_type: row.payment_type,
    payment_method: row.payment_method,
    payment_number: row.payment_number,
    notes: row.notes,
});

const groupSalesByDate = (items) => {
    const byDate = {};
    items.forEach((item) => {
        const key = item.date;
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(item);
    });
    const order = ['Today', 'Yesterday'];
    const rest = Object.keys(byDate).filter((k) => !order.includes(k));
    rest.sort((a, b) => new Date(b) - new Date(a));
    const orderedKeys = [...order.filter((k) => byDate[k]?.length), ...rest];
    return orderedKeys.map((title) => ({ title, data: byDate[title] }));
};

const dateRanges = [
    { id: '1', label: 'Today', value: 'today' },
    { id: '2', label: 'Yesterday', value: 'yesterday' },
    { id: '3', label: 'Last 7 Days', value: 'last_7_days' },
    { id: '4', label: 'Last 30 Days', value: 'last_30_days' },
    { id: '5', label: 'This Month', value: 'this_month' },
    { id: '6', label: 'Last Month', value: 'last_month' },
    { id: '7', label: 'All Time', value: 'all_time' },
    { id: '8', label: 'Custom Range', value: 'custom' },
];

// Parse sales date string like "Today", "Yesterday", or "Feb 15, 2026" to Date object
const parseSalesDate = (dateStr, timeStr) => {
    if (!dateStr) return null;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (dateStr === 'Today') {
        const date = new Date(today);
        if (timeStr) {
            const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (timeMatch) {
                let hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                const ampm = timeMatch[3].toUpperCase();
                if (ampm === 'PM' && hours !== 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
                date.setHours(hours, minutes, 0, 0);
            }
        }
        return date;
    }
    
    if (dateStr === 'Yesterday') {
        const date = new Date(today);
        date.setDate(date.getDate() - 1);
        if (timeStr) {
            const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (timeMatch) {
                let hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                const ampm = timeMatch[3].toUpperCase();
                if (ampm === 'PM' && hours !== 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
                date.setHours(hours, minutes, 0, 0);
            }
        }
        return date;
    }
    
    // Parse "Feb 15, 2026" format
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = dateStr.split(', ');
    if (parts.length === 2) {
        const [monthDay, year] = parts;
        const [monthName, day] = monthDay.split(' ');
        const monthIndex = months.indexOf(monthName);
        if (monthIndex !== -1) {
            const date = new Date(parseInt(year), monthIndex, parseInt(day));
            if (timeStr) {
                const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
                if (timeMatch) {
                    let hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    const ampm = timeMatch[3].toUpperCase();
                    if (ampm === 'PM' && hours !== 12) hours += 12;
                    if (ampm === 'AM' && hours === 12) hours = 0;
                    date.setHours(hours, minutes, 0, 0);
                }
            }
            return date;
        }
    }
    
    return null;
};

const TAB_BAR_HEIGHT = 60;

const Sales = ({ navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const user = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const canNewSale = canAccessScreen(user, 'NewSale', subscriptionFeatures);
    const canResendInvoice = hasPermission(user, 'sales.share_receipt');
    const [resendingSaleId, setResendingSaleId] = useState(null);
    const [search, setSearch] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
    const [selectedDateRange, setSelectedDateRange] = useState('all_time');
    const [customStartDate, setCustomStartDate] = useState(new Date());
    const [customEndDate, setCustomEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState([]);

    const handleResendInvoice = useCallback((sale) => {
        if (!sale?.id) return;
        const emailHint = sale.customer_email ? ` to ${sale.customer_email}` : '';
        Alert.alert(
            'Resend invoice',
            `Email invoice #${sale.invoice_number}${emailHint}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Resend',
                    onPress: async () => {
                        setResendingSaleId(sale.id);
                        try {
                            const result = await salesApi.sendInvoice(sale.id, sale.customer_email ? { email: sale.customer_email } : {});
                            Alert.alert('Sent', `Invoice resent to ${result?.sent_to || sale.customer_email || 'customer'}.`);
                        } catch (err) {
                            const msg = err?.response?.data?.message || err?.message || 'Could not resend invoice.';
                            Alert.alert('Resend failed', msg);
                        } finally {
                            setResendingSaleId(null);
                        }
                    },
                },
            ],
        );
    }, []);

    const loadSalesData = useCallback(async () => {
        setIsLoading(true);
        try {
            const bounds = getDateRangeBounds();
            const params = bounds ? { startDate: bounds.start?.toISOString?.()?.slice(0, 10), endDate: bounds.end?.toISOString?.()?.slice(0, 10) } : {};
            const raw = await salesApi.list(params);
            const list = normalizeList(raw);
            if (Array.isArray(list) && list.length > 0) {
                const displayItems = list.map(formatSaleForDisplay);
                const sectioned = groupSalesByDate(displayItems);
                setData(sectioned);
            } else setData([]);
        } catch (error) {
            setData([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedDateRange, customStartDate, customEndDate]);

    useEffect(() => {
        loadSalesData();
    }, [loadSalesData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadSalesData();
        setRefreshing(false);
    };

    const getDateRangeBounds = () => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);
        const last30Days = new Date(today);
        last30Days.setDate(last30Days.getDate() - 30);
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        switch (selectedDateRange) {
            case 'today':
                return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
            case 'yesterday':
                return { start: yesterday, end: today };
            case 'last_7_days':
                return { start: last7Days, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
            case 'last_30_days':
                return { start: last30Days, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
            case 'this_month':
                return { start: thisMonthStart, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
            case 'last_month':
                return { start: lastMonthStart, end: new Date(lastMonthEnd.getTime() + 24 * 60 * 60 * 1000) };
            case 'custom':
                return { start: customStartDate, end: new Date(customEndDate.getTime() + 24 * 60 * 60 * 1000) };
            default:
                return null; // all_time
        }
    };

    const handleDateRangeSelect = (value) => {
        if (value === 'custom') {
            setShowDateFilter(false);
            setShowCustomDatePicker(true);
        } else {
            setSelectedDateRange(value);
            setShowDateFilter(false);
        }
    };

    const handleApplyCustomRange = () => {
        setSelectedDateRange('custom');
        setShowCustomDatePicker(false);
    };

    const formatDate = (date) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };

    const getDateRangeLabel = () => {
        if (selectedDateRange === 'custom') {
            return `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`;
        }
        const range = dateRanges.find((r) => r.value === selectedDateRange);
        return range ? range.label : 'All Time';
    };

    const onStartDateChange = (event, selectedDate) => {
        if (selectedDate) {
            setCustomStartDate(selectedDate);
        }
    };

    const onEndDateChange = (event, selectedDate) => {
        if (selectedDate) {
            setCustomEndDate(selectedDate);
        }
    };

    // Flatten data for filtering
    const allSales = useMemo(() => {
        let sales = data.flatMap(group => group.data);
        
        // Apply date filter
        if (selectedDateRange !== 'all_time') {
            const bounds = getDateRangeBounds();
            if (bounds) {
                sales = sales.filter((item) => {
                    const itemDate = parseSalesDate(item.date, item.time);
                    if (!itemDate) return false;
                    return itemDate >= bounds.start && itemDate < bounds.end;
                });
            }
        }
        
        // Apply search filter
        if (search.trim()) {
            sales = sales.filter(item =>
                item.customer.toLowerCase().includes(search.toLowerCase()) ||
                item.id.includes(search)
            );
        }
        
        return sales;
    }, [data, search, selectedDateRange, customStartDate, customEndDate]);

    // Regroup filtered data
    const groupedData = useMemo(() => {
        const grouped = {};
        allSales.forEach(sale => {
            const key = sale.date;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(sale);
        });
        
        return Object.keys(grouped).map(date => ({
            title: date,
            data: grouped[date]
        }));
    }, [allSales]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom', 'left', 'right']}>
            <Header navigation={navigation} screen="sales" />

            <View style={{ flex: 1 }}>
                {/* Search and Summary Header */}
                <View style={[styles.headerContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <View style={styles.summaryRow}>
                        <View>
                            <AppText label={'Sales History'} fontSize={18} variant={1} color={colors.text} />
                            {selectedDateRange !== 'all_time' && (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => setShowDateFilter(true)}
                                    style={[styles.dateRangeChip, { backgroundColor: colors.primaryShade }]}
                                >
                                    <Lucide name="calendar-fold" color={config.THEME_COLOR} size={12} />
                                    <AppText label={getDateRangeLabel()} fontSize={11} color={config.THEME_COLOR} style={{ marginLeft: 4 }} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <AppText label={`#${allSales.length}`} fontSize={18} variant={2} color={config.THEME_COLOR} />
                    </View>

                    <View style={styles.actionRow}>
                        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
                            <Lucide name="search" size={18} color={colors.textTertiary} />
                            <TextInput
                                placeholder="Search by customer or txn ID..."
                                placeholderTextColor={colors.placeholder}
                                style={[styles.searchInput, { color: colors.text }]}
                                value={search}
                                onChangeText={setSearch}
                            />
                            {search.length > 0 && (
                                <TouchableOpacity onPress={() => setSearch('')}>
                                    <Lucide name="x" size={16} color={colors.textTertiary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowDateFilter(true)}
                            style={styles.dateFilterButton}
                        >
                            <Lucide name="calendar" size={20} color={config.THEME_COLOR} />
                        </TouchableOpacity>

                        {/* <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowFilter(true)}
                            style={styles.filterButton}
                        >
                            <Lucide name="list-filter" size={20} color="#fff" />
                        </TouchableOpacity> */}
                    </View>
                </View>

                {isLoading && !refreshing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={config.THEME_COLOR} />
                        <AppText label="Loading sales..." color={colors.textTertiary} style={{ marginTop: 10 }} />
                    </View>
                ) : (
                    <FlashList
                        contentContainerStyle={{ padding: 10, paddingBottom: TAB_BAR_HEIGHT + 56 + 24 }}
                        data={groupedData}
                        estimatedItemSize={200}
                        keyExtractor={(item, index) => index.toString()}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.THEME_COLOR} />
                        }
                        renderItem={({ item }) => (
                            <View style={{ marginBottom: 20 }}>
                                <View
                                    style={[
                                        styles.sectionDateHeader,
                                        {
                                            backgroundColor: colors.primaryShade,
                                            borderColor: colors.border,
                                            borderLeftColor: config.THEME_COLOR,
                                        },
                                    ]}>
                                    <Lucide name="calendar-days" size={18} color={config.THEME_COLOR} />
                                    <AppText
                                        label={item.title}
                                        fontSize={16}
                                        color={colors.text}
                                        fontFamily="FiraSans-Medium"
                                        style={{ letterSpacing: 0.2 }}
                                    />
                                </View>
                                {item.data.map((sale) => (
                                    <SaleItem
                                        key={sale.id}
                                        item={sale}
                                        onPress={() => navigation.navigate('SaleDetails', { item: sale, saleId: sale.id })}
                                        onResendInvoice={canResendInvoice ? handleResendInvoice : undefined}
                                        resending={resendingSaleId === sale.id}
                                    />
                                ))}
                            </View>
                        )}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyContainer}>
                                <Lucide name="shopping-cart" size={40} color={colors.border} />
                                <AppText label="No sales found" fontSize={16} color={colors.textTertiary} style={{ marginTop: 10 }} />
                            </View>
                        )}
                    />
                )}

                {/* FAB - positioned above tab bar */}
                {canNewSale && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("NewSale")}
                        style={[styles.fab, { bottom: TAB_BAR_HEIGHT + insets.bottom + 12 }]}
                    >
                        <Lucide name='shopping-cart' color={'#fff'} size={24} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Date Filter Modal */}
            <AppModal
                visible={showDateFilter}
                handleClose={() => setShowDateFilter(false)}
                title="Filter by Date"
                onRequestClose={() => setShowDateFilter(false)}>
                <ScrollView 
                    style={[styles.modalList, { backgroundColor: colors.surface }]} 
                    contentContainerStyle={{ padding: 16 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}>
                    {/* Quick Filters Section */}
                    <View style={{ marginBottom: 24 }}>
                        <AppText 
                            label="Quick Filters" 
                            fontSize={13} 
                            color={colors.textTertiary} 
                            style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}
                            fontFamily="FiraSans-Medium"
                        />
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {dateRanges.slice(0, 6).map((range) => {
                                const isSelected = selectedDateRange === range.value;
                                const getIcon = (value) => {
                                    switch(value) {
                                        case 'today': return 'calendar-days';
                                        case 'yesterday': return 'calendar-clock';
                                        case 'last_7_days': return 'calendar-range';
                                        case 'last_30_days': return 'calendar-check';
                                        case 'this_month': return 'calendar';
                                        case 'last_month': return 'calendar-x';
                                        default: return 'calendar';
                                    }
                                };
                                return (
                                    <TouchableOpacity
                                        key={range.id}
                                        activeOpacity={0.7}
                                        onPress={() => handleDateRangeSelect(range.value)}
                                        style={[
                                            styles.dateFilterChip,
                                            {
                                                backgroundColor: isSelected ? colors.primaryShade : colors.surfaceSecondary,
                                                borderColor: isSelected ? config.THEME_COLOR : colors.border,
                                                borderWidth: isSelected ? 2 : 1,
                                            }
                                        ]}>
                                        <View style={[
                                            styles.chipIconContainer,
                                            { backgroundColor: isSelected ? config.THEME_COLOR + '20' : colors.surface }
                                        ]}>
                                            <Lucide
                                                name={getIcon(range.value)}
                                                size={16}
                                                color={isSelected ? config.THEME_COLOR : colors.textSecondary}
                                            />
                                        </View>
                                        <AppText
                                            label={range.label}
                                            fontSize={14}
                                            variant={isSelected ? 1 : 2}
                                            color={isSelected ? config.THEME_COLOR : colors.text}
                                            style={{ marginLeft: 8 }}
                                        />
                                        {isSelected && (
                                            <View style={[styles.checkBadge, { backgroundColor: config.THEME_COLOR }]}>
                                                <Lucide name="check" size={12} color={colors.textInverse} />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* All Time & Custom Options */}
                    <View>
                        <AppText 
                            label="Other Options" 
                            fontSize={13} 
                            color={colors.textTertiary} 
                            style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}
                            fontFamily="FiraSans-Medium"
                        />
                        {dateRanges.slice(6).map((range) => {
                            const isSelected = selectedDateRange === range.value;
                            return (
                                <TouchableOpacity
                                    key={range.id}
                                    activeOpacity={0.7}
                                    onPress={() => handleDateRangeSelect(range.value)}
                                    style={[
                                        styles.dateFilterOption,
                                        {
                                            backgroundColor: isSelected ? colors.primaryShade : colors.surface,
                                            borderLeftColor: isSelected ? config.THEME_COLOR : 'transparent',
                                            borderLeftWidth: isSelected ? 4 : 0,
                                        }
                                    ]}>
                                    <View style={styles.optionContent}>
                                        <View style={[
                                            styles.optionIconContainer,
                                            { backgroundColor: isSelected ? config.THEME_COLOR + '20' : colors.surfaceSecondary }
                                        ]}>
                                            <Lucide
                                                name={range.value === 'all_time' ? 'infinity' : 'calendar-range'}
                                                size={18}
                                                color={isSelected ? config.THEME_COLOR : colors.textSecondary}
                                            />
                                        </View>
                                        <AppText
                                            label={range.label}
                                            fontSize={15}
                                            variant={isSelected ? 1 : 2}
                                            color={isSelected ? config.THEME_COLOR : colors.text}
                                            style={{ flex: 1, marginLeft: 12 }}
                                        />
                                        {isSelected && (
                                            <View style={[styles.selectedIndicator, { backgroundColor: config.THEME_COLOR }]}>
                                                <Lucide name="check" size={16} color={colors.textInverse} />
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>
            </AppModal>

            {/* Custom Date Range Modal */}
            <AppModal
                visible={showCustomDatePicker}
                handleClose={() => setShowCustomDatePicker(false)}
                title="Custom Date Range"
                onRequestClose={() => setShowCustomDatePicker(false)}>
                <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.surface }}>
                    <View style={styles.customDateField}>
                        <AppText label="Start Date" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                        <TouchableOpacity onPress={() => {
                            if (Platform.OS === 'ios') {
                                setShowCustomDatePicker(false);
                                setTimeout(() => setShowStartPicker(true), 100);
                            } else {
                                setShowStartPicker(true);
                            }
                        }} style={[styles.dateFieldTouch, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                            <Lucide name="calendar" size={18} color={colors.placeholder} />
                            <AppText label={formatDate(customStartDate)} fontSize={15} color={colors.text} style={{ marginLeft: 10, flex: 1 }} />
                            <Lucide name="chevron-down" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.customDateField}>
                        <AppText label="End Date" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                        <TouchableOpacity onPress={() => {
                            if (Platform.OS === 'ios') {
                                setShowCustomDatePicker(false);
                                setTimeout(() => setShowEndPicker(true), 100);
                            } else {
                                setShowEndPicker(true);
                            }
                        }} style={[styles.dateFieldTouch, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                            <Lucide name="calendar" size={18} color={colors.placeholder} />
                            <AppText label={formatDate(customEndDate)} fontSize={15} color={colors.text} style={{ marginLeft: 10, flex: 1 }} />
                            <Lucide name="chevron-down" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity activeOpacity={0.8} onPress={handleApplyCustomRange} style={[styles.applyDateButton, { backgroundColor: config.THEME_COLOR }]}>
                        <AppText label="Apply Date Range" fontSize={16} variant={1} color={colors.textInverse} />
                    </TouchableOpacity>
                </ScrollView>
            </AppModal>

            {/* Date Pickers */}
            {Platform.OS === 'ios' && showStartPicker && (
                <AppModal
                    visible={showStartPicker}
                    handleClose={() => setShowStartPicker(false)}
                    title="Select Start Date"
                    onRequestClose={() => setShowStartPicker(false)}>
                    <View style={{ padding: 20, backgroundColor: colors.surface }}>
                        <DateTimePicker
                            value={customStartDate}
                            mode="date"
                            display="spinner"
                            onChange={onStartDateChange}
                            maximumDate={customEndDate}
                            style={{ width: '100%', height: 200 }}
                        />
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                setShowStartPicker(false);
                                setTimeout(() => setShowCustomDatePicker(true), 100);
                            }}
                            style={[styles.applyDateButton, { backgroundColor: config.THEME_COLOR, marginTop: 20 }]}>
                            <AppText label="Done" fontSize={16} variant={1} color={colors.textInverse} />
                        </TouchableOpacity>
                    </View>
                </AppModal>
            )}
            {Platform.OS === 'android' && showStartPicker && (
                <DateTimePicker
                    value={customStartDate}
                    mode="date"
                    display="default"
                    onChange={onStartDateChange}
                    maximumDate={customEndDate}
                />
            )}
            {Platform.OS === 'ios' && showEndPicker && (
                <AppModal
                    visible={showEndPicker}
                    handleClose={() => setShowEndPicker(false)}
                    title="Select End Date"
                    onRequestClose={() => setShowEndPicker(false)}>
                    <View style={{ padding: 20, backgroundColor: colors.surface }}>
                        <DateTimePicker
                            value={customEndDate}
                            mode="date"
                            display="spinner"
                            onChange={onEndDateChange}
                            minimumDate={customStartDate}
                            style={{ width: '100%', height: 200 }}
                        />
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                setShowEndPicker(false);
                                setTimeout(() => setShowCustomDatePicker(true), 100);
                            }}
                            style={[styles.applyDateButton, { backgroundColor: config.THEME_COLOR, marginTop: 20 }]}>
                            <AppText label="Done" fontSize={16} variant={1} color={colors.textInverse} />
                        </TouchableOpacity>
                    </View>
                </AppModal>
            )}
            {Platform.OS === 'android' && showEndPicker && (
                <DateTimePicker
                    value={customEndDate}
                    mode="date"
                    display="default"
                    onChange={onEndDateChange}
                    minimumDate={customStartDate}
                />
            )}

            {/* Filter Modal */}
            <AppModal
                visible={showFilter}
                handleClose={() => setShowFilter(false)}
                title="Filter Sales"
                height="60%"
            >
                <View style={{ padding: 20 }}>
                    <AppText label="Order Status" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                        {['All', 'Delivered', 'Pending', 'Cancelled'].map(status => (
                            <TouchableOpacity
                                key={status}
                                style={[styles.filterChip, status === 'All' && { backgroundColor: colors.text, borderColor: colors.text }]}
                            >
                                <AppText label={status} color={status === 'All' ? colors.textInverse : colors.textSecondary} />
                            </TouchableOpacity>
                        ))}
                    </View>

                    <AppText label="Payment Method" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {['Cash', 'Momo', 'Card', 'Credit'].map(method => (
                            <TouchableOpacity
                                key={method}
                                style={styles.filterChip}
                            >
                                <AppText label={method} color={colors.textSecondary} />
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setShowFilter(false)}
                        style={styles.applyButton}
                    >
                        <AppText label="Apply Filters" fontSize={16} color="#fff" fontFamily="FiraSans-Medium" />
                    </TouchableOpacity>
                </View>
            </AppModal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    sectionDateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderLeftWidth: 4,
    },
    headerContainer: {
        padding: 15,
        borderBottomWidth: 1,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 45,
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
    },
    dateFilterButton: {
        width: 45,
        height: 45,
        borderWidth: 1,
        borderColor: config.THEME_COLOR,
        borderRadius: 45,
        justifyContent: 'center',
        alignItems: 'center',
        // marginRight: 10,
    },
    filterButton: {
        width: 45,
        height: 45,
        backgroundColor: config.THEME_COLOR,
        borderRadius: 45,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateRangeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 4,
        borderWidth: 1,
        borderColor: config.THEME_COLOR + '30',
    },
    modalList: {
        maxHeight: 500,
    },
    dateFilterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        minWidth: '47%',
        marginBottom: 8,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    chipIconContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkBadge: {
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 6,
    },
    dateFilterOption: {
        borderRadius: 12,
        marginBottom: 8,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    optionIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedIndicator: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    customDateField: {
        marginBottom: 16,
    },
    dateFieldTouch: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderRadius: 8,
        borderWidth: 1,
    },
    applyDateButton: {
        backgroundColor: config.THEME_COLOR,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: config.THEME_COLOR,
        position: 'absolute',
        bottom: 25,
        right: 20,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.27,
        shadowRadius: 4.65,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    filterChip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
    },
    applyButton: {
        backgroundColor: config.THEME_COLOR,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 30,
    }
});

export default Sales;