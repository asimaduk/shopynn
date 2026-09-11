import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Dimensions, StyleSheet, TouchableOpacity, ScrollView, View, TextInput, KeyboardAvoidingView, Platform, Image, Alert, Share } from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import { incrementInvoiceNext } from '../../store/actions/appSettings';
import InvoiceShareSheet from '../../components/invoice_share_sheet';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import VoiceAddToSaleModal from './VoiceAddToSaleModal';
import { FlashList } from '@shopify/flash-list';
import { launchCamera } from 'react-native-image-picker';
import useTheme from '../../hooks/useTheme';
import { sales as salesApi, warehouses as warehousesApi, customers as customersApi, normalizeList } from '../../services/api';
import { hasPermission, hasFeature, getScreenPlanAccess, navigateToScreenOrUpgrade } from '../../utils/permissions';
import { getPrintAgentPrintUrl } from '../../utils/printAgent';
import {
    SECURE_PENDING_SALES_KEY as PENDING_SALES_KEY,
    SECURE_HELD_SALES_KEY as HELD_SALES_KEY,
    readSecureList,
    writeSecureList,
} from '../../utils/secureOfflineStorage';
import { normalizeWarehousePrinterType } from '../../utils/warehousePrinter';

const { width, height } = Dimensions.get('screen');

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});
const formatCurrency = (value) => formatter.format(Number(value)).replace('GH₵', '').trim();

const NO_SYSTEM_QTY_MSG = "There's no system quantity.";

/** Available qty for a warehouse, or null when unknown. */
function getAvailableQtyForStore(product, warehouseId) {
    const storesQuantities = product?.stores_quantities || product?.storesQuantities || [];
    const hasStoreQtyData = Array.isArray(storesQuantities) && storesQuantities.length > 0;

    if (warehouseId && hasStoreQtyData) {
        const match = storesQuantities.find(
            (s) => String(s?.warehouse_id ?? s?.warehouseId ?? '') === String(warehouseId)
        );
        const availableRaw = match?.quantity_available ?? match?.quantityAvailable ?? 0;
        const availableQty = Number(availableRaw);
        return Number.isNaN(availableQty) ? 0 : availableQty;
    }

    const inventoryRaw = product?.inventory;
    if (inventoryRaw === null || inventoryRaw === undefined || inventoryRaw === '') {
        return null;
    }
    const inventoryQty = Number(inventoryRaw);
    return Number.isNaN(inventoryQty) ? null : inventoryQty;
}

/**
 * Merge voice-selected products into cart with per-warehouse stock checks.
 * @returns {{ ok: true, next: any[] } | { ok: false, message: string }}
 */
function applyVoiceSelectionsToOrders(prev, selections, warehouseId) {
    let next = [...prev];
    for (const row of selections) {
        const rec = row?.record;
        const qtyAdd = Math.max(1, Math.min(9999, parseInt(String(row?.qty), 10) || 1));
        if (!rec?.id) continue;

        const idx = next.findIndex((o) => String(o.id) === String(rec.id));
        const existingQty = idx >= 0 ? Number(next[idx].order_quantity) || 0 : 0;
        const targetQty = existingQty + qtyAdd;

        const storesQuantities = rec?.stores_quantities || rec?.storesQuantities || [];
        const hasStoreQtyData = Array.isArray(storesQuantities) && storesQuantities.length > 0;

        if (warehouseId && hasStoreQtyData) {
            const match = storesQuantities.find((s) => String(s?.warehouse_id ?? s?.warehouseId ?? '') === String(warehouseId));
            const availableRaw = match?.quantity_available ?? match?.quantityAvailable ?? 0;
            const availableQty = Number(availableRaw);
            if (Number.isNaN(availableQty)) {
                return { ok: false, message: `No available quantity found for ${rec?.name || 'product'} in this store.` };
            }
            if (idx < 0 && availableQty < 1) {
                return { ok: false, message: `No stock for ${rec?.name || 'product'} in this store.` };
            }
            if (targetQty > availableQty) {
                const more = Math.max(0, availableQty - existingQty);
                return {
                    ok: false,
                    message: `Only ${more} more of "${rec.name}" can be added (${availableQty} available in this store).`,
                };
            }
        } else if (warehouseId) {
            const availableRaw = rec?.inventory;
            const availableQty = Number(availableRaw);
            if (!Number.isNaN(availableQty) && targetQty > availableQty) {
                return {
                    ok: false,
                    message: `Only ${Math.max(0, availableQty - existingQty)} more of "${rec.name}" can be added (${availableQty} available).`,
                };
            }
        }

        if (idx >= 0) {
            next[idx] = { ...next[idx], order_quantity: targetQty };
        } else {
            next.unshift({ ...rec, order_quantity: qtyAdd });
        }
    }
    return { ok: true, next };
}

