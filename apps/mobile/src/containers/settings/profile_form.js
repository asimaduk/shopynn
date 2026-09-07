import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { users as usersApi } from '../../services/api';
import { SET_USER } from '../../store/actions/user';

const InputField = ({
    label,
    value,
    onChangeText,
    placeholder,
    icon,
    keyboardType = 'default',
    editable = true,
    colors,
    inputStyles,
}) => (
    <View style={inputStyles.inputGroup}>
        <AppText label={label} fontSize={14} variant={1} color={colors.text} style={{ marginBottom: 8 }} />
        <View
            style={[
                inputStyles.inputWrapper,
                { backgroundColor: colors.inputBackground, borderColor: colors.border },
                !editable && [
                    inputStyles.disabledInput,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight },
                ],
            ]}
        >
            <Lucide name={icon} size={18} color={colors.textTertiary} style={{ marginRight: 10 }} />
            <TextInput
                placeholder={placeholder}
                placeholderTextColor={colors.placeholder}
                style={[inputStyles.textInput, { color: colors.text }]}
                value={value}
                onChangeText={onChangeText}
                keyboardType={keyboardType}
                editable={editable}
            />
        </View>
    </View>
);

const ProfileForm = ({ navigation, route }) => {
    const { profile } = route.params;
    const { colors } = useTheme();
    const dispatch = useDispatch();
    const roleNames = Array.isArray(profile?.settings?.roles)
        ? profile.settings.roles.map((role) => String(role?.name || '').trim().toLowerCase()).filter(Boolean)
        : [];
    const isCustomerProfile = roleNames.includes('customer');

    const [meId, setMeId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        firstName: profile?.first_name || '',
        lastName: profile?.last_name || '',
        email: profile?.email || '',
        phone: profile?.phone || '',
        branch: profile?.warehouse_name || '',
    });
    const resolveProfileImageUri = (raw) => {
        const value = String(raw || '').trim();
        if (!value) return '';
        if (/^(https?:|file:|content:|data:)/i.test(value)) return value;
        return `${config.BASE_API}/images?id=${encodeURIComponent(value)}`;
    };
    const avatarUri = resolveProfileImageUri(
        profile?.profile_image ?? profile?.profileImage ?? profile?.avatar ?? profile?.settings?.profile?.image_url,
    );

    useEffect(() => {
        setMeId(profile?.id);
    }, []);

    const backPress = () => {
        navigation.goBack();
    };

    const handleFirstNameChange = useCallback((val) => {
        setForm((prev) => ({ ...prev, firstName: val }));
    }, []);

    const handleLastNameChange = useCallback((val) => {
        setForm((prev) => ({ ...prev, lastName: val }));
    }, []);

    const handleEmailChange = useCallback((val) => {
        setForm((prev) => ({ ...prev, email: val }));
    }, []);

    const handlePhoneChange = useCallback((val) => {
        setForm((prev) => ({ ...prev, phone: val }));
    }, []);

    const handleSave = async () => {
        if (!form.firstName || !form.lastName) { // || !form.email
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }
        if (!meId) {
            Alert.alert('Error', 'Could not identify your profile. Please try again.');
            return;
        }
        setSaving(true);
        try {
            const name = [form.firstName, form.lastName].filter(Boolean).join(' ');
            await usersApi.update(meId, {
                first_name: form.firstName,
                last_name: form.lastName,
                // email: form.email,
                phone: form.phone || undefined,
            });
            dispatch({ type: SET_USER, payload: { name, first_name: form.firstName, last_name: form.lastName, phone: form.phone, branch: form.branch } }); //, email: form.email
            Alert.alert('Success', 'Your profile has been updated successfully.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || 'Update failed';
            Alert.alert('Error', msg);
        } finally {
            setSaving(false);
        }
    };

    // if (loading) {
    //     return (
    //         <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
    //             <ActivityIndicator size="large" color={config.THEME_COLOR} />
    //             <AppText label="Loading profile..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
    //         </SafeAreaView>
    //     );
    // }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={backPress} label={'Edit Profile'} />

                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 20 }}>
                    <View style={[styles.avatarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Image
                            source={avatarUri ? { uri: avatarUri } : require('../../assets/images/dp.png')}
                            style={styles.avatar}
                        />
                        <AppText label="Profile photo" variant={1} fontSize={14} color={colors.text} style={{ marginTop: 10 }} />
                    </View>

                    <View style={styles.section}>
                        <AppText
                            label={isCustomerProfile ? 'CUSTOMER INFORMATION' : 'PERSONAL INFORMATION'}
                            variant={1}
                            fontSize={13}
                            color={colors.textTertiary}
                            style={styles.sectionTitle}
                        />
                        <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
                            <View style={{ flexDirection: 'row' }}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <InputField
                                        label="First Name"
                                        placeholder="First name"
                                        value={form.firstName}
                                        onChangeText={handleFirstNameChange}
                                        icon="user"
                                        colors={colors}
                                        inputStyles={styles}
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <InputField
                                        label="Last Name"
                                        placeholder="Last name"
                                        value={form.lastName}
                                        onChangeText={handleLastNameChange}
                                        icon="user"
                                        colors={colors}
                                        inputStyles={styles}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <AppText label="CONTACT DETAILS" variant={1} fontSize={13} color={colors.textTertiary} style={styles.sectionTitle} />
                        <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
                            {/* <InputField
                                label="Email Address"
                                placeholder="Email"
                                value={form.email}
                                onChangeText={handleEmailChange}
                                icon="mail"
                                keyboardType="email-address"
                                colors={colors}
                                inputStyles={styles}
                            /> */}

                            <InputField
                                label="Phone Number"
                                placeholder="Phone"
                                value={form.phone}
                                onChangeText={handlePhoneChange}
                                icon="phone"
                                keyboardType="phone-pad"
                                colors={colors}
                                inputStyles={styles}
                            />
                            {isCustomerProfile ? (
                                <AppText
                                    label="Keep your number active for order updates and delivery calls."
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: -8, marginBottom: 12, marginLeft: 2 }}
                                />
                            ) : null}
                        </View>
                    </View>

                    {/* <View style={styles.section}>
                        <AppText label="WORK / LOCATION" variant={1} fontSize={13} color={colors.textTertiary} style={styles.sectionTitle} />
                        <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
                            <InputField
                                label="Assigned Branch"
                                placeholder="Branch"
                                value={form.branch}
                                onChangeText={() => {}}
                                icon="store"
                                editable={false}
                                colors={colors}
                                inputStyles={styles}
                            />
                        </View>
                    </View> */}

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSave}
                        disabled={saving}
                        style={[styles.actionButton, saving && { opacity: 0.7 }]}>
                        {saving ? <ActivityIndicator size="small" color={colors.textInverse} /> : <Lucide name="save" color={colors.textInverse} size={20} />}
                        <AppText label={saving ? 'Saving...' : 'Save Changes'} color={colors.textInverse} variant={1} fontSize={16} style={{ marginLeft: 10 }} />
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    avatarCard: {
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 18,
        marginBottom: 16,
    },
    avatar: {
        width: 84,
        height: 84,
        borderRadius: 42,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        marginBottom: 10,
        marginLeft: 5,
        letterSpacing: 1,
    },
    formCard: {
        backgroundColor: '#fff',
        borderRadius: 5,
        padding: 20,
        paddingBottom: 0,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 52,
        backgroundColor: '#f9f9f9',
    },
    disabledInput: {
        backgroundColor: '#f1f1f1',
        borderColor: '#e0e0e0',
    },
    textInput: {
        flex: 1,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
        color: '#333',
        height: '100%',
    },
    actionButton: {
        flexDirection: 'row',
        backgroundColor: config.THEME_COLOR,
        height: 55,
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        marginTop: 10,
        marginBottom: 20,
    },
});

export default ProfileForm;