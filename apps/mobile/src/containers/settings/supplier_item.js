import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const supplierInitials = (name) => {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length) return 'S';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
};

const SupplierItem = ({ item, onPress }) => {
    const { colors } = useTheme();
    const name = item.name || 'Unnamed supplier';
    const phone = item.phone || '';
    const location = item.address || item.location || '';
    const manager = item.manager || item.contactPerson || '';

    return (
        <TouchableOpacity
            activeOpacity={0.75}
            onPress={onPress}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
            <View style={styles.topRow}>
                <View style={[styles.avatar, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                    {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.avatarImage} />
                    ) : (
                        <AppText label={supplierInitials(name)} variant={1} fontSize={14} color={config.THEME_COLOR} />
                    )}
                </View>
                <View style={styles.main}>
                    <AppText label={name} variant={1} fontSize={15} color={colors.text} numberOfLines={1} />
                    {phone ? (
                        <View style={styles.metaRow}>
                            <Lucide name="phone" size={12} color={colors.textTertiary} />
                            <AppText label={phone} fontSize={12} color={colors.textSecondary} numberOfLines={1} style={styles.metaText} />
                        </View>
                    ) : null}
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
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    avatarImage: { width: 42, height: 42, borderRadius: 21 },
    main: { flex: 1, minWidth: 0 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    metaText: { marginLeft: 6, flex: 1 },
});

export default SupplierItem;
