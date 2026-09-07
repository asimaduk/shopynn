import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    StyleSheet,
    TouchableOpacity,
    View,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import { FlashList } from '@shopify/flash-list';
import useTheme from '../../hooks/useTheme';
import { transfers as transfersApi, warehouses as warehousesApi, normalizeList } from '../../services/api';

const { width, height } = Dimensions.get('screen');

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});

const formatCurrency = (val) => formatter.format(Number(val)).replace('GH₵', '').trim();

const warehouseKey = (w) => (w?.id != null ? String(w.id) : w?.name != null ? String(w.name) : '');
const sameWarehouse = (a, b) => {
    if (!a || !b) return false;
    const ka = warehouseKey(a);
    const kb = warehouseKey(b);
    return ka !== '' && ka === kb;
};

const NewTransfer = ({ navigation, route }) => {
    const { colors } = useTheme();
    const [warehouses, setWarehouses] = useState([]);
    const [sourceWarehouse, setSourceWarehouse] = useState(null);
    const [destinationWarehouse, setDestinationWarehouse] = useState(null);
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [showDestinationPicker, setShowDestinationPicker] = useState(false);

    const [sourceSearch, setSourceSearch] = useState('');
    const [destinationSearch, setDestinationSearch] = useState('');

    const [showSetQuantity, setShowSetQuantity] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [orders, setOrders] = useState([]);

    const [showMenu, setShowMenu] = useState(false);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const filteredSource = warehouses.filter((w) => {
        if (sameWarehouse(w, destinationWarehouse)) return false;
        return !sourceSearch.trim() || (w.name && w.name.toLowerCase().includes(sourceSearch.toLowerCase()));
    });
    const filteredDestination = warehouses.filter((w) => {
        if (sameWarehouse(w, sourceWarehouse)) return false;
        return !destinationSearch.trim() || (w.name && w.name.toLowerCase().includes(destinationSearch.toLowerCase()));
    });
    const warehousesConflict = sameWarehouse(sourceWarehouse, destinationWarehouse);

    // Load warehouses from API when screen is focused
    useFocusEffect(
        React.useCallback(() => {
            let active = true;
            const loadWarehouses = async () => {
                try {
                    const raw = await warehousesApi.list();
                    const list = normalizeList(raw) || [];
                    if (active) {
                        setWarehouses(list);
                        if (!sourceWarehouse && list.length > 0) {
                            setSourceWarehouse(list[0]);
                        }
                        if (!destinationWarehouse && list.length > 1) {
                            const src = sourceWarehouse || list[0];
                            const other = list.find((w) => !sameWarehouse(w, src));
                            if (other) setDestinationWarehouse(other);
                        }
                    }
                } catch (_) {
                    if (active) setWarehouses([]);
                }
            };
            loadWarehouses();
            return () => {
                active = false;
            };
        }, [sourceWarehouse, destinationWarehouse])
    );

    useEffect(() => {
        const product = route.params?.selectedProduct;
        if (!product) return;
        setSelectedProduct(product);
        setOrders((prev) => {
            const fnd = prev.find((o) => (o.id || o.name) === (product.id || product.name));
            if (fnd) {
                setQuantity(String(fnd.order_quantity));
                const rest = prev.filter((o) => (o.id || o.name) !== (product.id || product.name));
                return [fnd, ...rest];
            }
            setQuantity('1');
            return [{ ...product, order_quantity: 1 }, ...prev];
        });
        setShowSetQuantity(true);
    }, [route.params?.selectedProduct]);

    const backPress = () => navigation.goBack();

    const handleSourceClose = () => setShowSourcePicker(false);
    const handleDestinationClose = () => setShowDestinationPicker(false);
    const handleQuantityClose = () => setShowSetQuantity(false);
    const handleMenuClose = () => setShowMenu(false);

    const handleAddProduct = () => {
        const qty = Number(quantity) || 0;
        if (!selectedProduct || qty <= 0) return;
        const fnd = orders.find((o) => (o.id || o.name) === (selectedProduct.id || selectedProduct.name));
        const payload = { ...selectedProduct, order_quantity: qty };
        if (fnd) {
            setOrders((prev) => [payload, ...prev.filter((o) => (o.id || o.name) !== (selectedProduct.id || selectedProduct.name))]);
        } else {
            setOrders((prev) => [payload, ...prev]);
        }
        setShowSetQuantity(false);
    };

    const handleRemoveProduct = () => {
        Alert.alert('Remove item', `Remove "${selectedProduct?.name}" from this transfer?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                    setOrders((prev) => prev.filter((o) => (o.id || o.name) !== (selectedProduct?.id || selectedProduct?.name)));
                    setShowMenu(false);
                },
            },
        ]);
    };

    const handleMultiSelect = (records) => {
        const added = [];
        records.forEach((rec) => {
            const exists = orders.some((o) => (o.id || o.name) === (rec.id || rec.name));
            if (!exists) added.push({ ...rec, order_quantity: 1 });
        });
        if (added.length > 0) {
            setOrders((prev) => [...added, ...prev]);
            setSelectedProduct(added[0]);
            setQuantity('1');
            setShowSetQuantity(true);
        }
    };

    const handleSaveTransfer = () => {
        if (!sourceWarehouse || !destinationWarehouse) {
            Alert.alert('Select warehouses', 'Please select both From and To warehouses.');
            return;
        }
        if (sameWarehouse(sourceWarehouse, destinationWarehouse)) {
            Alert.alert('Invalid warehouses', 'From and To must be different warehouses.');
            return;
        }
        if (orders.length === 0) {
            Alert.alert('Add items', 'Add at least one product to transfer.');
            return;
        }
        Alert.alert(
            'Confirm transfer',
            `Transfer ${orders.reduce((s, o) => s + (o.order_quantity || 0), 0)} item(s) from ${sourceWarehouse?.name} to ${destinationWarehouse?.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        setSaving(true);
                        try {
                            await transfersApi.create({
                                source_warehouse_id: sourceWarehouse?.id,
                                destination_warehouse_id: destinationWarehouse?.id,
                                products: orders.map((o) => ({ id: o.id, quantity: Number(o.order_quantity) || 0 })),
                                notes: notes?.trim() || undefined,
                            });
                            Alert.alert('Success', 'Transfer saved.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
                        } catch (err) {
                            const msg = err?.response?.data?.message || err?.message || 'Failed to save transfer.';
                            Alert.alert('Error', msg);
                        } finally {
                            setSaving(false);
                        }
                    },
                },
            ]
        );
    };

    const subtotal = orders.reduce((s, c) => s + (c.order_quantity || 0) * (c.unit_price || 0), 0);
    const itemCount = orders.reduce((s, c) => s + (c.order_quantity || 0), 0);

    const pickWarehouse = (item, isSource) => {
        if (isSource) {
            if (sameWarehouse(item, destinationWarehouse)) {
                Alert.alert('Invalid warehouse', 'From and To must be different. Choose another source warehouse.');
                return;
            }
            setSourceWarehouse(item);
            setShowSourcePicker(false);
            return;
        }
        if (sameWarehouse(item, sourceWarehouse)) {
            Alert.alert('Invalid warehouse', 'From and To must be different. Choose another destination warehouse.');
            return;
        }
        setDestinationWarehouse(item);
        setShowDestinationPicker(false);
    };

    const handleSingleSelect = (__product)=> {
        const fnd = orders.find(o=> o.name == __product.name)
        if(fnd) {                
            setQuantity(`${fnd.order_quantity}`);
            const lst = orders.filter(o=> o.name != __product.name)
            setOrders([fnd, ...lst])                
        }
        else {
            const tmp = {...__product, order_quantity: 1} 
            setQuantity('1')                       
            setOrders([tmp, ...orders])
        }

        setSelectedProduct(__product);
        setShowSetQuantity(true);
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader onPress={backPress} label="New Transfer">
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() =>
                                navigation.navigate('Search', {
                                    source_nav: 'inventory',
                                    searchOnly: true,
                                    onSelect:(record)=> handleSingleSelect(record), 
                                    onMultiSelect:(records)=> handleMultiSelect(records)
                                })
                            }
                            style={[styles.headerBtn, { backgroundColor: colors.surface }]}>
                            <Lucide name="plus" color={config.THEME_COLOR} size={22} />
                        </TouchableOpacity>
                    </View>
                </ScreenHeader>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}>
                    {/* From / To */}
                    <View style={[styles.warehouseCard, { backgroundColor: colors.surface }]}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowSourcePicker(true)}
                            style={[styles.warehouseRow, { backgroundColor: colors.surfaceSecondary }]}>
                            <View style={[styles.warehouseIconWrap, { backgroundColor: colors.primaryShade }]}>
                                <Lucide name="warehouse" size={20} color={config.THEME_COLOR} />
                            </View>
                            <View style={styles.warehouseTextWrap}>
                                <AppText label="From" fontSize={12} color={colors.textSecondary} />
                                <AppText label={sourceWarehouse?.name || 'Select warehouse'} variant={1} fontSize={15} color={colors.text} />
                            </View>
                            <Lucide name="chevron-down" color={colors.textTertiary} size={20} />
                        </TouchableOpacity>

                        <View style={styles.arrowWrap}>
                            <Lucide name="arrow-down" color={config.THEME_COLOR} size={22} />
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowDestinationPicker(true)}
                            style={[styles.warehouseRow, styles.warehouseRowLast, { backgroundColor: colors.surfaceSecondary }]}>
                            <View style={[styles.warehouseIconWrap, { backgroundColor: colors.primaryShade }]}>
                                <Lucide name="map-pin" size={20} color={config.THEME_COLOR} />
                            </View>
                            <View style={styles.warehouseTextWrap}>
                                <AppText label="To" fontSize={12} color={colors.textSecondary} />
                                <AppText label={destinationWarehouse?.name || 'Select warehouse'} variant={1} fontSize={15} color={colors.text} />
                            </View>
                            <Lucide name="chevron-down" color={colors.textTertiary} size={20} />
                        </TouchableOpacity>
                        {warehousesConflict ? (
                            <AppText
                                label="From and To must be different warehouses."
                                fontSize={12}
                                color={colors.error}
                                style={{ marginTop: 10 }}
                            />
                        ) : null}
                    </View>

                    {/* Items section */}
                    <View style={styles.itemsHeader}>
                        <AppText label="Items" variant={1} fontSize={15} color={colors.text} />
                        <AppText label={`${orders.length} product(s)`} fontSize={13} color={colors.textSecondary} />
                    </View>

                    {orders.length === 0 ? (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() =>
                                navigation.navigate('Search', {
                                    source_nav: 'inventory',
                                    searchOnly: true,
                                    onMultiSelect: handleMultiSelect,
                                })
                            }
                            style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={[styles.emptyIconWrap, { backgroundColor: colors.inputBackground }]}>
                                <Lucide name="package-plus" size={40} color={colors.border} />
                            </View>
                            <AppText label="No items added" variant={1} fontSize={16} color={colors.textSecondary} />
                            <AppText label="Tap to add products" fontSize={14} color={colors.textTertiary} style={{ marginTop: 4 }} />
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.listCard, { backgroundColor: colors.surface }]}>
                            {orders.map((item) => (
                                <TouchableOpacity
                                    key={(item.id || item.name || item).toString()}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        setSelectedProduct(item);
                                        setShowMenu(true);
                                    }}
                                    style={[styles.listRow, { borderBottomColor: colors.border }]}>
                                    <View style={styles.listRowLeft}>
                                        <View style={styles.qtyBadge}>
                                            <AppText label={`×${item.order_quantity}`} fontSize={12} color={colors.textInverse} />
                                        </View>
                                        <View style={styles.listRowInfo}>
                                            <AppText label={item.name} numberOfLines={2} style={{ flex: 1 }} color={colors.text} />
                                            <AppText
                                                label={`GHS ${(item.unit_price || 0)} each`}
                                                fontSize={11}
                                                color={colors.textSecondary}
                                            />
                                        </View>
                                    </View>
                                    <AppText
                                        label={formatCurrency((item.order_quantity || 0) * (item.unit_price || 0))}
                                        variant={1}
                                        fontSize={14}
                                        color={colors.text}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Summary & Notes */}
                    {orders.length > 0 && (
                        <>
                            <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
                                <View style={styles.summaryRow}>
                                    <AppText label="Subtotal" color={colors.textSecondary} />
                                    <AppText label={formatCurrency(subtotal)} color={colors.text} />
                                </View>
                                <View style={styles.summaryRow}>
                                    <AppText label="Items" color={colors.textSecondary} />
                                    <AppText label={itemCount} color={colors.text} />
                                </View>
                                <View style={[styles.summaryRow, styles.summaryTotal, { borderTopColor: colors.border }]}>
                                    <AppText label="Total" variant={1} fontSize={16} color={colors.text} />
                                    <AppText label={formatCurrency(subtotal)} variant={1} fontSize={16} color={colors.text} />
                                </View>
                            </View>

                            <View style={[styles.notesWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <Lucide name="message-square" size={18} color={colors.textTertiary} style={{ marginRight: 10 }} />
                                <TextInput
                                    placeholder="Notes (optional)"
                                    placeholderTextColor={colors.placeholder}
                                    value={notes}
                                    onChangeText={setNotes}
                                    style={[styles.notesInput, { color: colors.text }]}
                                    multiline
                                />
                            </View>
                        </>
                    )}

                    {/* Proceed */}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSaveTransfer}
                        disabled={orders.length === 0 || !sourceWarehouse || !destinationWarehouse || warehousesConflict}
                        style={[
                            styles.proceedBtn,
                            (orders.length === 0 || !sourceWarehouse || !destinationWarehouse || warehousesConflict) &&
                                styles.proceedBtnDisabled,
                        ]}>
                        <Lucide name="send" color={colors.textInverse} size={20} />
                        <AppText label="Confirm transfer" color={colors.textInverse} variant={1} fontSize={16} style={{ marginLeft: 10 }} />
                    </TouchableOpacity>
                </ScrollView>

                {/* Source warehouse picker */}
                <AppModal
                    title="From warehouse"
                    handleClose={handleSourceClose}
                    onRequestClose={handleSourceClose}
                    visible={showSourcePicker}>
                    <View style={styles.modalContent}>
                        <TextInput
                            placeholder="Search warehouses..."
                            placeholderTextColor={colors.placeholder}
                            value={sourceSearch}
                            onChangeText={setSourceSearch}
                            style={[styles.modalSearch, { color: colors.text, borderColor: colors.border }]}
                        />
                        <View style={styles.modalListWrap}>
                            <FlashList
                                data={filteredSource}
                                estimatedItemSize={52}
                                keyExtractor={(item) => (item.id || item.name).toString()}
                                keyboardShouldPersistTaps="handled"
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => pickWarehouse(item, true)}
                                        style={[styles.modalRow, { borderBottomColor: colors.border }]}>
                                        <Lucide
                                            name="check"
                                            size={18}
                                            color={sourceWarehouse?.id === item.id ? config.THEME_COLOR : 'transparent'}
                                            style={{ marginRight: 12 }}
                                        />
                                        <AppText label={item.name} style={{ flex: 1 }} color={colors.text} />
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                </AppModal>

                {/* Destination warehouse picker */}
                <AppModal
                    title="To warehouse"
                    handleClose={handleDestinationClose}
                    onRequestClose={handleDestinationClose}
                    visible={showDestinationPicker}>
                    <View style={styles.modalContent}>
                        <TextInput
                            placeholder="Search warehouses..."
                            placeholderTextColor={colors.placeholder}
                            value={destinationSearch}
                            onChangeText={setDestinationSearch}
                            style={[styles.modalSearch, { color: colors.text, borderColor: colors.border }]}
                        />
                        <View style={styles.modalListWrap}>
                            <FlashList
                                data={filteredDestination}
                                estimatedItemSize={52}
                                keyExtractor={(item) => (item.id || item.name).toString()}
                                keyboardShouldPersistTaps="handled"
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => pickWarehouse(item, false)}
                                        style={[styles.modalRow, { borderBottomColor: colors.border }]}>
                                        <Lucide
                                            name="check"
                                            size={18}
                                            color={destinationWarehouse?.id === item.id ? config.THEME_COLOR : 'transparent'}
                                            style={{ marginRight: 12 }}
                                        />
                                        <AppText label={item.name} style={{ flex: 1 }} color={colors.text} />
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                </AppModal>

                {/* Quantity modal */}
                <AppModal title="Enter quantity" handleClose={handleQuantityClose} onRequestClose={handleQuantityClose} visible={showSetQuantity}>
                    <View style={styles.modalContent}>
                        {selectedProduct && (
                            <AppText label={selectedProduct.name} variant={1} color={colors.text} style={{ marginBottom: 12 }} />
                        )}
                        <TextInput
                            value={quantity}
                            placeholder="Quantity"
                            placeholderTextColor={colors.placeholder}
                            keyboardType="number-pad"
                            style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
                            onChangeText={setQuantity}
                        />
                        <TouchableOpacity
                            activeOpacity={0.8}
                            disabled={!quantity || Number(quantity) <= 0}
                            onPress={handleAddProduct}
                            style={[
                                styles.modalSubmitBtn,
                                (!quantity || Number(quantity) <= 0) && styles.modalSubmitBtnDisabled,
                            ]}>
                            <AppText label="Add" color={colors.textInverse} variant={1} />
                        </TouchableOpacity>
                    </View>
                </AppModal>

                {/* Item menu */}
                <AppModal title={selectedProduct?.name || 'Item'} handleClose={handleMenuClose} onRequestClose={handleMenuClose} visible={showMenu}>
                    <View style={styles.menuContent}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => {
                                setQuantity(String(selectedProduct?.order_quantity || 1));
                                setShowMenu(false);
                                setTimeout(() => setShowSetQuantity(true), 300);
                            }}
                            style={styles.menuRow}>
                            <Lucide name="pencil" color={colors.text} size={20} />
                            <AppText label="Edit quantity" variant={1} color={colors.text} style={{ marginLeft: 12 }} />
                        </TouchableOpacity>
                        <TouchableOpacity activeOpacity={0.7} onPress={handleRemoveProduct} style={styles.menuRow}>
                            <Lucide name="trash-2" color={colors.error} size={20} />
                            <AppText label="Remove" variant={1} color={colors.error} style={{ marginLeft: 12 }} />
                        </TouchableOpacity>
                    </View>
                </AppModal>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: '#f8fafc' },
    scrollView: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
    headerActions: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    headerBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginLeft: 10,
    },
    warehouseCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    warehouseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
    },
    warehouseRowLast: { marginTop: 8 },
    warehouseIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    warehouseTextWrap: { flex: 1 },
    arrowWrap: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    itemsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    emptyState: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#e2e8f0',
    },
    emptyIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    listCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    listRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    listRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    qtyBadge: {
        backgroundColor: config.THEME_COLOR,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 12,
    },
    listRowInfo: { flex: 1 },
    summaryCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    summaryTotal: {
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        marginTop: 8,
        paddingTop: 12,
    },
    notesWrap: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    notesInput: {
        flex: 1,
        fontFamily: 'FiraSans-Regular',
        fontSize: 15,
        color: '#1e293b',
        padding: 0,
        minHeight: 40,
    },
    proceedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 54,
        backgroundColor: config.THEME_COLOR,
        borderRadius: 14,
        marginTop: 20
    },
    proceedBtnDisabled: { opacity: 0.5 },
    modalContent: { padding: 16, paddingBottom: 24 },
    modalSearch: {
        height: 48,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 14,
        fontFamily: 'FiraSans-Regular',
        fontSize: 15,
        marginBottom: 12,
    },
    modalListWrap: { height: Math.min(300, height * 0.4) },
    modalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalInput: {
        height: 52,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 14,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
        marginBottom: 16,
    },
    modalSubmitBtn: {
        height: 52,
        backgroundColor: config.THEME_COLOR,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalSubmitBtnDisabled: { opacity: 0.5 },
    menuContent: { padding: 12, paddingBottom: 20 },
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
    },
});

export default NewTransfer;
