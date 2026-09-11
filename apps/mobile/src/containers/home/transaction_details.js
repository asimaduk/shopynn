import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import { Lucide } from '@react-native-vector-icons/lucide';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { formatCurrency, formatQuantity } from '../../utils/format';

const TransactionDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { item } = route.params;
    const isStockIn = item.type === 'stock_in';
    const typeColor = isStockIn ? (config.GREEN_COLOR || colors.success) : colors.error;
    const typeBg = isStockIn ? colors.successLight : colors.errorLight;

    const amountLabel = (() => {
        if (item._amount != null && item._amount !== '') {
            return formatCurrency(Number(item._amount) || 0);
        }
        const raw = String(item.amount ?? '').trim();
        // Already formatted upstream (e.g. "GHS 54.00") — don't prefix again.
        if (/^(GHS|GH₵)/i.test(raw)) return raw.replace(/^GH₵/i, 'GHS').trim();
        const n = Number(String(raw).replace(/[^0-9.-]/g, ''));
        return formatCurrency(Number.isFinite(n) ? n : 0);
    })();

    const qty = Number(item.quantity);
    const qtyLabel = `${formatQuantity(item.quantity)} ${qty === 1 ? 'unit' : 'units'}`;

    const backPress = () => {
        navigation.goBack();
    };

    const DetailRow = ({ label, value, icon, isLast }) => (
        <View style={[styles.detailRow, !isLast && { marginBottom: 20 }]}>
            <View style={styles.detailIcon}>
                <Lucide name={icon} size={18} color={colors.textSecondary} />
            </View>
            <View style={styles.detailContent}>
                <AppText label={label} fontSize={13} color={colors.placeholder} style={{ marginBottom: 2 }} />
                <AppText label={value} fontSize={16} color={colors.text} fontFamily="FiraSans-Medium" />
            </View>
        </View>
    );

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label={'Transaction Details'} />
            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <View style={styles.hero}>
                    <View style={[styles.heroIcon, { backgroundColor: typeBg }]}>
                        <Lucide name={isStockIn ? 'plus' : 'minus'} size={40} color={typeColor} />
                    </View>
                    <AppText label={amountLabel} fontSize={32} fontFamily="FiraSans-Bold" color={typeColor} />
                    <AppText
                        label={isStockIn ? 'Purchase' : 'Sale'}
                        fontSize={14}
                        color={colors.textSecondary}
                        style={[styles.typeBadge, { backgroundColor: colors.surfaceSecondary }]}
                    />
                </View>

                <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: '#000' }]}>
                    <DetailRow label="Description" value={item.description || '—'} icon="file-text" />
                    <DetailRow label="Line quantity" value={qtyLabel} icon="package" />
                    <DetailRow
                        label="Unit price"
                        value={item.unit_price != null ? formatCurrency(Number(item.unit_price) || 0) : '—'}
                        icon="banknote"
                    />
                    <DetailRow label="Date & Time" value={item.date || '—'} icon="calendar" />
                    <DetailRow label="User/Attendant" value={item.user || '—'} icon="user" />
                    <DetailRow
                        label="Reference ID"
                        value={item.invoice_number || item.referenceId || 'N/A'}
                        icon="hash"
                        isLast={!item.notes}
                    />

                    {item.notes ? (
                        <View style={[styles.notesBlock, { borderTopColor: colors.border }]}>
                            <AppText label="Notes" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 5 }} />
                            <AppText label={item.notes} fontSize={15} color={colors.text} style={{ lineHeight: 22 }} />
                        </View>
                    ) : null}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    hero: {
        alignItems: 'center',
        marginBottom: 30,
    },
    heroIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    typeBadge: {
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        overflow: 'hidden',
    },
    card: {
        borderRadius: 12,
        padding: 25,
        elevation: 2,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailIcon: {
        width: 30,
        alignItems: 'center',
    },
    detailContent: {
        marginLeft: 10,
        flex: 1,
    },
    notesBlock: {
        marginTop: 10,
        borderTopWidth: 1,
        paddingTop: 15,
    },
});

export default TransactionDetails;
