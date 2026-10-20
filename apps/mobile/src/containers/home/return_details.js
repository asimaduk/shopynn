import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/format';
import { returnsApi } from '../../services/api';
import { toReturnRecord } from '../../utils/returnRecord';

const REFUND_METHOD_LABELS = {
    cash: 'Cash',
    momo: 'Mobile money',
    mobile_money: 'Mobile money',
    card: 'Card',
    store_credit: 'Store credit',
    paystack: 'Paystack',
};

const ReturnDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { item: paramItem, returnId, type: paramType } = route.params || {};
    const [item, setItem] = useState(() => (paramItem ? { ...paramItem } : {}));
    const [loading, setLoading] = useState(!!(returnId || paramItem?.id));
    const type = item.type || paramType || 'sales';
    const isSales = type !== 'purchase';

    const status = item.status || 'Approved';
    const isApproved = status === 'Approved';
    const isPending = status === 'Pending';

    const statusColor = isApproved ? (config.GREEN_COLOR || colors.success) : isPending ? (config.THEME_COLOR || colors.text) : colors.error;
    const statusIcon = isApproved ? 'check-circle' : isPending ? 'clock' : 'x-circle';
    const heroBg = isApproved ? colors.successLight : isPending ? colors.primaryShade : colors.errorLight;
    const statusLabel = isApproved ? 'Completed' : isPending ? 'Draft' : 'Cancelled';

    useEffect(() => {
        const id = returnId || paramItem?.id;
        if (!id) return;
        let mounted = true;
        setLoading(true);
        returnsApi.get(id).then((data) => {
            if (mounted && data) setItem(toReturnRecord(data));
        }).catch(() => {}).finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [returnId, paramItem?.id]);

    const backPress = () => {
        navigation.goBack();
    };

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading return..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    const DetailRow = ({ label, value, icon, valueColor, isLast, onPress }) => {
        const RowContent = (
            <View style={[styles.detailRow, { borderBottomColor: colors.border }, isLast && { borderBottomWidth: 0 }]}>
                <View style={[styles.detailIconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                    <Lucide name={icon} size={18} color={config.THEME_COLOR} />
                </View>
                <View style={styles.detailContent}>
                    <AppText label={label} fontSize={13} color={colors.textTertiary} style={{ marginBottom: 2 }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <AppText label={value || '—'} fontSize={16} color={valueColor || colors.text} fontFamily="FiraSans-Medium" style={{ flex: 1 }} />
                        {onPress && <Lucide name="chevron-right" size={18} color={colors.textTertiary} />}
                    </View>
                </View>
            </View>
        );

        if (onPress) {
            return (
                <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
                    {RowContent}
                </TouchableOpacity>
            );
        }

        return RowContent;
    };

    const amount = Number(item.amount || 0);
    const refundAmount = Number(item.refundAmount || 0);
    const balanceReduction = Math.max(0, amount - refundAmount);
    const itemCount = Number(item.items || 0);

    let settlement = '';
    if (!isSales) {
        if (refundAmount > 0.02 && balanceReduction > 0.02) {
            settlement = `${formatCurrency(balanceReduction)} off amount owed, ${formatCurrency(refundAmount)} cash back from supplier`;
        } else if (refundAmount > 0.02) {
            settlement = `${formatCurrency(refundAmount)} cash back from supplier`;
        } else {
            settlement = `${formatCurrency(amount)} taken off amount owed to supplier`;
        }
    } else if (item.refundMethod) {
        const method = REFUND_METHOD_LABELS[item.refundMethod] || item.refundMethod;
        settlement = `${formatCurrency(refundAmount || amount)} refunded via ${method}`;
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label={isSales ? 'Sales Return' : 'Purchase Return'} />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                <View style={[styles.hero, { backgroundColor: heroBg }]}>
                    <View style={[styles.heroIconWrap, { backgroundColor: statusColor + '25' }]}>
                        <Lucide name={isSales ? 'rotate-ccw' : 'package-x'} size={36} color={statusColor} />
                    </View>
                    <AppText label={formatCurrency(amount)} fontSize={28} fontFamily="FiraSans-Bold" color={colors.text} style={{ marginTop: 12 }} />
                    <AppText label="Return value" fontSize={14} color={colors.textSecondary} style={{ marginTop: 4 }} />
                    <View style={styles.heroMeta}>
                        {item.reference ? (
                            <View style={[styles.typePill, { backgroundColor: colors.surface }]}>
                                <AppText label={item.reference} fontSize={12} fontFamily="FiraSans-SemiBold" color={colors.text} />
                            </View>
                        ) : null}
                        <View style={[styles.statusPill, { backgroundColor: statusColor + '25', borderColor: statusColor }]}>
                            <Lucide name={statusIcon} size={14} color={statusColor} />
                            <AppText label={statusLabel} fontSize={12} fontFamily="FiraSans-SemiBold" color={statusColor} style={{ marginLeft: 6 }} />
                        </View>
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
                        <Lucide name="list" size={18} color={config.THEME_COLOR} />
                        <AppText label="Details" fontSize={16} fontFamily="FiraSans-SemiBold" color={colors.text} style={{ marginLeft: 8 }} />
                    </View>
                    <View style={styles.cardBody}>
                        <DetailRow
                            label={isSales ? 'Sale' : 'Purchase invoice'}
                            value={item.ref || '—'}
                            icon="hash"
                            onPress={
                                !isSales && item.purchaseId
                                    ? () => navigation.navigate('PurchaseDetails', { purchaseId: item.purchaseId })
                                    : undefined
                            }
                        />
                        <DetailRow
                            label={isSales ? 'Customer' : 'Supplier'}
                            value={isSales ? item.customer : item.supplier}
                            icon={isSales ? 'user' : 'truck'}
                        />
                        {item.warehouse ? <DetailRow label="Store" value={item.warehouse} icon="store" /> : null}
                        <DetailRow label="Date & time" value={item.date || '—'} icon="calendar" />
                        {settlement ? (
                            <DetailRow label={isSales ? 'Refund' : 'Settlement'} value={settlement} icon="wallet" />
                        ) : null}
                        <DetailRow
                            label="Items"
                            value={`${itemCount} item${itemCount !== 1 ? 's' : ''}`}
                            icon="package"
                            isLast
                            onPress={
                                Array.isArray(item.details) && item.details.length > 0
                                    ? () => navigation.navigate('ReturnItems', { item, type })
                                    : undefined
                            }
                        />
                    </View>
                </View>

                <View style={[styles.reasonCard, { backgroundColor: colors.surface, borderLeftColor: config.THEME_COLOR }]}>
                    <View style={styles.reasonHeader}>
                        <View style={[styles.reasonIconWrap, { backgroundColor: colors.primaryShade }]}>
                            <Lucide name="message-square" size={20} color={config.THEME_COLOR} />
                        </View>
                        <AppText label="Reason for return" fontSize={15} fontFamily="FiraSans-SemiBold" color={colors.text} style={{ marginLeft: 12 }} />
                    </View>
                    <AppText
                        label={item.reason || 'No reason provided.'}
                        fontSize={15}
                        color={colors.textSecondary}
                        style={[styles.reasonText, { color: colors.textSecondary }]}
                    />
                    {item.notes && item.notes !== item.reason ? (
                        <AppText
                            label={item.notes}
                            fontSize={14}
                            color={colors.textTertiary}
                            style={{ marginTop: 8, lineHeight: 20 }}
                        />
                    ) : null}
                </View>

                <View style={[styles.infoBanner, { backgroundColor: colors.surfaceSecondary }]}>
                    <Lucide name="info" size={16} color={colors.textTertiary} style={{ marginRight: 8 }} />
                    <AppText
                        label={
                            isApproved
                                ? isSales
                                    ? 'Returned items were added back to stock.'
                                    : 'Returned items were taken out of stock and the supplier balance was updated.'
                                : isPending
                                ? 'This return has not been completed yet.'
                                : 'This return was cancelled.'
                        }
                        fontSize={13}
                        color={colors.textTertiary}
                        style={{ flex: 1, lineHeight: 20 }}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    hero: {
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    heroIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        gap: 10,
    },
    typePill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    card: {
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    cardBody: {
        padding: 16,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    detailIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    detailContent: {
        flex: 1,
    },
    reasonCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderLeftWidth: 4,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
    },
    reasonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    reasonIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    reasonText: {
        lineHeight: 22,
        paddingLeft: 0,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 14,
        borderRadius: 10,
    },
});

export default ReturnDetails;
