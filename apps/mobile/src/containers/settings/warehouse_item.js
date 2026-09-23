import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useSelector } from 'react-redux';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { canManageCustomerSignupCodes } from '../../utils/permissions';

const WarehouseItem = ({ item, navigation }) => {
    const { colors } = useTheme();
    const currentUser = useSelector(({ user }) => user?.data);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const canCustomerSignupCodes = canManageCustomerSignupCodes(currentUser, subscriptionFeatures);
    const location = item.location || item.address || '';
    const manager = item.manager || '';

    return (
        <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => navigation?.navigate('EditWarehouse', { warehouse: item })}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
            <View style={styles.topRow}>
                <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary || `${config.THEME_COLOR}12` }]}>
                    <Lucide name="store" size={18} color={config.THEME_COLOR} />
                </View>
                <View style={styles.main}>
                    <AppText label={item.name || 'Unnamed store'} variant={1} fontSize={15} color={colors.text} numberOfLines={1} />
                    {location ? (
                        <View style={styles.metaRow}>
                            <Lucide name="map-pin" size={12} color={colors.textTertiary} />
                            <AppText label={location} fontSize={12} color={colors.textSecondary} numberOfLines={1} style={styles.metaText} />
                        </View>
                    ) : null}
                    {manager ? (
                        <View style={styles.metaRow}>
                            <Lucide name="user" size={12} color={colors.textTertiary} />
                            <AppText label={manager} fontSize={12} color={colors.textSecondary} numberOfLines={1} style={styles.metaText} />
                        </View>
                    ) : null}
                    {canCustomerSignupCodes && item.reference_code ? (
                        <View style={styles.metaRow}>
                            <Lucide name="hash" size={12} color={colors.textTertiary} />
                            <AppText
                                label={`Code: ${item.reference_code}`}
                                fontSize={12}
                                color={colors.textTertiary}
                                numberOfLines={1}
                                style={styles.metaText}
                            />
                        </View>
                    ) : null}
                </View>
                <Lucide name="chevron-right" color={colors.border} size={18} style={{ marginLeft: 4 }} />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        marginBottom: 10,
    },
    topRow: { flexDirection: 'row', alignItems: 'flex-start' },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    main: { flex: 1, minWidth: 0 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    metaText: { marginLeft: 6, flex: 1 },
});

export default WarehouseItem;
