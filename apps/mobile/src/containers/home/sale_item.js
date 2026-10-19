import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/format';

const SaleItem = ({ item, onPress, onResendInvoice, resending }) => {
    const { colors } = useTheme();
    const balanceDue = Number(item.balance_due) || 0;
    const owes = balanceDue > 0.02;
    const unpaid = owes && !(Number(item.amount_paid) > 0.02);
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={[styles.container, { backgroundColor: colors.surface }]}
        >
            <View style={styles.topRow}>
                <View style={styles.leftInfo}>
                    <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                        <Lucide name="shopping-bag" size={20} color={colors.textSecondary} />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                        <AppText label={item.customer} fontSize={15} variant={1} color={colors.text} />
                        <View style={styles.metaRow}>
                            <AppText label={`${item.itemCount || 0} Item(s)`} fontSize={13} color={colors.textTertiary} />
                            <Lucide name="dot" size={16} color={colors.textTertiary} />
                            <AppText label={item.time || '10:30 AM'} fontSize={13} color={colors.textTertiary} />
                        </View>
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <AppText label={item.status} fontSize={12} color={item.status === 'Delivered' ? config.GREEN_COLOR : config.THEME_COLOR} style={{ marginBottom: 4 }} />
                    <AppText label={`#${item.invoice_number}`} fontSize={11} color={colors.textTertiary} />
                </View>
            </View>

            <View style={[styles.bottomRow, { borderTopColor: colors.borderLight }]}>
                <View style={styles.amountBox}>
                    <AppText
                        label={formatCurrency(Number(String(item.amount ?? 0).replace(/,/g, '')) || 0)}
                        fontSize={16}
                        variant={1}
                        color={colors.text}
                        style={{ fontVariant: ['tabular-nums'] }}
                    />
                    {owes ? (
                        <View style={[styles.balancePill, { backgroundColor: colors.warningLight }]}>
                            <Lucide name="wallet" size={12} color={colors.warning} />
                            <AppText
                                label={`${unpaid ? 'Unpaid' : 'Part paid'} · ${formatCurrency(balanceDue)} due`}
                                fontSize={12}
                                variant={1}
                                color={colors.warning}
                                style={{ marginLeft: 4 }}
                            />
                        </View>
                    ) : null}
                </View>
                <View style={styles.bottomActions}>
                    {onResendInvoice ? (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={(e) => {
                                e?.stopPropagation?.();
                                onResendInvoice(item);
                            }}
                            disabled={resending}
                            style={[styles.resendBtn, { backgroundColor: config.THEME_COLOR + '15' }]}
                        >
                            {resending ? (
                                <ActivityIndicator size="small" color={config.THEME_COLOR} />
                            ) : (
                                <Lucide name="mail" size={18} color={config.THEME_COLOR} />
                            )}
                        </TouchableOpacity>
                    ) : null}
                    <Lucide name="chevron-right" size={20} color={colors.border} />
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 5,
        padding: 15,
        marginBottom: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    leftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    imagePlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        paddingTop: 12,
    },
    amountBox: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        flex: 1,
        gap: 8,
    },
    balancePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
    },
    bottomActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    resendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default SaleItem;
