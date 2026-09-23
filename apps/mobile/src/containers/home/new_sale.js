import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, TouchableOpacity, ScrollView, View, TextInput, KeyboardAvoidingView, Platform, Image, Alert, Share, DeviceEventEmitter } from 'react-native';
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
import { sales as salesApi, warehouses as warehousesApi, customers as customersApi, payments as paymentsApi, platformSettings, normalizeList } from '../../services/api';
import { MOMO_NETWORK_OPTIONS, getMomoNetworkIcon, validateMomoNumberForProvider, isTelecelMomoProvider } from '../../utils/momoNetworks';
import { hasPermission, hasFeature, getScreenPlanAccess, navigateToScreenOrUpgrade } from '../../utils/permissions';
import { getPrintAgentPrintUrl } from '../../utils/printAgent';
import {
    SECURE_PENDING_SALES_KEY as PENDING_SALES_KEY,
    SECURE_HELD_SALES_KEY as HELD_SALES_KEY,
    readSecureList,
    writeSecureList,
} from '../../utils/secureOfflineStorage';
import { normalizeWarehousePrinterType } from '../../utils/warehousePrinter';
import { buildInvoiceNumberFromSettings } from '../../utils/invoiceNumbering';
import { POS_MOMO_STATUS_EVENT } from '../../utils/notificationNavigation';
import {
    getBulkDiscountFromCompany,
    resolveSaleUnitPrice,
    lineDiscountAmount,
    lineTotal as calcLineTotal,
    isPriceMismatchError,
    getSaleApiErrorMessage,
} from '../../utils/bulkDiscount';

