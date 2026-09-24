import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
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
    const fromPct = Math.round(((total * maxPct) / 100) * 100) / 100;
    return Math.max(fromPct, minFloor);
};

const resolveImageUri = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^(https?:|file:|content:|data:)/i.test(value)) return value;
    return `${config.BASE_API}/images?id=${encodeURIComponent(value)}`;
};

const OptionTile = ({ selected, onPress, icon, title, subtitle, colors, compact = false }) => (
    <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[
            styles.optionTile,
            compact && styles.optionTileCompact,
            {
                borderColor: selected ? config.THEME_COLOR : colors.border,
                backgroundColor: selected ? `${config.THEME_COLOR}12` : colors.surface,
            },
        ]}
    >
        <View
            style={[
                styles.optionIcon,
                { backgroundColor: selected ? config.THEME_COLOR : colors.surfaceSecondary },
            ]}
        >
            <Lucide name={icon} size={16} color={selected ? '#fff' : colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
            <AppText label={title} variant={1} fontSize={14} color={colors.text} />
            {subtitle ? (
                <AppText
                    label={subtitle}
                    fontSize={11}
                    color={colors.textSecondary}
                    style={{ marginTop: 2 }}
                    numberOfLines={compact ? 2 : 2}
                />
            ) : null}
        </View>
        {!compact ? (
            <View
                style={[
                    styles.radio,
                    {
                        borderColor: selected ? config.THEME_COLOR : colors.border,
                        backgroundColor: selected ? config.THEME_COLOR : 'transparent',
                    },
                ]}
            >
                {selected ? <Lucide name="check" size={11} color="#fff" /> : null}
            </View>
        ) : null}
    </TouchableOpacity>
);

