import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { ROLES } from '../../utils/permissions';

const normalizeRoleKey = (value) => String(value ?? '').trim().toLowerCase();

/** Badge color by role tier (Admin > Manager > Staff > unknown). */
const getRoleBadgeColor = (primaryRoleLabel, colors) => {
    const key = normalizeRoleKey(primaryRoleLabel);
    if (!key || key === 'no role') return colors.textTertiary;

    const adminKey = normalizeRoleKey(ROLES.Admin);
    const managerKey = normalizeRoleKey(ROLES.Manager);
    const staffKey = normalizeRoleKey(ROLES.Staff);
    const cashierKey = normalizeRoleKey(ROLES.Cashier);

    if (key === adminKey || key.includes('admin')) return colors.error;
    if (key === managerKey || key.includes('manager')) return config.THEME_COLOR;
    if (key === staffKey || key.includes('staff')) return colors.textSecondary;
    if (key === cashierKey || key.includes('cashier')) return colors.info;
    return colors.info;
};

const UserItem = ({ item, onPress }) => {
    const { colors } = useTheme();
    const primaryRole =
        Array.isArray(item.roles) && item.roles.length
            ? item.roles[0].name || item.roles[0].code || item.roles[0].id
            : item.role || 'No role';
    const extraRoles = Array.isArray(item.roles) && item.roles.length > 1 ? item.roles.length - 1 : 0;
    const roleColor = getRoleBadgeColor(primaryRole, colors);
    const name = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.name || 'Unnamed user';
    const initials = `${item.first_name?.[0] || ''}${item.last_name?.[0] || ''}`.toUpperCase() || 'U';
    const isActive = !item.deleted && item.is_active !== false;
    const statusLabel = item.deleted ? 'Deleted' : isActive ? 'Active' : 'Disabled';
    const statusColor = item.deleted || !isActive ? colors.error : config.GREEN_COLOR || '#16a34a';

    return (
        <TouchableOpacity
            activeOpacity={0.75}
            onPress={onPress}
            style={[
                styles.card,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: item.deleted ? 0.55 : 1,
                },
            ]}
        >
            <View style={styles.topRow}>
                <View style={[styles.avatar, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                    <AppText label={initials} variant={1} fontSize={14} color={config.THEME_COLOR} />
                </View>
                <View style={styles.main}>
                    <View style={styles.nameRow}>
                        <AppText label={name} variant={1} fontSize={15} color={colors.text} numberOfLines={1} style={{ flex: 1 }} />
                        <View style={styles.statusWrap}>
                            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                            <AppText label={statusLabel} fontSize={11} color={statusColor} />
                        </View>
                    </View>

                    {item.email ? (
                        <View style={styles.metaRow}>
                            <Lucide name="mail" size={12} color={colors.textTertiary} />
                            <AppText
                                label={item.email}
                                fontSize={12}
                                color={colors.textSecondary}
                                numberOfLines={1}
                                style={styles.metaText}
                            />
                        </View>
                    ) : null}
                    {item.phone ? (
                        <View style={styles.metaRow}>
                            <Lucide name="phone" size={12} color={colors.textTertiary} />
                            <AppText
                                label={item.phone}
                                fontSize={12}
                                color={colors.textSecondary}
                                numberOfLines={1}
                                style={styles.metaText}
                            />
                        </View>
                    ) : null}
                </View>
                <Lucide name="chevron-right" color={colors.border} size={18} style={{ marginLeft: 4 }} />
            </View>

            <View style={styles.badgeRow}>
                <View style={[styles.roleBadge, { backgroundColor: `${roleColor}18` }]}>
                    <AppText label={primaryRole} fontSize={11} color={roleColor} variant={1} />
                </View>
                {extraRoles > 0 ? (
                    <View style={[styles.roleBadge, { backgroundColor: colors.surfaceSecondary || colors.background }]}>
                        <AppText label={`+${extraRoles} more`} fontSize={11} color={colors.textSecondary} />
                    </View>
                ) : null}
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
        marginRight: 12
    },
    main: {
        flex: 1,
        minWidth: 0,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        marginRight: 5,
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
    badgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 12,
        marginLeft: 54,
    },
    roleBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
});

export default UserItem;
