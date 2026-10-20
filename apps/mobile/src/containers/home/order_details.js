import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { storeOrders } from '../../services/api';
import { hasFeature, hasPermission } from '../../utils/permissions';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppAlert from '../../utils/appAlert';
import { formatPhone } from '../../utils/format';

/** Mirrors the API's ORDER_STATUS_TRANSITIONS; cancelling is offered separately. */
const TRANSITIONS = {
    pending: ['confirmed'],
    confirmed: ['processing'],
    processing: ['ready'],
    ready: ['shipped', 'completed'],
    shipped: ['delivered'],
    delivered: ['completed'],
    completed: [],
    cancelled: [],
};
const DELIVERY_ONLY_STATUSES = new Set(['shipped', 'delivered']);
const CANCELLABLE_ORDER_STATUSES = new Set(['pending', 'confirmed']);
const RETURNABLE_ORDER_STATUSES = new Set(['delivered', 'completed']);
const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'completed'];

const ACTION_COPY = {
    confirmed: { label: 'Confirm order', icon: 'badge-check' },
    processing: { label: 'Start processing', icon: 'settings' },
    ready: { label: 'Mark ready', icon: 'package-check' },
    shipped: { label: 'Mark shipped', icon: 'truck' },
    delivered: { label: 'Mark delivered', icon: 'map-pin-check' },
    completed: { label: 'Complete order', icon: 'circle-check' },
};

const formatStatusLabel = (value) =>
    String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());

const formatMoney = (value) => `GH₵ ${Number(value || 0).toFixed(2)}`;

const formatDateTime = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const statusPalette = (status, colors) => {
    const s = String(status || '').toLowerCase();
    if (s === 'completed' || s === 'delivered') return { bg: colors.successLight, text: colors.success };
    if (s === 'cancelled') return { bg: colors.errorLight, text: colors.error };
    if (s === 'pending') return { bg: colors.warningLight, text: colors.warning };
    return { bg: colors.primaryShade, text: colors.primary };
};

const paymentPalette = (status, colors) => {
    const s = String(status || '').toLowerCase();
    if (s === 'paid') return { bg: colors.successLight, text: colors.success };
    if (s === 'failed') return { bg: colors.errorLight, text: colors.error };
    if (s === 'pending' || s === 'partially_paid' || s === 'partial') return { bg: colors.warningLight, text: colors.warning };
    return { bg: colors.surfaceSecondary, text: colors.textSecondary };
};

const OrderCard = ({ colors, icon, title, right, children }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {title ? (
            <View style={styles.cardHead}>
                <View style={styles.cardHeadLeft}>
                    {icon ? <Lucide name={icon} size={16} color={colors.textSecondary} /> : null}
                    <AppText label={title} variant={1} fontSize={15} color={colors.text} style={{ marginLeft: icon ? 8 : 0 }} />
                </View>
                {right}
            </View>
        ) : null}
        {children}
    </View>
);

