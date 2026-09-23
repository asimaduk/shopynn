import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    View,
    TextInput,
    Alert,
    ActivityIndicator,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/format';
import { returnsApi } from '../../services/api';

const REASONS = ['Defective', 'Wrong item', 'Customer change of mind', 'Damaged', 'Other'];

const NewOrderReturn = ({ navigation, route }) => {
    const { colors } = useTheme();
    const orderId = route?.params?.orderId || route?.params?.order?.id || route?.params?.id;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState(null);
    const [qtys, setQtys] = useState({});
    const [restockMap, setRestockMap] = useState({});
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [refundMethod, setRefundMethod] = useState('cash');
    const [refundAmount, setRefundAmount] = useState('');

    const load = useCallback(async () => {
        if (!orderId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await returnsApi.orderReturnable(orderId);
            setData(res);
            const nextQty = {};
            const nextRestock = {};
            (res?.lines || []).forEach((line) => {
                nextQty[line.order_item_id] = '';
                nextRestock[line.order_item_id] = res?.default_restock !== false;
            });
            setQtys(nextQty);
            setRestockMap(nextRestock);
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err?.message || 'Could not load order.');
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useEffect(() => {
        load();
    }, [load]);

    const selectedLines = useMemo(() => {
        if (!data?.lines) return [];
        return data.lines
            .map((line) => {
                const q = Number(String(qtys[line.order_item_id] || '').replace(/,/g, ''));
                if (!Number.isFinite(q) || q <= 0) return null;
                return {
                    ...line,
                    return_qty: Math.min(q, line.returnable_qty),
                    restock: restockMap[line.order_item_id] !== false,
                };
            })
            .filter(Boolean);
    }, [data, qtys, restockMap]);

    const goodsValue = useMemo(
        () =>
            Math.round(
                selectedLines.reduce((s, l) => s + l.return_qty * Number(l.unit_price || 0), 0) * 100,
            ) / 100,
        [selectedLines],
    );

    useEffect(() => {
        if (goodsValue > 0) setRefundAmount(goodsValue.toFixed(2));
    }, [goodsValue]);

    const handleSubmit = async () => {
        if (!orderId) return;
        if (!selectedLines.length) {
            Alert.alert('Required', 'Enter a return quantity on at least one line.');
            return;
        }
        if (!reason.trim()) {
            Alert.alert('Required', 'Select a reason.');
            return;
        }
        if (refundMethod === 'store_credit' && !data?.order?.customer_id) {
            Alert.alert('Customer required', 'Store credit refunds need a customer on the order.');
            return;
        }
        if (refundMethod === 'momo' && !data?.can_momo_refund) {
            Alert.alert('MoMo unavailable', 'No original MoMo payment. Use cash or store credit.');
            return;
        }
        const amt = Number(String(refundAmount || goodsValue).replace(/,/g, ''));
        setSaving(true);
        try {
            await returnsApi.create({
                order_id: orderId,
                reason: reason.trim(),
                notes: notes.trim() || undefined,
                refund_method: refundMethod,
                refund_amount: Number.isFinite(amt) ? amt : goodsValue,
                details: selectedLines.map((l) => ({
                    order_item_id: l.order_item_id,
                    quantity: l.return_qty,
                    unit_price: l.unit_price,
                    restock: l.restock,
                    reason: reason.trim(),
                })),
            });
            Alert.alert('Return recorded', 'Refund has been updated.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to create return.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
            </SafeAreaView>
        );
    }

    const order = data?.order || {};

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Return order" />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <AppText label={`Order #${order.order_number || orderId}`} variant={1} fontSize={16} color={colors.text} />
                    <AppText label={order.customer_name || 'Customer'} fontSize={13} color={colors.textSecondary} style={{ marginTop: 4 }} />
                </View>

                {(data?.lines || []).map((line) => {
                    const disabled = line.returnable_qty <= 0;
                    return (
                        <View
                            key={line.order_item_id}
                            style={[styles.line, { backgroundColor: colors.surface, borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}
                        >
                            <View style={{ flex: 1 }}>
                                <AppText label={line.product_name || 'Item'} fontSize={14} variant={1} color={colors.text} />
                                <AppText
                                    label={`${formatCurrency(line.unit_price)} · returnable ${line.returnable_qty}`}
                                    fontSize={12}
                                    color={colors.textTertiary}
                                />
                            </View>
                            <TextInput
                                editable={!disabled}
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor={colors.placeholder}
                                value={qtys[line.order_item_id] || ''}
                                onChangeText={(v) => setQtys((p) => ({ ...p, [line.order_item_id]: v }))}
                                style={[styles.qtyInput, { borderColor: colors.border, color: colors.text }]}
                            />
                            <View style={{ alignItems: 'center' }}>
                                <AppText label="Restock" fontSize={11} color={colors.textTertiary} />
                                <Switch
                                    disabled={disabled}
                                    value={restockMap[line.order_item_id] !== false}
                                    onValueChange={(v) => setRestockMap((p) => ({ ...p, [line.order_item_id]: v }))}
                                />
                            </View>
                        </View>
                    );
                })}

                <AppText label="Reason" variant={1} fontSize={15} color={colors.text} style={{ marginTop: 12, marginBottom: 8 }} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {REASONS.map((r) => (
                        <TouchableOpacity
                            key={r}
                            onPress={() => setReason(r)}
                            style={[
                                styles.chip,
                                { backgroundColor: reason === r ? config.THEME_COLOR : colors.surfaceSecondary },
                            ]}
                        >
                            <AppText label={r} fontSize={12} color={reason === r ? '#fff' : colors.text} />
                        </TouchableOpacity>
                    ))}
                </View>

                <AppText label="Refund method" variant={1} fontSize={15} color={colors.text} style={{ marginTop: 16, marginBottom: 8 }} />
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {[
                        { id: 'cash', label: 'Cash' },
                        { id: 'store_credit', label: 'Store credit' },
                        { id: 'momo', label: 'MoMo', disabled: !data?.can_momo_refund },
                    ].map((m) => (
                        <TouchableOpacity
                            key={m.id}
                            disabled={m.disabled}
                            onPress={() => setRefundMethod(m.id)}
                            style={[
                                styles.chip,
                                {
                                    backgroundColor: refundMethod === m.id ? config.THEME_COLOR : colors.surfaceSecondary,
                                    opacity: m.disabled ? 0.4 : 1,
                                },
                            ]}
                        >
                            <AppText label={m.label} fontSize={12} color={refundMethod === m.id ? '#fff' : colors.text} />
                        </TouchableOpacity>
                    ))}
                </View>

                <AppText label="Refund amount" fontSize={13} color={colors.text} style={{ marginTop: 14, marginBottom: 6 }} />
                <TextInput
                    keyboardType="decimal-pad"
                    value={refundAmount}
                    onChangeText={setRefundAmount}
                    placeholder={goodsValue.toFixed(2)}
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                />

                <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Notes (optional)"
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface, marginTop: 8 }]}
                />

                <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={saving}
                    onPress={handleSubmit}
                    style={[styles.submit, { backgroundColor: config.THEME_COLOR, opacity: saving ? 0.6 : 1 }]}
                >
                    <Lucide name="undo-2" size={18} color="#fff" />
                    <AppText label={saving ? 'Saving…' : 'Confirm return'} variant={1} fontSize={15} color="#fff" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 14, marginBottom: 16 },
    line: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    qtyInput: { width: 64, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, textAlign: 'center' },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
    submit: {
        marginTop: 16,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
});

export default NewOrderReturn;
