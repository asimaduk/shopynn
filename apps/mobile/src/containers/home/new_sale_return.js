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

/**
 * Create a POS sale return with partial lines + refund method.
 * Route params: { saleId } or { saleId, item }
 */
const NewSaleReturn = ({ navigation, route }) => {
    const { colors } = useTheme();
    const saleId = route?.params?.saleId || route?.params?.item?.id;
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
        if (!saleId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await returnsApi.saleReturnable(saleId);
            setData(res);
            const nextQty = {};
            const nextRestock = {};
            (res?.lines || []).forEach((line) => {
                nextQty[line.sale_detail_id] = '';
                nextRestock[line.sale_detail_id] = true;
            });
            setQtys(nextQty);
            setRestockMap(nextRestock);
            setRefundAmount('');
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err?.message || 'Could not load sale.');
        } finally {
            setLoading(false);
        }
    }, [saleId]);

    useEffect(() => {
        load();
    }, [load]);

    const selectedLines = useMemo(() => {
        if (!data?.lines) return [];
        return data.lines
            .map((line) => {
                const q = Number(String(qtys[line.sale_detail_id] || '').replace(/,/g, ''));
                if (!Number.isFinite(q) || q <= 0) return null;
                return {
                    ...line,
                    return_qty: Math.min(q, line.returnable_qty),
                    restock: restockMap[line.sale_detail_id] !== false,
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
        if (!refundAmount && goodsValue > 0) {
            setRefundAmount(goodsValue.toFixed(2));
        }
    }, [goodsValue]);

    const handleSubmit = async () => {
        if (!saleId) {
            Alert.alert('Required', 'Open this screen from a sale.');
            return;
        }
        if (!selectedLines.length) {
            Alert.alert('Required', 'Enter a return quantity on at least one line.');
            return;
        }
        if (!reason.trim()) {
            Alert.alert('Required', 'Select a reason.');
            return;
        }
        const writeOffMissing = selectedLines.some((l) => !l.restock);
        if (writeOffMissing && !reason.trim()) {
            Alert.alert('Required', 'Reason is required for write-off (non-restock) lines.');
            return;
        }
        if (refundMethod === 'store_credit' && !data?.sale?.customer_id) {
            Alert.alert('Customer required', 'Store credit refunds need a customer on the sale.');
            return;
        }
        if (refundMethod === 'momo' && !data?.can_momo_refund) {
            Alert.alert(
                'MoMo unavailable',
                'No original MoMo payment found. Use cash or store credit.',
            );
            return;
        }

        const amt = Number(String(refundAmount || goodsValue).replace(/,/g, ''));
        setSaving(true);
        try {
            await returnsApi.create({
                sale_id: saleId,
                reason: reason.trim(),
                notes: notes.trim() || undefined,
                refund_method: refundMethod,
                refund_amount: Number.isFinite(amt) ? amt : goodsValue,
                details: selectedLines.map((l) => ({
                    sale_detail_id: l.sale_detail_id,
                    quantity: l.return_qty,
                    unit_price: l.unit_price,
                    restock: l.restock,
                    reason: reason.trim(),
                    write_off_reason: l.restock ? undefined : reason.trim(),
                })),
            });
            Alert.alert('Return recorded', 'Stock and refund have been updated.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to create return.');
        } finally {
            setSaving(false);
        }
    };

    if (!saleId) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={() => navigation.goBack()} label="New return" />
                <View style={styles.center}>
                    <AppText label="Open a sale first, then tap Return." color={colors.textSecondary} />
                </View>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
            </SafeAreaView>
        );
    }

    const sale = data?.sale || {};

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Return sale" />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <AppText label={`Invoice #${sale.invoice_number || saleId}`} variant={1} fontSize={16} color={colors.text} />
                    <AppText
                        label={sale.customer_name || 'Walk-in'}
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginTop: 4 }}
                    />
                    <AppText
                        label={`Paid ${formatCurrency(sale.amount_paid || 0)} · Balance ${formatCurrency(sale.balance_due || 0)}`}
                        fontSize={12}
                        color={colors.textTertiary}
                        style={{ marginTop: 4 }}
                    />
                </View>

                <AppText label="Lines to return" variant={1} fontSize={15} color={colors.text} style={{ marginBottom: 10 }} />
                {(data?.lines || []).map((line) => {
                    const disabled = line.returnable_qty <= 0;
                    return (
                        <View
                            key={line.sale_detail_id}
                            style={[
                                styles.line,
                                { backgroundColor: colors.surface, borderColor: colors.border, opacity: disabled ? 0.5 : 1 },
                            ]}
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
                                value={qtys[line.sale_detail_id] || ''}
                                onChangeText={(v) => setQtys((p) => ({ ...p, [line.sale_detail_id]: v }))}
                                style={[styles.qtyInput, { borderColor: colors.border, color: colors.text }]}
                            />
                            <View style={styles.restockRow}>
                                <AppText label="Restock" fontSize={11} color={colors.textTertiary} />
                                <Switch
                                    disabled={disabled}
                                    value={restockMap[line.sale_detail_id] !== false}
                                    onValueChange={(v) => setRestockMap((p) => ({ ...p, [line.sale_detail_id]: v }))}
                                />
                            </View>
                        </View>
                    );
                })}

                <AppText label="Reason" variant={1} fontSize={15} color={colors.text} style={{ marginTop: 16, marginBottom: 8 }} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {REASONS.map((r) => (
                        <TouchableOpacity
                            key={r}
                            onPress={() => setReason(r)}
                            style={[
                                styles.chip,
                                {
                                    backgroundColor: reason === r ? config.THEME_COLOR : colors.surfaceSecondary,
                                    borderColor: reason === r ? config.THEME_COLOR : colors.border,
                                },
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
                <AppText
                    label={`Goods value ${formatCurrency(goodsValue)}`}
                    fontSize={12}
                    color={colors.textTertiary}
                    style={{ marginBottom: 10 }}
                />

                <AppText label="Notes (optional)" fontSize={13} color={colors.text} style={{ marginBottom: 6 }} />
                <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Optional note"
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                />

                <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={saving}
                    onPress={handleSubmit}
                    style={[styles.submit, { backgroundColor: config.THEME_COLOR, opacity: saving ? 0.6 : 1 }]}
                >
                    <Lucide name="undo-2" size={18} color="#fff" />
                    <AppText
                        label={saving ? 'Saving…' : 'Confirm return'}
                        variant={1}
                        fontSize={15}
                        color="#fff"
                        style={{ marginLeft: 8 }}
                    />
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
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
    qtyInput: {
        width: 64,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 8,
        textAlign: 'center',
    },
    restockRow: { alignItems: 'center' },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
    submit: {
        marginTop: 16,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
});

export default NewSaleReturn;
