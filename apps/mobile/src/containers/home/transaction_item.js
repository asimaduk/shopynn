import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const TransactionItem = ({ item, index, onPress }) => {
    const { colors } = useTheme();
    const isStockIn = item.type === 'stock_in';
    const iconName = isStockIn ? 'plus' : 'minus';
    const iconColor = isStockIn ? (config.GREEN_COLOR || colors.success) : colors.error;

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}
        >
            <AppText label={`${index + 1}.`} fontSize={16} color={colors.textSecondary} style={{ width: 25 }} />
            <Lucide name={iconName} color={iconColor} size={15} />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 5 }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                    <AppText label={item.description} fontSize={14} variant={2} color={colors.text} style={{ flex: 1 }} numberOfLines={1} />
                    <AppText label={`[${item.user}]`} fontSize={12} color={colors.textSecondary} />
                    <AppText label={item.date} fontSize={12} color={colors.textSecondary} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <AppText label={'GHS'} fontSize={8} color={colors.textSecondary} style={{ marginRight: 2 }} />
                    <AppText label={item.amount} fontSize={14} color={colors.text} />
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default TransactionItem;
