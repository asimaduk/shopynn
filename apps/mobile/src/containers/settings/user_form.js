import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import config from '../../config';
import AppModal from '../../components/app_modal';
import useTheme from '../../hooks/useTheme';
import { users as usersApi, roles as rolesApi, warehouses as warehousesApi, normalizeList } from '../../services/api';

function normId(v) {
    if (v == null || v === '') return null;
    return String(v);
}

const InputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default', secureTextEntry = false, icon, colors, inputStyles }) => (
    <View style={inputStyles.inputContainer}>
        <AppText label={label} fontSize={14} variant={1} style={[inputStyles.inputLabel, { color: colors.text }]} />
        <View style={[inputStyles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            {icon && <Lucide name={icon} size={18} color={colors.textTertiary} style={{ marginRight: 10 }} />}
            <TextInput
                style={[inputStyles.input, { color: colors.text }]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.placeholder}
                keyboardType={keyboardType}
                secureTextEntry={secureTextEntry}
            />
        </View>
    </View>
);

const UserForm = ({ navigation, route }) => {
    const { colors } = useTheme();
    const editUser = route.params?.user;
    const isEdit = !!editUser;

    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: '',
        roleId: '',
        isActive: true,
    });
    const [loading, setLoading] = useState(false);
    const [showRolePicker, setShowRolePicker] = useState(false);
    const [availableRoles, setAvailableRoles] = useState([]);
    const [rolePermissions, setRolePermissions] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    const [showWarehousePicker, setShowWarehousePicker] = useState(false);
    const [warehouseSearch, setWarehouseSearch] = useState('');
    const editBaselineRef = useRef(null);

    useEffect(() => {
        if (!(isEdit && editUser)) {
            editBaselineRef.current = null;
            return;
        }
        const existingFirst = editUser.first_name || editUser.firstName;
        const existingLast = editUser.last_name || editUser.lastName;
        let firstName = existingFirst || '';
        let lastName = existingLast || '';
        if (!firstName && editUser.name) {
            const parts = String(editUser.name).trim().split(' ');
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ');
        }
        const phoneDigitsBaseline = String(editUser.phone || '').replace(/\D/g, '').slice(0, 10);
        const existingBranch = editUser.branch || editUser.warehouse_name;
        if (existingBranch) {
            setSelectedWarehouse({ id: editUser.warehouse_id, name: existingBranch });
        }
        editBaselineRef.current = {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: (editUser.email || '').trim().toLowerCase(),
            phone: phoneDigitsBaseline,
            is_active: editUser.isActive !== false,
            warehouse_id: normId(editUser.warehouse_id),
            role_id: editUser?.roles?.length > 0 ? normId(editUser.roles[0].id) : null,
        };
        setForm({
            firstName,
            lastName,
            email: editUser.email || '',
            phone: phoneDigitsBaseline,
            role: editUser?.roles?.length > 0 ? editUser.roles[0].name : '',
            roleId: editUser?.roles?.length > 0 ? editUser.roles[0].id : null,
            isActive: editUser.isActive !== false,
        });
    }, [editUser, isEdit]);

    const fetchRolePermissions = useCallback(async (roleId) => {
        if (!roleId) {
            setRolePermissions([]);
            return;
        }
        try {
            const raw = await rolesApi.getPermissions(roleId);
            const list = normalizeList(raw) || raw || [];
            setRolePermissions(Array.isArray(list) ? list : []);
        } catch (_) {
            setRolePermissions([]);
        }
    }, []);

    useEffect(() => {
        if (form.roleId) {
            fetchRolePermissions(form.roleId);
        } else {
            setRolePermissions([]);
        }
    }, [form.roleId, fetchRolePermissions]);

    useEffect(() => {
        let mounted = true;
        const loadMeta = async () => {
            try {
                const [rawRoles, rawWarehouses] = await Promise.all([
                    rolesApi.list(),
                    warehousesApi.list(),
                ]);
                if (!mounted) return;
                const roleList = normalizeList(rawRoles) || rawRoles || [];
                const whList = normalizeList(rawWarehouses) || rawWarehouses || [];
                setAvailableRoles(Array.isArray(roleList) ? roleList : []);
                setWarehouses(Array.isArray(whList) ? whList : []);
            } catch (_) {
                if (!mounted) return;
                setAvailableRoles([]);
                setWarehouses([]);
            }
        };
        loadMeta();
        return () => {
            mounted = false;
        };
    }, []);

    const handleChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handlePhoneChange = useCallback((v) => {
        handleChange('phone', v.replace(/\D/g, '').slice(0, 10));
    }, []);
    const handleEmailChange = useCallback((v) => {
        handleChange('email', v);
    }, []);

    const handleSave = () => {
        if (!form.firstName.trim() || !form.lastName.trim()) {
            Alert.alert('Required', 'Please enter the user\'s first and last name.');
            return;
        }
        if (!form.email.trim()) {
            Alert.alert('Email', 'Please enter an email address.');
            return;
        }
        const phoneDigits = String(form.phone || '').replace(/\D/g, '').slice(0, 10);
        if (phoneDigits.length !== 10) {
            Alert.alert('Phone', 'Please enter a valid 10-digit phone number.');
            return;
        }

        const isAdminRole = (form.role || '').toLowerCase() === 'admin';
        if (!isAdminRole && !selectedWarehouse?.name) {
            Alert.alert('Warehouse', 'Please select a warehouse / branch for this user.');
            return;
        }

        const resolvedRoleId =
            form.roleId ||
            availableRoles.find(
                (r) => (r.name || r.code || '').toLowerCase() === (form.role || '').toLowerCase(),
            )?.id;
        if (!resolvedRoleId) {
            Alert.alert('Role', 'Please select a role for this user.');
            return;
        }

        const fullBody = {
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
            phone: phoneDigits,
            email: form.email.trim().toLowerCase(),
            role_id: resolvedRoleId,
            is_active: form.isActive,
        };
        if (selectedWarehouse?.name) {
            fullBody.warehouse_id = selectedWarehouse.id;
        }

        let updatePayload = null;
        if (isEdit) {
            const baseline = editBaselineRef.current;
            const wCur = normId(selectedWarehouse?.id);
            const rCur = normId(resolvedRoleId);
            const emailCur = form.email.trim().toLowerCase();
            if (baseline) {
                updatePayload = { id: editUser.id };
                if (form.firstName.trim() !== baseline.first_name) updatePayload.first_name = form.firstName.trim();
                if (form.lastName.trim() !== baseline.last_name) updatePayload.last_name = form.lastName.trim();
                if (emailCur !== baseline.email) updatePayload.email = emailCur;
                if (phoneDigits !== baseline.phone) updatePayload.phone = phoneDigits;
                if (form.isActive !== baseline.is_active) updatePayload.is_active = form.isActive;
                if (wCur !== baseline.warehouse_id) updatePayload.warehouse_id = wCur;
                if (rCur !== baseline.role_id) updatePayload.role_id = resolvedRoleId;
            } else {
                updatePayload = { ...fullBody, id: editUser.id };
            }
            const changedKeys = Object.keys(updatePayload).filter((k) => k !== 'id');
            if (changedKeys.length === 0) {
                Alert.alert('No changes', 'No changes to save.');
                return;
            }
        }

        const performSave = async () => {
            setLoading(true);
            try {
                if (isEdit) {
                    await usersApi.update(editUser.id, updatePayload);
                } else {
                    await usersApi.create({ ...fullBody, registration_method: 'manual' });
                }
                Alert.alert('Success', `User ${isEdit ? 'updated' : 'created'} successfully.`, [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            } catch (err) {
                const msg =
                    err?.response?.data?.message ||
                    err?.message ||
                    `Failed to ${isEdit ? 'update' : 'create'} user.`;
                Alert.alert('Error', msg);
            } finally {
                setLoading(false);
            }
        };

        Alert.alert(
            isEdit ? 'Update user' : 'Create user',
            isEdit
                ? 'Are you sure you want to update this user?'
                : 'Are you sure you want to create this user?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isEdit ? 'Update' : 'Create',
                    onPress: performSave,
                },
            ],
        );
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label={isEdit ? 'Edit user' : 'Add user'} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={[styles.formSection, { backgroundColor: colors.surface }]}>
                        <View style={[styles.inputContainer, { flexDirection: 'row', gap: 12 }]}>
                            <View style={{ flex: 1 }}>
                                <AppText label="First name *" fontSize={14} variant={1} style={[styles.inputLabel, { color: colors.text }]} />
                                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                    <Lucide name="user" size={18} color={colors.textTertiary} style={{ marginRight: 10 }} />
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        value={form.firstName}
                                        onChangeText={(v) => handleChange('firstName', v)}
                                        placeholder="e.g. John"
                                        placeholderTextColor={colors.placeholder}
                                    />
                                </View>
                            </View>
                            <View style={{ flex: 1 }}>
                                <AppText label="Last name *" fontSize={14} variant={1} style={[styles.inputLabel, { color: colors.text }]} />
                                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        value={form.lastName}
                                        onChangeText={(v) => handleChange('lastName', v)}
                                        placeholder="e.g. Doe"
                                        placeholderTextColor={colors.placeholder}
                                    />
                                </View>
                            </View>
                        </View>
                        <InputField
                            colors={colors}
                            inputStyles={styles}
                            label="Phone *"
                            value={form.phone}
                            onChangeText={handlePhoneChange}
                            placeholder="e.g. 0241234567"
                            keyboardType="phone-pad"
                            icon="phone"
                        />
                        <InputField
                            colors={colors}
                            inputStyles={styles}
                            label="Email *"
                            value={form.email}
                            onChangeText={handleEmailChange}
                            placeholder="user@example.com"
                            keyboardType="email-address"
                            icon="mail"
                        />

                        <View style={styles.inputContainer}>
                            <AppText label="Role" fontSize={14} variant={1} style={[styles.inputLabel, { color: colors.text }]} />
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => setShowRolePicker(true)}
                                style={[styles.inputWrapper, styles.pickerTouch, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                <Lucide name="shield" size={18} color={colors.textTertiary} style={{ marginRight: 10 }} />
                                <AppText label={form.role || 'Select role'} fontSize={16} color={form.role ? colors.text : colors.placeholder} style={{ flex: 1 }} />
                                <Lucide name="chevron-down" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>

                        {form.role && form.role.toLowerCase() !== 'admin' && (
                            <View style={styles.inputContainer}>
                                <AppText label="Branch / Store / Warehouse" fontSize={14} variant={1} style={[styles.inputLabel, { color: colors.text }]} />
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => setShowWarehousePicker(true)}
                                    style={[styles.inputWrapper, styles.pickerTouch, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                    <Lucide name="store" size={18} color={colors.textTertiary} style={{ marginRight: 10 }} />
                                    <AppText
                                        label={selectedWarehouse?.name || 'Select warehouse'}
                                        fontSize={16}
                                        color={selectedWarehouse ? colors.text : colors.placeholder}
                                        style={{ flex: 1 }}
                                    />
                                    <Lucide name="chevron-down" size={20} color={colors.textTertiary} />
                                </TouchableOpacity>
                            </View>
                        )}

                    <View style={styles.inputContainer}>
                        <AppText label="Role permissions" fontSize={14} variant={1} style={[styles.inputLabel, { color: colors.text }]} />
                        <View
                            style={[
                                {
                                    backgroundColor: colors.inputBackground,
                                    borderColor: colors.border,
                                    borderWidth: 1,
                                    borderRadius: 8,
                                    flexDirection: 'row',
                                    alignItems: 'flex-start',
                                    paddingHorizontal: 14,
                                    paddingVertical: 10,
                                },
                            ]}
                        >
                            <Lucide name="key" size={18} color={colors.textTertiary} style={{ marginRight: 10, marginTop: 2 }} />
                            <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
                                {rolePermissions.length > 0 ? (
                                    rolePermissions.map((perm) => (
                                        <AppText
                                            key={perm.id || perm.code || perm.name}
                                            label={perm.name || perm.code}
                                            fontSize={13}
                                            color={colors.textSecondary}
                                            style={{ marginBottom: 6, marginRight: 10 }}
                                        />
                                    ))
                                ) : (
                                    <AppText
                                        label={form.role ? 'No permissions loaded for this role.' : 'Select a role to view its permissions.'}
                                        fontSize={13}
                                        color={colors.placeholder}
                                    />
                                )}
                            </View>
                        </View>
                        <AppText
                            label="Permissions are managed from the Roles & Permissions screen."
                            fontSize={12}
                            color={colors.textTertiary}
                            style={{ marginTop: 8 }}
                        />
                    </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
                            <AppText label="Active (can sign in)" fontSize={14} variant={1} color={colors.text} />
                            <Switch value={form.isActive} onValueChange={(v) => handleChange('isActive', v)} trackColor={{ false: colors.border, true: config.THEME_COLOR + '80' }} thumbColor={form.isActive ? config.THEME_COLOR : colors.textTertiary} />
                        </View>
                    </View>

                    <TouchableOpacity activeOpacity={0.8} onPress={handleSave} disabled={loading} style={[styles.submitBtn, { backgroundColor: config.THEME_COLOR }, loading && { opacity: 0.7 }]}>
                        {loading ? <ActivityIndicator color="#fff" /> : <AppText label={isEdit ? 'Save changes' : 'Create user'} fontSize={16} variant={1} color="#fff" />}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            <AppModal title="Assign role" visible={showRolePicker} handleClose={() => setShowRolePicker(false)} onRequestClose={() => setShowRolePicker(false)}>
                <View style={{ padding: 16, paddingBottom: 24 }}>
                    {availableRoles.map((role) => {
                        const roleName = role.name || role.code || String(role.id);
                        return (
                            <TouchableOpacity
                                key={role.id || roleName}
                                activeOpacity={0.7}
                                onPress={() => {
                                    setForm((prev) => ({ ...prev, role: roleName, roleId: role.id || '' }));
                                    fetchRolePermissions(role.id || '');
                                    setShowRolePicker(false);
                                }}
                                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                                <Lucide name="shield" size={18} color={config.THEME_COLOR} />
                                <AppText label={roleName} fontSize={15} color={colors.text} style={{ marginLeft: 12 }} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </AppModal>

            {/* Role creation and direct permission editing have been moved to a dedicated roles screen. */}

            <AppModal
                title="Select warehouse"
                visible={showWarehousePicker}
                handleClose={() => setShowWarehousePicker(false)}
                onRequestClose={() => setShowWarehousePicker(false)}
            >
                <View style={{ padding: 16, paddingBottom: 0 }}>
                    <TextInput
                        placeholder="Search warehouses..."
                        placeholderTextColor={colors.placeholder}
                        value={warehouseSearch}
                        onChangeText={setWarehouseSearch}
                        style={[
                            styles.inputWrapper,
                            {
                                height: 44,
                                borderRadius: 10,
                                borderColor: colors.border,
                                backgroundColor: colors.inputBackground,
                                paddingHorizontal: 14,
                            },
                        ]}
                    />
                    <ScrollView style={{ maxHeight: 260, marginTop: 10 }}>
                        {warehouses
                            .filter(
                                (w) =>
                                    !warehouseSearch.trim() ||
                                    (w.name &&
                                        w.name
                                            .toLowerCase()
                                            .includes(warehouseSearch.toLowerCase())),
                            )
                            .map((w) => (
                                <TouchableOpacity
                                    key={w.id || w.name}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        setSelectedWarehouse({ id: w.id, name: w.name });
                                        setShowWarehousePicker(false);
                                        setWarehouseSearch('');
                                    }}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingVertical: 14,
                                        borderBottomWidth: 1,
                                        borderBottomColor: colors.border,
                                    }}
                                >
                                    <Lucide
                                        name="store"
                                        size={18}
                                        color={colors.textTertiary}
                                    />
                                    <AppText
                                        label={w.name}
                                        style={{ flex: 1, marginLeft: 12 }}
                                        color={colors.text}
                                    />
                                </TouchableOpacity>
                            ))}
                    </ScrollView>
                </View>
            </AppModal>
        </SafeAreaView>
    );
};

const styles = {
    container: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },
    formSection: { borderRadius: 12, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    inputContainer: { marginBottom: 18 },
    inputLabel: { marginBottom: 8 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, height: 50 },
    input: { flex: 1, fontFamily: 'FiraSans-Regular', fontSize: 16 },
    pickerTouch: { justifyContent: 'space-between' },
    submitBtn: { height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
};

export default UserForm;
