import React, { useCallback, useMemo, useState } from 'react';
import { View, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useSelector } from 'react-redux';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import AppModal from '../../components/app_modal';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { roles as rolesApi, permissions as permissionsApi, normalizeList } from '../../services/api';
import { hasPermission } from '../../utils/permissions';

const Roles = ({ navigation }) => {
    const { colors } = useTheme();
    const currentUser = useSelector(({ user }) => user);
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [editingRoleId, setEditingRoleId] = useState('');
    const [roleName, setRoleName] = useState('');
    const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);
    const [rolePermissionMap, setRolePermissionMap] = useState({});
    const [permissionSearch, setPermissionSearch] = useState('');

    const loadMeta = useCallback(async () => {
        try {
            const [rawRoles, rawPermissions] = await Promise.all([rolesApi.list(), permissionsApi.list()]);
            const roleList = Array.isArray(normalizeList(rawRoles)) ? normalizeList(rawRoles) : [];
            setRoles(roleList);
            setPermissions(Array.isArray(normalizeList(rawPermissions)) ? normalizeList(rawPermissions) : []);
            preloadRolePermissionMap(roleList);
        } catch (_) {
            setRoles([]);
            setPermissions([]);
            setRolePermissionMap({});
        }
    }, [preloadRolePermissionMap]);

    const loadRolePermissions = useCallback(async (roleId) => {
        if (!roleId) {
            setSelectedPermissionIds([]);
            return;
        }
        try {
            const raw = await rolesApi.getPermissions(roleId);
            const list = Array.isArray(normalizeList(raw)) ? normalizeList(raw) : [];
            setSelectedPermissionIds(list.map((p) => p?.id).filter(Boolean));
        } catch (_) {
            setSelectedPermissionIds([]);
        }
    }, []);

    const preloadRolePermissionMap = useCallback(async (roleList) => {
        const items = Array.isArray(roleList) ? roleList : [];
        if (!items.length) {
            setRolePermissionMap({});
            return;
        }
        const results = await Promise.all(
            items.map(async (role) => {
                const roleId = role?.id;
                if (!roleId) return null;
                try {
                    const raw = await rolesApi.getPermissions(roleId);
                    const list = Array.isArray(normalizeList(raw)) ? normalizeList(raw) : [];
                    const labels = list.map((p) => p?.name || p?.code || p?.id).filter(Boolean);
                    return [roleId, labels];
                } catch (_) {
                    return [roleId, []];
                }
            }),
        );
        const mapped = {};
        results.forEach((entry) => {
            if (!entry) return;
            mapped[entry[0]] = entry[1];
        });
        setRolePermissionMap(mapped);
    }, []);

    useFocusEffect(
        useCallback(() => {
            let active = true;
            setLoading(true);
            loadMeta().finally(() => {
                if (active) setLoading(false);
            });
            return () => {
                active = false;
            };
        }, [loadMeta]),
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadMeta();
        setRefreshing(false);
    }, [loadMeta]);

    const openCreate = useCallback(() => {
        setEditingRoleId('');
        setRoleName('');
        setSelectedPermissionIds([]);
        setPermissionSearch('');
        setShowEditor(true);
    }, []);

    const openEdit = useCallback(
        async (role) => {
            const id = role?.id || '';
            const name = role?.name || role?.code || '';
            setEditingRoleId(id);
            setRoleName(name);
            setSelectedPermissionIds([]);
            setPermissionSearch('');
            setShowEditor(true);
            await loadRolePermissions(id);
        },
        [loadRolePermissions],
    );

    const togglePermission = useCallback((id) => {
        setSelectedPermissionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }, []);

    const selectedCountLabel = useMemo(
        () => `${selectedPermissionIds.length} permission${selectedPermissionIds.length === 1 ? '' : 's'} selected`,
        [selectedPermissionIds],
    );
    const canCreateRole = hasPermission(currentUser, ['roles.create', 'users.roles.create']);
    const canUpdateRole = hasPermission(currentUser, ['roles.update', 'users.roles.update']);
    const canDeleteRole = hasPermission(currentUser, ['roles.delete', 'users.roles.delete']);

    const filteredRoles = useMemo(() => {
        const query = searchText.trim().toLowerCase();
        if (!query) return roles;
        return roles.filter((role) => {
            const label = String(role?.name || role?.code || '').toLowerCase();
            const id = String(role?.id || '').toLowerCase();
            return label.includes(query) || id.includes(query);
        });
    }, [roles, searchText]);
    const filteredPermissions = useMemo(() => {
        const query = permissionSearch.trim().toLowerCase();
        if (!query) return permissions;
        return permissions.filter((perm) => {
            const label = String(perm?.name || perm?.code || perm?.id || '').toLowerCase();
            return label.includes(query);
        });
    }, [permissions, permissionSearch]);
    const allPermissionIds = useMemo(
        () => permissions.map((perm) => perm?.id).filter(Boolean),
        [permissions],
    );
    const canEditRolePermissions = editingRoleId ? canUpdateRole : canCreateRole;
    const allSelected =
        allPermissionIds.length > 0 &&
        allPermissionIds.every((id) => selectedPermissionIds.includes(id));

    const toggleSelectAllPermissions = useCallback(() => {
        if (!canEditRolePermissions) return;
        setSelectedPermissionIds((prev) => {
            const currentlyAllSelected =
                allPermissionIds.length > 0 &&
                allPermissionIds.every((id) => prev.includes(id));
            return currentlyAllSelected ? [] : allPermissionIds;
        });
    }, [allPermissionIds, canEditRolePermissions]);

    const saveRole = useCallback(async () => {
        if (editingRoleId && !canUpdateRole) {
            Alert.alert('Permission', 'You are not allowed to update roles.');
            return;
        }
        if (!editingRoleId && !canCreateRole) {
            Alert.alert('Permission', 'You are not allowed to create roles.');
            return;
        }
        const name = roleName.trim();
        if (!name) {
            Alert.alert('Role name', 'Please enter a role name.');
            return;
        }
        if (selectedPermissionIds.length === 0) {
            Alert.alert('Permissions', 'Please select at least one permission.');
            return;
        }
        try {
            setSaving(true);
            const body = {
                name,
                permission_ids: selectedPermissionIds,
                permissions: selectedPermissionIds,
            };
            console.log('body', body);
            if (editingRoleId) {
                await rolesApi.update(editingRoleId, body);
            } else {
                await rolesApi.create(body);
            }
            await loadMeta();
            setShowEditor(false);
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to save role.';
            Alert.alert('Error', msg);
        } finally {
            setSaving(false);
        }
    }, [editingRoleId, roleName, selectedPermissionIds, loadMeta, canCreateRole, canUpdateRole]);

    const removeRole = useCallback(
        (role) => {
            if (!canDeleteRole) {
                Alert.alert('Permission', 'You are not allowed to delete roles.');
                return;
            }
            const roleId = role?.id;
            if (!roleId) return;
            Alert.alert('Delete role', `Delete "${role?.name || 'this role'}"?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await rolesApi.delete(roleId);
                            console.log('response', response);
                            if (response.status === 400) {
                                Alert.alert('Error', response.data.message);
                                return;
                            }
                            await loadMeta();
                        } catch (err) {
                            // console.log('err', err);
                            const msg = err?.response?.data?.message || err?.message || 'Failed to delete role.';
                            Alert.alert('Error', msg);
                        }
                    },
                },
            ]);
        },
        [loadMeta, canDeleteRole],
    );

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={() => navigation.goBack()} label="Roles & permissions" />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading roles..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Roles & permissions">
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={canCreateRole ? openCreate : () => Alert.alert('Permission', 'You are not allowed to create roles.')}
                    style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', opacity: canCreateRole ? 1 : 0.5 }}
                >
                    <Lucide name="plus" size={18} color={config.THEME_COLOR} />
                </TouchableOpacity>
            </ScreenHeader>

            <View
                style={{
                    marginTop: 10,
                    marginHorizontal: 15,
                    marginBottom: 12,
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                }}
            >
                <View
                    style={{
                        height: 36,
                        width: 36,
                        borderRadius: 18,
                        backgroundColor: config.THEME_COLOR + '1A',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10,
                    }}
                >
                    <Lucide name="shield-check" size={18} color={config.THEME_COLOR} />
                </View>
                <View style={{ flex: 1 }}>
                    <AppText label="Roles & access control" variant={1} fontSize={14} color={colors.text} />
                    <AppText
                        label="Create role definitions and map their permissions from one place."
                        fontSize={12}
                        color={colors.textSecondary}
                        style={{ marginTop: 2 }}
                    />
                </View>
            </View>

            <View style={{ flexDirection: 'row', marginHorizontal: 15, marginBottom: 10, gap: 8 }}>
                <View style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <AppText label="Roles" fontSize={12} color={colors.textTertiary} />
                    <AppText label={String(roles.length)} variant={1} fontSize={18} color={colors.text} />
                </View>
                <View style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <AppText label="Permissions" fontSize={12} color={colors.textTertiary} />
                    <AppText label={String(permissions.length)} variant={1} fontSize={18} color={colors.text} />
                </View>
                <View style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <AppText label="Visible" fontSize={12} color={colors.textTertiary} />
                    <AppText label={String(filteredRoles.length)} variant={1} fontSize={18} color={colors.text} />
                </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 15, marginBottom: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, paddingHorizontal: 12, height: 46 }}>
                <Lucide name="search" size={16} color={colors.textTertiary} />
                <TextInput
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Search name"
                    placeholderTextColor={colors.placeholder}
                    style={{ flex: 1, marginLeft: 8, color: colors.text, fontFamily: 'FiraSans-Regular', fontSize: 14 }}
                />
                {!!searchText && (
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setSearchText('')}>
                        <Lucide name="x" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>

            <FlashList
                data={filteredRoles}
                estimatedItemSize={86}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 24 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[config.THEME_COLOR]} tintColor={config.THEME_COLOR} />}
                renderItem={({ item }) => (
                    <View style={{ backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                                <AppText label={item.name || item.code || String(item.id)} variant={1} fontSize={15} color={colors.text} />
                                {/* <AppText label={`ID: ${item.id || '-'}`} fontSize={11} color={colors.textTertiary} style={{ marginTop: 2 }} /> */}
                            </View>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                // disabled={!canUpdateRole}
                                onPress={canUpdateRole ? () => openEdit(item) : () => Alert.alert('Permission', 'You are not allowed to update roles.')}
                                style={{ padding: 8, opacity: canUpdateRole ? 1 : 0.45 }}
                            >
                                <Lucide name="pencil" size={16} color={config.THEME_COLOR} />
                            </TouchableOpacity>
                            <TouchableOpacity activeOpacity={0.7} disabled={!canDeleteRole} onPress={() => removeRole(item)} style={{ padding: 8, opacity: canDeleteRole ? 1 : 0.45 }}>
                                <Lucide name="trash-2" size={16} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 6 }}>
                            {(rolePermissionMap[item.id] || []).slice(0, 3).map((label) => (
                                <View
                                    key={`${item.id}-${label}`}
                                    style={{
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        borderRadius: 999,
                                        backgroundColor: colors.surfaceSecondary || '#f1f5f9',
                                    }}
                                >
                                    <AppText label={label} fontSize={11} color={colors.textSecondary} />
                                </View>
                            ))}
                            {(rolePermissionMap[item.id] || []).length > 3 && (
                                <View
                                    style={{
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        borderRadius: 999,
                                        backgroundColor: config.THEME_COLOR + '1A',
                                    }}
                                >
                                    <AppText label={`+${(rolePermissionMap[item.id] || []).length - 3} more`} fontSize={11} color={config.THEME_COLOR} />
                                </View>
                            )}
                            {!rolePermissionMap[item.id]?.length && (
                                <AppText label="No permissions assigned" fontSize={11} color={colors.textTertiary} />
                            )}
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={{ paddingTop: 40, alignItems: 'center' }}>
                        <Lucide name="shield-off" size={46} color={colors.textTertiary} />
                        <AppText label="No roles found" fontSize={15} color={colors.textSecondary} style={{ marginTop: 10 }} />
                    </View>
                }
            />

            <AppModal
                title={editingRoleId ? 'Edit role' : 'Create role'}
                visible={showEditor}
                handleClose={() => setShowEditor(false)}
                onRequestClose={() => setShowEditor(false)}
            >
                <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                    <AppText label="Role name" fontSize={13} color={colors.textSecondary} style={{ marginBottom: 6 }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, height: 48, backgroundColor: colors.inputBackground }}>
                        <Lucide name="shield" size={16} color={colors.textTertiary} style={{ marginRight: 8 }} />
                        <TextInput
                            value={roleName}
                            onChangeText={setRoleName}
                            placeholder="e.g. Cashier, Supervisor"
                            placeholderTextColor={colors.placeholder}
                            editable={editingRoleId ? canUpdateRole : canCreateRole}
                            style={{ flex: 1, color: colors.text, fontFamily: 'FiraSans-Regular', fontSize: 15 }}
                        />
                    </View>

                    <View style={{ marginTop: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <AppText label="Permissions" fontSize={13} color={colors.textSecondary} />
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <AppText label={selectedCountLabel} fontSize={12} color={colors.textTertiary} />
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={toggleSelectAllPermissions}
                                disabled={!canEditRolePermissions || allPermissionIds.length === 0}
                                style={{
                                    marginLeft: 10,
                                    paddingHorizontal: 10,
                                    paddingVertical: 5,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: config.THEME_COLOR + '55',
                                    backgroundColor: allSelected ? config.THEME_COLOR + '1A' : 'transparent',
                                    opacity: !canEditRolePermissions || allPermissionIds.length === 0 ? 0.5 : 1,
                                }}
                            >
                                <AppText
                                    label={allSelected ? 'Clear all' : 'Select all'}
                                    fontSize={11}
                                    color={config.THEME_COLOR}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.inputBackground, paddingHorizontal: 10, height: 42, marginBottom: 10 }}>
                            <Lucide name="search" size={15} color={colors.textTertiary} />
                            <TextInput
                                value={permissionSearch}
                                onChangeText={setPermissionSearch}
                                placeholder="Search permissions..."
                                placeholderTextColor={colors.placeholder}
                                style={{ flex: 1, marginLeft: 8, color: colors.text, fontFamily: 'FiraSans-Regular', fontSize: 13 }}
                            />
                            {!!permissionSearch && (
                                <TouchableOpacity activeOpacity={0.7} onPress={() => setPermissionSearch('')}>
                                    <Lucide name="x" size={15} color={colors.textTertiary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {filteredPermissions.map((perm) => {
                            const id = perm?.id;
                            if (!id) return null;
                            const label = perm?.name || perm?.code || id;
                            const checked = selectedPermissionIds.includes(id);
                            return (
                                <TouchableOpacity
                                    key={id}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        if (editingRoleId && !canUpdateRole) return;
                                        if (!editingRoleId && !canCreateRole) return;
                                        togglePermission(id);
                                    }}
                                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                                >
                                    <Lucide name={checked ? 'square-check' : 'square'} size={20} color={checked ? config.THEME_COLOR : colors.textTertiary} />
                                    <AppText label={label} fontSize={14} color={colors.text} style={{ marginLeft: 10, flex: 1 }} />
                                </TouchableOpacity>
                            );
                        })}
                        {filteredPermissions.length === 0 && (
                            <View style={{ paddingVertical: 14 }}>
                                <AppText label="No permissions match your search." fontSize={12} color={colors.textTertiary} />
                            </View>
                        )}
                    </ScrollView>

                    <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => setShowEditor(false)} style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
                            <AppText label="Cancel" fontSize={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={saveRole}
                            disabled={saving || (editingRoleId ? !canUpdateRole : !canCreateRole)}
                            style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: config.THEME_COLOR, opacity: saving || (editingRoleId ? !canUpdateRole : !canCreateRole) ? 0.6 : 1 }}
                        >
                            {saving ? <ActivityIndicator color="#fff" /> : <AppText label="Save role" fontSize={14} color="#fff" />}
                        </TouchableOpacity>
                    </View>
                </View>
            </AppModal>
        </SafeAreaView>
    );
};

export default Roles;
