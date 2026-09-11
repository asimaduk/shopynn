import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Switch, Alert, Linking, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import styles from './styles';
import { Lucide } from '@react-native-vector-icons/lucide';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { useFocusEffect } from '@react-navigation/native';
import { users as usersApi } from '../../services/api';
import AppModal from '../../components/app_modal';
import { hasPermission } from '../../utils/permissions';

const UserDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const currentUser = useSelector(({ user }) => user);
    const { user: initialUser, userId } = route.params || {};
    const [user, setUser] = useState(initialUser || {});
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [loading, setLoading] = useState(!initialUser && !!userId);
    const formatDateAndTime = (date) => {
        return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' ' + new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    useFocusEffect(
        React.useCallback(() => {
            const id = userId || initialUser?.id;
            if (!id) {
                return;
            }
            let mounted = true;
            const fetchUser = async () => {
                try {
                    setLoading(true);
                    const apiUser = await usersApi.get(id);
                    if (!mounted || !apiUser) return;
                    const merged = {
                        ...initialUser,
                        ...apiUser,
                        name:
                            apiUser.name ||
                            `${apiUser.first_name || ''} ${apiUser.last_name || ''}`.trim() ||
                            initialUser?.name,
                        isActive:
                            apiUser.isActive ??
                            apiUser.is_active ??
                            initialUser?.isActive ??
                            true,
                        lastLoginAt: apiUser.last_login || initialUser?.lastLoginAt,
                        createdAt:
                            formatDateAndTime(apiUser.created_at || apiUser.createdAt) ||
                            initialUser?.createdAt,
                        role: apiUser.role || initialUser?.role,
                        permissions:
                            apiUser.user_permissions ||
                            apiUser.permissions ||
                            initialUser?.permissions ||
                            [],
                    };
                    setUser(merged);
                } catch (err) {
                    const msg =
                        err?.response?.data?.message ||
                        err?.message ||
                        'Failed to load user details.';
                    Alert.alert('Error', msg);
                } finally {
                    if (mounted) {
                        setLoading(false);
                    }
                }
            };
            fetchUser();
            return () => {
                mounted = false;
            };
        }, [userId, initialUser]),
    );

    const backPress = () => navigation.goBack();

    const handleCall = async () => {
        const phone = String(user.phone || '').trim();
        if (!phone) {
            return;
        }
        const url = `tel:${phone}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert('Call', 'This device cannot make phone calls.');
            }
        } catch (err) {
            const msg = err?.message || 'Failed to start the call.';
            Alert.alert('Error', msg);
        }
    };

    const handleToggleActive = (value) => {
        if (!hasPermission(currentUser, 'users.toggle_active')) {
            Alert.alert('Not allowed', 'You do not have permission to change user status.');
            return;
        }
        Alert.alert(
            value ? 'Enable user' : 'Disable user',
            value ? `Enable ${user.name}? They will be able to sign in again.` : `Disable ${user.name}? They will no longer be able to sign in.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: value ? 'Enable' : 'Disable',
                    onPress: async () => {
                        try {
                            await usersApi.toggleActive({ id: user.id, is_active: value });
                            setUser((u) => ({ ...u, isActive: value }));
                        } catch (err) {
                            const msg = err?.response?.data?.message || err?.message || 'Failed to update user.';
                            Alert.alert('Error', msg);
                        }
                    },
                },
            ]
        );
    };

    const handleDelete = () => {
        if (!user?.id) {
            return;
        }
        if (!hasPermission(currentUser, 'users.delete')) {
            Alert.alert('Not allowed', 'You do not have permission to delete users.');
            return;
        }
        setDeleteReason('');
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deleteReason.trim()) {
            Alert.alert('Reason required', 'Please provide a reason for deleting this user.');
            return;
        }
        if (!user?.id) return;
        try {
            setDeleting(true);
            await usersApi.delete(user.id, { reason: deleteReason.trim() });
            setUser((u) => ({ ...u, deleted: true }));
            setShowDeleteModal(false);
            Alert.alert('Deleted', 'User has been deleted.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                'Failed to delete user.';
            Alert.alert('Error', msg);
        } finally {
            setDeleting(false);
        }
    };

    // const handleRoleSelect = async (role) => {
    //     try {
    //         await usersApi.update(user.id, { role });
    //         setUser((u) => ({ ...u, role }));
    //     } catch (err) {
    //         const msg = err?.response?.data?.message || err?.message || 'Failed to update role.';
    //         Alert.alert('Error', msg);
    //     }
    //     setShowRolePicker(false);
    // };

    const DetailRow = ({ label, value, icon }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <View style={{ width: 30, alignItems: 'center' }}>
                <Lucide name={icon} size={16} color={colors.textTertiary} />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
                <AppText label={label} fontSize={12} color={colors.textTertiary} />
                <AppText label={value || '—'} fontSize={15} color={colors.text} />
            </View>
        </View>
    );

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label="User details">
                {!user.deleted && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                            activeOpacity={0.6}
                            disabled={!hasPermission(currentUser, ['users.update', 'users.view'])}
                            onPress={() => {
                                if (!hasPermission(currentUser, ['users.update', 'users.view'])) {
                                    Alert.alert('Not allowed', 'You do not have permission to edit users.');
                                    return;
                                }
                                navigation.navigate('UserForm', { user });
                            }}
                            style={[
                                styles.actionButton,
                                { backgroundColor: colors.surface, marginRight: 8 },
                                !hasPermission(currentUser, ['users.update', 'users.view']) && { opacity: 0.5 },
                            ]}>
                            <Lucide name="pencil" color={config.THEME_COLOR} size={20} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.6}
                            disabled={!hasPermission(currentUser, 'users.delete')}
                            onPress={handleDelete}
                            style={[
                                styles.actionButton,
                                { backgroundColor: colors.surface },
                                !hasPermission(currentUser, 'users.delete') && { opacity: 0.5 },
                            ]}>
                            <Lucide name="trash-2" color={colors.error} size={20} />
                        </TouchableOpacity>
                    </View>
                )}
            </ScreenHeader>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                        <Lucide name="user" size={40} color={colors.textTertiary} />
                    </View>
                    <AppText label={user.name} fontSize={22} fontFamily="FiraSans-SemiBold" color={colors.text} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: user.isActive ? config.GREEN_COLOR : colors.error, marginRight: 6 }} />
                        <AppText label={user.deleted ? 'Deleted' : user.isActive ? 'Active' : 'Disabled'} fontSize={14} color={user.deleted ? colors.error : user.isActive ? config.GREEN_COLOR : colors.error} />
                    </View>
                </View>

                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }}>
                    <DetailRow label="Email" value={user.email} icon="mail" />
                    <DetailRow label="Phone" value={user.phone} icon="phone" />
                    <DetailRow label="Roles" value={user.roles?.map(role => role.name || role.code || role.id).join(',')} icon="shield" />
                    <DetailRow label="Last login" value={user.lastLoginAt} icon="clock" />
                    <DetailRow label="Created" value={user.createdAt} icon="calendar" />
                    {user.phone ? (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={handleCall}
                            style={{
                                marginTop: 12,
                                alignSelf: 'flex-start',
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 999,
                                backgroundColor: config.THEME_COLOR + '15',
                                alignSelf: 'flex-end'
                            }}
                        >
                            <Lucide name="phone" size={16} color={config.THEME_COLOR} style={{ marginRight: 6 }} />
                            <AppText label="Call user" fontSize={13} color={config.THEME_COLOR} />
                        </TouchableOpacity>
                    ) : null}
                </View>

                {!user.deleted && 
                    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <AppText label="Account status" fontSize={14} variant={1} color={colors.text} />
                            <Switch
                                value={user.isActive !== false}
                                onValueChange={handleToggleActive}
                                trackColor={{ false: colors.border, true: config.THEME_COLOR + '80' }}
                                thumbColor={user.isActive ? config.THEME_COLOR : colors.textTertiary}
                            />
                        </View>
                        <AppText label={user.isActive ? 'User can sign in.' : 'User is disabled and cannot sign in.'} fontSize={12} color={colors.textSecondary} />
                    </View>
                }
                {/* <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }}>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setShowRolePicker(true)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Lucide name="shield" size={20} color={config.THEME_COLOR} />
                            <AppText label="Assign role" fontSize={14} variant={1} color={colors.text} style={{ marginLeft: 10 }} />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <AppText label={user.role || 'Select'} fontSize={14} color={colors.textSecondary} />
                            <Lucide name="chevron-right" size={18} color={colors.textTertiary} style={{ marginLeft: 4 }} />
                        </View>
                    </TouchableOpacity>
                </View> */}

                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }}>
                    <AppText label="Permissions" fontSize={14} variant={1} color={colors.text} style={{ marginBottom: 12 }} />
                    {user.permissions?.length > 0 ? (
                        user.permissions.map((perm, i) => (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <Lucide name="circle-check" size={16} color={config.GREEN_COLOR} style={{ marginRight: 8 }} />
                                <AppText label={perm.name} fontSize={13} color={colors.textSecondary} />
                            </View>
                        ))
                    ) : (
                        <AppText label="No specific permissions assigned." fontSize={13} color={colors.textTertiary} />
                    )}
                    {/* {!user.deleted && 
                        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('UserForm', { user })} style={{ marginTop: 12 }}>
                            <AppText label="Edit permissions →" fontSize={13} color={config.THEME_COLOR} />
                        </TouchableOpacity>
                    } */}
                </View>
            </ScrollView>

            <AppModal
                title="Delete user"
                visible={showDeleteModal}
                handleClose={() => setShowDeleteModal(false)}
                onRequestClose={() => setShowDeleteModal(false)}
            >
                <View style={{ padding: 16, paddingBottom: 20 }}>
                    <AppText
                        label="This action will permanently delete this user. This cannot be undone."
                        fontSize={13}
                        color={colors.error}
                        style={{ marginBottom: 12 }}
                    />
                    <AppText
                        label="Reason for deletion *"
                        fontSize={14}
                        variant={1}
                        color={colors.text}
                        style={{ marginBottom: 6 }}
                    />
                    <View
                        style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            minHeight: 80,
                        }}
                    >
                        <TextInput
                            style={{ color: colors.text, fontSize: 14 }}
                            value={deleteReason}
                            onChangeText={setDeleteReason}
                            placeholder="Enter a short reason (e.g. left company, duplicate account)"
                            placeholderTextColor={colors.placeholder}
                            multiline
                        />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowDeleteModal(false)}
                            style={{ paddingVertical: 8, paddingHorizontal: 14, marginRight: 8 }}
                        >
                            <AppText label="Cancel" fontSize={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={confirmDelete}
                            disabled={deleting}
                            style={{
                                paddingVertical: 8,
                                paddingHorizontal: 16,
                                borderRadius: 8,
                                backgroundColor: colors.error,
                                opacity: deleting ? 0.7 : 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                            }}
                        >
                            <Lucide name="trash-2" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <AppText
                                label={deleting ? 'Deleting...' : 'Delete user'}
                                fontSize={14}
                                color="#fff"
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </AppModal>
        </SafeAreaView>
    );
};

export default UserDetails;
