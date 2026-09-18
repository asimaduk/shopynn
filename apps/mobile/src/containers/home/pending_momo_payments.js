import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import ScreenHeader from '../../components/screen_header';
import { FlashList } from '@shopify/flash-list';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import { payments as paymentsApi, sales as salesApi, normalizeList } from '../../services/api';
import { buildInvoiceNumberFromSettings } from '../../utils/invoiceNumbering';
import { incrementInvoiceNext } from '../../store/actions/appSettings';
import { useDispatch } from 'react-redux';

const isSuccess = (status) => ['success', 'paid', 'completed'].includes(String(status || '').toLowerCase());

const productLines = (snapshot) => {
    if (!snapshot) return [];
    if (Array.isArray(snapshot.products)) return snapshot.products;
    if (Array.isArray(snapshot.currentOrder)) return snapshot.currentOrder;
    return [];
};

const PendingMomoPayments = ({ navigation }) => {
    const { colors } = useTheme();
    const dispatch = useDispatch();
    const user = useSelector((s) => s.user?.user || s.user);
    const appSettings = useSelector((s) => s.appSettings || {});
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [busyRef, setBusyRef] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const raw = await paymentsApi.posPending();
            setRows(normalizeList(raw));
        } catch (e) {
            setRows([]);
            Alert.alert('Pending MoMo', e?.response?.data?.message || e?.message || 'Could not load payments');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    const handleCheckStatus = async (row) => {
        const ref = row?.transaction_ref;
        if (!ref) return;
        setBusyRef(ref);
        try {
            const v = await paymentsApi.verify(ref);
            const st = String(v?.status || '').toLowerCase();
            Alert.alert('Status', isSuccess(st) ? 'Payment confirmed.' : `Status: ${st || 'pending'}`);
            await load();
        } catch (e) {
            Alert.alert('MoMo', e?.response?.data?.message || e?.message || 'Verify failed');
        } finally {
            setBusyRef(null);
        }
    };

    const handleResume = (row) => {
        navigation.navigate('NewSale', {
            restoreParkedMomo: {
                transaction_ref: row.transaction_ref,
                payment_number: row.payment_number,
                status: row.status,
                face_amount: row.face_amount,
                fee_amount: row.fee_amount,
                amount: row.amount,
                pos_cart_snapshot: row.pos_cart_snapshot,
            },
        });
    };

    const handleComplete = async (row) => {
        const ref = row?.transaction_ref;
        const snap = row?.pos_cart_snapshot;
        const lines = productLines(snap);
        if (!ref) return;
        if (!isSuccess(row?.status)) {
            Alert.alert('MoMo', 'Payment is not confirmed yet. Check status first.');
            return;
        }
        if (!lines.length) {
            Alert.alert('MoMo', 'No cart snapshot. Opening New Sale so you can rebuild.');
            handleResume(row);
            return;
        }
        setBusyRef(ref);
        try {
            const products = lines.map((o) => ({
                id: o.id,
                quantity: Number(o.order_quantity ?? o.quantity) || 1,
                unit_price: Number(o.unit_price) || 0,
                name: o.name || '',
            }));
            const total_amount =
                Number(row.face_amount) > 0
                    ? Math.round(Number(row.face_amount) * 100) / 100
                    : Math.round(
                          products.reduce((s, p) => s + p.quantity * p.unit_price, 0) * 100
                      ) / 100;
            const invoiceNumber = buildInvoiceNumberFromSettings(appSettings);
            await salesApi.create({
                id: Date.now(),
                total_amount,
                discount_amount: 0,
                invoice_number: invoiceNumber,
                current_status: 1,
                customer_id: snap?.customer_id || null,
                customer: snap?.customer_name || 'Walk In',
                sale_date: new Date().toJSON(),
                products,
                notes: `Paid with momo ${row.payment_number || ''} ref ${ref}${
                    row.fee_amount ? ` (fee ${row.fee_amount})` : ''
                }`,
                cashier: user?.displayName || user?.first_name || '',
                created_at: new Date().toJSON(),
                warehouse_id: snap?.warehouse_id || user?.warehouse?.id,
                payment_method: 'momo',
                payment_number: row.payment_number || null,
                payment_reference: ref,
                payment_transaction_ref: ref,
                payment_type: 2,
            });
            dispatch(incrementInvoiceNext());
            Alert.alert('Sale', 'Sale completed.');
            await load();
        } catch (e) {
            Alert.alert('Sale', e?.response?.data?.message || e?.message || 'Could not complete sale');
        } finally {
            setBusyRef(null);
        }
    };

    const handleAbandon = (row) => {
        const ref = row?.transaction_ref;
        if (!ref || isSuccess(row?.status)) return;
        Alert.alert(
            'Abandon payment?',
            'Only if the customer will not pay on this MoMo prompt.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Abandon',
                    style: 'destructive',
                    onPress: async () => {
                        setBusyRef(ref);
                        try {
                            await paymentsApi.posAbandon({ reference: ref });
                            await load();
                        } catch (e) {
                            Alert.alert(
                                'MoMo',
                                e?.response?.data?.message || e?.message || 'Could not abandon'
                            );
                        } finally {
                            setBusyRef(null);
                        }
                    },
                },
            ]
        );
    };

    const renderItem = ({ item }) => {
        const paid = isSuccess(item.status);
        const lines = productLines(item.pos_cart_snapshot);
        const busy = busyRef === item.transaction_ref;
        return (
            <View
                style={{
                    marginHorizontal: 16,
                    marginBottom: 10,
                    padding: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <AppText
                        label={`₵ ${Number(item.face_amount ?? item.amount ?? 0).toFixed(2)}`}
                        variant={1}
                        color={colors.text}
                        fontSize={16}
                    />
                    <AppText
                        label={paid ? 'Paid' : String(item.status || 'pending')}
                        color={paid ? '#16a34a' : '#d97706'}
                        fontSize={12}
                    />
                </View>
                <AppText
                    label={`${item.payment_number || '—'} · ${
                        item.created_at ? new Date(item.created_at).toLocaleString() : ''
                    }`}
                    color={colors.textSecondary}
                    fontSize={12}
                />
                <AppText
                    label={`Ref ${item.transaction_ref || ''}${
                        lines.length ? ` · ${lines.length} item(s)` : ' · no cart'
                    }`}
                    color={colors.textTertiary}
                    fontSize={11}
                    style={{ marginTop: 4 }}
                />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {!paid && (
                        <TouchableOpacity
                            disabled={busy}
                            onPress={() => handleCheckStatus(item)}
                            style={{
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                        >
                            <AppText label="Check status" color={colors.text} fontSize={13} />
                        </TouchableOpacity>
                    )}
                    {paid && lines.length > 0 && (
                        <TouchableOpacity
                            disabled={busy}
                            onPress={() => handleComplete(item)}
                            style={{
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 8,
                                backgroundColor: colors.primary,
                            }}
                        >
                            <AppText label="Complete sale" color={colors.textInverse} fontSize={13} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        disabled={busy}
                        onPress={() => handleResume(item)}
                        style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        <AppText label={paid ? 'Open New Sale' : 'Resume'} color={colors.text} fontSize={13} />
                    </TouchableOpacity>
                    {!paid && (
                        <TouchableOpacity disabled={busy} onPress={() => handleAbandon(item)}>
                            <AppText label="Abandon" color={colors.textTertiary} fontSize={13} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Pending MoMo">
                <TouchableOpacity onPress={load} style={{ padding: 8 }}>
                    {loading ? (
                        <ActivityIndicator color={colors.primary} />
                    ) : (
                        <Lucide name="refresh-cw" size={20} color={colors.text} />
                    )}
                </TouchableOpacity>
            </ScreenHeader>
            <FlashList
                data={rows}
                estimatedItemSize={140}
                keyExtractor={(item) => String(item.id || item.transaction_ref)}
                renderItem={renderItem}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
                ListEmptyComponent={
                    !loading ? (
                        <View style={{ padding: 32, alignItems: 'center' }}>
                            <AppText label="No pending MoMo payments" color={colors.textSecondary} />
                            <AppText
                                label="After Send on New Sale, tap Park & serve next."
                                color={colors.textTertiary}
                                fontSize={12}
                                style={{ marginTop: 8, textAlign: 'center' }}
                            />
                        </View>
                    ) : null
                }
            />
        </SafeAreaView>
    );
};

export default PendingMomoPayments;
