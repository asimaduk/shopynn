import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { customerProfiles, orders } from '../../services/api';
import { clearCart, getCartItems } from '../../store/cartStore';

const computeRequiredInitial = (total, items) => {
    let maxPct = 0;
    let minFloor = 0;
    for (const it of items) {
        const pct = Number(it.installment_min_initial_percent);
        if (Number.isFinite(pct) && pct > maxPct) maxPct = pct;
        const floor = Number(it.installment_min_payment_amount);
        if (Number.isFinite(floor) && floor > minFloor) minFloor = floor;
    }
    if (maxPct <= 0) return 0;
    const fromPct = Math.round((total * maxPct) / 100 * 100) / 100;
    return Math.max(fromPct, minFloor);
};

const Checkout = ({ navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);
    const [fulfillmentType, setFulfillmentType] = useState('');
    const [notes, setNotes] = useState('');
    const [storeMinAmount, setStoreMinAmount] = useState(0);
    const [paymentMode, setPaymentMode] = useState('full');
    const [initialPayment, setInitialPayment] = useState('');

    const items = getCartItems();
    const totalItems = useMemo(
        () => items.reduce((sum, it) => sum + Number(it.quantity || 0), 0),
        [items]
    );
    const total = useMemo(
        () => items.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.unit_price || 0), 0),
        [items]
    );

    const warehouseId = items[0]?.warehouse_id;
    const allInstallmentEligible = useMemo(
        () => items.length > 0 && items.every((it) => Boolean(it.installment_enabled)),
        [items]
    );
    const requiredInitial = useMemo(
        () => (paymentMode === 'installment' ? computeRequiredInitial(total, items) : 0),
        [paymentMode, total, items]
    );

    useEffect(() => {
        if (!allInstallmentEligible && paymentMode === 'installment') {
            setPaymentMode('full');
        }
    }, [allInstallmentEligible, paymentMode]);

    useEffect(() => {
        if (paymentMode === 'installment' && requiredInitial > 0) {
            setInitialPayment(String(requiredInitial));
        } else if (paymentMode === 'full') {
            setInitialPayment('');
        }
    }, [paymentMode, requiredInitial]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!warehouseId) {
                if (mounted) setStoreMinAmount(0);
                return;
            }
            try {
                const list = await customerProfiles.stores();
                const row = Array.isArray(list) ? list.find((s) => String(s?.warehouse_id) === String(warehouseId)) : null;
                const m = Number(row?.minimum_order_amount ?? 0);
                if (mounted) setStoreMinAmount(Number.isFinite(m) && m > 0 ? m : 0);
            } catch (_) {
                if (mounted) setStoreMinAmount(0);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [warehouseId]);

    const submit = async () => {
        if (!items.length) {
            Alert.alert('Cart empty', 'Add items before checkout.');
            return;
        }
        if (!fulfillmentType) {
            Alert.alert('Fulfillment required', 'Please choose pickup or delivery before placing the order.');
            return;
        }
        if (!warehouseId) return;
        if (storeMinAmount > 0 && total < storeMinAmount) {
            Alert.alert(
                'Minimum order',
                `This store requires a minimum order of GHS ${storeMinAmount.toFixed(2)}. Your total is GHS ${total.toFixed(2)}.`
            );
            return;
        }
        const initialAmt = paymentMode === 'installment' ? Number(initialPayment || 0) : 0;
        if (paymentMode === 'installment') {
            if (initialAmt < requiredInitial - 0.02) {
                Alert.alert(
                    'Initial payment',
                    `Minimum initial payment is GHS ${requiredInitial.toFixed(2)}.`
                );
                return;
            }
            if (initialAmt > total + 0.02) {
                Alert.alert('Initial payment', 'Initial payment cannot exceed order total.');
                return;
            }
        }
        setLoading(true);
        try {
            const payload = {
                warehouse_id: warehouseId,
                fulfillment_type: fulfillmentType,
                notes,
                items: items.map((it) => ({
                    product_id: it.product_id,
                    quantity: Number(it.quantity || 0),
                    unit_price: Number(it.unit_price || 0),
                })),
            };
            if (paymentMode === 'installment') {
                payload.payment_mode = 'installment';
                payload.initial_payment_amount = initialAmt;
            }
            const createdOrder = await orders.create(payload);
            clearCart();
            navigation.navigate('CheckoutSuccess', {
                orderNumber: createdOrder?.order_number || null,
                paymentMode,
                orderId: createdOrder?.id,
                balanceDue: createdOrder?.balance_due,
            });
        } catch (error) {
            Alert.alert('Checkout failed', error?.response?.data?.message || 'Could not place order.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(0, insets.top) : 0}
            >
                <ScreenHeader onPress={() => navigation.goBack()} label="Checkout" />
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ padding: 12, paddingBottom: 36 }}
                >
                <View style={[styles.infoBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <Lucide name="info" size={16} color={config.THEME_COLOR} />
                    <AppText
                        label={
                            paymentMode === 'installment'
                                ? 'Pay over time: pay any amount after the store confirms your order until the balance is cleared.'
                                : 'You will pay after the store confirms your order. Complete checkout to submit — payment opens from order details once confirmed.'
                        }
                        fontSize={12}
                        color={colors.textSecondary}
                        style={{ flex: 1, marginLeft: 8 }}
                    />
                </View>
                {storeMinAmount > 0 ? (
                    <View style={[styles.minBanner, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <AppText
                            label={`Minimum order for this store: GHS ${storeMinAmount.toFixed(2)}`}
                            fontSize={12}
                            color={total >= storeMinAmount ? colors.textSecondary : colors.error || '#DC2626'}
                            variant={total >= storeMinAmount ? 0 : 1}
                        />
                    </View>
                ) : null}
                {allInstallmentEligible ? (
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.sectionHeader}>
                            <Lucide name="wallet" size={15} color={colors.textSecondary} />
                            <AppText label="Payment option" color={colors.textSecondary} fontSize={13} style={{ marginLeft: 6 }} />
                        </View>
                        <View style={styles.row}>
                            {[
                                { id: 'full', label: 'Pay in full' },
                                { id: 'installment', label: 'Pay over time' },
                            ].map((opt) => (
                                <TouchableOpacity
                                    key={opt.id}
                                    onPress={() => setPaymentMode(opt.id)}
                                    style={[
                                        styles.chip,
                                        {
                                            borderColor: paymentMode === opt.id ? config.THEME_COLOR : colors.border,
                                            backgroundColor: paymentMode === opt.id ? config.THEME_COLOR : colors.surfaceSecondary,
                                        },
                                    ]}
                                >
                                    <AppText label={opt.label} color={paymentMode === opt.id ? '#fff' : config.THEME_COLOR} />
                                </TouchableOpacity>
                            ))}
                        </View>
                        {paymentMode === 'installment' ? (
                            <View style={{ marginTop: 10 }}>
                                {requiredInitial > 0 ? (
                                    <AppText
                                        label={`Minimum initial payment: GHS ${requiredInitial.toFixed(2)}`}
                                        fontSize={12}
                                        color={colors.textSecondary}
                                        style={{ marginBottom: 6 }}
                                    />
                                ) : null}
                                <TextInput
                                    value={initialPayment}
                                    onChangeText={setInitialPayment}
                                    placeholder="Initial payment (optional)"
                                    placeholderTextColor={colors.placeholder}
                                    keyboardType="decimal-pad"
                                    style={[styles.input, { borderColor: colors.border, color: colors.text, minHeight: 44 }]}
                                />
                                <AppText
                                    label={`Balance after checkout: GHS ${Math.max(0, total - Number(initialPayment || 0)).toFixed(2)}`}
                                    fontSize={12}
                                    color={config.THEME_COLOR}
                                    style={{ marginTop: 6 }}
                                />
                            </View>
                        ) : null}
                    </View>
                ) : null}
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.sectionHeader}>
                        <Lucide name="shopping-bag" size={15} color={colors.textSecondary} />
                        <AppText label="Items in this order" color={colors.textSecondary} fontSize={13} style={{ marginLeft: 6 }} />
                    </View>
                    <View style={{ marginTop: 8, gap: 8 }}>
                        {items.map((it, idx) => (
                            <View key={it.key || `${it.product_id}-${idx}`} style={[styles.itemCard, { backgroundColor: colors.surfaceSecondary }]}>
                                <View style={{ flex: 1 }}>
                                    <AppText label={it.name || 'Item'} color={colors.text} variant={1} fontSize={14} numberOfLines={1} />
                                    <AppText
                                        label={`${Number(it.quantity || 0)} x GHS ${Number(it.unit_price || 0).toFixed(2)}`}
                                        color={colors.textSecondary}
                                        fontSize={12}
                                        style={{ marginTop: 2 }}
                                    />
                                </View>
                                <AppText
                                    label={`GHS ${(Number(it.quantity || 0) * Number(it.unit_price || 0)).toFixed(2)}`}
                                    color={colors.text}
                                    fontSize={13}
                                />
                            </View>
                        ))}
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
                    <View style={styles.sectionHeader}>
                        <Lucide name="truck" size={15} color={colors.textSecondary} />
                        <AppText label="Fulfillment type" color={colors.textSecondary} fontSize={13} style={{ marginLeft: 6 }} />
                    </View>
                    <View style={styles.row}>
                        {['pickup', 'delivery'].map((type) => (
                            <TouchableOpacity
                                key={type}
                                onPress={() => setFulfillmentType(type)}
                                style={[
                                    styles.chip,
                                    {
                                        borderColor: fulfillmentType === type ? config.THEME_COLOR : colors.border,
                                        backgroundColor: fulfillmentType === type ? config.THEME_COLOR : colors.surfaceSecondary,
                                    },
                                ]}
                            >
                                <Lucide
                                    name={type === 'pickup' ? 'store' : 'bike'}
                                    size={14}
                                    color={fulfillmentType === type ? '#fff' : colors.textSecondary}
                                />
                                <AppText label={type} color={fulfillmentType === type ? '#fff' : config.THEME_COLOR} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
                    <View style={styles.heroTopRow}>
                        <View style={[styles.heroIconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                            <Lucide name="receipt-text" size={17} color={config.THEME_COLOR} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <AppText label="Review your order" variant={1} color={colors.text} fontSize={16} />
                            <AppText label={`${totalItems} item(s) ready`} color={colors.textSecondary} fontSize={12} style={{ marginTop: 2 }} />
                        </View>
                    </View>
                    <View style={[styles.heroStats, { backgroundColor: colors.surfaceSecondary }]}>
                        <View>
                            <AppText label="Order total" color={colors.textSecondary} fontSize={12} />
                            <AppText label={`GHS ${total.toFixed(2)}`} variant={1} color={config.THEME_COLOR} fontSize={18} style={{ marginTop: 2 }} />
                        </View>
                        <View style={[styles.heroDivider, { backgroundColor: colors.border }]} />
                        <View>
                            <AppText label="Fulfillment" color={colors.textSecondary} fontSize={12} />
                            <AppText
                                label={fulfillmentType ? (fulfillmentType === 'pickup' ? 'Pickup' : 'Delivery') : 'Not selected'}
                                color={fulfillmentType ? colors.text : colors.textSecondary}
                                variant={1}
                                style={{ marginTop: 2 }}
                            />
                        </View>
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
                    <View style={styles.sectionHeader}>
                        <Lucide name="sticky-note" size={15} color={colors.textSecondary} />
                        <AppText label="Notes" color={colors.textSecondary} fontSize={13} style={{ marginLeft: 6 }} />
                    </View>
                    <TextInput
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Any delivery/pickup note"
                        placeholderTextColor={colors.placeholder}
                        multiline
                        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                    />
                </View>

                <View style={[styles.payCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <AppText label="Order total" color={colors.textSecondary} />
                        <AppText label={`GHS ${total.toFixed(2)}`} variant={1} color={config.THEME_COLOR} />
                    </View>
                    <TouchableOpacity
                        onPress={submit}
                        disabled={loading || !fulfillmentType || (storeMinAmount > 0 && total < storeMinAmount)}
                        style={[
                            styles.btn,
                            {
                                backgroundColor: config.THEME_COLOR,
                                opacity: loading || !fulfillmentType || (storeMinAmount > 0 && total < storeMinAmount) ? 0.45 : 1,
                            },
                        ]}
                    >
                        <AppText
                            label={
                                loading
                                    ? 'Placing order...'
                                    : paymentMode === 'installment'
                                      ? 'Place pay-over-time order'
                                      : 'Place order'
                            }
                            color="#fff"
                            variant={1}
                        />
                    </TouchableOpacity>
                </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
    },
    minBanner: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 10,
    },
    heroCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
    heroTopRow: { flexDirection: 'row', alignItems: 'center' },
    heroIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    heroStats: { marginTop: 12, borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroDivider: { width: 1, alignSelf: 'stretch', marginHorizontal: 14 },
    card: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center' },
    itemCard: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    row: { flexDirection: 'row', gap: 8, marginTop: 10 },
    chip: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
    input: { marginTop: 6, borderWidth: 1, borderRadius: 8, minHeight: 82, textAlignVertical: 'top', padding: 10 },
    payCard: { marginTop: 12, borderWidth: 1, borderRadius: 10, padding: 12 },
    btn: { marginTop: 12, borderRadius: 10, alignItems: 'center', paddingVertical: 13 },
});

export default Checkout;
