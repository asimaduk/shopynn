import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { TouchableOpacity, View, ScrollView, Platform, TextInput, StyleSheet, RefreshControl, ActivityIndicator, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import { FlashList } from '@shopify/flash-list';
import TransactionItem from './transaction_item';
import AppModal from '../../components/app_modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import useTheme from '../../hooks/useTheme';
import { transactions as transactionsApi, normalizeList } from '../../services/api';
import { formatCurrency, formatQuantity } from '../../utils/format';

const dateRanges = [
    { id: '0', label: 'Recent', value: 'recent' },
    { id: '1', label: 'Today', value: 'today' },
    { id: '2', label: 'Yesterday', value: 'yesterday' },
    { id: '3', label: 'Last 7 Days', value: 'last_7_days' },
    { id: '4', label: 'Last 30 Days', value: 'last_30_days' },
    { id: '5', label: 'This Month', value: 'this_month' },
    { id: '6', label: 'Last Month', value: 'last_month' },
    { id: '8', label: 'Custom Range', value: 'custom' },
];

const RECENT_LIMIT = 20;

function getDateRangeBounds(selectedRange, customStart, customEnd) {
    if (!selectedRange || selectedRange === 'recent') {
        return { startDate: null, endDate: null };
    }
    const end = new Date();
    const start = new Date();
    if (selectedRange === 'custom') {
        return { startDate: customStart, endDate: customEnd };
    }
    switch (selectedRange) {
        case 'today':
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
        case 'yesterday':
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end.setDate(end.getDate() - 1);
            end.setHours(23, 59, 59, 999);
            break;
        case 'last_7_days':
            start.setDate(start.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            break;
        case 'last_30_days':
            start.setDate(start.getDate() - 29);
            start.setHours(0, 0, 0, 0);
            break;
        case 'this_month':
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            break;
        case 'last_month':
            start.setMonth(start.getMonth() - 1);
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setDate(0);
            end.setHours(23, 59, 59, 999);
            break;
        default:
            return { startDate: null, endDate: null };
    }
    return { startDate: start, endDate: end };
}

function toDisplayTransaction(t) {
    if (!t) return null;
    const type = `${t.type}`.toLowerCase();
    const isSale = type === '0' || type === 0 || type === 'sale' || type == 0;
    const displayType = isSale ? 'sale' : 'stock_in';
    const rawDate = t.created_at;
    const dateObj = rawDate ? new Date(rawDate) : new Date();
    const dateStr = isNaN(dateObj.getTime())
        ? String(rawDate || '')
        : `${dateObj.toLocaleDateString('en-US', { month: 'short' })} ${dateObj.getDate()} @ ${dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}`;
    const amountNum = Number(t.quantity || 0) * Number(t.unit_price || 0);
    const userName = [t.first_name, t.last_name].filter(Boolean).join(' ').trim();
    const qtyNum = Number(t.quantity || 0);
    return {
        id: t.id || t.transactionId || String(t._id || ''),
        type: displayType,
        description: t.name || '—',
        quantity: formatQuantity(qtyNum),
        _quantity: qtyNum,
        unit_price: Number(t.unit_price || 0),
        amount: formatCurrency(amountNum),
        _amount: amountNum,
        date: dateStr,
        user: userName || '—',
        notes: t.notes || t.note || '',
        invoice_number: t.invoice_number || t.invoiceNumber || t.id || '—',
        warehouse: t.warehouse || '',
    };
}

const ProductTransactions = ({ navigation, route }) => {
    const { colors } = useTheme();
    const [data, setData] = useState([]);
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
    const [selectedDateRange, setSelectedDateRange] = useState(null);
    const [customStartDate, setCustomStartDate] = useState(new Date());
    const [customEndDate, setCustomEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all'); // all, sale, stock_in
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [showExportFormatModal, setShowExportFormatModal] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [loading, setLoading] = useState(true);
    const productName = route.params?.productName || route.params?.product?.name || 'All products';
    const productId = route.params?.product?.id;

    const isRecentMode = !selectedDateRange || selectedDateRange === 'recent';
    const { startDate: startDateVal, endDate: endDateVal } = getDateRangeBounds(
        selectedDateRange,
        customStartDate,
        customEndDate
    );
    const startDateStr = startDateVal instanceof Date ? startDateVal.toISOString().split('T')[0] : startDateVal;
    const endDateStr = endDateVal instanceof Date ? endDateVal.toISOString().split('T')[0] : endDateVal;

    const loadTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const params = { type: typeFilter };
            if (productId) params.product_id = productId;
            if (isRecentMode) {
                params.limit = RECENT_LIMIT;
            } else {
                if (startDateStr) params.startDate = startDateStr;
                if (endDateStr) params.endDate = endDateStr;
            }
            const raw = await transactionsApi.list(params);
            const list = normalizeList(raw);
            const mapped = list.map(toDisplayTransaction).filter(Boolean);
            setData(mapped);
        } catch (_) {
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [isRecentMode, startDateStr, endDateStr, productId, typeFilter]);

    useEffect(() => {
        loadTransactions();
    }, [loadTransactions]);

    // Filter transactions by search and type (client-side filter on top of API data)
    const filteredData = useMemo(() => {
        let result = [...data];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (t) =>
                    t.description?.toLowerCase().includes(q) ||
                    t.referenceId?.toLowerCase().includes(q) ||
                    t.user?.toLowerCase().includes(q)
            );
        }
        if (typeFilter !== 'all') {
            result = result.filter((t) => t.type === typeFilter);
        }
        return result;
    }, [data, searchQuery, typeFilter]);

    // Summary stats — quantity-first (this screen is about stock movement)
    const summary = useMemo(() => {
        const sales = filteredData.filter((t) => t.type === 'sale');
        const purchases = filteredData.filter((t) => t.type === 'stock_in');
        const soldQty = sales.reduce((sum, t) => sum + (Number(t._quantity) || 0), 0);
        const boughtQty = purchases.reduce((sum, t) => sum + (Number(t._quantity) || 0), 0);
        const salesTotal = sales.reduce((sum, t) => sum + (Number(t._amount) || 0), 0);
        const purchaseTotal = purchases.reduce((sum, t) => sum + (Number(t._amount) || 0), 0);
        return {
            count: filteredData.length,
            salesCount: sales.length,
            purchaseCount: purchases.length,
            soldQty,
            boughtQty,
            salesTotal,
            purchaseTotal,
            netQty: boughtQty - soldQty,
        };
    }, [filteredData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadTransactions();
        setRefreshing(false);
    };

    const backPress = () => {
        navigation.goBack();
    };

    const handleDateRangeSelect = (value) => {
        if (value === 'custom') {
            setShowDateFilter(false);
            setShowCustomDatePicker(true);
        } else if (value === 'recent') {
            setSelectedDateRange(null);
            setShowDateFilter(false);
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
        if (!selectedDateRange || selectedDateRange === 'recent') {
            return 'Recent';
        }
        if (selectedDateRange === 'custom') {
            return `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`;
        }
        const range = dateRanges.find((r) => r.value === selectedDateRange);
        return range ? range.label : 'Recent';
    };

    const onStartDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            // Always close on Android to avoid stuck picker over AppModal.
            setShowStartPicker(false);
            setTimeout(() => setShowCustomDatePicker(true), 50);
            if (!selectedDate) return;
            setCustomStartDate(selectedDate);
            return;
        }
        if (selectedDate) setCustomStartDate(selectedDate);
    };

    const onEndDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowEndPicker(false);
            setTimeout(() => setShowCustomDatePicker(true), 50);
            if (!selectedDate) return;
            setCustomEndDate(selectedDate);
            return;
        }
        if (selectedDate) setCustomEndDate(selectedDate);
    };

    const generateCSV = () => {
        const headers = 'ID,Type,Description,Quantity,Amount,Date,User,Reference ID,Notes\n';
        const rows = filteredData.map((item) => {
            const escapeCSV = (str) => {
                if (!str) return '';
                const string = String(str);
                if (string.includes(',') || string.includes('"') || string.includes('\n')) {
                    return `"${string.replace(/"/g, '""')}"`;
                }
                return string;
            };
            return [
                item.id || '',
                item.type || '',
                escapeCSV(item.description),
                item.quantity || '',
                item.amount || '',
                escapeCSV(item.date),
                escapeCSV(item.user),
                escapeCSV(item.referenceId),
                escapeCSV(item.notes || ''),
            ].join(',');
        });
        return headers + rows.join('\n');
    };

    const generatePDF = () => {
        const dateRangeLabel = getDateRangeLabel();
        const exportDate = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Product Transactions Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
        }
        h1 {
            color: #1e293b;
            border-bottom: 3px solid ${config.THEME_COLOR || '#0A74DA'};
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .header-info {
            margin-bottom: 30px;
            color: #64748b;
            font-size: 14px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th {
            background-color: ${config.THEME_COLOR || '#0A74DA'};
            color: #fff;
            padding: 12px;
            text-align: left;
            font-weight: bold;
        }
        td {
            padding: 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        tr:nth-child(even) {
            background-color: #f8fafc;
        }
        .type-sale {
            color: #ef4444;
            font-weight: bold;
        }
        .type-stock_in {
            color: #10b981;
            font-weight: bold;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            color: #64748b;
            font-size: 12px;
            text-align: center;
        }
        .summary {
            margin-top: 20px;
            padding: 15px;
            background-color: #f8fafc;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <h1>Product Transactions Report</h1>
    <div class="header-info">
        <p><strong>Product:</strong> ${productName}</p>
        <p><strong>Date Range:</strong> ${dateRangeLabel}</p>
        <p><strong>Export Date:</strong> ${exportDate}</p>
        <p><strong>Total Transactions:</strong> ${filteredData.length}</p>
    </div>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Amount</th>
                <th>Date</th>
                <th>User</th>
                <th>Reference ID</th>
                <th>Notes</th>
            </tr>
        </thead>
        <tbody>
`;

        filteredData.forEach((item) => {
            const typeClass = item.type === 'sale' ? 'type-sale' : 'type-stock_in';
            const typeLabel = item.type === 'sale' ? 'Sale' : 'Stock In';
            html += `
            <tr>
                <td>${item.id || ''}</td>
                <td class="${typeClass}">${typeLabel}</td>
                <td>${item.description || ''}</td>
                <td>${item.quantity || ''}</td>
                <td>${item.amount || 'GHS 0.00'}</td>
                <td>${item.date || ''}</td>
                <td>${item.user || ''}</td>
                <td>${item.referenceId || ''}</td>
                <td>${item.notes || ''}</td>
            </tr>
            `;
        });

        // Calculate summary
        const sales = filteredData.filter((t) => t.type === 'sale');
        const stockIn = filteredData.filter((t) => t.type === 'stock_in');
        const salesTotal = sales.reduce((sum, t) => sum + (Number(t._amount) || 0), 0);
        const stockInTotal = stockIn.reduce((sum, t) => sum + (Number(t._amount) || 0), 0);

        html += `
        </tbody>
    </table>
    <div class="summary">
        <h3>Summary</h3>
        <p><strong>Total Sales:</strong> ${sales.length} transactions - GH₵${salesTotal.toFixed(2)}</p>
        <p><strong>Total Stock In:</strong> ${stockIn.length} transactions - GH₵${stockInTotal.toFixed(2)}</p>
        <p><strong>Net Amount:</strong> GH₵${(stockInTotal - salesTotal).toFixed(2)}</p>
    </div>
    <div class="footer">
        <p>Generated by Shopynn - Inventory Management System</p>
    </div>
</body>
</html>
        `;

        return html;
    };

    const handleExportFormatSelect = (format) => {
        setShowExportFormatModal(false);
        
        if (filteredData.length === 0) {
            Alert.alert('No Data', 'There are no transactions to export.');
            return;
        }

        setExporting(true);
        
        setTimeout(async () => {
            try {
                const dateRangeLabel = getDateRangeLabel().replace(/ /g, '_');
                const dateStr = new Date().toISOString().split('T')[0];
                const productNameSafe = productName.replace(/[^a-zA-Z0-9]/g, '_');
                
                if (format === 'csv' || format === 'excel') {
                    const csvContent = generateCSV();
                    const fileName = `ProductTransactions_${productNameSafe}_${dateRangeLabel}_${dateStr}.csv`;
                    
                    await Share.share({
                        message: csvContent,
                        title: fileName,
                    });
                } else if (format === 'pdf') {
                    const htmlContent = generatePDF();
                    const fileName = `ProductTransactions_${productNameSafe}_${dateRangeLabel}_${dateStr}.html`;
                    
                    // Share HTML which can be converted to PDF by the user's device
                    await Share.share({
                        message: htmlContent,
                        title: fileName,
                    });
                    
                    // Show instruction for PDF conversion
                    Alert.alert(
                        'PDF Export',
                        'The HTML file has been shared. To convert to PDF:\n\n• iOS: Open in Safari, tap Share > Print > Save as PDF\n• Android: Open in browser, print > Save as PDF',
                        [{ text: 'OK' }]
                    );
                }
            } catch (error) {
                Alert.alert('Export Error', 'Could not export transactions. Please try again.');
            } finally {
                setExporting(false);
            }
        }, 300);
    };

    const handleExport = () => {
        if (filteredData.length === 0) {
            Alert.alert('No Data', 'There are no transactions to export.');
            return;
        }
        setShowExportFormatModal(true);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom', 'left', 'right']}>
            <ScreenHeader onPress={backPress} label="Stock movement">
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => {
                            setShowSearch((prev) => {
                                const next = !prev;
                                if (!next) setSearchQuery('');
                                return next;
                            });
                        }}
                        style={[styles.headerButton, { backgroundColor: colors.surfaceSecondary || colors.background }]}
                    >
                        <Lucide name={showSearch ? 'x' : 'search'} color={colors.text} size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={handleExport}
                        disabled={exporting || filteredData.length === 0}
                        style={[styles.headerButton, { backgroundColor: colors.surfaceSecondary || colors.background }, (exporting || filteredData.length === 0) && { opacity: 0.5 }]}
                    >
                        {exporting ? (
                            <ActivityIndicator size="small" color={config.THEME_COLOR} />
                        ) : (
                            <Lucide name="download" color={config.THEME_COLOR} size={20} />
                        )}
                    </TouchableOpacity>
                </View>
            </ScreenHeader>

            <View style={[styles.hero, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <AppText label={productName} variant={1} fontSize={18} color={colors.text} numberOfLines={2} />
                <AppText
                    label="Sale and purchase lines for this product"
                    fontSize={13}
                    color={colors.textTertiary}
                    style={{ marginTop: 4 }}
                />

                <View style={styles.movementRow}>
                    <View style={[styles.movementCard, { backgroundColor: colors.errorLight }]}>
                        <AppText label="Sold" fontSize={11} color={colors.textSecondary} />
                        <AppText
                            label={`${formatQuantity(summary.soldQty)} ${summary.soldQty === 1 ? 'unit' : 'units'}`}
                            variant={1}
                            fontSize={16}
                            color={colors.error}
                            style={{ marginTop: 2 }}
                        />
                        <AppText label={formatCurrency(summary.salesTotal)} fontSize={11} color={colors.textTertiary} style={{ marginTop: 2 }} />
                    </View>
                    <View style={[styles.movementCard, { backgroundColor: colors.successLight }]}>
                        <AppText label="Purchased" fontSize={11} color={colors.textSecondary} />
                        <AppText
                            label={`${formatQuantity(summary.boughtQty)} ${summary.boughtQty === 1 ? 'unit' : 'units'}`}
                            variant={1}
                            fontSize={16}
                            color={config.GREEN_COLOR || colors.success}
                            style={{ marginTop: 2 }}
                        />
                        <AppText label={formatCurrency(summary.purchaseTotal)} fontSize={11} color={colors.textTertiary} style={{ marginTop: 2 }} />
                    </View>
                </View>

                <View style={styles.toolbarRow}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setShowDateFilter(true)}
                        style={[styles.dateRangeChip, { backgroundColor: colors.primaryShade, borderColor: config.THEME_COLOR }]}
                    >
                        <Lucide name="calendar-fold" color={config.THEME_COLOR} size={14} />
                        <AppText label={getDateRangeLabel()} fontSize={12} color={config.THEME_COLOR} style={{ marginLeft: 6 }} />
                        {isRecentMode ? (
                            <AppText label={` · ${RECENT_LIMIT}`} fontSize={11} color={config.THEME_COLOR} />
                        ) : null}
                    </TouchableOpacity>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {[
                            { value: 'all', label: 'All' },
                            { value: 'sale', label: 'Sales' },
                            { value: 'stock_in', label: 'Purchases' },
                        ].map((opt) => {
                            const active = typeFilter === opt.value;
                            return (
                                <TouchableOpacity
                                    key={opt.value}
                                    activeOpacity={0.7}
                                    onPress={() => setTypeFilter(opt.value)}
                                    style={[
                                        styles.typeChip,
                                        {
                                            backgroundColor: active ? config.THEME_COLOR : colors.surfaceSecondary || colors.background,
                                            borderColor: active ? config.THEME_COLOR : colors.border,
                                        },
                                    ]}
                                >
                                    <AppText
                                        label={opt.label}
                                        fontSize={12}
                                        variant={active ? 1 : 2}
                                        color={active ? colors.textInverse : colors.textSecondary}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>

            {showSearch ? (
                <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="search" color={colors.textTertiary} size={18} style={{ marginLeft: 12 }} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search attendant or invoice..."
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

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading movements..." color={colors.textTertiary} style={{ marginTop: 10 }} />
                </View>
            ) : (
                <FlashList
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 12, paddingTop: 8 }}
                    data={filteredData}
                    estimatedItemSize={110}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.THEME_COLOR} />
                    }
                    ListHeaderComponent={() =>
                        filteredData.length > 0 ? (
                            <View style={styles.listHeader}>
                                <AppText
                                    label={
                                        isRecentMode
                                            ? `Latest ${filteredData.length} line${filteredData.length !== 1 ? 's' : ''}`
                                            : `${filteredData.length} line${filteredData.length !== 1 ? 's' : ''} in range`
                                    }
                                    fontSize={13}
                                    color={colors.textTertiary}
                                />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={() => (
                        <View style={styles.emptyContainer}>
                            <Lucide name="arrow-left-right" color={colors.border} size={48} />
                            <AppText
                                label={searchQuery || typeFilter !== 'all' ? 'No matching lines' : 'No stock movement yet'}
                                variant={1}
                                fontSize={16}
                                color={colors.textTertiary}
                                style={{ marginTop: 12 }}
                            />
                            <AppText
                                label={
                                    searchQuery
                                        ? 'Try a different search'
                                        : isRecentMode
                                          ? 'Sales and purchases for this product will show here'
                                          : 'Try a wider date range'
                                }
                                fontSize={13}
                                color={colors.textTertiary}
                                style={{ marginTop: 6, textAlign: 'center' }}
                            />
                        </View>
                    )}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => (
                        <TransactionItem
                            item={item}
                            onPress={() => navigation.navigate('TransactionDetails', { item })}
                        />
                    )}
                />
            )}

            {/* Date Range Filter Modal */}
            <AppModal
                visible={showDateFilter}
                handleClose={() => setShowDateFilter(false)}
                title="Filter by Date"
                onRequestClose={() => setShowDateFilter(false)}
            >
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
                            {dateRanges.filter((r) => r.value !== 'custom').map((range) => {
                                const isSelected =
                                    range.value === 'recent'
                                        ? isRecentMode
                                        : selectedDateRange === range.value;
                                const getIcon = (value) => {
                                    switch(value) {
                                        case 'recent': return 'history';
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

                    {/* Custom Range Option */}
                    {dateRanges.filter((range) => range.value === 'custom').map((range) => {
                        const isSelected = selectedDateRange === range.value;
                        return (
                            <View key={range.id}>
                                <AppText 
                                    label="Other Options" 
                                    fontSize={13} 
                                    color={colors.textTertiary} 
                                    style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}
                                    fontFamily="FiraSans-Medium"
                                />
                                <TouchableOpacity
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
                                                name="calendar-range"
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
                            </View>
                        );
                    })}
                </ScrollView>
            </AppModal>

            {/* Custom Date Range Modal */}
            <AppModal
                visible={showCustomDatePicker}
                handleClose={() => setShowCustomDatePicker(false)}
                title="Custom Date Range"
                onRequestClose={() => setShowCustomDatePicker(false)}
            >
                <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.surface }}>
                    <View style={styles.customDateField}>
                        <AppText label="Start Date" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                        <TouchableOpacity onPress={() => {
                            if (Platform.OS === 'ios') {
                                setShowCustomDatePicker(false);
                                setTimeout(() => setShowStartPicker(true), 100);
                            } else {
                                // Close RN Modal first — nesting Android DateTimePicker on top freezes OK/Cancel.
                                setShowCustomDatePicker(false);
                                setTimeout(() => setShowStartPicker(true), 0);
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
                                setShowCustomDatePicker(false);
                                setTimeout(() => setShowEndPicker(true), 0);
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

            {/* Export Format Modal */}
            <AppModal
                visible={showExportFormatModal}
                handleClose={() => setShowExportFormatModal(false)}
                title="Export Format"
                onRequestClose={() => setShowExportFormatModal(false)}>
                <View style={{ padding: 16 }}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleExportFormatSelect('csv')}
                        style={[styles.exportOption, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.exportOptionIcon, { backgroundColor: colors.primaryShade }]}>
                            <Lucide name="file-spreadsheet" color={config.THEME_COLOR} size={24} />
                        </View>
                        <View style={styles.exportOptionContent}>
                            <AppText label="CSV / Excel" variant={1} fontSize={16} color={colors.text} />
                            <AppText label="Comma-separated values, opens in Excel" fontSize={12} color={colors.textSecondary} style={{ marginTop: 4 }} />
                        </View>
                        <Lucide name="chevron-right" color={colors.border} size={20} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleExportFormatSelect('pdf')}
                        style={[styles.exportOption, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.exportOptionIcon, { backgroundColor: colors.errorLight }]}>
                            <Lucide name="file-text" color={colors.error} size={24} />
                        </View>
                        <View style={styles.exportOptionContent}>
                            <AppText label="PDF" variant={1} fontSize={16} color={colors.text} />
                            <AppText label="Formatted document for printing" fontSize={12} color={colors.textSecondary} style={{ marginTop: 4 }} />
                        </View>
                        <Lucide name="chevron-right" color={colors.border} size={20} />
                    </TouchableOpacity>
                </View>
            </AppModal>
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
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    hero: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    movementRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
    },
    movementCard: {
        flex: 1,
        borderRadius: 10,
        padding: 12,
    },
    toolbarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 14,
    },
    dateRangeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: 1,
        flexShrink: 0,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 30,
        marginHorizontal: 12,
        marginTop: 10,
        marginBottom: 4,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        height: 44,
        marginLeft: 8,
        fontFamily: 'FiraSans-Regular',
        fontSize: 15,
        paddingRight: 10,
    },
    typeChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: 1,
    },
    listHeader: {
        paddingBottom: 8,
        marginBottom: 2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
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
    customDateField: {
        marginBottom: 20,
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
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    exportOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
    },
    exportOptionIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    exportOptionContent: {
        flex: 1,
        marginLeft: 14,
        marginRight: 8,
    },
    dateFilterOption: {
        borderRadius: 12,
        marginBottom: 8,
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
});

export default ProductTransactions;

