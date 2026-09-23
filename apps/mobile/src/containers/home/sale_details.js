import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, Alert, ActivityIndicator, Linking, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import useTheme from '../../hooks/useTheme';
import InvoiceShareSheet from '../../components/invoice_share_sheet';
import { formatCurrency, formatQuantity } from '../../utils/format';
import { formatSalePaymentLabel, salePaymentIcon } from '../../utils/salePayment';
import { sales as salesApi } from '../../services/api';
import { hasPermission } from '../../utils/permissions';
import {
    SECURE_PENDING_SALES_KEY as PENDING_SALES_KEY,
    readSecureList,
    writeSecureList,
} from '../../utils/secureOfflineStorage';

const safeString = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const getErrorCode = (err) => safeString(err?.response?.data?.code || err?.response?.data?.error?.code || err?.response?.data?.data?.code).toUpperCase();
const getErrorMessage = (err) =>
    safeString(
        err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            'Upload failed.'
    );

const paymentStatusLabel = (status) => {
    const n = Number(status);
    if (n === 1) return 'Paid';
    if (n === 2) return 'Partial';
    if (n === 0) return 'On credit';
    return '—';
};

const SaleDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const user = useSelector(({ user }) => user);
    const appSettings = useSelector((s) => s.appSettings) || {};
    const { item: paramItem, saleId, mode } = route.params || {};
    const [item, setItem] = useState(paramItem);
    const isPendingUpload = mode === 'pending-upload' || !!paramItem?.payload;
    const [loading, setLoading] = useState(!isPendingUpload && !!(saleId || paramItem?.id));
    const [showInvoiceShare, setShowInvoiceShare] = useState(false);
    const [resendingInvoice, setResendingInvoice] = useState(false);
    const canResendInvoice = hasPermission(user, 'sales.share_receipt');
    const canCollect = hasPermission(user, 'sales.create');

    const [showCollectModal, setShowCollectModal] = useState(false);
    const [collectAmount, setCollectAmount] = useState('');
    const [collectMethod, setCollectMethod] = useState('cash');
    const [collectNote, setCollectNote] = useState('');
    const [collectRef, setCollectRef] = useState('');
    const [savingCollect, setSavingCollect] = useState(false);

    const reloadSale = async () => {
        const id = saleId || paramItem?.id || item?.id;
        if (!id || isPendingUpload) return;
        try {
            const data = await salesApi.get(id);
            if (data) setItem((prev) => ({ ...prev, ...data }));
        } catch (_) {
            /* keep current */
        }
    };

    useEffect(() => {
        const id = saleId || paramItem?.id;
        if (isPendingUpload) return;
        if (!id) return;
        let mounted = true;
        setLoading(true);
        salesApi.get(id).then((data) => {
            if (mounted && data) setItem((prev) => ({ ...prev, ...data }));
        }).catch(() => {}).finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [saleId, paramItem?.id]);

    const balanceDue = Number(item?.balance_due ?? 0);
    const amountPaid = Number(item?.amount_paid ?? 0);
    const storeCreditBalance = Number(item?.store_credit_balance ?? 0);
    const canCollectPayment = !isPendingUpload && canCollect && (item?.can_collect_payment || balanceDue > 0.02);

    const openCollectModal = () => {
        setCollectAmount(balanceDue > 0 ? balanceDue.toFixed(2) : '');
        setCollectMethod('cash');
        setCollectNote('');
        setCollectRef('');
        setShowCollectModal(true);
    };

    const saveCollectPayment = async () => {
        const id = saleId || item?.id;
        if (!id) return;
        const amt = Number(String(collectAmount).replace(/,/g, ''));
        if (!Number.isFinite(amt) || amt <= 0) {
            Alert.alert('Amount required', 'Enter how much is being collected.');
            return;
        }
        if (amt > balanceDue + 0.02) {
            Alert.alert('Too much', `Balance due is ${formatCurrency(balanceDue)}.`);
            return;
        }
        if (collectMethod === 'store_credit') {
            if (!item?.customer_id) {
                Alert.alert('Customer required', 'Store credit can only be applied when the sale has a customer.');
                return;
            }
            if (amt > storeCreditBalance + 0.02) {
                Alert.alert(
                    'Insufficient credit',
                    `Available store credit is ${formatCurrency(storeCreditBalance)}.`,
                );
                return;
            }
        }
        if (collectMethod === 'momo') {
            const ref = String(collectRef || '').trim();
            if (!ref) {
                Alert.alert(
                    'MoMo reference required',
                    'Enter the confirmed Paystack payment reference from a completed MoMo charge.',
                );
                return;
            }
        }
        setSavingCollect(true);
        try {
            const body = {
                amount: amt,
                payment_method: collectMethod,
                payment_reference: collectRef.trim() || null,
                note: collectNote.trim() || null,
            };
            if (collectMethod === 'momo') {
                body.payment_transaction_ref = collectRef.trim();
            }
            await salesApi.recordPayment(id, body);
            setShowCollectModal(false);
            await reloadSale();
            Alert.alert('Collected', 'Payment recorded.');
        } catch (error) {
            Alert.alert(
                'Could not save',
                error?.response?.data?.message || error?.message || 'Try again.',
            );
        } finally {
            setSavingCollect(false);
        }
    };

    const removePendingSaleById = async (pendingId) => {
        const list = await readSecureList(PENDING_SALES_KEY);
        const next = Array.isArray(list) ? list.filter((x) => String(x?.id) !== String(pendingId)) : [];
        await writeSecureList(PENDING_SALES_KEY, next);
        return next;
    };

    const updatePendingSale = async (pendingId, updater) => {
        const list = await readSecureList(PENDING_SALES_KEY);
        const next = (Array.isArray(list) ? list : []).map((x) => {
            if (String(x?.id) !== String(pendingId)) return x;
            return updater(x);
        });
        await writeSecureList(PENDING_SALES_KEY, next);
        return next;
    };

    const handleRetryPendingUpload = async () => {
        const pendingId = item?.id;
        if (!pendingId || !item?.payload) return;
        try {
            await salesApi.create(item.payload);
            await removePendingSaleById(pendingId);
            Alert.alert('Uploaded', 'Pending sale uploaded successfully.');
            navigation.goBack();
        } catch (err) {
            const nowIso = new Date().toISOString();
            const nextItem = {
                ...item,
                attempts: (Number(item?.attempts) || 0) + 1,
                last_attempt_at: nowIso,
                last_error_code: getErrorCode(err) || item?.last_error_code || null,
                last_error_message: getErrorMessage(err) || item?.last_error_message || null,
            };
            setItem(nextItem);
            await updatePendingSale(pendingId, () => nextItem);
            Alert.alert('Upload failed', nextItem.last_error_message || 'Could not upload this sale.');
        }
    };

    const handleEditPendingSale = () => {
        const pendingId = item?.id;
        Alert.alert(
            'Edit pending sale',
            'This will remove it from Pending Sales and open it in New Sale for editing.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Edit',
                    onPress: async () => {
                        if (pendingId) await removePendingSaleById(pendingId);
                        navigation.navigate('NewSale', { restorePendingSale: item });
                    },
                },
            ],
        );
    };

    const handleDeletePendingSale = () => {
        const pendingId = item?.id;
        Alert.alert('Delete pending sale?', 'This will remove it from Pending Sales.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    if (pendingId) await removePendingSaleById(pendingId);
                    navigation.goBack();
                },
            },
        ]);
    };

    const backPress = () => {
        navigation.goBack();
    };

    const handleResendInvoice = () => {
        const id = saleId || item?.id;
        if (!id || isPendingUpload) return;
        const emailHint = item?.customer_email ? ` to ${item.customer_email}` : '';
        Alert.alert(
            'Resend invoice',
            `Email invoice #${item?.invoice_number}${emailHint}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Resend',
                    onPress: async () => {
                        setResendingInvoice(true);
                        try {
                            const result = await salesApi.sendInvoice(
                                id,
                                item?.customer_email ? { email: item.customer_email } : {},
                            );
                            Alert.alert('Sent', `Invoice resent to ${result?.sent_to || item?.customer_email || 'customer'}.`);
                        } catch (err) {
                            const msg = err?.response?.data?.message || err?.message || 'Could not resend invoice.';
                            Alert.alert('Resend failed', msg);
                        } finally {
                            setResendingInvoice(false);
                        }
                    },
                },
            ],
        );
    };

    const handleCallCustomer = async () => {
        const phone = String(item.customer_phone || '').trim();
        if (!phone) return;
        const url = `tel:${phone}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert('Call', 'This device cannot make phone calls.');
            }
        } catch (err) {
            const msg = err?.message || 'Failed to start the call.';
            Alert.alert('Error', msg);
        }
    };

    const DetailSection = ({ title, children }) => (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <AppText label={title} fontSize={16} variant={1} style={[styles.sectionTitle, { color: colors.text }]} />
            {children}
        </View>
    );

    const DetailRow = ({ icon, label, value }) => (
        <View style={styles.detailRow}>
            <View style={[styles.iconContainer, { backgroundColor: colors.surfaceSecondary }]}>
                <Lucide name={icon} color={colors.textSecondary} size={18} />
            </View>
            <View style={{ flex: 1 }}>
                <AppText label={label} fontSize={12} color={colors.textTertiary} />
                <AppText label={value} fontSize={15} color={colors.text} />
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading sale..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label={'Sale Details'}>
                <View style={{ flexDirection: 'row', paddingRight: 10, gap: 8 }}>
                    {!isPendingUpload && canResendInvoice ? (
                        <TouchableOpacity
                            activeOpacity={0.6}
                            onPress={handleResendInvoice}
                            disabled={resendingInvoice}
                            style={[styles.headerActionButton, { backgroundColor: colors.surfaceSecondary }]}
                        >
                            {resendingInvoice ? (
                                <ActivityIndicator size="small" color={config.THEME_COLOR} />
                            ) : (
                                <Lucide name="mail" color={config.THEME_COLOR} size={20} />
                            )}
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => setShowInvoiceShare(true)}
                        style={[styles.headerActionButton, { backgroundColor: colors.surfaceSecondary }]}
                    >
                        <Lucide name="file-text" color={config.THEME_COLOR} size={20} />
                    </TouchableOpacity>
                    {/* <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => navigation.navigate("NewSale", {item: item})}
                        style={[styles.headerActionButton, { backgroundColor: colors.surfaceSecondary }]}
                    >
                        <Lucide name="redo-dot" color={colors.textSecondary} size={20} />
                    </TouchableOpacity> */}
                </View>
            </ScreenHeader>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15 }}>
                {isPendingUpload && (
                    <View style={[styles.section, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.iconContainer, { backgroundColor: colors.warningLight }]}>
                                    <Lucide name="cloud-off" size={18} color={colors.warning} />
                                </View>
                                <View style={{ marginLeft: 10 }}>
                                    <AppText label="Pending upload" variant={1} fontSize={15} color={colors.text} />
                                    <AppText
                                        label={(item?.last_error_message || 'Will upload when internet is available.').trim()}
                                        fontSize={12}
                                        color={colors.textSecondary}
                                        style={{ marginTop: 2, maxWidth: 260 }}
                                    />
                                </View>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <AppText label={`Attempts: ${Number(item?.attempts) || 0}`} fontSize={11} color={colors.textTertiary} />
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleRetryPendingUpload}
                                style={{ flex: 1, backgroundColor: config.THEME_COLOR, paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}>
                                <AppText label="Retry now" variant={1} fontSize={13} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleEditPendingSale}
                                style={{ flex: 1, backgroundColor: colors.surfaceSecondary, paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}>
                                <AppText label="Edit" variant={1} fontSize={13} color={colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={handleDeletePendingSale}
                                style={{ backgroundColor: colors.errorLight, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' }}>
                                <Lucide name="trash-2" size={16} color={colors.error} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Status Header */}
                <View style={[styles.statusHeader, { backgroundColor: item.status === 'Delivered' ? config.GREEN_COLOR : config.THEME_COLOR }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <AppText label={item.status} fontSize={20} variant={2} color={'#fff'} />
                            <AppText label={item.date} fontSize={13} color={'rgba(255,255,255,0.8)'} />
                        </View>
                        <Lucide name={item.status === 'Delivered' ? "circle-check" : "clock"} size={32} color="#fff" />
                    </View>
                    <View style={styles.divider} />
                    <AppText label={`Attendant: ${item.user}`} fontSize={13} color={'rgba(255,255,255,0.9)'} />
                </View>

                {/* Sale Summary */}
                <DetailSection title="Sale Summary">
                    <View style={styles.summaryBox}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15, gap: 12 }}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <AppText label="Transaction ID" fontSize={12} color={colors.textTertiary} />
                                <AppText
                                    label={`#${item.invoice_number}`}
                                    fontSize={18}
                                    variant={1}
                                    color={colors.text}
                                    numberOfLines={1}
                                />
                            </View>
                            <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                                <AppText label="Total Amount" fontSize={12} color={colors.textTertiary} />
                                <AppText
                                    label={formatCurrency(Number(String(item.amount ?? 0).replace(/,/g, '')) || 0)}
                                    fontSize={18}
                                    variant={1}
                                    color={config.THEME_COLOR}
                                    style={{ fontVariant: ['tabular-nums'] }}
                                />
                            </View>
                        </View>
                        <View style={styles.tagRow}>
                            <View style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name="package" size={14} color={colors.textSecondary} />
                                <AppText label={`${item.itemCount || 0} Items`} fontSize={13} color={colors.textSecondary} style={{ marginLeft: 5 }} />
                            </View>
                            <View style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
                                <Lucide name={salePaymentIcon(item)} size={14} color={colors.textSecondary} />
                                <AppText
                                    label={formatSalePaymentLabel(item, { withSaleSuffix: true })}
                                    fontSize={13}
                                    color={colors.textSecondary}
                                    style={{ marginLeft: 5 }}
                                />
                            </View>
                        </View>
                    </View>
                </DetailSection>

                {/* Customer info section */}
                <DetailSection title="Customer Information">
                    <DetailRow icon="user" label="Customer Name" value={item.customer ? item.customer : 'Walk-in'} />
                    <DetailRow icon="phone" label="Contact Number" value={item.customer_phone ? item.customer_phone : 'N/A'} />
                    <DetailRow icon="map-pin" label="Location" value={item.customer_address ? item.customer_address : 'N/A'} />
                    {item.customer_phone ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={handleCallCustomer}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 999,
                                    backgroundColor: config.THEME_COLOR + '15',
                                }}
                            >
                                <Lucide name="phone" size={16} color={config.THEME_COLOR} style={{ marginRight: 6 }} />
                                <AppText label="Call customer" fontSize={13} color={config.THEME_COLOR} />
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </DetailSection>

                {/* Payment Info */}
                <DetailSection title="Payment & Reference">
                    <DetailRow icon="hash" label="Receipt Number" value={item.payment_refrence ?? item.payment_reference ?? 'N/A'} />
                    <DetailRow icon="credit-card" label="Payment Method" value={formatSalePaymentLabel(item)} />
                    <DetailRow icon="badge-check" label="Status" value={paymentStatusLabel(item.payment_status)} />
                    <DetailRow icon="banknote" label="Amount paid" value={formatCurrency(amountPaid)} />
                    <DetailRow icon="wallet" label="Balance due" value={formatCurrency(balanceDue)} />
                    {canCollectPayment ? (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={openCollectModal}
                            style={{
                                marginTop: 12,
                                backgroundColor: config.THEME_COLOR,
                                paddingVertical: 12,
                                borderRadius: 10,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                            }}
                        >
                            <Lucide name="hand-coins" size={18} color="#fff" />
                            <AppText label="Collect payment" variant={1} fontSize={14} color="#fff" style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    ) : null}
                    {Array.isArray(item.payments) && item.payments.length > 0 ? (
                        <View style={{ marginTop: 14 }}>
                            <AppText label="Payment history" fontSize={13} variant={1} color={colors.text} style={{ marginBottom: 8 }} />
                            {item.payments.map((p) => (
                                <View
                                    key={p.id}
                                    style={{
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        paddingVertical: 8,
                                        borderTopWidth: StyleSheet.hairlineWidth,
                                        borderTopColor: colors.border,
                                    }}
                                >
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <AppText
                                            label={`${String(p.payment_method || 'cash').toUpperCase()} · ${formatCurrency(Number(p.amount) || 0)}`}
                                            fontSize={13}
                                            color={colors.text}
                                        />
                                        <AppText
                                            label={p.created_at ? new Date(p.created_at).toLocaleString() : ''}
                                            fontSize={11}
                                            color={colors.textTertiary}
                                        />
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </DetailSection>

                <DetailSection title="Sold Items">
                    {item.products?.map((prod, i) => (
                        <View key={prod.sku || prod.id || i} style={[styles.itemRow, { borderBottomColor: colors.borderLight }]}>
                            <Image
                                source={
                                    prod.thumbnail
                                        ? { uri: `${config.BASE_API}/images?id=${prod.thumbnail}` }
                                        : require('../../assets/images/product-image-placeholder.png')
                                }
                                style={[styles.itemImage, { backgroundColor: colors.surfaceTertiary }]}
                                resizeMode="cover"
                            />
                            <View style={{ flex: 1, marginLeft: 10, marginRight: 10 }}>
                                <AppText label={prod.name} fontSize={14} variant={1} color={colors.text} />
                                <AppText
                                    label={`${formatCurrency(Number(prod.unit_price) || 0)} × ${formatQuantity(prod.quantity)}`}
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}
                                />
                            </View>
                            <AppText
                                label={formatCurrency(Number(prod.quantity || 0) * Number(prod.unit_price || 0))}
                                fontSize={14}
                                variant={1}
                                color={colors.text}
                                style={{ fontVariant: ['tabular-nums'] }}
                            />
                        </View>
                    ))}
                </DetailSection>

                {!isPendingUpload && (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setShowInvoiceShare(true)}
                        style={[styles.invoiceCta, { backgroundColor: config.THEME_COLOR }]}
                    >
                        <Lucide name="send" size={18} color="#fff" />
                        <AppText label="Send invoice" variant={1} fontSize={15} color="#fff" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                )}
                {!isPendingUpload ? (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() =>
                            navigation.navigate('NewSaleReturn', {
                                saleId: saleId || item?.id,
                                item,
                            })
                        }
                        style={[
                            styles.invoiceCta,
                            {
                                backgroundColor: colors.surfaceSecondary,
                                marginTop: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <Lucide name="undo-2" size={18} color={config.THEME_COLOR} />
                        <AppText label="Return items" variant={1} fontSize={15} color={config.THEME_COLOR} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                ) : null}
            </ScrollView>

            <AppModal
                title="Collect payment"
                visible={showCollectModal}
                handleClose={() => !savingCollect && setShowCollectModal(false)}
                onRequestClose={() => !savingCollect && setShowCollectModal(false)}
            >
                <AppText label={`Balance due ${formatCurrency(balanceDue)}`} fontSize={13} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                {storeCreditBalance > 0.001 ? (
                    <AppText
                        label={`Store credit available ${formatCurrency(storeCreditBalance)}`}
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginBottom: 12 }}
                    />
                ) : null}
                <AppText label="Amount (GHS)" fontSize={13} color={colors.text} style={{ marginBottom: 6 }} />
                <TextInput
                    value={collectAmount}
                    onChangeText={setCollectAmount}
                    keyboardType="decimal-pad"
                    placeholder={balanceDue.toFixed(2)}
                    placeholderTextColor={colors.placeholder}
                    style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        color: colors.text,
                        marginBottom: 12,
                        backgroundColor: colors.inputBackground || colors.surface,
                    }}
                />
                <AppText label="Method" fontSize={13} color={colors.text} style={{ marginBottom: 8 }} />
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    {['cash', 'momo', 'store_credit'].map((m) => (
                        <TouchableOpacity
                            key={m}
                            activeOpacity={0.7}
                            onPress={() => {
                                setCollectMethod(m);
                                if (m === 'store_credit' && storeCreditBalance > 0.001) {
                                    const capped = Math.min(balanceDue, storeCreditBalance);
                                    setCollectAmount(capped.toFixed(2));
                                }
                            }}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: collectMethod === m ? config.THEME_COLOR : colors.border,
                                backgroundColor: collectMethod === m ? config.THEME_COLOR : colors.surfaceSecondary,
                            }}
                        >
                            <AppText
                                label={m === 'cash' ? 'Cash' : m === 'momo' ? 'MoMo' : 'Credit'}
                                fontSize={13}
                                color={collectMethod === m ? '#fff' : colors.textSecondary}
                            />
                        </TouchableOpacity>
                    ))}
                </View>
                {collectMethod === 'momo' ? (
                    <>
                        <AppText label="Paystack reference (required)" fontSize={13} color={colors.text} style={{ marginBottom: 6 }} />
                        <TextInput
                            value={collectRef}
                            onChangeText={setCollectRef}
                            placeholder="Confirmed MoMo transaction ref"
                            placeholderTextColor={colors.placeholder}
                            style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 10,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                color: colors.text,
                                marginBottom: 12,
                                backgroundColor: colors.inputBackground || colors.surface,
                            }}
                        />
                    </>
                ) : null}
                <AppText label="Note (optional)" fontSize={13} color={colors.text} style={{ marginBottom: 6 }} />
                <TextInput
                    value={collectNote}
                    onChangeText={setCollectNote}
                    placeholder="Collection note"
                    placeholderTextColor={colors.placeholder}
                    style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        color: colors.text,
                        marginBottom: 16,
                        backgroundColor: colors.inputBackground || colors.surface,
                    }}
                />
                <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={savingCollect}
                    onPress={saveCollectPayment}
                    style={{
                        backgroundColor: config.THEME_COLOR,
                        paddingVertical: 12,
                        borderRadius: 10,
                        alignItems: 'center',
                        opacity: savingCollect ? 0.6 : 1,
                    }}
                >
                    <AppText label={savingCollect ? 'Saving…' : 'Record payment'} variant={1} color="#fff" />
                </TouchableOpacity>
            </AppModal>

            <InvoiceShareSheet
                visible={showInvoiceShare}
                sale={item}
                saleId={saleId || item?.id}
                appSettings={appSettings}
                onClose={() => setShowInvoiceShare(false)}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    headerActionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusHeader: {
        padding: 20,
        borderRadius: 5,
        marginBottom: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginVertical: 15,
    },
    section: {
        borderRadius: 5,
        padding: 15,
        marginBottom: 15,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    sectionTitle: {
        marginBottom: 15,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    itemImage: {
        width: 40,
        height: 40,
        borderRadius: 8,
        overflow: 'hidden',
    },
    invoiceCta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 10,
        marginBottom: 24,
    },
});

export default SaleDetails;