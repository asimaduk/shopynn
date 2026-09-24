import React, { useState, useMemo, useCallback } from 'react';
import {
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
    RefreshControl,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import ScreenHeader from '../../components/screen_header';
import UserItem from './user_item';
import AppText from '../../components/text';
import config from '../../config';
import AppModal from '../../components/app_modal';
import useTheme from '../../hooks/useTheme';
import { users as usersApi, roles as rolesApi, normalizeList } from '../../services/api';

const STATUS_FILTERS = [
    { id: 'all', label: 'All statuses', icon: 'users' },
    { id: 'active', label: 'Active', icon: 'user-check' },
    { id: 'disabled', label: 'Disabled', icon: 'user-x' },
    { id: 'deleted', label: 'Deleted', icon: 'user-round-x' },
];

const Users = ({ navigation }) => {
    const { colors } = useTheme();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showRolePicker, setShowRolePicker] = useState(false);
    const [showStatusPicker, setShowStatusPicker] = useState(false);

    const loadUsers = useCallback(async () => {
        try {
            const [rawUsers, rawRoles] = await Promise.all([usersApi.list(), rolesApi.list()]);
            const list = normalizeList(rawUsers);
            const roleList = normalizeList(rawRoles);
            setUsers(Array.isArray(list) ? list : []);
            setRoles(Array.isArray(roleList) ? roleList : []);
        } catch (_) {
            setUsers([]);
            setRoles([]);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            setLoading(true);
            loadUsers().finally(() => {
                if (isActive) setLoading(false);
            });
            return () => {
                isActive = false;
            };
        }, [loadUsers]),
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadUsers().then(() => setRefreshing(false));
    }, [loadUsers]);

    const roleFilters = useMemo(
        () => [
            { id: '', label: 'All roles' },
            ...roles
                .filter((r) => {
                    if (!r || !(r.name || r.code || r.id)) return false;
                    // Customer is a B2C portal role — not used for system user filtering.
                    return String(r.name || r.code || '')
                        .trim()
                        .toLowerCase() !== 'customer';
                })
                .map((r) => ({
                    id: r.id,
                    label: r.name || r.code || String(r.id),
                })),
        ],
        [roles],
    );

    const filteredData = useMemo(() => {
        let result = [...users];
        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            result = result.filter((u) => {
                const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
                const nameMatch = name.toLowerCase().includes(q);
                const emailMatch = u.email && u.email.toLowerCase().includes(q);
                const phoneMatch = u.phone && u.phone.toLowerCase().includes(q);
                const rolesText = Array.isArray(u.roles)
                    ? u.roles
                          .map((r) => r.name || r.code || r.id)
                          .join(', ')
                          .toLowerCase()
                    : String(u.role || '').toLowerCase();
                return nameMatch || emailMatch || phoneMatch || rolesText.includes(q);
            });
        }
        if (roleFilter) {
            result = result.filter((u) =>
                Array.isArray(u.roles)
                    ? u.roles.some((r) => r.id === roleFilter)
                    : (u.role_id || u.role) === roleFilter,
            );
        }
        if (statusFilter === 'active') result = result.filter((u) => u.is_active && !u.deleted);
        if (statusFilter === 'disabled') result = result.filter((u) => !u.is_active && !u.deleted);
        if (statusFilter === 'deleted') result = result.filter((u) => u.deleted);
        return result;
    }, [users, searchText, roleFilter, statusFilter]);

    const activeCount = useMemo(() => users.filter((u) => u.is_active && !u.deleted).length, [users]);
    const filtering = searchText.trim().length > 0 || !!roleFilter || statusFilter !== 'all';
    const roleFilterLabel = roleFilter
        ? roleFilters.find((r) => r.id === roleFilter)?.label || 'Role'
        : 'All roles';
    const statusFilterLabel = STATUS_FILTERS.find((s) => s.id === statusFilter)?.label || 'All';

    const backPress = () => navigation.goBack();

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={backPress} label="System users" />
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading users..." fontSize={15} color={colors.textSecondary} style={{ marginTop: 16 }} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label="System users">
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('UserForm')}
                    style={[styles.headerBtn, { backgroundColor: colors.surface }]}
                >
                    <Lucide name="plus" color={config.THEME_COLOR} size={18} />
                </TouchableOpacity>
            </ScreenHeader>

            <View style={styles.summaryRow}>
                <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="users" size={14} color={config.THEME_COLOR} />
                    <AppText
                        label={`${users.length} user${users.length === 1 ? '' : 's'}`}
                        fontSize={13}
                        variant={1}
                        color={colors.text}
                        style={{ marginLeft: 6 }}
                    />
                </View>
                <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="user-check" size={14} color={config.GREEN_COLOR || '#16a34a'} />
                    <AppText
                        label={`${activeCount} active`}
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginLeft: 6 }}
                    />
                </View>
                {filtering ? (
                    <View
                        style={[
                            styles.summaryChip,
                            { backgroundColor: `${config.THEME_COLOR}14`, borderColor: `${config.THEME_COLOR}33` },
                        ]}
                    >
                        <AppText
                            label={`${filteredData.length} shown`}
                            fontSize={13}
                            color={config.THEME_COLOR}
                            variant={1}
                        />
                    </View>
                ) : null}
            </View>

            <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Lucide name="search" size={16} color={colors.textTertiary} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search name, email, phone, or role"
                    placeholderTextColor={colors.placeholder}
                    value={searchText}
                    onChangeText={setSearchText}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                />
                {searchText.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Lucide name="x" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.filterRow}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowRolePicker(true)}
                    style={[
                        styles.filterChip,
                        {
                            backgroundColor: roleFilter ? `${config.THEME_COLOR}14` : colors.surface,
                            borderColor: roleFilter ? `${config.THEME_COLOR}55` : colors.border,
                        },
                    ]}
                >
                    <Lucide name="shield" size={14} color={config.THEME_COLOR} />
                    <AppText
                        label={roleFilterLabel}
                        fontSize={12}
                        color={colors.text}
                        style={{ marginLeft: 6, flex: 1 }}
                        numberOfLines={1}
                    />
                    <Lucide name="chevron-down" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowStatusPicker(true)}
                    style={[
                        styles.filterChip,
                        {
                            backgroundColor: statusFilter !== 'all' ? `${config.THEME_COLOR}14` : colors.surface,
                            borderColor: statusFilter !== 'all' ? `${config.THEME_COLOR}55` : colors.border,
                        },
                    ]}
                >
                    <Lucide name="user-check" size={14} color={config.THEME_COLOR} />
                    <AppText
                        label={statusFilterLabel}
                        fontSize={12}
                        color={colors.text}
                        style={{ marginLeft: 6, flex: 1 }}
                        numberOfLines={1}
                    />
                    <Lucide name="chevron-down" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
            </View>

            <FlashList
                contentContainerStyle={styles.listContent}
                data={filteredData}
                renderItem={({ item }) => (
                    <UserItem item={item} onPress={() => navigation.navigate('UserDetails', { user: item })} />
                )}
                estimatedItemSize={108}
                keyExtractor={(item) => String(item.id)}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[config.THEME_COLOR]}
                        tintColor={config.THEME_COLOR}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSecondary }]}>
                            <Lucide name="users" size={28} color={colors.textTertiary} />
                        </View>
                        <AppText
                            label={filtering ? 'No users match your filters' : 'No users yet'}
                            variant={1}
                            fontSize={16}
                            color={colors.text}
                            style={{ marginTop: 12 }}
                        />
                        <AppText
                            label={
                                filtering
                                    ? 'Try another search or clear filters'
                                    : 'Add a staff account to get started'
                            }
                            fontSize={13}
                            color={colors.textTertiary}
                            style={{ marginTop: 4, textAlign: 'center' }}
                        />
                        {!filtering ? (
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => navigation.navigate('UserForm')}
                                style={[styles.emptyCta, { backgroundColor: config.THEME_COLOR }]}
                            >
                                <Lucide name="plus" size={16} color="#fff" />
                                <AppText label="Add user" color="#fff" variant={1} fontSize={14} style={{ marginLeft: 6 }} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                }
            />

            <AppModal
                title="Filter by role"
                visible={showRolePicker}
                handleClose={() => setShowRolePicker(false)}
                onRequestClose={() => setShowRolePicker(false)}
            >
                <View style={styles.pickerBody}>
                    {roleFilters.map((r) => {
                        const selected = roleFilter === r.id;
                        return (
                            <TouchableOpacity
                                key={r.id || 'all'}
                                activeOpacity={0.7}
                                onPress={() => {
                                    setRoleFilter(r.id);
                                    setShowRolePicker(false);
                                }}
                                style={[styles.pickerRow, { borderBottomColor: colors.border }]}
                            >
                                <Lucide name={r.id ? 'shield' : 'list'} size={18} color={config.THEME_COLOR} />
                                <AppText label={r.label} fontSize={15} color={colors.text} style={{ marginLeft: 12, flex: 1 }} />
                                {selected ? <Lucide name="check" size={18} color={config.THEME_COLOR} /> : null}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </AppModal>

            <AppModal
                title="Filter by status"
                visible={showStatusPicker}
                handleClose={() => setShowStatusPicker(false)}
                onRequestClose={() => setShowStatusPicker(false)}
            >
                <View style={styles.pickerBody}>
                    {STATUS_FILTERS.map((s) => {
                        const selected = statusFilter === s.id;
                        return (
                            <TouchableOpacity
                                key={s.id}
                                activeOpacity={0.7}
                                onPress={() => {
                                    setStatusFilter(s.id);
                                    setShowStatusPicker(false);
                                }}
                                style={[styles.pickerRow, { borderBottomColor: colors.border }]}
                            >
                                <Lucide name={s.icon} size={18} color={config.THEME_COLOR} />
                                <AppText label={s.label} fontSize={15} color={colors.text} style={{ marginLeft: 12, flex: 1 }} />
                                {selected ? <Lucide name="check" size={18} color={config.THEME_COLOR} /> : null}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </AppModal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerBtn: {
        height: 34,
        width: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginHorizontal: 15,
        marginTop: 10,
        marginBottom: 10,
    },
    summaryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 15,
        marginBottom: 10,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        height: 46,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontFamily: 'FiraSans-Regular',
        fontSize: 14,
    },
    filterRow: {
        flexDirection: 'row',
        marginHorizontal: 15,
        marginBottom: 12,
        gap: 8,
    },
    filterChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
    },
    listContent: {
        paddingHorizontal: 15,
        paddingBottom: 28,
    },
    emptyWrap: {
        paddingTop: 48,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    emptyIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyCta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 18,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
    },
    pickerBody: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
});

export default Users;
