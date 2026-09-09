import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import ScreenHeader from '../../components/screen_header';
import { useSelector } from 'react-redux';
import { orders, payments } from '../../services/api';

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});
const MOMO_NUMBER_MAX_LENGTH = 10;
const MOMO_NETWORK_OPTIONS = [
    { id: 'mtn', label: 'MTN', provider: 'mtn', color: '#FFCC00', icon: 'signal' },
    { id: 'telecel', label: 'Telecel', provider: 'vod', color: '#E60000', icon: 'activity' },
    { id: 'airteltigo', label: 'AirtelTigo', provider: 'tgo', color: '#1F3A93', icon: 'smartphone' },
];

const normalizeMomoNumber = (value = '') => {
    let digits = String(value).replace(/\D/g, '');
    if (digits.startsWith('233') && digits.length >= 12) digits = `0${digits.slice(3)}`;
    return digits.slice(0, MOMO_NUMBER_MAX_LENGTH);
};

const Payment = ({ navigation, route }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const user = useSelector((state) => state.user);
    const {
        amount = 299.00,
        planName = 'Premium',
        billingCycle = 'monthly',
        nextBillingDate = '',
        flowType = 'subscription',
        orderId = null,
        subscriptionId = null,
        upgradeBonusDays = 0,
        upgradeCreditGhs = null,
        onSuccessNavigateTo = null,
        onSuccessNavigateParams = null,
    } = route.params || {};
    
    const [selectedMethod, setSelectedMethod] = useState('momo'); // 'card', 'momo'
    const [momoNumber, setMomoNumber] = useState('');
    const [momoNetwork, setMomoNetwork] = useState('mtn'); // 'mtn', 'telecel', 'airteltigo'
    const [telecelVoucher, setTelecelVoucher] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const formatCurrency = (value) => formatter.format(value).replace('GH₵', 'GHS ').trim();
    const isTelecel = momoNetwork === 'telecel';

    const isOrderFlow = flowType === 'order' || flowType === 'order_partial';

    const validateMomoForm = () => {
        const phone = normalizeMomoNumber(momoNumber);
        if (!phone || phone.length < MOMO_NUMBER_MAX_LENGTH) {
            Alert.alert('Required', `Please enter a valid ${MOMO_NUMBER_MAX_LENGTH}-digit mobile money number.`);
            return null;
        }
        if (isTelecel && !String(telecelVoucher || '').trim()) {
            Alert.alert(
                'Voucher required',
                'Dial *110# to generate a Telecel Cash voucher, then enter it here.',
            );
            return null;
        }
        return { phone, voucher: String(telecelVoucher || '').trim() };
    };

    const submitTelecelVoucherIfNeeded = async ({ mode, orderId: oid, transactionRef, voucher }) => {
        if (!isTelecel || !voucher || !transactionRef) return;
        if (mode === 'order') {
            await orders.submitPaymentOtp(oid, { reference: transactionRef, otp: voucher });
            return;
        }
        await payments.submitOtp({ reference: transactionRef, otp: voucher });
    };

    const handleSubscriptionPayment = async () => {
        if (!subscriptionId) {
            Alert.alert('Payment', 'Subscription reference is missing. Go back and choose a plan again.');
            return;
        }
        const paymentBodyBase = {
            amount: Number(amount),
            subscription_id: subscriptionId,
            email: user?.email,
        };
        setSubmitting(true);
        try {
            if (selectedMethod === 'card') {
                const res = await payments.initiate({
                    ...paymentBodyBase,
                    payment_method: 'card',
                });
                const checkoutUrl =
                    res?.redirect_url || res?.authorization_url || res?.data?.authorization_url;
                if (!checkoutUrl) {
                    Alert.alert('Payment', 'Could not start card checkout. Try again.');
                    return;
                }
                navigation.navigate('PaymentWebView', {
                    checkoutUrl,
                    amount,
                    planName,
                    billingCycle,
                    nextBillingDate,
                    paymentReference: res?.transaction_ref,
                    screenTitle: 'Subscription payment',
                    successNavigateTo: 'Subscription',
                    flowType: 'subscription',
                });
                return;
            }

            const momo = validateMomoForm();
            if (!momo) return;
            const res = await payments.initiate({
                ...paymentBodyBase,
                payment_method: 'mobile_money',
                phone: momo.phone,
                provider: MOMO_NETWORK_OPTIONS.find((n) => n.id === momoNetwork)?.provider || 'mtn',
            });
            const transactionRef = res?.transaction_ref;
            try {
                await submitTelecelVoucherIfNeeded({
                    mode: 'subscription',
                    transactionRef,
                    voucher: momo.voucher,
                });
            } catch (otpErr) {
                Alert.alert(
                    'Voucher',
                    otpErr?.response?.data?.message ||
                        otpErr?.message ||
                        'Could not submit Telecel voucher. You can retry on the next screen.',
                );
            }
            const msg =
                res?.display_text ||
                res?.ussd_code ||
                (isTelecel
                    ? 'Telecel voucher submitted. Confirm status on the next screen.'
                    : 'Complete the payment prompt on your phone.');
            Alert.alert('Mobile money', msg);
            navigation.navigate('MomoStatus', {
                amount,
                planName,
                momoNumber: momo.phone,
                momoNetwork,
                transactionId: transactionRef,
                transactionRef,
                mode: 'subscription',
                needsVoucher: isTelecel,
            });
        } catch (error) {
            Alert.alert(
                'Payment failed',
                error?.response?.data?.message || error?.message || 'Could not start payment.',
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handlePayment = async () => {
        if (submitting) return;
        if (!isOrderFlow) {
            if (selectedMethod === 'momo' && !validateMomoForm()) return;
            await handleSubscriptionPayment();
            return;
        }

        if (!orderId) {
            Alert.alert('Payment', 'Order reference is missing.');
            return;
        }

        setSubmitting(true);
        const initiateFn =
            flowType === 'order_partial' ? orders.initiatePartialPayment : orders.initiatePayment;
        const paymentBodyBase = { amount: Number(amount) };

        try {
            if (selectedMethod === 'card') {
                const res = await initiateFn(orderId, { ...paymentBodyBase, payment_method: 'card' });
                if (!res?.redirect_url) {
                    Alert.alert('Payment', 'Could not start card checkout. Try again.');
                    return;
                }
                navigation.navigate('PaymentWebView', {
                    checkoutUrl: res.redirect_url,
                    paymentReference: res?.transaction_ref,
                    orderId,
                    screenTitle: 'Pay order',
                    successNavigateTo: onSuccessNavigateTo || 'MyOrderDetails',
                    successNavigateParams: onSuccessNavigateParams || { orderId },
                });
                return;
            }

            const momo = validateMomoForm();
            if (!momo) return;
            const res = await initiateFn(orderId, {
                ...paymentBodyBase,
                payment_method: 'mobile_money',
                phone: momo.phone,
                provider: MOMO_NETWORK_OPTIONS.find((n) => n.id === momoNetwork)?.provider || 'mtn',
            });
            const transactionRef = res?.transaction_ref;
            try {
                await submitTelecelVoucherIfNeeded({
                    mode: 'order',
                    orderId,
                    transactionRef,
                    voucher: momo.voucher,
                });
            } catch (otpErr) {
                Alert.alert(
                    'Voucher',
                    otpErr?.response?.data?.message ||
                        otpErr?.message ||
                        'Could not submit Telecel voucher. You can retry on the next screen.',
                );
            }
            const msg =
                res?.display_text ||
                res?.ussd_code ||
                (isTelecel
                    ? 'Telecel voucher submitted. Confirm status on the next screen.'
                    : 'Complete the payment prompt on your phone.');
            Alert.alert('Mobile money', msg);
            navigation.navigate('MomoStatus', {
                amount,
                planName: planName || 'Order payment',
                momoNumber: momo.phone,
                momoNetwork,
                transactionId: transactionRef,
                transactionRef,
                mode: 'order',
                orderId,
                needsVoucher: isTelecel,
                successNavigateTo: onSuccessNavigateTo || 'MyOrderDetails',
                successNavigateParams: onSuccessNavigateParams || { orderId },
            });
        } catch (error) {
            Alert.alert('Payment failed', error?.response?.data?.message || error?.message || 'Could not start payment.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <ScreenHeader
                label="Make Payment"
                onPress={() => navigation.goBack()}
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled">
                
                {/* Payment Summary */}
                <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.summaryRow}>
                        <AppText
                            label={isOrderFlow ? (flowType === 'order_partial' ? 'Partial payment' : 'Order') : 'Plan'}
                            fontSize={14}
                            color={colors.textSecondary}
                        />
                        <AppText label={planName} variant={2} fontSize={14} color={colors.text} />
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />
                    <View style={styles.summaryRow}>
                        <AppText label="Amount" fontSize={14} color={colors.textSecondary} />
                        <AppText label={formatCurrency(amount)} variant={1} fontSize={18} color={config.THEME_COLOR} />
                    </View>
                    {nextBillingDate ? (
                        <>
                            <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />
                            <View style={styles.summaryRow}>
                                <AppText label="Billing Date" fontSize={14} color={colors.textSecondary} />
                                <AppText label={new Date(nextBillingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} variant={2} fontSize={14} color={colors.text} />
                            </View>
                        </>
                    ) : null}
                </View>

                {!isOrderFlow && Number(upgradeBonusDays) > 0 ? (
                    <View style={[styles.infoCard, { backgroundColor: colors.primaryShade, marginBottom: 16 }]}>
                        <Lucide name="info" size={20} color={config.THEME_COLOR} />
                        <AppText
                            label={`Plan upgrade: about ${upgradeBonusDays} extra day${Number(upgradeBonusDays) === 1 ? '' : 's'} will be added to your new billing period${upgradeCreditGhs != null ? ` (≈ GHS ${upgradeCreditGhs} credit from remaining time on your previous plan)` : ''}.`}
                            fontSize={13}
                            color={colors.textSecondary}
                            style={{ marginLeft: 12, flex: 1 }}
                        />
                    </View>
                ) : null}

                {/* Payment Methods */}
                <View style={styles.section}>
                    <AppText label="Payment Method" variant={1} fontSize={16} color={colors.text} style={styles.sectionTitle} />
                    <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setSelectedMethod('momo')}
                            style={[styles.methodOption, selectedMethod === 'momo' && { backgroundColor: colors.primaryShade }]}>
                            <View style={styles.methodLeft}>
                                <View style={[styles.methodIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="smartphone" size={20} color="#10b981" />
                                </View>
                                <View style={{ marginLeft: 12 }}>
                                    <AppText label="Mobile Money" variant={2} fontSize={15} color={colors.text} />
                                    <AppText label="MTN, Telecel, AirtelTigo" fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                </View>
                            </View>
                            <View style={[styles.radioOuter, { borderColor: colors.border }, selectedMethod === 'momo' && styles.radioOuterActive]}>
                                {selectedMethod === 'momo' && <View style={styles.radioInner} />}
                            </View>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setSelectedMethod('card')}
                            style={[styles.methodOption, selectedMethod === 'card' && { backgroundColor: colors.primaryShade }]}>
                            <View style={styles.methodLeft}>
                                <View style={[styles.methodIcon, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Lucide name="credit-card" size={20} color={config.THEME_COLOR} />
                                </View>
                                <View style={{ marginLeft: 12 }}>
                                    <AppText label="Card Payment" variant={2} fontSize={15} color={colors.text} />
                                    <AppText label="Visa, Mastercard" fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                </View>
                            </View>
                            <View style={[styles.radioOuter, { borderColor: colors.border }, selectedMethod === 'card' && styles.radioOuterActive]}>
                                {selectedMethod === 'card' && <View style={styles.radioInner} />}
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Mobile Money Form */}
                {selectedMethod === 'momo' && (
                    <View style={styles.section}>
                        <AppText label="Mobile Money Details" variant={1} fontSize={16} color={colors.text} style={styles.sectionTitle} />
                        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.networkRow}>
                                {MOMO_NETWORK_OPTIONS.map((network) => (
                                    <TouchableOpacity
                                        key={network.id}
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            setMomoNetwork(network.id);
                                            if (network.id !== 'telecel') setTelecelVoucher('');
                                        }}
                                        style={[
                                            styles.networkChip,
                                            {
                                                backgroundColor: momoNetwork === network.id ? `${network.color}22` : colors.surfaceSecondary,
                                                borderColor: momoNetwork === network.id ? network.color : colors.border
                                            },
                                        ]}>
                                        <View style={styles.networkChipInner}>
                                            <View style={[styles.networkIconWrap, { backgroundColor: `${network.color}22` }]}>
                                                <Lucide name={network.icon} size={13} color={network.color} />
                                            </View>
                                            <AppText
                                                label={network.label}
                                                fontSize={13}
                                                variant={momoNetwork === network.id ? 1 : 2}
                                                color={colors.text}
                                            />
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <TextInput
                                placeholder="Mobile Money Number"
                                placeholderTextColor={colors.placeholder || colors.textTertiary}
                                value={momoNumber}
                                onChangeText={(text) => {
                                    const digitsOnly = normalizeMomoNumber(text);
                                    setMomoNumber(digitsOnly);
                                }}
                                keyboardType="phone-pad"
                                maxLength={MOMO_NUMBER_MAX_LENGTH}
                                style={[styles.input, { borderColor: colors.inputBorder || colors.border, color: colors.text, marginTop: 12 }]}
                            />
                            {isTelecel ? (
                                <>
                                    <AppText
                                        label="Dial *110# to generate a Telecel Cash voucher, then enter it below."
                                        fontSize={12}
                                        color={colors.textSecondary}
                                        style={{ marginBottom: 8 }}
                                    />
                                    <TextInput
                                        placeholder="Telecel voucher"
                                        placeholderTextColor={colors.placeholder || colors.textTertiary}
                                        value={telecelVoucher}
                                        onChangeText={setTelecelVoucher}
                                        autoCapitalize="characters"
                                        autoCorrect={false}
                                        style={[
                                            styles.input,
                                            {
                                                borderColor: colors.inputBorder || colors.border,
                                                color: colors.text,
                                                marginBottom: 0,
                                            },
                                        ]}
                                    />
                                </>
                            ) : null}
                        </View>
                    </View>
                )}

                {/* Card Payment Info */}
                {selectedMethod === 'card' && (
                    <View style={[styles.infoCard, { backgroundColor: colors.surfaceSecondary }]}>
                        <Lucide name="info" size={20} color={config.THEME_COLOR} />
                        <AppText
                            label="You will be redirected to a secure payment page to complete your card payment"
                            fontSize={13}
                            color={colors.textSecondary}
                            style={{ marginLeft: 12, flex: 1 }}
                        />
                    </View>
                )}


                {/* Pay Button */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handlePayment}
                    disabled={submitting}
                    style={[styles.payButton, { backgroundColor: config.THEME_COLOR }]}>
                    <Lucide name="credit-card" size={20} color={colors.textInverse} />
                    <AppText label={submitting ? 'Please wait…' : `Pay ${formatCurrency(amount)}`} variant={1} fontSize={16} color={colors.textInverse} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    keyboardView: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
    summaryCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryDivider: {
        height: StyleSheet.hairlineWidth,
        marginVertical: 12,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        marginBottom: 12,
    },
    sectionCard: {
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        padding: 16,
    },
    methodOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
    },
    methodLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    methodIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioOuterActive: {
        borderColor: config.THEME_COLOR,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: config.THEME_COLOR,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginVertical: 8,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
        marginBottom: 12,
    },
    networkRow: {
        flexDirection: 'row',
        gap: 8,
    },
    networkChip: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    networkChipInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    networkIconWrap: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: 5,
        marginBottom: 16,
    },
});

export default Payment;
