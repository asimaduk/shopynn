import React, { useState, useRef } from 'react';
import {
    Dimensions,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    View,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
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
import { useSelector } from 'react-redux';
import { adjustments as adjustmentsApi, warehouses as warehousesApi, normalizeList } from '../../services/api';
import { getScreenPlanAccess, navigateToScreenOrUpgrade } from '../../utils/permissions';

const { height } = Dimensions.get('screen');

const NewAdjustments = ({ navigation, route }) => {
    const { colors } = useTheme();
    const currentUser = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const createWarehouseAccess = getScreenPlanAccess(currentUser, 'CreateWarehouse', subscriptionFeatures);
    const [stores, setStores] = useState([]);
    const [selectedStore, setSelectedStore] = useState(null);
    const [showStorePicker, setShowStorePicker] = useState(false);
    const [storeSearch, setStoreSearch] = useState('');

    const [showSetQuantity, setShowSetQuantity] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [adjustmentType, setAdjustmentType] = useState('addition'); // 'addition' or 'subtraction'
    const [orders, setOrders] = useState([]);

    const [showMenu, setShowMenu] = useState(false);
    const [reason, setReason] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [saving, setSaving] = useState(false);

    const filteredStores = stores.filter(
        (s) => !storeSearch.trim() || (s.name && s.name.toLowerCase().includes(storeSearch.toLowerCase()))
    );

    // Load stores (warehouses) from API when screen is focused
    useFocusEffect(
        React.useCallback(() => {
            let active = true;
            const loadStores = async () => {
                try {
                    const rawStores = await warehousesApi.list();
                    const list = normalizeList(rawStores) || [];
                    if (active) {
                        setStores(list);
                        if (!selectedStore && list.length > 0) {
                            setSelectedStore(list[0]);
                        }
                    }
                } catch (_) {
                    if (active) setStores([]);
                }
            };
            loadStores();
            return () => {
                active = false;
            };
        }, [selectedStore])
    );

    const handleSingleSelect = (product) => {
        const fnd = orders.find((o) => o.id === product.id || o.name === product.name);
        if (fnd) {
            setQuantity(String(fnd.order_quantity));
            setAdjustmentType(fnd.adjustment_type || 'addition');
            setOrders((prev) => {
                const rest = prev.filter((o) => (o.id || o.name) !== (product.id || product.name));
                return [fnd, ...rest];
            });
        } else {
            setQuantity('1');
            setAdjustmentType('addition');
            setOrders((prev) => [{ ...product, order_quantity: 1, adjustment_type: 'addition' }, ...prev]);
        }
        setSelectedProduct(product);
        setShowSetQuantity(true);
    };

    const handleMultiSelect = (records) => {
        const added = [];
        records.forEach((rec) => {
            const exists = orders.some((o) => (o.id || o.name) === (rec.id || rec.name));
            if (!exists) {
                added.push({ ...rec, order_quantity: 1, adjustment_type: 'addition' });
            }
        });
        if (added.length > 0) {
            setOrders((prev) => [...added, ...prev]);
            setSelectedProduct(added[0]);
            setQuantity('1');
            setAdjustmentType('addition');
            setShowSetQuantity(true);
        }
    };

    const backPress = () => navigation.goBack();

    const handleStoreClose = () => setShowStorePicker(false);

    const handleQuantityClose = () => setShowSetQuantity(false);
    const handleMenuClose = () => setShowMenu(false);

    const handleAddProduct = () => {
        const qty = Number(quantity) || 0;
        if (!selectedProduct || qty <= 0) return;
        const payload = { ...selectedProduct, order_quantity: qty, adjustment_type: adjustmentType };
        const fnd = orders.find((o) => (o.id || o.name) === (selectedProduct.id || selectedProduct.name));
        if (fnd) {
            setOrders((prev) => [
                payload,
                ...prev.filter((o) => (o.id || o.name) !== (selectedProduct.id || selectedProduct.name)),
            ]);
        } else {
            setOrders((prev) => [payload, ...prev]);
        }
        setShowSetQuantity(false);
    };

    const handleRemoveProduct = () => {
        Alert.alert('Remove item', `Remove "${selectedProduct?.name}" from this adjustment?`, [
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

    const handleSaveAdjustment = () => {
        if (orders.length === 0) {
            Alert.alert('Add items', 'Add at least one product to adjust.');
            return;
        }
        if (!selectedStore) {
            Alert.alert('Select store', 'Please select a store / warehouse.');
            return;
        }
        if (!reason.trim()) {
            Alert.alert('Reason required', 'Please provide a reason for this adjustment.');
            return;
        }
        Alert.alert(
            'Confirm adjustment',
            `Adjust ${orders.length} product(s) at ${selectedStore?.name}?\n\nReason: ${reason}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        setSaving(true);
                        try {
                            await adjustmentsApi.create({
                                warehouse_id: selectedStore?.id,
                                reference_number: referenceNumber?.trim() || undefined,
                                notes: reason.trim(),
                                products: orders.map((o) => ({
                                    id: o.id,
                                    quantity: Number(o.order_quantity) || 0,
                                    adjustment_type: o.adjustment_type || 'addition',
                                })),
                            });
                            Alert.alert('Success', 'Adjustment saved.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
                        } catch (err) {
                            const msg = err?.response?.data?.message || err?.message || 'Failed to save adjustment.';
                            Alert.alert('Error', msg);
                        } finally {
                            setSaving(false);
                        }
                    },
                },
            ]
        );
    };

    const totalItems = orders.reduce((s, c) => s + (c.order_quantity || 0), 0);
    const additions = orders.filter((o) => o.adjustment_type === 'addition').reduce((s, c) => s + (c.order_quantity || 0), 0);
    const subtractions = orders.filter((o) => o.adjustment_type === 'subtraction').reduce((s, c) => s + (c.order_quantity || 0), 0);

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={backPress} label="New Adjustment">
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() =>
                                navigation.navigate('Search', {
                                    source_nav: 'inventory',
                                    searchOnly: true,
                                    onSelect: (record) => handleSingleSelect(record),
                                    onMultiSelect: (records) => handleMultiSelect(records),
                                })
                            }
                            style={styles.headerBtn}>
                            <Lucide name="plus" color={config.THEME_COLOR} size={22} />
                        </TouchableOpacity>
                    </View>
                </ScreenHeader>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}>
                    {/* Store selection */}
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setShowStorePicker(true)}
                        style={[styles.storeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.storeIconWrap}>
                            <Lucide name="store" size={18} color={config.THEME_COLOR} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <AppText label="Store" fontSize={11} color={colors.textTertiary} />
                            <AppText label={selectedStore?.name || 'Select store'} variant={1} fontSize={14} numberOfLines={1} color={colors.text} />
                        </View>
                        <Lucide name="chevron-down" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>

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
                            {orders.map((item) => {
                                const isAddition = item.adjustment_type === 'addition';
                                const typeColor = isAddition ? (config.GREEN_COLOR || colors.success) : colors.error;
                                const typeBg = isAddition ? colors.successLight : colors.errorLight;
                                return (
                                    <TouchableOpacity
                                        key={(item.id || item.name).toString()}
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            setSelectedProduct(item);
                                            setShowMenu(true);
                                        }}
                                        style={[styles.listRow, { borderBottomColor: colors.border }]}>
                                        <View style={styles.listRowLeft}>
                                            <View style={[styles.typeBadge, { backgroundColor: typeBg }]}>
                                                <Lucide name={isAddition ? 'plus' : 'minus'} size={14} color={typeColor} />
                                            </View>
                                            <View style={styles.listRowInfo}>
                                                <AppText label={item.name} numberOfLines={2} style={{ flex: 1 }} color={colors.text} />
                                                <AppText
                                                    label={isAddition ? 'Stock added' : 'Stock removed'}
                                                    fontSize={11}
                                                    color={typeColor}
                                                />
                                            </View>
                                        </View>
                                        <View style={styles.qtyWrap}>
                                            <AppText label={`×${item.order_quantity}`} variant={1} fontSize={16} color={typeColor} />
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* Summary & Reason */}
                    {orders.length > 0 && (
                        <>
                            <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
                                <View style={styles.summaryRow}>
                                    <AppText label="Total items" color={colors.textSecondary} />
                                    <AppText label={totalItems} color={colors.text} />
                                </View>
                                <View style={styles.summaryRow}>
                                    <View style={styles.summaryLabelWrap}>
                                        <Lucide name="plus" size={14} color={config.GREEN_COLOR || colors.success} />
                                        <AppText label="Additions" color={colors.textSecondary} style={{ marginLeft: 6 }} />
                                    </View>
                                    <AppText label={additions} color={config.GREEN_COLOR || colors.success} />
                                </View>
                                <View style={styles.summaryRow}>
                                    <View style={styles.summaryLabelWrap}>
                                        <Lucide name="minus" size={14} color={colors.error} />
                                        <AppText label="Subtractions" color={colors.textSecondary} style={{ marginLeft: 6 }} />
                                    </View>
                                    <AppText label={subtractions} color={colors.error} />
                                </View>
                            </View>

                            <View style={[styles.referenceWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <View style={styles.reasonHeader}>
                                    <Lucide name="hash" size={18} color={colors.textTertiary} />
                                    <AppText label="Reference number" variant={1} fontSize={14} color={colors.text} style={{ marginLeft: 8 }} />
                                </View>
                                <TextInput
                                    placeholder="e.g., ADJ-001, Ref #12345"
                                    placeholderTextColor={colors.placeholder}
                                    value={referenceNumber}
                                    onChangeText={setReferenceNumber}
                                    style={[styles.referenceInput, { color: colors.text, borderColor: colors.border }]}
                                />
                            </View>

                            <View style={[styles.reasonWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <View style={styles.reasonHeader}>
                                    <Lucide name="message-square" size={18} color={colors.textTertiary} />
                                    <AppText label="Reason for adjustment" variant={1} fontSize={14} color={colors.text} style={{ marginLeft: 8 }} />
                                    <AppText label=" *" color={colors.error} />
                                </View>
                                <TextInput
                                    placeholder="e.g., Damaged goods, Inventory count correction, Returned items..."
                                    placeholderTextColor={colors.placeholder}
                                    value={reason}
                                    onChangeText={setReason}
                                    style={[styles.reasonInput, { color: colors.text }]}
                                    multiline
                                />
                            </View>
                        </>
                    )}

                    {/* Proceed */}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSaveAdjustment}
                        disabled={orders.length === 0 || !reason.trim()}
                        style={[styles.proceedBtn, (orders.length === 0 || !reason.trim()) && styles.proceedBtnDisabled]}>
                        <Lucide name="save" color={colors.textInverse} size={20} />
                        <AppText label="Save adjustment" color={colors.textInverse} variant={1} fontSize={16} style={{ marginLeft: 10 }} />
                    </TouchableOpacity>
                </ScrollView>

                {/* Store picker */}
                <AppModal
                    title="Select store"
                    handleClose={handleStoreClose}
                    onRequestClose={handleStoreClose}
                    visible={showStorePicker}>
                    <View style={styles.modalContent}>
                        <TextInput
                            placeholder="Search stores..."
                            placeholderTextColor={colors.placeholder}
                            value={storeSearch}
                            onChangeText={setStoreSearch}
                            style={[styles.modalSearch, { borderColor: colors.inputBorder || colors.border, color: colors.text }]}
                        />
                        {createWarehouseAccess.show ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, marginBottom: 4 }}>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        setShowStorePicker(false);
                                        navigateToScreenOrUpgrade(
                                            navigation,
                                            currentUser,
                                            'CreateWarehouse',
                                            subscriptionFeatures,
                                        );
                                    }}
                                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6 }}>
                                    <Lucide name="circle-plus" size={18} color={config.THEME_COLOR} />
                                    <AppText label="Add store" fontSize={13} color={config.THEME_COLOR} style={{ marginLeft: 6 }} />
                                    {createWarehouseAccess.locked ? (
                                        <Lucide name="lock" size={14} color={colors.textTertiary} style={{ marginLeft: 6 }} />
                                    ) : null}
                                </TouchableOpacity>
                            </View>
                        ) : null}
                        <View style={[styles.modalListWrap, { height: Math.min(height * 0.45, 320), marginTop: 10 }]}>
                            <FlashList
                                keyboardShouldPersistTaps="handled"
                                data={filteredStores}
                                keyExtractor={(item, idx) => item.id || item.name || String(idx)}
                                estimatedItemSize={48}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            setSelectedStore(item);
                                            setShowStorePicker(false);
                                            setStoreSearch('');
                                        }}
                                        style={[styles.modalRow, { borderBottomColor: colors.borderLight || colors.border }]}>
                                        <Lucide name="store" size={18} color={colors.textTertiary} />
                                        <AppText label={item.name} style={{ flex: 1, marginLeft: 12 }} color={colors.text} />
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                </AppModal>

                {/* Quantity & Type modal */}
                <AppModal
                    title="Adjust quantity"
                    handleClose={handleQuantityClose}
                    onRequestClose={handleQuantityClose}
                    visible={showSetQuantity}>
                    <View style={styles.modalContent}>
                        {selectedProduct && (
                            <AppText label={selectedProduct.name} variant={1} color={colors.text} style={{ marginBottom: 12 }} />
                        )}

                        {/* Adjustment type selector */}
                        <View style={styles.typeSelector}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => setAdjustmentType('addition')}
                                style={[
                                    styles.typeOption,
                                    adjustmentType === 'addition' && styles.typeOptionActive,
                                    adjustmentType === 'addition' && { backgroundColor: colors.successLight },
                                ]}>
                                <Lucide name="plus" size={20} color={adjustmentType === 'addition' ? (config.GREEN_COLOR || colors.success) : colors.textTertiary} />
                                <AppText
                                    label="Add stock"
                                    variant={adjustmentType === 'addition' ? 1 : 2}
                                    fontSize={14}
                                    color={adjustmentType === 'addition' ? (config.GREEN_COLOR || colors.success) : colors.textSecondary}
                                    style={{ marginLeft: 8 }}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => setAdjustmentType('subtraction')}
                                style={[
                                    styles.typeOption,
                                    adjustmentType === 'subtraction' && styles.typeOptionActive,
                                    adjustmentType === 'subtraction' && { backgroundColor: colors.errorLight },
                                ]}>
                                <Lucide name="minus" size={20} color={adjustmentType === 'subtraction' ? colors.error : colors.textTertiary} />
                                <AppText
                                    label="Remove stock"
                                    variant={adjustmentType === 'subtraction' ? 1 : 2}
                                    fontSize={14}
                                    color={adjustmentType === 'subtraction' ? colors.error : colors.textSecondary}
                                    style={{ marginLeft: 8 }}
                                />
                            </TouchableOpacity>
                        </View>

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
                <AppModal
                    title={selectedProduct?.name || 'Item'}
                    handleClose={handleMenuClose}
                    onRequestClose={handleMenuClose}
                    visible={showMenu}>
                    <View style={styles.menuContent}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => {
                                setQuantity(String(selectedProduct?.order_quantity || 1));
                                setAdjustmentType(selectedProduct?.adjustment_type || 'addition');
                                setShowMenu(false);
                                setTimeout(() => setShowSetQuantity(true), 300);
                            }}
                            style={styles.menuRow}>
                            <Lucide name="pencil" color={colors.text} size={20} />
                            <AppText label="Edit quantity & type" variant={1} color={colors.text} style={{ marginLeft: 12 }} />
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
    storeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
    },
    storeIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: config.THEME_COLOR + '18',
        justifyContent: 'center',
        alignItems: 'center',
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
        marginBottom: 20
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
    typeBadge: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    listRowInfo: { flex: 1 },
    qtyWrap: { alignItems: 'flex-end' },
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
    summaryLabelWrap: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    referenceWrap: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    referenceInput: {
        height: 48,
        fontFamily: 'FiraSans-Regular',
        fontSize: 15,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    reasonWrap: {
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
    reasonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    reasonInput: {
        flex: 1,
        fontFamily: 'FiraSans-Regular',
        fontSize: 15,
        color: '#1e293b',
        padding: 12,
        minHeight: 100,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        textAlignVertical: 'top',
    },
    proceedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 54,
        backgroundColor: config.THEME_COLOR,
        borderRadius: 14,
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
    typeSelector: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    typeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    typeOptionActive: {
        borderColor: config.THEME_COLOR,
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

export default NewAdjustments;
