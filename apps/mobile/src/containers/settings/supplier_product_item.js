import React from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import styles from './styles';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { formatCurrency, formatDateAndTime } from '../../utils/format';

const SupplierProductItem = ({ item, index, navigation }) => {
    const { colors } = useTheme();
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('PurchaseDetails', { item })}
            style={[styles.itemContainer, { backgroundColor: colors.surface, marginHorizontal: 10 }]}
        >
            <AppText label={`${index + 1}`} style={[styles.itemIndex, { color: colors.textTertiary }]} fontSize={14} />

            {/* <View style={{ marginRight: 15 }}>
                <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: colors.infoLight, justifyContent: 'center', alignItems: 'center' }}>
                    <Lucide name="box" size={20} color={config.SECONDARY_COLOR || colors.info} />
                </View>
            </View> */}

            <View style={styles.itemContent}>
                <AppText label={item.invoice_number} style={[styles.itemName, { color: colors.text }]} numberOfLines={1} />
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Lucide name="calendar" size={12} color={colors.textTertiary} style={{ marginRight: 4 }} />
                    <AppText label={formatDateAndTime(item.created_at)} style={[styles.itemDetail, { color: colors.textTertiary }]} numberOfLines={1} fontSize={12} />
                </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
                <AppText label={formatCurrency(item.total_amount)} fontSize={15} fontFamily="FiraSans-Bold" color={config.SECONDARY_COLOR || colors.info} />
                <AppText label={`${item.number_of_items} ${item.number_of_items > 1 ? 'units' : 'unit'}`} fontSize={12} color={colors.textTertiary} />
            </View>
        </TouchableOpacity>
    );
};

export default SupplierProductItem;
