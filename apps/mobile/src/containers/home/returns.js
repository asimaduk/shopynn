import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, ScrollView, Platform, Share, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { FlashList } from '@shopify/flash-list';
import { useSelector } from 'react-redux';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import { canCreateReturns } from '../../utils/permissions';
import AppModal from '../../components/app_modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import useTheme from '../../hooks/useTheme';
import { returnsApi, normalizeList } from '../../services/api';

const SAMPLE_SALES_RETURNS = [
    { id: 'SR-001', type: 'sales', ref: '10888', customer: 'Liam Mensah', date: 'Feb 16, 2026 @ 10:30am', items: 2, amount: '180.00', reason: 'Defective', status: 'Approved' },
    { id: 'SR-002', type: 'sales', ref: '10886', customer: 'Walk-In', date: 'Feb 15, 2026 @ 2:15pm', items: 1, amount: '45.00', reason: 'Wrong item', status: 'Pending' },
    { id: 'SR-003', type: 'sales', ref: '10885', customer: 'Sarah Johnson', date: 'Feb 14, 2026 @ 9:00am', items: 3, amount: '275.50', reason: 'Damaged packaging', status: 'Approved' },
    { id: 'SR-004', type: 'sales', ref: '10884', customer: 'Michael Brown', date: 'Feb 13, 2026 @ 4:45pm', items: 1, amount: '89.99', reason: 'Not as described', status: 'Rejected' },
    { id: 'SR-005', type: 'sales', ref: '10883', customer: 'Emma Wilson', date: 'Feb 12, 2026 @ 11:20am', items: 2, amount: '150.00', reason: 'Customer changed mind', status: 'Pending' },
];

const SAMPLE_PURCHASE_RETURNS = [
    { id: 'PR-001', type: 'purchase', ref: 'PO-1002', supplier: 'Kasapreko', date: 'Feb 14, 2026 @ 3:00pm', items: 3, amount: '420.00', reason: 'Damaged in transit', status: 'Approved' },
    { id: 'PR-002', type: 'purchase', ref: 'PO-1001', supplier: 'Unilever Ghana', date: 'Feb 13, 2026 @ 10:15am', items: 5, amount: '750.00', reason: 'Expired products', status: 'Approved' },
    { id: 'PR-003', type: 'purchase', ref: 'PO-1000', supplier: 'Coca-Cola', date: 'Feb 11, 2026 @ 1:30pm', items: 2, amount: '320.00', reason: 'Wrong quantity delivered', status: 'Pending' },
];

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

// Parse date string like "Feb 16, 2026 @ 10:30am" to Date object
const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = dateStr.split(' @ ');
    if (parts.length !== 2) return null;
    
    const datePart = parts[0].trim();
    const timePart = parts[1].trim();
    
    const [monthName, day, year] = datePart.split(/[\s,]+/);
    const monthIndex = months.indexOf(monthName);
    if (monthIndex === -1) return null;
    
    const date = new Date(parseInt(year), monthIndex, parseInt(day));
    
    // Parse time (e.g., "10:30am" or "2:15pm")
    const timeMatch = timePart.match(/(\d+):(\d+)(am|pm)/i);
    if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const ampm = timeMatch[3].toLowerCase();
        
        if (ampm === 'pm' && hours !== 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
        
        date.setHours(hours, minutes, 0, 0);
    }
    
    return date;
};

