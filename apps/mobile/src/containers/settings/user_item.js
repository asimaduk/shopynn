import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import styles from './styles';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { ROLES } from '../../utils/permissions';

const roleBadge = StyleSheet.create({ roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 } }).roleBadge;

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

const UserItem = ({ item, index, onPress }) => {
    const { colors } = useTheme();
    const primaryRole =
        Array.isArray(item.roles) && item.roles.length
            ? (item.roles[0].name || item.roles[0].code || item.roles[0].id)
            : item.role || 'No role';
    const roleColor = getRoleBadgeColor(primaryRole, colors);

    const initials = `${item.first_name?.[0] || ''}${item.last_name?.[0] || ''}`.toUpperCase() || 'U';

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[
                styles.itemContainer,
                {
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    marginHorizontal: 10,
                    marginBottom: 6,
                    elevation: 0.5,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.03,
                    shadowRadius: 1.5,
                    opacity: item.deleted ? 0.5 : 1,
                },
            ]}
            onPress={onPress}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: colors.surfaceSecondary,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 10,
                    }}
                >
                    <AppText label={initials} fontSize={14} color={colors.text} />
                </View>

                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <AppText
                            label={`${item.first_name || ''} ${item.last_name || ''}`.trim() || item.name || 'Unnamed user'}
                            style={[styles.itemName, { color: colors.text }]}
                            numberOfLines={1}
                        />
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                            <View
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: item.is_active !== false ? config.GREEN_COLOR : colors.error,
                                    marginRight: 4,
                                }}
                            />
                            <AppText
                                label={item.deleted ? 'Deleted' : item.is_active !== false ? 'Active' : 'Disabled'}
                                fontSize={10}
                                color={item.deleted ? colors.error : item.is_active !== false ? config.GREEN_COLOR : colors.error}
                            />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Lucide name="mail" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                        <AppText
                            label={item.email || 'No email'}
                            style={[styles.itemDetail, { color: colors.textSecondary }]}
                            numberOfLines={1}
                        />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                        <Lucide name="phone" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                        <AppText
                            label={item.phone || 'No phone'}
                            style={[styles.itemDetail, { color: colors.textSecondary }]}
                            numberOfLines={1}
                        />
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'space-between' }}>
                        <View style={[roleBadge, { backgroundColor: roleColor + '20' }]}>
                            <AppText label={primaryRole} fontSize={10} color={roleColor} />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <AppText label={`#${index + 1}`} fontSize={10} color={colors.textTertiary} style={{ marginRight: 4 }} />
                            <Lucide name="chevron-right" color={colors.textTertiary} size={16} />
                        </View>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default UserItem;
