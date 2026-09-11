import React, { memo, useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import { Lucide } from '@react-native-vector-icons/lucide';
import { users as usersApi } from '../../services/api';
import useTheme from '../../hooks/useTheme';
import { SET_USER, SET_LOGGED_IN } from '../../store/actions/user';
import { clearTokens } from '../../utils/secureStorage';

const PasswordInput = memo(({ label, placeholder, value, onChangeText, visible, onToggle, fieldKey }) => (
    <View style={styles.inputGroup}>
        <AppText label={label} fontSize={14} variant={1} color="#444" style={{ marginBottom: 8 }} />
        <View style={styles.inputWrapper}>
            <Lucide name="lock" size={18} color="#aaa" style={{ marginRight: 10 }} />
            <TextInput
                placeholder={placeholder}
                placeholderTextColor="#ccc"
                secureTextEntry={!visible}
                style={styles.textInput}
                value={value}
                onChangeText={onChangeText}
            />
            <TouchableOpacity onPress={() => onToggle(fieldKey)} style={{ padding: 5 }}>
                <Lucide name={visible ? "eye-off" : "eye"} size={20} color="#aaa" />
            </TouchableOpacity>
        </View>
    </View>
));

const ResetPassword = ({ navigation, route: { params: { changePassword = false } } }) => {
    const { colors } = useTheme();
    const dispatch = useDispatch();
    const user = useSelector(({ user }) => user);
    const isLoggedIn = !!user?.isLoggedIn;

    const [showPassword, setShowPassword] = useState({
        current: false,
        new: false,
        confirm: false,
    });
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const backPress = useCallback(() => {
        navigation.goBack();
    }, [navigation]);

    const toggleVisibility = useCallback((key) => {
        setShowPassword(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleCurrentPasswordChange = useCallback((val) => {
        setForm((prev) => ({ ...prev, currentPassword: val }));
    }, []);
    const handleNewPasswordChange = useCallback((val) => {
        setForm((prev) => ({ ...prev, newPassword: val }));
    }, []);
    const handleConfirmPasswordChange = useCallback((val) => {
        setForm((prev) => ({ ...prev, confirmPassword: val }));
    }, []);

    const handleUpdate = useCallback(async () => {
        if (!form.currentPassword) {
            Alert.alert('Error', 'Please enter your current password');
            return;
        }
        if (!form.newPassword || !form.confirmPassword) {
            Alert.alert('Error', 'Please enter and confirm your new password');
            return;
        }
        if (form.newPassword.length < 8) {
            Alert.alert('Error', 'New password must be at least 8 characters long.');
            return;
        }
        if (form.newPassword !== form.confirmPassword) {
            Alert.alert('Error', 'New passwords do not match');
            return;
        }
        setLoading(true);
        try {
            if (changePassword) {
                await usersApi.changePassword(form.currentPassword, form.newPassword);
            } else {
                await usersApi.resetPassword(form.currentPassword, form.newPassword);
            }
            
            Alert.alert(
                'Success',
                'Your password has been changed successfully.',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            if (!isLoggedIn) {
                                navigation.goBack();
                                return;
                            }
                            // If user is already logged in, force a logout after password change.
                            void (async () => {
                                try {
                                    await clearTokens();
                                } catch (_) {}
                                dispatch({ type: SET_USER, payload: {} });
                                dispatch({ type: SET_LOGGED_IN, payload: false });
                            })();
                        },
                    },
                ]
            );
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to update password.';
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    }, [form.newPassword, form.confirmPassword, form.currentPassword, navigation, dispatch, isLoggedIn]);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}>
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={backPress} label={'Reset Password'} />

                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 20 }}>

                    <View style={styles.infoBox}>
                        <Lucide name="shield-alert" size={20} color={config.THEME_COLOR} />
                        <AppText
                            label="To secure your account, ensure your new password is at least 8 characters long and includes a mix of letters, numbers, and symbols."
                            fontSize={13}
                            color="#666"
                            style={{ flex: 1, marginLeft: 12, lineHeight: 18 }}
                        />
                    </View>

                    <View style={styles.formCard}>
                        <PasswordInput
                            label="Current Password"
                            placeholder="••••••••"
                            value={form.currentPassword}
                            onChangeText={handleCurrentPasswordChange}
                            visible={showPassword.current}
                            onToggle={toggleVisibility}
                            fieldKey="current"
                        />

                        <View style={styles.divider} />

                        <PasswordInput
                            label="New Password"
                            placeholder="••••••••"
                            value={form.newPassword}
                            onChangeText={handleNewPasswordChange}
                            visible={showPassword.new}
                            onToggle={toggleVisibility}
                            fieldKey="new"
                        />

                        <PasswordInput
                            label="Confirm New Password"
                            placeholder="••••••••"
                            value={form.confirmPassword}
                            onChangeText={handleConfirmPasswordChange}
                            visible={showPassword.confirm}
                            onToggle={toggleVisibility}
                            fieldKey="confirm"
                        />
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleUpdate}
                        disabled={loading}
                        style={[styles.actionButton, loading && { opacity: 0.7 }]}>
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Lucide name="circle-check" color="#fff" size={20} />
                                <AppText label="Update Password" color="#fff" variant={1} fontSize={16} style={{ marginLeft: 10 }} />
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 5,
        marginBottom: 20,
        alignItems: 'center',
        borderLeftWidth: 4,
        borderLeftColor: config.THEME_COLOR,
    },
    formCard: {
        backgroundColor: '#fff',
        borderRadius: 5,
        padding: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        marginBottom: 20,
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
    textInput: {
        flex: 1,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
        color: '#333',
        height: '100%',
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f1f1',
        marginBottom: 20,
        marginTop: -5,
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
    },
});

export default ResetPassword;