const { height } = Dimensions.get('screen');

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
    const bulkDiscount = useMemo(
        () => getBulkDiscountFromCompany(currentUser?.company),
        [currentUser?.company],
    );
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
    const selectedCustomerRef = useRef(selectedCustomer);
    selectedCustomerRef.current = selectedCustomer;
    const selectedStoreRef = useRef(selectedStore);
    selectedStoreRef.current = selectedStore;

    const [showMenu,setShowMenu] = useState(false);
    const [showHeldItems, setShowHeldItems] = useState(false)
    const [heldItems, setHeldItems] = useState([])

    const [images, setImages] = useState([]);
    const [showPaymentOptions, setShowPaymentOptions] = useState(false);
    const [showInvoiceShare, setShowInvoiceShare] = useState(false);
    const [showVoiceAdd, setShowVoiceAdd] = useState(false);
    const [completedSaleForInvoice, setCompletedSaleForInvoice] = useState(null);
    const [selectedPaymentOption, setSelectedPaymentOption] = useState({
        method: 'cash',
        amountTendered: '',
        momoNumber: '',
        provider: 'mtn',
        transactionRef: null,
        paid: false,
        chargedFaceAmount: null,
    });
    const [storeCreditInput, setStoreCreditInput] = useState('');
    const [momoCharge, setMomoCharge] = useState({ enabled: true, percent: 2 });
    const [momoSending, setMomoSending] = useState(false);
    const [momoChecking, setMomoChecking] = useState(false);
    const [momoStatusText, setMomoStatusText] = useState('');
    const [momoOtp, setMomoOtp] = useState('');
    const [momoNeedsOtp, setMomoNeedsOtp] = useState(false);
    const momoPollGenRef = useRef(0);

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
                    amountTendered: selectedPaymentOption.amountTendered,
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
            if (held.paymentOption) {
                const po = held.paymentOption;
                setSelectedPaymentOption({
                    method: po.method || 'cash',
                    amountTendered: po.amountTendered ?? po.balance ?? '',
                    momoNumber: po.momoNumber || '',
                    provider: po.provider || 'mtn',
                    transactionRef: po.transactionRef || null,
                    paid: Boolean(po.paid),
                });
            }
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

        if (
            selectedPaymentOption.method === 'momo' &&
            selectedPaymentOption.transactionRef &&
            (ordersRef.current?.length > 0)
        ) {
            Alert.alert(
                'Cart locked',
                selectedPaymentOption.paid
                    ? 'MoMo already paid for this cart amount. Complete the sale — do not change items.'
                    : 'A MoMo charge is already open for this cart amount. Finish or abandon that prompt before editing items.',
            );
            return;
        }

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
        if (
            selectedPaymentOption.method === 'momo' &&
            selectedPaymentOption.transactionRef &&
            (ordersRef.current?.length > 0)
        ) {
            Alert.alert(
                'Cart locked',
                selectedPaymentOption.paid
                    ? 'MoMo already paid for this cart amount. Complete the sale — do not change items.'
                    : 'A MoMo charge is already open for this cart amount. Finish or abandon that prompt before editing items.',
            );
            return;
        }
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
        if (pendingSale.paymentOption) {
            const po = pendingSale.paymentOption;
            setSelectedPaymentOption({
                method: po.method || 'cash',
                amountTendered: po.amountTendered ?? po.balance ?? '',
                momoNumber: po.momoNumber || '',
                provider: po.provider || 'mtn',
                transactionRef: po.transactionRef || null,
                paid: Boolean(po.paid),
                chargedFaceAmount: po.chargedFaceAmount ?? null,
            });
        }

        const restoredOrders =
            (Array.isArray(pendingSale.orders_full) && pendingSale.orders_full.length && pendingSale.orders_full) ||
            (Array.isArray(pendingSale.ordersFull) && pendingSale.ordersFull.length && pendingSale.ordersFull) ||
            [];

        if (restoredOrders.length) {
            setOrders(restoredOrders);
        }
    }, [route.params?.restorePendingSale, navigation]);

    useEffect(() => {
        const parked = route.params?.restoreParkedMomo;
        if (!parked?.transaction_ref) return;
        navigation.setParams({ restoreParkedMomo: undefined });

        const snap = parked.pos_cart_snapshot || {};
        const lines = Array.isArray(snap.products)
            ? snap.products
            : Array.isArray(snap.currentOrder)
              ? snap.currentOrder
              : Array.isArray(snap.orders)
                ? snap.orders
                : [];
        if (lines.length) {
            setOrders(
                lines.map((line) => ({
                    ...line,
                    quantity: Number(line.quantity ?? line.order_quantity) || 1,
                    order_quantity: Number(line.order_quantity ?? line.quantity) || 1,
                }))
            );
        }
        if (snap.customer_name || snap.customer) {
            setSelectedCustomer(
                typeof snap.customer === 'object' && snap.customer
                    ? snap.customer
                    : { id: snap.customer_id, name: snap.customer_name || snap.customer }
            );
        }
        if (snap.warehouse_id && snap.warehouse_name) {
            setSelectedStore({ id: snap.warehouse_id, name: snap.warehouse_name });
        } else if (snap.store) {
            setSelectedStore(snap.store);
        }

        const paid = ['success', 'paid', 'completed'].includes(String(parked.status || '').toLowerCase());
        const chargedFace =
            Number(parked.face_amount) > 0
                ? Math.round(Number(parked.face_amount) * 100) / 100
                : lines.reduce((sum, line) => {
                      const qty = Number(line.order_quantity ?? line.quantity) || 1;
                      const price = Number(line.unit_price) || 0;
                      return sum + qty * price;
                  }, 0);
        setSelectedPaymentOption({
            method: 'momo',
            amountTendered: '',
            momoNumber: String(parked.payment_number || snap.payment_number || '').replace(/\D/g, ''),
            provider: snap.provider || 'mtn',
            transactionRef: parked.transaction_ref,
            paid,
            chargedFaceAmount: chargedFace > 0 ? chargedFace : null,
        });
        setMomoStatusText(
            paid
                ? `Parked MoMo confirmed. Cart is locked — ${completeLabel} to finish.`
                : 'Resumed parked MoMo. Cart is locked to the charged amount — check status when the customer confirms.',
        );
        setMomoNeedsOtp(false);
        setMomoOtp('');
        setShowPaymentOptions(true);
    }, [route.params?.restoreParkedMomo, navigation]);

    /** After POS “Add customer”, refresh list and reopen picker with the new customer selected. */
    useEffect(() => {
        const token = route.params?.posCustomerRefreshAt;
        if (!token) return;
        const newly = route.params?.newlyCreatedCustomer;
        navigation.setParams({
            posCustomerRefreshAt: undefined,
            newlyCreatedCustomer: undefined,
        });

        let active = true;
        (async () => {
            try {
                const rawCustomers = await customersApi.list();
                const list = normalizeList(rawCustomers) || [];
                if (!active) return;
                setCustomers(list);
                if (newly?.id) {
                    const match =
                        list.find((c) => String(c?.id) === String(newly.id)) || newly;
                    setSelectedCustomer(match);
                }
                setCustomerSearch('');
                setShowCustomers(true);
            } catch (_) {
                if (newly?.id && active) {
                    setSelectedCustomer(newly);
                    setShowCustomers(true);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [route.params?.posCustomerRefreshAt, route.params?.newlyCreatedCustomer, navigation]);

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
        momoPollGenRef.current += 1;
        setShowPaymentOptions(false);
    };

    const momoStatusNeedsOtp = (status, displayText) => {
        const st = String(status || '').toLowerCase();
        if (st === 'send_otp' || st === 'otp' || st === 'send_pin' || st === 'pay_offline') return true;
        const t = String(displayText || '').toLowerCase();
        return /\botp\b|\bvoucher\b|\*110#/.test(t);
    };

    const handleMultiSelect = (records) => {
        if (momoCartLocked) {
            alertMomoCartLocked();
            return;
        }
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

    const lineTotal = (item) =>
        calcLineTotal(item.order_quantity, item.unit_price, item.alt_price, bulkDiscount);
    const subtotal = orders.reduce((sum, c) => sum + (Number(c.order_quantity) * Number(c.unit_price)), 0);
    const discountTotal = orders.reduce(
        (sum, c) => sum + lineDiscountAmount(c.order_quantity, c.unit_price, c.alt_price, bulkDiscount),
        0,
    );
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
    const momoCartLocked =
        selectedPaymentOption.method === 'momo' &&
        Boolean(selectedPaymentOption.transactionRef) &&
        orders.length > 0;

    const alertMomoCartLocked = useCallback(() => {
        Alert.alert(
            'Cart locked',
            selectedPaymentOption.paid
                ? 'MoMo already paid for this cart amount. Complete the sale — do not change items.'
                : 'A MoMo charge is already open for this cart amount. Finish or abandon that prompt before editing items.',
        );
    }, [selectedPaymentOption.paid]);

    const handleVoiceCartApply = useCallback(
        (selections) => {
            if (momoCartLocked) {
                alertMomoCartLocked();
                return false;
            }
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
        [momoCartLocked, alertMomoCartLocked, selectedStore?.id, resolvedWarehouseId],
    );

    // Load stores (warehouses) and customers from API when screen is focused
    useFocusEffect(
        React.useCallback(() => {
            let active = true;

            // Clear customer only for a truly fresh sale — not when returning from
            // Search / scanner / customer form, and never if a draft already has a customer or lines.
            const routes = navigation.getState()?.routes || [];
            const prevRouteName = routes[routes.length - 2]?.name;
            const returningFromDraftFlow =
                prevRouteName === 'Search' ||
                prevRouteName === 'BarcodeScanner' ||
                prevRouteName === 'CustomerForm';
            const hasDraft =
                Boolean(selectedCustomerRef.current) ||
                (ordersRef.current?.length > 0);
            if (
                !returningFromDraftFlow &&
                !hasDraft &&
                !route.params?.restorePendingSale &&
                !route.params?.restoreParkedMomo
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
                            const currentStore = selectedStoreRef.current;
                            // If user can't switch stores, default to their assigned warehouse.
                            if (!canMultiStores && userWarehouseId) {
                                const match = list.find((s) => String(s?.id) === String(userWarehouseId));
                                const desiredStore = match || { id: userWarehouseId, name: 'Default store' };
                                if (!currentStore || String(currentStore?.id) !== String(desiredStore?.id)) {
                                    setSelectedStore(desiredStore);
                                }
                            } else if (!currentStore) {
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
        }, [loadHeldSales, canMultiStores, userWarehouseId, navigation, route.params?.restorePendingSale, route.params?.restoreParkedMomo])
    );

    useEffect(() => {
        if (!showPaymentOptions) return;
        let active = true;
        platformSettings
            .getMomoPaymentCharge()
            .then((data) => {
                if (active && data) setMomoCharge(data);
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [showPaymentOptions]);

    // MoMo status via FCM push (webhook) — no auto-polling; Check status still verifies on demand.
    useEffect(() => {
        if (!showPaymentOptions) return undefined;
        const sub = DeviceEventEmitter.addListener(POS_MOMO_STATUS_EVENT, (payload) => {
            const ref = String(payload?.transaction_ref || '');
            const currentRef = String(selectedPaymentOption.transactionRef || '');
            if (!ref || !currentRef || ref !== currentRef) return;
            const st = String(payload?.status || '').toLowerCase();
            if (['success', 'paid', 'completed'].includes(st)) {
                setSelectedPaymentOption((p) => ({ ...p, paid: true, transactionRef: currentRef }));
                setMomoNeedsOtp(false);
                setMomoStatusText('Payment confirmed.');
                Toast.show({
                    type: 'success',
                    text1: 'MoMo paid',
                    text2: 'You can complete the sale now.',
                });
                return;
            }
            if (['failed', 'abandoned', 'reversed', 'cancelled'].includes(st)) {
                setMomoStatusText(
                    payload?.body || 'MoMo payment failed. Tap Send again or use Cash.',
                );
            }
        });
        return () => sub.remove();
    }, [showPaymentOptions, selectedPaymentOption.transactionRef]);

    const momoFaceBase = Number(totalAmount) || 0;
    const availableStoreCredit = Math.round((Number(selectedCustomer?.store_credit_balance) || 0) * 100) / 100;
    const storeCreditApplied = (() => {
        if (!selectedCustomer?.id || availableStoreCredit <= 0.001) return 0;
        const raw = String(storeCreditInput || '').trim();
        if (raw === '') return 0;
        const n = Number(String(raw).replace(/,/g, ''));
        if (!Number.isFinite(n) || n <= 0) return 0;
        return Math.round(Math.min(n, availableStoreCredit, momoFaceBase) * 100) / 100;
    })();
    const momoFace = Math.round(Math.max(0, momoFaceBase - storeCreditApplied) * 100) / 100;
    const momoPercent = momoCharge?.enabled ? Number(momoCharge.percent) || 0 : 0;
    const momoFee = momoCharge?.enabled
        ? Math.round(((momoFace * momoPercent) / 100) * 100) / 100
        : 0;
    const momoChargeTotal = Math.round((momoFace + momoFee) * 100) / 100;
    const warehouseForPaymentLabel =
        (resolvedWarehouseId != null && Array.isArray(stores)
            ? stores.find((s) => String(s?.id) === String(resolvedWarehouseId))
            : null) || selectedStore;
    const paymentPrinterType = normalizeWarehousePrinterType(warehouseForPaymentLabel?.printer_type);
    const willAutoPrint = paymentPrinterType === 'thermal' || paymentPrinterType === 'a4';
    const completeLabel = willAutoPrint ? 'Complete & print' : 'Complete sale';
    const cashTenderedParsed =
        String(selectedPaymentOption.amountTendered || '').trim() === ''
            ? null
            : Number(String(selectedPaymentOption.amountTendered).replace(/,/g, ''));
    const cashTenderedAmount =
        cashTenderedParsed != null && Number.isFinite(cashTenderedParsed)
            ? Math.round(cashTenderedParsed * 100) / 100
            : null;
    const hasCustomerForCredit = Boolean(selectedCustomer?.id);
    const cashIsPartialOrCredit =
        selectedPaymentOption.method === 'cash' &&
        cashTenderedAmount != null &&
        cashTenderedAmount + 0.001 < momoFace;
    const cashChangeAmount =
        cashTenderedAmount != null
            ? Math.round(Math.max(0, cashTenderedAmount - momoFace) * 100) / 100
            : 0;
    // Full pay when blank or >= remaining after store credit; partial/credit allowed when a customer is selected
    const cashTenderOk =
        cashTenderedAmount == null ||
        cashTenderedAmount + 0.001 >= momoFace ||
        (cashTenderedAmount >= 0 && hasCustomerForCredit);
    const cashAmountPaid =
        selectedPaymentOption.method === 'cash'
            ? cashTenderedAmount == null
                ? momoFace
                : Math.min(Math.max(0, cashTenderedAmount), momoFace)
            : momoFace;

    const extractMomoError = (e) => {
        const data = e?.response?.data;
        const candidates = [
            data?.error,
            data?.message,
            data?.data?.message,
            typeof data?.error === 'object' ? data?.error?.message : null,
            e?.message,
        ];
        for (const c of candidates) {
            if (typeof c === 'string' && c.trim() && c.trim() !== 'Something failed.') return c.trim();
        }
        for (const c of candidates) {
            if (typeof c === 'string' && c.trim()) return c.trim();
        }
        return 'Could not start MoMo payment';
    };

    const handleSendMomo = async (opts = {}) => {
        const forceNew = Boolean(opts.forceNew);
        const check = validateMomoNumberForProvider(
            selectedPaymentOption.momoNumber,
            selectedPaymentOption.provider || 'mtn',
        );
        if (!check.ok) {
            Alert.alert('MoMo', check.message);
            return;
        }
        const digits = check.digits;
        if (momoFace <= 0) {
            Alert.alert('MoMo', 'Sale total must be greater than zero.');
            return;
        }
        if (selectedPaymentOption.paid && selectedPaymentOption.transactionRef) {
            Alert.alert('MoMo', `Payment already confirmed. ${completeLabel} — do not send another charge.`);
            return;
        }
        momoPollGenRef.current += 1;
        setMomoSending(true);
        setMomoNeedsOtp(false);
        setMomoOtp('');
        setMomoStatusText(forceNew ? 'Starting a new MoMo prompt…' : 'Sending MoMo prompt…');
        try {
            const res = await paymentsApi.initiate({
                face_amount: momoFace,
                payment_method: 'mobile_money',
                phone: digits,
                provider: selectedPaymentOption.provider || 'mtn',
                source: 'pos_sale',
                payment_number: digits,
                force_new: forceNew,
            });
            const ref = res?.transaction_ref;
            if (!ref) {
                Alert.alert('MoMo', 'No payment reference returned.');
                setMomoStatusText('');
                return;
            }
            setSelectedPaymentOption((p) => ({
                ...p,
                transactionRef: ref,
                momoNumber: digits,
                chargedFaceAmount: momoFace,
            }));

            if (res?.reused || String(res?.status || '').toLowerCase() === 'success') {
                setSelectedPaymentOption((p) => ({
                    ...p,
                    paid: true,
                    transactionRef: ref,
                    chargedFaceAmount: momoFace,
                }));
                setMomoNeedsOtp(false);
                setMomoStatusText(
                    res?.display_text || `Previous MoMo payment already confirmed. ${completeLabel}.`,
                );
                return;
            }

            if (momoStatusNeedsOtp(res?.status, res?.display_text) || isTelecelMomoProvider(selectedPaymentOption.provider)) {
                setMomoNeedsOtp(true);
            }

            if (res?.resume && forceNew) {
                setMomoStatusText(
                    'Could not replace the open prompt. Use Check status, or wait and try Send again.',
                );
            } else if (res?.resume) {
                setMomoStatusText(
                    res?.display_text ||
                        'A MoMo prompt is already open. Ask the customer to approve it.',
                );
            } else if (isTelecelMomoProvider(selectedPaymentOption.provider)) {
                setMomoStatusText(
                    res?.display_text ||
                        'Dial *110# on the Telecel line, then enter the voucher below.',
                );
            } else if (forceNew) {
                setMomoStatusText(
                    res?.display_text ||
                        'New MoMo prompt sent. We’ll notify you when it’s paid — or tap Check status.',
                );
            } else {
                setMomoStatusText(
                    res?.display_text ||
                        'Approve the MoMo prompt on the phone. We’ll notify you when it’s paid — or tap Check status.',
                );
            }
        } catch (e) {
            Alert.alert('MoMo', extractMomoError(e));
            setMomoStatusText('');
            setMomoNeedsOtp(false);
        } finally {
            setMomoSending(false);
        }
    };

    const handleCancelMomoAndSendAgain = () => {
        if (selectedPaymentOption.paid && selectedPaymentOption.transactionRef) {
            Alert.alert('MoMo', `Payment already succeeded. ${completeLabel} — do not send another charge.`);
            return;
        }
        Alert.alert(
            'New MoMo prompt?',
            'This abandons the open prompt and sends a new one. Continue only if the previous prompt failed or timed out.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send again',
                    style: 'destructive',
                    onPress: async () => {
                        const ref = selectedPaymentOption.transactionRef;
                        if (ref) {
                            try {
                                await paymentsApi.posAbandon({ reference: ref });
                            } catch (e) {
                                const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || '';
                                if (/already succeeded/i.test(String(msg))) {
                                    setSelectedPaymentOption((p) => ({ ...p, paid: true }));
                                    setMomoStatusText(`MoMo already confirmed. ${completeLabel}.`);
                                    return;
                                }
                                // Continue with force_new on initiate — server will abandon if needed.
                            }
                        }
                        momoPollGenRef.current += 1;
                        setSelectedPaymentOption((p) => ({
                            ...p,
                            transactionRef: null,
                            paid: false,
                            chargedFaceAmount: null,
                        }));
                        setMomoOtp('');
                        setMomoNeedsOtp(false);
                        setMomoStatusText('Starting a new MoMo prompt…');
                        await handleSendMomo({ forceNew: true });
                    },
                },
            ],
        );
    };

    const handleSubmitMomoOtp = async () => {
        const isTelecel = isTelecelMomoProvider(selectedPaymentOption.provider);
        if (!selectedPaymentOption.transactionRef || !momoOtp) {
            Alert.alert('MoMo', isTelecel ? 'Enter the Telecel voucher from *110#.' : 'Enter the OTP from the network.');
            return;
        }
        setMomoSending(true);
        try {
            const res = await paymentsApi.submitOtp({
                reference: selectedPaymentOption.transactionRef,
                otp: momoOtp,
            });
            const st = String(res?.status || '').toLowerCase();
            if (st === 'success') {
                setSelectedPaymentOption((p) => ({ ...p, paid: true }));
                setMomoNeedsOtp(false);
                setMomoStatusText('Payment confirmed.');
            } else if (momoStatusNeedsOtp(st, res?.display_text) || isTelecel) {
                setMomoNeedsOtp(true);
                setMomoStatusText(
                    res?.display_text ||
                        (isTelecel ? 'Voucher still required — dial *110# again if needed.' : 'OTP still required.'),
                );
            } else {
                setMomoNeedsOtp(isTelecel);
                setMomoStatusText(res?.display_text || (isTelecel ? 'Voucher submitted — waiting…' : 'OTP submitted — waiting…'));
            }
        } catch (e) {
            Alert.alert('MoMo', extractMomoError(e));
        } finally {
            setMomoSending(false);
        }
    };

    const handleCheckMomoStatus = async () => {
        const ref = selectedPaymentOption.transactionRef;
        if (!ref || momoChecking) return;
        setMomoChecking(true);
        try {
            const v = await paymentsApi.verify(ref);
            const st = String(v?.status || '').toLowerCase();
            if (st === 'success' || st === 'paid' || st === 'completed') {
                setSelectedPaymentOption((p) => ({ ...p, paid: true }));
                setMomoNeedsOtp(false);
                setMomoStatusText('Payment confirmed.');
            } else if (momoStatusNeedsOtp(st, v?.display_text)) {
                setMomoNeedsOtp(true);
                setMomoStatusText(v?.display_text || 'Enter the OTP / voucher from the network.');
            } else {
                setMomoStatusText(v?.display_text || `Status: ${st || 'pending'}`);
            }
        } catch (e) {
            Alert.alert('MoMo', e?.response?.data?.message || e?.message || 'Could not verify');
        } finally {
            setMomoChecking(false);
        }
    };

    const handleParkMomoAndServeNext = async () => {
        const ref = selectedPaymentOption.transactionRef;
        if (!ref) {
            Alert.alert('MoMo', 'Send MoMo first before parking.');
            return;
        }
        if (!orders.length) {
            Alert.alert('MoMo', 'Cart is empty.');
            return;
        }
        momoPollGenRef.current += 1;
        setMomoSending(true);
        try {
            await paymentsApi.posPark({
                reference: ref,
                cart_snapshot: {
                    warehouse_id: selectedStore?.id || resolvedWarehouseId,
                    warehouse_name: selectedStore?.name || null,
                    customer_id: selectedCustomer?.id || null,
                    customer_name: selectedCustomer?.name || null,
                    products: orders.map((o) => ({ ...o })),
                    provider: selectedPaymentOption.provider || 'mtn',
                    payment_number: selectedPaymentOption.momoNumber,
                    store: selectedStore,
                    customer: selectedCustomer,
                },
            });
            setOrders([]);
            setSelectedCustomer(null);
            setSelectedPaymentOption({
                method: 'cash',
                amountTendered: '',
                momoNumber: '',
                provider: 'mtn',
                transactionRef: null,
                paid: false,
                chargedFaceAmount: null,
            });
            setMomoStatusText('');
            setMomoOtp('');
            setMomoNeedsOtp(false);
            setShowPaymentOptions(false);
            Toast.show({
                type: 'success',
                text1: 'MoMo parked',
                text2: 'Serve the next customer — finish later from Pending MoMo.',
            });
        } catch (e) {
            Alert.alert('MoMo', e?.response?.data?.message || e?.message || 'Could not park payment');
        } finally {
            setMomoSending(false);
        }
    };

    const handleSavePrint = async () => {
        if (!canCreateSale) {
            Alert.alert('Not allowed', 'You do not have permission to create sales.');
            return;
        }
        if (selectedPaymentOption.method === 'momo') {
            if (momoFace > 0.02) {
                const digits = String(selectedPaymentOption.momoNumber || '').replace(/\D/g, '');
                if (digits.length < 10) {
                    Alert.alert('MoMo', 'Enter a full MoMo number (10 digits).');
                    return;
                }
                if (!selectedPaymentOption.paid || !selectedPaymentOption.transactionRef) {
                    Alert.alert('MoMo', `Tap Send and confirm payment before ${completeLabel}.`);
                    return;
                }
            }
            const charged = Number(selectedPaymentOption.chargedFaceAmount);
            if (Number.isFinite(charged) && charged > 0 && Math.abs(Number(momoFace) - charged) > 0.02) {
                Alert.alert(
                    'Amount mismatch',
                    `Amount due after store credit (${Number(momoFace).toFixed(2)}) does not match the MoMo charge (${charged.toFixed(2)}). Finish this payment without changing items or credit.`,
                );
                return;
            }
        }
        if (selectedPaymentOption.method === 'cash' && !cashTenderOk) {
            if (cashIsPartialOrCredit && !hasCustomerForCredit) {
                Alert.alert(
                    'Customer required',
                    'Select a customer to sell on credit or accept a partial payment.',
                );
            } else {
                Alert.alert(
                    'Cash',
                    `Amount tendered must be at least the amount due (${momoFace.toFixed(2)}), or select a customer for partial/credit.`,
                );
            }
            return;
        }
        if (selectedPaymentOption.method === 'cash' && cashIsPartialOrCredit && !hasCustomerForCredit) {
            Alert.alert(
                'Customer required',
                'Select a customer to sell on credit or accept a partial payment.',
            );
            return;
        }
        const invoiceNumber = buildInvoiceNumberFromSettings(appSettings);
        const saleTotal = totalAmount;
        const resolvedTendered =
            selectedPaymentOption.method === 'cash'
                ? cashTenderedAmount != null
                    ? cashTenderedAmount
                    : Math.round(momoFace * 100) / 100
                : null;
        const resolvedChange =
            selectedPaymentOption.method === 'cash' && resolvedTendered != null
                ? Math.round(Math.max(0, resolvedTendered - momoFace) * 100) / 100
                : null;
        const cashOrMomoPaid =
            selectedPaymentOption.method === 'cash'
                ? cashAmountPaid
                : momoFace > 0.02
                  ? momoFace
                  : 0;
        const amountPaidForSale = cashOrMomoPaid;
        const balanceDueForSale =
            Math.round(Math.max(0, saleTotal - amountPaidForSale - storeCreditApplied) * 100) / 100;
        let salePayloadForRetry = null;
        try {
            const payNote =
                balanceDueForSale > 0.02
                    ? amountPaidForSale + storeCreditApplied <= 0.001
                        ? 'On credit'
                        : `Partial ${(amountPaidForSale + storeCreditApplied).toFixed(2)} (balance ${balanceDueForSale.toFixed(2)})`
                    : `Paid with ${selectedPaymentOption?.method || 'cash'}`;
            const payload = {
                customer_id: selectedCustomer?.id,
                warehouse_id: resolvedWarehouseId,
                products: orders.map((o) => ({
                    id: o.id,
                    quantity: Number(o.order_quantity) || 0,
                    unit_price: resolveSaleUnitPrice(
                        o.order_quantity,
                        o.unit_price,
                        o.alt_price,
                        bulkDiscount,
                    ),
                })),
                payment_method:
                    selectedPaymentOption?.method === 'momo' && momoFace > 0.02
                        ? 'momo'
                        : 'cash',
                payment_number: selectedPaymentOption?.momoNumber || '',
                payment_transaction_ref:
                    selectedPaymentOption?.method === 'momo' && momoFace > 0.02
                        ? selectedPaymentOption?.transactionRef || null
                        : null,
                payment_reference:
                    selectedPaymentOption?.method === 'momo' && momoFace > 0.02
                        ? selectedPaymentOption?.transactionRef || null
                        : null,
                payment_type:
                    selectedPaymentOption?.method === 'momo' && momoFace > 0.02 ? 2 : 1,
                amount_tendered: resolvedTendered,
                change_amount: resolvedChange,
                amount_paid: amountPaidForSale,
                store_credit_applied: storeCreditApplied > 0.001 ? storeCreditApplied : 0,
                payment_status: balanceDueForSale <= 0.02 ? 1 : amountPaidForSale + storeCreditApplied <= 0.001 ? 0 : 2,
                totalAmount: saleTotal,
                invoice_number: invoiceNumber,
                discount_amount: discountTotal,
                notes: `${payNote}${
                    storeCreditApplied > 0.001 ? ` store credit ${storeCreditApplied.toFixed(2)}` : ''
                }${
                    selectedPaymentOption?.method === 'momo' && selectedPaymentOption?.momoNumber
                        ? ` ${selectedPaymentOption.momoNumber}`
                        : ''
                }${selectedPaymentOption?.transactionRef ? ` ref ${selectedPaymentOption.transactionRef}` : ''}${
                    resolvedTendered != null
                        ? ` tendered ${resolvedTendered.toFixed(2)} change ${(resolvedChange || 0).toFixed(2)}`
                        : ''
                }`,
            };
            salePayloadForRetry = payload;
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
                    total_amount: saleTotal,
                    discount_amount: discountTotal,
                    invoice_number: invoiceNumber,
                    current_status: 1,
                    customer_id: selectedCustomer?.id ?? null,
                    customer: selectedCustomer?.name || 'Walk-in',
                    sale_date: new Date().toISOString(),
                    products: orders.map((o) => ({
                        id: o.id,
                        quantity: Number(o.order_quantity) || 0,
                        unit_price: resolveSaleUnitPrice(
                            o.order_quantity,
                            o.unit_price,
                            o.alt_price,
                            bulkDiscount,
                        ),
                        name: o.name || o.product_name || 'Item',
                    })),
                    notes: `Paid with ${selectedPaymentOption?.method || 'cash'}${
                        selectedPaymentOption?.method === 'momo' && selectedPaymentOption?.momoNumber
                            ? ` ${selectedPaymentOption.momoNumber}`
                            : resolvedTendered != null
                              ? ` tendered ${resolvedTendered.toFixed(2)} change ${(resolvedChange || 0).toFixed(2)}`
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
                amount_tendered: resolvedTendered,
                change_amount: resolvedChange,
                store: selectedStore ? { name: selectedStore.name } : null,
                discount_amount: discountTotal,
                total_amount: saleTotal,
                products: orders.map((o) => ({
                    name: o.name || o.product_name || 'Item',
                    quantity: Number(o.order_quantity) || 0,
                    unit_price: resolveSaleUnitPrice(
                        o.order_quantity,
                        o.unit_price,
                        o.alt_price,
                        bulkDiscount,
                    ),
                })),
                user:
                    [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') ||
                    currentUser?.email ||
                    '',
            };
            setCompletedSaleForInvoice(saleForInvoice);
            setShowInvoiceShare(true);
        } catch (e) {
            if (isPriceMismatchError(e)) {
                Alert.alert('Price mismatch', getSaleApiErrorMessage(e));
                return;
            }
            try {
                const pendingItem = {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    customer: selectedCustomer?.name || 'Walk-in',
                    amount: saleTotal,
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
                            amountTendered:
                                pendingItem.paymentOption.amountTendered ??
                                pendingItem.paymentOption.balance ??
                                '',
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
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => {
                                if (momoCartLocked) {
                                    alertMomoCartLocked();
                                    return;
                                }
                                navigation.navigate('BarcodeScanner', { returnScreen: 'NewSale' });
                            }}
                            style={[styles.headerBtn, { backgroundColor: colors.surface, opacity: momoCartLocked ? 0.4 : 1 }]}
                        >
                            <Lucide name="barcode" color={config.THEME_COLOR} size={22} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => {
                                if (momoCartLocked) {
                                    alertMomoCartLocked();
                                    return;
                                }
                                setShowVoiceAdd(true);
                            }}
                            style={[styles.headerBtn, { backgroundColor: colors.surface, opacity: momoCartLocked ? 0.4 : 1 }]}
                        >
                            <Lucide name="mic" color={config.THEME_COLOR} size={22} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => {
                                if (momoCartLocked) {
                                    alertMomoCartLocked();
                                    return;
                                }
                                navigation.navigate('Search', { source_nav: 'inventory', searchOnly: true, onMultiSelect: handleMultiSelect });
                            }}
                            style={[styles.headerBtn, { backgroundColor: colors.surface, marginRight: 10, opacity: momoCartLocked ? 0.4 : 1 }]}
                        >
                            <Lucide name="plus" color={config.THEME_COLOR} size={22} />
                        </TouchableOpacity>
                    </View>
                </ScreenHeader>

                {momoCartLocked ? (
                    <View
                        style={{
                            marginHorizontal: 16,
                            marginTop: 10,
                            marginBottom: 4,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 10,
                            backgroundColor: selectedPaymentOption.paid ? '#dcfce7' : '#fff7ed',
                            borderWidth: 1,
                            borderColor: selectedPaymentOption.paid ? '#86efac' : '#fed7aa',
                        }}
                    >
                        <AppText
                            label={
                                selectedPaymentOption.paid
                                    ? `MoMo paid for ₵ ${Number(selectedPaymentOption.chargedFaceAmount || totalAmount).toFixed(2)}. Cart locked — complete the sale.`
                                    : `MoMo charge open for ₵ ${Number(selectedPaymentOption.chargedFaceAmount || totalAmount).toFixed(2)}. Cart locked until paid or abandoned.`
                            }
                            fontSize={12}
                            color={selectedPaymentOption.paid ? '#166534' : '#9a3412'}
                        />
                    </View>
                ) : null}

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
                    <TouchableOpacity activeOpacity={0.7} onPress={() => {
                        if (momoCartLocked) {
                            alertMomoCartLocked();
                            return;
                        }
                        setShowCustomers(true);
                    }} style={[styles.customerCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: momoCartLocked ? 0.55 : 1 }]}>
                        <View style={styles.customerIconWrap}>
                            <Lucide name="user" size={18} color={config.THEME_COLOR} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <AppText label="Customer" fontSize={11} color={colors.textTertiary} />
                            <AppText label={selectedCustomer?.name || 'Select customer'} variant={2} fontSize={14} numberOfLines={1} color={colors.text} />
                            {selectedCustomer?.id && Number(selectedCustomer?.store_credit_balance) > 0.001 ? (
                                <AppText
                                    label={`Credit ${formatCurrency(Number(selectedCustomer.store_credit_balance))}`}
                                    fontSize={11}
                                    color={colors.textSecondary}
                                    numberOfLines={1}
                                />
                            ) : null}
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
                        onPress={() => {
                            if (momoCartLocked) {
                                alertMomoCartLocked();
                                return;
                            }
                            navigation.navigate('Search', { source_nav: 'inventory', searchOnly: true, onMultiSelect: handleMultiSelect });
                        }}
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
                                    onPress={() => {
                                        if (momoCartLocked) {
                                            alertMomoCartLocked();
                                            return;
                                        }
                                        setSelectedProduct(item);
                                        setShowMenu(true);
                                    }}
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            if (momoCartLocked) {
                                                alertMomoCartLocked();
                                                return;
                                            }
                                            setSelectedProduct(item);
                                            setQuantity(String(item.order_quantity));
                                            setShowSetQuantity(true);
                                        }}
                                        style={[styles.qtyBadge, { opacity: momoCartLocked ? 0.55 : 1 }]}>
                                        <AppText label={`×${item.order_quantity}`} fontSize={13} color={config.THEME_COLOR} />
                                    </TouchableOpacity>
                                    <View style={{ flex: 1 }}>
                                        <AppText label={item.name} variant={2} numberOfLines={2} color={colors.text} />
                                        <AppText label={`GH₵ ${resolveSaleUnitPrice(item.order_quantity, item.unit_price, item.alt_price, bulkDiscount)} each`} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                    </View>
                                </TouchableOpacity>
                                <View style={styles.orderRowRight}>
                                    <AppText label={formatCurrency(lineTotal(item))} variant={1} fontSize={15} color={config.THEME_COLOR} style={{ marginRight: 12 }} />
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            if (momoCartLocked) {
                                                alertMomoCartLocked();
                                                return;
                                            }
                                            Alert.alert('Remove item', `Remove "${item.name}" from this sale?`, [
                                                { text: 'Cancel', style: 'cancel' },
                                                { text: 'Remove', style: 'destructive', onPress: () => {
                                                    setOrders((prev) => prev.filter((o) => o.id !== item.id && o.name !== item.name));
                                                }},
                                            ]);
                                        }}
                                        style={[styles.deleteBtn, { backgroundColor: colors.errorLight, opacity: momoCartLocked ? 0.4 : 1 }]}>
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
                            if (momoCartLocked) {
                                alertMomoCartLocked();
                                return;
                            }
                            if (!canCreateSale) {
                                Alert.alert('Not allowed', 'You do not have permission to hold sales.');
                                return;
                            }
                            saveHeldSale();
                        }}
                        style={[styles.footerBtn, { opacity: momoCartLocked ? 0.4 : 1 }]}>
                        <Lucide name="pause" size={18} color={colors.textSecondary} />
                        <AppText label="Hold" fontSize={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                            if (momoCartLocked) {
                                Alert.alert(
                                    'MoMo in progress',
                                    selectedPaymentOption.paid
                                        ? 'Complete the sale for this MoMo payment instead of cancelling the cart.'
                                        : 'Abandon or finish the open MoMo prompt before cancelling this sale.',
                                );
                                return;
                            }
                            if (orders.length === 0) { backPress(); return; }
                            Alert.alert('Cancel sale?', 'All items will be removed.', [
                                { text: 'Keep editing', style: 'cancel' },
                                { text: 'Cancel sale', style: 'destructive', onPress: () => { setOrders([]); setSelectedProduct(null); backPress(); } },
                            ]);
                        }}
                        style={[styles.footerBtn, { opacity: momoCartLocked ? 0.4 : 1 }]}>
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
                                    navigation.navigate('CustomerForm', { fromPos: true });
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
                                        onPress={() => { setSelectedCustomer(item); setStoreCreditInput(''); setShowCustomers(false); setCustomerSearch(''); }}
                                        style={[styles.modalRow, { borderBottomColor: colors.borderLight }]}>
                                        <Lucide name="user" size={18} color={colors.textTertiary} />
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <AppText label={item.name} color={colors.text} />
                                            {Number(item.store_credit_balance) > 0.001 ? (
                                                <AppText
                                                    label={`Credit ${formatCurrency(Number(item.store_credit_balance))}`}
                                                    fontSize={12}
                                                    color={colors.textSecondary}
                                                />
                                            ) : null}
                                        </View>
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
                                <AppText label={`GHS ${resolveSaleUnitPrice(quantity || selectedProduct.order_quantity || 1, selectedProduct.unit_price, selectedProduct.alt_price, bulkDiscount)} each`} fontSize={13} color={colors.textSecondary} style={{ marginBottom: 12 }} />
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
                                    <AppText label={orders.find((o) => o.id === selectedProduct.id || o.name === selectedProduct.name) ? "Set quantity" : "Add to sale"} color={colors.textInverse} variant={1} />
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
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        bounces={false}
                        style={{ maxHeight: height * 0.72 }}
                        contentContainerStyle={styles.paymentModalContent}
                    >
                        <View style={styles.methodSeg}>
                            {[
                                { id: 'cash', label: 'Cash' },
                                { id: 'momo', label: 'MoMo' },
                            ].map((opt) => {
                                const active = selectedPaymentOption.method === opt.id;
                                const momoLocked =
                                    selectedPaymentOption.method === 'momo' &&
                                    Boolean(selectedPaymentOption.transactionRef) &&
                                    !selectedPaymentOption.paid;
                                return (
                                    <TouchableOpacity
                                        key={opt.id}
                                        activeOpacity={0.75}
                                        disabled={momoLocked && opt.id !== 'momo'}
                                        onPress={() => {
                                            if (momoLocked && opt.id !== 'momo') return;
                                            momoPollGenRef.current += 1;
                                            setSelectedPaymentOption((p) => ({
                                                ...p,
                                                method: opt.id,
                                                ...(opt.id === 'cash'
                                                    ? { transactionRef: null, paid: false, chargedFaceAmount: null }
                                                    : {}),
                                            }));
                                            if (opt.id === 'cash') {
                                                setMomoStatusText('');
                                                setMomoNeedsOtp(false);
                                                setMomoOtp('');
                                            }
                                        }}
                                        style={[
                                            styles.methodSegBtn,
                                            {
                                                backgroundColor: active ? config.THEME_COLOR : colors.surfaceSecondary,
                                                borderColor: active ? config.THEME_COLOR : colors.border,
                                                opacity: momoLocked && opt.id !== 'momo' ? 0.45 : 1,
                                            },
                                        ]}
                                    >
                                        <AppText
                                            label={opt.label}
                                            variant={active ? 1 : 2}
                                            fontSize={14}
                                            color={active ? colors.textInverse : colors.text}
                                        />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.paymentSummaryRow}>
                            <AppText label={`Sale ${momoFaceBase.toFixed(2)}`} color={colors.text} />
                            {selectedPaymentOption.method === 'momo' ? (
                                <AppText
                                    label={
                                        momoFee > 0
                                            ? `Pay ${momoChargeTotal.toFixed(2)} (+${momoFee.toFixed(2)})`
                                            : `Pay ${momoChargeTotal.toFixed(2)}`
                                    }
                                    variant={1}
                                    color={colors.text}
                                />
                            ) : (
                                <AppText
                                    label={`Change ${cashChangeAmount.toFixed(2)}`}
                                    fontSize={13}
                                    color={colors.textTertiary}
                                />
                            )}
                        </View>

                        {availableStoreCredit > 0.001 ? (
                            <View style={{ marginBottom: 12 }}>
                                <AppText
                                    label={`Store credit available ${availableStoreCredit.toFixed(2)}`}
                                    fontSize={13}
                                    color={colors.textSecondary}
                                    style={{ marginBottom: 6 }}
                                />
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                    <TextInput
                                        placeholder="0.00"
                                        placeholderTextColor={colors.placeholder}
                                        keyboardType="decimal-pad"
                                        value={storeCreditInput}
                                        onChangeText={setStoreCreditInput}
                                        style={[
                                            styles.paymentInput,
                                            {
                                                flex: 1,
                                                borderColor: colors.inputBorder,
                                                color: colors.text,
                                                marginBottom: 0,
                                            },
                                        ]}
                                    />
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() =>
                                            setStoreCreditInput(
                                                Math.min(availableStoreCredit, momoFaceBase).toFixed(2),
                                            )
                                        }
                                        style={{
                                            paddingHorizontal: 12,
                                            paddingVertical: 10,
                                            borderRadius: 8,
                                            backgroundColor: colors.surfaceSecondary,
                                        }}
                                    >
                                        <AppText label="Use max" fontSize={13} color={config.THEME_COLOR} />
                                    </TouchableOpacity>
                                </View>
                                {storeCreditApplied > 0.001 ? (
                                    <AppText
                                        label={`Applying ${storeCreditApplied.toFixed(2)} · due ${momoFace.toFixed(2)}`}
                                        fontSize={12}
                                        color={colors.textSecondary}
                                        style={{ marginTop: 6 }}
                                    />
                                ) : null}
                            </View>
                        ) : null}

                        <AppText
                            label={
                                selectedPaymentOption.method === 'cash'
                                    ? 'Amount tendered (GHS)'
                                    : 'Mobile money number'
                            }
                            style={{ marginBottom: 8 }}
                            color={colors.text}
                        />
                        <TextInput
                            placeholder={
                                selectedPaymentOption.method === 'cash'
                                    ? momoFace.toFixed(2)
                                    : '0XX XXX XXXX'
                            }
                            placeholderTextColor={colors.placeholder}
                            keyboardType={selectedPaymentOption.method === 'cash' ? 'decimal-pad' : 'phone-pad'}
                            editable={
                                selectedPaymentOption.method === 'cash' ||
                                !selectedPaymentOption.transactionRef ||
                                selectedPaymentOption.paid
                            }
                            value={
                                selectedPaymentOption.method === 'cash'
                                    ? selectedPaymentOption.amountTendered
                                    : selectedPaymentOption.momoNumber
                            }
                            onChangeText={(val) => {
                                if (
                                    selectedPaymentOption.method === 'momo' &&
                                    selectedPaymentOption.transactionRef &&
                                    !selectedPaymentOption.paid
                                ) {
                                    return;
                                }
                                if (selectedPaymentOption.method === 'momo') {
                                    momoPollGenRef.current += 1;
                                }
                                setSelectedPaymentOption((p) =>
                                    p.method === 'cash'
                                        ? { ...p, amountTendered: val }
                                        : {
                                              ...p,
                                              momoNumber: val.replace(/\D/g, '').slice(0, 10),
                                              paid: false,
                                              transactionRef: null,
                                              chargedFaceAmount: null,
                                          }
                                );
                                if (selectedPaymentOption.method === 'momo') {
                                    setMomoNeedsOtp(false);
                                    setMomoOtp('');
                                    setMomoStatusText('');
                                }
                            }}
                            style={[
                                styles.paymentInput,
                                {
                                    borderColor: colors.inputBorder,
                                    color: colors.text,
                                    opacity:
                                        selectedPaymentOption.method === 'momo' &&
                                        selectedPaymentOption.transactionRef &&
                                        !selectedPaymentOption.paid
                                            ? 0.7
                                            : 1,
                                },
                            ]}
                        />
                        {selectedPaymentOption.method === 'cash' && !cashTenderOk ? (
                            <AppText
                                label={
                                    cashIsPartialOrCredit && !hasCustomerForCredit
                                        ? 'Select a customer for partial or credit'
                                        : `Must be at least ${momoFace.toFixed(2)}, or select a customer for credit`
                                }
                                fontSize={12}
                                color={colors.error}
                                style={{ marginTop: 6 }}
                            />
                        ) : null}
                        {selectedPaymentOption.method === 'cash' && cashIsPartialOrCredit && hasCustomerForCredit ? (
                            <AppText
                                label={
                                    cashAmountPaid <= 0.001
                                        ? `On credit — balance ${momoFace.toFixed(2)}`
                                        : `Partial — paid ${cashAmountPaid.toFixed(2)}, balance ${(momoFace - cashAmountPaid).toFixed(2)}`
                                }
                                fontSize={12}
                                color={colors.warning || colors.textSecondary}
                                style={{ marginTop: 6 }}
                            />
                        ) : null}
                        {selectedPaymentOption.method === 'cash' ? (
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() =>
                                        setSelectedPaymentOption((p) => ({
                                            ...p,
                                            amountTendered: momoFace.toFixed(2),
                                        }))
                                    }
                                    style={[styles.momoActionChip, { borderColor: colors.border }]}
                                >
                                    <AppText label="Exact" color={colors.primary} fontSize={12} variant={1} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    disabled={!hasCustomerForCredit}
                                    onPress={() => {
                                        if (!hasCustomerForCredit) {
                                            Alert.alert(
                                                'Customer required',
                                                'Select a customer before putting a sale on credit.',
                                            );
                                            return;
                                        }
                                        setSelectedPaymentOption((p) => ({
                                            ...p,
                                            amountTendered: '0',
                                        }));
                                    }}
                                    style={[
                                        styles.momoActionChip,
                                        {
                                            borderColor: colors.border,
                                            opacity: hasCustomerForCredit ? 1 : 0.45,
                                        },
                                    ]}
                                >
                                    <AppText label="On credit" color={colors.primary} fontSize={12} variant={1} />
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {selectedPaymentOption.method === 'momo' ? (
                            <View style={{ marginTop: 12 }}>
                                <AppText label="Network" style={{ marginBottom: 8 }} color={colors.text} />
                                <View style={styles.networkRow}>
                                    {MOMO_NETWORK_OPTIONS.map((network) => {
                                        const active =
                                            selectedPaymentOption.provider === network.provider;
                                        return (
                                            <TouchableOpacity
                                                key={network.id}
                                                activeOpacity={0.7}
                                                disabled={
                                                    Boolean(selectedPaymentOption.transactionRef) &&
                                                    !selectedPaymentOption.paid
                                                }
                                                onPress={() => {
                                                    if (
                                                        selectedPaymentOption.transactionRef &&
                                                        !selectedPaymentOption.paid
                                                    ) {
                                                        return;
                                                    }
                                                    momoPollGenRef.current += 1;
                                                    setSelectedPaymentOption((p) => ({
                                                        ...p,
                                                        provider: network.provider,
                                                        paid: false,
                                                        transactionRef: null,
                                                        chargedFaceAmount: null,
                                                    }));
                                                    setMomoNeedsOtp(false);
                                                    setMomoOtp('');
                                                    setMomoStatusText('');
                                                }}
                                                style={[
                                                    styles.networkChip,
                                                    {
                                                        backgroundColor: active
                                                            ? `${network.color}22`
                                                            : colors.surfaceSecondary,
                                                        borderColor: active
                                                            ? network.color
                                                            : colors.border,
                                                        opacity:
                                                            selectedPaymentOption.transactionRef &&
                                                            !selectedPaymentOption.paid
                                                                ? 0.7
                                                                : 1,
                                                    },
                                                ]}
                                            >
                                                <View style={styles.networkChipInner}>
                                                    <Image
                                                        source={getMomoNetworkIcon(network.id)}
                                                        style={styles.networkLogo}
                                                        resizeMode="contain"
                                                    />
                                                    <AppText
                                                        label={network.label}
                                                        fontSize={12}
                                                        variant={active ? 1 : 2}
                                                        color={colors.text}
                                                    />
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {isTelecelMomoProvider(selectedPaymentOption.provider) ? (
                                    <View style={{ marginTop: 12 }}>
                                        <AppText label="Telecel voucher" style={{ marginBottom: 6 }} color={colors.text} />
                                        <AppText
                                            label="Dial *110# on the customer’s Telecel line to generate a voucher, then enter it here."
                                            fontSize={12}
                                            color={colors.textTertiary}
                                            style={{ marginBottom: 8 }}
                                        />
                                        <TextInput
                                            placeholder="Voucher code"
                                            placeholderTextColor={colors.placeholder}
                                            value={momoOtp}
                                            onChangeText={setMomoOtp}
                                            keyboardType="number-pad"
                                            style={[
                                                styles.paymentInput,
                                                { borderColor: colors.inputBorder, color: colors.text },
                                            ]}
                                        />
                                        {selectedPaymentOption.transactionRef && !selectedPaymentOption.paid ? (
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                style={[styles.continuePaymentBtn, { marginTop: 8 }]}
                                                disabled={momoSending || !String(momoOtp || '').trim()}
                                                onPress={handleSubmitMomoOtp}
                                            >
                                                <AppText
                                                    label={momoSending ? 'Submitting…' : 'Submit voucher'}
                                                    color={colors.textInverse}
                                                    variant={1}
                                                />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                ) : null}

                                {!selectedPaymentOption.transactionRef ? (
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        style={[styles.savePrintBtn, { marginTop: 14 }]}
                                        disabled={momoSending}
                                        onPress={() => handleSendMomo()}
                                    >
                                        <AppText
                                            label={momoSending ? 'Sending…' : 'Send MoMo'}
                                            color={colors.textInverse}
                                            variant={1}
                                        />
                                    </TouchableOpacity>
                                ) : null}

                                {selectedPaymentOption.transactionRef && !selectedPaymentOption.paid ? (
                                    <View style={{ marginTop: 12 }}>
                                        {momoStatusText ? (
                                            <AppText
                                                label={momoStatusText}
                                                fontSize={12}
                                                color={colors.textTertiary}
                                                style={{ marginBottom: 10 }}
                                            />
                                        ) : null}

                                        {momoNeedsOtp && !isTelecelMomoProvider(selectedPaymentOption.provider) ? (
                                            <View style={{ marginBottom: 10 }}>
                                                <TextInput
                                                    placeholder="Enter OTP"
                                                    placeholderTextColor={colors.placeholder}
                                                    value={momoOtp}
                                                    onChangeText={setMomoOtp}
                                                    keyboardType="number-pad"
                                                    style={[
                                                        styles.paymentInput,
                                                        { borderColor: colors.inputBorder, color: colors.text },
                                                    ]}
                                                />
                                                <TouchableOpacity
                                                    activeOpacity={0.8}
                                                    style={[styles.continuePaymentBtn, { marginTop: 8 }]}
                                                    disabled={momoSending || !momoOtp}
                                                    onPress={handleSubmitMomoOtp}
                                                >
                                                    <AppText
                                                        label={momoSending ? 'Submitting…' : 'Submit OTP'}
                                                        color={colors.textInverse}
                                                        variant={1}
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        ) : null}

                                        <View style={styles.momoActionRow}>
                                            <TouchableOpacity
                                                activeOpacity={0.7}
                                                style={[styles.momoActionChip, { borderColor: colors.border }]}
                                                disabled={momoSending || momoChecking}
                                                onPress={handleCheckMomoStatus}
                                            >
                                                {momoChecking ? (
                                                    <View style={styles.momoActionChipInner}>
                                                        <ActivityIndicator size="small" color={colors.primary} />
                                                        <AppText label="Checking…" color={colors.primary} fontSize={13} variant={1} />
                                                    </View>
                                                ) : (
                                                    <AppText label="Check status" color={colors.primary} fontSize={13} variant={1} />
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                activeOpacity={0.7}
                                                style={[
                                                    styles.momoActionChip,
                                                    {
                                                        borderColor: colors.border,
                                                        opacity: momoChecking ? 0.35 : 1,
                                                    },
                                                ]}
                                                disabled={momoSending || momoChecking}
                                                onPress={handleParkMomoAndServeNext}
                                            >
                                                <AppText label="Park" color={colors.primary} fontSize={13} variant={1} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                activeOpacity={0.7}
                                                style={[
                                                    styles.momoActionChip,
                                                    {
                                                        borderColor: colors.border,
                                                        opacity: momoChecking ? 0.35 : 1,
                                                    },
                                                ]}
                                                disabled={momoSending || momoChecking}
                                                onPress={handleCancelMomoAndSendAgain}
                                            >
                                                <AppText label="Send again" color={colors.textSecondary} fontSize={13} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : null}

                                {selectedPaymentOption.transactionRef && selectedPaymentOption.paid && momoStatusText ? (
                                    <AppText
                                        label={momoStatusText}
                                        fontSize={12}
                                        color={colors.textTertiary}
                                        style={{ marginTop: 10 }}
                                    />
                                ) : null}
                            </View>
                        ) : null}

                        {(selectedPaymentOption.method === 'cash' ||
                            (selectedPaymentOption.method === 'momo' &&
                                selectedPaymentOption.paid &&
                                selectedPaymentOption.transactionRef)) ? (
                            <TouchableOpacity
                                activeOpacity={0.8}
                                disabled={
                                    momoSending ||
                                    (selectedPaymentOption.method === 'cash' && !cashTenderOk)
                                }
                                style={[
                                    styles.savePrintBtn,
                                    {
                                        marginTop: 16,
                                        opacity:
                                            momoSending ||
                                            (selectedPaymentOption.method === 'cash' && !cashTenderOk)
                                                ? 0.45
                                                : 1,
                                    },
                                ]}
                                onPress={handleSavePrint}
                            >
                                <AppText label={completeLabel} color={colors.textInverse} variant={1} />
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                            activeOpacity={0.7}
                            disabled={momoChecking}
                            onPress={handlePaymentOptionsClose}
                            style={[styles.cancelPaymentBtn, { opacity: momoChecking ? 0.35 : 1 }]}
                        >
                            <AppText label="Cancel" color={colors.textSecondary} />
                        </TouchableOpacity>
                    </ScrollView>
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
    paymentModalContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
    methodSeg: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    methodSegBtn: {
        flex: 1,
        height: 40,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    paymentSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    paymentInput: { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontFamily: 'FiraSans-Regular', fontSize: 16 },
    continuePaymentBtn: { height: 46, backgroundColor: config.THEME_COLOR, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    networkRow: {
        flexDirection: 'row',
        gap: 8,
    },
    networkChip: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    networkChipInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    networkLogo: {
        width: 20,
        height: 20,
        borderRadius: 4,
    },
    momoActionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    momoActionChip: {
        flex: 1,
        minHeight: 40,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    momoActionChipInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    savePrintBtn: { height: 50, backgroundColor: config.THEME_COLOR, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    cancelPaymentBtn: { alignItems: 'center', paddingVertical: 12 },
});

export default NewSale;