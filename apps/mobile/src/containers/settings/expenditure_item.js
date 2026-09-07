import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import styles from './styles';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import { formatDateAndTime, formatCurrency } from '../../utils/format';

const ExpenditureItem = ({ item, index, onPress }) => {
    const { colors } = useTheme();
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.itemContainer, { backgroundColor: colors.surface }]}
            onPress={onPress}
        >
            <AppText label={`${index + 1}`} style={[styles.itemIndex, { color: colors.textTertiary }]} fontSize={14} />

            <View style={styles.itemContent}>
                <AppText label={item.description} style={[styles.itemName, { color: colors.text }]} numberOfLines={1} />
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Lucide name="tag" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                    <AppText label={item.category} style={[styles.itemDetail, { color: colors.textSecondary }]} numberOfLines={1} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Lucide name="calendar" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                    <AppText label={`${formatDateAndTime(item.created_at)} • ${item.creator_first_name + ' ' + item.creator_last_name}`} style={[styles.itemDetail, { color: colors.textTertiary }]} numberOfLines={1} fontSize={12} />
                </View>
            </View>

            <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                <AppText label={`${formatCurrency(item.amount)}`} fontSize={15} fontFamily="FiraSans-Bold" color={colors.error} />
                <Lucide name="chevron-right" color={colors.textTertiary} size={16} style={{ marginTop: 5 }} />
            </View>
        </TouchableOpacity>
    );
};

export default ExpenditureItem;
