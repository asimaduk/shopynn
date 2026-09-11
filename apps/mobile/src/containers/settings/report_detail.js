import React, { useState, useCallback, useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, TouchableOpacity, Share, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import config from '../../config';
import AppModal from '../../components/app_modal';
import useTheme from '../../hooks/useTheme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { dashboard as dashboardApi, sales as salesApi, purchases as purchasesApi, transfers as transferApi, adjustments as adjustmentApi, auditLogs as auditLogsApi, inventories as inventoryApi } from '../../services/api';
import { formatDateRange, formatAction, formatDateAndTime, formatQuantity } from '../../utils/format';
import { hasFeature, hasPermission } from '../../utils/permissions';

const formatter = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' });
const formatCurrency = (value) => formatter.format(Number(value)).replace('GH₵', 'GHS ').trim();

// Sample data per report type
// const SAMPLE = {
//     'stock-summary': {
//         cards: [
//             { label: 'Products', value: '7', icon: 'package', color: config.THEME_COLOR },
//             { label: 'Total units', value: '497', icon: 'layers', color: '#10b981' },
//             { label: 'Stock value', value: formatCurrency(28456), icon: 'wallet', color: '#f59e0b' },
//             { label: 'Low stock', value: '3', icon: 'triangle-alert', color: '#ef4444' },
//         ],
//         rows: [
//             { name: 'Tampico Medium', sku: 'Tam500', category: 'Soft Drinks', qty: 21, value: 1302 },
//             { name: '5star 350ml', sku: '5S350', category: 'Energy Drinks', qty: 264, value: 12144 },
//             { name: 'Bel Aqua 500ml', sku: 'BA500', category: 'Water', qty: 45, value: 2565 },
//         ],
//     },
//     'low-stock': {
//         cards: [
//             { label: 'Items below reorder', value: '4', icon: 'triangle-alert', color: '#ef4444' },
//             { label: 'Total units needed', value: '120', icon: 'package', color: config.THEME_COLOR },
//             { label: 'Est. cost', value: formatCurrency(7200), icon: 'wallet', color: '#f59e0b' },
//         ],
//         rows: [
//             { name: 'Coca Cola 500ml', sku: 'CC500', current: 8, reorder: 24, unitCost: 65 },
//             { name: 'Fan Yogurt', sku: 'FY1', current: 4, reorder: 20, unitCost: 18 },
//             { name: 'Tampico Medium', sku: 'Tam500', current: 21, reorder: 30, unitCost: 62 },
//         ],
//     },
//     'slow-moving': {
//         cards: [
//             { label: 'Slow-moving items', value: '5', icon: 'trending-down', color: '#f59e0b' },
//             { label: 'Days no movement', value: '30+', icon: 'calendar', color: '#ef4444' },
//             { label: 'Total value', value: formatCurrency(8520), icon: 'wallet', color: config.THEME_COLOR },
//         ],
//         rows: [
//             { name: 'Special Blend 1L', sku: 'SB1L', qty: 80, lastMove: '45 days ago', value: 4200 },
//             { name: 'Juice Plus 350ml', sku: 'JP350', qty: 60, lastMove: '32 days ago', value: 2100 },
//         ],
//     },
//     'expiry-batch': {
//         cards: [
//             { label: 'Expiring in 30d', value: '3', icon: 'calendar-clock', color: '#ef4444' },
//             { label: 'Batches tracked', value: '12', icon: 'package', color: config.THEME_COLOR },
//         ],
//         rows: [
//             { product: 'Fan Yogurt', batch: 'FY-2024-02', expiry: '28 Feb 2025', qty: 4 },
//             { product: 'Milk 1L', batch: 'ML-2024-01', expiry: '15 Mar 2025', qty: 24 },
//         ],
//     },
//     'sales-summary': {
//         cards: [
//             { label: 'Total sales', value: formatCurrency(45680), icon: 'shopping-cart', color: '#10b981' },
//             { label: 'Transactions', value: '124', icon: 'receipt', color: config.THEME_COLOR },
//             { label: 'Avg per sale', value: formatCurrency(368), icon: 'wallet', color: '#f59e0b' },
//         ],
//         rows: [
//             { period: 'This week', amount: 12450, count: 38 },
//             { period: 'Last week', amount: 11200, count: 32 },
//             { period: 'This month', amount: 45680, count: 124 },
//         ],
//     },
//     'revenue': {
//         cards: [
//             { label: 'Revenue (MTD)', value: formatCurrency(45680), icon: 'wallet', color: '#10b981' },
//             { label: 'vs last month', value: '+12%', icon: 'trending-up', color: config.THEME_COLOR },
//             { label: 'Target', value: '92%', icon: 'bar-chart-2', color: '#f59e0b' },
//         ],
//         rows: [
//             { source: 'Walk-in', amount: 28400, pct: '62%' },
//             { source: 'Credit', amount: 12200, pct: '27%' },
//             { source: 'Corporate', amount: 5080, pct: '11%' },
//         ],
//     },
//     'top-products': {
//         cards: [
//             { label: 'Best seller', value: '5star 350ml', icon: 'trending-up', color: '#10b981' },
//             { label: 'Units sold (30d)', value: '1,240', icon: 'package', color: config.THEME_COLOR },
//             { label: 'Revenue', value: formatCurrency(57040), icon: 'wallet', color: '#f59e0b' },
//         ],
//         rows: [
//             { rank: 1, name: '5star 350ml', qty: 1240, value: 57040 },
//             { rank: 2, name: 'Bel Aqua 500ml', qty: 890, value: 50730 },
//             { rank: 3, name: 'Voltic 500ml', qty: 650, value: 35750 },
//         ],
//     },
//     'sales-by-customer': {
//         cards: [
//             { label: 'Customers', value: '48', icon: 'users', color: config.THEME_COLOR },
//             { label: 'Total sales', value: formatCurrency(45680), icon: 'wallet', color: '#10b981' },
//             { label: 'Top customer', value: 'Acme Ltd', icon: 'user', color: '#f59e0b' },
//         ],
//         rows: [
//             { name: 'Acme Ltd', orders: 12, amount: 8450 },
//             { name: 'Walk-in', orders: 86, amount: 28400 },
//             { name: 'Obasanjo Store', orders: 8, amount: 3200 },
//         ],
//     },
//     'sales-by-staff': {
//         cards: [
//             { label: 'Total sales', value: formatCurrency(38250), icon: 'shopping-cart', color: '#10b981' },
//             { label: 'Active staff', value: '4', icon: 'users', color: config.THEME_COLOR },
//             { label: 'Avg per staff', value: formatCurrency(9560), icon: 'wallet', color: '#f59e0b' },
//         ],
//         // Daily totals by staff / cashier
//         rows: [
//             { staff: 'Cashier 1', date: '17 Feb', amount: 8450, count: 22 },
//             { staff: 'Cashier 2', date: '17 Feb', amount: 6300, count: 16 },
//             { staff: 'Cashier 3', date: '17 Feb', amount: 4100, count: 11 },
//             { staff: 'Manager', date: '17 Feb', amount: 2200, count: 6 },
//             { staff: 'Cashier 1', date: '16 Feb', amount: 7650, count: 20 },
//             { staff: 'Cashier 2', date: '16 Feb', amount: 5200, count: 14 },
//             { staff: 'Cashier 3', date: '16 Feb', amount: 3800, count: 10 },
//             { staff: 'Manager', date: '16 Feb', amount: 1500, count: 4 },
//         ],
//     },
//     'purchase-summary': {
//         cards: [
//             { label: 'Purchases (MTD)', value: formatCurrency(32100), icon: 'truck', color: '#f59e0b' },
//             { label: 'Orders', value: '18', icon: 'package', color: config.THEME_COLOR },
//             { label: 'Suppliers', value: '6', icon: 'users', color: '#10b981' },
//         ],
//         rows: [
//             { date: '17 Feb', supplier: 'Kasapreko', amount: 8500, ref: 'PO-024' },
//             { date: '14 Feb', supplier: 'CocaCola', amount: 12000, ref: 'PO-023' },
//             { date: '10 Feb', supplier: 'Voltic', amount: 6600, ref: 'PO-022' },
//         ],
//     },
//     'cogs': {
//         cards: [
//             { label: 'COGS (MTD)', value: formatCurrency(28900), icon: 'calculator', color: config.THEME_COLOR },
//             { label: 'Gross margin', value: '36%', icon: 'percent', color: '#10b981' },
//             { label: 'Revenue', value: formatCurrency(45680), icon: 'wallet', color: '#f59e0b' },
//         ],
//         rows: [
//             { product: '5star 350ml', sold: 1240, cost: 46, cogs: 57040 },
//             { product: 'Bel Aqua 500ml', sold: 890, cost: 57, cogs: 50730 },
//         ],
//     },
//     'supplier-summary': {
//         cards: [
//             { label: 'Suppliers', value: '6', icon: 'bookmark-check', color: config.THEME_COLOR },
//             { label: 'Total spend', value: formatCurrency(32100), icon: 'wallet', color: '#f59e0b' },
//             { label: 'Orders', value: '18', icon: 'truck', color: '#10b981' },
//         ],
//         rows: [
//             { name: 'CocaCola', orders: 5, spend: 12000 },
//             { name: 'Kasapreko', orders: 4, spend: 8500 },
//             { name: 'Voltic', orders: 3, spend: 6600 },
//         ],
//     },
//     'transfers': {
//         cards: [
//             { label: 'Transfers (30d)', value: '8', icon: 'package-check', color: config.THEME_COLOR },
//             { label: 'Units moved', value: '420', icon: 'arrow-right-left', color: '#10b981' },
//         ],
//         rows: [
//             { date: '16 Feb', from: 'Tabora', to: 'Alhaji', product: '5star 350ml', qty: 60, ref: 'TR-008' },
//             { date: '12 Feb', from: 'Alhaji', to: 'Tabora', product: 'Bel Aqua 500ml', qty: 45, ref: 'TR-007' },
//         ],
//     },
//     'adjustments': {
//         cards: [
//             { label: 'Adjustments (30d)', value: '6', icon: 'minus-circle', color: '#6366f1' },
//             { label: 'Items adjusted', value: '12', icon: 'package', color: config.THEME_COLOR },
//         ],
//         rows: [
//             { date: '15 Feb', product: 'Tampico Medium', type: 'Count', before: 25, after: 21, reason: 'Stock take' },
//             { date: '10 Feb', product: 'Fan Yogurt', type: 'Damage', before: 10, after: 8, reason: 'Expired' },
//         ],
//     },
//     'audit-trail': {
//         cards: [
//             { label: 'Events (7d)', value: '156', icon: 'history', color: config.THEME_COLOR },
//             { label: 'Users', value: '4', icon: 'users', color: '#10b981' },
//         ],
//         rows: [
//             { time: '17 Feb 10:32', user: 'Admin', action: 'Sale completed', ref: 'SALE-8842' },
//             { time: '17 Feb 09:15', user: 'Store 1', action: 'Stock in', ref: 'PO-024' },
//             { time: '16 Feb 16:00', user: 'Admin', action: 'Adjustment', ref: 'ADJ-006' },
//         ],
//     },
//     'balance': {
//         cards: [
//             { label: 'Cash balance', value: formatCurrency(12500), icon: 'wallet', color: '#10b981' },
//             { label: 'Bank balance', value: formatCurrency(48200), icon: 'wallet', color: config.THEME_COLOR },
//             { label: 'Recon status', value: 'Matched', icon: 'check', color: '#10b981' },
//         ],
//         rows: [
//             { account: 'Cash', balance: 12500, lastRecon: '17 Feb 2025' },
//             { account: 'Bank - GCB', balance: 48200, lastRecon: '16 Feb 2025' },
//         ],
//     },
//     'profit-loss': {
//         cards: [
//             { label: 'Revenue', value: formatCurrency(45680), icon: 'wallet', color: '#10b981' },
//             { label: 'Expenses', value: formatCurrency(28900), icon: 'trending-down', color: '#ef4444' },
//             { label: 'Net profit', value: formatCurrency(16780), icon: 'bar-chart-2', color: config.THEME_COLOR },
//         ],
//         rows: [
//             { item: 'Sales', amount: 45680, type: 'income' },
//             { item: 'COGS', amount: 28900, type: 'expense' },
//             { item: 'Operating', amount: 3200, type: 'expense' },
//         ],
//     },
//     'cash-flow': {
//         cards: [
//             { label: 'In (30d)', value: formatCurrency(52100), icon: 'arrow-down-left', color: '#10b981' },
//             { label: 'Minus (30d)', value: formatCurrency(38900), icon: 'arrow-up-right', color: '#ef4444' },
//             { label: 'Net flow', value: formatCurrency(13200), icon: 'arrow-right-left', color: config.THEME_COLOR },
//         ],
//         rows: [
//             { date: '17 Feb', desc: 'Sales', in: 2450, out: 0 },
//             { date: '16 Feb', desc: 'Purchases', in: 0, out: 8500 },
//             { date: '15 Feb', desc: 'Sales', in: 3200, out: 0 },
//         ],
//     },
// };

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

const VALUATION_LABELS = { fifo: 'FIFO', lifo: 'LIFO', weighted_average: 'Weighted average' };

const ReportDetail = ({ navigation, route }) => {
    const { colors } = useTheme();
    const appSettings = useSelector((s) => s.appSettings) || {};
    const user = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const reportId = route.params?.reportId || 'stock-summary';
    const title = route.params?.title || 'Report';
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [showExportFormatModal, setShowExportFormatModal] = useState(false);
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
    const [selectedDateRange, setSelectedDateRange] = useState('all_time');
    const [customStartDate, setCustomStartDate] = useState(new Date());
    const [customEndDate, setCustomEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [reportData, setReportData] = useState({cards: [], rows: []});
    const [selectedStaff, setSelectedStaff] = useState('all');
    const canExport = hasPermission(user, ['reports.export']) && hasFeature(user, ['reports.export'], subscriptionFeatures);

    const getDateParams = useCallback(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let start = today;
        let end = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        if (selectedDateRange === 'custom') {
            start = customStartDate;
            end = new Date(customEndDate.getTime() + 24 * 60 * 60 * 1000);
        } else if (selectedDateRange === 'last_7_days') {
            start = new Date(today);
            start.setDate(start.getDate() - 7);
        } else if (selectedDateRange === 'last_30_days') {
            start = new Date(today);
            start.setDate(start.getDate() - 30);
        } else if (selectedDateRange === 'this_month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (selectedDateRange === 'last_month') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        }
        return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
    }, [selectedDateRange, customStartDate, customEndDate]);

    const currentRangeLabel = selectedDateRange === 'all_time'
        ? 'All time'
        : (() => {
            const { startDate, endDate } = getDateParams();
            return formatDateRange(startDate, endDate);
        })();

    const backPress = () => navigation.goBack();

    const loadData = useCallback(async () => {
        setLoading(true);
        setReportData({cards: [], rows: []});
        try {
            const params = selectedDateRange === 'all_time' ? {} : getDateParams();
            console.log('params', params);
            if (reportId === 'profit-loss') {
                const res = await dashboardApi.profitAndLoss(params);
                // cards: [
                //     { label: 'Revenue', value: formatCurrency(45680), icon: 'wallet', color: '#10b981' },
                //     { label: 'Expenses', value: formatCurrency(28900), icon: 'trending-down', color: '#ef4444' },
                //     { label: 'Net profit', value: formatCurrency(16780), icon: 'bar-chart-2', color: config.THEME_COLOR },
                // ],
                // rows: [
                //     { item: 'Sales', amount: 45680, type: 'income' },
                //     { item: 'COGS', amount: 28900, type: 'expense' },
                //     { item: 'Operating', amount: 3200, type: 'expense' },
                // ]
                console.log('profit and loss res', res);
                if (res) {
                    const data = {
                        cards: [
                            { label: 'Revenue', value: formatCurrency(res.revenue), icon: 'wallet', color: '#10b981' },
                            { label: 'Expenses', value: formatCurrency(res.expenses), icon: 'trending-down', color: '#ef4444' },
                            { label: 'Net profit', value: res.netProfit > 0 ? formatCurrency(res.netProfit) : '0', icon: 'chart-spline', color: config.THEME_COLOR },
                            { label: 'Total sold units', value: formatQuantity(res.totalSoldQty), icon: 'shopping-cart', color: '#f59e0b' },
                        ],
                        rows: [
                            // { item: 'Sales', amount: res.revenue, type: 'income' },
                            { item: 'COGS', amount: res.cogs },
                            { item: 'Gross profit', amount: res.grossProfit || '0'},
                        ],
                    };
                    console.log('profit and loss data', data);
                    setReportData(data);
                }
            } 
            // else if (reportId === 'cash-flow') {
            //     const res = await dashboardApi.cashFlow(params);
            //     if (res && (res.cards || res.rows)) setReportData(res);
            // } else if (reportId === 'cogs') {
            //     const res = await salesApi.cogs(params);
            //     if (res && (res.cards || res.rows)) setReportData(res);
            // } 
            else if (reportId === 'stock-summary') {
                console.log('stock summary params', params);
                const res = await inventoryApi.summary();
                console.log('stock summary res', res);
                if (res) {
                    const data = {
                        cards: [
                            { label: 'Products', value: res.inventoryCount, icon: 'package', color: config.THEME_COLOR },
                            { label: 'Total units', value: formatQuantity(res.totalUnits), icon: 'layers', color: '#10b981' },
                            { label: 'Stock value', value: formatCurrency(res.stockValue), icon: 'wallet', color: '#f59e0b' },
                            { label: 'Low stock', value: res.lowStockCount, icon: 'triangle-alert', color: '#ef4444' },
                        ],
                        rows: res.items,
                    };
                    console.log('stock summary data', data);
                    setReportData(data);
                }
            } else if (reportId === 'sales-summary') {
                const res = await salesApi.report(params);
                if (res) {
                    console.log('sales report res', res);
                    const data = {
                        cards: [
                            { label: 'Total sales', value: formatCurrency(res.overall?.totalSales), icon: 'shopping-cart', color: '#10b981' },
                            { label: 'Transactions', value: res.overall?.transactionCount, icon: 'receipt', color: config.THEME_COLOR },
                            { label: 'Avg per sale', value: formatCurrency(res.overall?.averagePerSale), icon: 'wallet', color: '#f59e0b' },
                        ],
                        rows: [
                            { period: 'This week', amount: `${res.thisWeek?.totalSales}`, count: res.thisWeek?.transactionCount },
                            { period: 'Last week', amount: `${res.lastWeek?.totalSales}`, count: res.lastWeek?.transactionCount },
                            { period: 'This month', amount: `${res.thisMonth?.totalSales}`, count: res.thisMonth?.transactionCount },
                            { period: 'Last month', amount: `${res.lastMonth?.totalSales}`, count: res.lastMonth?.transactionCount },
                        ]
                    };
                    setReportData(data);
                }
            } else if (reportId === 'top-products') {
                const res = await salesApi.topSelling(params);
                if (res) {
                    // console.log('top selling res', res);
                    const data = {
                        cards: [
                            { label: 'Best seller', value: res[0]?.product_name ?? 'Not Available', icon: 'trending-up', color: '#10b981' },
                            { label: 'Units sold', value: res[0]?.units_sold ?? 0, icon: 'layers', color: '#10b981' },
                            { label: 'Total sales', value: formatCurrency(res[0]?.total_revenue ?? 0), icon: 'wallet', color: '#f59e0b' },
                        ],
                        rows: res.map((item) => ({
                            product: item.product_name,
                            quantity: item.units_sold,
                            value: item.total_revenue,
                        })),
                    };
                    setReportData(data);
                }
            } else if (reportId === 'sales-by-customer') {
                const res = await salesApi.byCustomer(params);
                console.log('sales by customer res', res);
                if (res) {
                    console.log('sales by customer res', res);
                    // cards: [
                    //     { label: 'Customers', value: '48', icon: 'users', color: config.THEME_COLOR },
                    //     { label: 'Total sales', value: formatCurrency(45680), icon: 'wallet', color: '#10b981' },
                    //     { label: 'Top customer', value: 'Acme Ltd', icon: 'user', color: '#f59e0b' },
                    // ],
                    // rows: [
                    //     { name: 'Acme Ltd', orders: 12, amount: 8450 },
                    //     { name: 'Walk-in', orders: 86, amount: 28400 },
                    //     { name: 'Obasanjo Store', orders: 8, amount: 3200 },
                    // ]
                    const data = {
                        cards: [
                            { label: 'Customers', value: res.totalCustomers, icon: 'users', color: config.THEME_COLOR },
                            { label: 'Total sales', value: res.totalSales ?? 0, icon: 'wallet', color: '#10b981' },
                            { label: 'Top customer', value: res.customers?.[0]?.customer_name ?? 'Not Available', icon: 'user', color: '#f59e0b' },
                        ],
                        rows: res.customers?.map((item) => ({
                            customer: item.customer_name,
                            orders: item.ordersCount,
                            amount: item.totalSales,
                        })),
                    };

                    console.log('sales by customer data', data);
                    setReportData(data);
                }
            } else if (reportId === 'sales-by-staff') {
                const res = await salesApi.byStaff(params);
                console.log('sales by staff res', res);
                if (res) {
                    const totalStaff = res.users?.length ?? 0;
                    const totalSales = res.users?.reduce((acc, item) => acc + item.totalSales, 0) ?? 0;
                    const avgPerStaff = totalSales / totalStaff ?? 0;

                    const data = {
                        cards: [
                            // { label: 'Staff', value: totalStaff, icon: 'users', color: config.THEME_COLOR },
                            // { label: 'Total sales', value: totalSales, icon: 'wallet', color: '#10b981' },
                            // { label: 'Avg per staff', value: formatCurrency(avgPerStaff), icon: 'user', color: '#f59e0b' },

                            { label: 'Total sales', value: formatCurrency(totalSales), icon: 'shopping-cart', color: '#10b981' },
                            { label: 'Active staff', value: totalSales, icon: 'users', color: config.THEME_COLOR },
                            { label: 'Avg per staff', value: formatCurrency(avgPerStaff), icon: 'wallet', color: '#f59e0b' }
                        ],
                        // { staff: 'Cashier 1', date: '17 Feb', amount: 8450, count: 22 }
                        rows: res.users?.map((item) => ({
                            staff: item.first_name + ' ' + item.last_name,
                            amount: item.totalSales,
                            count: item.transactionsCount,
                            date: formatDateRange(res.startDate, res.endDate),
                        })),
                    };

                    console.log('sales by staff data', data);
                    setReportData(data);
                }
            } else if (reportId === 'purchase-summary') {
                const res = await purchasesApi.bySupplier(params);
                console.log('purchase summary res', res);
                if (res) {
                    // cards: [
                    //     { label: 'Purchases (MTD)', value: formatCurrency(32100), icon: 'truck', color: '#f59e0b' },
                    //     { label: 'Orders', value: '18', icon: 'package', color: config.THEME_COLOR },
                    //     { label: 'Suppliers', value: '6', icon: 'users', color: '#10b981' },
                    // ],
                    // rows: [
                    //     { date: '17 Feb', supplier: 'Kasapreko', amount: 8500, ref: 'PO-024' },
                    //     { date: '14 Feb', supplier: 'CocaCola', amount: 12000, ref: 'PO-023' },
                    //     { date: '10 Feb', supplier: 'Voltic', amount: 6600, ref: 'PO-022' },
                    // ]

                    const data = {
                        cards: [
                            { label: 'Purchases (MTD)', value: formatCurrency(res.totalPurchases), icon: 'truck', color: '#f59e0b' },
                            { label: 'Invoices', value: res.purchaseCount, icon: 'package', color: config.THEME_COLOR },
                            { label: 'Suppliers', value: res.supplierCount, icon: 'users', color: '#10b981' }
                        ],
                        rows: res.suppliers?.map((item) => ({
                            supplier: item.supplier_name,
                            amount: item.totalPurchases,
                            count: item.purchaseCount,
                            date: formatDateRange(res.startDate, res.endDate),
                        })),
                    };
                    console.log('purchase summary data', data);
                    setReportData(data);
                }
            } else if (reportId === 'transfers') {
                const res = await transferApi.summary(params);
                console.log('transfers res', res);
                if (res) {
                    console.log('transfers res', res);
                    const data = {
                        cards: [
                            { label: 'Transfers', value: res.transferCount, icon: 'package-check', color: config.THEME_COLOR },
                            { label: 'Units moved', value: res.totalUnitsMoved, icon: 'arrow-right-left', color: '#10b981' },
                        ],
                        //                             { date: '16 Feb', from: 'Tabora', to: 'Alhaji', product: '5star 350ml', qty: 60, ref: 'TR-008' },

                        rows: res.movements?.map((item) => ({
                            date: formatDateRange(item.created_at, item.created_at),
                            from: item.source_warehouse_name,
                            to: item.destination_warehouse_name,
                            product: item.product_name ?? 'Not Available',
                            quantity: item.quantity ?? 0
                        })),
                    };
                    console.log('transfers data', data);
                    setReportData(data);
                }
            } else if (reportId === 'adjustments') {
                console.log('adjustments params', params);
                const res = await adjustmentApi.summary(params);
                console.log('adjustments res', res);
                if (res) {
                    console.log('adjustments res', res);
                    const data = {
                        cards: [
                            { label: 'Adjustments', value: res.adjustment_count, icon: 'package-check', color: config.THEME_COLOR },
                            { label: 'Units adjusted', value: res.total_items_adjusted, icon: 'arrow-right-left', color: '#10b981' },
                        ],
                        // { date: '15 Feb', product: 'Tampico Medium', type: 'Count', before: 25, after: 21, reason: 'Stock take' },
                        rows: res.items?.map((item) => ({
                            date: formatDate(new Date(item.created_at)),
                            product: item.product_name ?? 'Not Available',
                            type: item.adjustment_type === 'subtraction' ? 'Minus' : 'Plus',
                            before: item.system_quantity ?? 0,
                            after: item.quantity_adjusted ?? 0,
                            reason: item.reason ?? 'Not Available',
                        })),
                    };
                    
                    console.log('adjustments data', data);
                    setReportData(data);
                }
            } else if (reportId === 'audit-trail') {
                console.log('audit trail params', params);
                const res = await auditLogsApi.list(params);
                console.log('audit logs res', res);
                if (res) {
                    // cards: [
                    //     { label: 'Events (7d)', value: '156', icon: 'history', color: config.THEME_COLOR },
                    //     { label: 'Users', value: '4', icon: 'users', color: '#10b981' },
                    // ],
                    // rows: [
                    //     { time: '17 Feb 10:32', user: 'Admin', action: 'Sale completed', ref: 'SALE-8842' },
                    //     { time: '17 Feb 09:15', user: 'Store 1', action: 'Stock in', ref: 'PO-024' },
                    //     { time: '16 Feb 16:00', user: 'Admin', action: 'Adjustment', ref: 'ADJ-006' },
                    // ]
                    const totalEvents = res?.length ?? 0;
                    const userCount = new Set(res.map(item => item.user_id)).size;
                    
                    const data = {
                        cards: [
                            { label: 'Events', value: totalEvents, icon: 'history', color: config.THEME_COLOR },
                            { label: 'Users', value: userCount, icon: 'users', color: '#10b981' },
                        ],
                        rows: res.map((item) => ({
                            id: item.id,
                            date: formatDateAndTime(new Date(item.created_at)),
                            action: formatAction(item.action ) ?? 'Not Available',
                            user: item.user_first_name + ' ' + item.user_last_name ?? 'Not Available',
                            ref: item.ip_address ?? 'Not Available',
                            _raw: {...item, date: formatDateAndTime(new Date(item.created_at)), action: formatAction(item.action ) ?? 'Not Available'},
                        })),
                    };
                    console.log('audit logs data', data);
                    setReportData(data);
                }
            }
        } catch (_) {}
        setLoading(false);
    }, [reportId, getDateParams]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, [loadData]);

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

    const handleAuditLogPress = useCallback(
        (row) => {
            if (!row?.id && !row?._raw?.id) return;
            const log = row._raw || row;
            navigation.navigate('AuditLogDetails', {
                logId: log.id,
                log,
            });
        },
        [navigation],
    );

    const onStartDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowStartPicker(false);
        }
        if (event?.type === 'set' && selectedDate) {
            setCustomStartDate(selectedDate);
        }
    };

    const onEndDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowEndPicker(false);
        }
        if (event?.type === 'set' && selectedDate) {
            setCustomEndDate(selectedDate);
        }
    };

    const data = reportData;// || SAMPLE[reportId] || SAMPLE['stock-summary'];
    const cards = data.cards || [];
    const allRows = data.rows || [];
    const staffOptions =
        reportId === 'sales-by-staff'
            ? Array.from(new Set(allRows.map((r) => r.staff).filter(Boolean)))
            : [];
    const rows =
        reportId === 'sales-by-staff' && selectedStaff !== 'all'
            ? allRows.filter((r) => r.staff === selectedStaff)
            : allRows;

    const generateCSV = () => {
        let headers = '';
        let csvRows = [];

        // Generate headers based on first row
        if (rows.length > 0) {
            const firstRow = rows[0];
            headers = Object.keys(firstRow).join(',') + '\n';
            
            rows.forEach((row) => {
                const escapeCSV = (str) => {
                    if (!str) return '';
                    const string = String(str);
                    if (string.includes(',') || string.includes('"') || string.includes('\n')) {
                        return `"${string.replace(/"/g, '""')}"`;
                    }
                    return string;
                };
                csvRows.push(Object.values(row).map(escapeCSV).join(','));
            });
        }

        return headers + csvRows.join('\n');
    };

    const generatePDF = () => {
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
    <title>${title} Report</title>
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
        .cards {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-bottom: 30px;
        }
        .card {
            flex: 1;
            min-width: 200px;
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid ${config.THEME_COLOR || '#0A74DA'};
        }
        .card-label {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 5px;
        }
        .card-value {
            font-size: 18px;
            font-weight: bold;
            color: #1e293b;
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
    <h1>${title} Report</h1>
    <div class="header-info">
        <p><strong>Export Date:</strong> ${exportDate}</p>
        <p><strong>Total Items:</strong> ${rows.length}</p>
    </div>
    <div class="cards">
`;

        cards.forEach((card) => {
            html += `
        <div class="card" style="border-left-color: ${card.color}">
            <div class="card-label">${card.label}</div>
            <div class="card-value">${card.value}</div>
        </div>
            `;
        });

        html += `
    </div>
    <table>
        <thead>
            <tr>
`;

        if (rows.length > 0) {
            Object.keys(rows[0]).forEach((key) => {
                html += `<th>${key.charAt(0).toUpperCase() + key.slice(1)}</th>`;
            });
        }

        html += `
            </tr>
        </thead>
        <tbody>
`;

        rows.forEach((row) => {
            html += '<tr>';
            Object.values(row).forEach((val) => {
                html += `<td>${val || ''}</td>`;
            });
            html += '</tr>';
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

        if (rows.length === 0) {
            Alert.alert('No Data', 'There is no data to export.');
            return;
        }

        setExporting(true);

        setTimeout(async () => {
            try {
                const dateStr = new Date().toISOString().split('T')[0];
                const fileName = `${title.replace(/ /g, '_')}_${dateStr}`;

                if (format === 'csv' || format === 'excel') {
                    const csvContent = generateCSV();
                    await Share.share({
                        message: csvContent,
                        title: `${fileName}.csv`,
                    });
                } else if (format === 'pdf') {
                    const htmlContent = generatePDF();
                    await Share.share({
                        message: htmlContent,
                        title: `${fileName}.html`,
                    });

                    Alert.alert(
                        'PDF Export',
                        'The HTML file has been shared. To convert to PDF:\n\n• iOS: Open in Safari, tap Share > Print > Save as PDF\n• Android: Open in browser, print > Save as PDF',
                        [{ text: 'OK' }]
                    );
                }
            } catch (error) {
                Alert.alert('Export Error', 'Could not export report. Please try again.');
            } finally {
                setExporting(false);
            }
        }, 300);
    };

    const handleExport = () => {
        if (rows.length === 0) {
            Alert.alert('No Data', 'There is no data to export.');
            return;
        }
        setShowExportFormatModal(true);
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label={title}>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => setShowDateFilter(true)}
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                        <Lucide name="calendar" color={config.THEME_COLOR} size={20} />
                    </TouchableOpacity>
                    {canExport && (
                        <TouchableOpacity
                            activeOpacity={0.6}
                            onPress={handleExport}
                            disabled={exporting || rows.length === 0}
                            style={[styles.actionButton, { backgroundColor: colors.surface }, (exporting || rows.length === 0) && { opacity: 0.5 }]}>
                            {exporting ? (
                                <ActivityIndicator size="small" color={config.THEME_COLOR} />
                            ) : (
                                <Lucide name="download" color={config.THEME_COLOR} size={20} />
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </ScreenHeader>
            {loading && !refreshing ? (
                <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading report data..." color={colors.textSecondary} style={{ marginTop: 16 }} />
                </View>
            ) : (
            <ScrollView
                style={[styles.scroll, { backgroundColor: colors.background }]}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[config.THEME_COLOR]} />}>
                <View style={[styles.dateRangeBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.dateRangeLeft}>
                        <Lucide name="calendar" size={16} color={config.THEME_COLOR} />
                        <AppText
                            label="Date range"
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ marginLeft: 6 }}
                        />
                    </View>
                    <AppText
                        label={currentRangeLabel}
                        fontSize={13}
                        color={colors.text}
                        numberOfLines={1}
                    />
                </View>

                {/* Hero KPI – first metric prominent */}
                {cards.length > 0 && (
                    <View style={[styles.heroCard, { backgroundColor: (cards[0].color || config.THEME_COLOR) + '18' }]}>
                        <View style={[styles.heroIconWrap, { backgroundColor: (cards[0].color || config.THEME_COLOR) + '25' }]}>
                            <Lucide name={cards[0].icon} size={32} color={cards[0].color || config.THEME_COLOR} />
                        </View>
                        <AppText label={String(cards[0].value)} variant={1} fontSize={28} color={colors.text} style={{ marginTop: 12 }} numberOfLines={1} />
                        <AppText label={cards[0].label} fontSize={14} color={colors.textSecondary} style={{ marginTop: 4 }} />
                    </View>
                )}

                {/* Other metrics – horizontal scroll pills */}
                {cards.length > 1 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.metricPillsContent}
                        style={styles.metricPillsScroll}>
                        {cards.slice(1).map((card, i) => (
                            <View key={i} style={[styles.metricPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <View style={[styles.metricPillIcon, { backgroundColor: card.color + '20' }]}>
                                    <Lucide name={card.icon} size={18} color={card.color} />
                                </View>
                                <AppText label={String(card.value)} variant={1} fontSize={15} color={colors.text} numberOfLines={1} />
                                <AppText label={card.label} fontSize={11} color={colors.textSecondary} numberOfLines={1} style={{ marginTop: 2 }} />
                            </View>
                        ))}
                    </ScrollView>
                )}

                {/* COGS: show valuation method used for stock value & COGS */}
                {reportId === 'cogs' && appSettings.valuationMethod && (
                    <View style={[styles.valuationNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Lucide name="calculator" size={18} color={config.THEME_COLOR} />
                        <AppText label={`Valuation method: ${VALUATION_LABELS[appSettings.valuationMethod] || appSettings.valuationMethod}`} fontSize={14} color={colors.textSecondary} style={{ marginLeft: 10 }} />
                    </View>
                )}

                {/* Sales by staff: staff filter pills */}
                {reportId === 'sales-by-staff' && staffOptions.length > 0 && (
                    <View style={[styles.staffFilterContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                            <Lucide name="users" size={18} color={config.THEME_COLOR} />
                            <AppText label="Filter by staff / cashier" variant={1} fontSize={14} color={colors.text} style={{ marginLeft: 8 }} />
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.staffFilterChips}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => setSelectedStaff('all')}
                                style={[
                                    styles.staffChip,
                                    { borderColor: colors.border },
                                    selectedStaff === 'all' && { backgroundColor: config.THEME_COLOR + '20', borderColor: config.THEME_COLOR },
                                ]}>
                                <AppText
                                    label="All staff"
                                    fontSize={13}
                                    color={selectedStaff === 'all' ? config.THEME_COLOR : colors.textSecondary}
                                    variant={selectedStaff === 'all' ? 1 : 2}
                                />
                            </TouchableOpacity>
                            {staffOptions.map((staff) => (
                                <TouchableOpacity
                                    key={staff}
                                    activeOpacity={0.7}
                                    onPress={() => setSelectedStaff(staff)}
                                    style={[
                                        styles.staffChip,
                                        { borderColor: colors.border },
                                        selectedStaff === staff && { backgroundColor: config.THEME_COLOR + '20', borderColor: config.THEME_COLOR },
                                    ]}>
                                    <AppText
                                        label={staff}
                                        fontSize={13}
                                        color={selectedStaff === staff ? config.THEME_COLOR : colors.textSecondary}
                                        variant={selectedStaff === staff ? 1 : 2}
                                    />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Details Section */}
                {rows.length > 0 && (
                    <>
                        <View style={styles.detailsSectionHeader}>
                            <Lucide name="list" size={18} color={config.THEME_COLOR} />
                            <AppText label="Details" variant={1} fontSize={16} color={colors.text} style={{ marginLeft: 8 }} />
                            <View style={[styles.countBadge, { backgroundColor: config.THEME_COLOR }]}>
                                <AppText label={rows.length} fontSize={11} color={colors.textInverse} variant={1} />
                            </View>
                        </View>
                        <View style={[styles.detailsList, { backgroundColor: colors.surface }]}>
                            {rows.map((row, i) => {
                                // Determine primary field (priority order, excluding date/time which are handled separately)
                                const primaryField =
                                    row.name ||
                                    row.customer ||
                                    row.product_name ||
                                    row.product ||
                                    row.staff ||
                                    row.period ||
                                    row.source ||
                                    row.item ||
                                    row.desc ||
                                    row.account ||
                                    row.supplier ||
                                    row.user ||
                                    row.action ||
                                    '';
                                const primaryIcon =
                                    row.name || row.product || row.product_name
                                        ? 'package'
                                        : row.staff || row.customer
                                        ? 'user'
                                        : row.period
                                        ? 'calendar'
                                        : row.source
                                        ? 'tag'
                                        : row.item || row.desc
                                        ? 'file-text'
                                        : row.account
                                        ? 'wallet'
                                        : row.supplier
                                        ? 'truck'
                                        : row.user
                                        ? 'user'
                                        : row.action
                                        ? 'activity'
                                        : 'circle';

                                // Secondary info fields
                                const secondaryFields = [];
                                // if (row.sku) secondaryFields.push({ label: `SKU: ${row.sku}`, icon: null });
                                if (row.action) secondaryFields.push({ label: formatAction(row.action), icon: null });
                                if (row.unit_price) secondaryFields.push({ label: `${formatCurrency(row.unit_price)}`, icon: null });
                                if (row.category) secondaryFields.push({ label: row.category, icon: null });
                                if (row.warehouse_name) secondaryFields.push({ label: `@: ${row.warehouse_name}`, icon: null });
                                if (row.batch) secondaryFields.push({ label: `Batch: ${row.batch}`, icon: null });
                                if (row.reason) secondaryFields.push({ label: row.reason, icon: null });
                                if (row.lastMove) secondaryFields.push({ label: row.lastMove, icon: null });
                                if (row.lastRecon) secondaryFields.push({ label: `Last recon: ${row.lastRecon}`, icon: null });
                                
                                // Handle date + time combination (only show if not already shown as primary)
                                const hasDateOrTime = row.date || row.time;
                                const dateTimeDisplay = row.date && row.time ? `${row.date} ${row.time}` : (row.date || row.time || '');

                                return (
                                    <View key={i} style={[styles.row, { borderBottomColor: colors.border }, i === rows.length - 1 && styles.rowLast]}>
                                        <View style={styles.rowContent}>
                                            {/* Primary field */}
                                            {primaryField && (
                                                <View style={styles.rowItem}>
                                                    <Lucide name={primaryIcon} size={14} color={colors.textTertiary} style={{ marginRight: 6 }} />
                                                    <AppText label={primaryField} variant={2} fontSize={14} numberOfLines={1} color={colors.text} />
                                                </View>
                                            )}
                                            
                                            {/* Date/Time combined (show if exists and not already shown as primary) */}
                                            {hasDateOrTime && !row.period && (
                                                <View style={styles.rowItem}>
                                                    <Lucide name="calendar" size={14} color={colors.textTertiary} style={{ marginRight: 6 }} />
                                                    <AppText label={dateTimeDisplay} variant={2} fontSize={14} color={colors.text} />
                                                </View>
                                            )}
                                            
                                            {/* Additional context fields */}
                                            {row.from && row.to && (
                                                <View style={styles.rowItem}>
                                                    <Lucide name="arrow-right-left" size={14} color={colors.textTertiary} style={{ marginRight: 6 }} />
                                                    <AppText label={`${row.from} → ${row.to}`} fontSize={13} color={colors.textSecondary} />
                                                </View>
                                            )}
                                            
                                            {/* Secondary fields */}
                                            {secondaryFields.length > 0 && (
                                                <View style={styles.secondaryFields}>
                                                    {secondaryFields.map((field, idx) => (
                                                        <AppText key={idx} label={field.label} fontSize={12} color={colors.textTertiary} style={{ marginTop: idx > 0 ? 4 : 2 }} />
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.rowMeta}>
                                            {/* Amount/Value */}
                                            {(row.value || row.amount || row.stock_value || row.spend || row.cogs || row.balance) !== undefined && (
                                                <AppText label={'' + formatCurrency(row.value || row.amount || row.stock_value || row.spend || row.cogs || row.balance || 0)} fontSize={15} color={config.THEME_COLOR} variant={1} />
                                            )}
                                            
                                            {/* Quantity (if no amount) */}
                                            {((row.quantity_available !== undefined || row.quantity !== undefined) && row.amount === undefined && row.cogs === undefined && row.balance === undefined) && (
                                                <View style={[styles.qtyBadge, { backgroundColor: colors.surfaceSecondary }]}>
                                                    <Lucide name="package" size={12} color={colors.textSecondary} />
                                                    <AppText label={`${formatQuantity(row.quantity_available ?? row.quantity)} units`} fontSize={13} color={colors.textSecondary} variant={1} style={{ marginLeft: 4 }} />
                                                </View>
                                            )}
                                            
                                            {/* Reference */}
                                            {row.ref && (
                                                <View style={[styles.refBadge, { backgroundColor: colors.surfaceSecondary }]}>
                                                    <Lucide name="hash" size={10} color={colors.textTertiary} />
                                                    <AppText label={row.ref} fontSize={11} color={colors.textTertiary} style={{ marginLeft: 4 }} />
                                                </View>
                                            )}

                                            {/* Audit log "View details" button */}
                                            {reportId === 'audit-trail' && (row.id || row._raw?.id) && (
                                                <TouchableOpacity
                                                    activeOpacity={0.7}
                                                    onPress={() => handleAuditLogPress(row)}
                                                    style={[styles.viewDetailsButton, { borderColor: colors.border }]}
                                                >
                                                    <Lucide name="eye" size={12} color={config.THEME_COLOR} />
                                                    <AppText
                                                        label="View details"
                                                        fontSize={11}
                                                        color={config.THEME_COLOR}
                                                        style={{ marginLeft: 4 }}
                                                    />
                                                </TouchableOpacity>
                                            )}
                                            
                                            {/* Percentage */}
                                            {row.pct && (
                                                <View style={[styles.pctBadge, { backgroundColor: colors.surfaceSecondary }]}>
                                                    <AppText label={row.pct} fontSize={12} color={colors.textSecondary} variant={1} />
                                                </View>
                                            )}
                                            
                                            {/* Orders */}
                                            {row.orders !== undefined && (
                                                <View style={[styles.badge, { backgroundColor: colors.surfaceSecondary }]}>
                                                    <Lucide name="shopping-cart" size={10} color={colors.textSecondary} />
                                                    <AppText label={`${row.orders} sales`} fontSize={11} color={colors.textSecondary} style={{ marginLeft: 4 }} />
                                                </View>
                                            )}
                                            
                                            {/* Before/After */}
                                            {row.after !== undefined && (
                                                <View style={[styles.badge, { backgroundColor: colors.surfaceSecondary }]}>
                                                    <AppText label={`${row.before} → ${row.before + row.after}`} fontSize={11} color={colors.textSecondary} />
                                                </View>
                                            )}
                                            
                                            {/* Plus/Minus */}
                                            {row.in !== undefined && (
                                                <AppText label={row.in ? formatCurrency(row.in) : row.out ? `-${formatCurrency(row.out)}` : '-'} fontSize={13} color={row.in ? '#10b981' : '#ef4444'} variant={1} />
                                            )}
                                            
                                            {/* Type badge */}
                                            {row.type && (
                                                <View style={[styles.typeBadge, { backgroundColor: row.type === 'Plus' ? '#10b98120' : '#ef444420' }]}>
                                                    <Lucide name={row.type === 'Plus' ? 'arrow-up' : 'arrow-down'} size={10} color={row.type === 'Plus' ? '#10b981' : '#ef4444'} />
                                                    <AppText label={`${row.type} ${row.qty != null ? `×${row.qty}` : ''}`} fontSize={11} color={row.type === 'Plus' ? '#10b981' : '#ef4444'} variant={1} style={{ marginLeft: 4 }} />
                                                </View>
                                            )}
                                            
                                            {/* Expiry */}
                                            {row.expiry && (
                                                <View style={[styles.badge, { backgroundColor: colors.errorLight }]}>
                                                    <Lucide name="calendar" size={10} color={colors.error} />
                                                    <AppText label={row.expiry} fontSize={11} color={colors.error} style={{ marginLeft: 4 }} />
                                                </View>
                                            )}
                                            
                                            {/* Rank */}
                                            {row.rank !== undefined && (
                                                <View style={[styles.rankBadge, { backgroundColor: row.rank === 1 ? '#10b98120' : colors.surfaceSecondary }]}>
                                                    <AppText label={`#${row.rank}`} fontSize={12} color={row.rank === 1 ? '#10b981' : colors.textSecondary} variant={1} />
                                                </View>
                                            )}
                                            
                                            {/* Count */}
                                            {row.count !== undefined && (
                                                <AppText label={`${row.count} transactions`} fontSize={12} color={colors.textSecondary} />
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </>
                )}
                {rows.length === 0 && (
                    <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
                        <Lucide name="file-text" size={48} color={colors.textTertiary} />
                        <AppText label="No data available" color={colors.textSecondary} style={{ marginTop: 12 }} />
                    </View>
                )}
                <View style={{ height: 24 }} />
            </ScrollView>
            )}

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
                <View style={[styles.exportModalContent, { backgroundColor: colors.surface }]}>
                    <AppText
                        label={`Export ${title} report as:`}
                        fontSize={14}
                        color={colors.textSecondary}
                        style={{ marginBottom: 20, textAlign: 'center' }}
                    />

                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleExportFormatSelect('csv')}
                        style={[styles.exportOption, { backgroundColor: colors.surfaceSecondary }]}>
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
                        style={[styles.exportOption, { backgroundColor: colors.surfaceSecondary }]}>
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
    safeArea: { flex: 1, backgroundColor: '#eee' },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 24 },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    dateRangeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 5,
        borderWidth: StyleSheet.hairlineWidth,
        // marginHorizontal: 16,
        // marginTop: 12,
        marginBottom: 15,
    },
    dateRangeLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerActions: { flexDirection: 'row', paddingVertical: 5, marginRight: 10 },
    actionButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginLeft: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
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
    heroCard: {
        borderRadius: 16,
        padding: 24,
        marginBottom: 16,
        alignItems: 'center',
    },
    heroIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    metricPillsScroll: { marginHorizontal: -16, marginBottom: 20 },
    metricPillsContent: { paddingHorizontal: 16, flexDirection: 'row', paddingBottom: 4 },
    metricPill: {
        minWidth: 110,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginRight: 10,
    },
    metricPillIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    valuationNote: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 10,
        borderWidth: 1,
        marginHorizontal: 16,
        marginBottom: 16,
    },
    staffFilterContainer: {
        // marginHorizontal: 16,
        marginBottom: 16,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    staffFilterChips: {
        flexDirection: 'row',
        paddingTop: 4,
    },
    staffChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        marginRight: 8,
    },
    detailsSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        marginTop: 8,
    },
    countBadge: {
        marginLeft: 'auto',
        backgroundColor: config.THEME_COLOR,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    listCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    detailsList: {
        borderRadius: 12,
        overflow: 'hidden',
        padding: 12,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    rowLast: {
        borderBottomWidth: 0,
    },
    rowContent: {
        flex: 1,
        marginRight: 12,
    },
    rowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 0,
    },
    secondaryFields: {
        marginTop: 4,
    },
    rowMeta: {
        alignItems: 'flex-end',
        minWidth: 100,
    },
    qtyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 4,
    },
    refBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f8f8',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
        marginBottom: 4,
    },
    viewDetailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        marginTop: 8,
    },
    pctBadge: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 4,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f8f8',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
        marginBottom: 4,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 4,
    },
    rankBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    exportModalContent: {
        padding: 16,
    },
    exportOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
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
        backgroundColor: '#f0f7ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    exportOptionContent: {
        flex: 1,
    },
});

export default ReportDetail;
