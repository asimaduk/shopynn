import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { orders } from '../../services/api';

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'completed'];
const formatStatusLabel = (value) =>
    String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
const getStatusPalette = (value) => {
    const status = String(value || '').toLowerCase();
    if (status === 'completed' || status === 'delivered') return { bg: '#dcfce7', text: '#16a34a' };
    if (status === 'cancelled') return { bg: '#fee2e2', text: '#dc2626' };
    if (status === 'processing' || status === 'confirmed' || status === 'shipped') return { bg: '#dbeafe', text: '#2563eb' };
    if (status === 'ready') return { bg: '#ede9fe', text: '#7c3aed' };
    return { bg: '#fef3c7', text: '#d97706' };
};


const MyOrderDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const orderId = route?.params?.orderId;
    const [order, setOrder] = useState(null);
    const [history, setHistory] = useState([]);
    const [payAmount, setPayAmount] = useState('');

    const loadOrder = useCallback(async () => {
        if (!orderId) return;
        try {
            const data = await orders.get(orderId);
            setOrder(data || null);
            const h = await orders.history(orderId);
            setHistory(Array.isArray(h) ? h : []);
        } catch (_) {
            setOrder(null);
            setHistory([]);
        }
    }, [orderId]);

    useFocusEffect(
        useCallback(() => {
            loadOrder();
        }, [loadOrder])
    );

    const canCancel = ['pending', 'confirmed'].includes(String(order?.status || '').toLowerCase());
    const cancel = async () => {
        try {
            await orders.cancel(orderId, 'Cancelled by customer');
            Alert.alert('Cancelled', 'Order cancelled.');
            navigation.goBack();
        } catch (error) {
            Alert.alert('Failed', error?.response?.data?.message || 'Could not cancel order.');
        }
    };
    const confirmCancel = () => {
        Alert.alert(
            'Cancel order?',
            'Are you sure you want to cancel this order? This action cannot be undone.',
            [
                { text: 'Keep order', style: 'cancel' },
                { text: 'Cancel order', style: 'destructive', onPress: cancel },
            ]
        );
    };

    const callVendor = async () => {
        const phone =
            order?.vendor_phone ||
            order?.warehouse_phone ||
            order?.store_phone ||
            order?.delivery?.courier_phone ||
            '';
        const sanitized = String(phone).trim();
        if (!sanitized) {
            Alert.alert('Contact unavailable', 'No contact phone number is available for this order yet.');
            return;
        }
        const telUrl = `tel:${sanitized}`;
        const supported = await Linking.canOpenURL(telUrl);
        if (!supported) {
            Alert.alert('Unable to call', 'This device cannot place phone calls right now.');
            return;
        }
        Linking.openURL(telUrl);
    };

    const currentStatus = String(order?.status || '').toLowerCase();
    const currentIdx = STATUS_STEPS.indexOf(currentStatus);
    const visited = new Set(
        history
            .flatMap((entry) => [entry?.from_status, entry?.to_status])
            .map((s) => String(s || '').toLowerCase())
            .filter(Boolean)
    );
    if (currentStatus) visited.add(currentStatus);
    const completionEntry = [...history]
        .reverse()
        .find((entry) => String(entry?.to_status || '').toLowerCase() === 'completed' && String(entry?.reason || '').trim());
    const completionReason = completionEntry ? String(completionEntry.reason || '').trim() : '';
    const cancelledEntry = [...history]
        .reverse()
        .find((entry) => String(entry?.to_status || '').toLowerCase() === 'cancelled' && String(entry?.reason || '').trim());
    const cancelledReason = cancelledEntry ? String(cancelledEntry.reason || '').trim() : '';

    const paymentStatus = String(order?.payment_status || 'unpaid').toLowerCase();
    const isInstallment = String(order?.payment_mode || 'full').toLowerCase() === 'installment';
    const balanceDue = Number(order?.balance_due ?? 0);
    const amountPaid = Number(order?.amount_paid ?? 0);
    const totalAmount = Number(order?.total_amount || 0);
    const payProgress = totalAmount > 0 ? Math.min(100, (amountPaid / totalAmount) * 100) : 0;
    const installmentPayments = Array.isArray(order?.installment_payments) ? order.installment_payments : [];
    const canPayFull =
        !isInstallment &&
        currentStatus === 'confirmed' &&
        ['unpaid', 'failed', 'pending'].includes(paymentStatus);
    const canPayPartial = Boolean(order?.can_pay_partial) || (isInstallment && currentStatus === 'confirmed' && balanceDue > 0);

    const presetAmounts = useMemo(() => {
        const b = balanceDue;
        if (b <= 0) return [];
        const presets = [
            { label: '25%', value: Math.round(b * 0.25 * 100) / 100 },
            { label: '50%', value: Math.round(b * 0.5 * 100) / 100 },
            { label: 'Remaining', value: b },
        ];
        return presets.filter((p) => p.value > 0);
    }, [balanceDue]);

    const openOrderPayment = (amount) => {
        if (!orderId) return;
        const pay = amount != null ? Number(amount) : Number(order?.total_amount || 0);
        if (!Number.isFinite(pay) || pay <= 0) {
            Alert.alert('Amount required', 'Enter a payment amount greater than zero.');
            return;
        }
        if (isInstallment && pay > balanceDue + 0.02) {
            Alert.alert('Amount too high', `Maximum payment is GHS ${balanceDue.toFixed(2)}.`);
            return;
        }
        navigation.navigate('Payment', {
            flowType: isInstallment ? 'order_partial' : 'order',
            orderId,
            amount: pay,
            planName: order?.order_number || 'Order payment',
            onSuccessNavigateTo: 'MyOrderDetails',
            onSuccessNavigateParams: { orderId },
        });
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Order details" />
            <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
                <View style={[styles.heroCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.heroTopRow}>
                        <View style={{ flex: 1 }}>
                            <AppText label={order?.order_number || 'Order'} variant={1} color={colors.text} fontSize={18} />
                            <AppText label="Order details" color={colors.textSecondary} fontSize={12} style={{ marginTop: 2 }} />
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                            <View style={[styles.heroStatusPill, { backgroundColor: getStatusPalette(order?.status).bg }]}>
                                <Lucide name="activity" size={12} color={getStatusPalette(order?.status).text} />
                                <AppText
                                    label={formatStatusLabel(order?.status || 'pending')}
                                    color={getStatusPalette(order?.status).text}
                                    fontSize={11}
                                    variant={1}
                                    style={{ marginLeft: 5 }}
                                />
                            </View>
                            {paymentStatus === 'paid' && (
                                <View style={[styles.heroStatusPill, { backgroundColor: '#dcfce7' }]}>
                                    <Lucide name="badge-check" size={12} color="#16a34a" />
                                    <AppText label="Paid" color="#16a34a" fontSize={11} variant={1} style={{ marginLeft: 5 }} />
                                </View>
                            )}
                            {isInstallment && balanceDue > 0 && (
                                <View style={[styles.heroStatusPill, { backgroundColor: '#ede9fe' }]}>
                                    <Lucide name="wallet" size={12} color="#7c3aed" />
                                    <AppText label="Balance due" color="#7c3aed" fontSize={11} variant={1} style={{ marginLeft: 5 }} />
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={[styles.heroMetaWrap, { backgroundColor: colors.surfaceSecondary }]}>
                        <View style={styles.heroMetaBlock}>
                            <View style={styles.infoRow}>
                                <Lucide name="truck" size={13} color={colors.textSecondary} />
                                <AppText label="Fulfillment" color={colors.textSecondary} fontSize={11} style={{ marginLeft: 5 }} />
                            </View>
                            <AppText
                                label={formatStatusLabel(order?.fulfillment_type || 'pickup')}
                                color={colors.text}
                                variant={1}
                                style={{ marginTop: 2 }}
                            />
                        </View>

                        <View style={[styles.heroMetaDivider, { backgroundColor: colors.border }]} />

                        <View style={[styles.heroMetaBlock, styles.heroMetaBlockRight]}>
                            <View style={[styles.infoRow, { justifyContent: 'flex-end' }]}>
                                <Lucide name="wallet" size={13} color={config.THEME_COLOR} />
                                <AppText label="Order total" color={colors.textSecondary} fontSize={11} style={{ marginLeft: 5, textAlign: 'right' }} />
                            </View>
                            <AppText
                                label={`GHS ${Number(order?.total_amount || 0).toFixed(2)}`}
                                color={config.THEME_COLOR}
                                variant={1}
                                fontSize={17}
                                style={{ marginTop: 2, textAlign: 'right' }}
                            />
                        </View>
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.sectionHeadRow}>
                        <Lucide name="store" size={14} color={colors.textSecondary} />
                        <AppText label="Store contact" variant={1} color={colors.text} style={{ marginLeft: 6 }} />
                    </View>
                    <AppText label={order?.warehouse_name || 'Store'} color={colors.text} variant={1} />
                    {!!String(order?.warehouse_contact || '').trim() && (
                        <AppText
                            label={`Contact: ${String(order?.warehouse_contact).trim()}`}
                            color={colors.textSecondary}
                            fontSize={12}
                            style={{ marginTop: 2 }}
                        />
                    )}
                    {!!String(order?.warehouse_phone || '').trim() && (
                        <AppText
                            label={`Phone: ${String(order?.warehouse_phone).trim()}`}
                            color={colors.textSecondary}
                            fontSize={12}
                            style={{ marginTop: 2 }}
                        />
                    )}
                </View>

                {isInstallment && totalAmount > 0 ? (
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.sectionHeadRow}>
                            <Lucide name="wallet" size={14} color={colors.textSecondary} />
                            <AppText label="Pay over time" variant={1} color={colors.text} style={{ marginLeft: 6 }} />
                        </View>
                        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
                            <View style={[styles.progressFill, { width: `${payProgress}%`, backgroundColor: config.THEME_COLOR }]} />
                        </View>
                        <AppText
                            label={`Paid GHS ${amountPaid.toFixed(2)} of GHS ${totalAmount.toFixed(2)} · Balance GHS ${balanceDue.toFixed(2)}`}
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ marginTop: 8 }}
                        />
                        {installmentPayments.length > 0 ? (
                            <View style={{ marginTop: 10, gap: 6 }}>
                                {installmentPayments.map((p) => (
                                    <View key={p.id} style={[styles.paymentRow, { backgroundColor: colors.surfaceSecondary }]}>
                                        <AppText
                                            label={`GHS ${Number(p.amount || 0).toFixed(2)} · ${String(p.payment_method || '').replace(/_/g, ' ')}`}
                                            color={colors.text}
                                            fontSize={12}
                                        />
                                        <AppText label={String(p.status || '')} color={colors.textSecondary} fontSize={11} />
                                    </View>
                                ))}
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {canPayFull && (
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.sectionHeadRow}>
                            <Lucide name="credit-card" size={14} color={colors.textSecondary} />
                            <AppText label="Pay for this order" variant={1} color={colors.text} style={{ marginLeft: 6 }} />
                        </View>
                        <AppText
                            label="The store has confirmed your order. Continue to the secure payment screen."
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ marginBottom: 10 }}
                        />
                        <TouchableOpacity
                            onPress={() => openOrderPayment()}
                            style={[styles.payPrimaryBtn, { backgroundColor: config.THEME_COLOR }]}
                        >
                            <AppText label={`Continue payment (GHS ${totalAmount.toFixed(2)})`} color="#fff" variant={1} />
                        </TouchableOpacity>
                    </View>
                )}

                {canPayPartial && (
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.sectionHeadRow}>
                            <Lucide name="credit-card" size={14} color={colors.textSecondary} />
                            <AppText label="Make a payment" variant={1} color={colors.text} style={{ marginLeft: 6 }} />
                        </View>
                        <AppText
                            label="Pay any amount up to your remaining balance."
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ marginBottom: 10 }}
                        />
                        <View style={styles.presetRow}>
                            {presetAmounts.map((p) => (
                                <TouchableOpacity
                                    key={p.label}
                                    onPress={() => setPayAmount(String(p.value))}
                                    style={[styles.presetChip, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
                                >
                                    <AppText label={`${p.label}`} fontSize={12} color={colors.text} />
                                    <AppText label={`GHS ${p.value.toFixed(2)}`} fontSize={11} color={config.THEME_COLOR} />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TextInput
                            value={payAmount}
                            onChangeText={setPayAmount}
                            placeholder={`Amount (max GHS ${balanceDue.toFixed(2)})`}
                            placeholderTextColor={colors.placeholder}
                            keyboardType="decimal-pad"
                            style={[styles.amountInput, { borderColor: colors.border, color: colors.text }]}
                        />
                        <TouchableOpacity
                            onPress={() => openOrderPayment(Number(payAmount || balanceDue))}
                            style={[styles.payPrimaryBtn, { backgroundColor: config.THEME_COLOR, marginTop: 10 }]}
                        >
                            <AppText
                                label={`Pay ${Number(payAmount || balanceDue).toFixed(2)} GHS`}
                                color="#fff"
                                variant={1}
                            />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.sectionHeadRow}>
                        <Lucide name="git-branch" size={14} color={colors.textSecondary} />
                        <AppText label="Order status timeline" variant={1} color={colors.text} style={{ marginLeft: 6 }} />
                    </View>
                    {STATUS_STEPS.map((step, idx) => {
                        const done = currentStatus === 'cancelled' ? visited.has(step) : currentIdx >= 0 && idx <= currentIdx;
                        const active = step === currentStatus;
                        return (
                            <View key={step} style={styles.timelineRow}>
                                <View style={styles.timelineLeft}>
                                    <View
                                        style={[
                                            styles.timelineDot,
                                            {
                                                backgroundColor: done ? config.THEME_COLOR : colors.surfaceSecondary,
                                                borderColor: done ? config.THEME_COLOR : colors.border,
                                            },
                                        ]}
                                    />
                                    {idx < STATUS_STEPS.length - 1 && (
                                        <View
                                            style={[
                                                styles.timelineLine,
                                                {
                                                    backgroundColor: done ? config.THEME_COLOR : colors.border,
                                                },
                                            ]}
                                        />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <AppText
                                        label={formatStatusLabel(step)}
                                        variant={active ? 1 : 2}
                                        color={active ? colors.text : colors.textSecondary}
                                    />
                                </View>
                                {done && <Lucide name="check" size={14} color={config.THEME_COLOR} />}
                            </View>
                        );
                    })}
                    {currentStatus === 'cancelled' && (
                        <View style={[styles.cancelTag, { backgroundColor: '#fee2e2' }]}>
                            <AppText label="Cancelled" color="#dc2626" variant={1} fontSize={11} />
                        </View>
                    )}
                    {currentStatus === 'cancelled' && cancelledReason ? (
                        <View style={[styles.noteCard, { backgroundColor: '#fee2e2' }]}>
                            <AppText label="Note" color="#dc2626" fontSize={11} />
                            <AppText label={cancelledReason} color={colors.text} style={{ marginTop: 4 }} />
                        </View>
                    ) : null}
                    {currentStatus === 'completed' && completionReason ? (
                        <View style={[styles.noteCard, { backgroundColor: colors.surfaceSecondary }]}>
                            <AppText label="Completion note" color={colors.textSecondary} fontSize={11} />
                            <AppText label={completionReason} color={colors.text} style={{ marginTop: 4 }} />
                        </View>
                    ) : null}
                </View>
                {Array.isArray(order?.items) && order.items.length > 0 && (
                    <View style={[styles.card, { backgroundColor: colors.surface }]}>
                        <View style={styles.sectionHeadRow}>
                            <Lucide name="package" size={14} color={colors.textSecondary} />
                            <AppText label="Items" variant={1} color={colors.text} style={{ marginLeft: 6 }} />
                        </View>
                        <View style={[styles.tableWrap, { borderColor: colors.border }]}>
                            <View style={[styles.tableHead, { borderBottomColor: colors.border }]}>
                                <View style={[styles.colItem]}>
                                    <AppText label="Item" color={colors.textSecondary} fontSize={11} variant={1} />
                                </View>
                                <View style={[styles.colQty]}>
                                    <AppText label="Qty" color={colors.textSecondary} fontSize={11} variant={1} />
                                </View>
                                <View style={[styles.colUnit]}>
                                    <AppText label="Unit (GHS)" color={colors.textSecondary} fontSize={11} variant={1} />
                                </View>
                                <View style={[styles.colTotal]}>
                                    <AppText label="Line total (GHS)" color={colors.textSecondary} fontSize={11} variant={1} />
                                </View>
                            </View>
                            {order.items.map((item, idx) => {
                                const qty = Number(item.quantity || 0);
                                const unit = Number(item.unit_price || 0);
                                const lineTotal = Number(item.line_total || qty * unit);
                                return (
                                    <View
                                        key={item.id}
                                        style={[
                                            styles.tableRow,
                                            idx < order.items.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                                        ]}
                                    >
                                        <View style={[styles.colItem]}>
                                            <AppText label={item.product_name || 'Item'} color={colors.text} numberOfLines={1} />
                                        </View>
                                        <View style={[styles.colQty]}>
                                            <AppText label={String(qty)} color={colors.textSecondary} />
                                        </View>
                                        <View style={[styles.colUnit]}>
                                            <AppText label={unit.toFixed(2)} color={colors.textSecondary} />
                                        </View>
                                        <View style={[styles.colTotal]}>
                                            <AppText label={lineTotal.toFixed(2)} color={colors.text} variant={1} />
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        onPress={callVendor}
                        style={[
                            styles.actionBtn,
                            { backgroundColor: colors.primary },
                        ]}
                    >
                        <View style={styles.actionRow}>
                            <Lucide name="phone-call" size={14} color={colors.textInverse} />
                            <AppText label="Call contact" color={colors.textInverse} variant={1} style={{ marginLeft: 6 }} />
                        </View>
                    </TouchableOpacity>
                    {canCancel && (
                        <TouchableOpacity
                            onPress={confirmCancel}
                            style={[
                                styles.actionBtn,
                                { backgroundColor: colors.error },
                            ]}
                            activeOpacity={0.8}
                        >
                            <View style={styles.actionRow}>
                                <Lucide name="ban" size={14} color={colors.textInverse} />
                                <AppText label="Cancel order" color={colors.textInverse} variant={1} style={{ marginLeft: 6 }} />
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    card: { borderRadius: 10, padding: 12, marginBottom: 10 },
    heroCard: { borderRadius: 12, padding: 12, marginBottom: 10 },
    heroTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
    heroStatusPill: {
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 5,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
    },
    heroMetaWrap: {
        marginTop: 12,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    heroMetaBlock: { flex: 1 },
    heroMetaBlockRight: { alignItems: 'flex-end' },
    heroMetaDivider: { width: 1, marginHorizontal: 10 },
    statusRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center' },
    statusPill: { marginLeft: 6, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    infoRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center' },
    sectionHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    tableWrap: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
    tableHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1 },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10 },
    colItem: { flex: 1.8, paddingRight: 8 },
    colQty: { flex: 0.6, alignItems: 'flex-start' },
    colUnit: { flex: 0.9, alignItems: 'flex-start' },
    colTotal: { flex: 1, alignItems: 'flex-end' },
    itemRow: { marginBottom: 6 },
    timelineRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 34 },
    timelineLeft: { width: 20, alignItems: 'center' },
    timelineDot: { width: 10, height: 10, borderRadius: 10, borderWidth: 2, marginTop: 3 },
    timelineLine: { width: 2, flex: 1, marginTop: 2, marginBottom: -4 },
    cancelTag: { alignSelf: 'flex-start', marginTop: 8, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
    noteCard: { marginTop: 10, borderRadius: 8, padding: 10 },
    actionsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
    actionBtn: { flex: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center', paddingVertical: 11 },
    actionRow: { flexDirection: 'row', alignItems: 'center' },
    payMethodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    payMethodChip: { flex: 1, borderWidth: 1.5, borderRadius: 5, paddingVertical: 10, alignItems: 'center' },
    payPrimaryBtn: { borderRadius: 5, paddingVertical: 13, alignItems: 'center' },
    progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
    progressFill: { height: '100%', borderRadius: 4 },
    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    presetChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minWidth: 90 },
    amountInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
    paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderRadius: 6 },
    payOutlineBtn: { marginTop: 10, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5 },
    payInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
    providerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    providerChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
});

export default MyOrderDetails;
