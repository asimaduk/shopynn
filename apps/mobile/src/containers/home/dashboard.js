import React, { useState, useEffect } from 'react';
import { View, Dimensions, ScrollView, Text, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { LineChart } from "react-native-gifted-charts"
import PushNotification from "react-native-push-notification";

import { Lucide } from '@react-native-vector-icons/lucide';
import Header from '../../components/main_header';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { dashboard as dashboardApi, inventories, normalizeList } from '../../services/api';
import { canAccessScreen } from '../../utils/permissions';
import {
    buildLowStockNotificationPayload,
    LOW_STOCK_NOTIFICATION_ID,
} from '../../utils/notificationNavigation';
 
const { width } = Dimensions.get('window')

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});

const Dashboard = ({ navigation, route }) => {
    const user = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [metrics, setMetrics] = useState({
        totalSales: 0,
        totalPurchases: 0,
        totalExpenditures: 0,
        totalProfit: 0,
        salesChange: 0,
        purchasesChange: 0,
        expendituresChange: 0,
        profitChange: 0,
        activeProducts: 0,
        lowStock: 0,
        nearLowStock: 0,
        highStock: 0,
        totalStockValue: 0,
    });
    const [itemsToReorder, setItemsToReorder] = useState([]);
    const [expiringSoon, setExpiringSoon] = useState([]);
    const canNewSale = canAccessScreen(user, 'NewSale', subscriptionFeatures);
    const canNewPurchase = canAccessScreen(user, 'NewPurchase', subscriptionFeatures);
    const canTransfers = canAccessScreen(user, 'ProductTransfers', subscriptionFeatures);
    const canAdjustments = canAccessScreen(user, 'AdjustedQuantities', subscriptionFeatures);
    const canReorder = canAccessScreen(user, 'ItemsToReorder', subscriptionFeatures);
    const canExpiring = canAccessScreen(user, 'ExpiringSoon', subscriptionFeatures);
    const canInventory = canAccessScreen(user, 'Inventory', subscriptionFeatures);
    const canDailySales = canAccessScreen(user, 'DailySales', subscriptionFeatures);

    useEffect(()=> {
        loadDashboardData();
    },[]);

    useEffect(() => {
        if (itemsToReorder.length === 0) return;
        try {
            const payload = buildLowStockNotificationPayload(itemsToReorder.length);
            PushNotification.localNotification({
                id: LOW_STOCK_NOTIFICATION_ID,
                channelId: 'channel-shopynn',
                title: 'Low stock',
                message: `${itemsToReorder.length} item(s) below reorder point.`,
                playSound: true,
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                color: '#0A74DA',
                invokeApp: true,
                userInfo: payload,
                ...payload,
                data: JSON.stringify(payload),
            });
        } catch (_) {}
    }, [itemsToReorder.length]);

    const loadDashboardData = async () => {
        setIsLoading(true);
        try {
            const defaultMetrics = {
                totalSales: 0,
                totalPurchases: 0,
                totalExpenditures: 0,
                totalProfit: 0,
                salesChange: 0,
                purchasesChange: 0,
                expendituresChange: 0,
                profitChange: 0,
                activeProducts: 0,
                lowStock: 0,
                nearLowStock: 0,
                highStock: 0,
                totalStockValue: 0,
            };
            try {
                const dash = await dashboardApi.get({ recentLimit: 5 });
                // console.log('dash', dash);
                if (dash && typeof dash === 'object') {
                    setMetrics({ ...defaultMetrics, ...dash });
                    // if (Array.isArray(dash.recentSales)) setData(dash.recentSales.length ? dash.recentSales : chartData);

                    if(dash.sales?.last7DaysByDay?.length > 0){
                        const chartData = [];
                        dash.sales?.last7DaysByDay?.forEach(day => {
                            day.value = day.total;
                            day.label = addOrdinalSuffix(new Date(day.date).getDate());
                            chartData.push(day);
                        });
                        setData(chartData);
                        // console.log('api chartData', chartData);
                    }
                    else {
                        const chartData = last7Days();
                        // console.log('chartData local', chartData);
                        setData(chartData);
                    }
                } else {
                    setMetrics(defaultMetrics);
                }
                const [lowStockRes, expiringRes] = await Promise.all([
                    inventories.lowStock().catch(() => null),
                    inventories.expiring({ days: 30 }).catch(() => null),
                ]);
                setItemsToReorder(normalizeList(lowStockRes).length ? normalizeList(lowStockRes) : [
                    // { id: '1', name: 'Tampico Medium', sku: 'Tam500', current: 21, reorderAt: 30 },
                    // { id: '2', name: 'Coca Cola 500ml', sku: 'CC500', current: 8, reorderAt: 24 },
                ]);
                setExpiringSoon(normalizeList(expiringRes).length ? normalizeList(expiringRes) : [
                    // { id: '1', name: 'Fan Yogurt', sku: 'FY1', expiryDate: '2025-03-05', daysLeft: 14, qty: 4 },
                    // { id: '2', name: 'Milk 1L', sku: 'ML1L', expiryDate: '2025-03-15', daysLeft: 24, qty: 24 },
                ]);
            } catch (_) {
                setMetrics(defaultMetrics);
                setData(last7Days());
                setItemsToReorder([
                    // { id: '1', name: 'Tampico Medium', sku: 'Tam500', current: 21, reorderAt: 30 },
                    // { id: '2', name: 'Coca Cola 500ml', sku: 'CC500', current: 8, reorderAt: 24 },
                ]);
                setExpiringSoon([
                    // { id: '1', name: 'Fan Yogurt', sku: 'FY1', expiryDate: '2025-03-05', daysLeft: 14, qty: 4 },
                    // { id: '2', name: 'Milk 1L', sku: 'ML1L', expiryDate: '2025-03-15', daysLeft: 24, qty: 24 },
                ]);
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    }

    const onRefresh = async () => {
        setRefreshing(true);
        await loadDashboardData();
        setRefreshing(false);
    }

    function getRandomInt(min, max) {
        const minCeiled = Math.ceil(min);
        const maxFloored = Math.floor(max);
        return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
    }

    function last7Days () {
        // const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        var result = [];
        for (var i=0; i<7; i++) {
            var d = new Date();
            d.setDate(d.getDate() - i);
            result.push({label: addOrdinalSuffix(d.getDate()), value: 0})
        }

        return(result.reverse());
    }

    const addOrdinalSuffix = (day) => {
        // Handle numbers 11, 12, and 13, which all use "th"
        if (day > 3 && day < 21) {
            return day + "th";
        }

        // Determine the suffix based on the last digit
        switch (day % 10) {
            case 1:
                return day + "st";
            case 2:
                return day + "nd";
            case 3:
                return day + "rd";
            default:
                return day + "th";
        }
    }

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    const formatCurrency = (value) => {
        if (value >= 1000000) {
            return `GHS ${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
            return `GHS ${(value / 1000).toFixed(1)}K`;
        }
        return formatter.format(value).replace('GH₵', 'GHS ');
    }

    const MetricCard = ({ icon, iconColor, iconBg, title, value, change, changeType, isCurrency = false }) => {
        const isPositive = changeType === 'positive';
        const changeColor = isPositive ? (config.GREEN_COLOR || '#10b981') : '#ef4444';
        const changeBg = isPositive ? (config.LIGHT_GREEN_COLOR || '#dcfce7') : '#fef2f2';
        
        return (
            <View style={[styles.metricCard, { backgroundColor: colors.surface, borderLeftColor: iconColor }]}>
                <View style={styles.metricHeader}>
                    <AppText label={title} fontSize={12} color={colors.textTertiary} style={{ flex: 1 }} numberOfLines={1} />
                    <View style={[styles.metricIconContainer, { backgroundColor: iconBg }]}>
                        <Lucide name={icon} size={16} color={iconColor} />
                    </View>
                </View>
                <AppText
                    label={isCurrency ? formatCurrency(value) : value.toLocaleString()}
                    variant={1}
                    fontSize={22}
                    color={colors.text}
                    style={styles.metricValue}
                />
                {change !== 0 && (
                    <View style={[styles.changeBadge, { backgroundColor: changeBg }]}>
                        <Lucide
                            name={isPositive ? 'trending-up' : 'trending-down'}
                            size={12}
                            color={changeColor}
                        />
                        <AppText
                            label={`${change > 0 ? '+' : ''}${change}%`}
                            fontSize={11}
                            variant={2}
                            color={changeColor}
                            style={{ marginLeft: 4 }}
                        />
                    </View>
                )}
            </View>
        );
    }

    return (
        <SafeAreaView style={{flex:1,backgroundColor:colors.background,paddingBottom:insets.bottom+48}}>
            <Header navigation={navigation} screen="dashboard" />
            {isLoading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label={'Loading analytics...'} color={colors.textTertiary} style={{marginTop:10}} />
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.THEME_COLOR} />
                    }>
                    
                    {/* Quick Actions - primary tasks first for task-oriented UX */}
                    <View style={[styles.quickActionsContainer, { backgroundColor: colors.surface }]}>
                        <AppText label="Quick actions" variant={1} fontSize={15} color={colors.text} style={styles.quickActionsTitle} />
                        <View style={styles.quickActionsRow}>
                            {/* <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => navigation.navigate('BarcodeScanner', { returnScreen: 'NewSale' })}
                                style={[styles.quickActionBtn, { backgroundColor: '#0ea5e918' }]}>
                                <Lucide name="scan-barcode" size={22} color="#0ea5e9" />
                                <AppText label="Scan" fontSize={12} color="#0ea5e9" style={{ marginTop: 6 }} />
                            </TouchableOpacity> */}
                            {canNewSale && (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => navigation.navigate('NewSale')}
                                    style={[styles.quickActionBtn, { backgroundColor: '#10b98118' }]}>
                                    <Lucide name="shopping-cart" size={22} color="#10b981" />
                                    <AppText label="New Sale" fontSize={12} color="#10b981" style={{ marginTop: 6 }} />
                                </TouchableOpacity>
                            )}
                            {canNewPurchase && (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => navigation.navigate('NewPurchase')}
                                    style={[styles.quickActionBtn, { backgroundColor: config.THEME_COLOR + '18' }]}>
                                    <Lucide name="truck" size={22} color={config.THEME_COLOR} />
                                    <AppText label="Purchase" fontSize={12} color={config.THEME_COLOR} style={{ marginTop: 6 }} />
                                </TouchableOpacity>
                            )}
                            {canTransfers && (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => navigation.navigate('ProductTransfers')}
                                    style={[styles.quickActionBtn, { backgroundColor: '#6366f118' }]}>
                                    <Lucide name="package-check" size={22} color="#6366f1" />
                                    <AppText label="Transfer" fontSize={12} color="#6366f1" style={{ marginTop: 6 }} />
                                </TouchableOpacity>
                            )}
                            {canAdjustments && (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => navigation.navigate('AdjustedQuantities')}
                                    style={[styles.quickActionBtn, { backgroundColor: '#f59e0b18' }]}>
                                    <Lucide name="minus" size={22} color="#f59e0b" />
                                    <AppText label="Adjust" fontSize={12} color="#f59e0b" style={{ marginTop: 6 }} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Metrics Cards - key numbers at a glance */}
                    <View style={styles.metricsContainer}>
                        <View style={styles.metricsRow}>
                            <MetricCard
                                icon="shopping-cart"
                                iconColor="#10b981"
                                iconBg="#f0fdf4"
                                title="Total Sales"
                                value={metrics.sales?.totalRevenue ?? 0}
                                change={metrics.salesChange}
                                changeType="positive"
                                isCurrency={true}
                            />
                            <MetricCard
                                icon="package"
                                iconColor={config.THEME_COLOR}
                                iconBg="#f0f7ff"
                                title="Total Purchases"
                                value={metrics.purchases?.totalAmount ?? 0}
                                change={metrics.purchasesChange}
                                changeType="positive"
                                isCurrency={true}
                            />
                        </View>
                        <View style={styles.metricsRow}>
                            <MetricCard
                                icon="wallet"
                                iconColor="#f59e0b"
                                iconBg="#fffbeb"
                                title="Expenditures"
                                value={metrics.expenses?.totalAmount ?? 0}
                                change={metrics.expendituresChange}
                                changeType="negative"
                                isCurrency={true}
                            />
                            <MetricCard
                                icon="trending-up"
                                iconColor="#a4b2e2"
                                iconBg="#a4b2e918"
                                title="Net Profit"
                                value={metrics.profit?.net > 0 ? metrics.profit?.net : 0}
                                change={metrics.profit?.net > 0 ? metrics.profitChange : 0}
                                changeType={metrics.profit?.net > 0 ? 'positive' : 'negative'}
                                isCurrency={true}
                            />
                        </View>
                    </View>

                    {/* Reorder alerts - urgent, actionable; visible without scrolling */}
                    {canReorder && itemsToReorder.length > 0 && (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate('ItemsToReorder', { items: itemsToReorder })}
                            style={[styles.reorderContainer, { backgroundColor: colors.surface }]}>
                            <View style={styles.reorderHeader}>
                                <View>
                                    <AppText label="Items to reorder" variant={1} fontSize={16} color={colors.text} />
                                    <AppText label={`${itemsToReorder.length} below reorder point`} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                </View>
                                <View style={styles.viewAllButton}>
                                    <AppText label="View all" fontSize={12} color={config.THEME_COLOR} />
                                    <Lucide name="chevron-right" color={config.THEME_COLOR} size={14} style={{ marginLeft: 2 }} />
                                </View>
                            </View>
                            {itemsToReorder.slice(0, 4).map((item, index) => (
                                <View
                                    key={item.id}
                                    style={[styles.reorderRow, { borderBottomColor: index === itemsToReorder.length - 1 ? 'transparent' : colors.borderLight }]}>
                                    <View style={styles.reorderDot} />
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <AppText label={item.name} variant={2} fontSize={14} color={colors.text} numberOfLines={1} />
                                        <AppText label={`${item.sku} · Current stock: ${item.inventory} (Minimum stock: ${item.minimum})`} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                    </View>
                                    <Lucide name="chevron-right" size={18} color={colors.border} />
                                </View>
                            ))}
                        </TouchableOpacity>
                    )}

                    {/* Expiring soon - products expiring in next 30 days */}
                    {canExpiring && expiringSoon.length > 0 && (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate('ExpiringSoon', { items: expiringSoon })}
                            style={[styles.reorderContainer, { backgroundColor: colors.surface }]}>
                            <View style={styles.reorderHeader}>
                                <View>
                                    <AppText label="Expiring soon" variant={1} fontSize={16} color={colors.text} />
                                    <AppText label={`${expiringSoon.length} in next 30 days`} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                </View>
                                <View style={styles.viewAllButton}>
                                    <AppText label="View all" fontSize={12} color={config.THEME_COLOR} />
                                    <Lucide name="chevron-right" color={config.THEME_COLOR} size={14} style={{ marginLeft: 2 }} />
                                </View>
                            </View>
                            {expiringSoon.slice(0, 4).map((item, index) => (
                                <View
                                    key={item.id}
                                    style={[styles.reorderRow, { borderBottomColor: index === expiringSoon.length - 1 ? 'transparent' : colors.borderLight }]}>
                                    <View style={[styles.reorderDot, { backgroundColor: item.daysLeft <= 7 ? '#ef4444' : '#f59e0b' }]} />
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <AppText label={item.name} variant={2} fontSize={14} color={colors.text} numberOfLines={1} />
                                        <AppText label={`${item.sku} · Expires ${item.expiryDate} (${item.daysLeft}d)`} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                    </View>
                                    <Lucide name="chevron-right" size={18} color={colors.border} />
                                </View>
                            ))}
                        </TouchableOpacity>
                    )}

                    {/* Stock valuation - key inventory metric */}
                    <View
                        // activeOpacity={0.7}
                        // onPress={() => navigation.navigate('ReportDetail', { reportId: 'stock-valuation', title: 'Stock valuation' })}
                        style={[styles.stockValuationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.stockValuationHeader}>
                            <View style={styles.stockValuationTitleRow}>
                                <View style={[styles.stockValuationIcon, { backgroundColor: config.THEME_COLOR + '18' }]}>
                                    <Lucide name="package" size={20} color={config.THEME_COLOR} />
                                </View>
                                <AppText label="Stock Valuation" variant={1} fontSize={16} color={colors.text} />
                            </View>
                            {/* <Lucide name="chevron-right" size={18} color={colors.textTertiary} /> */}
                        </View>
                        
                        <View style={[styles.stockValuationMain, { borderBottomColor: colors.divider }]}>
                            <AppText label={formatCurrency(metrics.stockValuation?.totalValue ?? 0)} variant={1} fontSize={28} color={config.THEME_COLOR} />
                            <AppText label="Total inventory value" fontSize={13} color={colors.textSecondary} style={{ marginTop: 4 }} />
                        </View>

                        <View style={styles.stockValuationBreakdown}>
                            <View style={styles.stockValuationMetric}>
                                <View style={styles.stockValuationMetricRow}>
                                    <Lucide name="box" size={16} color={colors.textTertiary} />
                                    <AppText label={`${metrics.products?.activeProducts?.toLocaleString() ?? 0} products`} fontSize={13} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                                </View>
                                {/* <AppText label={formatCurrency(metrics.stockValuation?.))} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} /> */}
                            </View>
                            <View style={[styles.stockValuationDivider, { backgroundColor: colors.divider }]} />
                            <View style={styles.stockValuationMetric}>
                                <View style={styles.stockValuationMetricRow}>
                                    <Lucide name="layers" size={16} color={colors.textTertiary} />
                                    <AppText label={`Avg. ppp: ${formatCurrency(metrics.stockValuation?.averageValuePerProduct ?? 0)}`} fontSize={13} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                                </View>
                                {/* <AppText label={`${((metrics.stockValuation?.averageValuePerProduct ?? 0) / 1000).toFixed(1)}K`} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} /> */}
                            </View>
                        </View>
                    </View>

                    {/* Stock Status - inventory health (grouped with valuation) */}
                    <View style={[styles.stockContainer, { backgroundColor: colors.surface }]}>
                        <View style={styles.stockHeader}>
                            <View style={styles.stockHeaderLeft}>
                                <View style={[styles.stockStatusIconWrap, { backgroundColor: config.THEME_COLOR + '18' }]}>
                                    <Lucide name="layers" size={18} color={config.THEME_COLOR} />
                                </View>
                                <View>
                                    <AppText label="Stock Status" variant={1} fontSize={16} color={colors.text} />
                                    <AppText label={`${metrics.products?.activeProducts?.toLocaleString()} active products`} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                </View>
                            </View>
                            <TouchableOpacity
                                activeOpacity={0.6}
                                disabled={!canInventory}
                                onPress={() => canInventory && navigation.navigate('Inventory')}>
                                <View style={styles.viewAllButton}>
                                    <AppText label="View All" fontSize={12} color={config.THEME_COLOR} />
                                    <Lucide name="chevron-right" color={config.THEME_COLOR} size={14} style={{ marginLeft: 2 }} />
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.stockStatusGrid}>
                            <View style={[styles.stockStatusCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                                <View style={styles.stockStatusCardTop}>
                                    <View style={[styles.stockStatusDot, { backgroundColor: '#10b981' }]} />
                                    <AppText label="High Stock" fontSize={12} color={'#0f172a'} numberOfLines={1} />
                                </View>
                                <AppText label={metrics.stockStatus?.highStockTotal?.toLocaleString()} variant={1} fontSize={20} color={'#0f172a'} style={{ marginTop: 6 }} />
                                <AppText label={`${metrics.products?.activeProducts > 0 ? Math.round((metrics.stockStatus?.highStockTotal / metrics.products?.activeProducts) * 100) : 0}% of products`} fontSize={11} color={'#334155'} style={{ marginTop: 2 }} />
                            </View>

                            <View style={[styles.stockStatusCard, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                                <View style={styles.stockStatusCardTop}>
                                    <View style={[styles.stockStatusDot, { backgroundColor: '#f59e0b' }]} />
                                    <AppText label="Near Low" fontSize={12} color={'#0f172a'} numberOfLines={1} />
                                </View>
                                <AppText label={metrics.stockStatus?.nearLowTotal?.toLocaleString()} variant={1} fontSize={20} color={'#0f172a'} style={{ marginTop: 6 }} />
                                <AppText label={`${metrics.products?.activeProducts > 0 ? Math.round((metrics.stockStatus?.nearLowTotal / metrics.products?.activeProducts) * 100) : 0}% of products`} fontSize={11} color={'#334155'} style={{ marginTop: 2 }} />
                            </View>

                            <View style={[styles.stockStatusCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                                <View style={styles.stockStatusCardTop}>
                                    <View style={[styles.stockStatusDot, { backgroundColor: '#ef4444' }]} />
                                    <AppText label="Low Stock" fontSize={12} color={'#0f172a'} numberOfLines={1} />
                                </View>
                                <AppText label={metrics.stockStatus?.lowStockTotal?.toLocaleString()} variant={1} fontSize={20} color={'#0f172a'} style={{ marginTop: 6 }} />
                                <AppText label={`${metrics.products?.activeProducts > 0 ? Math.round((metrics.stockStatus?.lowStockTotal / metrics.products?.activeProducts) * 100) : 0}% of products`} fontSize={11} color={'#334155'} style={{ marginTop: 2 }} />
                            </View>
                        </View>
                    </View>

                    {/* Sales Chart - trends and analytics */}
                    {data.length ? (
                        <View style={[styles.chartContainer, { backgroundColor: colors.surface }]}>
                            <View style={styles.chartHeader}>
                                <View>
                                    <AppText label={'Sales Overview'} variant={1} fontSize={16} color={colors.text} />
                                    <AppText label={'Last 7 days'} fontSize={12} color={colors.textTertiary} style={{marginTop:2}} />
                                </View>
                                <TouchableOpacity
                                    activeOpacity={0.6}
                                    onPress={() => {
                                        if (canDailySales) {
                                            navigation.navigate('DailySales', { navigation });
                                            return;
                                        }
                                        navigation.navigate('FeatureUpgrade', {
                                            headerTitle: 'Daily sales',
                                            featureTitle: 'Daily sales overview',
                                            requiredPlanName: 'Basic',
                                            description:
                                                'The full daily sales chart and history are included from the Basic plan. Your Free plan shows the dashboard snapshot only.',
                                            bullets: [
                                                '7, 14, and 30-day sales trends',
                                                'Custom date ranges',
                                                'Drill into sales by day',
                                            ],
                                        });
                                    }}>
                                    <View style={styles.viewAllButton}>
                                        <AppText label="View All" fontSize={12} color={config.THEME_COLOR} />
                                        <Lucide name="chevron-right" color={config.THEME_COLOR} size={14} style={{ marginLeft: 2 }} />
                                    </View>
                                </TouchableOpacity>
                            </View>
                            {data.length > 0 && (
                                <View style={[styles.chartSummary, { backgroundColor: colors.primaryShade }]}>
                                    <Lucide name="trending-up" color={config.THEME_COLOR} size={14} />
                                    <AppText
                                        label={`Total: ${formatCurrency(data.reduce((sum, d) => sum + d.value, 0))}`}
                                        fontSize={12}
                                        color={colors.textSecondary}
                                        style={{marginLeft:6}}
                                    />
                                </View>
                            )}
                            <LineChart
                                data={data}
                                width={width - 56}
                                height={260}
                                spacing={(width - 56) / 7}
                                initialSpacing={12}
                                endSpacing={12}
                                thickness={2.5}
                                color={config.THEME_COLOR}
                                startFillColor={config.THEME_COLOR}
                                endFillColor={config.THEME_COLOR_SHADE}
                                startOpacity={0.95}
                                endOpacity={0.15}
                                areaChart
                                curved
                                isAnimated
                                animationDuration={1400}
                                animateOnDataChange
                                yAxisThickness={0}
                                xAxisThickness={0}
                                hideRules
                                noOfSections={4}
                                maxValue={Math.max(...data.map((d) => d.value), 1) * 1.15}
                                yAxisTextStyle={{fontFamily: 'FiraSans-Regular', fontSize: 10, color: colors.textTertiary}}
                                xAxisLabelTextStyle={{fontFamily: 'FiraSans-Regular', fontSize: 10, color: colors.textSecondary}}
                                formatYLabel={(label) => {
                                    if (label === '0') return '0';
                                    const num = Number(label);
                                    const values = data.map((d) => d.value);
                                    const max = Math.max(...values, 1);
                                    if (max > 999999) return `${(num / 1000000).toFixed(1)}m`;
                                    if (max > 9999) return `${(num / 1000).toFixed(1)}k`;
                                    return String(Math.round(num));
                                }}
                                dataPointsColor={config.THEME_COLOR}
                                dataPointsRadius={5}
                                dataPointsHeight={10}
                                dataPointsWidth={10}
                                textColor1="transparent"
                                scrollAnimation
                                pointerConfig={{
                                    activatePointersOnPress: true,
                                    activatePointersOnLongPress: true,
                                    pointerStripHeight: 200,
                                    pointerStripColor: 'rgba(59, 134, 209, 0.15)',
                                    pointerStripWidth: 2,
                                    pointerColor: config.THEME_COLOR,
                                    radius: 6,
                                    pointerLabelWidth: 130,
                                    pointerLabelHeight: 48,
                                    autoAdjustPointerLabelPosition: true,
                                    pointerLabelComponent: (items) => (
                                        <View style={styles.pointerLabel}>
                                            <AppText label={items[0].label} color="#fff" fontSize={11} />
                                            <AppText
                                                label={formatCurrency(items[0].value)}
                                                variant={1}
                                                color="#fff"
                                                fontSize={12}
                                                style={{marginLeft: 6}}
                                            />
                                        </View>
                                    ),
                                }}
                            />
                        </View>
                    ) : (
                        <View style={[styles.chartPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                            <Lucide name="bar-chart-3" color={colors.border} size={40} />
                            <AppText label={'No sales data available'} color={colors.textTertiary} style={{marginTop:10}} />
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    )
}

export default Dashboard;

const styles = StyleSheet.create({
    loadingContainer: {
        flex:1,
        justifyContent:'center',
        alignItems:'center',
        paddingVertical:40
    },
    // Metrics
    metricsContainer: {
        padding:5,
        paddingBottom:0
    },
    metricsRow: {
        flexDirection:'row',
        marginBottom:10
    },
    metricCard: {
        flex: 1,
        borderRadius: 12,
        padding: 14,
        marginHorizontal: 5,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    metricHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    metricIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    metricValue: {
        marginBottom: 8,
    },
    changeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    // Quick actions
    quickActionsContainer: {
        marginHorizontal: 10,
        borderRadius: 5 ,
        padding: 16,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    quickActionsTitle: { marginBottom: 14 },
    quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    quickActionBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 5,
        marginHorizontal: 4,
    },
    // Stock valuation
    stockValuationCard: {
        marginHorizontal: 10,
        borderRadius: 12,
        padding: 18,
        marginBottom: 10,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    stockValuationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    stockValuationTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stockValuationIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    stockValuationMain: {
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    stockValuationBreakdown: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stockValuationMetric: {
        flex: 1,
    },
    stockValuationMetricRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stockValuationDivider: {
        width: StyleSheet.hairlineWidth,
        height: 40,
        marginHorizontal: 12,
    },
    // Reorder alerts
    reorderContainer: {
        marginHorizontal: 10,
        borderRadius: 5,
        padding: 16,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    reorderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    reorderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    reorderDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444',
    },
    // Chart
    chartContainer: {
        marginHorizontal:10,
        borderRadius:5,
        padding:16,
        marginBottom:10,
        shadowColor:'#000',
        shadowOffset:{width:0,height:2},
        shadowOpacity:0.08,
        shadowRadius:4,
        elevation:3
    },
    chartHeader: {
        flexDirection:'row',
        justifyContent:'space-between',
        alignItems:'center',
        marginBottom:8
    },
    chartSummary: {
        flexDirection:'row',
        alignItems:'center',
        marginBottom:12,
        paddingVertical:6,
        paddingHorizontal:10,
        borderRadius:8,
        alignSelf:'flex-start'
    },
    viewAllButton: {
        flexDirection:'row',
        alignItems:'center'
    },
    pointerLabel: {
        flexDirection:'row',
        justifyContent:'center',
        alignItems:'center',
        borderRadius:8,
        backgroundColor:config.THEME_COLOR,
        paddingHorizontal:12,
        paddingVertical:8,
        minWidth:100
    },
    chartPlaceholder: {
        width:width-20,
        marginLeft:10,
        height:220,
        borderRadius:12,
        justifyContent:'center',
        alignItems:'center'
    },
    // Stock Status
    stockContainer: {
        borderRadius: 12,
        marginHorizontal: 10,
        padding: 18,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    stockHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    stockHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stockStatusIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    stockStatusGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    stockStatusCard: {
        flex: 1,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
    },
    stockStatusCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stockStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
})