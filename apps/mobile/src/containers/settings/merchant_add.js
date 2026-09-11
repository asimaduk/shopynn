import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    FlatList,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { merchants as merchantsApi } from '../../services/api';
import { hasPermission } from '../../utils/permissions';

function eligibleUserLabel(u) {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    const email = u.email?.trim() || '';
    const phone = u.phone?.trim() || '';
    if (name && email) return `${name} · ${email}`;
    if (name && phone) return `${name} · ${phone}`;
    if (name) return name;
    if (email) return email;
    if (phone) return phone;
    return 'User';
}

function matchesUserSearch(u, queryLower) {
    if (!queryLower) return true;
    const blob = [
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        [u.first_name, u.last_name].filter(Boolean).join(' '),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return blob.includes(queryLower);
}

/**
 * Full-screen flow to add a merchant partner (existing tenant user or new user).
 * Requires merchants.view (same as admin merchant list / promote API).
 */
const MerchantAdd = ({ navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const user = useSelector(({ user: u }) => u);
    const canManage = hasPermission(user, 'merchants.view');
    const canGoBack = typeof navigation.canGoBack === 'function' && navigation.canGoBack();

    const [mode, setMode] = useState('existing');
    const [eligibleUsers, setEligibleUsers] = useState([]);
    const [eligibleLoading, setEligibleLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [promotePct, setPromotePct] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const loadEligible = useCallback(async () => {
        if (!canManage) return;
        setEligibleLoading(true);
        try {
            const res = await merchantsApi.eligibleUsers();
            let list = Array.isArray(res?.users) ? res.users : [];
            const sid = user?.id;
            if (sid) {
                list = list.filter((u) => String(u.id) !== String(sid));
            }
            setEligibleUsers(list);
        } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || 'Could not load eligible users.');
            setEligibleUsers([]);
        } finally {
            setEligibleLoading(false);
        }
    }, [canManage, user?.id]);

    useEffect(() => {
        loadEligible();
    }, [loadEligible]);

    const queryLower = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

    const filteredEligible = useMemo(() => {
        return eligibleUsers.filter((u) => matchesUserSearch(u, queryLower));
    }, [eligibleUsers, queryLower]);

    const inputStyle = useMemo(
        () => ({
            marginTop: 10,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            padding: 12,
            color: colors.text,
            backgroundColor: colors.surface,
        }),
        [colors.border, colors.surface, colors.text],
    );

    const searchInputStyle = useMemo(
        () => ({
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 12 : 8,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        }),
        [colors.border, colors.surface, colors.text],
    );

    const submit = () => {
        const pctRaw = promotePct.trim();
        const commission = pctRaw === '' ? null : Number(promotePct);
        if (pctRaw !== '' && (commission === null || Number.isNaN(commission) || commission < 0 || commission > 100)) {
            Alert.alert('Merchant', 'Commission % must be between 0 and 100.');
            return;
        }
        if (mode === 'new') {
            if (!firstName.trim() || !lastName.trim()) {
                Alert.alert('Merchant', 'First and last name are required.');
                return;
            }
            if (!email.trim()) {
                Alert.alert('Merchant', 'Email is required.');
                return;
            }
            if (!phone.trim()) {
                Alert.alert('Merchant', 'Phone is required.');
                return;
            }
        } else if (!selectedUser?.id) {
            Alert.alert('Merchant', 'Select a user from the list.');
            return;
        }

        const commissionLabel = commission == null ? 'None' : `${commission}%`;
        const confirmMessage =
            mode === 'new'
                ? `Create a merchant partner for ${email.trim()} (${firstName.trim()} ${lastName.trim()}).\n\nDefault commission: ${commissionLabel}`
                : `Promote ${eligibleUserLabel(selectedUser)} to merchant partner.\n\nDefault commission: ${commissionLabel}`;

        Alert.alert('Add merchant partner?', confirmMessage, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Confirm',
                onPress: async () => {
                    setSubmitting(true);
                    try {
                        if (mode === 'new') {
                            await merchantsApi.promote({
                                create_user: {
                                    first_name: firstName.trim(),
                                    last_name: lastName.trim(),
                                    email: email.trim(),
                                    phone: phone.trim(),
                                },
                                default_commission_percent: commission,
                            });
                            Alert.alert('Done', 'Merchant created. A temporary password was emailed to the new user.', [
                                { text: 'OK', onPress: () => navigation.goBack() },
                            ]);
                        } else {
                            await merchantsApi.promote({
                                user_id: selectedUser.id,
                                default_commission_percent: commission,
                            });
                            Alert.alert('Done', 'Merchant record created.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
                        }
                    } catch (e) {
                        Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed');
                    } finally {
                        setSubmitting(false);
                    }
                },
            },
        ]);
    };

    if (!canManage) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader hideBack={!canGoBack} onPress={() => navigation.goBack()} label="Add merchant" />
                <View style={{ padding: 20 }}>
                    <AppText label="You do not have permission to add merchant partners." color={colors.textSecondary} fontSize={14} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader hideBack={!canGoBack} onPress={() => navigation.goBack()} label="Add merchant partner" />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
            >
                <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
                    <AppText
                        label="How do you want to add this partner?"
                        variant={2}
                        fontSize={12}
                        color={colors.textTertiary}
                        style={{ marginBottom: 10 }}
                    />
                    <View
                        style={{
                            flexDirection: 'row',
                            padding: 4,
                            borderRadius: 5,
                            backgroundColor: colors.surfaceSecondary ?? colors.surface,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: colors.border,
                        }}
                    >
                        <TouchableOpacity
                            onPress={() => {
                                setMode('existing');
                                setSelectedUser(null);
                            }}
                            activeOpacity={0.85}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: mode === 'existing' }}
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                paddingVertical: 12,
                                paddingHorizontal: 8,
                                borderRadius: 5,
                                backgroundColor: mode === 'existing' ? config.THEME_COLOR : 'transparent',
                                ...(Platform.OS === 'ios' && mode === 'existing'
                                    ? {
                                          shadowColor: '#000',
                                          shadowOffset: { width: 0, height: 1 },
                                          shadowOpacity: 0.12,
                                          shadowRadius: 3,
                                      }
                                    : {}),
                                ...(Platform.OS === 'android' && mode === 'existing' ? { elevation: 2 } : {}),
                            }}
                        >
                            <Lucide
                                name="users"
                                size={18}
                                color={mode === 'existing' ? '#fff' : colors.textTertiary}
                            />
                            <AppText
                                label="Existing user"
                                variant={1}
                                fontSize={13}
                                color={mode === 'existing' ? '#fff' : colors.textSecondary}
                                style={{ textAlign: 'center' }}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                setMode('new');
                                setSelectedUser(null);
                            }}
                            activeOpacity={0.85}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: mode === 'new' }}
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                paddingVertical: 12,
                                paddingHorizontal: 8,
                                borderRadius: 5,
                                backgroundColor: mode === 'new' ? config.THEME_COLOR : 'transparent',
                                ...(Platform.OS === 'ios' && mode === 'new'
                                    ? {
                                          shadowColor: '#000',
                                          shadowOffset: { width: 0, height: 1 },
                                          shadowOpacity: 0.12,
                                          shadowRadius: 3,
                                      }
                                    : {}),
                                ...(Platform.OS === 'android' && mode === 'new' ? { elevation: 2 } : {}),
                            }}
                        >
                            <Lucide
                                name="user-plus"
                                size={18}
                                color={mode === 'new' ? '#fff' : colors.textTertiary}
                            />
                            <AppText
                                label="New user"
                                variant={1}
                                fontSize={13}
                                color={mode === 'new' ? '#fff' : colors.textSecondary}
                                style={{ textAlign: 'center' }}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {mode === 'existing' ? (
                    <View style={{ flex: 1, marginTop: 12, paddingHorizontal: 16 }}>
                        <View style={searchInputStyle}>
                            <Lucide name="search" size={20} color={colors.textTertiary} />
                            <TextInput
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Search by name, email, or phone"
                                placeholderTextColor={colors.placeholder}
                                style={{
                                    flex: 1,
                                    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
                                    color: colors.text,
                                    fontFamily: 'FiraSans-Regular',
                                    fontSize: 15,
                                }}
                                autoCapitalize="none"
                                autoCorrect={false}
                                clearButtonMode="while-editing"
                            />
                        </View>
                        <AppText
                            label={`${filteredEligible.length} of ${eligibleUsers.length} users`}
                            variant={2}
                            fontSize={11}
                            color={colors.textTertiary}
                            style={{ marginTop: 8, marginBottom: 6 }}
                        />
                        {eligibleLoading ? (
                            <ActivityIndicator color={config.THEME_COLOR} style={{ marginTop: 24 }} />
                        ) : (
                            <FlatList
                                data={filteredEligible}
                                keyExtractor={(item) => String(item.id)}
                                style={{ flex: 1 }}
                                contentContainerStyle={{ paddingBottom: 12 + insets.bottom }}
                                keyboardShouldPersistTaps="handled"
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => setSelectedUser(item)}
                                        style={{
                                            padding: 14,
                                            borderRadius: 10,
                                            marginBottom: 8,
                                            backgroundColor:
                                                selectedUser?.id === item.id ? config.THEME_COLOR + '22' : colors.surface,
                                            borderWidth: 1,
                                            borderColor: selectedUser?.id === item.id ? config.THEME_COLOR : colors.border,
                                        }}
                                    >
                                        <AppText label={eligibleUserLabel(item)} color={colors.text} fontSize={14} />
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <AppText
                                        label={
                                            eligibleUsers.length === 0
                                                ? 'No eligible users.'
                                                : 'No users match your search.'
                                        }
                                        color={colors.textSecondary}
                                        style={{ paddingVertical: 24, textAlign: 'center' }}
                                        fontSize={14}
                                    />
                                }
                            />
                        )}
                    </View>
                ) : (
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{
                            paddingHorizontal: 16,
                            paddingTop: 12,
                            paddingBottom: 24 + insets.bottom,
                        }}
                    >
                        <AppText
                            label="Creates a user with the Merchant role. A temporary password is generated and emailed automatically."
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ marginBottom: 8 }}
                        />
                        <TextInput
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="First name"
                            placeholderTextColor={colors.placeholder}
                            style={inputStyle}
                        />
                        <TextInput
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Last name"
                            placeholderTextColor={colors.placeholder}
                            style={inputStyle}
                        />
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Email"
                            placeholderTextColor={colors.placeholder}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            style={inputStyle}
                        />
                        <TextInput
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="Phone"
                            placeholderTextColor={colors.placeholder}
                            keyboardType="phone-pad"
                            style={inputStyle}
                        />
                    </ScrollView>
                )}

                <View
                    style={{
                        paddingHorizontal: 16,
                        paddingTop: 8,
                        paddingBottom: 12 + insets.bottom,
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                        backgroundColor: colors.background,
                    }}
                >
                    <TextInput
                        value={promotePct}
                        onChangeText={setPromotePct}
                        placeholder="Default commission % (optional)"
                        placeholderTextColor={colors.placeholder}
                        keyboardType="decimal-pad"
                        style={inputStyle}
                    />
                    <TouchableOpacity
                        onPress={submit}
                        disabled={submitting}
                        style={{
                            marginTop: 14,
                            backgroundColor: config.THEME_COLOR,
                            padding: 14,
                            borderRadius: 5,
                            alignItems: 'center',
                            opacity: submitting ? 0.65 : 1,
                        }}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <AppText label="Add merchant partner" color="#fff" variant={1} />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default MerchantAdd;