const Returns = ({ navigation }) => {
    const { colors } = useTheme();
    const user = useSelector(({ user }) => user);
    const canCreate = canCreateReturns(user?.role);
    const [returnsList, setReturnsList] = useState([...SAMPLE_SALES_RETURNS, ...SAMPLE_PURCHASE_RETURNS]);
    const [activeTab, setActiveTab] = useState('sales');
    const [search, setSearch] = useState('');
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
    const [selectedDateRange, setSelectedDateRange] = useState('all_time');
    const [customStartDate, setCustomStartDate] = useState(new Date());
    const [customEndDate, setCustomEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [showExportFormatModal, setShowExportFormatModal] = useState(false);

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

    const loadReturns = useCallback(async () => {
        try {
            const raw = await returnsApi.list();
            const list = normalizeList(raw);
            setReturnsList(Array.isArray(list) && list.length > 0 ? list : [...SAMPLE_SALES_RETURNS, ...SAMPLE_PURCHASE_RETURNS]);
        } catch (_) {
            setReturnsList([...SAMPLE_SALES_RETURNS, ...SAMPLE_PURCHASE_RETURNS]);
        }
    }, []);

    useEffect(() => {
        loadReturns();
    }, [loadReturns]);

    const filteredData = useMemo(() => {
        const allReturns = activeTab === 'sales'
            ? returnsList.filter((r) => r.type === 'sales' || !r.type)
            : returnsList.filter((r) => r.type === 'purchase');
        let result = [...allReturns];

        // Apply search filter
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (r) =>
                    (r.customer && r.customer.toLowerCase().includes(q)) ||
                    (r.supplier && r.supplier.toLowerCase().includes(q)) ||
                    r.id.toLowerCase().includes(q) ||
                    r.ref.toLowerCase().includes(q) ||
                    r.reason.toLowerCase().includes(q)
            );
        }

        // Apply date filter
        if (selectedDateRange !== 'all_time') {
            const bounds = getDateRangeBounds();
            if (bounds) {
                result = result.filter((item) => {
                    const itemDate = parseDateString(item.date);
                    if (!itemDate) return false;
                    return itemDate >= bounds.start && itemDate < bounds.end;
                });
            }
        }

        return result;
    }, [returnsList, activeTab, search, selectedDateRange, customStartDate, customEndDate]);

    // Calculate summary stats
    const summaryStats = useMemo(() => {
        const total = filteredData.length;
        const approved = filteredData.filter(r => r.status === 'Approved').length;
        const pending = filteredData.filter(r => r.status === 'Pending').length;
        const rejected = filteredData.filter(r => r.status === 'Rejected').length;
        const totalAmount = filteredData.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        
        return { total, approved, pending, rejected, totalAmount };
    }, [filteredData]);

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

    const generateCSV = () => {
        const headers = 'ID,Reference,Type,Customer/Supplier,Date,Items,Amount,Reason,Status\n';
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
                escapeCSV(item.ref),
                escapeCSV(item.type),
                escapeCSV(activeTab === 'sales' ? item.customer : item.supplier),
                escapeCSV(item.date),
                escapeCSV(item.items),
                escapeCSV(item.amount),
                escapeCSV(item.reason),
                escapeCSV(item.status),
            ].join(',');
        });
        return headers + rows.join('\n');
    };

    const generatePDF = () => {
        const dateRangeLabel = getDateRangeLabel();
        const exportDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Returns Report</title>
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
        .status-approved {
            color: #10b981;
            font-weight: bold;
        }
        .status-pending {
            color: #f59e0b;
            font-weight: bold;
        }
        .status-rejected {
            color: #ef4444;
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
    </style>
</head>
<body>
    <h1>${activeTab === 'sales' ? 'Sales' : 'Purchase'} Returns Report</h1>
    <div class="header-info">
        <p><strong>Date Range:</strong> ${dateRangeLabel}</p>
        <p><strong>Export Date:</strong> ${exportDate}</p>
        <p><strong>Total Returns:</strong> ${filteredData.length}</p>
    </div>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Reference</th>
                <th>${activeTab === 'sales' ? 'Customer' : 'Supplier'}</th>
                <th>Date</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
`;

        filteredData.forEach((item) => {
            const statusClass = item.status === 'Approved' ? 'status-approved' :
                item.status === 'Pending' ? 'status-pending' :
                    'status-rejected';
            html += `
            <tr>
                <td>${item.id || ''}</td>
                <td>${item.ref || ''}</td>
                <td>${activeTab === 'sales' ? (item.customer || '') : (item.supplier || '')}</td>
                <td>${item.date || ''}</td>
                <td>${item.items || ''}</td>
                <td>${item.amount || ''}</td>
                <td>${item.reason || ''}</td>
                <td class="${statusClass}">${item.status || ''}</td>
            </tr>
            `;
        });

        html += `
        </tbody>
    </table>
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
            Alert.alert('No Data', `There are no ${activeTab === 'sales' ? 'sales' : 'purchase'} returns to export.`);
            return;
        }

        setExporting(true);

        setTimeout(async () => {
            try {
                const dateRangeLabel = getDateRangeLabel().replace(/ /g, '_');
                const dateStr = new Date().toISOString().split('T')[0];

                if (format === 'csv' || format === 'excel') {
                    const csvContent = generateCSV();
                    const fileName = `${activeTab === 'sales' ? 'Sales' : 'Purchase'}_Returns_${dateRangeLabel}_${dateStr}.csv`;

                    await Share.share({
                        message: csvContent,
                        title: fileName,
                    });
                } else if (format === 'pdf') {
                    const htmlContent = generatePDF();
                    const fileName = `${activeTab === 'sales' ? 'Sales' : 'Purchase'}_Returns_${dateRangeLabel}_${dateStr}.html`;

                    await Share.share({
                        message: htmlContent,
                        title: fileName,
                    });

                    Alert.alert(
                        'PDF Export',
                        'The HTML file has been shared. To convert to PDF:\n\n• iOS: Open in Safari, tap Share > Print > Save as PDF\n• Android: Open in browser, print > Save as PDF',
                        [{ text: 'OK' }]
                    );
                }
            } catch (error) {
                Alert.alert('Export Error', 'Could not export returns. Please try again.');
            } finally {
                setExporting(false);
            }
        }, 300);
    };

    const handleExport = () => {
        if (filteredData.length === 0) {
            Alert.alert('No Data', `There are no ${activeTab === 'sales' ? 'sales' : 'purchase'} returns to export.`);
            return;
        }
        setShowExportFormatModal(true);
    };

    const getStatusColor = (status) => {
        if (status === 'Approved') return config.GREEN_COLOR || colors.success;
        if (status === 'Pending') return config.THEME_COLOR || colors.text;
        return colors.error;
    };

    const getStatusIcon = (status) => {
        if (status === 'Approved') return 'circle-check';
        if (status === 'Pending') return 'clock';
        return 'x-circle';
    };

    const getStatusBg = (status) => {
        if (status === 'Approved') return colors.successLight;
        if (status === 'Pending') return colors.primaryShade;
        return colors.errorLight;
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Returns">
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => setShowDateFilter(true)}
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                        <Lucide name="calendar" color={config.THEME_COLOR} size={20} />
                    </TouchableOpacity>
                    {canCreate && (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate(activeTab === 'sales' ? 'NewSaleReturn' : 'NewPurchaseReturn')}
                            style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                            <Lucide name="plus" color={config.THEME_COLOR} size={20} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={handleExport}
                        disabled={exporting || filteredData.length === 0}
                        style={[styles.actionButton, { backgroundColor: colors.surface }, (exporting || filteredData.length === 0) && { opacity: 0.5 }]}>
                        {exporting ? (
                            <ActivityIndicator size="small" color={config.THEME_COLOR} />
                        ) : (
                            <Lucide name="download" color={config.THEME_COLOR} size={20} />
                        )}
                    </TouchableOpacity>
                </View>
            </ScreenHeader>

            {/* Summary Stats */}
            <View style={[styles.summarySection, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <View style={styles.summaryRow}>
                    <View>
                        <AppText label="Returns" fontSize={18} variant={1} color={colors.text} />
                        {selectedDateRange !== 'all_time' && (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => setShowDateFilter(true)}
                                style={[styles.dateRangeChip, { backgroundColor: colors.primaryShade, borderColor: config.THEME_COLOR + '30' }]}>
                                <Lucide name="calendar-fold" color={config.THEME_COLOR} size={12} />
                                <AppText label={getDateRangeLabel()} fontSize={11} color={config.THEME_COLOR} style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={styles.summaryStats}>
                        <View style={[styles.statPill, { backgroundColor: colors.surfaceSecondary }]}>
                            <AppText label={`${summaryStats.total}`} fontSize={16} variant={1} color={colors.text} />
                            <AppText label="Total" fontSize={10} color={colors.textTertiary} />
                        </View>
                        <View style={[styles.statPill, { backgroundColor: colors.successLight }]}>
                            <AppText label={`${summaryStats.approved}`} fontSize={16} variant={1} color={config.GREEN_COLOR || colors.success} />
                            <AppText label="Approved" fontSize={10} color={colors.textTertiary} />
                        </View>
                        {summaryStats.pending > 0 && (
                            <View style={[styles.statPill, { backgroundColor: colors.primaryShade }]}>
                                <AppText label={`${summaryStats.pending}`} fontSize={16} variant={1} color={config.THEME_COLOR} />
                                <AppText label="Pending" fontSize={10} color={colors.textTertiary} />
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setActiveTab('sales')}
                    style={[
                        styles.tab,
                        { backgroundColor: colors.surface },
                        activeTab === 'sales' && [styles.tabActive, { backgroundColor: config.THEME_COLOR }]
                    ]}>
                    <Lucide name="rotate-ccw" size={16} color={activeTab === 'sales' ? colors.textInverse : colors.textSecondary} />
                    <AppText label="Sales" variant={1} fontSize={14} color={activeTab === 'sales' ? colors.textInverse : colors.textSecondary} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setActiveTab('purchase')}
                    style={[
                        styles.tab,
                        { backgroundColor: colors.surface },
                        activeTab === 'purchase' && [styles.tabActive, { backgroundColor: config.THEME_COLOR }]
                    ]}>
                    <Lucide name="package-x" size={16} color={activeTab === 'purchase' ? colors.textInverse : colors.textSecondary} />
                    <AppText label="Purchase" variant={1} fontSize={14} color={activeTab === 'purchase' ? colors.textInverse : colors.textSecondary} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Lucide name="search" size={18} color={colors.placeholder} />
                <TextInput
                    placeholder={activeTab === 'sales' ? 'Search by customer or ID...' : 'Search by supplier or ID...'}
                    placeholderTextColor={colors.placeholder}
                    value={search}
                    onChangeText={setSearch}
                    style={[styles.searchInput, { color: colors.text }]}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Lucide name="x" color={colors.placeholder} size={18} />
                    </TouchableOpacity>
                )}
            </View>

            {/* List */}
            <FlashList
                data={filteredData}
                estimatedItemSize={120}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('ReturnDetails', { item, type: activeTab })}
                        style={[styles.returnCard, { backgroundColor: colors.surface }]}>
                        {/* Card Header */}
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderLeft}>
                                <View style={[styles.iconCircle, { backgroundColor: getStatusBg(item.status) }]}>
                                    <Lucide name={getStatusIcon(item.status)} size={18} color={getStatusColor(item.status)} />
                                </View>
                                <View style={styles.cardTitleSection}>
                                    <AppText label={item.id} variant={1} fontSize={16} color={colors.text} />
                                    <AppText label={`Ref: ${item.ref}`} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                </View>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.status) }]}>
                                <Lucide name={getStatusIcon(item.status)} size={12} color={getStatusColor(item.status)} />
                                <AppText label={item.status} fontSize={11} color={getStatusColor(item.status)} variant={1} style={{ marginLeft: 4 }} />
                            </View>
                        </View>

                        {/* Card Body */}
                        <View style={styles.cardBody}>
                            <View style={styles.cardRow}>
                                <View style={styles.cardInfo}>
                                    <Lucide name={activeTab === 'sales' ? 'user' : 'truck'} size={14} color={colors.textTertiary} />
                                    <AppText label={activeTab === 'sales' ? item.customer : item.supplier} fontSize={14} color={colors.text} style={{ marginLeft: 6 }} numberOfLines={1} />
                                </View>
                                <AppText label={`GHS ${item.amount}`} fontSize={18} variant={1} color={colors.text} />
                            </View>
                            <View style={styles.cardMetaRow}>
                                <View style={styles.cardMeta}>
                                    <Lucide name="calendar" size={12} color={colors.textTertiary} />
                                    <AppText label={item.date.split(' @ ')[0]} fontSize={12} color={colors.textSecondary} style={{ marginLeft: 4 }} />
                                </View>
                                <View style={styles.cardMeta}>
                                    <Lucide name="package" size={12} color={colors.textTertiary} />
                                    <AppText label={`${item.items} item${item.items !== 1 ? 's' : ''}`} fontSize={12} color={colors.textSecondary} style={{ marginLeft: 4 }} />
                                </View>
                            </View>
                            <View style={[styles.reasonRow, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="message-square" size={12} color={colors.textTertiary} />
                                <AppText label={item.reason} fontSize={12} color={colors.textSecondary} style={{ marginLeft: 6, flex: 1 }} numberOfLines={1} />
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSecondary }]}>
                            <Lucide name="rotate-ccw" size={32} color={colors.textTertiary} />
                        </View>
                        <AppText label="No returns found" variant={1} fontSize={16} color={colors.textTertiary} style={{ marginTop: 16 }} />
                        {selectedDateRange !== 'all_time' && (
                            <AppText label="Try adjusting your date filter" fontSize={13} color={colors.placeholder} style={{ marginTop: 8 }} />
                        )}
                        {canCreate && (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => navigation.navigate(activeTab === 'sales' ? 'NewSaleReturn' : 'NewPurchaseReturn')}
                                style={[styles.emptyBtn, { backgroundColor: config.THEME_COLOR }]}>
                                <Lucide name="plus" size={16} color={colors.textInverse} />
                                <AppText label="Create return" color={colors.textInverse} variant={1} fontSize={14} style={{ marginLeft: 6 }} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            />

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

            {/* Export Format Selection Modal */}
            <AppModal
                visible={showExportFormatModal}
                handleClose={() => setShowExportFormatModal(false)}
                title="Select Export Format"
                onRequestClose={() => setShowExportFormatModal(false)}>
                <View style={styles.exportModalContent}>
                    <AppText
                        label={`Export ${filteredData.length} return${filteredData.length !== 1 ? 's' : ''} as:`}
                        fontSize={14}
                        color={colors.textSecondary}
                        style={{ marginBottom: 20, textAlign: 'center' }}
                    />

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
                        <Lucide name="chevron-right" color={colors.textTertiary} size={20} />
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
                        <Lucide name="chevron-right" color={colors.textTertiary} size={20} />
                    </TouchableOpacity>
                </View>
            </AppModal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        paddingVertical: 5,
        marginRight: 10,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    summarySection: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    dateRangeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 6,
        borderWidth: 1,
    },
    summaryStats: {
        flexDirection: 'row',
        gap: 8,
    },
    statPill: {
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        minWidth: 50,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    tabActive: {},
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    searchInput: {
        flex: 1,
        paddingLeft: 10,
        fontFamily: 'FiraSans-Regular',
        fontSize: 15,
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    returnCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardTitleSection: {
        flex: 1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    cardBody: {
        gap: 10,
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    cardMetaRow: {
        flexDirection: 'row',
        gap: 16,
    },
    cardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    reasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        marginTop: 4,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
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
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    exportModalContent: {
        padding: 16,
    },
    exportOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    exportOptionIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    exportOptionContent: {
        flex: 1,
    },
});

export default Returns;
