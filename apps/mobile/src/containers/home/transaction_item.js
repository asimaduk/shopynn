import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/format';

const TransactionItem = ({ item, onPress }) => {
    const { colors } = useTheme();
    const isPurchase = item.type === 'stock_in' || item.type === 'purchase';
    const typeLabel = isPurchase ? 'Purchase' : 'Sale';
    const typeColor = isPurchase ? (config.GREEN_COLOR || colors.success) : colors.error;
    const typeBg = isPurchase ? colors.successLight : colors.errorLight;
    const qtyNum = Number(String(item.quantity).replace(/[^0-9.-]/g, ''));
    const qtyAbs = formatQty(item.quantity);
    const qtyLabel = `${isPurchase ? '+' : '−'}${qtyAbs}`;
    const unitLabel = qtyNum === 1 ? 'unit' : 'units';
    const unitPrice = Number(item.unit_price);
    const unitPriceLabel = Number.isFinite(unitPrice) ? formatCurrency(unitPrice) : null;
    const priceBreakdown = unitPriceLabel ? `${unitPriceLabel} × ${qtyAbs}` : null;
    const productName = String(item.description || item.product_name || item.name || '').trim();
    const showProductName = Boolean(productName && productName !== '—');

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight || colors.border }]}
        >
            <View style={styles.topRow}>
                <View style={[styles.typePill, { backgroundColor: typeBg }]}>
                    <Lucide name={isPurchase ? 'truck' : 'shopping-cart'} size={14} color={typeColor} />
                    <AppText label={typeLabel} fontSize={12} variant={1} color={typeColor} style={{ marginLeft: 5 }} />
                </View>
                <View style={styles.qtyBlock}>
                    <AppText
                        label={qtyLabel}
                        fontSize={18}
                        variant={1}
                        color={typeColor}
                        style={{ fontVariant: ['tabular-nums'] }}
                    />
                    <AppText label={unitLabel} fontSize={11} color={colors.textTertiary} style={{ marginLeft: 4 }} />
                </View>
            </View>

            {showProductName ? (
                <AppText
                    label={productName}
                    fontSize={15}
                    variant={1}
                    color={colors.text}
                    numberOfLines={2}
                    style={{ marginBottom: 8 }}
                />
            ) : null}

            <View style={styles.midRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                    <AppText
                        label={item.amount}
                        fontSize={16}
                        variant={1}
                        color={colors.text}
                        style={{ fontVariant: ['tabular-nums'] }}
                    />
                    {priceBreakdown ? (
                        <AppText
                            label={priceBreakdown}
                            fontSize={12}
                            color={colors.textTertiary}
                            style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}
                        />
                    ) : null}
                </View>
                <AppText
                    label={item.invoice_number || item.referenceId || '—'}
                    fontSize={12}
                    color={colors.textTertiary}
                    numberOfLines={1}
                    style={{ maxWidth: '42%', textAlign: 'right' }}
                />
            </View>

            <View style={[styles.bottomRow, { borderTopColor: colors.borderLight || colors.border }]}>
                <AppText label={item.date || '—'} fontSize={12} color={colors.textSecondary} />
                <AppText
                    label={item.user || '—'}
                    fontSize={12}
                    color={colors.textSecondary}
                    numberOfLines={1}
                    style={{ marginLeft: 8, flex: 1, textAlign: 'right' }}
                />
            </View>
        </TouchableOpacity>
    );
};

function formatQty(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        const cleaned = String(value ?? '0').replace(/\.?0+$/, '');
        return cleaned || '0';
    }
    return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)));
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    typePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    qtyBlock: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    midRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: 10,
    },
});

export default TransactionItem;
