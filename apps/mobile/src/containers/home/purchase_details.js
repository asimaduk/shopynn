import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    View,
    Alert,
    ActivityIndicator,
    Image,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import useTheme from '../../hooks/useTheme';
import { purchases as purchasesApi } from '../../services/api';
import { formatCurrency, formatQuantity } from '../../utils/format';

const defaultItem = { id: 'N/A', vendor: 'Unknown', amount: '0.00', date: 'N/A', status: 'N/A', poStatus: 'draft', user: 'Unknown', itemCount: 0 };

const PAYMENT_STATUS = { UNPAID: 0, PAID: 1, PARTIAL: 2 };
const PAYMENT_TYPE = { CASH: 1, MOMO: 2, BANK: 3, OTHER: 4 };

const paymentStatusLabel = (status) => {
    if (Number(status) === PAYMENT_STATUS.PAID) return 'Paid';
    if (Number(status) === PAYMENT_STATUS.PARTIAL) return 'Partial';
    return 'Unpaid';
};

const paymentTypeLabel = (type) => {
    if (Number(type) === PAYMENT_TYPE.MOMO) return 'MoMo';
    if (Number(type) === PAYMENT_TYPE.BANK) return 'Bank';
    if (Number(type) === PAYMENT_TYPE.OTHER) return 'Other';
    if (Number(type) === PAYMENT_TYPE.CASH) return 'Cash';
    return '—';
};

const PurchaseDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { item: routeItem, purchaseId } = route.params || {};
    const [item, setItem] = useState(routeItem || defaultItem);
    const [loading, setLoading] = useState(!!(purchaseId || routeItem?.id));
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [savingPayment, setSavingPayment] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState(PAYMENT_STATUS.PAID);
    const [paymentType, setPaymentType] = useState(PAYMENT_TYPE.CASH);
    const [amountPaid, setAmountPaid] = useState('');
    const [paymentReference, setPaymentReference] = useState('');
    const [paymentNumber, setPaymentNumber] = useState('');
    const poStatus = item.poStatus || 'received';

    const netTotal = Math.max(
        0,
        Number(item.total_amount ?? item.amount ?? 0) - Number(item.discount_amount || 0),
    );
    const isUnpaidOrPartial = Number(item.payment_status) !== PAYMENT_STATUS.PAID;
    const payStatus = Number(item.payment_status);
    const statusBanner =
        payStatus === PAYMENT_STATUS.PAID
            ? {
                  bg: config.GREEN_COLOR,
                  label: item.current_status == 1 ? 'Received · Paid' : 'Paid',
                  icon: 'circle-check',
              }
            : payStatus === PAYMENT_STATUS.PARTIAL
              ? {
                    bg: '#d97706',
                    label: item.current_status == 1 ? 'Received · Partial' : 'Partial',
                    icon: 'circle-alert',
                }
              : {
                    bg: '#dc2626',
                    label: item.current_status == 1 ? 'Received · Unpaid' : 'Unpaid',
                    icon: 'circle-x',
                };
    const paymentStatusIcon =
        payStatus === PAYMENT_STATUS.PAID
            ? 'circle-check'
            : payStatus === PAYMENT_STATUS.PARTIAL
              ? 'circle-alert'
              : 'circle-x';

    useEffect(() => {
        const id = purchaseId || routeItem?.id;
        if (!id || id === 'N/A') return;
        let mounted = true;
        setLoading(true);
        purchasesApi
            .get(id)
            .then((data) => {
                if (mounted && data) setItem((prev) => ({ ...prev, ...data }));
            })
            .catch(() => {})
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [purchaseId, routeItem?.id]);

    const backPress = () => navigation.goBack();
    const markAsSent = () => {
        setItem((prev) => ({ ...prev, poStatus: 'sent' }));
        Alert.alert('Updated', 'Purchase order marked as Sent.');
    };
    const markAsReceived = () => {
        setItem((prev) => ({ ...prev, poStatus: 'received', status: 'Completed' }));
        Alert.alert('Updated', 'Purchase order marked as Received.');
    };

    const openPaymentModal = () => {
        const currentStatus = Number(item.payment_status);
        const nextStatus =
            currentStatus === PAYMENT_STATUS.PARTIAL ? PAYMENT_STATUS.PARTIAL : PAYMENT_STATUS.PAID;
        setPaymentStatus(nextStatus);
        setPaymentType(Number(item.payment_type) || PAYMENT_TYPE.CASH);
        setAmountPaid(
            nextStatus === PAYMENT_STATUS.PAID
                ? String(netTotal.toFixed(2))
                : item.amount_paid != null && Number(item.amount_paid) > 0
                  ? String(Number(item.amount_paid).toFixed(2))
                  : '',
        );
        setPaymentReference(item.payment_reference || '');
        setPaymentNumber(item.payment_number || '');
        setShowPaymentModal(true);
    };

    const closePaymentModal = () => {
        if (!savingPayment) setShowPaymentModal(false);
    };

    const savePayment = async () => {
        const id = item.id || purchaseId;
        if (!id || id === 'N/A') return;

        let resolvedAmount = Number(String(amountPaid).replace(/,/g, ''));
        if (paymentStatus === PAYMENT_STATUS.PAID) {
            if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) resolvedAmount = netTotal;
        } else if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
            Alert.alert('Amount required', 'Enter how much was paid for a partial payment.');
            return;
        }

        setSavingPayment(true);
        try {
            const updated = await purchasesApi.updatePayment(id, {
                payment_status: paymentStatus,
                payment_type: paymentType,
                amount_paid: resolvedAmount,
                payment_reference: paymentReference.trim() || null,
                payment_number: paymentNumber.trim() || null,
                payment_date: new Date().toISOString(),
            });
            if (updated) setItem((prev) => ({ ...prev, ...updated }));
            setShowPaymentModal(false);
            Alert.alert('Saved', 'Purchase payment updated.');
        } catch (error) {
            Alert.alert(
                'Could not save',
                error?.response?.data?.message || error?.message || 'Try again.',
            );
        } finally {
            setSavingPayment(false);
        }
    };

    const DetailSection = ({ title, children }) => (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
                <AppText label={title} fontSize={16} variant={1} style={{ color: colors.text, flex: 1 }} />
            </View>
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

    const Chip = ({ label, active, onPress, activeBg = config.THEME_COLOR }) => (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={[
                styles.chip,
                { borderColor: colors.border },
                active && { backgroundColor: activeBg, borderColor: activeBg },
            ]}
        >
            <AppText label={label} fontSize={12} color={active ? '#fff' : colors.textSecondary} />
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView
                edges={['bottom', 'left', 'right']}
                style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}
            >
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading purchase..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    const formatDateAndTime = (date) => {
        return (
            new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) +
            ' ' +
            new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        );
    };

    const inputStyle = {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: colors.text,
        marginBottom: 10,
        backgroundColor: colors.inputBackground || colors.surface,
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label="Purchase Details" />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15 }}>
                <View style={[styles.statusHeader, { backgroundColor: statusBanner.bg }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                            <AppText
                                label={statusBanner.label}
                                fontSize={20}
                                variant={2}
                                color="#fff"
                            />
                        </View>
                        <Lucide name={statusBanner.icon} size={32} color="#fff" />
                    </View>
                    <View style={styles.divider} />
                    <AppText
                        label={`${item.attendant || item.receiver_name || 'Unknown'} · ${formatDateAndTime(item.created_at)}`}
                        fontSize={13}
                        color="rgba(255,255,255,0.9)"
                    />
                    {(poStatus === 'draft' || poStatus === 'sent') && (
                        <View style={{ flexDirection: 'row', marginTop: 12, gap: 10 }}>
                            {poStatus === 'draft' && (
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={markAsSent}
                                    style={[styles.poActionBtn, { backgroundColor: 'rgba(255,255,255,0.3)' }]}
                                >
                                    <Lucide name="send" size={16} color="#fff" />
                                    <AppText label="Mark as Sent" fontSize={13} color="#fff" style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={markAsReceived}
                                style={[styles.poActionBtn, { backgroundColor: 'rgba(255,255,255,0.3)' }]}
                            >
                                <Lucide name="package-check" size={16} color="#fff" />
                                <AppText label="Mark as Received" fontSize={13} color="#fff" style={{ marginLeft: 6 }} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <DetailSection title="Order Summary">
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                            <AppText label="Purchase ID" fontSize={12} color={colors.textTertiary} />
                            <AppText
                                label={`#${item.invoice_number || item.id || '—'}`}
                                fontSize={16}
                                variant={1}
                                color={colors.text}
                            />
                        </View>
                        <AppText
                            label={formatCurrency(netTotal)}
                            fontSize={18}
                            variant={1}
                            color={config.THEME_COLOR}
                        />
                    </View>
                    <View style={[styles.tagRow, { marginTop: 12 }]}>
                        <View style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
                            <Lucide name="package" size={14} color={colors.textSecondary} />
                            <AppText
                                label={`${item.number_of_items || item.products?.length || item.itemCount || 0} Items`}
                                fontSize={12}
                                color={colors.textSecondary}
                                style={{ marginLeft: 6 }}
                            />
                        </View>
                    </View>
                </DetailSection>

                <DetailSection title="Supplier Information">
                    <DetailRow icon="store" label="Name" value={item.supplier || item.vendor || 'N/A'} />
                    <DetailRow icon="user" label="Contact Person" value={item.supplier_manager ?? 'N/A'} />
                    <DetailRow icon="map-pin" label="Business Location" value={item.supplier_address ?? 'N/A'} />
                </DetailSection>

                <DetailSection title="Payment">
                    <DetailRow icon={paymentStatusIcon} label="Status" value={paymentStatusLabel(item.payment_status)} />
                    <DetailRow icon="wallet" label="Method" value={paymentTypeLabel(item.payment_type)} />
                    <DetailRow icon="coins" label="Amount paid" value={formatCurrency(Number(item.amount_paid) || 0)} />
                    <DetailRow icon="hash" label="Reference" value={item.payment_reference || '—'} />
                    {item.payment_number ? (
                        <DetailRow icon="smartphone" label="Payment number" value={item.payment_number} />
                    ) : null}
                    <DetailRow
                        icon="calendar-days"
                        label={item.payment_date ? 'Payment date' : 'Due date'}
                        value={
                            item.payment_date
                                ? formatDateAndTime(item.payment_date)
                                : item.due_date
                                  ? formatDateAndTime(item.due_date)
                                  : '—'
                        }
                    />
                    {isUnpaidOrPartial ? (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={openPaymentModal}
                            style={[styles.primaryPaymentBtn, { backgroundColor: config.THEME_COLOR }]}
                        >
                            <Lucide name="wallet" size={18} color="#fff" />
                            <AppText
                                label={
                                    Number(item.payment_status) === PAYMENT_STATUS.PARTIAL
                                        ? 'Update payment'
                                        : 'Record payment'
                                }
                                color="#fff"
                                variant={1}
                                style={{ marginLeft: 8 }}
                            />
                        </TouchableOpacity>
                    ) : null}
                </DetailSection>

                <DetailSection title="Purchased Items">
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
                                    style={{ marginTop: 2 }}
                                />
                            </View>
                            <AppText
                                label={formatCurrency(Number(prod.quantity || 0) * Number(prod.unit_price || 0))}
                                fontSize={14}
                                variant={1}
                                color={colors.text}
                            />
                        </View>
                    ))}
                </DetailSection>
            </ScrollView>

            <AppModal
                visible={showPaymentModal}
                title="Record payment"
                handleClose={closePaymentModal}
                onRequestClose={closePaymentModal}
            >
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    style={{ maxHeight: 420 }}
                    contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
                >
                    <AppText
                        label={`Purchase total: ${formatCurrency(netTotal)}`}
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginBottom: 12 }}
                    />

                    <AppText label="Status" fontSize={13} variant={1} color={colors.text} style={{ marginBottom: 8 }} />
                    <View style={styles.chipRow}>
                        {[
                            { id: PAYMENT_STATUS.PAID, label: 'Paid' },
                            { id: PAYMENT_STATUS.PARTIAL, label: 'Partial' },
                        ].map((opt) => (
                            <Chip
                                key={opt.id}
                                label={opt.label}
                                active={paymentStatus === opt.id}
                                onPress={() => {
                                    setPaymentStatus(opt.id);
                                    if (opt.id === PAYMENT_STATUS.PAID) {
                                        setAmountPaid(String(netTotal.toFixed(2)));
                                    }
                                }}
                            />
                        ))}
                    </View>

                    <AppText
                        label="Method"
                        fontSize={13}
                        variant={1}
                        color={colors.text}
                        style={{ marginTop: 12, marginBottom: 8 }}
                    />
                    <View style={styles.chipRow}>
                        {[
                            { id: PAYMENT_TYPE.CASH, label: 'Cash' },
                            { id: PAYMENT_TYPE.MOMO, label: 'MoMo' },
                            { id: PAYMENT_TYPE.BANK, label: 'Bank' },
                            { id: PAYMENT_TYPE.OTHER, label: 'Other' },
                        ].map((opt) => (
                            <Chip
                                key={opt.id}
                                label={opt.label}
                                active={paymentType === opt.id}
                                onPress={() => setPaymentType(opt.id)}
                            />
                        ))}
                    </View>

                    <AppText
                        label="Amount paid"
                        fontSize={13}
                        variant={1}
                        color={colors.text}
                        style={{ marginTop: 12, marginBottom: 8 }}
                    />
                    <TextInput
                        value={amountPaid}
                        onChangeText={(val) => {
                            if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setAmountPaid(val);
                        }}
                        keyboardType="decimal-pad"
                        placeholder={String(netTotal.toFixed(2))}
                        placeholderTextColor={colors.textTertiary}
                        style={inputStyle}
                    />

                    <AppText label="Reference (optional)" fontSize={13} variant={1} color={colors.text} style={{ marginBottom: 8 }} />
                    <TextInput
                        value={paymentReference}
                        onChangeText={(t) => {
                            if (t.length <= 50) setPaymentReference(t);
                        }}
                        placeholder="Receipt / transfer ref"
                        placeholderTextColor={colors.textTertiary}
                        style={inputStyle}
                    />

                    {(paymentType === PAYMENT_TYPE.MOMO || paymentType === PAYMENT_TYPE.BANK) && (
                        <>
                            <AppText
                                label={paymentType === PAYMENT_TYPE.MOMO ? 'MoMo number (optional)' : 'Account number (optional)'}
                                fontSize={13}
                                variant={1}
                                color={colors.text}
                                style={{ marginBottom: 8 }}
                            />
                            <TextInput
                                value={paymentNumber}
                                onChangeText={(t) => {
                                    const next =
                                        paymentType === PAYMENT_TYPE.MOMO
                                            ? String(t || '').replace(/\D/g, '').slice(0, 10)
                                            : String(t || '').replace(/\D/g, '').slice(0, 50);
                                    setPaymentNumber(next);
                                }}
                                keyboardType="number-pad"
                                placeholder={paymentType === PAYMENT_TYPE.MOMO ? '0XX XXX XXXX' : 'Account number'}
                                placeholderTextColor={colors.textTertiary}
                                style={inputStyle}
                            />
                        </>
                    )}

                    <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={savingPayment}
                        onPress={savePayment}
                        style={[
                            styles.primaryPaymentBtn,
                            { backgroundColor: config.THEME_COLOR, marginTop: 4, opacity: savingPayment ? 0.6 : 1 },
                        ]}
                    >
                        {savingPayment ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Lucide name="check" size={18} color="#fff" />
                                <AppText label="Save payment" color="#fff" variant={1} style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </AppModal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
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
    poActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
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
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        gap: 8,
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
        paddingVertical: 6,
        borderRadius: 16,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    itemImage: {
        width: 44,
        height: 44,
        borderRadius: 8,
    },
    primaryPaymentBtn: {
        marginTop: 8,
        height: 48,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 4,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
});

export default PurchaseDetails;
