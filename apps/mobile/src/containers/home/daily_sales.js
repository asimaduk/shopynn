import React, { useState, useEffect, useCallback } from 'react';
import { View, Dimensions, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Platform, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';
import { Lucide } from '@react-native-vector-icons/lucide';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import { sales as salesApi, normalizeList } from '../../services/api';
import { useSelector } from 'react-redux';
import { canAccessScreen } from '../../utils/permissions';
import FeatureUpgradePrompt from '../../components/FeatureUpgradePrompt';

const { width } = Dimensions.get('window');

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});

const PERIODS = [
    { id: '7', label: '7 days', days: 7 },
    { id: '14', label: '14 days', days: 14 },
    { id: '30', label: '30 days', days: 30 },
    { id: 'custom', label: 'Custom', days: 'custom' },
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function addOrdinalSuffix(day) {
    if (day > 3 && day < 21) return day + 'th';
    switch (day % 10) {
        case 1: return day + 'st';
        case 2: return day + 'nd';
        case 3: return day + 'rd';
        default: return day + 'th';
    }
}

function formatDayLabel(date) {
    const d = date.getDate();
    const month = MONTHS_SHORT[date.getMonth()];
    return `${month} ${addOrdinalSuffix(d)}`;
}

function normalizeDailySummary(raw) {
    // console.log('normalizeDailySummary', raw);
    const list = normalizeList(raw);
    return list
        .map((item) => {
            const dateStr = item?.date || item?.day || item?.created_at || item?.createdAt;
            const d = dateStr ? new Date(dateStr) : null;
            const iso = d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;

            // total fields vary by backend implementation; try common names
            const value =
                Number(item?.totalSales ?? item?.total_sales ?? item?.amount ?? item?.total ?? item?.value ?? 0) || 0;

            return {
                date: iso || String(dateStr || ''),
                label: d && !Number.isNaN(d.getTime()) ? formatDayLabel(d) : String(dateStr || '—'),
                value,
                _raw: item,
            };
        })
        .filter((x) => x.date);
}

function fillMissingDays(mapped, startISO, endISO) {
    if (!startISO || !endISO) return mapped || [];
    const start = new Date(`${startISO}T00:00:00.000Z`);
    const end = new Date(`${endISO}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return mapped || [];
    if (start.getTime() > end.getTime()) return mapped || [];

    const byDate = new Map((mapped || []).map((x) => [x.date, x]));
    const result = [];

    for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        const existing = byDate.get(iso);
        if (existing) {
            result.push(existing);
        } else {
            // use local date label for friendliness
            const localDate = new Date(iso);
            result.push({
                date: iso,
                label: formatDayLabel(localDate),
                value: 0,
                _raw: null,
            });
        }
    }
    return result;
}

const getDefaultCustomEnd = () => new Date();
const getDefaultCustomStart = () => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d;
};

const DailySales = ({ navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const user = useSelector((state) => state.user);
    const subscriptionFeatures = useSelector((state) => state.appSettings?.subscriptionFeatures || []);
    const currentPlanName =
        useSelector((state) => state.appSettings?.subscriptionPlan?.name) ||
        user?.settings?.subscription?.name ||
        'Free';
    const canViewDailySales = canAccessScreen(user, 'DailySales', subscriptionFeatures);
    const [period, setPeriod] = useState(7);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showCustomDateModal, setShowCustomDateModal] = useState(false);
    // Applied range is what we fetch with. Draft range is what the picker edits before "Apply".
    const [customStartDate, setCustomStartDate] = useState(getDefaultCustomStart);
    const [customEndDate, setCustomEndDate] = useState(getDefaultCustomEnd);
    const [draftStartDate, setDraftStartDate] = useState(getDefaultCustomStart);
    const [draftEndDate, setDraftEndDate] = useState(getDefaultCustomEnd);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const getApiParams = useCallback(() => {
        const params = {};
        if (period === 'custom') {
            const start = new Date(customStartDate.getFullYear(), customStartDate.getMonth(), customStartDate.getDate());
            const end = new Date(customEndDate.getFullYear(), customEndDate.getMonth(), customEndDate.getDate());
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);

            params.startDate = start.toISOString();
            params.endDate = end.toISOString();
        } else {
            const days = Number(period) || 7;
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - (days - 1));
            params.startDate = start.toISOString();
            params.endDate = end.toISOString();
        }
        // console.log('getApiParams', params);
        return params;
    }, [period, customStartDate, customEndDate]);

    const loadDailySales = useCallback(async () => {
        if (!canViewDailySales) return;
        try {
            const params = getApiParams();
            const raw = await salesApi.dailySales(params);
            // console.log('raw', raw);
            const mapped = normalizeDailySummary(raw?.daily);
            setData(fillMissingDays(mapped, params.startDate, params.endDate));
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || 'Failed to load daily sales.';
            Alert.alert('Error', msg);
            setData([]);
        }
    }, [getApiParams, canViewDailySales]);

    useEffect(() => {
        if (!canViewDailySales) {
            setLoading(false);
            return;
        }
        setLoading(true);
        loadDailySales().finally(() => setLoading(false));
    }, [loadDailySales, canViewDailySales]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadDailySales();
        setRefreshing(false);
    };

    const formatDate = (date) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };

    const getCustomRangeLabel = () => `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`;

    const handlePeriodPress = (p) => {
        if (p.days === 'custom') {
            // Open modal with draft initialized to applied range
            setDraftStartDate(customStartDate);
            setDraftEndDate(customEndDate);
            setShowCustomDateModal(true);
        } else {
            setPeriod(p.days);
        }
    };

    const handleApplyCustomRange = () => {
        // Normalize to full-day bounds (start-of-day → end-of-day)
        let start = draftStartDate;
        let end = draftEndDate;
 
        if (start.getTime() > end.getTime()) {
            end = new Date(start.getTime());
        }
        // console.log('handleApplyCustomRange', start, end);
        setCustomStartDate(start);
        setCustomEndDate(end);
        setPeriod('custom');
        setShowCustomDateModal(false);
    };

    const onStartDateChange = (event, selectedDate) => {
        if (selectedDate) setDraftStartDate(selectedDate);
        if (Platform.OS === 'android') setShowStartPicker(false);
    };

    const onEndDateChange = (event, selectedDate) => {
        if (selectedDate) setDraftEndDate(selectedDate);
        if (Platform.OS === 'android') setShowEndPicker(false);
    };

    const formatCurrency = (value) => {
        if (value >= 1000000) return `GHS ${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `GHS ${(value / 1000).toFixed(1)}K`;
        return formatter.format(value).replace('GH₵', 'GHS ').trim();
    };

    const totalSales = data.reduce((sum, d) => sum + (d.value || 0), 0);
    const numPoints = data.length || period;
    const spacing = 62;
    const chartWidth = 12 + (numPoints - 1) * spacing + 12;

    if (!canViewDailySales) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
                <ScreenHeader label="Daily Sales" onPress={() => navigation.goBack()} />
                <FeatureUpgradePrompt
                    navigation={navigation}
                    user={user}
                    featureTitle="Daily sales overview"
                    requiredPlanName="Basic"
                    currentPlanName={currentPlanName}
                    description="The full daily sales chart and history are included from the Basic plan. Your Free plan shows the dashboard snapshot only."
                    bullets={[
                        '7, 14, and 30-day sales trends',
                        'Custom date ranges',
                        'Drill into sales by day',
                    ]}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <ScreenHeader
                label="Daily Sales"
                onPress={() => navigation.goBack()}
            />
            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading sales..." color={colors.textTertiary} style={{ marginTop: 10 }} />
                </View>
            ) : (
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.THEME_COLOR} />
                }>
                {/* Period selector */}
                <View style={styles.periodRow}>
                    {PERIODS.map((p) => (
                        <TouchableOpacity
                            key={p.id}
                            activeOpacity={0.7}
                            onPress={() => handlePeriodPress(p)}
                            style={[
                                styles.periodChip,
                                { backgroundColor: period === p.days ? config.THEME_COLOR : colors.surfaceSecondary, borderColor: colors.border },
                            ]}>
                            <AppText
                                label={p.label}
                                fontSize={13}
                                variant={period === p.days ? 1 : 2}
                                color={period === p.days ? '#fff' : colors.text}
                            />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Summary card */}
                <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.summaryRow}>
                        <Lucide name="trending-up" color={config.THEME_COLOR} size={20} />
                        <AppText
                            label={period === 'custom' ? getCustomRangeLabel() : `Total (${period} days)`}
                            fontSize={14}
                            color={colors.textSecondary}
                            style={{ marginLeft: 8, flex: 1 }}
                            numberOfLines={1}
                        />
                    </View>
                    <AppText label={formatCurrency(totalSales)} variant={1} fontSize={24} color={colors.text} style={{ marginTop: 6 }} />
                </View>

                {/* Chart */}
                <View style={[styles.chartContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <AppText label="Sales by day" variant={1} fontSize={16} color={colors.text} style={styles.chartTitle} />
                    {data.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll} contentContainerStyle={{ minWidth: chartWidth }}>
                            <LineChart
                                key={`daily-sales-${data.length}`}
                                data={data}
                                width={chartWidth}
                                height={260}
                                spacing={spacing}
                                initialSpacing={12}
                                endSpacing={12}
                                thickness={2.5}
                                color={config.THEME_COLOR}
                                startFillColor={config.THEME_COLOR}
                                endFillColor={config.THEME_COLOR_SHADE || 'rgba(10, 116, 218, 0.2)'}
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
                                yAxisTextStyle={{ fontFamily: 'FiraSans-Regular', fontSize: 10, color: colors.textTertiary }}
                                xAxisLabelTextStyle={{ fontFamily: 'FiraSans-Regular', fontSize: 10, color: colors.textSecondary }}
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
                                        <View style={[styles.pointerLabel, { backgroundColor: config.THEME_COLOR }]}>
                                            <AppText label={items[0].label} color="#fff" fontSize={11} />
                                            <AppText label={formatCurrency(items[0].value)} variant={1} color="#fff" fontSize={12} style={{ marginLeft: 6 }} />
                                        </View>
                                    ),
                                }}
                            />
                        </ScrollView>
                    ) : (
                        <View style={[styles.placeholder, { backgroundColor: colors.surfaceSecondary }]}>
                            <Lucide name="chart-column" color={colors.border} size={40} />
                            <AppText label="No sales data for this period" color={colors.textTertiary} style={{ marginTop: 10 }} />
                        </View>
                    )}
                </View>

                {/* Day list summary */}
                {data.length > 0 && (
                    <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <AppText label="Daily breakdown" variant={1} fontSize={16} color={colors.text} style={{ marginBottom: 12 }} />
                        {data.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                activeOpacity={0.7}
                                onPress={() => navigation.navigate('DaySalesList', { date: item.date, label: item.label, dayTotal: item.value })}
                                style={[styles.dayRow, { borderBottomColor: index === data.length - 1 ? 'transparent' : colors.divider }]}>
                                <AppText label={item.label} fontSize={14} color={colors.text} />
                                <View style={styles.dayRowRight}>
                                    <AppText label={formatCurrency(item.value)} variant={2} fontSize={14} color={colors.textSecondary} />
                                    <Lucide name="chevron-right" size={18} color={colors.textTertiary} style={{ marginLeft: 4 }} />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
            )}

            {/* Custom Date Range Modal */}
            <AppModal
                visible={showCustomDateModal}
                handleClose={() => setShowCustomDateModal(false)}
                title="Custom Date Range"
                onRequestClose={() => setShowCustomDateModal(false)}>
                <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.surface }}>
                    <View style={styles.customDateField}>
                        <AppText label="Start Date" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                        <TouchableOpacity
                            onPress={() => {
                                if (Platform.OS === 'ios') {
                                    setShowCustomDateModal(false);
                                    setTimeout(() => setShowStartPicker(true), 100);
                                } else {
                                    setShowStartPicker(true);
                                }
                            }}
                            style={[styles.dateFieldTouch, { backgroundColor: colors.inputBackground || colors.surfaceSecondary, borderColor: colors.border }]}>
                            <Lucide name="calendar" size={18} color={colors.placeholder || colors.textTertiary} />
                            <AppText label={formatDate(draftStartDate)} fontSize={15} color={colors.text} style={{ marginLeft: 10, flex: 1 }} />
                            <Lucide name="chevron-down" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.customDateField}>
                        <AppText label="End Date" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                        <TouchableOpacity
                            onPress={() => {
                                if (Platform.OS === 'ios') {
                                    setShowCustomDateModal(false);
                                    setTimeout(() => setShowEndPicker(true), 100);
                                } else {
                                    setShowEndPicker(true);
                                }
                            }}
                            style={[styles.dateFieldTouch, { backgroundColor: colors.inputBackground || colors.surfaceSecondary, borderColor: colors.border }]}>
                            <Lucide name="calendar" size={18} color={colors.placeholder || colors.textTertiary} />
                            <AppText label={formatDate(draftEndDate)} fontSize={15} color={colors.text} style={{ marginLeft: 10, flex: 1 }} />
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
                            value={draftStartDate}
                            mode="date"
                            display="spinner"
                            onChange={onStartDateChange}
                            maximumDate={draftEndDate}
                            style={{ width: '100%', height: 200 }}
                        />
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                setShowStartPicker(false);
                                setTimeout(() => setShowCustomDateModal(true), 100);
                            }}
                            style={[styles.applyDateButton, { backgroundColor: config.THEME_COLOR, marginTop: 20 }]}>
                            <AppText label="Done" fontSize={16} variant={1} color={colors.textInverse} />
                        </TouchableOpacity>
                    </View>
                </AppModal>
            )}
            {Platform.OS === 'android' && showStartPicker && (
                <DateTimePicker
                    value={draftStartDate}
                    mode="date"
                    display="default"
                    onChange={onStartDateChange}
                    maximumDate={draftEndDate}
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
                            value={draftEndDate}
                            mode="date"
                            display="spinner"
                            onChange={onEndDateChange}
                            minimumDate={draftStartDate}
                            style={{ width: '100%', height: 200 }}
                        />
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                setShowEndPicker(false);
                                setTimeout(() => setShowCustomDateModal(true), 100);
                            }}
                            style={[styles.applyDateButton, { backgroundColor: config.THEME_COLOR, marginTop: 20 }]}>
                            <AppText label="Done" fontSize={16} variant={1} color={colors.textInverse} />
                        </TouchableOpacity>
                    </View>
                </AppModal>
            )}
            {Platform.OS === 'android' && showEndPicker && (
                <DateTimePicker
                    value={draftEndDate}
                    mode="date"
                    display="default"
                    onChange={onEndDateChange}
                    minimumDate={draftStartDate}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
    periodRow: { flexDirection: 'row', gap: 10, marginVertical: 16 },
    periodChip: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
    },
    summaryCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center' },
    chartContainer: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    chartTitle: { marginBottom: 12 },
    chartScroll: { marginHorizontal: -8 },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    pointerLabel: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: 100,
    },
    placeholder: {
        height: 220,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listCard: {
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
    },
    dayRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    dayRowRight: {
        flexDirection: 'row',
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
});

export default DailySales;
