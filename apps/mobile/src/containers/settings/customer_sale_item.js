import React from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import styles from './styles';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const formatter = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
});

const formatCurrency = (value) => formatter.format(Number(value)).replace('GH₵', '').trim();

const formatDateAndTime = (date) => {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Map API sale to display shape and group by date (Today / Yesterday / "Mon DD, YYYY")
const STATUS_MAP = { 0: 'Pending', 1: 'Delivered', 2: 'Cancelled' };

const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const formatSectionDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatSaleForDisplay = (row) => ({
    id: row.id,
    customer: row.customer ?? 'Walk-In',
    itemCount: row.number_of_items ?? 0,
    time: formatTime(row.sale_date || row.created_at),
    amount: row.total_amount ?? '0.00',
    status: STATUS_MAP[row.current_status] ?? 'Delivered',
    user: row.attendant_first_name + ' ' + row.attendant_last_name ?? '—',
    date: formatSectionDate(row.sale_date || row.created_at),
    invoice_number: row.invoice_number,
});

const CustomerSaleItem = ({ item, index, navigation }) => {
    const { colors } = useTheme();
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('SaleDetails', { item: formatSaleForDisplay(item) })}
            style={[styles.itemContainer, { backgroundColor: colors.surface }]}
        >
            <AppText label={`${index + 1}`} style={[styles.itemIndex, { color: colors.textTertiary }]} fontSize={14} />

            <View style={styles.itemContent}>
                <AppText label={item.invoice_number} style={[styles.itemName, { color: colors.text }]} numberOfLines={1} />
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Lucide name="calendar" size={12} color={colors.textTertiary} style={{ marginRight: 4 }} />
                    <AppText label={formatDateAndTime(item.created_at)} style={[styles.itemDetail, { color: colors.textTertiary }]} numberOfLines={1} fontSize={12} />
                </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
                <AppText label={`GHS ${formatCurrency(item.total_amount)}`} fontSize={15} fontFamily="FiraSans-Bold" color={config.THEME_COLOR} />
                <AppText label={`${item.number_of_items} units`} fontSize={12} color={colors.textTertiary} />
            </View>
        </TouchableOpacity>
    );
};

export default CustomerSaleItem;
