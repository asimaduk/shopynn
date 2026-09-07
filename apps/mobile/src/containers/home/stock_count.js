import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { FlashList } from '@shopify/flash-list';
import { useSelector } from 'react-redux';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import AppModal from '../../components/app_modal';
import { products as productsApi, warehouses as warehousesApi, stockCounts as stockCountsApi, normalizeList } from '../../services/api';

const StockCount = ({ navigation }) => {
    const { colors } = useTheme();
    const user = useSelector(({ user }) => user);

    const isAdmin =
        typeof user?.roles === 'string' &&
        user.roles
            .split(',')
            .map(role => role.trim().toLowerCase())
            .includes('admin');

    const [items, setItems] = useState([]);
    const [warehouseName, setWarehouseName] = useState('Main store');
    const [warehouseId, setWarehouseId] = useState(null);
    const [warehouses, setWarehouses] = useState([]);
    const [showWarehousePicker, setShowWarehousePicker] = useState(false);
    const [warehouseSearch, setWarehouseSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [referenceNumber, setReferenceNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        let mounted = true;
        const loadWarehouses = async () => {
            try {
                const rawWarehouses = await warehousesApi.list();
                const wList = normalizeList(rawWarehouses) || [];
                if (!mounted) return;
                setWarehouses(Array.isArray(wList) ? wList : []);
                if (!warehouseId && Array.isArray(wList) && wList.length > 0) {
                    setWarehouseName(wList[0].name || 'Main store');
                    setWarehouseId(wList[0].id || null);
                }
            } catch (_) {
                if (!mounted) return;
                setWarehouseName('Main store');
                setWarehouseId(null);
            }
        };
        loadWarehouses();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!warehouseId) return;
        let mounted = true;
        const loadProducts = async () => {
            setLoading(true);
            try {
                const params = warehouseId ? { warehouse_id: warehouseId } : {};
                const rawProducts = await productsApi.list(params);
                console.log('rawProducts', rawProducts);
                const list = normalizeList(rawProducts) || [];
                if (!mounted) return;
                const mapped = Array.isArray(list)
                    ? list.map((p) => ({
                          id: p.id,
                          name: p.name,
                          sku: p.sku,
                          systemQty: p.inventory ?? p.initial_stock ?? 0,
                          actualQty: '',
                          inventoryId: p.stores_quantities[0]?.id,
                      }))
                    : [];
                setItems(mapped);
            } catch (_) {
                if (!mounted) return;
                setItems([]);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        loadProducts();
        return () => {
            mounted = false;
        };
    }, [warehouseId]);

    const updateActual = (id, value) => {
        setItems((prev) =>
            prev.map((i) =>
                i.id === id ? { ...i, actualQty: value.replace(/[^0-9]/g, '') } : i
            )
        );
    };

    const filteredWarehouses = warehouses.filter(
        (w) =>
            !warehouseSearch.trim() ||
            (w.name && w.name.toLowerCase().includes(warehouseSearch.toLowerCase()))
    );

    const filteredItems = items.filter((item) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            (item.name && item.name.toLowerCase().includes(q)) ||
            (item.sku && item.sku.toLowerCase().includes(q))
        );
    });

    const uniqueProductTotal = useMemo(
        () => new Set(items.map((i) => i.id).filter(Boolean)).size,
        [items]
    );
    const uniqueProductFiltered = useMemo(
        () => new Set(filteredItems.map((i) => i.id).filter(Boolean)).size,
        [filteredItems]
    );

    const handleSubmit = () => {
        const withActual = items.filter((i) => i.actualQty !== '' && i.actualQty !== null);
        if (withActual.length === 0) { Alert.alert('Required', 'Enter actual count for at least one item.'); return; }
        const uniqueSubmitted = new Set(withActual.map((i) => i.id)).size;
        Alert.alert(
            'Stock count',
            `Submit count for ${uniqueSubmitted} unique product${uniqueSubmitted === 1 ? '' : 's'}? Adjustments will be created for variances.`,
            [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Submit',
                onPress: async () => {
                    try {
                        setSubmitting(true);
                        await stockCountsApi.create({
                            warehouse_id: warehouseId || undefined,
                            reference_number: referenceNumber?.trim() || undefined,
                            notes: notes?.trim() || undefined,
                            items: withActual.map((i) => ({
                                product_id: i.id,
                                inventory_id: i.inventoryId,
                                expected_quantity: Number(i.systemQty) || 0,
                                counted_quantity: Number(i.actualQty) || 0,
                            })),
                        });
                        Alert.alert('Success', 'Stock count submitted.', [
                            { text: 'OK', onPress: () => navigation.navigate('StockCountHistory') },
                        ]);
                    } catch (err) {
                        const msg =
                            err?.response?.data?.message ||
                            err?.message ||
                            'Failed to submit stock count.';
                        Alert.alert('Error', msg);
                    } finally {
                        setSubmitting(false);
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Stock count / Audit" />
            <View style={[styles.banner, { backgroundColor: colors.primaryShade }]}>
                <Lucide name="clipboard-check" color={config.THEME_COLOR} size={24} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                    <AppText label="Count actual stock" variant={1} fontSize={16} color={colors.text} />
                    <AppText
                        label={`Location: ${warehouseName}. Enter actual quantity per product.`}
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginTop: 2 }}
                    />
                </View>
            </View>
            {isAdmin && (
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowWarehousePicker(true)}
                    style={[styles.storeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                    <View style={styles.storeIconWrap}>
                        <Lucide name="store" size={18} color={config.THEME_COLOR} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <AppText label="Warehouse" fontSize={11} color={colors.textTertiary} />
                        <AppText
                            label={warehouseName || 'Select warehouse'}
                            variant={1}
                            fontSize={14}
                            numberOfLines={1}
                            color={colors.text}
                        />
                    </View>
                    <Lucide name="chevron-down" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
            )}
            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText
                        label="Loading products..."
                        fontSize={14}
                        color={colors.textSecondary}
                        style={{ marginTop: 8 }}
                    />
                </View>
            ) : (
                <>
                    <View style={[styles.metaCard, { backgroundColor: colors.surface }]}>
                        <View style={styles.metaRow}>
                            <Lucide name="hash" size={16} color={colors.textTertiary} />
                            <TextInput
                                placeholder="Reference number (optional)"
                                placeholderTextColor={colors.placeholder}
                                value={referenceNumber}
                                onChangeText={setReferenceNumber}
                                style={[styles.metaInput, { color: colors.text, borderColor: colors.border }]}
                            />
                        </View>
                        <View style={[styles.metaRow, { marginTop: 8, alignItems: 'flex-start' }]}>
                            <Lucide name="file-text" size={16} color={colors.textTertiary} style={{ marginTop: 10 }} />
                            <TextInput
                                placeholder="Notes about this stock count (optional)"
                                placeholderTextColor={colors.placeholder}
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                style={[
                                    styles.metaInput,
                                    styles.metaNotesInput,
                                    { color: colors.text, borderColor: colors.border },
                                ]}
                            />
                        </View>
                    </View>
                    <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Lucide name="search" color={colors.placeholder} size={18} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.text }]}
                            placeholder="Search products..."
                            placeholderTextColor={colors.placeholder}
                            value={search}
                            onChangeText={setSearch}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch('')}>
                                <Lucide name="x" color={colors.placeholder} size={18} />
                            </TouchableOpacity>
                        )}
                    </View>
                    {!loading && uniqueProductTotal > 0 && (
                        <View style={[styles.uniqueCountRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <Lucide name="layers" size={16} color={config.THEME_COLOR} />
                            <AppText
                                label={
                                    search.trim()
                                        ? `${uniqueProductFiltered} unique product${uniqueProductFiltered === 1 ? '' : 's'} shown · ${uniqueProductTotal} in warehouse`
                                        : `${uniqueProductTotal} unique product${uniqueProductTotal === 1 ? '' : 's'} in this count`
                                }
                                fontSize={13}
                                color={colors.textSecondary}
                                style={{ marginLeft: 8, flex: 1 }}
                            />
                        </View>
                    )}

                    <FlashList
                        data={filteredItems}
                        estimatedItemSize={72}
                        keyExtractor={(item) => String(item.id)}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => (
                            <View style={[styles.card, { backgroundColor: colors.surface }]}>
                                <View style={{ flex: 1 }}>
                                    <AppText label={item.name} variant={1} fontSize={15} color={colors.text} />
                                    <AppText
                                        label={`${item.sku} · System: ${item.systemQty}`}
                                        fontSize={12}
                                        color={colors.textSecondary}
                                        style={{ marginTop: 4 }}
                                    />
                                </View>
                                <View style={styles.actualWrap}>
                                    <AppText
                                        label="Actual"
                                        fontSize={12}
                                        color={colors.textSecondary}
                                        style={{ marginBottom: 4 }}
                                    />
                                    <TextInput
                                        placeholder="0"
                                        placeholderTextColor={colors.placeholder}
                                        value={item.actualQty}
                                        onChangeText={(v) => updateActual(item.id, v)}
                                        keyboardType="number-pad"
                                        style={[
                                            styles.actualInput,
                                            { color: colors.text, borderColor: colors.border },
                                        ]}
                                    />
                                </View>
                            </View>
                        )}
                    />
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSubmit}
                        disabled={submitting || items.length === 0}
                        style={[
                            styles.submitBtn,
                            (submitting || items.length === 0) && { opacity: 0.7 },
                        ]}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color={colors.textInverse} />
                        ) : (
                            <AppText
                                label="Submit stock count"
                                variant={1}
                                color={colors.textInverse}
                                fontSize={16}
                            />
                        )}
                    </TouchableOpacity>
                </>
            )}
            <AppModal
                title="Select warehouse"
                handleClose={() => setShowWarehousePicker(false)}
                onRequestClose={() => setShowWarehousePicker(false)}
                visible={showWarehousePicker}
            >
                <View style={{ padding: 16, paddingBottom: 0 }}>
                    <TextInput
                        placeholder="Search warehouses..."
                        placeholderTextColor={colors.placeholder}
                        value={warehouseSearch}
                        onChangeText={setWarehouseSearch}
                        style={[
                            styles.modalSearch,
                            { borderColor: colors.border, color: colors.text },
                        ]}
                    />
                    <View style={{ height: 260, marginTop: 10 }}>
                        <FlashList
                            keyboardShouldPersistTaps="handled"
                            data={filteredWarehouses}
                            estimatedItemSize={48}
                            keyExtractor={(item, idx) => item.id || item.name || String(idx)}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        setWarehouseName(item.name || '');
                                        setWarehouseId(item.id || null);
                                        setShowWarehousePicker(false);
                                        setWarehouseSearch('');
                                    }}
                                    style={[
                                        styles.modalRow,
                                        { borderBottomColor: colors.border },
                                    ]}
                                >
                                    <Lucide
                                        name="store"
                                        size={18}
                                        color={colors.textTertiary}
                                    />
                                    <AppText
                                        label={item.name}
                                        style={{ flex: 1, marginLeft: 12 }}
                                        color={colors.text}
                                    />
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </AppModal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#eee' },
    banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f7ff', padding: 14, marginHorizontal: 16, marginTop: 10, borderRadius: 10 },
    listContent: { padding: 16, paddingBottom: 100 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 10 },
    actualWrap: { marginLeft: 12 },
    actualInput: { width: 70, height: 44, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, fontFamily: 'FiraSans-Regular', fontSize: 16, textAlign: 'center' },
    submitBtn: { position: 'absolute', bottom: 24, left: 16, right: 16, height: 50, backgroundColor: config.THEME_COLOR, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    storeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 4,
    },
    storeIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: config.THEME_COLOR + '18',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalSearch: {
        height: 48,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        fontFamily: 'FiraSans-Regular',
        fontSize: 15,
    },
    modalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 4,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 10,
        height: 44,
    },
    uniqueCountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 6,
        marginBottom: 4,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        marginHorizontal: 8,
        fontFamily: 'FiraSans-Regular',
        fontSize: 14,
    },
    metaCard: {
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 4,
        borderRadius: 12,
        padding: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaInput: {
        flex: 1,
        marginLeft: 8,
        height: 44,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        fontFamily: 'FiraSans-Regular',
        fontSize: 14,
    },
    metaNotesInput: {
        height: 80,
        textAlignVertical: 'top',
        paddingVertical: 8,
    },
});

export default StockCount;
