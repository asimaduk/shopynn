import React, { useState, useMemo, useCallback } from 'react';
import { TextInput, TouchableOpacity, View, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useFocusEffect } from '@react-navigation/native';
import ScreenHeader from '../../components/screen_header';
import { FlashList } from '@shopify/flash-list';
import styles from './styles';
import UserItem from './user_item';
import AppText from '../../components/text';
import config from '../../config';
import AppModal from '../../components/app_modal';
import useTheme from '../../hooks/useTheme';
import { users as usersApi, roles as rolesApi, normalizeList } from '../../services/api';
const STATUS_FILTERS = [{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'disabled', label: 'Disabled' }, { id: 'deleted', label: 'Deleted' }];

const LOAD_DELAY_MS = 800;

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
    const [showSearch, setShowSearch] = useState(false);

    const loadUsers = useCallback(async () => {
        try {
            const [rawUsers, rawRoles] = await Promise.all([
                usersApi.list(),
                rolesApi.list(),
            ]);
            const list = normalizeList(rawUsers);
            const roleList = normalizeList(rawRoles);
            setUsers(Array.isArray(list) ? list : []);
            setRoles(Array.isArray(roleList) ? roleList : []);
        } catch (err) {
            setUsers([]);
            setRoles([]);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            setLoading(true);
            loadUsers().finally(() => {
                if (isActive) {
                    setLoading(false);
                }
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
                .filter((r) => r && (r.name || r.code || r.id))
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
            result = result.filter(
                (u) => {
                    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
                    const nameMatch = name.toLowerCase().includes(q);
                    const emailMatch = u.email && u.email.toLowerCase().includes(q);
                    const phoneMatch = u.phone && u.phone.toLowerCase().includes(q);
                    const rolesText = Array.isArray(u.roles)
                        ? u.roles
                              .map((r) => r.name || r.code || r.id)
                              .join(', ')
                              .toLowerCase()
                        : (u.role || '').toLowerCase();
                    const roleMatch = rolesText.includes(q);
                    return nameMatch || emailMatch || phoneMatch || roleMatch;
                },
            );
        }
        if (roleFilter) {
            result = result.filter((u) =>
                Array.isArray(u.roles)
                    ? u.roles.some((r) => r.id === roleFilter)
                    : (u.role_id || u.role) === roleFilter,
            );
        }
        if (statusFilter === 'active') result = result.filter((u) => u.is_active);
        if (statusFilter === 'disabled') result = result.filter((u) => !u.is_active);
        if (statusFilter === 'deleted') result = result.filter((u) => u.deleted);
        return result;
    }, [users, searchText, roleFilter, statusFilter]);

    const backPress = () => navigation.goBack();

    const renderItem = ({ item, index }) => (
        <UserItem item={item} index={index} onPress={() => navigation.navigate('UserDetails', { user: item })} />
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={backPress} label="System users" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading users..." fontSize={15} color={colors.textSecondary} style={{ marginTop: 16 }} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label="System users">
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => {
                            setShowSearch((prev) => {
                                const next = !prev;
                                if (!next) setSearchText('');
                                return next;
                            });
                        }}
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                        <Lucide name={showSearch ? 'x' : 'search'} color={colors.text} size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => navigation.navigate('UserForm')}
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                        <Lucide name="plus" color={config.THEME_COLOR} size={20} />
                    </TouchableOpacity>
                </View>
            </ScreenHeader>

            {showSearch ? (
                <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
                    <Lucide name="search" color={colors.textTertiary} size={18} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search by name or email..."
                        placeholderTextColor={colors.placeholder}
                        value={searchText}
                        onChangeText={setSearchText}
                        autoCorrect={false}
                        autoCapitalize="none"
                        returnKeyType="search"
                    />
                    {searchText.length > 0 ? (
                        <TouchableOpacity onPress={() => setSearchText('')}>
                            <Lucide name="x" color={colors.textTertiary} size={18} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}

            <View style={{ flexDirection: 'row', paddingHorizontal: 15, marginVertical: 10, gap: 8 }}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowRolePicker(true)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <Lucide name="shield" size={14} color={config.THEME_COLOR} />
                    <AppText label={roleFilter ? roleFilters.find((r) => r.id === roleFilter)?.label : 'All roles'} fontSize={12} color={colors.text} style={{ marginLeft: 6, flex: 1 }} numberOfLines={1} />
                    <Lucide name="chevron-down" size={14} color={colors.textTertiary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowStatusPicker(true)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <Lucide name="user-check" size={14} color={config.THEME_COLOR} />
                    <AppText label={STATUS_FILTERS.find((s) => s.id === statusFilter)?.label || 'All'} fontSize={12} color={colors.text} style={{ marginLeft: 6, flex: 1 }} numberOfLines={1} />
                    <Lucide name="chevron-down" size={14} color={colors.textTertiary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
            </View>

            <FlashList
                contentContainerStyle={styles.listContent}
                data={filteredData}
                renderItem={renderItem}
                estimatedItemSize={88}
                keyExtractor={(item) => item.id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[config.THEME_COLOR]} tintColor={config.THEME_COLOR} />
                }
                ListEmptyComponent={
                    <View style={{ padding: 24, alignItems: 'center' }}>
                        <Lucide name="users" size={48} color={colors.textTertiary} />
                        <AppText label="No users match your filters" fontSize={15} color={colors.textSecondary} style={{ marginTop: 12 }} />
                    </View>
                }
            />

            <AppModal title="Filter by role" visible={showRolePicker} handleClose={() => setShowRolePicker(false)} onRequestClose={() => setShowRolePicker(false)}>
                <View style={{ padding: 16, paddingBottom: 24 }}>
                    {roleFilters.map((r) => (
                        <TouchableOpacity
                            key={r.id || 'all'}
                            activeOpacity={0.7}
                            onPress={() => { setRoleFilter(r.id); setShowRolePicker(false); }}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Lucide name={r.id ? 'shield' : 'list'} size={18} color={config.THEME_COLOR} />
                            <AppText label={r.label} fontSize={15} color={colors.text} style={{ marginLeft: 12 }} />
                        </TouchableOpacity>
                    ))}
                </View>
            </AppModal>
            <AppModal title="Filter by status" visible={showStatusPicker} handleClose={() => setShowStatusPicker(false)} onRequestClose={() => setShowStatusPicker(false)}>
                <View style={{ padding: 16, paddingBottom: 24 }}>
                    {STATUS_FILTERS.map((s) => (
                        <TouchableOpacity
                            key={s.id}
                            activeOpacity={0.7}
                            onPress={() => { setStatusFilter(s.id); setShowStatusPicker(false); }}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Lucide name={s.id === 'active' ? 'user-check' : s.id === 'disabled' ? 'user-x' : 'users'} size={18} color={config.THEME_COLOR} />
                            <AppText label={s.label} fontSize={15} color={colors.text} style={{ marginLeft: 12 }} />
                        </TouchableOpacity>
                    ))}
                </View>
            </AppModal>
        </SafeAreaView>
    );
};

export default Users;
