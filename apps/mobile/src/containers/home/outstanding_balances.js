import React, { useCallback, useEffect, useState } from 'react';
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

    const load = useCallback(async () => {
        try {
            if (mode === 'customer') {
                const data = await salesApi.outstanding({ group_by: 'customer' });
                setCustomers(Array.isArray(data?.customers) ? data.customers : []);
                setTotalOutstanding(Number(data?.total_outstanding) || 0);
                setSales([]);
            } else {
                const data = await salesApi.outstanding({});
                setSales(Array.isArray(data?.items) ? data.items : []);
                setTotalOutstanding(Number(data?.total_outstanding) || 0);
                setCustomers([]);
            }
        } catch (_) {
            setCustomers([]);
            setSales([]);
            setTotalOutstanding(0);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [mode]);

    useEffect(() => {
        setLoading(true);
        load();
    }, [load]);

    const onRefresh = () => {
        setRefreshing(true);
        load();
    };

    const renderCustomer = ({ item }) => (
        <TouchableOpacity
            activeOpacity={0.75}
            onPress={async () => {
                try {
                    const data = await salesApi.outstanding({ customer_id: item.customer_id });
                    const items = Array.isArray(data?.items) ? data.items : [];
                    setSales(items);
                    setTotalOutstanding(Number(data?.total_outstanding) || 0);
                    setMode('sales');
                } catch (_) {
                    /* ignore */
                }
            }}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
            <View style={{ flex: 1 }}>
                <AppText label={item.customer_name || 'Customer'} fontSize={15} variant={1} color={colors.text} />
                <AppText
                    label={`${item.open_sales || 0} open · ${item.customer_phone || 'No phone'}${
                        Number(item.store_credit_balance) > 0.001
                            ? ` · credit ${formatCurrency(Number(item.store_credit_balance))}`
                            : ''
                    }`}
                    fontSize={12}
                    color={colors.textTertiary}
                    style={{ marginTop: 2 }}
                />
            </View>
            <AppText
                label={formatCurrency(Number(item.balance_due) || 0)}
                fontSize={15}
                variant={1}
                color={config.THEME_COLOR}
            />
        </TouchableOpacity>
    );

    const renderSale = ({ item }) => (
        <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => navigation.navigate('SaleDetails', { saleId: item.id, item })}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
            <View style={{ flex: 1 }}>
                <AppText
                    label={`#${item.invoice_number || item.id}`}
                    fontSize={15}
                    variant={1}
                    color={colors.text}
                />
                <AppText
                    label={item.customer || 'Customer'}
                    fontSize={12}
                    color={colors.textTertiary}
                    style={{ marginTop: 2 }}
                />
            </View>
            <AppText
                label={formatCurrency(Number(item.balance_due) || 0)}
                fontSize={15}
                variant={1}
                color={config.THEME_COLOR}
            />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Balances owed" />

            <View style={[styles.summary, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <View>
                    <AppText label="Total outstanding" fontSize={12} color={colors.textTertiary} />
                    <AppText
                        label={formatCurrency(totalOutstanding)}
                        fontSize={22}
                        variant={1}
                        color={config.THEME_COLOR}
                    />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setMode('customer')}
                        style={[
                            styles.chip,
                            {
                                backgroundColor: mode === 'customer' ? config.THEME_COLOR : colors.surfaceSecondary,
                            },
                        ]}
                    >
                        <AppText label="By customer" fontSize={12} color={mode === 'customer' ? '#fff' : colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setMode('sales')}
                        style={[
                            styles.chip,
                            {
                                backgroundColor: mode === 'sales' ? config.THEME_COLOR : colors.surfaceSecondary,
                            },
                        ]}
                    >
                        <AppText label="By sale" fontSize={12} color={mode === 'sales' ? '#fff' : colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                </View>
            ) : (
                <FlatList
                    data={mode === 'customer' ? customers : sales}
                    keyExtractor={(item) => String(item.customer_id || item.id)}
                    renderItem={mode === 'customer' ? renderCustomer : renderSale}
                    contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.THEME_COLOR} />
                    }
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Lucide name="circle-check" size={36} color={colors.textTertiary} />
                            <AppText
                                label="No outstanding balances"
                                fontSize={14}
                                color={colors.textSecondary}
                                style={{ marginTop: 10 }}
                            />
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    summary: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    chip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: 8,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
});

export default OutstandingBalances;
