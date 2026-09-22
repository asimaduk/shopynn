import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const sourceMeta = (source, colors) => {
    if (source === 'account') {
        return { label: 'App signup', color: config.THEME_COLOR, bg: `${config.THEME_COLOR}18` };
    }
    if (source === 'pos') {
        return { label: 'POS / admin', color: colors.textSecondary, bg: colors.surfaceSecondary || colors.background };
    }
    return null;
};

const CustomerItem = ({ item, onPress, onEdit }) => {
    const { colors } = useTheme();
    const parts = String(item.name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const initials =
        parts.length >= 2
            ? `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
            : (parts[0] || 'C').slice(0, 2).toUpperCase();
    const source = sourceMeta(item.source, colors);
    const phone = item.phone || item.contact || '';
    const location = item.address || item.location || '';

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
                        <AppText label={initials} variant={1} fontSize={14} color={config.THEME_COLOR} />
                    )}
                </View>

                <View style={styles.main}>
                    <AppText
                        label={item.name || 'Unnamed customer'}
                        variant={1}
                        fontSize={15}
                        color={colors.text}
                        numberOfLines={1}
                    />

                    {phone ? (
                        <View style={styles.metaRow}>
                            <Lucide name="phone" size={12} color={colors.textTertiary} />
                            <AppText
                                label={phone}
                                fontSize={12}
                                color={colors.textSecondary}
                                numberOfLines={1}
                                style={styles.metaText}
                            />
                        </View>
                    ) : null}

                    {location ? (
                        <View style={styles.metaRow}>
                            <Lucide name="map-pin" size={12} color={colors.textTertiary} />
                            <AppText
                                label={location}
                                fontSize={12}
                                color={colors.textSecondary}
                                numberOfLines={1}
                                style={styles.metaText}
                            />
                        </View>
                    ) : null}
                </View>

                <View style={styles.trailing}>
                    {onEdit ? (
                        <TouchableOpacity
                            onPress={onEdit}
                            activeOpacity={0.6}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={styles.editBtn}
                        >
                            <Lucide name="pencil" color={config.THEME_COLOR} size={16} />
                        </TouchableOpacity>
                    ) : null}
                    <Lucide name="chevron-right" color={colors.border} size={18} />
                </View>
            </View>

            {source ? (
                <View style={styles.badgeRow}>
                    <View style={[styles.sourceBadge, { backgroundColor: source.bg }]}>
                        <AppText label={source.label} fontSize={11} color={source.color} variant={1} />
                    </View>
                </View>
            ) : null}
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
    topRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    avatarImage: {
        width: 42,
        height: 42,
        borderRadius: 21,
    },
    main: {
        flex: 1,
        minWidth: 0,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    metaText: {
        marginLeft: 6,
        flex: 1,
    },
    trailing: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 6,
        gap: 2,
    },
    editBtn: {
        padding: 6,
    },
    badgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 12,
        marginLeft: 54,
    },
    sourceBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
});

export default CustomerItem;
