import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { formatCurrency } from '../../utils/format';
import { sales as salesApi } from '../../services/api';

const initialsFromName = (name) => {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

/**
 * Customer AR balances — grouped outstanding sale balances.
 */
const OutstandingBalances = ({ navigation }) => {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [totalOutstanding, setTotalOutstanding] = useState(0);
    const [mode, setMode] = useState('customer'); // customer | sales
    const [sales, setSales] = useState([]);
    const [drillCustomer, setDrillCustomer] = useState(null);

    const load = useCallback(async () => {
        try {
            if (mode === 'customer' && !drillCustomer) {
                const data = await salesApi.outstanding({ group_by: 'customer' });
                setCustomers(Array.isArray(data?.customers) ? data.customers : []);
                setTotalOutstanding(Number(data?.total_outstanding) || 0);
                setSales([]);
            } else {
                const params = drillCustomer?.customer_id
                    ? { customer_id: drillCustomer.customer_id }
                    : {};
                const data = await salesApi.outstanding(params);
                setSales(Array.isArray(data?.items) ? data.items : []);
                setTotalOutstanding(Number(data?.total_outstanding) || 0);
                if (!drillCustomer) setCustomers([]);
            }
        } catch (_) {
            setCustomers([]);
            setSales([]);
            setTotalOutstanding(0);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [mode, drillCustomer]);

    useEffect(() => {
        setLoading(true);
        load();
    }, [load]);

    const onRefresh = () => {
        setRefreshing(true);
        load();
    };

    const openCount = useMemo(() => {
        if (mode === 'customer' && !drillCustomer) {
            return customers.reduce((n, c) => n + (Number(c.open_sales) || 0), 0);
        }
        return sales.length;
    }, [mode, drillCustomer, customers, sales]);

    const handleBack = () => {
        if (drillCustomer) {
            setDrillCustomer(null);
            setMode('customer');
            setLoading(true);
            return;
        }
        navigation.goBack();
    };

    const renderCustomer = ({ item }) => {
        const credit = Number(item.store_credit_balance) || 0;
        return (
            <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                    setDrillCustomer({
                        customer_id: item.customer_id,
                        customer_name: item.customer_name || 'Customer',
                    });
                    setMode('sales');
                    setLoading(true);
                }}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
                <View style={[styles.avatar, { backgroundColor: colors.primaryShade }]}>
                    <AppText
                        label={initialsFromName(item.customer_name)}
                        fontSize={14}
                        variant={1}
                        color={config.THEME_COLOR}
                    />
                </View>
                <View style={styles.cardBody}>
                    <AppText
                        label={item.customer_name || 'Customer'}
                        fontSize={15}
                        variant={1}
                        color={colors.text}
                        numberOfLines={1}
                    />
                    <AppText
                        label={`${item.open_sales || 0} open sale${Number(item.open_sales) === 1 ? '' : 's'}${
                            item.customer_phone ? ` · ${item.customer_phone}` : ''
                        }`}
                        fontSize={12}
                        color={colors.textTertiary}
                        style={{ marginTop: 3 }}
                        numberOfLines={1}
                    />
                    {credit > 0.001 ? (
                        <View style={[styles.creditPill, { backgroundColor: colors.surfaceSecondary }]}>
                            <Lucide name="badge-percent" size={11} color={colors.textSecondary} />
                            <AppText
                                label={`Store credit ${formatCurrency(credit)}`}
                                fontSize={11}
                                color={colors.textSecondary}
                                style={{ marginLeft: 4 }}
                            />
                        </View>
                    ) : null}
                </View>
                <View style={styles.amountCol}>
                    <AppText
                        label={formatCurrency(Number(item.balance_due) || 0)}
                        fontSize={15}
                        variant={1}
                        color={config.THEME_COLOR}
                    />
                    <Lucide name="chevron-right" size={16} color={colors.textTertiary} style={{ marginTop: 4 }} />
                </View>
            </TouchableOpacity>
        );
    };

    const renderSale = ({ item }) => (
        <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => navigation.navigate('SaleDetails', { saleId: item.id, item })}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
            <View style={[styles.avatar, { backgroundColor: colors.surfaceSecondary }]}>
                <Lucide name="file-text" size={18} color={config.THEME_COLOR} />
            </View>
            <View style={styles.cardBody}>
                <AppText
                    label={`#${item.invoice_number || item.id}`}
                    fontSize={15}
                    variant={1}
                    color={colors.text}
                    numberOfLines={1}
                />
                <AppText
                    label={item.customer || drillCustomer?.customer_name || 'Customer'}
                    fontSize={12}
                    color={colors.textTertiary}
                    style={{ marginTop: 3 }}
                    numberOfLines={1}
                />
            </View>
            <View style={styles.amountCol}>
                <AppText
                    label={formatCurrency(Number(item.balance_due) || 0)}
                    fontSize={15}
                    variant={1}
                    color={config.THEME_COLOR}
                />
                <Lucide name="chevron-right" size={16} color={colors.textTertiary} style={{ marginTop: 4 }} />
            </View>
        </TouchableOpacity>
    );

    const listData = mode === 'customer' && !drillCustomer ? customers : sales;
    const listMode = mode === 'customer' && !drillCustomer ? 'customer' : 'sales';

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader
                onPress={handleBack}
                label={drillCustomer ? drillCustomer.customer_name : 'Balances owed'}
            />

            <View style={styles.content}>
                {/* Summary hero */}
                <View style={[styles.hero, { backgroundColor: colors.primaryShade, borderColor: colors.border }]}>
                    <View style={[styles.heroIconWrap, { backgroundColor: colors.surface }]}>
                        <Lucide name="wallet" size={22} color={config.THEME_COLOR} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <AppText label="Total outstanding" fontSize={12} color={colors.textSecondary} />
                        <AppText
                            label={formatCurrency(totalOutstanding)}
                            fontSize={26}
                            variant={1}
                            color={config.THEME_COLOR}
                            style={{ marginTop: 2 }}
                        />
                        <AppText
                            label={
                                drillCustomer
                                    ? `${openCount} open sale${openCount === 1 ? '' : 's'} for this customer`
                                    : `${openCount} open · ${listMode === 'customer' ? customers.length : sales.length} listed`
                            }
                            fontSize={12}
                            color={colors.textTertiary}
                            style={{ marginTop: 4 }}
                        />
                    </View>
                </View>

                {/* Segmented control — hide when drilled into a customer */}
                {!drillCustomer ? (
                    <View style={[styles.segmentTrack, { backgroundColor: colors.surfaceSecondary }]}>
                        {[
                            { key: 'customer', label: 'By customer', icon: 'users' },
                            { key: 'sales', label: 'By sale', icon: 'cedi' },
                        ].map((seg) => {
                            const active = mode === seg.key;
                            return (
                                <TouchableOpacity
                                    key={seg.key}
                                    activeOpacity={0.75}
                                    onPress={() => {
                                        setMode(seg.key);
                                        setDrillCustomer(null);
                                        setLoading(true);
                                    }}
                                    style={[
                                        styles.segmentBtn,
                                        active && {
                                            backgroundColor: colors.surface,
                                            shadowColor: '#000',
                                            shadowOpacity: 0.06,
                                            shadowRadius: 4,
                                            shadowOffset: { width: 0, height: 1 },
                                            elevation: 1,
                                        },
                                    ]}
                                >
                                    {seg.icon === 'cedi' ? (
                                        <AppText
                                            label="₵"
                                            fontSize={15}
                                            variant={1}
                                            color={active ? config.THEME_COLOR : colors.textTertiary}
                                        />
                                    ) : (
                                        <Lucide
                                            name={seg.icon}
                                            size={14}
                                            color={active ? config.THEME_COLOR : colors.textTertiary}
                                        />
                                    )}
                                    <AppText
                                        label={seg.label}
                                        fontSize={13}
                                        variant={active ? 1 : 2}
                                        color={active ? colors.text : colors.textSecondary}
                                        style={{ marginLeft: 6 }}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ) : (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                            setDrillCustomer(null);
                            setMode('customer');
                            setLoading(true);
                        }}
                        style={styles.backToCustomers}
                    >
                        <Lucide name="arrow-left" size={14} color={config.THEME_COLOR} />
                        <AppText
                            label="All customers"
                            fontSize={13}
                            color={config.THEME_COLOR}
                            style={{ marginLeft: 6 }}
                        />
                    </TouchableOpacity>
                )}

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    </View>
                ) : (
                    <FlatList
                        data={listData}
                        keyExtractor={(item) => String(item.customer_id || item.id)}
                        renderItem={listMode === 'customer' ? renderCustomer : renderSale}
                        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={config.THEME_COLOR}
                            />
                        }
                        ListEmptyComponent={
                            <View style={styles.center}>
                                <View
                                    style={[
                                        styles.emptyIcon,
                                        { backgroundColor: colors.surfaceSecondary },
                                    ]}
                                >
                                    <Lucide name="circle-check" size={32} color={colors.textTertiary} />
                                </View>
                                <AppText
                                    label="No outstanding balances"
                                    fontSize={15}
                                    variant={1}
                                    color={colors.text}
                                    style={{ marginTop: 12 }}
                                />
                                <AppText
                                    label="Credit and partial sales will show here"
                                    fontSize={13}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 4, textAlign: 'center' }}
                                />
                            </View>
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingHorizontal: 14,
        paddingTop: 8,
    },
    hero: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: 14,
    },
    heroIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentTrack: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        marginBottom: 14,
        gap: 4,
    },
    segmentBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
    },
    backToCustomers: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 4,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: 10,
        gap: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardBody: {
        flex: 1,
        minWidth: 0,
    },
    amountCol: {
        alignItems: 'flex-end',
    },
    creditPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginTop: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 48,
        paddingHorizontal: 24,
    },
});

export default OutstandingBalances;
