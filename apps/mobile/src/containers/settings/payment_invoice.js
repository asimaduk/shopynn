import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import ScreenHeader from '../../components/screen_header';

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});

const PaymentInvoice = ({ navigation, route }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { payment, planName = 'Premium' } = route.params || {};

    if (!payment) {
        return (
            <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader label="Invoice" onPress={() => navigation.goBack()} />
                <View style={styles.empty}>
                    <AppText label="Invoice not found" fontSize={16} color={colors.textSecondary} />
                </View>
            </SafeAreaView>
        );
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatCurrency = (value) => formatter.format(value).replace('GH₵', 'GHS ').trim();

    const getStatusColor = () => {
        const s = (payment.status || '').toLowerCase();
        if (s === 'paid') return '#10b981';
        if (s === 'failed' || s === 'cancelled') return '#ef4444';
        return '#f59e0b';
    };

    const getStatusLabel = () => (payment.status || 'Unknown').toUpperCase();

    const maskAccountNumber = (accountNumber) => {
        if (!accountNumber || typeof accountNumber !== 'string') return '—';
        const digits = accountNumber.replace(/\D/g, '');
        if (digits.length <= 4) return '****';
        return `****${digits.slice(-4)}`;
    };

    const isMomoPayment = () => {
        const m = (payment.method || '').toLowerCase();
        return m.includes('mobile') || m.includes('momo') || payment.momoNumber != null || payment.momoNetwork != null;
    };

    const isBankPayment = () => {
        const m = (payment.method || '').toLowerCase();
        return m.includes('bank') || m.includes('transfer') || payment.bankName != null || payment.accountNumber != null;
    };

    const handleShare = async () => {
        try {
            const shareLines = [
                `Invoice: ${payment.invoice || '—'}`,
                `Date: ${formatDate(payment.date)}`,
                `Amount: ${formatCurrency(payment.amount)}`,
                `Status: ${getStatusLabel()}`,
                payment.method ? `Payment method: ${payment.method}` : null,
            ];
            if (isMomoPayment() && (payment.momoNumber || payment.momoNetwork)) {
                if (payment.momoNetwork) shareLines.push(`Network: ${payment.momoNetwork}`);
                if (payment.momoNumber) shareLines.push(`Mobile Money number: ${payment.momoNumber}`);
            }
            if (isBankPayment() && (payment.bankName || payment.accountNumber)) {
                if (payment.bankName) shareLines.push(`Bank: ${payment.bankName}`);
                if (payment.accountNumber) shareLines.push(`Account: ${maskAccountNumber(payment.accountNumber)}`);
            }
            shareLines.push(`Description: Subscription – ${planName}`);
            const text = shareLines
                .filter(Boolean)
                .join('\n');

            await Share.share({
                message: text,
                title: `Invoice ${payment.invoice || ''}`,
            });
        } catch (e) {
            Alert.alert('Share', 'Could not share invoice.');
        }
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader label="Invoice" onPress={() => navigation.goBack()}>
                <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={handleShare}
                    style={[styles.shareBtn, { backgroundColor: colors.surfaceSecondary }]}>
                    <Lucide name="share-2" color={config.THEME_COLOR} size={20} />
                </TouchableOpacity>
            </ScreenHeader>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
                showsVerticalScrollIndicator={false}>
                {/* Invoice header */}
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.headerRow}>
                        <AppText label="INVOICE" variant={1} fontSize={12} color={colors.textTertiary} />
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
                            <AppText label={getStatusLabel()} fontSize={11} variant={1} color={getStatusColor()} />
                        </View>
                    </View>
                    <AppText
                        label={payment.invoice || `#${payment.id}`}
                        variant={1}
                        fontSize={24}
                        color={colors.text}
                        style={styles.invoiceTitle}
                    />
                    <AppText label={`Subscription – ${planName}`} fontSize={14} color={colors.textSecondary} style={{ marginTop: 4 }} />
                </View>

                {/* Payment details */}
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <AppText label="Payment details" variant={1} fontSize={16} color={colors.text} style={styles.sectionTitle} />
                    <DetailRow label="Invoice number" value={payment.invoice || `#${payment.id}`} colors={colors} />
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <DetailRow label="Date" value={formatDate(payment.date ?? payment.payment_date ?? payment.created_at ?? '-')} colors={colors} />
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <DetailRow label="Amount" value={formatCurrency(payment.amount)} colors={colors} valueBold />
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <DetailRow label="Status" value={getStatusLabel()} colors={colors} valueColor={getStatusColor()} />
                    {payment.method ? (
                        <>
                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            <DetailRow label="Payment method" value={payment.method} colors={colors} />
                        </>
                    ) : null}
                    {isMomoPayment() && (payment.momoNumber != null || payment.momoNetwork != null) ? (
                        <>
                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            {payment.momoNetwork != null && (
                                <DetailRow label="Network" value={String(payment.momoNetwork).replace(/^\w/, (c) => c.toUpperCase())} colors={colors} />
                            )}
                            {payment.momoNetwork != null && payment.momoNumber != null && (
                                <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            )}
                            {payment.momoNumber != null && (
                                <DetailRow label="Mobile Money number" value={String(payment.momoNumber)} colors={colors} />
                            )}
                        </>
                    ) : null}
                    {isBankPayment() && (payment.bankName != null || payment.accountNumber != null) ? (
                        <>
                            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            {payment.bankName != null && (
                                <DetailRow label="Bank name" value={String(payment.bankName)} colors={colors} />
                            )}
                            {payment.bankName != null && payment.accountNumber != null && (
                                <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                            )}
                            {payment.accountNumber != null && (
                                <DetailRow label="Account number" value={maskAccountNumber(payment.accountNumber)} colors={colors} />
                            )}
                        </>
                    ) : null}
                </View>

                {/* Description */}
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <AppText label="Description" variant={1} fontSize={16} color={colors.text} style={styles.sectionTitle} />
                    <AppText label={`Shopynn subscription payment for ${planName} plan.`} fontSize={14} color={colors.textSecondary} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const DetailRow = ({ label, value, colors, valueBold, valueColor }) => (
    <View style={styles.detailRow}>
        <AppText label={label} fontSize={14} color={colors.textSecondary} style={styles.detailLabel} />
        <View style={styles.detailValueWrap}>
            <AppText
                label={String(value ?? '—')}
                fontSize={14}
                variant={valueBold ? 1 : 2}
                color={valueColor || colors.text}
                style={styles.detailValue}
            />
        </View>
    </View>
);

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    sectionTitle: {
        marginBottom: 12,
    },
    invoiceTitle: {
        marginTop: 8,
        flexShrink: 1,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 8,
        gap: 12,
    },
    detailLabel: {
        flexShrink: 0,
        maxWidth: '42%',
    },
    detailValueWrap: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
        alignItems: 'flex-end',
    },
    detailValue: {
        textAlign: 'right',
        flexShrink: 1,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
    },
    shareBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
});

export default PaymentInvoice;
