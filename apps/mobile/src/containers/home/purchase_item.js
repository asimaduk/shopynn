import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/format';

const PurchaseItem = ({ item, index, onPress }) => {
    const { colors } = useTheme();
    const isOdd = index % 2 !== 0;

    const formatDateAndTime = (date) => {
        return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' ' + new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={[styles.container, { backgroundColor: colors.surface, marginRight: isOdd ? 0 : 10 }]}
        >
            <View style={styles.header}>
                <AppText label={`#${item.invoice_number}`} fontSize={11} color={colors.textTertiary} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {item.poStatus && (
                        <View style={[styles.poBadge, { backgroundColor: item.poStatus === 'received' ? colors.successLight : item.poStatus === 'sent' ? colors.infoLight : colors.surfaceSecondary }]}>
                            <AppText label={item.poStatus} fontSize={9} color={item.poStatus === 'received' ? config.GREEN_COLOR : item.poStatus === 'sent' ? colors.info : colors.textSecondary} />
                        </View>
                    )}
                    <View style={[styles.statusBadge, { backgroundColor: item.current_status === 1 ? colors.successLight : colors.warningLight }]}>
                        <Lucide name={item.current_status === 1 ? "circle-check" : "clock"} size={10} color={item.current_status === 1 ? config.GREEN_COLOR : '#ff9800'} />
                    </View>
                </View>
            </View>

            <View style={styles.content}>
                <AppText label={item.supplier} fontSize={14} variant={1} color={colors.text} numberOfLines={1} style={styles.vendor} />
                <AppText label={`${item.number_of_items} items`} fontSize={12} color={colors.textTertiary} />

                <View style={styles.dateRow}>
                    <Lucide name="calendar" size={10} color={colors.textTertiary} />
                    <AppText label={formatDateAndTime(item.created_at)} fontSize={11} color={colors.textTertiary} style={{ marginLeft: 4 }} />
                </View>
            </View>

            <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>
                <View style={styles.amountContainer}>
                    <AppText
                        label={formatCurrency(item.total_amount ?? 0)}
                        fontSize={15}
                        variant={1}
                        color={colors.text}
                        style={{ fontVariant: ['tabular-nums'] }}
                    />
                </View>
                <AppText label={item.receiver_name} fontSize={10} color={colors.textTertiary} numberOfLines={1} style={{ marginTop: 4 }} />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 5,
        padding: 12,
        marginBottom: 12,
        flex: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    statusBadge: { padding: 4, borderRadius: 10 },
    poBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    content: {
        marginBottom: 12,
    },
    vendor: {
        marginBottom: 2,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    footer: {
        borderTopWidth: 1,
        paddingTop: 8,
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    }
});

export default PurchaseItem;
