import React, { useEffect, useState, useRef } from 'react';
import { Dimensions, StyleSheet, TouchableOpacity, ScrollView, View, TextInput, KeyboardAvoidingView, Platform, Image, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import { formatPurchaseReceipt } from '../../utils/receipt';
import { incrementInvoiceNext } from '../../store/actions/appSettings';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import { FlashList } from '@shopify/flash-list';
import { launchCamera } from 'react-native-image-picker';
import useTheme from '../../hooks/useTheme';
import { purchases as purchasesApi, warehouses as warehousesApi, suppliers as suppliersApi, normalizeList } from '../../services/api';

const { width, height } = Dimensions.get('screen');

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});
const formatCurrency = (value) => formatter.format(Number(value)).replace('GH₵', '').trim();

const NewPurchase = ({ navigation, route }) => {
    const { colors } = useTheme();
    const dispatch = useDispatch();
    const appSettings = useSelector((s) => s.appSettings) || {};
    const [stores, setStores] = useState([]);
    const [selectedStore, setSelectedStore] = useState(null);
    const [showStores, setShowStores] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [showSuppliers, setShowSuppliers] = useState(false);

    const [storeSearch, setStoreSearch] = useState('');
    const [supplierSearch, setSupplierSearch] = useState('');
    const [showSetQuantity, setShowSetQuantity] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [orders, setOrders] = useState([]);
    const [discountAmount, setDiscountAmount] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');

    const [showMenu, setShowMenu] = useState(false);
    const [showHeldItems, setShowHeldItems] = useState(false);
    const [heldItems, setHeldItems] = useState([{ name: 'Ama Ghana' }, { name: 'Collins Effa' }, { name: 'Ezekiel Vvc' }]);
    const [heldSearch, setHeldSearch] = useState('');

    const [images, setImages] = useState([]);
    const [showPaymentOptions, setShowPaymentOptions] = useState(false);
    const [selectedPaymentOption, setSelectedPaymentOption] = useState({ method: 'cash', balance: '', momoNumber: '' });
    const paymentOptionsScrollRef = useRef(null);

    const filteredStores = stores.filter((s) =>
        !storeSearch.trim() || (s.name && s.name.toLowerCase().includes(storeSearch.toLowerCase()))
    );
    const filteredSuppliers = suppliers.filter((s) =>
        !supplierSearch.trim() || (s.name && s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
    );
    const filteredHeldItems = heldItems.filter((h) =>
        !heldSearch.trim() || (h.name && h.name.toLowerCase().includes(heldSearch.toLowerCase()))
    );

    useEffect(() => {
        const product = route.params?.selectedProduct;
        if (!product) return;
        setSelectedProduct(product);
        setQuantity('1');
        setOrders((prev) => {
            const fnd = prev.find((o) => o.id === product.id || o.name === product.name);
            if (fnd) {
                setQuantity(String(fnd.order_quantity));
                const rest = prev.filter((o) => o.id !== product.id && o.name !== product.name);
                return [fnd, ...rest];
            }
            return [{ ...product, order_quantity: 1 }, ...prev];
        });
        setShowSetQuantity(true);
    }, [route.params?.selectedProduct]);

    const backPress = () => {
        navigation.goBack();
    }

    const handleOpenCamera = async () => {
        try {
            const result = await launchCamera({ mediaType: 'photo', maxHeight: 400, maxWidth: 400, quality: 0.7, cameraType: 'back' });
            if (result?.assets?.length > 0) {
                setImages((prev) => [{ isLocal: true, ...result.assets[0] }, ...prev]);
            }
        } catch (_) {}
    };

    const handleStoreClose = () => setShowStores(false);
    const handleSupplierClose = () => setShowSuppliers(false);

    const handleQuantityClose = () => {
        setShowSetQuantity(false)
    }

    const handleAddProduct = () => {
        if (!selectedProduct) return;
        const qty = Math.max(1, parseInt(quantity, 10) || 1);
        setOrders((prev) => {
            const fnd = prev.find((o) => o.id === selectedProduct.id || o.name === selectedProduct.name);
            if (fnd) {
                const rest = prev.filter((o) => o.id !== selectedProduct.id && o.name !== selectedProduct.name);
                return [{ ...fnd, order_quantity: qty }, ...rest];
            }
            return [{ ...selectedProduct, order_quantity: qty }, ...prev];
        });
        setShowSetQuantity(false);
        setSelectedProduct(null);
    };

    const handleMenuClose = () => setShowMenu(false);

    const handleRemoveProduct = () => {
        if (!selectedProduct) return;
        Alert.alert('Remove item', `Remove "${selectedProduct.name}" from this purchase?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => {
                setOrders((prev) => prev.filter((o) => o.id !== selectedProduct.id && o.name !== selectedProduct.name));
                setShowMenu(false);
                setSelectedProduct(null);
            }},
        ]);
    };

    const handleHeldItemsClose = () => setShowHeldItems(false);
    const handlePaymentOptionsClose = () => setShowPaymentOptions(false);

    const handleSingleSelect = (record) => {
        if (!record) return;
        const existing = orders.find((o) => o.id == record.id || o.name === record.name);
        if (existing) {
            setSelectedProduct(existing);
            setQuantity(String(existing.order_quantity || 1));
            setShowSetQuantity(true);
            return;
        }
        setOrders((prev) => [{ ...record, order_quantity: 1 }, ...prev]);
        setSelectedProduct({ ...record, order_quantity: 1 });
        setQuantity('1');
        setShowSetQuantity(true);
    };

    const handleMultiSelect = (records) => {
        const added = records.filter((rec) => !orders.find((o) => o.id == rec.id));
        setOrders((prev) => {
            const next = [...prev];
            records.forEach((rec) => {
                if (!next.find((o) => o.id == rec.id)) next.push({ ...rec, order_quantity: 1 });
            });
            return next;
        });
        if (added.length > 0) {
            setSelectedProduct(added[0]);
            setQuantity('1');
            setShowSetQuantity(true);
        }
    };

    const [saving, setSaving] = useState(false);

    // Load stores (warehouses) and suppliers from API when screen is focused
    useFocusEffect(
        React.useCallback(() => {
            let active = true;

            // Clear supplier when opening a fresh purchase (from dashboard/purchases),
            // but keep it when returning from Search with an in-progress draft.
            const routes = navigation.getState()?.routes || [];
            const prevRouteName = routes[routes.length - 2]?.name;
            const returningFromProductPicker =
                prevRouteName === 'Search' || prevRouteName === 'BarcodeScanner';
            if (!returningFromProductPicker && !(orders?.length > 0)) {
                setSelectedSupplier(null);
            }

            const loadData = async () => {
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
                try {
                    const rawSuppliers = await suppliersApi.list();
                    const list = normalizeList(rawSuppliers) || [];
                    if (active) {
                        setSuppliers(list);
                        // Never auto-pick list[0] — user must choose a supplier.
                    }
                } catch (_) {
                    if (active) setSuppliers([]);
                }
            };
            loadData();
            return () => {
                active = false;
            };
        }, [selectedStore, orders?.length, navigation])
    );

    const handleSavePurchase = async () => {
        if (orders.length === 0) {
            Alert.alert('Add items', 'Add at least one product.');
            return;
        }
        else if (!selectedStore) {
            Alert.alert('Add store', 'Please select a store.');
            return;
        }
        else if (!selectedSupplier) {
            Alert.alert('Add supplier', 'Please select a supplier.');
            return;
        }
        else if (!invoiceNumber.trim()) {
            Alert.alert('Add invoice number', 'Please enter an invoice number.');
            return;
        }
        
        setSaving(true);
        try {
            await purchasesApi.create({
                warehouse_id: selectedStore?.id,
                supplier_id: selectedSupplier?.id,
                invoice_number: invoiceNumber.trim() || undefined,
                products: orders.map((o) => ({
                    id: o.id,
                    quantity: Number(o.order_quantity) || 0,
                    unit_price: Number(o.unit_price) || 0,
                })),
                discount: Math.max(0, Number(discountAmount) || 0),
            });
            Alert.alert('Success', 'Purchase saved.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to save purchase.';
            Alert.alert('Error', msg);
        } finally {
            setSaving(false);
        }
    };

    const lineTotal = (item) => {
        const q = Number(item.order_quantity) || 0;
        const u = Number(item.unit_price) || 0;
        const a = Number(item.alt_price) || u;
        return q < 10 ? q * u : q * a;
    };
    const subtotal = orders.reduce((sum, c) => sum + Number(c.order_quantity) * Number(c.unit_price), 0);
    const discount = Math.max(0, Number(discountAmount) || 0);
    const totalAmount = Math.max(0, orders.reduce((sum, c) => sum + lineTotal(c), 0) - discount);
    const totalItems = orders.reduce((sum, c) => sum + (Number(c.order_quantity) || 0), 0);

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={backPress} label="New Purchase">
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('Search', { source_nav: 'purchases', searchOnly: true, onMultiSelect: handleMultiSelect, onSelect: (record) => handleSingleSelect(record) })}
                        style={[styles.headerBtn, { backgroundColor: colors.surface, marginRight: 10 }]}>
                        <Lucide name="plus" color={config.THEME_COLOR} size={22} />
                    </TouchableOpacity>
                </ScreenHeader>

                <View style={styles.section}>
                    <View style={styles.sectionRow}>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => setShowStores(true)} style={[styles.storeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.storeIconWrap}>
                                <Lucide name="store" size={18} color={config.THEME_COLOR} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <AppText label="Store" fontSize={11} color={colors.textTertiary} />
                                <AppText label={selectedStore?.name || 'Select store'} variant={1} fontSize={14} numberOfLines={1} color={colors.text} />
                            </View>
                            <Lucide name="chevron-down" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => setShowSuppliers(true)} style={[styles.supplierCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.supplierIconWrap}>
                                <Lucide name="truck" size={18} color={config.THEME_COLOR} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <AppText label="Supplier" fontSize={11} color={colors.textTertiary} />
                                <AppText label={selectedSupplier?.name || 'Select supplier'} variant={2} fontSize={14} numberOfLines={1} color={colors.text} />
                            </View>
                            <Lucide name="chevron-down" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.invoiceNumberRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.storeIconWrap, { marginRight: 10 }]}>
                            <Lucide name="file-text" size={18} color={config.THEME_COLOR} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <AppText label="Invoice number" fontSize={11} color={colors.textTertiary} style={{ marginBottom: 4 }} />
                            <TextInput
                                placeholder="e.g. PO-1001 (optional)"
                                placeholderTextColor={colors.placeholder}
                                value={invoiceNumber}
                                onChangeText={setInvoiceNumber}
                                style={[styles.invoiceNumberInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.listHeader}>
                    <AppText label="Item" color={colors.textInverse} fontSize={14} />
                    <AppText label="Amount" color={colors.textInverse} fontSize={14} />
                </View>

                {orders.length === 0 ? (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('Search', { source_nav: 'purchases', searchOnly: true, onMultiSelect: handleMultiSelect })}
                        style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Lucide name="package" size={48} color={colors.border} />
                        <AppText label="No items yet" variant={1} fontSize={16} color={colors.textSecondary} style={{ marginTop: 12 }} />
                        <AppText label="Tap to add products" fontSize={14} color={colors.textTertiary} style={{ marginTop: 6 }} />
                    </TouchableOpacity>
                ) : (
                    <FlashList
                        data={orders}
                        keyExtractor={(item, index) => item.id || `${item.name}-${index}` || String(index)}
                        estimatedItemSize={64}
                        contentContainerStyle={styles.listContent}
                        style={styles.list}
                        renderItem={({ item }) => (
                            <View style={[styles.orderRow, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => { setSelectedProduct(item); setShowMenu(true); }}
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            setSelectedProduct(item);
                                            setQuantity(String(item.order_quantity));
                                            setShowSetQuantity(true);
                                        }}
                                        style={styles.qtyBadge}>
                                        <AppText label={`×${item.order_quantity}`} fontSize={13} color={config.THEME_COLOR} />
                                    </TouchableOpacity>
                                    <View style={{ flex: 1 }}>
                                        <AppText label={item.name} variant={2} numberOfLines={2} color={colors.text} />
                                        <AppText label={`GH₵ ${item.order_quantity < 10 ? item.unit_price : item.alt_price} each`} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                    </View>
                                </TouchableOpacity>
                                <View style={styles.orderRowRight}>
                                    <AppText label={formatCurrency(lineTotal(item))} variant={1} fontSize={15} color={config.THEME_COLOR} style={{ marginRight: 12 }} />
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            Alert.alert('Remove item', `Remove "${item.name}" from this purchase?`, [
                                                { text: 'Cancel', style: 'cancel' },
                                                { text: 'Remove', style: 'destructive', onPress: () => {
                                                    setOrders((prev) => prev.filter((o) => o.id !== item.id && o.name !== item.name));
                                                }},
                                            ]);
                                        }}
                                        style={[styles.deleteBtn, { backgroundColor: colors.errorLight }]}>
                                        <Lucide name="trash-2" size={18} color={colors.error} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    />
                )}

                <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.summaryRow}>
                        <AppText label="Subtotal" fontSize={14} color={colors.textSecondary} />
                        <AppText label={formatCurrency(subtotal)} fontSize={14} color={colors.text} />
                    </View>
                    <View style={styles.summaryRow}>
                        <AppText label="Discount (GH₵)" fontSize={14} color={colors.textSecondary} />
                        <TextInput
                            placeholder="0.00"
                            placeholderTextColor={colors.placeholder}
                            keyboardType="decimal-pad"
                            value={discountAmount}
                            onChangeText={setDiscountAmount}
                            style={[styles.discountInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                        />
                    </View>
                    <View style={styles.summaryRow}>
                        <AppText label="Items" fontSize={14} color={colors.textSecondary} />
                        <AppText label={String(totalItems)} fontSize={14} color={colors.text} />
                    </View>
                    <View style={[styles.summaryRow, styles.totalRow, { borderTopColor: colors.border }]}>
                        <AppText label="Total" variant={1} fontSize={16} color={colors.text} />
                        <AppText label={formatCurrency(totalAmount)} variant={1} fontSize={18} color={config.THEME_COLOR} />
                    </View>
                </View>

                <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={orders.length === 0}
                    onPress={() => {
                        if (orders.length === 0) return;
                        if (!selectedStore?.id) {
                            Alert.alert('Select store', 'Please select a store before proceeding.');
                            return;
                        }
                        if (!selectedSupplier?.id) {
                            Alert.alert('Select supplier', 'Please select a supplier before proceeding.');
                            return;
                        }
                        if (!invoiceNumber.trim()) {
                            Alert.alert('Add invoice number', 'Please enter an invoice number.');
                            return;
                        }
                        Alert.alert('Confirm', 'Receive / save this purchase order?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Yes', onPress: () => handleSavePurchase() },
                        ]);
                    }}
                    style={[styles.proceedBtn, orders.length === 0 && [styles.proceedBtnDisabled, { backgroundColor: colors.surfaceTertiary }]]}>
                    <AppText label="Proceed" variant={1} fontSize={16} color={colors.textInverse} />
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                        if (orders.length === 0) { backPress(); return; }
                        Alert.alert('Cancel purchase?', 'All items will be removed.', [
                            { text: 'Keep editing', style: 'cancel' },
                            { text: 'Cancel', style: 'destructive', onPress: () => { setOrders([]); setSelectedProduct(null); setDiscountAmount(''); backPress(); } },
                        ]);
                    }}
                    style={styles.cancelBtn}>
                    <Lucide name="x" size={18} color={colors.textSecondary} />
                    <AppText label="Cancel" fontSize={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                </TouchableOpacity>

                <AppModal title="Select store" handleClose={handleStoreClose} onRequestClose={handleStoreClose} visible={showStores}>
                    <View style={styles.modalContent}>
                        <TextInput placeholder="Search stores..." placeholderTextColor={colors.placeholder} value={storeSearch} onChangeText={setStoreSearch} style={[styles.modalSearch, { borderColor: colors.inputBorder, color: colors.text }]} />
                        <View style={styles.modalListWrap}>
                            <FlashList keyboardShouldPersistTaps="handled" data={filteredStores} keyExtractor={(item, idx) => item.id || item.name || String(idx)} estimatedItemSize={48} renderItem={({ item }) => (
                                <TouchableOpacity activeOpacity={0.7} onPress={() => { setSelectedStore(item); setShowStores(false); setStoreSearch(''); }} style={[styles.modalRow, { borderBottomColor: colors.borderLight }]}>
                                    <Lucide name="store" size={18} color={colors.textTertiary} />
                                    <AppText label={item.name} style={{ flex: 1, marginLeft: 12 }} color={colors.text} />
                                </TouchableOpacity>
                            )} />
                        </View>
                    </View>
                </AppModal>

                <AppModal title="Select" handleClose={handleSupplierClose} onRequestClose={handleSupplierClose} visible={showSuppliers}>
                    <View style={styles.modalContent}>
                        <TextInput placeholder="Search suppliers..." placeholderTextColor={colors.placeholder} value={supplierSearch} onChangeText={setSupplierSearch} style={[styles.modalSearch, { borderColor: colors.inputBorder, color: colors.text }]} />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                    setShowSuppliers(false);
                                    navigation.navigate('SupplierForm');
                                }}
                                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }}>
                                <Lucide name="circle-plus" size={18} color={config.THEME_COLOR} />
                                <AppText label="Add supplier" fontSize={13} color={config.THEME_COLOR} style={{ marginLeft: 6 }} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalListWrap}>
                            <FlashList keyboardShouldPersistTaps="handled" data={filteredSuppliers} keyExtractor={(item, idx) => item.id || item.name || String(idx)} estimatedItemSize={48} renderItem={({ item }) => (
                                <TouchableOpacity activeOpacity={0.7} onPress={() => { setSelectedSupplier(item); setShowSuppliers(false); setSupplierSearch(''); }} style={[styles.modalRow, { borderBottomColor: colors.borderLight }]}>
                                    <Lucide name="truck" size={18} color={colors.textTertiary} />
                                    <AppText label={item.name} style={{ flex: 1, marginLeft: 12 }} color={colors.text} />
                                </TouchableOpacity>
                            )} />
                        </View>
                    </View>
                </AppModal>

                <AppModal title="Enter quantity" handleClose={handleQuantityClose} onRequestClose={handleQuantityClose} visible={showSetQuantity}>
                    <View style={styles.modalContent}>
                        {selectedProduct && (
                            <>
                                <AppText label={selectedProduct.name} variant={1} fontSize={16} style={{ marginBottom: 8 }} color={colors.text} />
                                <AppText label={`GH₵ ${selectedProduct.order_quantity < 10 ? selectedProduct.unit_price : selectedProduct.alt_price} each`} fontSize={13} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                                <TextInput value={quantity} placeholder="Quantity" placeholderTextColor={colors.placeholder} keyboardType="number-pad" onChangeText={setQuantity} style={[styles.quantityInput, { borderColor: colors.inputBorder, color: colors.text }]} />
                                <TouchableOpacity activeOpacity={0.8} disabled={!quantity || Number(quantity) < 1} onPress={handleAddProduct} style={[styles.addQtyBtn, (!quantity || Number(quantity) < 1) && [styles.addQtyBtnDisabled, { backgroundColor: colors.surfaceTertiary }]]}>
                                    <AppText label={orders.find((o) => o.id === selectedProduct.id || o.name === selectedProduct.name) ? "Update quantity" : "Add to purchase"} color={colors.textInverse} variant={1} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </AppModal>

                <AppModal title={selectedProduct?.name || 'Item'} handleClose={handleMenuClose} onRequestClose={handleMenuClose} visible={showMenu}>
                    <View style={[styles.menuModalContent, { backgroundColor: colors.surface }]}>
                        {selectedProduct && (
                            <>
                                <TouchableOpacity activeOpacity={0.7} onPress={() => { setQuantity(String(selectedProduct.order_quantity)); setShowMenu(false); setTimeout(() => setShowSetQuantity(true), 300); }} style={styles.menuOption}>
                                    <Lucide name="pencil" color={config.THEME_COLOR} size={20} />
                                    <AppText label="Change quantity" variant={2} fontSize={16} style={{ marginLeft: 12 }} color={colors.text} />
                                </TouchableOpacity>
                                <TouchableOpacity activeOpacity={0.7} onPress={handleRemoveProduct} style={styles.menuOption}>
                                    <Lucide name="trash-2" color={colors.error} size={20} />
                                    <AppText label="Remove from purchase" variant={2} fontSize={16} style={{ marginLeft: 12 }} color={colors.error} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </AppModal>

                <AppModal title="Held purchases" handleClose={handleHeldItemsClose} onRequestClose={handleHeldItemsClose} visible={showHeldItems}>
                    <View style={styles.modalContent}>
                        <TextInput placeholder="Search held..." placeholderTextColor={colors.placeholder} value={heldSearch} onChangeText={setHeldSearch} style={[styles.modalSearch, { borderColor: colors.inputBorder, color: colors.text }]} />
                        <View style={styles.modalListWrap}>
                            <FlashList keyboardShouldPersistTaps="handled" data={filteredHeldItems} keyExtractor={(item, idx) => item.id || item.name || String(idx)} estimatedItemSize={64} renderItem={({ item }) => (
                                <TouchableOpacity activeOpacity={0.7} style={[styles.heldRow, { borderBottomColor: colors.borderLight }]}>
                                    <Image source={item.thumbnail ? { uri: config.BASE_API + '/images?id=' + item.thumbnail } : require('../../assets/images/dp.png')} style={styles.heldThumb} />
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <AppText label={item.name} variant={1} color={colors.text} />
                                        <AppText label="Held purchase" fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                    </View>
                                    <Lucide name="chevron-right" size={20} color={colors.textTertiary} />
                                </TouchableOpacity>
                            )} />
                        </View>
                    </View>
                </AppModal>

                <AppModal title="Payment" handleClose={handlePaymentOptionsClose} onRequestClose={handlePaymentOptionsClose} visible={showPaymentOptions}>
                    <View style={styles.paymentModalContent}>
                        <ScrollView keyboardShouldPersistTaps="handled" horizontal pagingEnabled ref={paymentOptionsScrollRef} showsHorizontalScrollIndicator={false}>
                            <View style={[styles.paymentSlide, { width }]}>
                                <TouchableOpacity activeOpacity={0.7} onPress={() => setSelectedPaymentOption((p) => ({ ...p, method: 'cash' }))} style={styles.paymentOptionRow}>
                                    <View>
                                        <AppText label="Cash" variant={1} fontSize={16} color={colors.text} />
                                        <AppText label="Enter balance if needed" fontSize={12} color={colors.textTertiary} style={{ marginTop: 4 }} />
                                    </View>
                                    <View style={[styles.radioOuter, { borderColor: colors.border }, selectedPaymentOption.method === 'cash' && styles.radioOuterActive]}>{selectedPaymentOption.method === 'cash' && <View style={styles.radioInner} />}</View>
                                </TouchableOpacity>
                                <TouchableOpacity activeOpacity={0.7} onPress={() => setSelectedPaymentOption((p) => ({ ...p, method: 'momo' }))} style={[styles.paymentOptionRow, styles.paymentOptionRowBorder, { borderTopColor: colors.border }]}>
                                    <View>
                                        <AppText label="Mobile money" variant={1} fontSize={16} color={colors.text} />
                                        <AppText label="Enter MoMo number" fontSize={12} color={colors.textTertiary} style={{ marginTop: 4 }} />
                                    </View>
                                    <View style={[styles.radioOuter, { borderColor: colors.border }, selectedPaymentOption.method === 'momo' && styles.radioOuterActive]}>{selectedPaymentOption.method === 'momo' && <View style={styles.radioInner} />}</View>
                                </TouchableOpacity>
                                <TouchableOpacity activeOpacity={0.8} onPress={() => paymentOptionsScrollRef.current?.scrollTo({ x: width, y: 0, animated: true })} style={styles.continuePaymentBtn}>
                                    <AppText label="Continue" color={colors.textInverse} variant={1} />
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.paymentSlide, { width }]}>
                                <AppText label={selectedPaymentOption.method === 'cash' ? 'Change / balance (GH₵)' : 'Mobile money number'} style={{ marginBottom: 10 }} color={colors.text} />
                                <TextInput placeholder={selectedPaymentOption.method === 'cash' ? '0.00' : '0XX XXX XXXX'} placeholderTextColor={colors.placeholder} keyboardType={selectedPaymentOption.method === 'cash' ? 'decimal-pad' : 'phone-pad'} value={selectedPaymentOption.method === 'cash' ? selectedPaymentOption.balance : selectedPaymentOption.momoNumber} onChangeText={(val) => setSelectedPaymentOption((p) => (p.method === 'cash' ? { ...p, balance: val } : { ...p, momoNumber: val }))} style={[styles.paymentInput, { borderColor: colors.inputBorder, color: colors.text }]} />
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={styles.savePrintBtn}
                                    onPress={async () => {
                                        const prefix = appSettings.invoicePrefix || 'PO';
                                        const num = appSettings.invoiceNextNumber != null ? appSettings.invoiceNextNumber : 1001;
                                        const poNumber = `${prefix}-${num}`;
                                        const receiptText = formatPurchaseReceipt({ orders, supplierName: selectedSupplier?.name || '', storeName: selectedStore?.name || '', invoiceNumber: poNumber, companyName: appSettings.receiptCompanyName || 'Shopynn', currency: appSettings.currencySymbol || 'GH₵' });
                                        try {
                                            await Share.share({ message: receiptText, title: `Purchase ${poNumber}` });
                                            dispatch(incrementInvoiceNext());
                                            setShowPaymentOptions(false);
                                            navigation.goBack();
                                        } catch (e) { Alert.alert('Share', 'Could not share receipt.'); }
                                    }}>
                                    <AppText label="Save & Print" color={colors.textInverse} variant={1} />
                                </TouchableOpacity>
                                <TouchableOpacity activeOpacity={0.7} onPress={() => paymentOptionsScrollRef.current?.scrollTo({ x: 0, y: 0, animated: true })} style={styles.reselectBtn}><AppText label="Back" color={colors.textSecondary} /></TouchableOpacity>
                            </View>
                        </ScrollView>
                        <TouchableOpacity activeOpacity={0.7} onPress={handlePaymentOptionsClose} style={styles.cancelPaymentBtn}><AppText label="Cancel" color={colors.textSecondary} /></TouchableOpacity>
                    </View>
                </AppModal>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    keyboard: { flex: 1 },
    safeArea: { flex: 1 },
    headerBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4, marginLeft: 10 },
    section: { marginHorizontal: 12, marginTop: 8, gap: 10 },
    sectionRow: { flexDirection: 'row', gap: 10 },
    storeCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
    storeIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: config.THEME_COLOR + '18', justifyContent: 'center', alignItems: 'center' },
    supplierCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
    supplierIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: config.THEME_COLOR + '18', justifyContent: 'center', alignItems: 'center' },
    invoiceNumberRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
    invoiceNumberInput: { height: 40, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, fontFamily: 'FiraSans-Regular', fontSize: 14 },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: config.THEME_COLOR, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 12, marginTop: 12, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, marginHorizontal: 12, marginTop: 8, borderRadius: 12, borderWidth: 1 },
    list: { flex: 1, marginHorizontal: 12, marginTop: 0 },
    listContent: { paddingBottom: 16 },
    orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
    orderRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    orderRowRight: { flexDirection: 'row', alignItems: 'center' },
    qtyBadge: { width: 50, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: config.THEME_COLOR + '10', marginRight: 10 },
    deleteBtn: { padding: 6, borderRadius: 6 },
    summaryCard: { marginHorizontal: 12, marginTop: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    totalRow: { borderTopWidth: 1, marginTop: 8, paddingTop: 12 },
    discountInput: { height: 40, width: 100, borderRadius: 8, paddingHorizontal: 10, fontFamily: 'FiraSans-Regular', fontSize: 14, textAlign: 'right' },
    proceedBtn: { height: 52, marginHorizontal: 12, marginTop: 12, backgroundColor: config.THEME_COLOR, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    proceedBtnDisabled: { opacity: 0.8 },
    cancelBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginHorizontal: 16, paddingBottom: 16, alignSelf: 'center' },
    modalContent: { padding: 14, paddingBottom: 0 },
    modalSearch: { height: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontFamily: 'FiraSans-Regular', fontSize: 15 },
    modalListWrap: { height: Math.min(height * 0.45, 320), marginTop: 10 },
    modalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1 },
    quantityInput: { height: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontFamily: 'FiraSans-Regular', fontSize: 16, marginBottom: 14 },
    addQtyBtn: { height: 50, backgroundColor: config.THEME_COLOR, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    addQtyBtnDisabled: {},
    menuModalContent: { padding: 14, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    menuOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
    heldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    heldThumb: { width: 44, height: 44, borderRadius: 8 },
    paymentModalContent: { paddingVertical: 14 },
    paymentSlide: { paddingHorizontal: 14 },
    paymentOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
    paymentOptionRowBorder: { borderTopWidth: 1 },
    radioOuter: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    radioOuterActive: { borderColor: config.THEME_COLOR },
    radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: config.THEME_COLOR },
    continuePaymentBtn: { height: 50, backgroundColor: config.THEME_COLOR, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    paymentInput: { height: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontFamily: 'FiraSans-Regular', fontSize: 16 },
    savePrintBtn: { height: 50, backgroundColor: config.THEME_COLOR, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    reselectBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
    cancelPaymentBtn: { alignItems: 'center', paddingVertical: 14, marginHorizontal: 14 },
});

export default NewPurchase;