import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import { FlashList } from '@shopify/flash-list';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const initialPOs = [
    { id: 'PO-1001', supplier: 'Kasapreko Co. Ltd', itemCount: 154, totalAmount: 12450, date: 'Feb 13, 2025', status: 'received' },
    { id: 'PO-1002', supplier: 'Nestle Ghana', itemCount: 45, totalAmount: 3200.50, date: 'Feb 12, 2025', status: 'sent' },
    { id: 'PO-1003', supplier: 'FanMilk Plc', itemCount: 210, totalAmount: 15670.80, date: 'Feb 10, 2025', status: 'received' },
    { id: 'PO-1004', supplier: 'Voltic GH', itemCount: 120, totalAmount: 5400, date: 'Feb 08, 2025', status: 'draft' },
];

const PurchaseOrders = ({ navigation }) => {
    const { colors } = useTheme();
    const [list, setList] = useState(initialPOs);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadPOs();
    }, []);

    const loadPOs = async () => {
        setIsLoading(true);
        try {
            await new Promise(r => setTimeout(r, 400));
            setList(initialPOs);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadPOs();
        setRefreshing(false);
    };

    const getStatusColor = (status) => {
        if (status === 'received') return { bg: '#dcfce7', color: '#10b981' };
        if (status === 'sent') return { bg: '#dbeafe', color: '#2563eb' };
        return { bg: '#fef3c7', color: '#d97706' };
    };

    const formatAmount = (n) => `GHS ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Purchase orders">
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('CreatePurchaseOrder')}
                    style={[styles.addBtn, { backgroundColor: config.THEME_COLOR }]}
                >
                    <Lucide name="plus" size={20} color="#fff" />
                    <AppText label="Create PO" fontSize={13} color="#fff" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
            </ScreenHeader>

            {isLoading && !refreshing ? (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                </View>
            ) : (
                <FlashList
                    data={list}
                    estimatedItemSize={100}
                    keyExtractor={(item) => item.id}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.THEME_COLOR} />}
                    ListEmptyComponent={() => (
                        <View style={styles.empty}>
                            <Lucide name="file-text" size={48} color={colors.border} />
                            <AppText label="No purchase orders" variant={1} fontSize={16} color={colors.textTertiary} style={{ marginTop: 12 }} />
                            <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('CreatePurchaseOrder')} style={[styles.emptyBtn, { backgroundColor: config.THEME_COLOR }]}>
                                <AppText label="Create first PO" fontSize={14} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}
                    renderItem={({ item }) => {
                        const statusStyle = getStatusColor(item.status);
                        return (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => navigation.navigate('PurchaseOrderDetails', { po: item })}
                                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            >
                                <View style={styles.cardTop}>
                                    <AppText label={item.id} variant={1} fontSize={16} color={colors.text} />
                                    <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                                        <AppText label={item.status} fontSize={11} color={statusStyle.color} />
                                    </View>
                                </View>
                                <AppText label={item.supplier} fontSize={14} color={colors.textSecondary} style={{ marginTop: 4 }} />
                                <View style={styles.cardRow}>
                                    <AppText label={`${item.itemCount} items`} fontSize={12} color={colors.textTertiary} />
                                    <AppText label={item.date} fontSize={12} color={colors.textTertiary} />
                                    <AppText label={formatAmount(item.totalAmount)} variant={1} fontSize={14} color={config.THEME_COLOR} />
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 10 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    card: { marginHorizontal: 12, marginBottom: 10, padding: 14, borderRadius: 10, borderWidth: 1 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
});

export default PurchaseOrders;
