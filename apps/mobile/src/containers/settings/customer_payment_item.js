import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import styles from './styles';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/format';

// Mask reference for list display only (details screen shows full reference)
const maskReference = (method, reference) => {
    if (!reference) return null;
    const m = (method || '').toLowerCase();
    const ref = String(reference).trim();
    if ((m.includes('mobile') || m.includes('momo')) && /^\d+$/.test(ref)) {
        if (ref.length <= 7) return ref;
        return ref.slice(0, 3) + '****' + ref.slice(-4);
    }
    if (m.includes('bank') && /^\d+$/.test(ref)) {
        return '****' + ref.slice(-4);
    }
    return ref; // Cheque etc. show as-is in list
};

const CustomerPaymentItem = ({ item, index, onPress }) => {
    const { colors } = useTheme();
    const displayReference = maskReference(item.method, item.reference);
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={[styles.itemContainer, { backgroundColor: colors.surface }]}
        >
            <AppText label={`${index + 1}`} style={[styles.itemIndex, { color: colors.textTertiary }]} fontSize={14} />

            <View style={styles.itemContent}>
                <AppText label={item.method} style={[styles.itemName, { color: colors.text }]} numberOfLines={1} />
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Lucide name="calendar" size={12} color={colors.textTertiary} style={{ marginRight: 4 }} />
                    <AppText label={item.date} style={[styles.itemDetail, { color: colors.textTertiary }]} numberOfLines={1} fontSize={12} />
                </View>
                {displayReference ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Lucide name="hash" size={12} color={colors.textTertiary} style={{ marginRight: 4 }} />
                        <AppText label={displayReference} style={[styles.itemDetail, { color: colors.textSecondary }]} numberOfLines={1} fontSize={12} />
                    </View>
                ) : null}
            </View>

            <View style={{ alignItems: 'flex-end' }}>
                <AppText label={formatCurrency(item.amount)} fontSize={15} fontFamily="FiraSans-Bold" color={config.GREEN_COLOR || colors.success} />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Lucide name="circle-check" size={10} color={config.GREEN_COLOR || colors.success} style={{ marginRight: 2 }} />
                    <AppText label={item.status} fontSize={11} color={config.GREEN_COLOR || colors.success} />
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default CustomerPaymentItem;
