import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import useTheme from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/format';
import { returnsApi, purchases as purchasesApi, normalizePagedList } from '../../services/api';
import AppAlert from '../../utils/appAlert';

const REASONS = ['Damaged', 'Expired', 'Wrong item', 'Excess quantity', 'Poor quality', 'Other'];

const fmtQty = (n) => {
    const v = Number(n || 0);
    return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
};

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/**
 * Return goods from a received purchase to the supplier.
 * Route params: { purchaseId } (optional; otherwise pick a purchase).
 */
const NewPurchaseReturn = ({ navigation, route }) => {
    const { colors } = useTheme();
    const [purchaseId, setPurchaseId] = useState(route?.params?.purchaseId || null);
    const [showPicker, setShowPicker] = useState(false);
    const [purchaseList, setPurchaseList] = useState([]);
    const [listLoading, setListLoading] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState(null);
    const [qtys, setQtys] = useState({});
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');

    const loadPurchases = useCallback(async () => {
        setListLoading(true);
        try {
            const raw = await purchasesApi.list({ limit: 50, offset: 0 });
            const { items } = normalizePagedList(raw);
            setPurchaseList(Array.isArray(items) ? items : []);
        } catch (_) {
            setPurchaseList([]);
        } finally {
            setListLoading(false);
        }
    }, []);

    const loadReturnable = useCallback(async () => {
        if (!purchaseId) {
            setData(null);
            return;
        }
        setLoading(true);
        try {
            const res = await returnsApi.purchaseReturnable(purchaseId);
            setData(res);
            setQtys({});
        } catch (err) {
            setData(null);
            AppAlert.alert('Error', err?.response?.data?.message || err?.message || 'Could not load purchase.');
        } finally {
            setLoading(false);
        }
    }, [purchaseId]);

    useEffect(() => {
        loadReturnable();
    }, [loadReturnable]);

    useEffect(() => {
        if (!purchaseId) loadPurchases();
    }, [purchaseId, loadPurchases]);

    const openPicker = () => {
        if (!purchaseList.length) loadPurchases();
        setShowPicker(true);
    };

    const filteredPurchases = useMemo(() => {
        const q = pickerSearch.trim().toLowerCase();
        if (!q) return purchaseList;
        return purchaseList.filter(
            (p) =>
                String(p.invoice_number || '').toLowerCase().includes(q) ||
                String(p.supplier || p.supplier_name || '').toLowerCase().includes(q),
        );
    }, [purchaseList, pickerSearch]);

    const lines = useMemo(() => data?.lines || [], [data]);

    const setLineQty = (line, next) => {
        const max = Number(line.returnable_qty || 0);
        const clamped = Math.max(0, Math.min(max, next));
        setQtys((p) => ({ ...p, [line.purchase_detail_id]: clamped }));
    };

    const selectedLines = useMemo(
        () =>
            lines
                .map((line) => ({ ...line, return_qty: Number(qtys[line.purchase_detail_id] || 0) }))
                .filter((line) => line.return_qty > 0),
        [lines, qtys],
    );

    const credit = useMemo(
        () =>
            Math.round(selectedLines.reduce((s, l) => s + l.return_qty * Number(l.unit_price || 0), 0) * 100) / 100,
        [selectedLines],
    );

    const purchase = data?.purchase || {};
    const netTotal = Number(purchase.net_total ?? purchase.total_amount ?? 0);
    const amountPaid = Number(purchase.amount_paid || 0);
    const cashBack = Math.max(0, Math.round((amountPaid - (netTotal - credit)) * 100) / 100);
    const balanceReduction = Math.max(0, Math.round((credit - cashBack) * 100) / 100);

    const handleSubmit = async () => {
        if (!purchaseId) {
            AppAlert.alert('Required', 'Select a purchase first.');
            return;
        }
        if (!selectedLines.length) {
            AppAlert.alert('Required', 'Set a return quantity on at least one item.');
            return;
        }
        if (!reason) {
            AppAlert.alert('Required', 'Select a reason.');
            return;
        }
        setSaving(true);
        try {
            const created = await returnsApi.createPurchase({
                purchase_id: purchaseId,
                reason,
                notes: notes.trim() || undefined,
                details: selectedLines.map((l) => ({
                    purchase_detail_id: l.purchase_detail_id,
                    quantity: l.return_qty,
                    reason,
                })),
            });
            const message =
                cashBack > 0.02
                    ? `Stock updated. Collect ${formatCurrency(created?.cash_back ?? cashBack)} cash back from the supplier.`
                    : `Stock updated. ${formatCurrency(created?.balance_reduction ?? credit)} taken off what you owe the supplier.`;
            AppAlert.alert('Return recorded', message, [
                {
                    text: 'OK',
                    onPress: () => {
                        if (created?.id) {
                            navigation.replace('ReturnDetails', { returnId: created.id, type: 'purchase' });
                        } else {
                            navigation.goBack();
                        }
                    },
                },
            ]);
        } catch (err) {
            AppAlert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to create return.');
        } finally {
            setSaving(false);
        }
    };

    const noneReturnable = lines.length > 0 && lines.every((l) => Number(l.returnable_qty || 0) <= 0);

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Return to supplier" />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                <AppText label="Purchase" variant={1} fontSize={15} color={colors.text} style={{ marginBottom: 8 }} />
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={openPicker}
                    style={[styles.card, styles.pickerRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                    {data?.purchase ? (
                        <View style={{ flex: 1 }}>
                            <AppText
                                label={`Invoice #${purchase.invoice_number || '—'}`}
                                variant={1}
                                fontSize={16}
                                color={colors.text}
                            />
                            <AppText
                                label={[purchase.supplier_name || 'No supplier', purchase.warehouse_name].filter(Boolean).join(' · ')}
                                fontSize={13}
                                color={colors.textSecondary}
                                style={{ marginTop: 4 }}
                            />
                            <AppText
                                label={`Total ${formatCurrency(netTotal)} · Paid ${formatCurrency(amountPaid)} · Owed ${formatCurrency(purchase.balance_owed || 0)}`}
                                fontSize={12}
                                color={colors.textTertiary}
                                style={{ marginTop: 4 }}
                            />
                        </View>
                    ) : (
                        <AppText label="Tap to select a purchase" color={colors.placeholder} style={{ flex: 1 }} />
                    )}
                    <Lucide name="chevron-down" color={colors.placeholder} size={20} />
                </TouchableOpacity>

                {loading ? (
                    <ActivityIndicator size="large" color={config.THEME_COLOR} style={{ marginVertical: 24 }} />
                ) : null}

                {!loading && data ? (
                    <>
                        <AppText label="Items to return" variant={1} fontSize={15} color={colors.text} style={{ marginBottom: 10 }} />
                        {noneReturnable ? (
                            <AppText
                                label="Nothing left to return on this purchase (already returned or sold)."
                                fontSize={13}
                                color={colors.textSecondary}
                                style={{ marginBottom: 12 }}
                            />
                        ) : null}
                        {lines.map((line) => {
                            const max = Number(line.returnable_qty || 0);
                            const disabled = max <= 0;
                            const qty = Number(qtys[line.purchase_detail_id] || 0);
                            return (
                                <View
                                    key={line.purchase_detail_id}
                                    style={[
                                        styles.line,
                                        { backgroundColor: colors.surface, borderColor: colors.border, opacity: disabled ? 0.5 : 1 },
                                    ]}
                                >
                                    <View style={{ flex: 1 }}>
                                        <AppText label={line.product_name || 'Item'} fontSize={14} variant={1} color={colors.text} numberOfLines={2} />
                                        <AppText
                                            label={`${formatCurrency(line.unit_price)} each · bought ${fmtQty(line.quantity_purchased)}`}
                                            fontSize={12}
                                            color={colors.textTertiary}
                                            style={{ marginTop: 2 }}
                                        />
                                        <AppText
                                            label={
                                                disabled
                                                    ? 'Nothing returnable'
                                                    : `Up to ${fmtQty(max)} (in stock ${fmtQty(line.in_stock)}${Number(line.quantity_returned) > 0 ? `, returned ${fmtQty(line.quantity_returned)}` : ''})`
                                            }
                                            fontSize={12}
                                            color={colors.textTertiary}
                                        />
                                    </View>
                                    <View style={styles.stepper}>
                                        <TouchableOpacity
                                            disabled={disabled || qty <= 0}
                                            onPress={() => setLineQty(line, qty - 1)}
                                            style={[styles.stepBtn, { borderColor: colors.border, opacity: disabled || qty <= 0 ? 0.4 : 1 }]}
                                        >
                                            <Lucide name="minus" size={16} color={colors.text} />
                                        </TouchableOpacity>
                                        <AppText label={fmtQty(qty)} fontSize={15} variant={1} color={colors.text} style={styles.stepValue} />
                                        <TouchableOpacity
                                            disabled={disabled || qty >= max}
                                            onPress={() => setLineQty(line, qty + 1)}
                                            style={[styles.stepBtn, { borderColor: colors.border, opacity: disabled || qty >= max ? 0.4 : 1 }]}
                                        >
                                            <Lucide name="plus" size={16} color={colors.text} />
                                        </TouchableOpacity>
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

                        <AppText label="Notes (optional)" fontSize={13} color={colors.text} style={{ marginTop: 16, marginBottom: 6 }} />
                        <TextInput
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="e.g. 3 bottles cracked on delivery"
                            placeholderTextColor={colors.placeholder}
                            multiline
                            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                        />

                        {credit > 0 ? (
                            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
                                <View style={styles.summaryRow}>
                                    <AppText label="Return value" fontSize={13} color={colors.textSecondary} />
                                    <AppText label={formatCurrency(credit)} fontSize={15} variant={1} color={colors.text} />
                                </View>
                                {balanceReduction > 0 ? (
                                    <View style={styles.summaryRow}>
                                        <AppText label="Taken off amount owed" fontSize={13} color={colors.textSecondary} />
                                        <AppText label={formatCurrency(balanceReduction)} fontSize={14} color={colors.text} />
                                    </View>
                                ) : null}
                                {cashBack > 0 ? (
                                    <View style={styles.summaryRow}>
                                        <AppText label="Cash back from supplier" fontSize={13} color={colors.textSecondary} />
                                        <AppText label={formatCurrency(cashBack)} fontSize={14} variant={1} color={config.GREEN_COLOR || colors.text} />
                                    </View>
                                ) : null}
                            </View>
                        ) : null}

                        <TouchableOpacity
                            activeOpacity={0.85}
                            disabled={saving || !selectedLines.length}
                            onPress={handleSubmit}
                            style={[
                                styles.submit,
                                { backgroundColor: config.THEME_COLOR, opacity: saving || !selectedLines.length ? 0.6 : 1 },
                            ]}
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
                    </>
                ) : null}
            </ScrollView>

            <AppModal
                title="Select purchase"
                visible={showPicker}
                handleClose={() => setShowPicker(false)}
                onRequestClose={() => setShowPicker(false)}
            >
                <TextInput
                    value={pickerSearch}
                    onChangeText={setPickerSearch}
                    placeholder="Search invoice or supplier"
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, { borderColor: colors.border, color: colors.text, marginHorizontal: 4 }]}
                />
                <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
                    {listLoading ? (
                        <ActivityIndicator color={config.THEME_COLOR} style={{ marginVertical: 20 }} />
                    ) : filteredPurchases.length === 0 ? (
                        <AppText label="No purchases found" color={colors.textTertiary} style={{ padding: 14 }} />
                    ) : (
                        filteredPurchases.map((p) => (
                            <TouchableOpacity
                                key={p.id}
                                activeOpacity={0.7}
                                onPress={() => {
                                    setShowPicker(false);
                                    setPurchaseId(p.id);
                                }}
                                style={[styles.modalRow, { borderBottomColor: colors.border }]}
                            >
                                <View style={{ flex: 1 }}>
                                    <AppText
                                        label={`#${p.invoice_number || '—'} · ${p.supplier || p.supplier_name || 'No supplier'}`}
                                        variant={2}
                                        color={colors.text}
                                        numberOfLines={1}
                                    />
                                    <AppText label={fmtDate(p.created_at)} fontSize={12} color={colors.textTertiary} />
                                </View>
                                <AppText label={formatCurrency(p.total_amount || 0)} fontSize={13} color={config.THEME_COLOR} />
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            </AppModal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 14, marginBottom: 16 },
    pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    line: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    stepper: { flexDirection: 'row', alignItems: 'center' },
    stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    stepValue: { minWidth: 32, textAlign: 'center' },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
    submit: {
        marginTop: 16,
        paddingVertical: 14,
        borderRadius: 999,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    modalList: { maxHeight: 360 },
    modalRow: {
        padding: 14,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
});

export default NewPurchaseReturn;
