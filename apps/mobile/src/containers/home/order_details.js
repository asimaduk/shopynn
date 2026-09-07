import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { orders, storeOrders } from '../../services/api';
import { hasFeature, hasPermission } from '../../utils/permissions';
import { Lucide } from '@react-native-vector-icons/lucide';

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
/** Matches ims-services ORDER_STATUS_TRANSITIONS — only these may transition to cancelled. */
const CANCELLABLE_ORDER_STATUSES = new Set(['pending', 'confirmed']);
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

const getPaymentPalette = (value) => {
    const ps = String(value || '').toLowerCase();
    if (ps === 'paid') return { bg: '#dcfce7', text: '#16a34a' };
    if (ps === 'failed') return { bg: '#fee2e2', text: '#dc2626' };
    if (ps === 'pending') return { bg: '#fef3c7', text: '#d97706' };
    return { bg: '#f3f4f6', text: '#6b7280' };
};

const OrderDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const user = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const orderId = route?.params?.orderId;
    const [order, setOrder] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [reason, setReason] = useState('');
    const [cancelNote, setCancelNote] = useState('');
    const [partialAmount, setPartialAmount] = useState('');
    const [partialNote, setPartialNote] = useState('');
    const [paymentBusy, setPaymentBusy] = useState(false);

    const canUpdateStatus =
        hasPermission(user, 'orders.update') &&
        hasFeature(user, 'orders.update', subscriptionFeatures);
    const canManagePayments =
        hasPermission(user, 'orders.status.update') &&
        hasFeature(user, 'orders.status.update', subscriptionFeatures);
    const canCancel =
        hasPermission(user, 'orders.cancel') &&
        hasFeature(user, 'orders.cancel', subscriptionFeatures);

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

    const updateStatus = async (status) => {
        const requiresReason = status === 'completed';
        if (requiresReason && !String(reason).trim()) {
            Alert.alert('Reason required', 'Please provide a completion reason.');
            return;
        }

        Alert.alert(
            'Confirm status update',
            `Change order status to "${formatStatusLabel(status)}"?`,
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, update',
                    style: 'default',
                    onPress: async () => {
                        try {
                            await storeOrders.updateStatus(orderId, status, reason || undefined);
                            setReason('');
                            await load();
                        } catch (error) {
                            Alert.alert('Status update failed', error?.response?.data?.message || 'Try again.');
                        }
                    },
                },
            ]
        );
    };

    const cancel = () => {
        const status = String(order?.status || '').toLowerCase();
        if (!CANCELLABLE_ORDER_STATUSES.has(status)) {
            Alert.alert(
                'Cannot cancel',
                'Only orders that are still pending or confirmed can be cancelled.',
            );
            return;
        }
        const note = String(cancelNote || '').trim();
        Alert.alert('Cancel order', 'Are you sure you want to cancel this order?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Yes, cancel',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await orders.cancel(orderId, note || 'Cancelled by user');
                        setCancelNote('');
                        await load();
                    } catch (error) {
                        Alert.alert('Cancel failed', error?.response?.data?.message || 'Try again.');
                    }
                },
            },
        ]);
    };

    const paymentStatusRaw = String(order?.payment_status || 'unpaid').toLowerCase();
    const isInstallmentOrder = String(order?.payment_mode || 'full').toLowerCase() === 'installment';
    const balanceDue = Number(order?.balance_due ?? 0);
    const amountPaid = Number(order?.amount_paid ?? 0);
    const installmentPayments = Array.isArray(order?.installment_payments) ? order.installment_payments : [];
    const fulfillmentType = String(order?.fulfillment_type || 'pickup').toLowerCase();

    const onRecordPartialCash = () => {
        const amt = Number(partialAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
            Alert.alert('Invalid amount', 'Enter a valid partial payment amount.');
            return;
        }
        if (amt > balanceDue + 0.02) {
            Alert.alert('Too high', `Amount cannot exceed remaining balance (GHS ${balanceDue.toFixed(2)}).`);
            return;
        }
        Alert.alert('Record cash payment', `Record GHS ${amt.toFixed(2)} toward this order balance?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Record',
                onPress: async () => {
                    setPaymentBusy(true);
                    try {
                        await storeOrders.recordPartialCash(orderId, {
                            amount: amt,
                            note: partialNote.trim() || undefined,
                        });
                        setPartialAmount('');
                        setPartialNote('');
                        await load();
                    } catch (error) {
                        Alert.alert(
                            'Could not record payment',
                            error?.response?.data?.message || error?.response?.data?.error || 'Try again.',
                        );
                    } finally {
                        setPaymentBusy(false);
                    }
                },
            },
        ]);
    };

    const onMarkCashPaid = () => {
        Alert.alert(
            'Mark paid (cash)',
            'Mark this order as paid in cash? This cannot be undone automatically.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark paid',
                    onPress: async () => {
                        setPaymentBusy(true);
                        try {
                            await storeOrders.markPaidCash(orderId, {});
                            await load();
                        } catch (error) {
                            Alert.alert(
                                'Could not mark paid',
                                error?.response?.data?.message || error?.response?.data?.error || 'Try again.',
                            );
                        } finally {
                            setPaymentBusy(false);
                        }
                    },
                },
            ],
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={() => navigation.goBack()} label="Order details" />
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                </View>
            </SafeAreaView>
        );
    }
    const currentStatus = String(order?.status || '').toLowerCase();
    const canMarkCashPaid =
        canManagePayments &&
        !(isInstallmentOrder && balanceDue > 0.02) &&
        paymentStatusRaw !== 'paid' &&
        ((fulfillmentType === 'pickup' && currentStatus === 'completed') ||
            (fulfillmentType === 'delivery' && (currentStatus === 'delivered' || currentStatus === 'completed')));
    const canRecordPartialCash = canManagePayments && isInstallmentOrder && balanceDue > 0.02;
    const statusAllowsCancel = CANCELLABLE_ORDER_STATUSES.has(currentStatus);
    const actions = TRANSITIONS[currentStatus] || [];
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

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Order details" />
            <ScrollView contentContainerStyle={{ padding: 0 }}>
                {!order ? (
                    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <AppText label="Order not found" color={colors.textSecondary} />
                    </View>
                ) : (
                    <View>
                        <View style={[styles.heroCard, { backgroundColor: config.THEME_COLOR }]}>
                            <View style={styles.heroTop}>
                                <View style={{ flex: 1 }}>
                                    <AppText label={order.order_number || 'Order'} variant={1} fontSize={18} color="#fff" />
                                    <AppText
                                        label="Order details"
                                        color="rgba(255,255,255,0.85)"
                                        fontSize={12}
                                        style={{ marginTop: 2 }}
                                    />
                                </View>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                                    <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                                        <AppText
                                            label={formatStatusLabel(order.payment_status || 'unpaid')}
                                            color="#fff"
                                            fontSize={11}
                                            variant={1}
                                        />
                                    </View>
                                    <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                                        <AppText
                                            label={formatStatusLabel(order.status || 'pending')}
                                            color="#fff"
                                            fontSize={11}
                                            variant={1}
                                        />
                                    </View>
                                </View>
                            </View>

                            <View style={[styles.metaCard, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.metaLabelRow}>
                                        <Lucide name="store" size={13} color="rgba(255,255,255,0.9)" />
                                        <AppText label="Store" color="rgba(255,255,255,0.85)" fontSize={11} style={{ marginLeft: 5 }} />
                                    </View>
                                    <AppText
                                        label={order.warehouse_name || order.warehouse_id || '-'}
                                        color="#fff"
                                        variant={1}
                                        style={{ marginTop: 2 }}
                                    />
                                    {!!String(order?.customer_name || '').trim() && (
                                        <View style={[styles.metaLabelRow, { marginTop: 8 }]}>
                                            <Lucide name="user" size={13} color="rgba(255,255,255,0.9)" />
                                            <AppText
                                                label={String(order.customer_name).trim()}
                                                color="rgba(255,255,255,0.9)"
                                                fontSize={12}
                                                style={{ marginLeft: 5, flex: 1 }}
                                                numberOfLines={1}
                                            />
                                        </View>
                                    )}
                                </View>
                                <View style={[styles.metaDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
                                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                    <View style={[styles.metaLabelRow, { justifyContent: 'flex-end' }]}>
                                        <Lucide name="wallet" size={13} color="rgba(255,255,255,0.9)" />
                                        <AppText label="Order total" color="rgba(255,255,255,0.85)" fontSize={11} style={{ marginLeft: 5 }} />
                                    </View>
                                    <AppText
                                        label={`GHS ${Number(order.total_amount || 0).toFixed(2)}`}
                                        color="#fff"
                                        variant={1}
                                        fontSize={16}
                                        style={{ marginTop: 2 }}
                                    />
                                </View>
                            </View>
                        </View>

                        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                            <View style={styles.sectionHeadRow}>
                                <Lucide name="git-branch" size={14} color={colors.textSecondary} />
                                <AppText label="Status timeline" variant={1} color={colors.text} style={{ marginLeft: 6 }} />
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
                                            <AppText label={formatStatusLabel(step)} variant={active ? 1 : 2} color={active ? colors.text : colors.textSecondary} />
                                        </View>
                                    </View>
                                );
                            })}
                            {currentStatus === 'cancelled' && (
                                <View style={styles.cancelTag}>
                                    <AppText label="CANCELLED" color="#fff" variant={1} fontSize={11} />
                                </View>
                            )}
                            {currentStatus === 'cancelled' && cancelledReason ? (
                                <View style={[styles.noteCard, { borderColor: colors.border, backgroundColor: '#fee2e2' }]}>
                                    <AppText label="Cancellation note" color="#dc2626" fontSize={11} />
                                    <AppText label={cancelledReason} color={colors.text} style={{ marginTop: 4 }} />
                                </View>
                            ) : null}
                            {currentStatus === 'completed' && completionReason ? (
                                <View style={[styles.noteCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
                                    <AppText label="Completion note" color={colors.textSecondary} fontSize={11} />
                                    <AppText label={completionReason} color={colors.text} style={{ marginTop: 4 }} />
                                </View>
                            ) : null}
                        </View>

                        {Array.isArray(order.items) && order.items.length > 0 && (
                            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                                <View style={styles.sectionHeadRow}>
                                    <Lucide name="package" size={14} color={colors.textSecondary} />
                                    <AppText label="Items" variant={1} color={colors.text} style={{ marginLeft: 6 }} />
                                </View>
                                {order.items.map((item, idx) => (
                                    <View
                                        key={item.id}
                                        style={[
                                            styles.itemRow,
                                            { borderBottomColor: colors.borderLight },
                                            idx < order.items.length - 1 && { borderBottomWidth: 1 },
                                        ]}
                                    >
                                        <AppText label={item.product_name || item.product_id} color={colors.text} />
                                        <AppText
                                            label={`${Number(item.quantity)} x GHS ${Number(item.unit_price || 0).toFixed(2)}`}
                                            color={colors.textTertiary}
                                        />
                                    </View>
                                ))}
                            </View>
                        )}

                        {(isInstallmentOrder || canMarkCashPaid || canRecordPartialCash) && (
                            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                                <View style={styles.sectionHeadRow}>
                                    <Lucide name="wallet" size={14} color={colors.textSecondary} />
                                    <AppText label="Payment" variant={1} color={colors.text} style={{ marginLeft: 6 }} />
                                </View>
                                {isInstallmentOrder ? (
                                    <>
                                        <View style={styles.paymentSummaryRow}>
                                            <AppText label={`Paid: GHS ${amountPaid.toFixed(2)}`} color={colors.text} fontSize={13} />
                                            <AppText label={`Balance: GHS ${balanceDue.toFixed(2)}`} color={colors.text} fontSize={13} variant={1} />
                                        </View>
                                        {installmentPayments.length > 0 ? (
                                            installmentPayments.slice(0, 5).map((p) => (
                                                <View key={p.id} style={[styles.itemRow, { borderBottomColor: colors.borderLight, borderBottomWidth: 1 }]}>
                                                    <AppText
                                                        label={`GHS ${Number(p.amount || 0).toFixed(2)} · ${formatStatusLabel(p.payment_method || p.status)}`}
                                                        color={colors.text}
                                                        fontSize={13}
                                                    />
                                                    <AppText label={formatStatusLabel(p.status)} color={colors.textTertiary} fontSize={11} />
                                                </View>
                                            ))
                                        ) : null}
                                    </>
                                ) : null}
                                {canRecordPartialCash ? (
                                    <>
                                        <AppText label="Record cash partial" color={colors.textSecondary} fontSize={11} style={{ marginTop: 8 }} />
                                        <TextInput
                                            value={partialAmount}
                                            onChangeText={setPartialAmount}
                                            placeholder={`Amount up to ${balanceDue.toFixed(2)}`}
                                            placeholderTextColor={colors.textTertiary}
                                            keyboardType="decimal-pad"
                                            style={[
                                                styles.reasonInput,
                                                { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceSecondary },
                                            ]}
                                        />
                                        <TextInput
                                            value={partialNote}
                                            onChangeText={setPartialNote}
                                            placeholder="Note (optional)"
                                            placeholderTextColor={colors.textTertiary}
                                            style={[
                                                styles.reasonInput,
                                                { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceSecondary },
                                            ]}
                                        />
                                        <TouchableOpacity
                                            onPress={onRecordPartialCash}
                                            disabled={paymentBusy}
                                            style={[styles.payBtn, { backgroundColor: config.THEME_COLOR, opacity: paymentBusy ? 0.7 : 1 }]}
                                            activeOpacity={0.85}
                                        >
                                            {paymentBusy ? (
                                                <ActivityIndicator color="#fff" size="small" />
                                            ) : (
                                                <AppText label="Record payment" color="#fff" variant={1} />
                                            )}
                                        </TouchableOpacity>
                                    </>
                                ) : null}
                                {canMarkCashPaid ? (
                                    <>
                                        <AppText
                                            label="Mark as paid after cash is collected on pickup or delivery."
                                            color={colors.textTertiary}
                                            fontSize={12}
                                            style={{ marginTop: canRecordPartialCash ? 12 : 4, marginBottom: 8 }}
                                        />
                                        <TouchableOpacity
                                            onPress={onMarkCashPaid}
                                            disabled={paymentBusy}
                                            style={[styles.payBtn, { backgroundColor: '#16a34a', opacity: paymentBusy ? 0.7 : 1 }]}
                                            activeOpacity={0.85}
                                        >
                                            {paymentBusy ? (
                                                <ActivityIndicator color="#fff" size="small" />
                                            ) : (
                                                <AppText label="Mark paid (cash)" color="#fff" variant={1} />
                                            )}
                                        </TouchableOpacity>
                                    </>
                                ) : null}
                            </View>
                        )}

                        {canUpdateStatus && (
                            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                                <View style={styles.sectionHeadRow}>
                                    <Lucide name="workflow" size={14} color={colors.textSecondary} />
                                    <AppText label="Status actions (store processing)" variant={1} color={colors.text} style={{ marginLeft: 6 }} />
                                </View>
                                <View style={styles.hintRow}>
                                    <Lucide name="info" size={14} color={colors.textTertiary} />
                                    <AppText
                                        label="Use these actions to move the order through processing."
                                        color={colors.textTertiary}
                                        fontSize={12}
                                        style={{ marginLeft: 6, flex: 1 }}
                                    />
                                </View>

                                {actions.includes('completed') && (
                                    <View style={{ marginTop: 10 }}>
                                        <AppText label="Completion note (required)" color={colors.textSecondary} fontSize={11} />
                                        <TextInput
                                            value={reason}
                                            onChangeText={setReason}
                                            placeholder="e.g. Delivered and paid in full"
                                            placeholderTextColor={colors.textTertiary}
                                            style={[
                                                styles.reasonInput,
                                                { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceSecondary },
                                            ]}
                                        />
                                    </View>
                                )}

                                <View style={styles.actionsButtons}>
                                    {actions.map((nextStatus) => {
                                        const label = formatStatusLabel(nextStatus);
                                        const icon =
                                            nextStatus === 'confirmed'
                                                ? 'badge-check'
                                                : nextStatus === 'processing'
                                                  ? 'settings'
                                                  : nextStatus === 'ready'
                                                    ? 'package-check'
                                                    : nextStatus === 'shipped'
                                                      ? 'truck'
                                                      : nextStatus === 'delivered'
                                                        ? 'map-pin-check'
                                                        : nextStatus === 'completed'
                                                          ? 'circle-check'
                                                          : 'arrow-right';
                                        const isPrimary = nextStatus === 'confirmed' || nextStatus === 'ready';
                                        const isSuccess = nextStatus === 'completed';
                                        const isInfo = nextStatus === 'processing' || nextStatus === 'shipped' || nextStatus === 'delivered';

                                        const bg = isSuccess
                                            ? '#dcfce7'
                                            : isPrimary
                                              ? config.THEME_COLOR
                                              : isInfo
                                                ? '#eff6ff'
                                                : colors.surface;
                                        const border = isSuccess
                                            ? '#86efac'
                                            : isPrimary
                                              ? config.THEME_COLOR
                                              : isInfo
                                                ? '#bfdbfe'
                                                : colors.border;
                                        const text = isSuccess ? '#16a34a' : isPrimary ? '#fff' : isInfo ? '#1d4ed8' : colors.text;
                                        const iconColor = isSuccess ? '#16a34a' : isPrimary ? '#fff' : isInfo ? '#1d4ed8' : colors.textSecondary;

                                        return (
                                            <TouchableOpacity
                                                key={nextStatus}
                                                onPress={() => updateStatus(nextStatus)}
                                                activeOpacity={0.85}
                                                style={[
                                                    styles.actionButton,
                                                    {
                                                        backgroundColor: bg,
                                                        borderColor: border,
                                                    },
                                                ]}
                                            >
                                                <View style={styles.actionButtonInner}>
                                                    <View style={styles.actionButtonLeft}>
                                                        <View style={[styles.actionIconWrap, { backgroundColor: isPrimary ? 'rgba(255,255,255,0.18)' : colors.surface }]}>
                                                            <Lucide name={icon} size={16} color={iconColor} />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <AppText label={label} color={text} variant={isPrimary || isSuccess ? 1 : 0} fontSize={13} />
                                                            <AppText
                                                                label={`Move order to ${label.toLowerCase()}`}
                                                                color={isPrimary ? 'rgba(255,255,255,0.85)' : colors.textTertiary}
                                                                fontSize={11}
                                                                style={{ marginTop: 2 }}
                                                                numberOfLines={1}
                                                            />
                                                        </View>
                                                    </View>
                                                    <Lucide name="chevron-right" size={18} color={isPrimary ? 'rgba(255,255,255,0.9)' : colors.textTertiary} />
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {history.length > 0 && (
                            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                                <View style={styles.sectionHeadRow}>
                                    <Lucide name="history" size={14} color={colors.textSecondary} />
                                    <AppText label="History" variant={1} color={colors.text} style={{ marginLeft: 6 }} />
                                </View>
                                {history.map((entry, idx) => (
                                    <View
                                        key={entry.id}
                                        style={[
                                            styles.itemRow,
                                            { borderBottomColor: colors.borderLight },
                                            idx < history.length - 1 && { borderBottomWidth: 1 },
                                        ]}
                                    >
                                        <AppText
                                            label={`${formatStatusLabel(entry.from_status || 'new')} -> ${formatStatusLabel(entry.to_status || '')}`}
                                            color={colors.text}
                                        />
                                        <AppText label={entry.reason || 'Status change'} color={colors.textTertiary} fontSize={12} />
                                    </View>
                                ))}
                            </View>
                        )}

                        {canCancel && statusAllowsCancel && (
                            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                                <View style={styles.sectionHeadRow}>
                                    <Lucide name="ban" size={14} color="#ef4444" />
                                    <AppText label="Cancel order" variant={1} color={colors.text} style={{ marginLeft: 6 }} />
                                </View>
                                <TextInput
                                    value={cancelNote}
                                    onChangeText={setCancelNote}
                                    placeholder="Cancellation note (optional)"
                                    placeholderTextColor={colors.textTertiary}
                                    style={[styles.reasonInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceSecondary }]}
                                />
                                <TouchableOpacity
                                    onPress={cancel}
                                    style={[styles.cancelBtn, { backgroundColor: '#f00' }]}
                                    activeOpacity={0.85}
                                >
                                    <View style={styles.cancelRow}>
                                        <Lucide name="ban" size={14} color="#fff" />
                                        <AppText label="Cancel order" color="#fff" variant={1} style={{ marginLeft: 6 }} />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    heroCard: { padding: 12 },
    heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
    metaCard: { marginTop: 12, borderRadius: 5, paddingVertical: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'stretch' },
    metaDivider: { width: 1, marginHorizontal: 10 },
    metaLabelRow: { flexDirection: 'row', alignItems: 'center' },
    pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, alignSelf: 'flex-start' },
    card: { paddingVertical: 12, paddingHorizontal: 15, marginBottom: 10 },
    statusRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center' },
    statusPill: { marginLeft: 6, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    infoRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center' },
    sectionHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    itemRow: { borderBottomWidth: 0, paddingVertical: 8 },
    timelineRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 34 },
    timelineLeft: { width: 20, alignItems: 'center' },
    timelineDot: { width: 10, height: 10, borderRadius: 10, borderWidth: 2, marginTop: 3 },
    timelineLine: { width: 2, flex: 1, marginTop: 2, marginBottom: -4 },
    cancelTag: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#dc2626', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
    noteCard: { marginTop: 10, borderWidth: 1, borderRadius: 8, padding: 10 },
    hintRow: { flexDirection: 'row', alignItems: 'center' },
    actionsButtons: { marginTop: 12, gap: 10 },
    actionButton: { borderWidth: 1, borderRadius: 5, padding: 12 },
    actionButtonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    actionButtonLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 10 },
    actionIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    cancelBtn: { marginTop: 12, borderRadius: 5, paddingVertical: 15, alignItems: 'center' },
    cancelRow: { flexDirection: 'row', alignItems: 'center' },
    reasonInput: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 10, paddingVertical: 10, marginTop: 8 },
    paymentSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 8 },
    payBtn: { marginTop: 10, borderRadius: 5, paddingVertical: 14, alignItems: 'center' },
});

export default OrderDetails;