const NewSale = ({ navigation, route }) => {
    const { colors } = useTheme();
    const dispatch = useDispatch();
    const appSettings = useSelector((s) => s.appSettings) || {};
    const currentUser = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const [stores, setStores] = useState([]);
    const [selectedStore, setSelectedStore] = useState(null);
    const [showStores, setShowStores] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showCustomers, setShowCustomers] = useState(false);

    const [storeSearch, setStoreSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [heldSearch, setHeldSearch] = useState('');
    const [showSetQuantity, setShowSetQuantity] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [orders, setOrders] = useState([]);
    const ordersRef = useRef(orders);
    ordersRef.current = orders;

    const [showMenu,setShowMenu] = useState(false);
    const [showHeldItems, setShowHeldItems] = useState(false)
    const [heldItems, setHeldItems] = useState([])

    const [images, setImages] = useState([]);
    const [showPaymentOptions, setShowPaymentOptions] = useState(false);
    const [showInvoiceShare, setShowInvoiceShare] = useState(false);
    const [showVoiceAdd, setShowVoiceAdd] = useState(false);
    const [completedSaleForInvoice, setCompletedSaleForInvoice] = useState(null);
    const [selectedPaymentOption, setSelectedPaymentOption] = useState({ method: 'cash', balance: '', momoNumber: '' });
    const paymentOptionsScrollRef = useRef(null);

    const filteredStores = stores.filter((s) =>
        !storeSearch.trim() || (s.name && s.name.toLowerCase().includes(storeSearch.toLowerCase()))
    );
    const filteredCustomers = customers.filter((c) =>
        !customerSearch.trim() || (c.name && c.name.toLowerCase().includes(customerSearch.toLowerCase()))
    );
    const filteredHeldItems = heldItems.filter((h) =>
        !heldSearch.trim() || (h.name && h.name.toLowerCase().includes(heldSearch.toLowerCase()))
    );

    const loadHeldSales = useCallback(async () => {
        try {
            const list = await readSecureList(HELD_SALES_KEY);
            setHeldItems(Array.isArray(list) ? list : []);
        } catch (_) {
            setHeldItems([]);
        }
    }, []);

    const saveHeldSale = useCallback(async () => {
        if (!orders?.length) {
            Alert.alert('Hold sale', 'Add at least one item to hold this sale.');
            return;
        }
        if (!selectedStore?.id) {
            Alert.alert('Hold sale', 'Please select a store before holding this sale.');
            return;
        }
        const now = new Date();
        const id = `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
        const customerName = selectedCustomer?.name || 'Walk-in';
        const name = `${customerName} • ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        const held = {
            id,
            name,
            created_at: now.toISOString(),
            store: selectedStore ? { id: selectedStore.id, name: selectedStore.name } : null,
            customer: selectedCustomer ? { id: selectedCustomer.id, name: selectedCustomer.name } : null,
            orders,
            paymentOption: selectedPaymentOption
                ? {
                    method: selectedPaymentOption.method,
                    balance: selectedPaymentOption.balance,
                    momoNumber: selectedPaymentOption.momoNumber,
                }
                : null,
        };

        try {
            const list = await readSecureList(HELD_SALES_KEY);
            const next = Array.isArray(list) ? [...list, held] : [held];
            await writeSecureList(HELD_SALES_KEY, next);
            setHeldItems(next);

            Alert.alert('Held', 'Sale saved. You can continue it later from Held sales.');

            // Clear current draft so cashier can start fresh
            setOrders([]);
            setSelectedProduct(null);
            setShowPaymentOptions(false);
        } catch (e) {
            Alert.alert('Error', 'Failed to hold sale locally.');
        }
    }, [orders, selectedStore, selectedCustomer, selectedPaymentOption]);

    const restoreHeldSale = useCallback(
        async (held) => {
            if (!held) return;
            setSelectedStore(held.store || null);
            setSelectedCustomer(held.customer || null);
            setOrders(Array.isArray(held.orders) ? held.orders : []);
            if (held.paymentOption) setSelectedPaymentOption(held.paymentOption);
            setShowHeldItems(false);
            setHeldSearch('');

            // remove from held list once restored (prevents duplicates)
            try {
                const remaining = heldItems.filter((h) => h.id !== held.id);
                setHeldItems(remaining);
                await writeSecureList(HELD_SALES_KEY, remaining);
            } catch (_) {}
        },
        [heldItems],
    );

    useEffect(() => {
        const product = route.params?.selectedProduct;
        console.log('product', product);
        if (!product) return;
        // Clear param so it doesn't re-trigger on focus/back.
        navigation.setParams({ selectedProduct: undefined });

        if (!selectedStore?.id) {
            Alert.alert('Select store', 'Please select a store to check stock availability.');
            return;
        }

        const canMultiStoresForCheck = hasPermission(currentUser, 'stores.multi_access');
        const warehouseIdForCheck = canMultiStoresForCheck ? selectedStore?.id : (currentUser?.warehouse_id || selectedStore?.id);
        const availableQty = getAvailableQtyForStore(product, warehouseIdForCheck);

        if (availableQty !== null && availableQty < 1) {
            Alert.alert('No system quantity', NO_SYSTEM_QTY_MSG);
            return;
        }

        setSelectedProduct(product);
        setOrders((prev) => {
            const fnd = prev.find((o) => o.id === product.id || o.name === product.name);
            if (fnd) {
                setQuantity(String(fnd.order_quantity));
                const rest = prev.filter((o) => o.id !== product.id && o.name !== product.name);
                return [fnd, ...rest];
            }
            setQuantity('1');
            return [{ ...product, order_quantity: 1 }, ...prev];
        });
        setShowSetQuantity(true);
    }, [route.params?.selectedProduct, navigation, selectedStore?.id, selectedStore?.name, currentUser]);

    useEffect(() => {
        const scanned = route.params?.scannedBarcode;
        if (!scanned) return;
        navigation.setParams({ scannedBarcode: undefined });
        navigation.navigate('Search', { source_nav: 'inventory', searchOnly: true, onMultiSelect: handleMultiSelect, barcodeFilter: scanned });
        // Intentionally only react to barcode param — avoid re-firing when callback identity changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route.params?.scannedBarcode]);

    useEffect(() => {
        const pendingSale = route.params?.restorePendingSale;
        if (!pendingSale) return;

        // Remove param so it doesn't re-run on back/focus.
        navigation.setParams({ restorePendingSale: undefined });

        // Restore sale draft from a pending record.
        if (pendingSale.store) setSelectedStore(pendingSale.store);
        if (pendingSale.customer) setSelectedCustomer(pendingSale.customer);
        if (pendingSale.paymentOption) setSelectedPaymentOption(pendingSale.paymentOption);

        const restoredOrders =
            (Array.isArray(pendingSale.orders_full) && pendingSale.orders_full.length && pendingSale.orders_full) ||
            (Array.isArray(pendingSale.ordersFull) && pendingSale.ordersFull.length && pendingSale.ordersFull) ||
            [];

        if (restoredOrders.length) {
            setOrders(restoredOrders);
        }
    }, [route.params?.restorePendingSale, navigation]);

    const backPress = () => {
        navigation.goBack();
    }

    const handleStoreClose = () => {
        setShowStores(false);
    }

    const handleCustomerClose = () => {
        setShowCustomers(false);
    }

    const handleQuantityClose = () => {
        setShowSetQuantity(false)
    }

    const handleAddProduct = () => {
        if (!selectedProduct) return;
        const qty = Math.max(1, parseInt(quantity, 10) || 1);

        const warehouseId = resolvedWarehouseId;
        const availableQty = getAvailableQtyForStore(selectedProduct, warehouseId);

        if (availableQty !== null && availableQty < 1) {
            Alert.alert('No system quantity', NO_SYSTEM_QTY_MSG);
            setOrders((prev) => prev.filter((o) => o.id !== selectedProduct.id && o.name !== selectedProduct.name));
            setShowSetQuantity(false);
            setSelectedProduct(null);
            return;
        }

        if (availableQty !== null && qty > availableQty) {
            const storeName = selectedStore?.name || 'selected store';
            Alert.alert(
                'Not enough stock',
                `Available quantity in ${storeName} is ${availableQty}.`
            );
            return;
        }

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

    const handleMenuClose = () => {
        setShowMenu(false)
    }

    const handleRemoveProduct = () => {
        if (!selectedProduct) return;
        Alert.alert('Remove item', `Remove "${selectedProduct.name}" from this sale?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => {
                setOrders((prev) => prev.filter((o) => o.id !== selectedProduct.id && o.name !== selectedProduct.name));
                setShowMenu(false);
                setSelectedProduct(null);
            }},
        ]);
    };

    const handleHeldItemsClose = () => {
        setShowHeldItems(false)
    }

    const handlePaymentOptionsClose = () => {
        setShowPaymentOptions(false)
    }

    const handleMultiSelect = (records) => {
        const next = [...orders];
        let blockedZeroStock = false;
        records.forEach((rec) => {
            const fnd = next.find((o) => o.id == rec.id);
            if (!fnd) {
                const warehouseId = resolvedWarehouseId;
                const availableQty = getAvailableQtyForStore(rec, warehouseId);
                if (availableQty !== null && availableQty < 1) {
                    blockedZeroStock = true;
                    return;
                }

                next.push({ ...rec, order_quantity: Math.max(1, parseInt(String(rec.order_quantity), 10) || 1) });
            }
        });

        setOrders(next);

        if (blockedZeroStock) {
            Alert.alert('No system quantity', NO_SYSTEM_QTY_MSG);
        }

        if (next.length > 0 && next.length > orders.length) {
            setSelectedProduct(next[0]);
            setQuantity('1');
            setShowSetQuantity(true);
        }
    };

    const lineTotal = (item) => {
        const q = Number(item.order_quantity) || 0;
        const u = Number(item.unit_price) || 0;
        const a = Number(item.alt_price) || u;
        return q < 10 ? q * u : q * a;
    };
    const subtotal = orders.reduce((sum, c) => sum + (Number(c.order_quantity) * Number(c.unit_price)), 0);
    const discountTotal = orders.reduce((sum, c) => {
        const q = Number(c.order_quantity) || 0;
        if (q < 10) return sum;
        const u = Number(c.unit_price) || 0;
        const a = Number(c.alt_price) || u;
        return sum + q * (u - a);
    }, 0);
    const totalAmount = orders.reduce((sum, c) => sum + lineTotal(c), 0);
    const totalItems = orders.reduce((sum, c) => sum + (Number(c.order_quantity) || 0), 0);

    const canCreateSale = hasPermission(currentUser, 'sales.create');
    const canMultiStores =
        hasPermission(currentUser, 'stores.multi_access') &&
        hasFeature(currentUser, 'stores.multi_access', subscriptionFeatures);
    const createWarehouseAccess = getScreenPlanAccess(currentUser, 'CreateWarehouse', subscriptionFeatures);
    const userWarehouseId = currentUser?.warehouse_id;
    const resolvedWarehouseId = canMultiStores ? selectedStore?.id : (userWarehouseId || selectedStore?.id);
    const storeLocked = orders.length > 0;

    const handleVoiceCartApply = useCallback(
        (selections) => {
            if (!selectedStore?.id) {
                Alert.alert('Select store', 'Please select a store to check stock availability.');
                return false;
            }
            const warehouseId = resolvedWarehouseId;
            const r = applyVoiceSelectionsToOrders(ordersRef.current, selections, warehouseId);
            if (!r.ok) {
                Alert.alert('Cannot add items', r.message);
                return false;
            }
            setOrders(r.next);
            return true;
        },
        [selectedStore?.id, resolvedWarehouseId],
    );

    // Load stores (warehouses) and customers from API when screen is focused
    useFocusEffect(
        React.useCallback(() => {
            let active = true;

            // Clear customer when opening a fresh sale (from dashboard/sales),
            // but keep it when returning from Search / barcode with an in-progress draft.
            const routes = navigation.getState()?.routes || [];
            const prevRouteName = routes[routes.length - 2]?.name;
            const returningFromProductPicker =
                prevRouteName === 'Search' || prevRouteName === 'BarcodeScanner';
            if (
                !returningFromProductPicker &&
                !route.params?.restorePendingSale &&
                !(ordersRef.current?.length > 0)
            ) {
                setSelectedCustomer(null);
            }

            const loadData = async () => {
                try {
                    const rawStores = await warehousesApi.list();
                    const list = normalizeList(rawStores) || [];
                    if (active) {
                        setStores(list);
                        if (list.length > 0) {
                            // If user can't switch stores, default to their assigned warehouse.
                            if (!canMultiStores && userWarehouseId) {
                                const match = list.find((s) => String(s?.id) === String(userWarehouseId));
                                const desiredStore = match || { id: userWarehouseId, name: 'Default store' };
                                if (!selectedStore || String(selectedStore?.id) !== String(desiredStore?.id)) {
                                    setSelectedStore(desiredStore);
                                }
                            } else if (!selectedStore) {
                                setSelectedStore(list[0]);
                            }
                        }
                    }
                } catch (_) {
                    if (active) setStores([]);
                }
                try {
                    const rawCustomers = await customersApi.list();
                    const list = normalizeList(rawCustomers) || [];
                    if (active) {
                        setCustomers(list);
                        // Never auto-pick list[0] — user must choose a customer.
                    }
                } catch (_) {
                    if (active) setCustomers([]);
                }
            };
            loadData();
            loadHeldSales();
            return () => {
                active = false;
            };
        }, [selectedStore, loadHeldSales, canMultiStores, userWarehouseId, navigation, route.params?.restorePendingSale])
    );

    const handleSavePrint = async () => {
        if (!canCreateSale) {
            Alert.alert('Not allowed', 'You do not have permission to create sales.');
            return;
        }
        const prefix = appSettings.invoicePrefix || 'INV';
        const num = appSettings.invoiceNextNumber != null ? appSettings.invoiceNextNumber : 1001;
        const invoiceNumber = `${prefix}-${num}`;
        const totalAmount = orders.reduce(
            (s, o) => s + (Number(o.order_quantity) || 0) * (Number(o.unit_price) || 0),
            0,
        );
        let salePayloadForRetry = null;
        try {
            const payload = {
                customer_id: selectedCustomer?.id,
                warehouse_id: resolvedWarehouseId,
                products: orders.map((o) => ({
                    id: o.id,
                    quantity: Number(o.order_quantity) || 0,
                    unit_price: Number(o.unit_price) || 0,
                })),
                paymentMethod: selectedPaymentOption?.method || 'cash',
                totalAmount,
                invoice_number: invoiceNumber,
                discount_amount: discountTotal,
                notes: ''
            }
            salePayloadForRetry = payload;
            // console.log('payload', payload);
            const created = await salesApi.create(payload);

            let warehouseRecordForPrinting = selectedStore;
            if (resolvedWarehouseId != null && Array.isArray(stores)) {
                const row = stores.find((s) => String(s?.id) === String(resolvedWarehouseId));
                if (row) warehouseRecordForPrinting = row;
            }
            const printerType = normalizeWarehousePrinterType(warehouseRecordForPrinting?.printer_type);
            if (printerType === 'thermal') {
                const printUrl = getPrintAgentPrintUrl(appSettings);
                if (!printUrl) {
                    Alert.alert(
                        'Print agent not set',
                        'Set the Print agent IP under More → Print agent (the PC running Shopynn Print). Your sale is complete.',
                    );
                } else {
                const printPayload = {
                    id: Date.now(),
                    total_amount: totalAmount,
                    discount_amount: discountTotal,
                    invoice_number: invoiceNumber,
                    current_status: 1,
                    customer_id: selectedCustomer?.id ?? null,
                    customer: selectedCustomer?.name || 'Walk-in',
                    sale_date: new Date().toISOString(),
                    products: orders.map((o) => ({
                        id: o.id,
                        quantity: Number(o.order_quantity) || 0,
                        unit_price:
                            Number(o.order_quantity) < 10
                                ? Number(o.unit_price) || 0
                                : Number(o.alt_price) || Number(o.unit_price) || 0,
                        name: o.name || o.product_name || 'Item',
                    })),
                    notes: `Paid with ${selectedPaymentOption?.method || 'cash'}${
                        selectedPaymentOption?.method === 'momo' && selectedPaymentOption?.momoNumber
                            ? ` ${selectedPaymentOption.momoNumber}`
                            : selectedPaymentOption?.method === 'cash' && selectedPaymentOption?.balance
                              ? ` change ${selectedPaymentOption.balance}`
                              : ''
                    }`,
                    cashier:
                        [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') ||
                        currentUser?.email ||
                        '',
                    created_at: new Date().toISOString(),
                    warehouse_id: resolvedWarehouseId,
                    company: {
                        name: appSettings.companyName || appSettings.receiptCompanyName || 'Shopynn',
                        organization: appSettings.companyOrganization || '',
                        address: appSettings.companyAddress || '',
                        landmark: appSettings.companyLandmark || '',
                        phone: appSettings.companyPhone || '',
                        email: appSettings.companyEmail || '',
                    },
                };
                try {
                    const printRes = await fetch(printUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(printPayload),
                    });
                    const printData = await printRes.json();
                    if (printData.status != 200) {
                        Alert.alert(
                            'Print',
                            printData.message ? String(printData.message) : 'Could not print receipt.',
                        );
                    }
                } catch (printErr) {
                    Alert.alert(
                        'Print',
                        printErr?.message
                            ? String(printErr.message)
                            : 'Could not reach print agent. Check More → Print agent.',
                    );
                }
                }
            } else if (printerType === 'a4') {
                if (Toast && typeof Toast.show === 'function') {
                    Toast.show({
                        type: 'info',
                        text1: 'A4 receipt',
                        text2:
                            'A4 invoice preview and print work on desktop web. Open New Sale in a browser on your computer to print. Your sale is complete.',
                        visibilityTime: 6000,
                    });
                } else {
                    Alert.alert(
                        'A4 receipt',
                        'A4 invoice preview and print work on desktop web. Open New Sale in a browser on your computer to print. Your sale is complete.',
                    );
                }
            }

            dispatch(incrementInvoiceNext());
            setShowPaymentOptions(false);

            const saleForInvoice = {
                id: created?.id || created?.data?.id,
                invoice_number: invoiceNumber,
                created_at: new Date().toISOString(),
                customer: selectedCustomer?.name || 'Walk-in',
                customer_email: selectedCustomer?.email || '',
                customer_phone: selectedCustomer?.phone || '',
                customer_address: selectedCustomer?.address || '',
                payment_method: selectedPaymentOption?.method || 'cash',
                payment_number: selectedPaymentOption?.momoNumber || '',
                store: selectedStore ? { name: selectedStore.name } : null,
                discount_amount: discountTotal,
                total_amount: totalAmount,
                products: orders.map((o) => ({
                    name: o.name || o.product_name || 'Item',
                    quantity: Number(o.order_quantity) || 0,
                    unit_price: Number(o.unit_price) || 0,
                })),
                user:
                    [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') ||
                    currentUser?.email ||
                    '',
            };
            setCompletedSaleForInvoice(saleForInvoice);
            setShowInvoiceShare(true);
        } catch (e) {
            try {
                const pendingItem = {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    customer: selectedCustomer?.name || 'Walk-in',
                    amount: totalAmount,
                    date: new Date().toLocaleString(),
                    attendant: null,
                    created_at: new Date().toISOString(),
                    store: selectedStore || null,
                    customer_obj: selectedCustomer || null,
                    paymentOption: selectedPaymentOption || null,
                    warehouse_id: resolvedWarehouseId,
                    orders: orders.map((o) => ({
                        name: o.name || o.product_name || 'Item',
                        quantity: Number(o.order_quantity) || 0,
                    })),
                    // Full order objects allow reconciliation/editing later.
                    orders_full: orders,
                    // Sync metadata for reconciliation UI.
                    attempts: 0,
                    last_error_code: null,
                    last_error_message: null,
                    last_attempt_at: null,
                    payload: salePayloadForRetry,
                };
                // Keep only fields required for retry/edit/reconciliation.
                const normalizedPendingItem = {
                    id: pendingItem.id,
                    customer: pendingItem.customer,
                    amount: pendingItem.amount,
                    date: pendingItem.date,
                    created_at: pendingItem.created_at,
                    store: pendingItem.store ? { id: pendingItem.store.id, name: pendingItem.store.name } : null,
                    customer_obj: pendingItem.customer_obj
                        ? { id: pendingItem.customer_obj.id, name: pendingItem.customer_obj.name }
                        : null,
                    paymentOption: pendingItem.paymentOption
                        ? {
                            method: pendingItem.paymentOption.method,
                            balance: pendingItem.paymentOption.balance,
                            momoNumber: pendingItem.paymentOption.momoNumber,
                        }
                        : null,
                    warehouse_id: pendingItem.warehouse_id,
                    orders: pendingItem.orders,
                    orders_full: pendingItem.orders_full,
                    attempts: pendingItem.attempts,
                    last_error_code: pendingItem.last_error_code,
                    last_error_message: pendingItem.last_error_message,
                    last_attempt_at: pendingItem.last_attempt_at,
                    payload: pendingItem.payload,
                };
                const list = await readSecureList(PENDING_SALES_KEY);
                list.push(normalizedPendingItem);
                await writeSecureList(PENDING_SALES_KEY, list);
                Alert.alert(
                    'Saved for later',
                    (e?.response?.data?.message || e?.message || 'Could not complete sale.') +
                        '\n\nThe sale has been saved to Pending Sales for retry.',
                );
            } catch (storageError) {
                const msg =
                    e?.response?.data?.message ||
                    e?.message ||
                    'Could not complete sale, and saving locally also failed.';
                Alert.alert('Error', msg);
            }
        }
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboard}>
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={backPress} label="New Sale">
                    <View style={styles.headerActions}>
                        {heldItems.length > 0 ? (
                            <TouchableOpacity activeOpacity={0.7} onPress={() => setShowHeldItems(true)} style={[styles.headerBtn, { backgroundColor: colors.surface }]}>
                                <Lucide name="pause" color={config.THEME_COLOR} size={22} />
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('BarcodeScanner', { returnScreen: 'NewSale' })} style={[styles.headerBtn, { backgroundColor: colors.surface }]}>
                            <Lucide name="barcode" color={config.THEME_COLOR} size={22} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowVoiceAdd(true)}
                            style={[styles.headerBtn, { backgroundColor: colors.surface, marginRight: 10 }]}>
                            <Lucide name="mic" color={config.THEME_COLOR} size={22} />
                        </TouchableOpacity>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Search', { source_nav: 'inventory', searchOnly: true, onMultiSelect: handleMultiSelect })} style={[styles.headerBtn, { backgroundColor: colors.surface, marginRight: 10 }]}>
                            <Lucide name="plus" color={config.THEME_COLOR} size={22} />
                        </TouchableOpacity>
                    </View>
                </ScreenHeader>

                <View style={styles.section}>
                    {canMultiStores ? (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => {
                                if (storeLocked) {
                                    Alert.alert('Store locked', 'Remove all items to change the store.');
                                    return;
                                }
                                setShowStores(true);
                            }}
                            style={[styles.storeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                            <View style={styles.storeIconWrap}>
                                <Lucide name="store" size={18} color={config.THEME_COLOR} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <AppText label="Store" fontSize={11} color={colors.textTertiary} />
                                <AppText label={selectedStore?.name || 'Select store'} variant={1} fontSize={14} numberOfLines={1} color={colors.text} />
                            </View>
                            <Lucide name="chevron-down" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.storeCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 1 }]}>
                            <View style={styles.storeIconWrap}>
                                <Lucide name="store" size={18} color={config.THEME_COLOR} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <AppText label="Default store" fontSize={11} color={colors.textTertiary} />
                                <AppText label={selectedStore?.name || 'Default store'} variant={1} fontSize={14} numberOfLines={1} color={colors.text} />
                            </View>
                        </View>
                    )}
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setShowCustomers(true)} style={[styles.customerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.customerIconWrap}>
                            <Lucide name="user" size={18} color={config.THEME_COLOR} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <AppText label="Customer" fontSize={11} color={colors.textTertiary} />
                            <AppText label={selectedCustomer?.name || 'Select customer'} variant={2} fontSize={14} numberOfLines={1} color={colors.text} />
                        </View>
                        <Lucide name="chevron-down" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.listHeader}>
                    <AppText label="Item" color={colors.textInverse} fontSize={14} />
                    <AppText label="Amount" color={colors.textInverse} fontSize={14} />
                </View>

                {orders.length === 0 ? (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('Search', { source_nav: 'inventory', searchOnly: true, onMultiSelect: handleMultiSelect })}
                        style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Lucide name="shopping-cart" size={48} color={colors.border} />
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
                                            Alert.alert('Remove item', `Remove "${item.name}" from this sale?`, [
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
                    {discountTotal > 0 && (
                        <View style={styles.summaryRow}>
                            <AppText label="Discount" fontSize={14} color={colors.textSecondary} />
                            <AppText label={formatCurrency(discountTotal)} fontSize={14} color={config.GREEN_COLOR} />
                        </View>
                    )}
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
                    disabled={orders.length === 0 || !canCreateSale}
                    onPress={() => {
                        if (!canCreateSale) {
                            Alert.alert('Not allowed', 'You do not have permission to create sales.');
                            return;
                        }
                        if (!selectedStore?.id) {
                            Alert.alert('Select store', 'Please select a store before proceeding.');
                            return;
                        }
                        if (!selectedCustomer?.id) {
                            Alert.alert('Select customer', 'Please select a customer before proceeding.');
                            return;
                        }
                        setShowPaymentOptions(true);
                    }}
                    style={[
                        styles.proceedBtn,
                        (orders.length === 0 || !canCreateSale) && [styles.proceedBtnDisabled, { backgroundColor: colors.surfaceTertiary }],
                    ]}>
                    <AppText label="Proceed to payment" variant={1} fontSize={16} color={colors.textInverse} />
                </TouchableOpacity>

                <View style={styles.footerActions}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                            if (!canCreateSale) {
                                Alert.alert('Not allowed', 'You do not have permission to hold sales.');
                                return;
                            }
                            saveHeldSale();
                        }}
                        style={styles.footerBtn}>
                        <Lucide name="pause" size={18} color={colors.textSecondary} />
                        <AppText label="Hold" fontSize={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                            if (orders.length === 0) { backPress(); return; }
                            Alert.alert('Cancel sale?', 'All items will be removed.', [
                                { text: 'Keep editing', style: 'cancel' },
                                { text: 'Cancel sale', style: 'destructive', onPress: () => { setOrders([]); setSelectedProduct(null); backPress(); } },
                            ]);
                        }}
                        style={styles.footerBtn}>
                        <Lucide name="x" size={18} color={colors.textSecondary} />
                        <AppText label="Cancel" fontSize={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                </View>

                <AppModal title="Select store" handleClose={handleStoreClose} onRequestClose={handleStoreClose} visible={showStores}>
                    <View style={styles.modalContent}>
                        <TextInput
                            placeholder="Search stores..."
                            placeholderTextColor={colors.placeholder}
                            value={storeSearch}
                            onChangeText={setStoreSearch}
                            style={[styles.modalSearch, { borderColor: colors.inputBorder, color: colors.text }]}
                        />
                        {createWarehouseAccess.show ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, marginBottom: 4 }}>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        if (storeLocked) {
                                            Alert.alert('Store locked', 'Remove all items to change the store.');
                                            return;
                                        }
                                        setShowStores(false);
                                        navigateToScreenOrUpgrade(
                                            navigation,
                                            currentUser,
                                            'CreateWarehouse',
                                            subscriptionFeatures,
                                        );
                                    }}
                                    disabled={storeLocked}
                                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6 }}>
                                    <Lucide name="circle-plus" size={18} color={config.THEME_COLOR} />
                                    <AppText label="Add store" fontSize={13} color={config.THEME_COLOR} style={{ marginLeft: 6 }} />
                                    {createWarehouseAccess.locked ? (
                                        <Lucide name="lock" size={14} color={colors.textTertiary} style={{ marginLeft: 6 }} />
                                    ) : null}
                                </TouchableOpacity>
                            </View>
                        ) : null}
                        <View style={styles.modalListWrap}>
                            <FlashList
                                keyboardShouldPersistTaps="handled"
                                data={filteredStores}
                                keyExtractor={(item, idx) => item.id || item.name || String(idx)}
                                estimatedItemSize={48}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            if (storeLocked) {
                                                Alert.alert('Store locked', 'Remove all items to change the store.');
                                                return;
                                            }
                                            setSelectedStore(item);
                                            setShowStores(false);
                                            setStoreSearch('');
                                        }}
                                        disabled={storeLocked}
                                        style={[styles.modalRow, { borderBottomColor: colors.borderLight }]}>
                                        <Lucide name="store" size={18} color={colors.textTertiary} />
                                        <AppText label={item.name} style={{ flex: 1, marginLeft: 12 }} color={colors.text} />
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                </AppModal>

                <AppModal title="Select customer" handleClose={handleCustomerClose} onRequestClose={handleCustomerClose} visible={showCustomers}>
                    <View style={styles.modalContent}>
                        <TextInput
                            placeholder="Search customers..."
                            placeholderTextColor={colors.placeholder}
                            value={customerSearch}
                            onChangeText={setCustomerSearch}
                            style={[styles.modalSearch, { borderColor: colors.inputBorder, color: colors.text }]}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, marginBottom: 4 }}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                    setShowCustomers(false);
                                    navigation.navigate('CustomerForm');
                                }}
                                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6 }}>
                                <Lucide name="circle-plus" size={18} color={config.THEME_COLOR} />
                                <AppText label="Add customer" fontSize={13} color={config.THEME_COLOR} style={{ marginLeft: 6 }} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalListWrap}>
                            <FlashList
                                keyboardShouldPersistTaps="handled"
                                data={filteredCustomers}
                                keyExtractor={(item, idx) => item.id || item.name || String(idx)}
                                estimatedItemSize={48}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => { setSelectedCustomer(item); setShowCustomers(false); setCustomerSearch(''); }}
                                        style={[styles.modalRow, { borderBottomColor: colors.borderLight }]}>
                                        <Lucide name="user" size={18} color={colors.textTertiary} />
                                        <AppText label={item.name} style={{ flex: 1, marginLeft: 12 }} color={colors.text} />
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                </AppModal>

                <AppModal title="Enter quantity" handleClose={handleQuantityClose} onRequestClose={handleQuantityClose} visible={showSetQuantity}>
                    <View style={styles.modalContent}>
                        {selectedProduct && (
                            <>
                                <AppText label={selectedProduct.name} variant={1} fontSize={16} style={{ marginBottom: 8 }} color={colors.text} />
                                <AppText label={`GHS ${((selectedProduct.order_quantity < 10) || (selectedProduct.order_quantity == null)) ? selectedProduct.unit_price : selectedProduct.alt_price} each`} fontSize={13} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                                <TextInput
                                    value={quantity}
                                    placeholder="Quantity"
                                    keyboardType="number-pad"
                                    onChangeText={setQuantity}
                                    placeholderTextColor={colors.placeholder}
                                    style={[styles.quantityInput, { borderColor: colors.inputBorder, color: colors.text }]}
                                />
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    disabled={!quantity || Number(quantity) < 1}
                                    onPress={handleAddProduct}
                                    style={[styles.addQtyBtn, (!quantity || Number(quantity) < 1) && [styles.addQtyBtnDisabled, { backgroundColor: colors.surfaceTertiary }]]}>
                                    <AppText label={orders.find((o) => o.id === selectedProduct.id || o.name === selectedProduct.name) ? "Update quantity" : "Add to sale"} color={colors.textInverse} variant={1} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </AppModal>

                <AppModal title={selectedProduct?.name || 'Item'} handleClose={handleMenuClose} onRequestClose={handleMenuClose} visible={showMenu}>
                    <View style={[styles.menuModalContent, { backgroundColor: colors.surface }]}>
                        {selectedProduct && (
                            <>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        setQuantity(String(selectedProduct.order_quantity));
                                        setShowMenu(false);
                                        setTimeout(() => setShowSetQuantity(true), 300);
                                    }}
                                    style={styles.menuOption}>
                                    <Lucide name="pencil" color={config.THEME_COLOR} size={20} />
                                    <AppText label="Change quantity" variant={2} fontSize={16} style={{ marginLeft: 12 }} color={colors.text} />
                                </TouchableOpacity>
                                <TouchableOpacity activeOpacity={0.7} onPress={handleRemoveProduct} style={styles.menuOption}>
                                    <Lucide name="trash-2" color={colors.error} size={20} />
                                    <AppText label="Remove from sale" variant={2} fontSize={16} style={{ marginLeft: 12 }} color={colors.error} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </AppModal>

                <AppModal title="Held sales" handleClose={handleHeldItemsClose} onRequestClose={handleHeldItemsClose} visible={showHeldItems}>
                    <View style={styles.modalContent}>
                        <TextInput
                            placeholder="Search held..."
                            placeholderTextColor={colors.placeholder}
                            value={heldSearch}
                            onChangeText={setHeldSearch}
                            style={[styles.modalSearch, { borderColor: colors.inputBorder, color: colors.text }]}
                        />
                        <View style={styles.modalListWrap}>
                            <FlashList
                                keyboardShouldPersistTaps="handled"
                                data={filteredHeldItems}
                                keyExtractor={(item, idx) => item.id || item.name || String(idx)}
                                estimatedItemSize={64}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => restoreHeldSale(item)}
                                        style={[styles.heldRow, { borderBottomColor: colors.borderLight }]}
                                    >
                                        <Image
                                            source={item.thumbnail ? { uri: config.BASE_API + '/images?id=' + item.thumbnail } : require('../../assets/images/dp.png')}
                                            style={styles.heldThumb}
                                        />
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <AppText label={item.name} variant={1} color={colors.text} />
                                            <AppText
                                                label={item.created_at ? new Date(item.created_at).toLocaleString() : 'Held sale'}
                                                fontSize={12}
                                                color={colors.textTertiary}
                                                style={{ marginTop: 2 }}
                                            />
                                        </View>
                                        <Lucide name="chevron-right" size={20} color={colors.textTertiary} />
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                </AppModal>

                <VoiceAddToSaleModal visible={showVoiceAdd} onClose={() => setShowVoiceAdd(false)} onApply={handleVoiceCartApply} />

                <AppModal title="Payment" handleClose={handlePaymentOptionsClose} onRequestClose={handlePaymentOptionsClose} visible={showPaymentOptions}>
                    <View style={styles.paymentModalContent}>
                        <ScrollView keyboardShouldPersistTaps="handled" horizontal pagingEnabled ref={paymentOptionsScrollRef} showsHorizontalScrollIndicator={false}>
                            <View style={[styles.paymentSlide, { width }]}>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => setSelectedPaymentOption((p) => ({ ...p, method: 'cash' }))}
                                    style={styles.paymentOptionRow}>
                                    <View>
                                        <AppText label="Cash" variant={1} fontSize={16} color={colors.text} />
                                        <AppText label="Enter change/balance if needed" fontSize={12} color={colors.textTertiary} style={{ marginTop: 4 }} />
                                    </View>
                                    <View style={[styles.radioOuter, { borderColor: colors.border }, selectedPaymentOption.method === 'cash' && styles.radioOuterActive]}>
                                        {selectedPaymentOption.method === 'cash' && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => setSelectedPaymentOption((p) => ({ ...p, method: 'momo' }))}
                                    style={[styles.paymentOptionRow, styles.paymentOptionRowBorder, { borderTopColor: colors.border }]}>
                                    <View>
                                        <AppText label="Mobile money" variant={1} fontSize={16} color={colors.text} />
                                        <AppText label="Enter MoMo number" fontSize={12} color={colors.textTertiary} style={{ marginTop: 4 }} />
                                    </View>
                                    <View style={[styles.radioOuter, { borderColor: colors.border }, selectedPaymentOption.method === 'momo' && styles.radioOuterActive]}>
                                        {selectedPaymentOption.method === 'momo' && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => paymentOptionsScrollRef.current?.scrollTo({ x: width, y: 0, animated: true })}
                                    style={styles.continuePaymentBtn}>
                                    <AppText label="Continue" color={colors.textInverse} variant={1} />
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.paymentSlide, { width }]}>
                                <AppText label={selectedPaymentOption.method === 'cash' ? 'Change / balance (GHS)' : 'Mobile money number'} style={{ marginBottom: 10 }} color={colors.text} />
                                <TextInput
                                    placeholder={selectedPaymentOption.method === 'cash' ? '0.00' : '0XX XXX XXXX'}
                                    placeholderTextColor={colors.placeholder}
                                    keyboardType={selectedPaymentOption.method === 'cash' ? 'decimal-pad' : 'phone-pad'}
                                    value={selectedPaymentOption.method === 'cash' ? selectedPaymentOption.balance : selectedPaymentOption.momoNumber}
                                    onChangeText={(val) => setSelectedPaymentOption((p) => (p.method === 'cash' ? { ...p, balance: val } : { ...p, momoNumber: val }))}
                                    style={[styles.paymentInput, { borderColor: colors.inputBorder, color: colors.text }]}
                                />
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={styles.savePrintBtn}
                                    onPress={handleSavePrint}>
                                    <AppText label="Save & Print" color={colors.textInverse} variant={1} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => paymentOptionsScrollRef.current?.scrollTo({ x: 0, y: 0, animated: true })}
                                    style={styles.reselectBtn}>
                                    <AppText label="Back" color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                        <TouchableOpacity activeOpacity={0.7} onPress={handlePaymentOptionsClose} style={styles.cancelPaymentBtn}>
                            <AppText label="Cancel" color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </AppModal>

                <InvoiceShareSheet
                    visible={showInvoiceShare}
                    sale={completedSaleForInvoice}
                    saleId={completedSaleForInvoice?.id}
                    appSettings={appSettings}
                    onClose={() => {
                        setShowInvoiceShare(false);
                        setCompletedSaleForInvoice(null);
                        navigation.goBack();
                    }}
                />
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    keyboard: { flex: 1 },
    safeArea: { flex: 1 },
    headerActions: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    headerBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    section: { flexDirection: 'row', marginHorizontal: 12, marginTop: 8, gap: 10 },
    storeCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
    storeIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: config.THEME_COLOR + '18', justifyContent: 'center', alignItems: 'center' },
    customerCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
    customerIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: config.THEME_COLOR + '18', justifyContent: 'center', alignItems: 'center' },
    listHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: config.THEME_COLOR, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 12, marginTop: 12, borderTopLeftRadius: 12, borderTopRightRadius: 12,
    },
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
    proceedBtn: { height: 52, marginHorizontal: 12, marginTop: 12, backgroundColor: config.THEME_COLOR, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    proceedBtnDisabled: { opacity: 0.8 },
    footerActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginHorizontal: 16, paddingBottom: 16 },
    footerBtn: { flexDirection: 'row', alignItems: 'center', padding: 8 },
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

export default NewSale;