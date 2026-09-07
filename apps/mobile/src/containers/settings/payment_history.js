import React, { useState, useMemo, useEffect } from 'react';
import { TextInput, TouchableOpacity, View, ScrollView, Platform, StyleSheet, Share, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import { FlashList } from '@shopify/flash-list';
import styles from './styles';
import AppText from '../../components/text';
import config from '../../config';
import AppModal from '../../components/app_modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import useTheme from '../../hooks/useTheme';
import { useSelector } from 'react-redux';
import { subscriptions as subscriptionsApi } from '../../services/api';
import { canManageSubscription } from '../../utils/permissions';

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});

function getPaymentStatusBadgeStyle(status) {
    const s = String(status || '').toLowerCase();
    if (['completed', 'success', 'paid'].includes(s)) {
        return { backgroundColor: '#dcfce7', color: '#10b981' };
    }
    if (['failed', 'error', 'cancelled', 'canceled'].includes(s)) {
        return { backgroundColor: '#fee2e2', color: '#ef4444' };
    }
    if (['pending', 'processing'].includes(s)) {
        return { backgroundColor: '#fef3c7', color: '#f59e0b' };
    }
    return { backgroundColor: '#f3f4f6', color: '#6b7280' };
}

function mapBillingPayment(row) {
    const createdAt = row?.created_at ? String(row.created_at) : '';
    const methodRaw = row?.payment_method_type || row?.payment_method || row?.method || '';
    const method = String(methodRaw).toLowerCase().includes('mobile') ? 'Mobile Money' : methodRaw ? 'Card' : '—';
    return {
        id: row?.id || row?.transaction_ref || createdAt,
        date: createdAt,
        amount: Number(row?.amount || 0),
        status: row?.status || '—',
        invoice: row?.transaction_ref || row?.reference || '—',
        method,
    };
}


