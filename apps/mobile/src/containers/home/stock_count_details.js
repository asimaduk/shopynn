import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { stockCounts as stockCountsApi } from '../../services/api';

// const mockItems = [
//     { id: '1', name: 'Tampico Medium', sku: 'Tam500', systemQty: 21, actualQty: 24, variance: 3 },
//     { id: '2', name: '5star 350ml', sku: '5S350', systemQty: 264, actualQty: 264, variance: 0 },
//     { id: '3', name: 'Coca Cola 500ml', sku: 'CC500', systemQty: 45, actualQty: 42, variance: -3 },
// ];

// const defaultStockCount = {
//     id: 'SC-001',
//     warehouse: 'Main Store',
//     itemCount: 24,
//     date: 'Feb 19, 2025 @ 2:30pm',
//     user: 'Kingsford Asimadu',
//     status: 'completed',
//     varianceCount: 3,
// };

const StockCountDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { stockCount: paramStockCount, stockCountId } = route.params || {};
    const [stockCount, setStockCount] = useState(paramStockCount || {});
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(!!(stockCountId || paramStockCount?.id));

    useEffect(() => {
        const id = stockCountId || paramStockCount?.id;
        if (!id) return;
        let mounted = true;
        setLoading(true);
        stockCountsApi.get(id).then((data) => {
            console.log('stock count details', data);
            
            if (mounted && data) {
                setStockCount((prev) => ({ ...prev, ...data }));
                if (Array.isArray(data.items)) setItems(data.items);
            }
        }).catch(() => {}).finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [stockCountId, paramStockCount?.id]);

    const backPress = () => navigation.goBack();

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading stock count..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    const DetailSection = ({ title, children }) => (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <AppText label={title} fontSize={16} variant={1} style={[styles.sectionTitle, { color: colors.text }]} />
            {children}
        </View>
    );

    const formatDateAndTime = (date) => {
        return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' ' + new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const varianceCount = items.reduce((count, item) => {
        const varianceValue = Number.isFinite(Number(item?.variance))
            ? Number(item.variance)
            : (Number(item?.counted_quantity) || 0) - (Number(item?.expected_quantity) || 0);
        return varianceValue !== 0 ? count + 1 : count;
    }, 0);

    const uniqueProductCount =
        items.length > 0
            ? new Set(items.map((i) => i.product_id).filter(Boolean)).size
            : Number(stockCount.number_of_items) || 0;

    // const DetailRow = ({ icon, label, value }) => (
    //     <View style={styles.detailRow}>
    //         <View style={[styles.iconContainer, { backgroundColor: colors.surfaceSecondary }]}>
    //             <Lucide name={icon} color={colors.textSecondary} size={18} />
    //         </View>
    //         <View style={{ flex: 1 }}>
    //             <AppText label={label} fontSize={12} color={colors.textTertiary} />
    //             <AppText label={value} fontSize={15} color={colors.text} />
    //         </View>
    //     </View>
    // );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label="Stock count details" />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15 }}>
                <View style={[styles.statusHeader, { backgroundColor: config.GREEN_COLOR }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <AppText label={stockCount.reference_number} fontSize={20} variant={2} color="#fff" />
                            <AppText label={stockCount.status.toUpperCase()} fontSize={12} color="rgba(255,255,255,0.9)" style={{ marginTop: 2 }} />
                            <AppText label={formatDateAndTime(stockCount.created_at)} fontSize={13} color="rgba(255,255,255,0.8)" />
                        </View>
                        <Lucide name="clipboard-check" size={32} color="#fff" />
                    </View>
                </View>

                <DetailSection title="Summary">
                    <View style={styles.summaryBox}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <AppText label="Warehouse" fontSize={12} color={colors.textTertiary} />
                            <AppText label={stockCount.warehouse_name} fontSize={14} color={colors.text} />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <AppText label="Unique products" fontSize={12} color={colors.textTertiary} />
                            <AppText label={String(uniqueProductCount)} fontSize={14} color={colors.text} />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <AppText label="Variances" fontSize={12} color={colors.textTertiary} />
                            <AppText label={String(varianceCount)} fontSize={14} color={varianceCount > 0 ? '#f59e0b' : colors.text} />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <AppText label="Performed by" fontSize={12} color={colors.textTertiary} />
                            <AppText label={stockCount.creator_first_name + ' ' + stockCount.creator_last_name} fontSize={14} color={colors.text} />
                        </View>
                    </View>
                </DetailSection>

                <DetailSection title="Counted items">
                    {items.map((item, index) => {
                        const hasVariance = item.variance !== 0;
                        return (
                            <View key={item.id} style={[styles.itemRow, { borderBottomColor: index === items.length - 1 ? 'transparent' : colors.borderLight }]}>
                                <View style={{ flex: 1 }}>
                                    <AppText label={item.product_name} variant={1} fontSize={14} color={colors.text} />
                                    <AppText label={item.sku} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <View style={styles.qtyRow}>
                                        <AppText label="System:" fontSize={11} color={colors.textTertiary} />
                                        <AppText label={String(item.expected_quantity)} fontSize={13} color={colors.text} style={{ marginLeft: 4 }} />
                                    </View>
                                    <View style={styles.qtyRow}>
                                        <AppText label="Actual:" fontSize={11} color={colors.textTertiary} />
                                        <AppText label={String(item.counted_quantity)} fontSize={13} color={colors.text} style={{ marginLeft: 4 }} />
                                    </View>
                                    {hasVariance && (
                                        <View style={[styles.varianceBadge, { backgroundColor: item.variance > 0 ? config.GREEN_COLOR + '18' : colors.error + '18' }]}>
                                            <Lucide name={item.variance > 0 ? 'arrow-up' : 'arrow-down'} size={12} color={item.variance > 0 ? config.GREEN_COLOR : colors.error} />
                                            <AppText label={item.variance > 0 ? `+${item.variance}` : String(item.variance)} fontSize={11} color={item.variance > 0 ? colors.successLight : colors.error} style={{ marginLeft: 4 }} />
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </DetailSection>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    statusHeader: {
        padding: 20,
        borderRadius: 10,
        marginBottom: 16,
    },
    section: {
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
    },
    sectionTitle: {
        marginBottom: 12,
    },
    summaryBox: {
        paddingVertical: 4,
    },
    // detailRow: {
    //     flexDirection: 'row',
    //     alignItems: 'center',
    //     marginBottom: 12,
    // },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    qtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    varianceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        marginTop: 4,
    },
});

export default StockCountDetails;
