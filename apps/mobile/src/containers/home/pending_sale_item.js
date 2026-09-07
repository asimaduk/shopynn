import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
// import config from '../../config';
import useTheme from '../../hooks/useTheme';

const PendingSaleItem = ({ item, index, onPress, formatter }) => {
    const { colors } = useTheme();
    const price = formatter.format(item.amount).replace('GH₵', '');
    const totalItems = item.orders ? item.orders.reduce((sum, order) => sum + order.quantity, 0) : 0;
    const hasError = !!(item?.last_error_message || item?.last_error_code);

    // Format orders array to show at most 3 items
    const formatItemsSummary = () => {
        if (!item.orders || item.orders.length === 0) {
            return 'No items';
        }

        const visibleItems = item.orders.slice(0, 3);
        const itemsText = visibleItems.map(order => `${order.quantity} x ${order.name}`).join(', ');
        
        if (item.orders.length > 3) {
            const remainingCount = item.orders.length - 3;
            return `${itemsText} + ${remainingCount} more`;
        }
        
        return itemsText;
    };

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}
            onPress={onPress}
        >
            <View style={styles.content}>
                {/* Top row: Customer */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <AppText label={item.customer} variant={1} fontSize={15} color={colors.text} style={{ marginBottom: 6, flex: 1 }} />
                    {hasError && (
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 999,
                                backgroundColor: colors.warningLight,
                            }}>
                            <Lucide name="triangle-alert" size={12} color={colors.warning} />
                            <AppText label="Needs attention" fontSize={10} color={colors.warning} style={{ marginLeft: 6 }} />
                        </View>
                    )}
                </View>

                {/* Middle row: Items summary */}
                <AppText
                    label={formatItemsSummary()}
                    fontSize={13}
                    color={colors.textSecondary}
                    style={styles.itemsText}
                    numberOfLines={2}
                />

                {/* Bottom row: Meta info */}
                <View style={styles.bottomRow}>
                    <View style={styles.metaItem}>
                        <AppText label={item.date} fontSize={12} color={colors.textTertiary} />
                    </View>
                    {item.attendant && (
                        <>
                            <View style={[styles.divider, { backgroundColor: colors.border }]} />
                            <View style={styles.metaItem}>
                                <AppText label={item.attendant} fontSize={12} color={colors.textTertiary} />
                            </View>
                        </>
                    )}
                    {totalItems > 0 && (
                        <>
                            <View style={[styles.divider, { backgroundColor: colors.border }]} />
                            <View style={styles.metaItem}>
                                <AppText label={`${totalItems} item${totalItems > 1 ? 's' : ''}`} fontSize={12} color={colors.textTertiary} />
                            </View>
                        </>
                    )}
                </View>
            </View>

            {/* Minimal chevron */}
            <View style={{ flexDirection: 'row' }}>
                <AppText label={`GHS ${price}`} variant={1} fontSize={16} color={colors.text} />
                <Lucide name="chevron-right" size={18} color={colors.textTertiary} />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 8,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    content: {
        flex: 1,
        marginRight: 12,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    itemsText: {
        marginBottom: 8,
        lineHeight: 18,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaItem: {
        paddingVertical: 2,
    },
    divider: {
        width: 1,
        height: 12,
        backgroundColor: '#e2e8f0',
        marginHorizontal: 8,
    },
});

export default PendingSaleItem;
