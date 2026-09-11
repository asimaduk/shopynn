import React, { useState } from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import styles from './styles';
import { Lucide } from '@react-native-vector-icons/lucide';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { formatDate, formatDateAndTime } from '../../utils/format';

const ExpenditureDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const paramItem = route.params?.item ?? null;
    const paramId = route.params?.expenseId ?? paramItem?.id;

    const [item, setItem] = useState(() => paramItem || { amount: '—', category: '—', description: '—', date: '—', user: '—', paymentMethod: 'Cash', note: '' });
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const backPress = () => {
        navigation.goBack();
    };

    const DetailRow = ({ label, value, icon }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 30, alignItems: 'center' }}>
                <Lucide name={icon} size={18} color={colors.textTertiary} />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
                <AppText label={label} fontSize={13} color={colors.placeholder} style={{ marginBottom: 2 }} />
                <AppText label={value != null && value !== '' ? String(value) : '—'} fontSize={16} color={colors.text} fontFamily="FiraSans-Medium" />
            </View>
        </View>
    );

    if (loading && (item?.amount == null || item?.amount === '—')) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading expenditure..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label={'Expenditure Details'} />
            <ScrollView
                contentContainerStyle={{ padding: 20 }}
                refreshControl={paramId ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[config.THEME_COLOR]} /> : undefined}
            >
                <View style={{ alignItems: 'center', marginBottom: 30 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.errorLight, justifyContent: 'center', alignItems: 'center', marginBottom: 15 }}>
                        <Lucide name="wallet" size={40} color={colors.error} />
                    </View>
                    <AppText label={`GHS ${item.amount}`} fontSize={32} fontFamily="FiraSans-Bold" color={colors.error} />
                    <AppText label={item.category} fontSize={16} color={colors.textSecondary} style={{ marginTop: 5, backgroundColor: colors.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' }} numberOfLines={1} />
                </View>

                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 25, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }}>
                    <DetailRow label="Description" value={item.description} icon="file-text" />
                    <DetailRow label="Expense Date" value={formatDate(item.expense_date)} icon="calendar" />
                    <DetailRow label="Recorded By" value={item.creator_first_name + ' ' + item.creator_last_name} icon="user" />
                    <DetailRow label="Payment Method" value={item.paymentMethod || 'Cash'} icon="credit-card" />
                    <DetailRow label="Created At" value={formatDateAndTime(item.created_at)} icon="calendar" />

                    {(item.note != null && item.note !== '') && (
                        <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 15 }}>
                            <AppText label="Additional Notes" fontSize={14} color={colors.textTertiary} style={{ marginBottom: 5 }} />
                            <AppText label={item.note} fontSize={15} color={colors.text} style={{ lineHeight: 22 }} />
                        </View>
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

export default ExpenditureDetails;
