import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    Alert,
    ScrollView,
    StyleSheet,
} from 'react-native';
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

const roleInitials = (name) => {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length) return 'R';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
};

/** Built-in B2C portal role — not editable/deletable from Roles UI. */
const isProtectedSystemRole = (role) =>
    String(role?.name || role?.code || '')
        .trim()
        .toLowerCase() === 'customer';

const moduleFromPermission = (perm) => {
    const code = String(perm?.code || '').trim();
    if (code.includes('.')) {
        return code
            .split('.')[0]
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    const name = String(perm?.name || '').trim();
    if (!name) return 'Other';
    const first = name.split(/\s+/)[0];
    return first.charAt(0).toUpperCase() + first.slice(1);
};

const summarizeRolePermissions = (list = []) => {
    const modules = [];
    const seen = new Set();
    list.forEach((perm) => {
        const mod = moduleFromPermission(perm);
        if (!mod || seen.has(mod)) return;
        seen.add(mod);
        modules.push(mod);
    });
    return { count: list.length, modules };
};

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
                    return [roleId, summarizeRolePermissions(list)];
                } catch (_) {
                    return [roleId, { count: 0, modules: [] }];
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

    const loadMeta = useCallback(async () => {
        try {
            const [rawRoles, rawPermissions] = await Promise.all([rolesApi.list(), permissionsApi.list()]);
            const roleList = Array.isArray(normalizeList(rawRoles)) ? normalizeList(rawRoles) : [];
            setRoles(roleList);
            setPermissions(Array.isArray(normalizeList(rawPermissions)) ? normalizeList(rawPermissions) : []);
            await preloadRolePermissionMap(roleList);
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
            if (isProtectedSystemRole(role)) {
                Alert.alert(
                    'System role',
                    'The Customer role is managed by Shopynn and cannot be edited.',
                );
                return;
            }
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
        () => `${selectedPermissionIds.length} of ${permissions.length} selected`,
        [selectedPermissionIds.length, permissions.length],
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
            const summary = rolePermissionMap[role?.id];
            const modules = (summary?.modules || []).join(' ').toLowerCase();
            return label.includes(query) || id.includes(query) || modules.includes(query);
        });
    }, [roles, searchText, rolePermissionMap]);

    const permissionGroups = useMemo(() => {
        const query = permissionSearch.trim().toLowerCase();
        const filtered = !query
            ? permissions
            : permissions.filter((perm) => {
                  const label = String(perm?.name || perm?.code || perm?.id || '').toLowerCase();
                  return label.includes(query);
              });
        const groups = new Map();
        filtered.forEach((perm) => {
            const key = moduleFromPermission(perm);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(perm);
        });
        return Array.from(groups.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([title, items]) => ({
                title,
                items: items.sort((a, b) =>
                    String(a?.name || a?.code || '').localeCompare(String(b?.name || b?.code || '')),
                ),
            }));
    }, [permissions, permissionSearch]);

    const allPermissionIds = useMemo(
        () => permissions.map((perm) => perm?.id).filter(Boolean),
        [permissions],
    );
    const canEditRolePermissions = editingRoleId ? canUpdateRole : canCreateRole;
    const allSelected =
        allPermissionIds.length > 0 && allPermissionIds.every((id) => selectedPermissionIds.includes(id));

    const toggleSelectAllPermissions = useCallback(() => {
        if (!canEditRolePermissions) return;
        setSelectedPermissionIds((prev) => {
            const currentlyAllSelected =
                allPermissionIds.length > 0 && allPermissionIds.every((id) => prev.includes(id));
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
            if (isProtectedSystemRole(role)) {
                Alert.alert(
                    'System role',
                    'The Customer role is managed by Shopynn and cannot be deleted.',
                );
                return;
            }
            if (!canDeleteRole) {
                Alert.alert('Permission', 'You are not allowed to delete roles.');
                return;
            }
            const roleId = role?.id;
            if (!roleId) return;
            Alert.alert('Delete role', `Delete "${role?.name || 'this role'}"? This cannot be undone.`, [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await rolesApi.delete(roleId);
                            if (response?.status === 400) {
                                Alert.alert('Error', response?.data?.message || 'Could not delete role.');
                                return;
                            }
                            await loadMeta();
                        } catch (err) {
                            const msg = err?.response?.data?.message || err?.message || 'Failed to delete role.';
                            Alert.alert('Error', msg);
                        }
                    },
                },
            ]);
        },
        [loadMeta, canDeleteRole],
    );

    const searching = searchText.trim().length > 0;

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={() => navigation.goBack()} label="Roles & permissions" />
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading roles..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Roles & permissions">
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={
                        canCreateRole
                            ? openCreate
                            : () => Alert.alert('Permission', 'You are not allowed to create roles.')
                    }
                    style={[
                        styles.headerBtn,
                        { backgroundColor: colors.surface, opacity: canCreateRole ? 1 : 0.5 },
                    ]}
                >
                    <Lucide name="plus" size={18} color={config.THEME_COLOR} />
                </TouchableOpacity>
            </ScreenHeader>

            <View style={styles.summaryRow}>
                <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="shield" size={14} color={config.THEME_COLOR} />
                    <AppText
                        label={`${roles.length} role${roles.length === 1 ? '' : 's'}`}
                        fontSize={13}
                        variant={1}
                        color={colors.text}
                        style={{ marginLeft: 6 }}
                    />
                </View>
                <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="key-round" size={14} color={colors.textSecondary} />
                    <AppText
                        label={`${permissions.length} permissions`}
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginLeft: 6 }}
                    />
                </View>
                {searching ? (
                    <View style={[styles.summaryChip, { backgroundColor: `${config.THEME_COLOR}14`, borderColor: `${config.THEME_COLOR}33` }]}>
                        <AppText
                            label={`${filteredRoles.length} match${filteredRoles.length === 1 ? '' : 'es'}`}
                            fontSize={13}
                            color={config.THEME_COLOR}
                            variant={1}
                        />
                    </View>
                ) : null}
            </View>

            <View
                style={[
                    styles.searchWrap,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
            >
                <Lucide name="search" size={16} color={colors.textTertiary} />
                <TextInput
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Search roles or modules"
                    placeholderTextColor={colors.placeholder}
                    style={[styles.searchInput, { color: colors.text }]}
                />
                {!!searchText && (
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setSearchText('')}>
                        <Lucide name="x" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>

            <FlashList
                data={filteredRoles}
                estimatedItemSize={96}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[config.THEME_COLOR]}
                        tintColor={config.THEME_COLOR}
                    />
                }
                renderItem={({ item }) => {
                    const title = item.name || item.code || String(item.id);
                    const summary = rolePermissionMap[item.id] || { count: 0, modules: [] };
                    const isFullAccess =
                        permissions.length > 0 && summary.count >= permissions.length;
                    const modules = summary.modules.slice(0, 3);
                    const moreModules = Math.max(0, summary.modules.length - modules.length);
                    const isProtected = isProtectedSystemRole(item);
                    const CardWrapper = isProtected ? View : TouchableOpacity;
                    const cardPressProps = isProtected
                        ? {}
                        : {
                              activeOpacity: 0.75,
                              onPress: canUpdateRole
                                  ? () => openEdit(item)
                                  : () => Alert.alert('Permission', 'You are not allowed to update roles.'),
                          };

                    return (
                        <CardWrapper
                            {...cardPressProps}
                            style={[styles.roleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                            <View style={styles.roleTop}>
                                <View style={[styles.avatar, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                                    <AppText label={roleInitials(title)} variant={1} fontSize={14} color={config.THEME_COLOR} />
                                </View>
                                <View style={styles.roleMain}>
                                    <View style={styles.roleTitleRow}>
                                        <AppText label={title} variant={1} fontSize={16} color={colors.text} numberOfLines={1} style={{ flexShrink: 1 }} />
                                        {isProtected ? (
                                            <View style={[styles.systemBadge, { backgroundColor: colors.surfaceSecondary }]}>
                                                <Lucide name="lock" size={11} color={colors.textSecondary} />
                                                <AppText
                                                    label="System"
                                                    fontSize={11}
                                                    color={colors.textSecondary}
                                                    variant={1}
                                                    style={{ marginLeft: 4 }}
                                                />
                                            </View>
                                        ) : null}
                                    </View>
                                    <AppText
                                        label={
                                            isProtected
                                                ? 'Managed by Shopynn · not editable'
                                                : isFullAccess
                                                  ? `Full access · ${summary.count} permissions`
                                                  : `${summary.count} permission${summary.count === 1 ? '' : 's'}`
                                        }
                                        fontSize={12}
                                        color={isFullAccess && !isProtected ? config.THEME_COLOR : colors.textSecondary}
                                        style={{ marginTop: 2 }}
                                    />
                                </View>
                                {isProtected ? (
                                    <View style={[styles.iconBtn, { opacity: 0.7 }]}>
                                        <Lucide name="lock" size={16} color={colors.textTertiary} />
                                    </View>
                                ) : (
                                    <>
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            onPress={(e) => {
                                                e?.stopPropagation?.();
                                                if (canUpdateRole) openEdit(item);
                                                else Alert.alert('Permission', 'You are not allowed to update roles.');
                                            }}
                                            style={[styles.iconBtn, { opacity: canUpdateRole ? 1 : 0.4 }]}
                                        >
                                            <Lucide name="pencil" size={16} color={config.THEME_COLOR} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            disabled={!canDeleteRole}
                                            onPress={(e) => {
                                                e?.stopPropagation?.();
                                                removeRole(item);
                                            }}
                                            style={[styles.iconBtn, { opacity: canDeleteRole ? 1 : 0.4 }]}
                                        >
                                            <Lucide name="trash-2" size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>

                            {modules.length > 0 ? (
                                <View style={styles.chipRow}>
                                    {modules.map((mod) => (
                                        <View
                                            key={`${item.id}-${mod}`}
                                            style={[styles.chip, { backgroundColor: colors.surfaceSecondary || colors.background }]}
                                        >
                                            <AppText label={mod} fontSize={11} color={colors.textSecondary} />
                                        </View>
                                    ))}
                                    {moreModules > 0 ? (
                                        <View style={[styles.chip, { backgroundColor: `${config.THEME_COLOR}14` }]}>
                                            <AppText label={`+${moreModules} more`} fontSize={11} color={config.THEME_COLOR} />
                                        </View>
                                    ) : null}
                                </View>
                            ) : (
                                <AppText
                                    label="No permissions assigned"
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 10 }}
                                />
                            )}
                        </CardWrapper>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSecondary }]}>
                            <Lucide name="shield-off" size={28} color={colors.textTertiary} />
                        </View>
                        <AppText
                            label={searching ? 'No roles match your search' : 'No roles yet'}
                            variant={1}
                            fontSize={16}
                            color={colors.text}
                            style={{ marginTop: 12 }}
                        />
                        <AppText
                            label={
                                searching
                                    ? 'Try another name or module'
                                    : 'Create a role to control what staff can access'
                            }
                            fontSize={13}
                            color={colors.textTertiary}
                            style={{ marginTop: 4, textAlign: 'center' }}
                        />
                        {!searching && canCreateRole ? (
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={openCreate}
                                style={[styles.emptyCta, { backgroundColor: config.THEME_COLOR }]}
                            >
                                <Lucide name="plus" size={16} color="#fff" />
                                <AppText label="Create role" color="#fff" variant={1} fontSize={14} style={{ marginLeft: 6 }} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                }
            />

            <AppModal
                title={editingRoleId ? 'Edit role' : 'Create role'}
                visible={showEditor}
                handleClose={() => setShowEditor(false)}
                onRequestClose={() => setShowEditor(false)}
            >
                <View style={styles.editor}>
                    <AppText label="Role name" fontSize={13} color={colors.textSecondary} style={{ marginBottom: 6 }} />
                    <View
                        style={[
                            styles.inputRow,
                            { borderColor: colors.border, backgroundColor: colors.inputBackground },
                        ]}
                    >
                        <Lucide name="shield" size={16} color={colors.textTertiary} style={{ marginRight: 8 }} />
                        <TextInput
                            value={roleName}
                            onChangeText={setRoleName}
                            placeholder="e.g. Cashier, Supervisor"
                            placeholderTextColor={colors.placeholder}
                            editable={editingRoleId ? canUpdateRole : canCreateRole}
                            style={[styles.input, { color: colors.text }]}
                        />
                    </View>

                    <View style={styles.permHeader}>
                        <AppText label="Permissions" fontSize={13} color={colors.textSecondary} />
                        <View style={styles.permHeaderRight}>
                            <AppText label={selectedCountLabel} fontSize={12} color={colors.textTertiary} />
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={toggleSelectAllPermissions}
                                disabled={!canEditRolePermissions || allPermissionIds.length === 0}
                                style={[
                                    styles.selectAllBtn,
                                    {
                                        borderColor: `${config.THEME_COLOR}55`,
                                        backgroundColor: allSelected ? `${config.THEME_COLOR}1A` : 'transparent',
                                        opacity: !canEditRolePermissions || allPermissionIds.length === 0 ? 0.5 : 1,
                                    },
                                ]}
                            >
                                <AppText
                                    label={allSelected ? 'Clear all' : 'Select all'}
                                    fontSize={11}
                                    color={config.THEME_COLOR}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
                        <View
                            style={[
                                styles.permSearch,
                                { borderColor: colors.border, backgroundColor: colors.inputBackground },
                            ]}
                        >
                            <Lucide name="search" size={15} color={colors.textTertiary} />
                            <TextInput
                                value={permissionSearch}
                                onChangeText={setPermissionSearch}
                                placeholder="Search permissions…"
                                placeholderTextColor={colors.placeholder}
                                style={[styles.searchInput, { color: colors.text, marginLeft: 8 }]}
                            />
                            {!!permissionSearch && (
                                <TouchableOpacity activeOpacity={0.7} onPress={() => setPermissionSearch('')}>
                                    <Lucide name="x" size={15} color={colors.textTertiary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {permissionGroups.map((group) => (
                            <View key={group.title} style={{ marginBottom: 8 }}>
                                <AppText
                                    label={group.title}
                                    fontSize={11}
                                    variant={1}
                                    color={colors.textTertiary}
                                    style={styles.groupLabel}
                                />
                                {group.items.map((perm) => {
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
                                            style={[styles.permRow, { borderBottomColor: colors.border }]}
                                        >
                                            <Lucide
                                                name={checked ? 'square-check' : 'square'}
                                                size={20}
                                                color={checked ? config.THEME_COLOR : colors.textTertiary}
                                            />
                                            <AppText
                                                label={label}
                                                fontSize={14}
                                                color={colors.text}
                                                style={{ marginLeft: 10, flex: 1 }}
                                            />
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}
                        {permissionGroups.length === 0 && (
                            <View style={{ paddingVertical: 14 }}>
                                <AppText
                                    label="No permissions match your search."
                                    fontSize={12}
                                    color={colors.textTertiary}
                                />
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.editorActions}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowEditor(false)}
                            style={{ paddingVertical: 10, paddingHorizontal: 14 }}
                        >
                            <AppText label="Cancel" fontSize={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={saveRole}
                            disabled={saving || (editingRoleId ? !canUpdateRole : !canCreateRole)}
                            style={[
                                styles.saveBtn,
                                {
                                    backgroundColor: config.THEME_COLOR,
                                    opacity: saving || (editingRoleId ? !canUpdateRole : !canCreateRole) ? 0.6 : 1,
                                },
                            ]}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <AppText label="Save role" fontSize={14} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </AppModal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
        marginBottom: 12,
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
    listContent: { paddingHorizontal: 15, paddingBottom: 28 },
    roleCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 14,
        marginBottom: 10,
    },
    roleTop: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    roleMain: { flex: 1, minWidth: 0, marginRight: 4 },
    roleTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    systemBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
    },
    iconBtn: { padding: 8 },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 12,
        marginLeft: 52,
    },
    chip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
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
    editor: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 48,
    },
    input: { flex: 1, fontFamily: 'FiraSans-Regular', fontSize: 15 },
    permHeader: {
        marginTop: 14,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    permHeaderRight: { flexDirection: 'row', alignItems: 'center' },
    selectAllBtn: {
        marginLeft: 10,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
    permSearch: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 42,
        marginBottom: 10,
    },
    groupLabel: {
        marginTop: 8,
        marginBottom: 4,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    permRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 11,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    editorActions: {
        marginTop: 12,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    saveBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        minWidth: 96,
        alignItems: 'center',
    },
});

export default Roles;
