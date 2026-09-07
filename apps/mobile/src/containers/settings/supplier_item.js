import React from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import styles from './styles';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';

const SupplierItem = ({ item, index, onPress }) => {
    const { colors } = useTheme();
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.itemContainer, { backgroundColor: colors.surface, marginHorizontal: 10 }]}
            onPress={onPress}
        >
            <AppText label={`${index + 1}`} style={[styles.itemIndex, { color: colors.textTertiary }]} fontSize={14} />

            <View style={{ marginRight: 15 }}>
                {item.image ? (
                    <Image source={{ uri: item.image }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                ) : (
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' }}>
                        <Lucide name="truck" size={20} color={colors.textSecondary} />
                    </View>
                )}
            </View>

            <View style={styles.itemContent}>
                <AppText label={item.name} style={[styles.itemName, { color: colors.text }]} numberOfLines={1} />
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Lucide name="map-pin" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                    <AppText label={item.address || 'N/A'} style={[styles.itemDetail, { color: colors.textSecondary }]} numberOfLines={1} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Lucide name="user" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                    <AppText label={`Rep: ${item.manager ?? 'N/A'}`} style={[styles.itemDetail, { color: colors.textSecondary }]} numberOfLines={1} color={colors.textTertiary} />
                </View>
            </View>

            <View style={styles.itemArrow}>
                <Lucide name="chevron-right" color={colors.textTertiary} size={20} />
            </View>
        </TouchableOpacity>
    );
};

export default SupplierItem;
