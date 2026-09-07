import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { TextInput, TouchableOpacity, View, ScrollView, Platform, StyleSheet, Share, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import { canAdjustStock, canAccessScreen, hasFeature, hasPermission } from '../../utils/permissions';
import { FlashList } from '@shopify/flash-list';
import styles from './styles';
import AdjustmentItem from './adjustment_item';
import AppText from '../../components/text';
import config from '../../config';
import AppModal from '../../components/app_modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import useTheme from '../../hooks/useTheme';
import { adjustments as adjustmentsApi, normalizeList } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';

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

const formatAdjustmentDate = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const AdjustedQuantities = ({ navigation }) => {
    const { colors } = useTheme();
    const user = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const allowAdjust = canAdjustStock(user?.role);
    const canCreate = canAccessScreen(user, 'NewAdjustments', subscriptionFeatures);
    const canExport = hasPermission(user, ['reports.export']) && hasFeature(user, ['reports.export'], subscriptionFeatures);
    const [adjustments, setAdjustments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
    const [selectedDateRange, setSelectedDateRange] = useState('all_time');
    const [customStartDate, setCustomStartDate] = useState(new Date());
    const [customEndDate, setCustomEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [showExportFormatModal, setShowExportFormatModal] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

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

    const loadAdjustments = useCallback(async () => {
        setLoading(true);
        try {
            const bounds = getDateRangeBounds();
            const params = bounds ? { startDate: bounds.start?.toISOString?.()?.slice(0, 10), endDate: bounds.end?.toISOString?.()?.slice(0, 10) } : {};
            const raw = await adjustmentsApi.list(params);
            setAdjustments(normalizeList(raw).length ? normalizeList(raw) : []);
        } catch (_) {
            setAdjustments([]);
        } finally {
            setLoading(false);
        }
    }, [selectedDateRange, customStartDate, customEndDate]);

    useFocusEffect(
        useCallback(() => {
            loadAdjustments();
        }, [loadAdjustments])
    );

    const filteredData = useMemo(() => {
        let result = [...adjustments];

        // Apply search filter (reference_number, warehouse_name, notes, product names)
        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            result = result.filter((item) => {
                if (item.reference_number?.toLowerCase().includes(q)) return true;
                if (item.warehouse_name?.toLowerCase().includes(q)) return true;
                if (item.notes?.toLowerCase().includes(q)) return true;
                const products = item.products || [];
                if (products.some((p) => (p.product_name || '').toLowerCase().includes(q))) return true;
                return false;
            });
        }

        // Apply date filter (created_at ISO)
        if (selectedDateRange !== 'all_time') {
            const bounds = getDateRangeBounds();
            if (bounds) {
                result = result.filter((item) => {
                    const itemDate = item.created_at ? new Date(item.created_at) : null;
                    if (!itemDate || isNaN(itemDate.getTime())) return false;
                    return itemDate >= bounds.start && itemDate < bounds.end;
                });
            }
        }

        return result;
    }, [adjustments, searchText, selectedDateRange, customStartDate, customEndDate]);

    const handleSearch = (text) => {
        setSearchText(text);
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

    const backPress = () => {
        navigation.goBack();
    };

    const generateCSV = () => {
        const headers = 'Reference,Warehouse,Date,Items,Notes\n';
        const escapeCSV = (str) => {
            if (str == null) return '';
            const string = String(str);
            if (string.includes(',') || string.includes('"') || string.includes('\n')) {
                return `"${string.replace(/"/g, '""')}"`;
            }
            return string;
        };
        const rows = filteredData.map((item) => {
            const dateStr = formatAdjustmentDate(item.created_at);
            const count = item.number_of_items ?? (Array.isArray(item.products) ? item.products.length : 0);
            return [
                escapeCSV(item.reference_number || item.id),
                escapeCSV(item.warehouse_name),
                escapeCSV(dateStr),
                count,
                escapeCSV(item.notes),
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
    <title>Adjusted Quantities Report</title>
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
        .type-addition {
            color: #10b981;
            font-weight: bold;
        }
        .type-subtraction {
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
    <h1>Adjusted Quantities Report</h1>
    <div class="header-info">
        <p><strong>Date Range:</strong> ${dateRangeLabel}</p>
        <p><strong>Export Date:</strong> ${exportDate}</p>
        <p><strong>Total Adjustments:</strong> ${filteredData.length}</p>
    </div>
    <table>
        <thead>
            <tr>
                <th>Reference</th>
                <th>Warehouse</th>
                <th>Date</th>
                <th>Items</th>
                <th>Notes</th>
            </tr>
        </thead>
        <tbody>
`;

        filteredData.forEach((item) => {
            const dateStr = formatAdjustmentDate(item.created_at);
            const count = item.number_of_items ?? (Array.isArray(item.products) ? item.products.length : 0);
            html += `
            <tr>
                <td>${item.reference_number || item.id || ''}</td>
                <td>${item.warehouse_name || ''}</td>
                <td>${dateStr}</td>
                <td>${count}</td>
                <td>${(item.notes || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
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
            Alert.alert('No Data', 'There are no adjustments to export.');
            return;
        }

        setExporting(true);
        
        setTimeout(async () => {
            try {
                const dateRangeLabel = getDateRangeLabel().replace(/ /g, '_');
                const dateStr = new Date().toISOString().split('T')[0];
                
                if (format === 'csv' || format === 'excel') {
                    const csvContent = generateCSV();
                    const fileName = `Adjustments_${dateRangeLabel}_${dateStr}.csv`;
                    
                    await Share.share({
                        message: csvContent,
                        title: fileName,
                    });
                } else if (format === 'pdf') {
                    const htmlContent = generatePDF();
                    const fileName = `Adjustments_${dateRangeLabel}_${dateStr}.html`;
                    
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
                Alert.alert('Export Error', 'Could not export adjustments. Please try again.');
            } finally {
                setExporting(false);
            }
        }, 300);
    };

    const handleExport = () => {
        if (filteredData.length === 0) {
            Alert.alert('No Data', 'There are no adjustments to export.');
            return;
        }
        setShowExportFormatModal(true);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label={'Adjustments'}>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => {
                            setShowSearch((prev) => {
                                const next = !prev;
                                if (!next) handleSearch('');
                                return next;
                            });
                        }}
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                        <Lucide name={showSearch ? 'x' : 'search'} color={colors.text} size={20} />
                    </TouchableOpacity>
                    {canCreate && (
                        <TouchableOpacity activeOpacity={0.6} onPress={() => navigation.navigate("NewAdjustments")} style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                            <Lucide name="plus" color={config.THEME_COLOR} size={20} />
                        </TouchableOpacity>
                    )}
                    {canExport && (
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
                    )}
                </View>
            </ScreenHeader>

            {/* New adjustment button */}
            {/* {allowAdjust && (
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('NewAdjustments')}
                    style={[localStyles.newAdjustmentButton, { backgroundColor: config.THEME_COLOR }]}
                >
                    <Lucide name="plus-circle" size={20} color="#fff" />
                    <AppText label="New adjustment" fontSize={15} variant={1} color="#fff" style={{ marginLeft: 10 }} />
                </TouchableOpacity>
            )} */}

            {/* Date range chip and count */}
            <View style={localStyles.headerRow}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setShowDateFilter(true)}
                    style={[localStyles.dateRangeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[localStyles.leadingIconWrap, { backgroundColor: colors.primaryShade }]}>
                        <Lucide name="calendar-fold" color={config.THEME_COLOR} size={15} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <AppText label="Date Range" fontSize={11} color={colors.textTertiary} />
                        <AppText label={getDateRangeLabel()} fontSize={13} variant={1} color={colors.text} style={{ marginTop: 2 }} />
                    </View>
                    <Lucide name="chevron-right" color={colors.textTertiary} size={18} />
                </TouchableOpacity>

                <View style={localStyles.statsRow}>
                    <View style={[localStyles.statCard, localStyles.statCardCompact, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={localStyles.statContent}>
                            <View style={{ flex: 1 }}>
                                <AppText label="Adjustments" fontSize={11} color={colors.textSecondary} style={localStyles.statLabel} />
                                <AppText
                                    label={`${filteredData.length}`}
                                    fontSize={17}
                                    variant={1}
                                    color={colors.text}
                                    style={localStyles.statValue}
                                />
                            </View>
                            <View style={[localStyles.statRightIconWrap, { backgroundColor: colors.primaryShade }]}>
                                <Lucide name="list" color={config.THEME_COLOR} size={15} />
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            {showSearch ? (
                <View style={[localStyles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="search" color={colors.textTertiary} size={18} />
                    <TextInput
                        style={[localStyles.searchInput, { color: colors.text }]}
                        placeholder="Search adjustments..."
                        placeholderTextColor={colors.placeholder}
                        value={searchText}
                        onChangeText={handleSearch}
                        autoCorrect={false}
                        autoCapitalize="none"
                        returnKeyType="search"
                    />
                    {searchText.length > 0 ? (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <Lucide name="x" color={colors.textTertiary} size={18} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}

            {loading && adjustments.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading adjustments..." color={colors.textSecondary} style={{ marginTop: 12 }} />
                </View>
            ) : (
                <FlashList
                    contentContainerStyle={styles.listContent}
                    data={filteredData}
                    estimatedItemSize={80}
                    showsVerticalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item, index }) => (
                        <AdjustmentItem
                            item={item}
                            index={index}
                            onPress={() => navigation.navigate('AdjustmentDetails', { item })}
                        />
                    )}
                    ListEmptyComponent={() => (
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Lucide name="package-x" color={colors.border} size={48} />
                            <AppText label="No adjustments found" color={colors.textTertiary} style={{ marginTop: 12 }} />
                            {selectedDateRange !== 'all_time' && (
                                <AppText label="Try adjusting your date filter" fontSize={12} color={colors.placeholder} style={{ marginTop: 4 }} />
                            )}
                        </View>
                    )}
                />
            )}

            {/* Date Filter Modal */}
            <AppModal
                visible={showDateFilter}
                handleClose={() => setShowDateFilter(false)}
                title="Filter by Date"
                onRequestClose={() => setShowDateFilter(false)}>
                <ScrollView 
                    style={[localStyles.modalList, { backgroundColor: colors.surface }]} 
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
                                            localStyles.dateFilterChip,
                                            {
                                                backgroundColor: isSelected ? colors.primaryShade : colors.surfaceSecondary,
                                                borderColor: isSelected ? config.THEME_COLOR : colors.border,
                                                borderWidth: isSelected ? 2 : 1,
                                            }
                                        ]}>
                                        <View style={[
                                            localStyles.chipIconContainer,
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
                                            <View style={[localStyles.checkBadge, { backgroundColor: config.THEME_COLOR }]}>
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
                                        localStyles.dateFilterOption,
                                        {
                                            backgroundColor: isSelected ? colors.primaryShade : colors.surface,
                                            borderLeftColor: isSelected ? config.THEME_COLOR : 'transparent',
                                            borderLeftWidth: isSelected ? 4 : 0,
                                        }
                                    ]}>
                                    <View style={localStyles.optionContent}>
                                        <View style={[
                                            localStyles.optionIconContainer,
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
                                            <View style={[localStyles.selectedIndicator, { backgroundColor: config.THEME_COLOR }]}>
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
                    <View style={localStyles.customDateField}>
                        <AppText label="Start Date" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                        <TouchableOpacity onPress={() => {
                            if (Platform.OS === 'ios') {
                                setShowCustomDatePicker(false);
                                setTimeout(() => setShowStartPicker(true), 100);
                            } else {
                                setShowStartPicker(true);
                            }
                        }} style={[localStyles.dateFieldTouch, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                            <Lucide name="calendar" size={18} color={colors.placeholder} />
                            <AppText label={formatDate(customStartDate)} fontSize={15} color={colors.text} style={{ marginLeft: 10, flex: 1 }} />
                            <Lucide name="chevron-down" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                    <View style={localStyles.customDateField}>
                        <AppText label="End Date" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                        <TouchableOpacity onPress={() => {
                            if (Platform.OS === 'ios') {
                                setShowCustomDatePicker(false);
                                setTimeout(() => setShowEndPicker(true), 100);
                            } else {
                                setShowEndPicker(true);
                            }
                        }} style={[localStyles.dateFieldTouch, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                            <Lucide name="calendar" size={18} color={colors.placeholder} />
                            <AppText label={formatDate(customEndDate)} fontSize={15} color={colors.text} style={{ marginLeft: 10, flex: 1 }} />
                            <Lucide name="chevron-down" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity activeOpacity={0.8} onPress={handleApplyCustomRange} style={[localStyles.applyDateButton, { backgroundColor: config.THEME_COLOR }]}>
                        <AppText label="Apply Date Range" fontSize={16} variant={1} color={colors.textInverse} />
                    </TouchableOpacity>
                </ScrollView>
            </AppModal>

            {/* Export Format Selection Modal */}
            <AppModal
                visible={showExportFormatModal}
                handleClose={() => setShowExportFormatModal(false)}
                title="Select Export Format"
                onRequestClose={() => setShowExportFormatModal(false)}>
                <View style={localStyles.exportModalContent}>
                    <AppText 
                        label={`Export ${filteredData.length} adjustment${filteredData.length !== 1 ? 's' : ''} as:`} 
                        fontSize={14} 
                        color={colors.textSecondary} 
                        style={{ marginBottom: 20, textAlign: 'center' }} 
                    />
                    
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleExportFormatSelect('csv')}
                        style={[localStyles.exportOption, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[localStyles.exportOptionIcon, { backgroundColor: colors.primaryShade }]}>
                            <Lucide name="file-spreadsheet" color={config.THEME_COLOR} size={24} />
                        </View>
                        <View style={localStyles.exportOptionContent}>
                            <AppText label="CSV / Excel" variant={1} fontSize={16} color={colors.text} />
                            <AppText label="Comma-separated values, opens in Excel" fontSize={12} color={colors.textSecondary} style={{ marginTop: 4 }} />
                        </View>
                        <Lucide name="chevron-right" color={colors.textTertiary} size={20} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleExportFormatSelect('pdf')}
                        style={[localStyles.exportOption, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[localStyles.exportOptionIcon, { backgroundColor: colors.errorLight }]}>
                            <Lucide name="file-text" color={colors.error} size={24} />
                        </View>
                        <View style={localStyles.exportOptionContent}>
                            <AppText label="PDF" variant={1} fontSize={16} color={colors.text} />
                            <AppText label="Formatted document for printing" fontSize={12} color={colors.textSecondary} style={{ marginTop: 4 }} />
                        </View>
                        <Lucide name="chevron-right" color={colors.textTertiary} size={20} />
                    </TouchableOpacity>
                </View>
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
                            style={[localStyles.applyDateButton, { backgroundColor: config.THEME_COLOR, marginTop: 20 }]}>
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
                            style={[localStyles.applyDateButton, { backgroundColor: config.THEME_COLOR, marginTop: 20 }]}>
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
        </SafeAreaView>
    );
};

const localStyles = StyleSheet.create({
    newAdjustmentButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 15,
        marginTop: 8,
        paddingVertical: 14,
        borderRadius: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: 10,
        paddingBottom: 10,
        gap: 8,
    },
    dateRangeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    leadingIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    statsRow: {
        width: 132,
    },
    statCard: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 9,
    },
    statCardCompact: {
        width: '100%',
    },
    statContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statRightIconWrap: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    statLabel: {
        letterSpacing: 0.2,
    },
    statValue: {
        marginTop: 1,
    },
    dateRangeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    countBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 30,
        // marginTop: 8,
        paddingHorizontal: 10,
        marginHorizontal: 15,
        height: 45,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        marginLeft: 10,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
    },
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 12,
        marginTop: 10,
        marginHorizontal: 15,
        borderRadius: 8,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
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

export default AdjustedQuantities;
