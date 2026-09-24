import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useDispatch, useSelector } from 'react-redux';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { users as usersApi } from '../../services/api';
import { SET_USER } from '../../store/actions/user';

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const StatusBanner = ({ type, message, colors, onDismiss }) => {
    if (!message) return null;
    const isError = type === 'error';
    const bg = isError ? (colors.errorLight || '#fef2f2') : '#ecfdf5';
    const border = isError ? (colors.error || '#ef4444') : '#22c55e';
    const textColor = isError ? (colors.error || '#b91c1c') : '#15803d';
    const icon = isError ? 'circle-alert' : 'circle-check';

    return (
        <View style={[styles.banner, { backgroundColor: bg, borderColor: border }]}>
            <Lucide name={icon} size={18} color={textColor} />
            <AppText
                label={message}
                fontSize={13}
                color={textColor}
                style={{ flex: 1, marginLeft: 10, lineHeight: 18 }}
            />
            {onDismiss ? (
                <TouchableOpacity onPress={onDismiss} hitSlop={8} style={{ padding: 4 }}>
                    <Lucide name="x" size={16} color={textColor} />
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

const ChangeEmail = ({ navigation, route }) => {
    const { colors } = useTheme();
    const dispatch = useDispatch();
    const reduxUser = useSelector((state) => state.user) || {};
    const currentEmail = String(route?.params?.currentEmail || reduxUser?.email || '').trim();

    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
    const canSend = isValidEmail(normalizedEmail) && !sendingOtp && !verifying;
    const canVerify = otpSent && /^\d{6}$/.test(otp) && !verifying && !sendingOtp;

    const backPress = useCallback(() => {
        navigation.goBack();
    }, [navigation]);

    const clearStatus = useCallback(() => {
        setError('');
        setSuccess('');
    }, []);

    const onEmailChange = useCallback((text) => {
        setEmail(text);
        setError('');
        setSuccess('');
        if (otpSent) {
            setOtpSent(false);
            setOtp('');
        }
    }, [otpSent]);

    const sendOtp = useCallback(async () => {
        if (sendingOtp || verifying) return;
        clearStatus();

        if (!isValidEmail(normalizedEmail)) {
            setError('Enter a valid email address.');
            return;
        }
        if (currentEmail && normalizedEmail === currentEmail.toLowerCase()) {
            setError('That is already your email address.');
            return;
        }

        setSendingOtp(true);
        try {
            await usersApi.sendChangeEmailOtp(normalizedEmail);
            setOtpSent(true);
            setOtp('');
            setSuccess('Code sent. Check your inbox for a 6-digit code (expires in 10 minutes).');
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Could not send code.';
            setError(msg);
            setOtpSent(false);
        } finally {
            setSendingOtp(false);
        }
    }, [normalizedEmail, currentEmail, sendingOtp, verifying, clearStatus]);

    const verifyOtp = useCallback(async () => {
        if (verifying || sendingOtp) return;
        clearStatus();

        if (!isValidEmail(normalizedEmail)) {
            setError('Enter a valid email address.');
            return;
        }
        if (!/^\d{6}$/.test(otp)) {
            setError('Enter the 6-digit code from your email.');
            return;
        }

        setVerifying(true);
        try {
            const result = await usersApi.verifyChangeEmailOtp(normalizedEmail, otp);
            const nextEmail = result?.email || normalizedEmail;
            dispatch({
                type: SET_USER,
                payload: { ...reduxUser, email: nextEmail },
            });
            setSuccess('Email updated successfully.');
            setTimeout(() => navigation.goBack(), 800);
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Verification failed.';
            setError(msg);
        } finally {
            setVerifying(false);
        }
    }, [normalizedEmail, otp, dispatch, reduxUser, navigation, verifying, sendingOtp, clearStatus]);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <SafeAreaView
                edges={['bottom', 'left', 'right']}
                style={[styles.container, { backgroundColor: colors.background }]}
            >
                <ScreenHeader onPress={backPress} label="Change Email" />

                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.content}
                >
                    <View style={[styles.infoBox, { backgroundColor: colors.surface, borderLeftColor: config.THEME_COLOR }]}>
                        <Lucide name="mail" size={20} color={config.THEME_COLOR} />
                        <AppText
                            label="We'll send a 6-digit code to your new email. Enter it below to confirm the change."
                            fontSize={13}
                            color={colors.textSecondary}
                            style={{ flex: 1, marginLeft: 12, lineHeight: 18 }}
                        />
                    </View>

                    {!!error && (
                        <StatusBanner
                            type="error"
                            message={error}
                            colors={colors}
                            onDismiss={() => setError('')}
                        />
                    )}
                    {!!success && !error && (
                        <StatusBanner
                            type="success"
                            message={success}
                            colors={colors}
                            onDismiss={() => setSuccess('')}
                        />
                    )}

                    {!!currentEmail && (
                        <View style={[styles.currentCard, { backgroundColor: colors.surface }]}>
                            <AppText label="Current email" fontSize={12} color={colors.textTertiary} />
                            <AppText
                                label={currentEmail}
                                fontSize={14}
                                color={colors.text}
                                variant={1}
                                style={{ marginTop: 4 }}
                                numberOfLines={2}
                            />
                        </View>
                    )}

                    <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
                        <AppText label="New email" fontSize={14} variant={1} color={colors.text} style={{ marginBottom: 8 }} />
                        <View
                            style={[
                                styles.inputRow,
                                {
                                    borderBottomColor: error ? (colors.error || '#ef4444') : colors.border,
                                },
                            ]}
                        >
                            <Lucide
                                name="mail"
                                size={18}
                                color={error ? (colors.error || '#ef4444') : colors.placeholder}
                                style={{ marginRight: 10 }}
                            />
                            <TextInput
                                value={email}
                                onChangeText={onEmailChange}
                                placeholder="you@example.com"
                                placeholderTextColor={colors.placeholder}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                style={[styles.input, { color: colors.text }]}
                            />
                        </View>

                        <TouchableOpacity
                            onPress={sendOtp}
                            disabled={!canSend}
                            style={[
                                styles.secondaryBtn,
                                { borderColor: config.THEME_COLOR, opacity: canSend ? 1 : 0.5 },
                            ]}
                        >
                            {sendingOtp ? (
                                <ActivityIndicator color={config.THEME_COLOR} size="small" />
                            ) : (
                                <AppText
                                    label={otpSent ? 'Resend code' : 'Send verification code'}
                                    color={config.THEME_COLOR}
                                    fontSize={14}
                                    variant={1}
                                />
                            )}
                        </TouchableOpacity>

                        {otpSent ? (
                            <>
                                <AppText
                                    label="Verification code"
                                    fontSize={14}
                                    variant={1}
                                    color={colors.text}
                                    style={{ marginTop: 20, marginBottom: 8 }}
                                />
                                <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
                                    <Lucide name="key-round" size={18} color={colors.placeholder} style={{ marginRight: 10 }} />
                                    <TextInput
                                        value={otp}
                                        onChangeText={(t) => {
                                            setOtp(String(t).replace(/\D/g, '').slice(0, 6));
                                            setError('');
                                        }}
                                        placeholder="6-digit code"
                                        placeholderTextColor={colors.placeholder}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        style={[styles.input, { color: colors.text }]}
                                    />
                                </View>
                            </>
                        ) : null}
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={verifyOtp}
                        disabled={!canVerify}
                        style={[styles.primaryBtn, (!canVerify || verifying) && { opacity: 0.6 }]}
                    >
                        {verifying ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Lucide name="circle-check" color="#fff" size={20} />
                                <AppText
                                    label="Verify & update email"
                                    color="#fff"
                                    variant={1}
                                    fontSize={16}
                                    style={{ marginLeft: 10 }}
                                />
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
    infoBox: {
        flexDirection: 'row',
        padding: 15,
        borderRadius: 8,
        marginBottom: 16,
        alignItems: 'center',
        borderLeftWidth: 4,
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
    },
    currentCard: {
        borderRadius: 8,
        padding: 14,
        marginBottom: 16,
    },
    formCard: {
        borderRadius: 8,
        padding: 18,
        marginBottom: 20,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingBottom: 10,
        marginBottom: 14,
    },
    input: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 4,
    },
    secondaryBtn: {
        borderWidth: 1.5,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    primaryBtn: {
        backgroundColor: config.THEME_COLOR,
        borderRadius: 8,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
    },
});

export default ChangeEmail;
