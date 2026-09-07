import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useSelector } from 'react-redux';
import styles from './styles';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import { canManageCustomerSignupCodes } from '../../utils/permissions';

const WarehouseItem = ({ item, index, navigation }) => {
    const { colors } = useTheme();
    const currentUser = useSelector(({ user }) => user?.data);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const canCustomerSignupCodes = canManageCustomerSignupCodes(currentUser, subscriptionFeatures);
    const handlePress = () => {
        if (navigation) {
            navigation.navigate('EditWarehouse', { warehouse: item });
        }
    };

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.itemContainer, { backgroundColor: colors.surface, marginHorizontal: 10 }]}
            onPress={handlePress}
        >
            <AppText label={`${index + 1}`} style={[styles.itemIndex, { color: colors.textTertiary }]} fontSize={14} />
            <View style={styles.itemContent}>
                <AppText label={item.name} style={[styles.itemName, { color: colors.text }]} numberOfLines={1} />
                <AppText label={item.location || 'Location not set'} style={[styles.itemDetail, { color: colors.textSecondary }]} numberOfLines={1} />
                {canCustomerSignupCodes && item.reference_code ? (
                    <AppText
                        label={`Signup code: ${item.reference_code}`}
                        style={[styles.itemDetail, { color: colors.textTertiary }]}
                        numberOfLines={1}
                    />
                ) : null}
                <AppText label={`Manager: ${item.manager || 'Not set'}`} style={[styles.itemDetail, { color: colors.textSecondary }]} numberOfLines={1} />
            </View>
            <View style={styles.itemArrow}>
                <Lucide name="chevron-right" color={colors.textTertiary} size={20} />
            </View>
        </TouchableOpacity>
    );
};

export default WarehouseItem;