const Checkout = ({ navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);
    const [fulfillmentType, setFulfillmentType] = useState('');
    const [notes, setNotes] = useState('');
    const [storeMinAmount, setStoreMinAmount] = useState(0);
    const [paymentMode, setPaymentMode] = useState('full');
    const [payTiming, setPayTiming] = useState('now');
    const [initialPayment, setInitialPayment] = useState('');

    const items = getCartItems();
    const totalItems = useMemo(
        () => items.reduce((sum, it) => sum + Number(it.quantity || 0), 0),
        [items],
    );
    const total = useMemo(
        () => items.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.unit_price || 0), 0),
        [items],
    );

    const warehouseId = items[0]?.warehouse_id;
    const allInstallmentEligible = useMemo(
        () => items.length > 0 && items.every((it) => Boolean(it.installment_enabled)),
        [items],
    );
    const requiredInitial = useMemo(
        () => (paymentMode === 'installment' ? computeRequiredInitial(total, items) : 0),
        [paymentMode, total, items],
    );

    const canSubmit =
        !loading &&
        Boolean(fulfillmentType) &&
        !(storeMinAmount > 0 && total < storeMinAmount);

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
                const row = Array.isArray(list)
                    ? list.find((s) => String(s?.warehouse_id) === String(warehouseId))
                    : null;
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
                `This store requires a minimum order of GHS ${storeMinAmount.toFixed(2)}. Your total is GHS ${total.toFixed(2)}.`,
            );
            return;
        }
        const initialAmt = paymentMode === 'installment' ? Number(initialPayment || 0) : 0;
        if (paymentMode === 'installment') {
            if (initialAmt < requiredInitial - 0.02) {
                Alert.alert('Initial payment', `Minimum initial payment is GHS ${requiredInitial.toFixed(2)}.`);
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
            const orderId = createdOrder?.id;
            const orderNumber = createdOrder?.order_number || null;
            const orderTotal = Number(createdOrder?.total_amount ?? total);
            const wantPayNow = paymentMode === 'full' && payTiming === 'now' && orderId;

            if (wantPayNow) {
                navigation.replace('Payment', {
                    flowType: 'order',
                    orderId,
                    amount: orderTotal,
                    planName: orderNumber || 'Order payment',
                    onSuccessNavigateTo: 'MyOrderDetails',
                    onSuccessNavigateParams: { orderId },
                });
                return;
            }

            navigation.replace('CheckoutSuccess', {
                orderNumber,
                paymentMode,
                payTiming,
                orderId,
                totalAmount: orderTotal,
                balanceDue: createdOrder?.balance_due,
            });
        } catch (error) {
            Alert.alert('Checkout failed', error?.response?.data?.message || 'Could not place order.');
        } finally {
            setLoading(false);
        }
    };

    const ctaLabel = loading
        ? 'Placing order...'
        : paymentMode === 'installment'
          ? 'Place pay-over-time order'
          : payTiming === 'now'
            ? `Place order & pay · GHS ${total.toFixed(2)}`
            : `Place order · GHS ${total.toFixed(2)}`;

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(0, insets.top) : 0}
            >
                <ScreenHeader onPress={() => navigation.goBack()} label="Checkout" />
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140 }}
                    showsVerticalScrollIndicator={false}
                >
                    <AppText
                        label={`${totalItems} item${totalItems === 1 ? '' : 's'} · GHS ${total.toFixed(2)}`}
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginBottom: 14 }}
                    />

                    {storeMinAmount > 0 ? (
                        <View
                            style={[
                                styles.notice,
                                {
                                    borderColor:
                                        total >= storeMinAmount
                                            ? colors.border
                                            : colors.error || '#DC2626',
                                    backgroundColor: colors.surface,
                                },
                            ]}
                        >
                            <Lucide
                                name="package"
                                size={15}
                                color={total >= storeMinAmount ? config.THEME_COLOR : colors.error || '#DC2626'}
                            />
                            <AppText
                                label={`Minimum order GHS ${storeMinAmount.toFixed(2)}${
                                    total < storeMinAmount
                                        ? ` · add GHS ${(storeMinAmount - total).toFixed(2)} more`
                                        : ''
                                }`}
                                fontSize={12}
                                color={
                                    total >= storeMinAmount
                                        ? colors.textSecondary
                                        : colors.error || '#DC2626'
                                }
                                style={{ flex: 1, marginLeft: 8 }}
                            />
                        </View>
                    ) : null}

                    <View style={styles.section}>
                        <AppText label="Your items" variant={1} fontSize={15} color={colors.text} />
                        <View
                            style={[
                                styles.panel,
                                { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 10 },
                            ]}
                        >
                            {items.map((it, idx) => {
                                const img = resolveImageUri(it.image_uri || it.thumbnail || it.image);
                                return (
                                    <View
                                        key={it.key || `${it.product_id}-${idx}`}
                                        style={[
                                            styles.lineRow,
                                            idx > 0 && {
                                                borderTopWidth: StyleSheet.hairlineWidth,
                                                borderTopColor: colors.border,
                                            },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.thumb,
                                                { backgroundColor: colors.surfaceSecondary },
                                            ]}
                                        >
                                            {img ? (
                                                <Image source={{ uri: img }} style={styles.thumbImg} />
                                            ) : (
                                                <Lucide name="package" size={16} color={colors.textTertiary || colors.textSecondary} />
                                            )}
                                        </View>
                                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                                            <AppText
                                                label={it.name || 'Item'}
                                                color={colors.text}
                                                variant={1}
                                                fontSize={14}
                                                numberOfLines={2}
                                            />
                                            <AppText
                                                label={`${Number(it.quantity || 0)} × GHS ${Number(it.unit_price || 0).toFixed(2)}`}
                                                color={colors.textSecondary}
                                                fontSize={12}
                                                style={{ marginTop: 2 }}
                                            />
                                        </View>
                                        <AppText
                                            label={`GHS ${(Number(it.quantity || 0) * Number(it.unit_price || 0)).toFixed(2)}`}
                                            color={colors.text}
                                            variant={1}
                                            fontSize={13}
                                        />
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <AppText label="Fulfillment" variant={1} fontSize={15} color={colors.text} />
                        <View style={styles.tileRow}>
                            <OptionTile
                                selected={fulfillmentType === 'pickup'}
                                onPress={() => setFulfillmentType('pickup')}
                                icon="store"
                                title="Pickup"
                                subtitle="Collect from the store"
                                colors={colors}
                                compact
                            />
                            <OptionTile
                                selected={fulfillmentType === 'delivery'}
                                onPress={() => setFulfillmentType('delivery')}
                                icon="bike"
                                title="Delivery"
                                subtitle="To your address"
                                colors={colors}
                                compact
                            />
                        </View>
                    </View>

                    {allInstallmentEligible ? (
                        <View style={styles.section}>
                            <AppText label="Payment plan" variant={1} fontSize={15} color={colors.text} />
                            <View style={styles.tileStack}>
                                <OptionTile
                                    selected={paymentMode === 'full'}
                                    onPress={() => setPaymentMode('full')}
                                    icon="wallet"
                                    title="Pay in full"
                                    subtitle="One payment for the full amount"
                                    colors={colors}
                                />
                                <OptionTile
                                    selected={paymentMode === 'installment'}
                                    onPress={() => setPaymentMode('installment')}
                                    icon="calendar-clock"
                                    title="Pay over time"
                                    subtitle="Pay after the store confirms, until cleared"
                                    colors={colors}
                                />
                            </View>
                            {paymentMode === 'installment' ? (
                                <View
                                    style={[
                                        styles.panel,
                                        {
                                            backgroundColor: colors.surface,
                                            borderColor: colors.border,
                                            marginTop: 10,
                                            padding: 12,
                                        },
                                    ]}
                                >
                                    {requiredInitial > 0 ? (
                                        <AppText
                                            label={`Minimum initial payment: GHS ${requiredInitial.toFixed(2)}`}
                                            fontSize={12}
                                            color={colors.textSecondary}
                                            style={{ marginBottom: 8 }}
                                        />
                                    ) : null}
                                    <TextInput
                                        value={initialPayment}
                                        onChangeText={setInitialPayment}
                                        placeholder="Initial payment (optional)"
                                        placeholderTextColor={colors.placeholder}
                                        keyboardType="decimal-pad"
                                        style={[
                                            styles.input,
                                            {
                                                borderColor: colors.border,
                                                color: colors.text,
                                                minHeight: 46,
                                                backgroundColor: colors.background,
                                            },
                                        ]}
                                    />
                                    <AppText
                                        label={`Balance after checkout: GHS ${Math.max(0, total - Number(initialPayment || 0)).toFixed(2)}`}
                                        fontSize={12}
                                        color={config.THEME_COLOR}
                                        style={{ marginTop: 8 }}
                                    />
                                </View>
                            ) : null}
                        </View>
                    ) : null}

                    {paymentMode === 'full' ? (
                        <View style={styles.section}>
                            <AppText label="When to pay" variant={1} fontSize={15} color={colors.text} />
                            <View style={styles.tileStack}>
                                <OptionTile
                                    selected={payTiming === 'now'}
                                    onPress={() => setPayTiming('now')}
                                    icon="smartphone"
                                    title="Pay now"
                                    subtitle="MoMo or card right after placing the order"
                                    colors={colors}
                                />
                                <OptionTile
                                    selected={payTiming === 'later'}
                                    onPress={() => setPayTiming('later')}
                                    icon="clock-3"
                                    title={fulfillmentType === 'delivery' ? 'Pay on delivery' : 'Pay later'}
                                    subtitle="Settle from order details when you’re ready"
                                    colors={colors}
                                />
                            </View>
                        </View>
                    ) : null}

                    <View style={styles.section}>
                        <AppText label="Notes" variant={1} fontSize={15} color={colors.text} />
                        <AppText
                            label="Optional — delivery instructions or pickup preference"
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ marginTop: 4 }}
                        />
                        <TextInput
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Add a note"
                            placeholderTextColor={colors.placeholder}
                            multiline
                            style={[
                                styles.input,
                                styles.notesInput,
                                {
                                    borderColor: colors.border,
                                    color: colors.text,
                                    backgroundColor: colors.surface,
                                    marginTop: 10,
                                },
                            ]}
                        />
                    </View>
                </ScrollView>

                <View
                    style={[
                        styles.footer,
                        {
                            backgroundColor: colors.surface,
                            borderTopColor: colors.border,
                            paddingBottom: Math.max(12, insets.bottom || 0),
                        },
                    ]}
                >
                    <View style={styles.footerTotalRow}>
                        <View>
                            <AppText label="Total" fontSize={12} color={colors.textSecondary} />
                            <AppText
                                label={`GHS ${total.toFixed(2)}`}
                                variant={1}
                                fontSize={20}
                                color={colors.text}
                                style={{ marginTop: 2 }}
                            />
                        </View>
                        <AppText
                            label={
                                fulfillmentType
                                    ? fulfillmentType === 'pickup'
                                        ? 'Pickup'
                                        : 'Delivery'
                                    : 'Choose fulfillment'
                            }
                            fontSize={12}
                            color={fulfillmentType ? config.THEME_COLOR : colors.textSecondary}
                        />
                    </View>
                    <TouchableOpacity
                        onPress={submit}
                        disabled={!canSubmit}
                        activeOpacity={0.85}
                        style={[
                            styles.cta,
                            {
                                backgroundColor: config.THEME_COLOR,
                                opacity: canSubmit ? 1 : 0.45,
                            },
                        ]}
                    >
                        <AppText label={ctaLabel} color="#fff" variant={1} fontSize={15} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    section: { marginBottom: 22 },
    notice: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
    },
    panel: {
        borderWidth: 1,
        borderRadius: 14,
        overflow: 'hidden',
    },
    lineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    thumb: {
        width: 48,
        height: 48,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    thumbImg: { width: '100%', height: '100%' },
    tileStack: { marginTop: 10, gap: 8 },
    tileRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
    optionTile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1.5,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    optionTileCompact: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        minHeight: 102,
        paddingVertical: 14,
    },
    optionIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        fontFamily: 'FiraSans-Regular',
    },
    notesInput: {
        minHeight: 88,
        textAlignVertical: 'top',
    },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    footerTotalRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    cta: {
        borderRadius: 14,
        alignItems: 'center',
        paddingVertical: 15,
    },
});

export default Checkout;
