import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import { Lucide } from '@react-native-vector-icons/lucide';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const CustomerPaymentDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { item } = route.params || {};

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
                <AppText label={value || '—'} fontSize={16} color={colors.text} fontFamily="FiraSans-Medium" />
            </View>
        </View>
    );

    if (!item) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={backPress} label="Payment Details" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label="Payment Details" />
            <ScrollView contentContainerStyle={{ padding: 20 }}>

                <View style={{ alignItems: 'center', marginBottom: 30 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.successLight, justifyContent: 'center', alignItems: 'center', marginBottom: 15 }}>
                        <Lucide name="credit-card" size={40} color={config.GREEN_COLOR || colors.success} />
                    </View>
                    <AppText label={`GHS ${item.amount}`} fontSize={32} fontFamily="FiraSans-Bold" color={config.GREEN_COLOR || colors.success} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: config.GREEN_COLOR || colors.success, marginRight: 6 }} />
                        <AppText label={item.status} fontSize={14} color={config.GREEN_COLOR || colors.success} fontFamily="FiraSans-Medium" />
                    </View>
                </View>

                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 25, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }}>
                    <DetailRow label="Payment Method" value={item.method} icon="credit-card" />
                    <DetailRow label="Date & Time" value={item.date} icon="calendar" />
                    {item.reference ? (
                        <DetailRow label="Reference" value={item.reference} icon="hash" />
                    ) : null}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

export default CustomerPaymentDetails;
