import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';

const PurchaseOrderDetails = ({ navigation }) => {
    const { colors } = useTheme();

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Purchase order" />
            <View style={styles.empty}>
                <Lucide name="file-text" size={48} color={colors.border} />
                <AppText
                    label="Purchase orders are not available yet"
                    fontSize={16}
                    color={colors.text}
                    style={{ marginTop: 12, textAlign: 'center' }}
                />
                <AppText
                    label="Use Purchases for supplier stock receipts."
                    fontSize={13}
                    color={colors.textTertiary}
                    style={{ marginTop: 6, textAlign: 'center' }}
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
});

export default PurchaseOrderDetails;
