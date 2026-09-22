import React, { useEffect, useState, useRef } from 'react';
import { Dimensions, StyleSheet, TouchableOpacity, ScrollView, View, TextInput, KeyboardAvoidingView, Platform, Image, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import DateTimePicker from '@react-native-community/datetimepicker';
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

const PAYMENT_STATUS = { UNPAID: 0, PAID: 1, PARTIAL: 2 };
const PAYMENT_TYPE = { CASH: 1, MOMO: 2, BANK: 3, OTHER: 4 };

const paymentStatusLabel = (status) => {
    if (status === PAYMENT_STATUS.PAID) return 'Paid';
    if (status === PAYMENT_STATUS.PARTIAL) return 'Partial';
    return 'Unpaid';
};

const paymentTypeLabel = (type) => {
    if (type === PAYMENT_TYPE.MOMO) return 'MoMo';
    if (type === PAYMENT_TYPE.BANK) return 'Bank';
    if (type === PAYMENT_TYPE.OTHER) return 'Other';
    if (type === PAYMENT_TYPE.CASH) return 'Cash';
    return '—';
};

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
    const [showConfirm, setShowConfirm] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState(PAYMENT_STATUS.UNPAID);
    const [paymentType, setPaymentType] = useState(PAYMENT_TYPE.CASH);
    const [amountPaid, setAmountPaid] = useState('');
    const [paymentReference, setPaymentReference] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [dueDateValue, setDueDateValue] = useState(new Date());
    const [showDueDatePicker, setShowDueDatePicker] = useState(false);
    const [note, setNote] = useState('');

    const formatDueDateLabel = (isoDate) => {
        if (!isoDate) return '';
        const d = new Date(`${isoDate}T00:00:00`);
        if (Number.isNaN(d.getTime())) return isoDate;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const toIsoDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const onDueDateChange = (_event, selected) => {
        if (Platform.OS === 'android') setShowDueDatePicker(false);
        if (!selected) return;
        setDueDateValue(selected);
        setDueDate(toIsoDate(selected));
    };

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

        const paidParsed = amountPaid.trim() === '' ? null : Number(String(amountPaid).replace(/,/g, ''));
        let resolvedAmountPaid = 0;
        if (paymentStatus === PAYMENT_STATUS.PAID) {
            resolvedAmountPaid =
                paidParsed != null && Number.isFinite(paidParsed) && paidParsed > 0
                    ? paidParsed
                    : totalAmount;
        } else if (paymentStatus === PAYMENT_STATUS.PARTIAL) {
            resolvedAmountPaid = paidParsed != null && Number.isFinite(paidParsed) ? paidParsed : 0;
            if (resolvedAmountPaid <= 0) {
                Alert.alert('Amount paid', 'Enter amount paid for partial payment.');
                return;
            }
            if (resolvedAmountPaid >= totalAmount) {
                Alert.alert('Amount paid', 'Partial amount must be less than total — use Paid instead.');
                return;
            }
        }

        setSaving(true);
        try {
            await purchasesApi.create({
                warehouse_id: selectedStore?.id,
                supplier_id: selectedSupplier?.id,
                invoice_number: invoiceNumber.trim() || undefined,
                current_status: 1,
                notes: note.trim() || undefined,
                discount_amount: Math.max(0, Number(discountAmount) || 0),
                products: orders.map((o) => ({
                    id: o.id,
                    quantity: Number(o.order_quantity) || 0,
                    unit_price: Number(o.unit_price) || 0,
                })),
                payment_status: paymentStatus,
                payment_type: paymentStatus === PAYMENT_STATUS.UNPAID ? null : paymentType,
                amount_paid: resolvedAmountPaid,
                payment_reference:
                    paymentStatus === PAYMENT_STATUS.UNPAID
                        ? null
                        : paymentReference.trim() || null,
                due_date: dueDate.trim() || null,
            });
            setShowConfirm(false);
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
        return q * u;
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

                <ScrollView
                    style={styles.pageScroll}
                    contentContainerStyle={styles.pageScrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                >
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
                    <View style={[styles.ordersList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {orders.map((item, index) => (
                            <View
                                key={item.id || `${item.name}-${index}`}
                                style={[styles.orderRow, { borderBottomColor: colors.borderLight }, index === orders.length - 1 && { borderBottomWidth: 0 }]}
                            >
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => { setSelectedProduct(item); setShowMenu(true); }}
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            setSelectedProduct(item);
                                            setQuantity(String(item.order_quantity));
                                            setShowSetQuantity(true);
                                        }}
                                        style={styles.qtyBadge}>
                                        <AppText label={`×${item.order_quantity}`} fontSize={13} color={config.THEME_COLOR} />
                                    </TouchableOpacity>
                                    <View style={{ flex: 1 }}>
                                        <AppText label={item.name} variant={2} numberOfLines={2} color={colors.text} />
                                        <AppText label={`GH₵ ${item.unit_price} each`} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
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
                        ))}
                    </View>
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
                    <View style={{ marginTop: 8 }}>
                        <AppText label="Note (optional)" fontSize={12} color={colors.textTertiary} style={{ marginBottom: 6 }} />
                        <TextInput
                            placeholder="Add a note…"
                            placeholderTextColor={colors.placeholder}
                            value={note}
                            onChangeText={(t) => { if (t.length <= 200) setNote(t); }}
                            multiline
                            style={[styles.noteInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                        />
                    </View>
                    <View style={{ marginTop: 12 }}>
                        <AppText label="Payment (optional)" fontSize={13} variant={1} color={colors.text} style={{ marginBottom: 8 }} />
                        <View style={styles.chipRow}>
                            {[
                                { id: PAYMENT_STATUS.UNPAID, label: 'Unpaid' },
                                { id: PAYMENT_STATUS.PAID, label: 'Paid' },
                                { id: PAYMENT_STATUS.PARTIAL, label: 'Partial' },
                            ].map((opt) => (
                                <TouchableOpacity
                                    key={opt.id}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        setPaymentStatus(opt.id);
                                        if (opt.id === PAYMENT_STATUS.PAID && !amountPaid) {
                                            setAmountPaid(String(totalAmount.toFixed(2)));
                                        }
                                        if (opt.id === PAYMENT_STATUS.UNPAID) {
                                            setAmountPaid('');
                                            setPaymentReference('');
                                        }
                                        if (opt.id === PAYMENT_STATUS.PAID) {
                                            setDueDate('');
                                        }
                                    }}
                                    style={[
                                        styles.chip,
                                        { borderColor: colors.border },
                                        paymentStatus === opt.id && { backgroundColor: config.THEME_COLOR, borderColor: config.THEME_COLOR },
                                    ]}
                                >
                                    <AppText
                                        label={opt.label}
                                        fontSize={12}
                                        color={paymentStatus === opt.id ? colors.textInverse : colors.textSecondary}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                        {paymentStatus !== PAYMENT_STATUS.UNPAID && (
                            <>
                                <View style={[styles.chipRow, { marginTop: 8 }]}>
                                    {[
                                        { id: PAYMENT_TYPE.CASH, label: 'Cash' },
                                        { id: PAYMENT_TYPE.MOMO, label: 'MoMo' },
                                        { id: PAYMENT_TYPE.BANK, label: 'Bank' },
                                        { id: PAYMENT_TYPE.OTHER, label: 'Other' },
                                    ].map((opt) => (
                                        <TouchableOpacity
                                            key={opt.id}
                                            activeOpacity={0.7}
                                            onPress={() => setPaymentType(opt.id)}
                                            style={[
                                                styles.chip,
                                                { borderColor: colors.border },
                                                paymentType === opt.id && {
                                                    backgroundColor: config.THEME_COLOR,
                                                    borderColor: config.THEME_COLOR,
                                                },
                                            ]}
                                        >
                                            <AppText
                                                label={opt.label}
                                                fontSize={12}
                                                color={paymentType === opt.id ? '#fff' : colors.textSecondary}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <TextInput
                                    placeholder={`Amount paid (${totalAmount.toFixed(2)})`}
                                    placeholderTextColor={colors.placeholder}
                                    keyboardType="decimal-pad"
                                    value={amountPaid}
                                    onChangeText={(val) => {
                                        if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setAmountPaid(val);
                                    }}
                                    style={[styles.paymentFieldInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                />
                                <TextInput
                                    placeholder="Payment reference"
                                    placeholderTextColor={colors.placeholder}
                                    value={paymentReference}
                                    onChangeText={(t) => { if (t.length <= 50) setPaymentReference(t); }}
                                    style={[styles.paymentFieldInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                />
                            </>
                        )}
                        {(paymentStatus === PAYMENT_STATUS.UNPAID || paymentStatus === PAYMENT_STATUS.PARTIAL) && (
                            <View style={{ marginTop: 8 }}>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        if (dueDate) {
                                            const parsed = new Date(`${dueDate}T00:00:00`);
                                            if (!Number.isNaN(parsed.getTime())) setDueDateValue(parsed);
                                        }
                                        setShowDueDatePicker(true);
                                    }}
                                    style={[styles.paymentFieldInput, styles.dueDateBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                                >
                                    <Lucide name="calendar-days" size={16} color={colors.textTertiary} />
                                    <AppText
                                        label={dueDate ? formatDueDateLabel(dueDate) : 'Due date'}
                                        fontSize={14}
                                        color={dueDate ? colors.text : colors.placeholder}
                                        style={{ marginLeft: 8, flex: 1 }}
                                    />
                                    {dueDate ? (
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            onPress={() => setDueDate('')}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Lucide name="x" size={16} color={colors.textTertiary} />
                                        </TouchableOpacity>
                                    ) : null}
                                </TouchableOpacity>
                                {Platform.OS === 'ios' && showDueDatePicker ? (
                                    <AppModal
                                        visible={showDueDatePicker}
                                        title="Due date"
                                        handleClose={() => setShowDueDatePicker(false)}
                                        onRequestClose={() => setShowDueDatePicker(false)}
                                    >
                                        <View style={{ padding: 16, backgroundColor: colors.surface }}>
                                            <DateTimePicker
                                                value={dueDateValue}
                                                mode="date"
                                                display="spinner"
                                                onChange={onDueDateChange}
                                                minimumDate={new Date()}
                                                style={{ width: '100%', height: 200 }}
                                            />
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={() => {
                                                    setDueDate(toIsoDate(dueDateValue));
                                                    setShowDueDatePicker(false);
                                                }}
                                                style={[styles.confirmPrimaryBtn, { marginTop: 12 }]}
                                            >
                                                <AppText label="Done" variant={1} fontSize={15} color={colors.textInverse} />
                                            </TouchableOpacity>
                                        </View>
                                    </AppModal>
                                ) : null}
                                {Platform.OS === 'android' && showDueDatePicker ? (
                                    <DateTimePicker
                                        value={dueDateValue}
                                        mode="date"
                                        display="default"
                                        onChange={onDueDateChange}
                                        minimumDate={new Date()}
                                    />
                                ) : null}
                            </View>
                        )}
                    </View>
                    <View style={[styles.summaryRow, styles.totalRow, { borderTopColor: colors.border }]}>
                        <AppText label="Total" variant={1} fontSize={16} color={colors.text} />
                        <AppText label={formatCurrency(totalAmount)} variant={1} fontSize={18} color={config.THEME_COLOR} />
                    </View>
                </View>

                <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={orders.length === 0 || saving}
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
                        if (paymentStatus === PAYMENT_STATUS.PARTIAL) {
                            const paid = Number(String(amountPaid).replace(/,/g, ''));
                            if (!Number.isFinite(paid) || paid <= 0) {
                                Alert.alert('Amount paid', 'Enter amount paid for partial payment.');
                                return;
                            }
                            if (paid >= totalAmount) {
                                Alert.alert('Amount paid', 'Partial amount must be less than total — use Paid instead.');
                                return;
                            }
                        }
                        setShowConfirm(true);
                    }}
                    style={[styles.proceedBtn, (orders.length === 0 || saving) && [styles.proceedBtnDisabled, { backgroundColor: colors.surfaceTertiary }]]}>
                    <AppText label={saving ? 'Saving…' : 'Proceed'} variant={1} fontSize={16} color={colors.textInverse} />
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
                </ScrollView>

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
                                <AppText label={`GH₵ ${selectedProduct.unit_price} each`} fontSize={13} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                                <TextInput value={quantity} placeholder="Quantity" placeholderTextColor={colors.placeholder} keyboardType="number-pad" onChangeText={setQuantity} style={[styles.quantityInput, { borderColor: colors.inputBorder, color: colors.text }]} />
                                <TouchableOpacity activeOpacity={0.8} disabled={!quantity || Number(quantity) < 1} onPress={handleAddProduct} style={[styles.addQtyBtn, (!quantity || Number(quantity) < 1) && [styles.addQtyBtnDisabled, { backgroundColor: colors.surfaceTertiary }]]}>
                                    <AppText label={orders.find((o) => o.id === selectedProduct.id || o.name === selectedProduct.name) ? "Set quantity" : "Add to purchase"} color={colors.textInverse} variant={1} />
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

                <AppModal
                    title="Confirm Purchase"
                    handleClose={() => !saving && setShowConfirm(false)}
                    onRequestClose={() => !saving && setShowConfirm(false)}
                    visible={showConfirm}
                >
                    <ScrollView style={{ maxHeight: height * 0.55 }} contentContainerStyle={{ padding: 14, paddingBottom: 20 }}>
                        <AppText
                            label="Review this purchase before receiving stock and saving the invoice."
                            fontSize={13}
                            color={colors.textSecondary}
                            style={{ marginBottom: 12 }}
                        />
                        <View style={[styles.confirmCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
                            <AppText label={`Supplier: ${selectedSupplier?.name || '—'}`} fontSize={13} color={colors.text} />
                            <AppText label={`Store: ${selectedStore?.name || '—'}`} fontSize={13} color={colors.text} style={{ marginTop: 4 }} />
                            <AppText label={`Invoice #: ${invoiceNumber.trim() || '—'}`} fontSize={13} color={colors.text} style={{ marginTop: 4 }} />
                            <AppText label={`Items: ${totalItems}`} fontSize={13} color={colors.text} style={{ marginTop: 4 }} />
                        </View>
                        <View style={[styles.confirmCard, { borderColor: colors.border, marginTop: 10 }]}>
                            {orders.slice(0, 8).map((item, idx) => (
                                <View key={item.id || idx} style={[styles.confirmLine, idx > 0 && { borderTopColor: colors.borderLight, borderTopWidth: 1 }]}>
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                        <AppText label={item.name} fontSize={13} color={colors.text} numberOfLines={2} />
                                        <AppText
                                            label={`${item.order_quantity} × ${formatCurrency(item.unit_price)}`}
                                            fontSize={11}
                                            color={colors.textTertiary}
                                        />
                                    </View>
                                    <AppText label={formatCurrency(lineTotal(item))} fontSize={13} variant={1} color={colors.text} />
                                </View>
                            ))}
                            {orders.length > 8 ? (
                                <AppText
                                    label={`+${orders.length - 8} more item(s)`}
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 8 }}
                                />
                            ) : null}
                        </View>
                        <View style={[styles.confirmCard, { borderColor: colors.border, marginTop: 10 }]}>
                            <View style={styles.summaryRow}>
                                <AppText label="Subtotal" fontSize={13} color={colors.textSecondary} />
                                <AppText label={formatCurrency(subtotal)} fontSize={13} color={colors.text} />
                            </View>
                            <View style={styles.summaryRow}>
                                <AppText label="Discount" fontSize={13} color={colors.textSecondary} />
                                <AppText label={formatCurrency(discount)} fontSize={13} color={colors.text} />
                            </View>
                            <View style={styles.summaryRow}>
                                <AppText label="Payment" fontSize={13} color={colors.textSecondary} />
                                <AppText
                                    label={
                                        paymentStatus === PAYMENT_STATUS.UNPAID
                                            ? 'Unpaid'
                                            : `${paymentStatusLabel(paymentStatus)} · ${paymentTypeLabel(paymentType)}`
                                    }
                                    fontSize={13}
                                    color={colors.text}
                                />
                            </View>
                            {paymentStatus !== PAYMENT_STATUS.UNPAID ? (
                                <View style={styles.summaryRow}>
                                    <AppText label="Amount paid" fontSize={13} color={colors.textSecondary} />
                                    <AppText
                                        label={formatCurrency(
                                            amountPaid.trim() === ''
                                                ? paymentStatus === PAYMENT_STATUS.PAID
                                                    ? totalAmount
                                                    : 0
                                                : Number(String(amountPaid).replace(/,/g, '')) || 0
                                        )}
                                        fontSize={13}
                                        color={colors.text}
                                    />
                                </View>
                            ) : null}
                            {note.trim() ? (
                                <AppText label={`Note: ${note.trim()}`} fontSize={12} color={colors.textTertiary} style={{ marginTop: 6 }} />
                            ) : null}
                            <View style={[styles.summaryRow, styles.totalRow, { borderTopColor: colors.border }]}>
                                <AppText label="Total" variant={1} fontSize={15} color={colors.text} />
                                <AppText label={formatCurrency(totalAmount)} variant={1} fontSize={16} color={config.THEME_COLOR} />
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                disabled={saving}
                                onPress={() => setShowConfirm(false)}
                                style={[styles.confirmSecondaryBtn, { borderColor: colors.border, flex: 1 }]}
                            >
                                <AppText label="Cancel" fontSize={15} color={colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                disabled={saving}
                                onPress={handleSavePurchase}
                                style={[styles.confirmPrimaryBtn, { flex: 1, opacity: saving ? 0.7 : 1 }]}
                            >
                                <AppText label={saving ? 'Saving…' : 'Confirm & save'} variant={1} fontSize={15} color={colors.textInverse} />
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </AppModal>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    keyboard: { flex: 1 },
    safeArea: { flex: 1 },
    pageScroll: { flex: 1 },
    pageScrollContent: { paddingBottom: 28, flexGrow: 1 },
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
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, marginHorizontal: 12, marginTop: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderWidth: 1, borderTopWidth: 0 },
    ordersList: { marginHorizontal: 12, marginTop: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderWidth: 1, borderTopWidth: 0, overflow: 'hidden' },
    orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
    orderRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    orderRowRight: { flexDirection: 'row', alignItems: 'center' },
    qtyBadge: { width: 50, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: config.THEME_COLOR + '10', marginRight: 10 },
    deleteBtn: { padding: 6, borderRadius: 6 },
    summaryCard: { marginHorizontal: 12, marginTop: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    totalRow: { borderTopWidth: 1, marginTop: 8, paddingTop: 12 },
    discountInput: { height: 40, width: 100, borderRadius: 8, paddingHorizontal: 10, fontFamily: 'FiraSans-Regular', fontSize: 14, textAlign: 'right' },
    noteInput: { minHeight: 64, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontFamily: 'FiraSans-Regular', fontSize: 14, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    paymentFieldInput: { height: 42, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, marginTop: 8, fontFamily: 'FiraSans-Regular', fontSize: 14 },
    dueDateBtn: { marginTop: 0, flexDirection: 'row', alignItems: 'center' },
    confirmCard: { borderWidth: 1, borderRadius: 10, padding: 12 },
    confirmLine: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 8 },
    confirmPrimaryBtn: { height: 48, borderRadius: 10, backgroundColor: config.THEME_COLOR, alignItems: 'center', justifyContent: 'center' },
    confirmSecondaryBtn: { height: 48, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
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