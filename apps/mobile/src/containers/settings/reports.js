import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useSelector } from 'react-redux';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { hasPermission, canAccessScreen } from '../../utils/permissions';

// Sample report types for an inventory management system
const REPORT_SECTIONS = [
    {
        title: 'Inventory',
        color: config.THEME_COLOR,
        reports: [
            { id: 'stock-summary', title: 'Stock summary', description: 'Current stock levels by product and category', icon: 'package' },
            // { id: 'low-stock', title: 'Low stock / Reorder', description: 'Items below reorder point needing restock', icon: 'triangle-alert' },
            // { id: 'slow-moving', title: 'Slow-moving / Dead stock', description: 'Items with little or no movement', icon: 'trending-down' },
            // { id: 'expiry-batch', title: 'Expiry & batch', description: 'Items by expiry date or batch number', icon: 'calendar-clock' },
        ],
    },
    {
        title: 'Sales & revenue',
        color: '#10b981',
        reports: [
            { id: 'daily-sales', title: 'Daily sales', description: 'Daily sales totals chart and breakdown', icon: 'chart-line', screen: 'DailySales' },
            { id: 'sales-summary', title: 'Sales summary', description: 'Sales by period, product, and store', icon: 'shopping-cart' },
            // { id: 'revenue', title: 'Revenue report', description: 'Revenue breakdown and trends', icon: 'wallet' },
            { id: 'top-products', title: 'Top selling products', description: 'Best sellers by quantity or value', icon: 'trending-up' },
            { id: 'sales-by-customer', title: 'Sales by customer', description: 'Who bought what and when', icon: 'users' },
            { id: 'sales-by-staff', title: 'Sales by staff / cashier', description: 'Daily sales totals by staff or cashier', icon: 'user' },
        ],
    },
    {
        title: 'Purchases & costs',
        color: '#f59e0b',
        reports: [
            { id: 'purchase-summary', title: 'Purchase summary', description: 'Purchases by supplier and period', icon: 'truck' },
            // { id: 'cogs', title: 'Cost of goods (COGS)', description: 'Cost of goods sold and margins', icon: 'calculator' },
            // { id: 'supplier-summary', title: 'Supplier summary', description: 'Spend and orders by supplier', icon: 'bookmark-check' },
        ],
    },
    {
        title: 'Operations',
        color: '#6366f1',
        reports: [
            { id: 'transfers', title: 'Transfer report', description: 'Stock transfers between locations', icon: 'package-check' },
            { id: 'adjustments', title: 'Adjustments history', description: 'Inventory adjustments and reasons', icon: 'circle-minus' },
            { id: 'audit-trail', title: 'Audit trail', description: 'Who did what and when', icon: 'history' },
        ],
    },
    {
        title: 'Financial',
        color: '#0ea5e9',
        reports: [
            // { id: 'balance', title: 'Balance / Reconciliation', description: 'Cash and account balance reconciliation', icon: 'wallet' },
            { id: 'profit-loss', title: 'Profit & loss', description: 'Income, expenses, and net profit', icon: 'chart-no-axes-column' },
            // { id: 'cash-flow', title: 'Cash flow', description: 'Money in and out over time', icon: 'arrow-right-left' },
        ],
    },
];

const Reports = ({ navigation }) => {
    const { colors } = useTheme();
    const user = useSelector(({ user }) => user);
    const [searchQuery, setSearchQuery] = useState('');
    const backPress = () => navigation.goBack();

    const visibleSections = useMemo(() => {
        return REPORT_SECTIONS
            .map((section) => {
                const reports = section.reports.filter((report) => {
                    if (report.screen) return canAccessScreen(user, report.screen);
                    if (report.id === 'audit-trail') return hasPermission(user, ['audit_logs.view', 'audit.view']);
                    return hasPermission(user, 'reports.view');
                });
                return reports.length ? { ...section, reports } : null;
            })
            .filter(Boolean);
    }, [user]);

    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return visibleSections;
        const q = searchQuery.toLowerCase().trim();
        return visibleSections.map((section) => {
            const matchingReports = section.reports.filter(
                (report) =>
                    report.title.toLowerCase().includes(q) ||
                    (report.description && report.description.toLowerCase().includes(q)) ||
                    section.title.toLowerCase().includes(q)
            );
            return matchingReports.length ? { ...section, reports: matchingReports } : null;
        }).filter(Boolean);
    }, [searchQuery, visibleSections]);

    const handleReportPress = (report) => {
        if (report.screen) {
            navigation.navigate(report.screen);
            return;
        }
        navigation.navigate('ReportDetail', { reportId: report.id, title: report.title });
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label="Reports" />
            <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Lucide name="search" color={colors.textTertiary} size={18} style={{ marginLeft: 12 }} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search reports..."
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
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {filteredSections.map((section) => (
                    <View key={section.title} style={styles.section}>
                        <View style={[styles.sectionHeader, { borderLeftColor: section.color }]}>
                            <AppText label={section.title} variant={1} fontSize={16} color={colors.text} />
                        </View>
                        {section.reports.map((report) => (
                            <TouchableOpacity
                                key={report.id}
                                activeOpacity={0.7}
                                onPress={() => handleReportPress(report)}
                                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                                <View style={[styles.iconWrap, { backgroundColor: section.color + '18' }]}>
                                    <Lucide name={report.icon} size={22} color={section.color} />
                                </View>
                                <View style={styles.cardBody}>
                                    <AppText label={report.title} variant={1} fontSize={16} color={colors.text} />
                                    <AppText label={report.description} fontSize={13} color={colors.textSecondary} style={styles.cardDesc} numberOfLines={2} />
                                </View>
                                <Lucide name="chevron-right" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}
                {filteredSections.length === 0 && (
                    <View style={styles.emptyState}>
                        <Lucide name="search-x" size={40} color={colors.textTertiary} />
                        <AppText label="No reports match your search" variant={1} fontSize={16} color={colors.textSecondary} style={{ marginTop: 12 }} />
                        <AppText label="Try a different term" fontSize={13} color={colors.textTertiary} style={{ marginTop: 4 }} />
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#eee' },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 14,
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
    scroll: { flex: 1 },
    scrollContent: { padding: 14, paddingBottom: 24 },
    section: { marginBottom: 20 },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: 24,
    },
    sectionHeader: {
        borderLeftWidth: 4,
        paddingLeft: 12,
        marginBottom: 10,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 5,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardBody: { flex: 1, marginLeft: 14 },
    cardDesc: { marginTop: 4 },
});

export default Reports;
