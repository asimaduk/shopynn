import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import styles from './styles';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const TransferItem = ({ item, index, onPress }) => {
    const { colors } = useTheme();
    item.status = item.status ?? 'Completed';
    const statusColor = item.status === 'Completed' ? (config.GREEN_COLOR || colors.success) : item.status === 'Pending' ? colors.warning : colors.textSecondary;
    
    const formatDateAndTime = (date) => {
        return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' ' + new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };
    
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.itemContainer, { backgroundColor: colors.surface }]}
            onPress={onPress}
        >
            <AppText label={`${index + 1}.`} style={[styles.itemIndex, { color: colors.textSecondary }]} fontSize={14} />
            <View style={styles.itemContent}>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <AppText label={item.source_warehouse_name} style={{ fontFamily: 'FiraSans-SemiBold', fontSize: 13 }} color={colors.text} />
                    <Lucide name="arrow-right" color={colors.textSecondary} size={14} style={{ marginHorizontal: 5 }} />
                    <AppText label={item.destination_warehouse_name} style={{ fontFamily: 'FiraSans-SemiBold', fontSize: 13 }} color={colors.text} />
                </View>

                <AppText label={item.number_of_items > 1 ? `${item.number_of_items} items` : '1 item'} style={[styles.itemDetail, { color: colors.textSecondary }]} numberOfLines={1} />

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <AppText label={formatDateAndTime(item.created_at)} style={[styles.itemDetail, { marginBottom: 0, color: colors.textSecondary }]} />
                    <View style={{ width: 1, height: 10, backgroundColor: colors.border, marginHorizontal: 5 }} />
                    <AppText
                        label={item.status}
                        style={[
                            styles.itemDetail,
                            { marginBottom: 0, color: statusColor, fontWeight: 'bold' }
                        ]}
                    />
                </View>
            </View>
            <View style={{ justifyContent: 'center', alignItems: 'center', marginLeft: 10 }}>
                <Lucide name="chevron-right" color={colors.border} size={20} />
            </View>
        </TouchableOpacity>
    );
};

export default TransferItem;
