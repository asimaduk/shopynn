import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import { Lucide } from '@react-native-vector-icons/lucide';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const TransactionDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { item } = route.params;
    const isStockIn = item.type === 'stock_in';
    const typeColor = isStockIn ? (config.GREEN_COLOR || colors.success) : colors.error;
    const typeBg = isStockIn ? colors.successLight : colors.errorLight;

    const backPress = () => {
        navigation.goBack();
    };

    const DetailRow = ({ label, value, icon }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 30, alignItems: 'center' }}>
                <Lucide name={icon} size={18} color={colors.textSecondary} />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
                <AppText label={label} fontSize={13} color={colors.placeholder} style={{ marginBottom: 2 }} />
                <AppText label={value} fontSize={16} color={colors.text} fontFamily="FiraSans-Medium" />
            </View>
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label={'Transaction Details'} />
            <ScrollView contentContainerStyle={{ padding: 20 }}>

                <View style={{ alignItems: 'center', marginBottom: 30 }}>
                    <View style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: typeBg,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 15
                    }}>
                        <Lucide name={isStockIn ? 'plus' : 'minus'} size={40} color={typeColor} />
                    </View>
                    <AppText label={`GHS ${item.amount}`} fontSize={32} fontFamily="FiraSans-Bold" color={typeColor} />
                    <AppText
                        label={isStockIn ? 'Stock In' : 'Sale'}
                        fontSize={16}
                        color={colors.textSecondary}
                        style={{
                            marginTop: 5,
                            backgroundColor: colors.surfaceSecondary,
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 10,
                            overflow: 'hidden'
                        }}
                    />
                </View>

                <View style={{
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 25,
                    elevation: 2,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2
                }}>
                    <DetailRow label="Description" value={item.description} icon="file-text" />
                    <DetailRow label="Quantity" value={`${item.quantity} units`} icon="package" />
                    <DetailRow label="Date & Time" value={item.date} icon="calendar" />
                    <DetailRow label="User/Attendant" value={item.user} icon="user" />
                    <DetailRow label="Reference ID" value={item.invoice_number || 'N/A'} icon="hash" />

                    {item.notes && (
                        <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 15 }}>
                            <AppText label="Notes" fontSize={14} color={colors.textSecondary} style={{ marginBottom: 5 }} />
                            <AppText label={item.notes} fontSize={15} color={colors.text} style={{ lineHeight: 22 }} />
                        </View>
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

export default TransactionDetails;
