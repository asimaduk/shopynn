import React, { useState, useCallback } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import config from '../../config';

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});
const formatCurrency = (value) => formatter.format(Number(value)).replace('GH₵', '').trim();

// Sample stock summary data for report
const SAMPLE_STOCK = [
    { id: '1', name: 'Tampico Medium', sku: 'Tam500', category: 'Soft Drinks', quantity: 21, unitPrice: 62, lowStock: true },
    { id: '2', name: '5star 350ml', sku: '5S350', category: 'Energy Drinks', quantity: 264, unitPrice: 46, lowStock: false },
    { id: '3', name: 'Bel Aqua 500ml', sku: 'BA500', category: 'Water', quantity: 45, unitPrice: 57, lowStock: false },
    { id: '4', name: 'Coca Cola 500ml', sku: 'CC500', category: 'Soft Drinks', quantity: 8, unitPrice: 65, lowStock: true },
    { id: '5', name: 'Voltic 500ml', sku: 'V500', category: 'Water', quantity: 120, unitPrice: 55, lowStock: false },
    { id: '6', name: 'Fan Ice', sku: 'FI1', category: 'Dairy', quantity: 35, unitPrice: 12, lowStock: false },
    { id: '7', name: 'Fan Yogurt', sku: 'FY1', category: 'Dairy', quantity: 4, unitPrice: 18, lowStock: true },
];

const StockSummary = ({ navigation }) => {
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [stock] = useState(SAMPLE_STOCK);

    const backPress = () => navigation.goBack();

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        // TODO: Fetch from API
        await new Promise((r) => setTimeout(r, 800));
        setRefreshing(false);
    }, []);

    const totalProducts = stock.length;
    const totalUnits = stock.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalValue = stock.reduce((sum, p) => sum + (p.quantity || 0) * (p.unitPrice || 0), 0);
    const lowStockCount = stock.filter((p) => p.lowStock).length;

    // Group by category
    const byCategory = stock.reduce((acc, p) => {
        const cat = p.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
    }, {});
    const categories = Object.keys(byCategory).sort();

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
            <ScreenHeader onPress={backPress} label="Stock summary" />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[config.THEME_COLOR]} />
                }>
                {/* Summary cards */}
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { borderLeftColor: config.THEME_COLOR, marginHorizontal: 5 }]}>
                        <Lucide name="package" size={20} color={config.THEME_COLOR} />
                        <AppText label={String(totalProducts)} variant={1} fontSize={18} style={{ marginTop: 4 }} />
                        <AppText label="Products" fontSize={12} color="#666" />
                    </View>
                    <View style={[styles.summaryCard, { borderLeftColor: '#10b981', marginHorizontal: 5 }]}>
                        <Lucide name="layers" size={20} color="#10b981" />
                        <AppText label={totalUnits.toLocaleString()} variant={1} fontSize={18} style={{ marginTop: 4 }} />
                        <AppText label="Total units" fontSize={12} color="#666" />
                    </View>
                </View>
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { borderLeftColor: '#f59e0b', marginHorizontal: 5 }]}>
                        <Lucide name="wallet" size={20} color="#f59e0b" />
                        <AppText label={formatCurrency(totalValue)} variant={1} fontSize={16} style={{ marginTop: 4 }} numberOfLines={1} />
                        <AppText label="Stock value" fontSize={12} color="#666" />
                    </View>
                    <View style={[styles.summaryCard, { borderLeftColor: '#ef4444', marginHorizontal: 5 }]}>
                        <Lucide name="alert-triangle" size={20} color="#ef4444" />
                        <AppText label={String(lowStockCount)} variant={1} fontSize={18} style={{ marginTop: 4 }} />
                        <AppText label="Low stock" fontSize={12} color="#666" />
                    </View>
                </View>

                {/* By category */}
                <AppText label="By category" variant={1} fontSize={16} color="#333" style={styles.sectionTitle} />
                {categories.map((cat) => {
                    const items = byCategory[cat];
                    const catValue = items.reduce((s, p) => s + (p.quantity || 0) * (p.unitPrice || 0), 0);
                    const catUnits = items.reduce((s, p) => s + (p.quantity || 0), 0);
                    return (
                        <View key={cat} style={styles.categoryBlock}>
                            <View style={styles.categoryHeader}>
                                <AppText label={cat} variant={1} fontSize={15} color={config.THEME_COLOR} />
                                <AppText label={`${items.length} products · ${catUnits} units`} fontSize={12} color="#666" />
                            </View>
                            {items.map((item) => (
                                <View key={item.id} style={styles.productRow}>
                                    <View style={{ flex: 1 }}>
                                        <AppText label={item.name} variant={2} fontSize={14} numberOfLines={1} />
                                        <AppText label={item.sku} fontSize={12} color="#999" style={{ marginTop: 2 }} />
                                    </View>
                                    <View style={styles.productMeta}>
                                        <View style={[styles.qtyBadge, item.lowStock && styles.qtyBadgeLow]}>
                                            <AppText label={`×${item.quantity}`} fontSize={13} color={item.lowStock ? '#b91c1c' : '#333'} />
                                        </View>
                                        <AppText label={formatCurrency((item.quantity || 0) * (item.unitPrice || 0))} fontSize={13} color="#666" style={{ marginLeft: 8 }} />
                                    </View>
                                </View>
                            ))}
                            <View style={styles.categoryFooter}>
                                <AppText label="Category value" fontSize={12} color="#666" />
                                <AppText label={formatCurrency(catValue)} variant={1} fontSize={14} color={config.THEME_COLOR} />
                            </View>
                        </View>
                    );
                })}
                <View style={{ height: 24 }} />
            </ScrollView>
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#eee' },
    scroll: { flex: 1 },
    scrollContent: { padding: 14, paddingBottom: 24 },
    summaryRow: { flexDirection: 'row', marginBottom: 10, marginHorizontal: -5 },
    summaryCard: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    sectionTitle: { marginTop: 16, marginBottom: 10 },
    categoryBlock: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        marginBottom: 8,
    },
    productRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    productMeta: { flexDirection: 'row', alignItems: 'center' },
    qtyBadge: {
        minWidth: 44,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
    },
    qtyBadgeLow: { backgroundColor: '#fef2f2' },
    categoryFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default StockSummary;