const OrderInfoRow = ({ colors, icon, label, value, sub, onPress, actionIcon }) => (
    <View style={styles.infoRow}>
        <View style={[styles.infoIcon, { backgroundColor: colors.surfaceSecondary }]}>
            <Lucide name={icon} size={16} color={colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
            <AppText label={label} fontSize={11} color={colors.textTertiary} />
            <AppText label={value} fontSize={14} color={colors.text} style={{ marginTop: 1 }} />
            {sub ? <AppText label={sub} fontSize={12} color={colors.textSecondary} style={{ marginTop: 1 }} /> : null}
        </View>
        {onPress ? (
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.7}
                style={[styles.infoAction, { backgroundColor: colors.primaryShade }]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
                <Lucide name={actionIcon} size={16} color={config.THEME_COLOR} />
            </TouchableOpacity>
        ) : null}
    </View>
);

const Badge = ({ label, palette }) => (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
        <AppText label={label} fontSize={11} variant={1} color={palette.text} />
    </View>
);

const OrderDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const user = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const orderId = route?.params?.orderId;
    const [order, setOrder] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [note, setNote] = useState('');
    const [partialAmount, setPartialAmount] = useState('');
    const [partialNote, setPartialNote] = useState('');
    const [busy, setBusy] = useState(false);

    // Staff work orders through /store-orders, which is guarded by orders.status.update.
    // orders.update / orders.cancel are customer-portal permissions.
    const canProcess =
        hasPermission(user, 'orders.status.update') &&
        hasFeature(user, 'orders.status.update', subscriptionFeatures);

    const load = useCallback(async () => {
        if (!orderId) return;
        setLoading(true);
        try {
            const data = await storeOrders.get(orderId);
            setOrder(data || null);
            const h = await storeOrders.history(orderId);
            setHistory(Array.isArray(h) ? h : []);
        } catch (_) {
            setOrder(null);
            setHistory([]);
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    const runAction = async (fn, failTitle) => {
        setBusy(true);
        try {
            await fn();
            setNote('');
            await load();
        } catch (error) {
            AppAlert.alert(failTitle, error?.response?.data?.message || error?.response?.data?.error || 'Try again.');
        } finally {
            setBusy(false);
        }
    };

    const updateStatus = (status) => {
        const copy = ACTION_COPY[status];
        AppAlert.alert(copy?.label || 'Update order', `Move ${order?.order_number || 'this order'} to "${formatStatusLabel(status)}"?`, [
            { text: 'Not now', style: 'cancel' },
            {
                text: 'Yes, update',
                onPress: () =>
                    runAction(
                        () => storeOrders.updateStatus(orderId, status, note.trim() || undefined),
                        'Status update failed',
                    ),
            },
        ]);
    };

    const cancelOrder = () => {
        AppAlert.alert(
            'Cancel order',
            `Cancel ${order?.order_number || 'this order'}? Its items go back into stock and the customer is notified.`,
            [
                { text: 'Keep order', style: 'cancel' },
                {
                    text: 'Cancel order',
                    style: 'destructive',
                    onPress: () =>
                        runAction(
                            () => storeOrders.updateStatus(orderId, 'cancelled', note.trim() || 'Cancelled by store'),
                            'Cancel failed',
                        ),
                },
            ],
        );
    };

    const paymentStatus = String(order?.payment_status || 'unpaid').toLowerCase();
    const isInstallmentOrder = String(order?.payment_mode || 'full').toLowerCase() === 'installment';
    const balanceDue = Number(order?.balance_due ?? 0);
    const amountPaid = Number(order?.amount_paid ?? 0);
    const installmentPayments = Array.isArray(order?.installment_payments) ? order.installment_payments : [];
    const fulfillmentType = String(order?.fulfillment_type || 'pickup').toLowerCase();
    const isDelivery = fulfillmentType === 'delivery';

    const onRecordPartialCash = () => {
        const amt = Number(partialAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
            AppAlert.alert('Invalid amount', 'Enter a valid partial payment amount.');
            return;
        }
        if (amt > balanceDue + 0.02) {
            AppAlert.alert('Too high', `Amount cannot exceed remaining balance (${formatMoney(balanceDue)}).`);
            return;
        }
        AppAlert.alert('Record cash payment', `Record ${formatMoney(amt)} toward this order balance?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Record',
                onPress: () =>
                    runAction(async () => {
                        await storeOrders.recordPartialCash(orderId, { amount: amt, note: partialNote.trim() || undefined });
                        setPartialAmount('');
                        setPartialNote('');
                    }, 'Could not record payment'),
            },
        ]);
    };

    const onMarkCashPaid = () => {
        AppAlert.alert('Mark paid (cash)', `Confirm you collected ${formatMoney(order?.total_amount)} in cash?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Mark paid', onPress: () => runAction(() => storeOrders.markPaidCash(orderId, {}), 'Could not mark paid') },
        ]);
    };

    const callCustomer = () => {
        const phone = String(order?.customer_phone || '').replace(/[^\d+]/g, '');
        if (!phone) return;
        Linking.openURL(`tel:${phone}`).catch(() =>
            AppAlert.alert('Calls not available', 'This device cannot make phone calls.'),
        );
    };

    if (loading && !order) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={() => navigation.goBack()} label="Order details" />
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                </View>
            </SafeAreaView>
        );
    }

    if (!order) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={() => navigation.goBack()} label="Order details" />
                <View style={styles.loader}>
                    <Lucide name="package-x" size={32} color={colors.textTertiary} />
                    <AppText label="Order not found" color={colors.textSecondary} style={{ marginTop: 10 }} />
                </View>
            </SafeAreaView>
        );
    }

    const currentStatus = String(order.status || 'pending').toLowerCase();
    const isCancelled = currentStatus === 'cancelled';
    const actions = canProcess
        ? (TRANSITIONS[currentStatus] || []).filter((s) => isDelivery || !DELIVERY_ONLY_STATUSES.has(s))
        : [];
    const canCancel = canProcess && CANCELLABLE_ORDER_STATUSES.has(currentStatus);
    const canMarkCashPaid =
        canProcess &&
        !(isInstallmentOrder && balanceDue > 0.02) &&
        paymentStatus !== 'paid' &&
        ((!isDelivery && currentStatus === 'completed') ||
            (isDelivery && (currentStatus === 'delivered' || currentStatus === 'completed')));
    const canRecordPartialCash = canProcess && isInstallmentOrder && balanceDue > 0.02;
    const canReturn = RETURNABLE_ORDER_STATUSES.has(currentStatus);

    const steps = STATUS_STEPS.filter((s) => isDelivery || !DELIVERY_ONLY_STATUSES.has(s));
    const reached = new Set(
        history.flatMap((e) => [e?.from_status, e?.to_status]).map((s) => String(s || '').toLowerCase()),
    );
    reached.add(currentStatus);
    const currentIdx = steps.indexOf(currentStatus);
    const timelineSteps = isCancelled ? [...steps.filter((s) => reached.has(s)), 'cancelled'] : steps;

    const reasonFor = (status) =>
        String(
            [...history].reverse().find((e) => String(e?.to_status || '').toLowerCase() === status && String(e?.reason || '').trim())
                ?.reason || '',
        ).trim();
    const cancelledReason = isCancelled ? reasonFor('cancelled') : '';

    const statusColors = statusPalette(currentStatus, colors);
    const payColors = paymentPalette(paymentStatus, colors);
    const items = Array.isArray(order.items) ? order.items : [];
    const notes = String(order.notes || '').trim();
    const address = String(order.delivery_address || '').trim();
    const customerName = String(order.customer_name || '').trim();
    const customerPhone = String(order.customer_phone || '').trim();

    const hasFooter = actions.length > 0 || canCancel || canMarkCashPaid || canReturn;
    const showNoteInput = actions.length > 0 || canCancel;
    const [primaryAction, ...otherActions] = actions;

    return (
        <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Order details" />
            <ScrollView
                contentContainerStyle={[styles.content, !hasFooter && { paddingBottom: 15 + insets.bottom }]}
                keyboardShouldPersistTaps="handled"
            >
                <OrderCard colors={colors}>
                    <View style={styles.summaryTop}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                            <AppText label={order.order_number || 'Order'} variant={1} fontSize={17} color={colors.text} />
                            {formatDateTime(order.created_at) ? (
                                <AppText
                                    label={`Placed ${formatDateTime(order.created_at)}`}
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 3 }}
                                />
                            ) : null}
                        </View>
                        <View style={styles.badgeRow}>
                            <Badge label={formatStatusLabel(paymentStatus)} palette={payColors} />
                            <Badge label={formatStatusLabel(currentStatus)} palette={statusColors} />
                        </View>
                    </View>
                    <View style={[styles.totalBox, { backgroundColor: colors.surfaceSecondary }]}>
                        <AppText label="Order total" fontSize={12} color={colors.textSecondary} />
                        <AppText label={formatMoney(order.total_amount)} variant={1} fontSize={20} color={config.THEME_COLOR} />
                    </View>
                    <OrderInfoRow colors={colors}
                        icon="user"
                        label="Customer"
                        value={customerName || 'Customer'}
                        sub={customerPhone ? formatPhone(customerPhone) : undefined}
                        onPress={customerPhone ? callCustomer : undefined}
                        actionIcon="phone"
                    />
                    <OrderInfoRow colors={colors} icon="store" label="Store" value={order.warehouse_name || '—'} />
                    <OrderInfoRow colors={colors}
                        icon={isDelivery ? 'truck' : 'shopping-bag'}
                        label="Fulfillment"
                        value={isDelivery ? 'Delivery' : 'Pickup at store'}
                    />
                    {address ? <OrderInfoRow colors={colors} icon="map-pin" label="Delivery address" value={address} /> : null}
                    {notes ? <OrderInfoRow colors={colors} icon="sticky-note" label="Customer note" value={notes} /> : null}
                </OrderCard>

                <OrderCard colors={colors} icon="package" title="Items" right={<AppText label={`${items.length} item${items.length === 1 ? '' : 's'}`} fontSize={12} color={colors.textTertiary} />}>
                    {items.map((item, idx) => (
                        <View
                            key={item.id || idx}
                            style={[styles.itemRow, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                        >
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <AppText label={item.product_name || 'Item'} fontSize={14} color={colors.text} />
                                <AppText
                                    label={`${Number(item.quantity)} × ${formatMoney(item.unit_price)}`}
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 2 }}
                                />
                            </View>
                            <AppText
                                label={formatMoney(item.line_total || Number(item.quantity) * Number(item.unit_price))}
                                fontSize={14}
                                variant={1}
                                color={colors.text}
                            />
                        </View>
                    ))}
                    <View style={[styles.itemsTotal, { borderTopColor: colors.border }]}>
                        <AppText label="Total" variant={1} color={colors.text} />
                        <AppText label={formatMoney(order.total_amount)} variant={1} color={colors.text} />
                    </View>
                </OrderCard>

                <OrderCard colors={colors} icon="git-branch" title="Progress">
                    {timelineSteps.map((step, idx) => {
                        const isCancelStep = step === 'cancelled';
                        const done = isCancelled ? true : currentIdx >= 0 && steps.indexOf(step) <= currentIdx;
                        const active = step === currentStatus;
                        const dotColor = isCancelStep ? colors.error : done ? config.THEME_COLOR : colors.border;
                        return (
                            <View key={step} style={styles.timelineRow}>
                                <View style={styles.timelineLeft}>
                                    <View
                                        style={[
                                            styles.timelineDot,
                                            { backgroundColor: done ? dotColor : colors.surface, borderColor: dotColor },
                                            active && styles.timelineDotActive,
                                        ]}
                                    />
                                    {idx < timelineSteps.length - 1 ? (
                                        <View
                                            style={[
                                                styles.timelineLine,
                                                { backgroundColor: done && !isCancelled ? config.THEME_COLOR : colors.border },
                                            ]}
                                        />
                                    ) : null}
                                </View>
                                <AppText
                                    label={formatStatusLabel(step)}
                                    variant={active ? 1 : 0}
                                    fontSize={14}
                                    color={isCancelStep ? colors.error : active || done ? colors.text : colors.textTertiary}
                                />
                            </View>
                        );
                    })}
                    {cancelledReason ? (
                        <View style={[styles.noteBox, { backgroundColor: colors.errorLight }]}>
                            <AppText label="Cancellation note" fontSize={11} color={colors.error} />
                            <AppText label={cancelledReason} fontSize={13} color={colors.text} style={{ marginTop: 3 }} />
                        </View>
                    ) : null}
                </OrderCard>

                {(isInstallmentOrder || canRecordPartialCash) && (
                    <OrderCard colors={colors} icon="wallet" title="Payment">
                        <View style={styles.paymentSummaryRow}>
                            <AppText label={`Paid ${formatMoney(amountPaid)}`} fontSize={13} color={colors.text} />
                            <AppText label={`Balance ${formatMoney(balanceDue)}`} fontSize={13} variant={1} color={colors.text} />
                        </View>
                        {installmentPayments.slice(0, 5).map((p) => (
                            <View key={p.id} style={[styles.itemRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                                <AppText
                                    label={`${formatMoney(p.amount)} · ${formatStatusLabel(p.payment_method || p.status)}`}
                                    fontSize={13}
                                    color={colors.text}
                                    style={{ flex: 1 }}
                                />
                                <AppText label={formatStatusLabel(p.status)} fontSize={11} color={colors.textTertiary} />
                            </View>
                        ))}
                        {canRecordPartialCash ? (
                            <>
                                <TextInput
                                    value={partialAmount}
                                    onChangeText={setPartialAmount}
                                    placeholder={`Cash amount (up to ${balanceDue.toFixed(2)})`}
                                    placeholderTextColor={colors.placeholder}
                                    keyboardType="decimal-pad"
                                    style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBackground }]}
                                />
                                <TextInput
                                    value={partialNote}
                                    onChangeText={setPartialNote}
                                    placeholder="Note (optional)"
                                    placeholderTextColor={colors.placeholder}
                                    style={[styles.input, { borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBackground }]}
                                />
                                <TouchableOpacity
                                    onPress={onRecordPartialCash}
                                    disabled={busy}
                                    activeOpacity={0.85}
                                    style={[styles.inlineBtn, { backgroundColor: config.THEME_COLOR, opacity: busy ? 0.7 : 1 }]}
                                >
                                    <AppText label="Record cash payment" color="#fff" variant={1} />
                                </TouchableOpacity>
                            </>
                        ) : null}
                    </OrderCard>
                )}

                {showNoteInput ? (
                    <OrderCard colors={colors} icon="message-square-text" title="Note for this update">
                        <TextInput
                            value={note}
                            onChangeText={setNote}
                            placeholder={canCancel ? 'Optional — saved with the next step or cancellation' : 'Optional — saved with the next step'}
                            placeholderTextColor={colors.placeholder}
                            style={[styles.input, { marginTop: 0, borderColor: colors.inputBorder, color: colors.text, backgroundColor: colors.inputBackground }]}
                        />
                    </OrderCard>
                ) : null}

                {history.length > 0 && (
                    <OrderCard colors={colors} icon="history" title="History">
                        {[...history].reverse().map((entry, idx) => (
                            <View
                                key={entry.id || idx}
                                style={[styles.historyRow, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                            >
                                <View style={{ flex: 1, paddingRight: 10 }}>
                                    <AppText
                                        label={
                                            entry.from_status && entry.from_status !== entry.to_status
                                                ? `${formatStatusLabel(entry.from_status)} → ${formatStatusLabel(entry.to_status)}`
                                                : formatStatusLabel(entry.to_status || 'Update')
                                        }
                                        fontSize={13}
                                        color={colors.text}
                                    />
                                    {String(entry.reason || '').trim() ? (
                                        <AppText label={String(entry.reason).trim()} fontSize={12} color={colors.textSecondary} style={{ marginTop: 2 }} />
                                    ) : !entry.from_status ? (
                                        <AppText label="Order placed" fontSize={12} color={colors.textSecondary} style={{ marginTop: 2 }} />
                                    ) : null}
                                </View>
                                <AppText label={formatDateTime(entry.created_at)} fontSize={11} color={colors.textTertiary} />
                            </View>
                        ))}
                    </OrderCard>
                )}
            </ScrollView>

            {hasFooter ? (
                <View
                    style={[
                        styles.footer,
                        { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) },
                    ]}
                >
                    {primaryAction || canMarkCashPaid ? (
                        <TouchableOpacity
                            activeOpacity={0.85}
                            disabled={busy}
                            onPress={primaryAction ? () => updateStatus(primaryAction) : onMarkCashPaid}
                            style={[
                                styles.footerBtn,
                                { backgroundColor: primaryAction ? config.THEME_COLOR : colors.success, opacity: busy ? 0.7 : 1 },
                            ]}
                        >
                            {busy ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <Lucide name={primaryAction ? ACTION_COPY[primaryAction]?.icon || 'arrow-right' : 'banknote'} size={18} color="#fff" />
                                    <AppText
                                        label={primaryAction ? ACTION_COPY[primaryAction]?.label || formatStatusLabel(primaryAction) : 'Mark paid (cash)'}
                                        color="#fff"
                                        variant={1}
                                        style={{ marginLeft: 8 }}
                                    />
                                </>
                            )}
                        </TouchableOpacity>
                    ) : null}
                    {otherActions.length > 0 || canCancel || canReturn ? (
                        <View style={[styles.footerRow, (primaryAction || canMarkCashPaid) && { marginTop: 10 }]}>
                            {otherActions.map((s) => (
                                <TouchableOpacity
                                    key={s}
                                    activeOpacity={0.85}
                                    disabled={busy}
                                    onPress={() => updateStatus(s)}
                                    style={[styles.footerBtn, styles.footerBtnSecondary, { borderColor: colors.border, backgroundColor: colors.surface }]}
                                >
                                    <Lucide name={ACTION_COPY[s]?.icon || 'arrow-right'} size={16} color={config.THEME_COLOR} />
                                    <AppText label={ACTION_COPY[s]?.label || formatStatusLabel(s)} color={config.THEME_COLOR} variant={1} style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                            ))}
                            {canReturn ? (
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => navigation.navigate('NewOrderReturn', { orderId: order.id || orderId, order })}
                                    style={[styles.footerBtn, styles.footerBtnSecondary, { borderColor: colors.border, backgroundColor: colors.surface }]}
                                >
                                    <Lucide name="undo-2" size={16} color={config.THEME_COLOR} />
                                    <AppText label="Return / refund" color={config.THEME_COLOR} variant={1} style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                            ) : null}
                            {canCancel ? (
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    disabled={busy}
                                    onPress={cancelOrder}
                                    style={[styles.footerBtn, styles.footerBtnSecondary, { borderColor: colors.error, backgroundColor: colors.surface }]}
                                >
                                    <Lucide name="ban" size={16} color={colors.error} />
                                    <AppText label="Cancel order" color={colors.error} variant={1} style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    ) : null}
                </View>
            ) : null}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: 15, paddingBottom: 24 },
    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 15,
        marginBottom: 12,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    cardHeadLeft: { flexDirection: 'row', alignItems: 'center' },
    summaryTop: { flexDirection: 'row', alignItems: 'flex-start' },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', maxWidth: '50%' },
    badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    totalBox: {
        marginTop: 14,
        marginBottom: 6,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    infoIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    infoAction: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
    itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    itemsTotal: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
    timelineRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 32 },
    timelineLeft: { width: 22, alignItems: 'center', marginRight: 8 },
    timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 3 },
    timelineDotActive: { width: 14, height: 14, borderRadius: 7, marginTop: 2 },
    timelineLine: { width: 2, flex: 1, marginTop: 2, marginBottom: -3 },
    noteBox: { marginTop: 8, borderRadius: 8, padding: 10 },
    paymentSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginTop: 10, fontSize: 14 },
    inlineBtn: { marginTop: 12, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
    historyRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10 },
    footer: { paddingHorizontal: 15, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
    footerRow: { flexDirection: 'row', gap: 10 },
    footerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        paddingVertical: 14,
        minHeight: 50,
    },
    footerBtnSecondary: { flex: 1, borderWidth: 1, paddingVertical: 12, minHeight: 46 },
});

export default OrderDetails;