// Parse ISO datetime or date-only string "2026-02-19"
const parsePaymentDate = (dateStr) => {
    if (!dateStr) return null;
    const parsed = new Date(dateStr);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const parts = String(dateStr).split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!year || month < 0 || !day) return null;
    return new Date(year, month, day);
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const PaymentHistory = ({ navigation }) => {
    const { colors } = useTheme();
    const user = useSelector((state) => state.user);
    const subscriptionFeatures = useSelector((state) => state.appSettings?.subscriptionFeatures || []);
    const [searchText, setSearchText] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
    // Initialize with last 30 days as default
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    const [appliedStartDate, setAppliedStartDate] = useState(defaultStartDate);
    const [appliedEndDate, setAppliedEndDate] = useState(defaultEndDate);
    const [draftStartDate, setDraftStartDate] = useState(defaultStartDate);
    const [draftEndDate, setDraftEndDate] = useState(defaultEndDate);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [showExportFormatModal, setShowExportFormatModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState([]);

    useEffect(() => {
        if (!canManageSubscription(user, subscriptionFeatures)) {
            navigation.goBack();
            return;
        }
        loadPaymentHistory();
    }, [user, subscriptionFeatures, navigation]);

    const loadPaymentHistory = async () => {
        try {
            const res = await subscriptionsApi.current({ payments_limit: 200 });
            const rows = Array.isArray(res?.recentPayments) ? res.recentPayments.map(mapBillingPayment) : [];
            setData(rows);
        } catch (error) {
            console.error('Error loading payment history:', error);
            Alert.alert('Error', 'Failed to load payment history. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadPaymentHistory();
        setRefreshing(false);
    };

    const getDateRangeBounds = () => {
        return { start: appliedStartDate, end: new Date(appliedEndDate.getTime() + 24 * 60 * 60 * 1000) };
    };

    const filteredData = useMemo(() => {
        let result = [...data];

        // Apply search filter
        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            result = result.filter(
                (item) =>
                    item.invoice.toLowerCase().includes(q) ||
                    item.method.toLowerCase().includes(q) ||
                    item.status.toLowerCase().includes(q) ||
                    formatter.format(item.amount).replace('GH₵', 'GHS ')
            );
        }

        // Apply date filter
        const bounds = getDateRangeBounds();
        if (bounds) {
            result = result.filter((item) => {
                const itemDate = parsePaymentDate(item.date);
                if (!itemDate) return false;
                const itemDay = startOfDay(itemDate);
                return itemDay >= bounds.start && itemDay < bounds.end;
            });
        }

        return result;
    }, [data, searchText, appliedStartDate, appliedEndDate]);

    const handleSearch = (text) => {
        setSearchText(text);
    };

    const openCustomDatePicker = () => {
        setDraftStartDate(appliedStartDate);
        setDraftEndDate(appliedEndDate);
        setShowStartPicker(false);
        setShowEndPicker(false);
        setShowCustomDatePicker(true);
    };

    const handleApplyCustomRange = async () => {
        if (draftStartDate > draftEndDate) {
            Alert.alert('Invalid range', 'Start date must be on or before the end date.');
            return;
        }
        setAppliedStartDate(draftStartDate);
        setAppliedEndDate(draftEndDate);
        setShowCustomDatePicker(false);
        setShowStartPicker(false);
        setShowEndPicker(false);
        setIsLoading(true);
        await loadPaymentHistory();
    };

    const formatDate = (date) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };

    const formatDateDisplay = (dateStr) => {
        const date = parsePaymentDate(dateStr);
        if (!date || Number.isNaN(date.getTime())) return dateStr || '—';
        return date.toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getDateRangeLabel = () => {
        return `${formatDate(appliedStartDate)} - ${formatDate(appliedEndDate)}`;
    };

    const onStartDateChange = (event, selectedDate) => {
        if (selectedDate) {
            setDraftStartDate(selectedDate);
        }
        if (Platform.OS === 'android') {
            setShowStartPicker(false);
        }
    };

    const onEndDateChange = (event, selectedDate) => {
        if (selectedDate) {
            setDraftEndDate(selectedDate);
        }
        if (Platform.OS === 'android') {
            setShowEndPicker(false);
        }
    };

    const generateCSV = () => {
        const headers = 'Date,Invoice,Amount,Status,Payment Method\n';
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
                escapeCSV(formatDateDisplay(item.date)),
                escapeCSV(item.invoice),
                escapeCSV(formatter.format(item.amount).replace('GH₵', 'GHS ')),
                escapeCSV(item.status),
                escapeCSV(item.method),
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

        const totalAmount = filteredData.reduce((sum, item) => sum + item.amount, 0);

        let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Payment History Report</title>
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
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th {
            background-color: ${config.THEME_COLOR || '#0A74DA'};
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: bold;
        }
        td {
            padding: 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        .summary {
            margin-top: 30px;
            padding: 15px;
            background-color: #f1f5f9;
            border-left: 4px solid ${config.THEME_COLOR || '#0A74DA'};
        }
        .summary-row {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
        }
        .label {
            font-weight: bold;
            color: #64748b;
        }
        .value {
            color: #1e293b;
            font-size: 1.1em;
        }
    </style>
</head>
<body>
    <h1>Payment History Report</h1>
    <p><strong>Date Range:</strong> ${dateRangeLabel}</p>
    <p><strong>Export Date:</strong> ${exportDate}</p>
    
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment Method</th>
            </tr>
        </thead>
        <tbody>
            ${filteredData.map((item) => `
                <tr>
                    <td>${formatDateDisplay(item.date)}</td>
                    <td>${item.invoice}</td>
                    <td>${formatter.format(item.amount).replace('GH₵', 'GHS ')}</td>
                    <td>${item.status.toUpperCase()}</td>
                    <td>${item.method}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div class="summary">
        <div class="summary-row">
            <span class="label">Total Payments:</span>
            <span class="value">${filteredData.length}</span>
        </div>
        <div class="summary-row">
            <span class="label">Total Amount:</span>
            <span class="value">${formatter.format(totalAmount).replace('GH₵', 'GHS ')}</span>
        </div>
    </div>
    
    <p>Generated by Shopynn - Inventory Management System</p>
</body>
</html>
        `;

        return html;
    };

    const handleExportFormatSelect = (format) => {
        setShowExportFormatModal(false);

        if (filteredData.length === 0) {
            Alert.alert('No Data', 'There are no payments to export.');
            return;
        }

        setExporting(true);

        setTimeout(async () => {
            try {
                const dateRangeLabel = getDateRangeLabel().replace(/ /g, '_');
                const dateStr = new Date().toISOString().split('T')[0];

                if (format === 'csv' || format === 'excel') {
                    const csvContent = generateCSV();
                    const fileName = `Payment_History_${dateRangeLabel}_${dateStr}.csv`;

                    await Share.share({
                        message: csvContent,
                        title: fileName,
                    });
                } else if (format === 'pdf') {
                    const htmlContent = generatePDF();
                    const fileName = `Payment_History_${dateRangeLabel}_${dateStr}.html`;

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
                Alert.alert('Export Error', 'Could not export payment history. Please try again.');
            } finally {
                setExporting(false);
            }
        }, 300);
    };

    const handleExport = () => {
        if (filteredData.length === 0) {
            Alert.alert('No Data', 'There are no payments to export.');
            return;
        }
        setShowExportFormatModal(true);
    };

    const renderPaymentItem = ({ item }) => {
        const statusBadge = getPaymentStatusBadgeStyle(item.status);
        return (
            <TouchableOpacity
                activeOpacity={0.6}
                onPress={() => navigation.navigate('PaymentInvoice', { payment: item, planName: 'Premium' })}
                style={[localStyles.paymentRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={localStyles.paymentLeft}>
                    <View style={[localStyles.paymentIcon, { backgroundColor: colors.surfaceSecondary }]}>
                        <Lucide name="wallet" size={18} color={config.THEME_COLOR} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                        <AppText label={formatDateDisplay(item.date)} variant={2} fontSize={15} color={colors.text} />
                        <AppText label={item.invoice} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                        <AppText label={item.method} fontSize={11} color={colors.textSecondary} style={{ marginTop: 4 }} />
                    </View>
                </View>
                <View style={localStyles.paymentRight}>
                    <AppText label={formatter.format(item.amount).replace('GH₵', 'GHS ')} variant={1} fontSize={16} color={colors.text} />
                    <View style={[localStyles.paidBadge, { backgroundColor: statusBadge.backgroundColor }]}>
                        <AppText
                            label={String(item.status || '—').toUpperCase()}
                            fontSize={10}
                            variant={2}
                            color={statusBadge.color}
                        />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label={'Payment History'}>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => {
                            setShowSearch((prev) => {
                                const next = !prev;
                                if (!next) setSearchText('');
                                return next;
                            });
                        }}
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                        <Lucide name={showSearch ? 'x' : 'search'} color={colors.text} size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={openCustomDatePicker}
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                        <Lucide name="calendar" color={config.THEME_COLOR} size={20} />
                    </TouchableOpacity>
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

            {/* Date range chip and count */}
            <View style={localStyles.headerRow}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={openCustomDatePicker}
                    style={[localStyles.dateRangeChip, { backgroundColor: colors.primaryShade, borderColor: config.THEME_COLOR + '30' }]}>
                    <Lucide name="calendar-fold" color={config.THEME_COLOR} size={14} />
                    <AppText label={getDateRangeLabel()} fontSize={12} color={config.THEME_COLOR} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
                <View style={[localStyles.countBadge, { backgroundColor: colors.primaryShade, borderColor: config.THEME_COLOR + '30' }]}>
                    <Lucide name="list" color={config.THEME_COLOR} size={14} />
                    <AppText label={`${filteredData.length} payment${filteredData.length !== 1 ? 's' : ''}`} fontSize={12} color={config.THEME_COLOR} style={{ marginLeft: 6 }} />
                </View>
            </View>

            {showSearch ? (
                <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
                    <Lucide name="search" color={colors.textTertiary} size={18} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search payments..."
                        placeholderTextColor={colors.placeholder}
                        value={searchText}
                        onChangeText={handleSearch}
                        autoCorrect={false}
                        autoCapitalize="none"
                        returnKeyType="search"
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchText('')}>
                            <Lucide name="x" color={colors.textTertiary} size={18} />
                        </TouchableOpacity>
                    )}
                </View>
            ) : null}

            {isLoading && !refreshing ? (
                <View style={localStyles.loadingContainer}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading payment history..." fontSize={14} color={colors.textTertiary} style={{ marginTop: 12 }} />
                </View>
            ) : (
                <FlashList
                    data={filteredData}
                    renderItem={renderPaymentItem}
                    estimatedItemSize={80}
                    contentContainerStyle={{ padding: 16 }}
                    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={config.THEME_COLOR}
                            colors={[config.THEME_COLOR]}
                        />
                    }
                    ListEmptyComponent={() => (
                        <View style={localStyles.emptyContainer}>
                            <Lucide name="receipt" size={64} color={colors.border} />
                            <AppText label="No payments found" variant={2} fontSize={16} color={colors.textSecondary} style={{ marginTop: 16 }} />
                            <AppText label="Try adjusting your filters" fontSize={14} color={colors.textTertiary} style={{ marginTop: 8 }} />
                        </View>
                    )}
                />
            )}

            {/* Custom Date Range Modal */}
            <AppModal
                visible={showCustomDatePicker}
                handleClose={() => setShowCustomDatePicker(false)}
                title="Custom Date Range"
                onRequestClose={() => setShowCustomDatePicker(false)}>
                <View style={[localStyles.modalContent, { backgroundColor: colors.surface }]}>
                    <View style={localStyles.dateField}>
                        <AppText label="Start Date" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowStartPicker(true)}
                            style={[localStyles.dateFieldTouch, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <AppText label={formatDate(draftStartDate)} fontSize={15} color={colors.text} />
                            <Lucide name="calendar" color={colors.textTertiary} size={18} />
                        </TouchableOpacity>
                        {showStartPicker && (
                            <DateTimePicker
                                value={draftStartDate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={onStartDateChange}
                                maximumDate={draftEndDate}
                            />
                        )}
                    </View>

                    <View style={localStyles.dateField}>
                        <AppText label="End Date" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowEndPicker(true)}
                            style={[localStyles.dateFieldTouch, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <AppText label={formatDate(draftEndDate)} fontSize={15} color={colors.text} />
                            <Lucide name="calendar" color={colors.textTertiary} size={18} />
                        </TouchableOpacity>
                        {showEndPicker && (
                            <DateTimePicker
                                value={draftEndDate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={onEndDateChange}
                                minimumDate={draftStartDate}
                                maximumDate={new Date()}
                            />
                        )}
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleApplyCustomRange}
                        style={[localStyles.applyDateButton, { backgroundColor: config.THEME_COLOR }]}>
                        <AppText label="Apply Range" variant={1} fontSize={16} color="#fff" />
                    </TouchableOpacity>
                </View>
            </AppModal>

            {/* Export Format Selection Modal */}
            <AppModal
                visible={showExportFormatModal}
                handleClose={() => setShowExportFormatModal(false)}
                title="Select Export Format"
                onRequestClose={() => setShowExportFormatModal(false)}>
                <View style={[localStyles.exportModalContent, { backgroundColor: colors.surface }]}>
                    <AppText
                        label={`Export ${filteredData.length} payment${filteredData.length !== 1 ? 's' : ''} as:`}
                        fontSize={14}
                        color={colors.textSecondary}
                        style={{ marginBottom: 20 }}
                    />
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleExportFormatSelect('csv')}
                        style={[localStyles.exportOption, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                        <View style={[localStyles.exportOptionIcon, { backgroundColor: colors.primaryShade }]}>
                            <Lucide name="file-text" color={config.THEME_COLOR} size={24} />
                        </View>
                        <View style={localStyles.exportOptionContent}>
                            <AppText label="CSV File" variant={2} fontSize={16} color={colors.text} />
                            <AppText label="Spreadsheet compatible" fontSize={12} color={colors.textTertiary} style={{ marginTop: 4 }} />
                        </View>
                        <Lucide name="chevron-right" color={colors.border} size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleExportFormatSelect('pdf')}
                        style={[localStyles.exportOption, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, { marginTop: 12 }]}>
                        <View style={[localStyles.exportOptionIcon, { backgroundColor: colors.errorLight }]}>
                            <Lucide name="file" color="#ef4444" size={24} />
                        </View>
                        <View style={localStyles.exportOptionContent}>
                            <AppText label="PDF Document" variant={2} fontSize={16} color={colors.text} />
                            <AppText label="Formatted report" fontSize={12} color={colors.textTertiary} style={{ marginTop: 4 }} />
                        </View>
                        <Lucide name="chevron-right" color={colors.border} size={20} />
                    </TouchableOpacity>
                </View>
            </AppModal>
        </SafeAreaView>
    );
};

const localStyles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    dateRangeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
    },
    countBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
    },
    paymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    paymentLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    paymentIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    paymentRight: {
        alignItems: 'flex-end',
    },
    paidBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    modalContent: {
        padding: 20,
    },
    dateField: {
        marginBottom: 20,
    },
    dateFieldTouch: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
        borderRadius: 10,
        borderWidth: 1,
    },
    applyDateButton: {
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    exportModalContent: {
        padding: 20,
    },
    exportOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 10,
        borderWidth: 1,
    },
    exportOptionIcon: {
        width: 48,
        height: 48,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    exportOptionContent: {
        flex: 1,
        marginLeft: 12,
    },
});

export default PaymentHistory;
