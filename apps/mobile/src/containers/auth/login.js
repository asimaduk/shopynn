import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    Dimensions,
    StatusBar,
    Image,
    Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import { SET_USER, SET_LOGGED_IN } from '../../store/actions/user';
import { registerPushAfterLogin } from '../../utils/pushNotifications';
import { setCompanyDetails, setSubscriptionActive, setSubscriptionPlan, setSubscriptionFeatures } from '../../store/actions/appSettings';
import useTheme from '../../hooks/useTheme';
import {
    isBiometricSupported,
    isBiometricLoginEnabled,
    getBiometricType,
    getCredentialsWithBiometric,
    enableBiometricLogin,
} from '../../utils/biometricAuth';
import {
    signInWithGoogle,
    signInWithApple,
    signInWithFacebook,
    isAppleSignInAvailable,
} from '../../utils/socialAuth';
import { setTokens, clearTokens } from '../../utils/secureStorage';
import { users as usersApi, subscriptions as subscriptionsApi } from '../../services/api';
import { normalizePermissionCodes } from '../../utils/permissions';

import {
    isTenantSubscriptionActive,
    SUBSCRIPTION_RENEWAL_CODES as SUBSCRIPTION_ERROR_CODES,
} from '../../utils/subscriptionAccess';

/** Strip invisible paste junk iOS sometimes inserts into email fields. */
const normalizeEmail = (value) =>
    String(value || '')
        .normalize('NFC')
        .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
        .trim()
        .toLowerCase();

const normalizePassword = (value) =>
    String(value || '')
        .normalize('NFC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim();

const PHONE_OTP_RESEND_COOLDOWN_SEC = 60;
const PHONE_OTP_MAX_RESENDS = 5;

const formatCountdown = (seconds) => {
    const s = Math.max(0, Number(seconds) || 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m > 0) return `${m}:${String(r).padStart(2, '0')}`;
    return `${r}s`;
};
const getResponseCode = (error) => {
    const data = error?.response?.data;
    return String(
        data?.code ||
        data?.error?.code ||
        data?.data?.code ||
        ''
    ).toUpperCase();
};

const Login = ({ navigation, route }) => {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();
    const dispatch = useDispatch();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [authMode, setAuthMode] = useState('email'); // 'email' | 'phone'
    const [phone, setPhone] = useState('');
    const [phoneOtp, setPhoneOtp] = useState('');
    const [phoneOtpSent, setPhoneOtpSent] = useState(false);
    const [phoneDevCode, setPhoneDevCode] = useState(null);
    const [phoneResendCooldownSec, setPhoneResendCooldownSec] = useState(0);
    const [phoneResendAttempts, setPhoneResendAttempts] = useState(0);
    const [tabWidth, setTabWidth] = useState(0);
    const tabUnderlineX = useRef(new Animated.Value(0)).current;
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [biometricLabel, setBiometricLabel] = useState('Biometrics');

    useEffect(() => {
        let mounted = true;
        (async () => {
            const supported = await isBiometricSupported();
            const enabled = await isBiometricLoginEnabled();
            const label = await getBiometricType();
            if (mounted) {
                setBiometricAvailable(supported);
                setBiometricEnabled(enabled);
                setBiometricLabel(label);
            }
        })();
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        const prefillEmail = route?.params?.prefillEmail;
        if (typeof prefillEmail === 'string' && prefillEmail.trim()) {
            setEmail(prefillEmail.trim().toLowerCase());
            setAuthMode('email');
        }
        const mode = route?.params?.authMode;
        if (mode === 'phone' || mode === 'email') {
            setAuthMode(mode);
        }
        const prefillPhone = route?.params?.prefillPhone;
        if (typeof prefillPhone === 'string' && prefillPhone.trim()) {
            let n = prefillPhone.replace(/\D/g, '');
            if (n.startsWith('233') && n.length >= 12) n = `0${n.slice(3)}`;
            setPhone(n.slice(0, 10));
            setAuthMode('phone');
        }
    }, [route?.params?.prefillEmail, route?.params?.authMode, route?.params?.prefillPhone]);

    useEffect(() => {
        if (!tabWidth) return;
        const index = authMode === 'phone' ? 1 : 0;
        Animated.spring(tabUnderlineX, {
            toValue: index * tabWidth,
            useNativeDriver: true,
            friction: 9,
            tension: 120,
        }).start();
    }, [authMode, tabWidth, tabUnderlineX]);

    const switchAuthMode = (mode) => {
        if (mode === authMode) return;
        setAuthMode(mode);
        setLoginError('');
        setPhoneOtpSent(false);
        setPhoneOtp('');
        setPhoneDevCode(null);
        setPhoneResendCooldownSec(0);
        setPhoneResendAttempts(0);
    };

    useEffect(() => {
        if (phoneResendCooldownSec <= 0) return undefined;
        const t = setTimeout(() => {
            setPhoneResendCooldownSec((s) => Math.max(0, s - 1));
        }, 1000);
        return () => clearTimeout(t);
    }, [phoneResendCooldownSec]);

    const resetPhoneOtpFlow = () => {
        setPhoneOtpSent(false);
        setPhoneOtp('');
        setPhoneDevCode(null);
        setPhoneResendCooldownSec(0);
        setPhoneResendAttempts(0);
        setLoginError('');
    };

    useFocusEffect(
        useCallback(() => {
            if (Platform.OS === 'android') StatusBar.setBackgroundColor(config.THEME_COLOR);
            StatusBar.setBarStyle('light-content');
            // Don't reset barStyle on blur — next screen's focus owns it (avoids dark icons on blue headers).
            return undefined;
        }, [])
    );

    const performLogin = (found) => {
        dispatch({ type: SET_USER, payload: found });
        dispatch({ type: SET_LOGGED_IN, payload: true });
        // Soft-prompt only when the plan includes notifications (Premium).
        registerPushAfterLogin({ user: found }).catch(() => {});
    };

    const processLogin = (profile, credentialsEmail, credentialsPassword) => {
        const bioEmail = credentialsEmail != null ? String(credentialsEmail).trim().toLowerCase() : email.trim().toLowerCase();
        const bioPassword =
            credentialsPassword != null ? String(credentialsPassword).trim() : password.trim();
        if (biometricAvailable && !biometricEnabled) {
            Alert.alert(
                'Use ' + biometricLabel + ' next time?',
                'You can sign in quickly with ' + biometricLabel + ' next time.',
                [
                    { text: 'Not now', onPress: () => performLogin(profile) },
                    {
                        text: 'Yes',
                        onPress: () => {
                            enableBiometricLogin(bioEmail, bioPassword);
                            performLogin(profile);
                        },
                    },
                ]
            );
        } else {
            performLogin(profile);
        }
    };

    const signInWithPassword = async (e, p) => {
        // Avoid sending a stale Bearer token on /users/login (and clear any bad session).
        await clearTokens();
        const data = await usersApi.login(e, p);
        const token = data?.token ?? data?.data?.token;
        if (!token) {
            Alert.alert('Login failed', 'Invalid response from server.');
            return;
        }
        await finishLoginWithToken(token, { email: e, password: p });
    };

    const finishLoginWithToken = async (token, { email: e = '', password: p = '', skipBio = false } = {}) => {
        await setTokens(token);
        let profile = { email: e, role: '' };
        try {
            // Pass token explicitly so /users/me never races Keychain/AsyncStorage.
            const me = await usersApi.me(token);
            if (me?.reset_password) {
                Alert.alert('Reset password', 'Please reset your password to continue.');
                navigation.navigate('ResetPassword', { changePassword: true });
                return;
            }

            const permissionCodes = normalizePermissionCodes(me?.settings?.permissions);
            const meSubscriptionFeatures = Array.isArray(me?.company?.subscription?.features)
                ? me.company.subscription.features.map((f) => String(f).trim().toLowerCase()).filter(Boolean)
                : [];
            if (me && me.first_name) {
                const hasDash = permissionCodes.includes('dashboard.view');
                const hasMerchOp = permissionCodes.includes('merchants.operate');
                const hasMerchView = permissionCodes.includes('merchants.view');
                let postLoginScreen = null;
                const operateOnlyClientsTab = hasMerchOp && !hasMerchView;
                if (me.merchant_id && operateOnlyClientsTab) {
                    postLoginScreen = 'ClientsTab';
                } else if (hasDash) {
                    postLoginScreen = null;
                } else if (operateOnlyClientsTab) {
                    postLoginScreen = 'ClientsTab';
                }
                let resolvedUserId = me.id;
                if (!resolvedUserId && token) {
                    try {
                        const payloadPart = String(token).split('.')[1] || '';
                        const padded = payloadPart + '='.repeat((4 - (payloadPart.length % 4)) % 4);
                        const json = globalThis.atob
                            ? globalThis.atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
                            : Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
                        resolvedUserId = JSON.parse(json)?.id ?? null;
                    } catch (_) {
                        resolvedUserId = null;
                    }
                }
                profile = {
                    id: resolvedUserId,
                    name: `${me.first_name} ${me.last_name}`,
                    email: me.email || e,
                    phone: me.phone || phone || '',
                    roles: me.settings?.roles?.map((r) => r.name).join(', ') || '',
                    permissions: permissionCodes,
                    settings: {
                        ...(me.settings || {}),
                        permissions: permissionCodes,
                    },
                    warehouse_id: me.warehouse_id,
                    warehouse_name: me.warehouse_name,
                    merchant_id: me.merchant_id ?? null,
                    subscription_features: meSubscriptionFeatures,
                    company: me.company
                        ? {
                              name: me.company.name ?? null,
                              address: me.company.address ?? null,
                              phone: me.company.phone ?? null,
                              email: me.company.email ?? null,
                              organization: me.company.organization ?? null,
                              settings: me.company.settings ?? null,
                              subscription: me.company.subscription
                                  ? {
                                        id: me.company.subscription.id,
                                        name: me.company.subscription.name,
                                        status: me.company.subscription.status,
                                        features: meSubscriptionFeatures,
                                    }
                                  : null,
                              plan_usage: me.company.plan_usage ?? null,
                              has_first_sale: Boolean(me.company.has_first_sale),
                          }
                        : undefined,
                    postLoginScreen,
                };
            } else {
                Alert.alert('Login failed', 'Invalid response from server.');
                return;
            }

            let resolvedFeatures = meSubscriptionFeatures;
            const meSub = me?.company?.subscription;
            let active = isTenantSubscriptionActive(meSub);
            try {
                const subResponse = await subscriptionsApi.current();
                const sub = subResponse?.subscription ?? subResponse;
                if (sub?.status != null) {
                    active = isTenantSubscriptionActive(sub);
                }
                const subFeatures = Array.isArray(sub?.features)
                    ? sub.features.map((f) => String(f).trim().toLowerCase()).filter(Boolean)
                    : meSubscriptionFeatures;
                resolvedFeatures = subFeatures;
                dispatch(setSubscriptionActive(active));
                const plan = sub
                    ? {
                          name: sub.name ?? sub.planName ?? sub.plan?.name ?? 'Scale',
                          id: sub.id ?? sub.plan_id ?? sub.plan?.id,
                          amount: sub.amount != null ? Number(sub.amount) : undefined,
                          billingInterval: sub.billing_interval ?? sub.billingCycle ?? sub.plan?.billing_interval,
                          endAt: sub.end_at ?? sub.nextBillingDate ?? sub.plan?.end_at,
                          status: sub.status ?? sub.state,
                      }
                    : null;
                dispatch(setSubscriptionPlan(plan));
                dispatch(setSubscriptionFeatures(subFeatures));
            } catch (_) {
                dispatch(setSubscriptionActive(false));
                dispatch(setSubscriptionPlan(null));
                dispatch(setSubscriptionFeatures(meSubscriptionFeatures));
            }

            profile.subscription_features = resolvedFeatures;

            const companyName = me?.companyName ?? me?.company?.name;
            const companyDetailsFromMe = !!(me?.companyDetailsSet === true || companyName);

            if (companyDetailsFromMe) {
                dispatch(
                    setCompanyDetails({
                        companyName: companyName ?? me?.companyName ?? '',
                        companyAddress: me?.companyAddress ?? me?.company?.address ?? '',
                        companyPhone: me?.companyPhone ?? me?.company?.phone ?? '',
                        companyEmail: me?.companyEmail ?? me?.company?.email ?? '',
                        companyIndustry: me?.companyIndustry ?? me?.company?.industry ?? '',
                    })
                );
            } else {
                dispatch({ type: SET_USER, payload: profile });
                navigation.navigate('CompanyDetailsSetup');
                return;
            }
            if (skipBio || !p) {
                performLogin(profile);
            } else {
                processLogin(profile, e, p);
            }
        } catch (_) {
            const status = _?.response?.status;
            const code = getResponseCode(_);
            if (status === 403 && SUBSCRIPTION_ERROR_CODES.has(code)) {
                dispatch(setSubscriptionActive(false));
                dispatch(setSubscriptionPlan(null));
                dispatch(setSubscriptionFeatures([]));
                if (skipBio || !p) {
                    performLogin(profile);
                } else {
                    processLogin(profile, e, p);
                }
                return;
            }
            const msg =
                _?.response?.data?.message ||
                _?.message ||
                'Signed in, but could not load your profile. Check your connection and try again.';
            Alert.alert('Login incomplete', msg);
            throw _;
        }
    };

    const validateAndLogin = async () => {
        const e = normalizeEmail(email);
        const p = normalizePassword(password);
        setLoginError('');
        if (!e || !p) {
            Alert.alert('Required', 'Please enter email and password.');
            return;
        }
        setLoading(true);
        try {
            await signInWithPassword(e, p);
        } catch (err) {
            const status = err?.response?.status;
            const apiPayload = err?.response?.data?.data ?? err?.response?.data;
            const passwordExpired =
                apiPayload?.passwordExpired === true ||
                String(apiPayload?.code || '').toUpperCase() === 'PASSWORD_EXPIRED';
            if (status === 403 && passwordExpired) {
                Alert.alert(
                    'Password expired',
                    'Your password has expired. Use Forgot password to receive a reset link by email.',
                    [{ text: 'Continue', onPress: () => navigation.navigate('ForgotPassword') }]
                );
                return;
            }
            const inactive =
                String(apiPayload?.code || '').toUpperCase() === 'ACCOUNT_INACTIVE' ||
                apiPayload?.isActive === false;
            if (status === 403 && inactive) {
                Alert.alert('Account inactive', 'Your account is inactive. Contact your administrator.');
                return;
            }
            const serverMsg =
                (typeof err?.response?.data?.message === 'string' && err.response.data.message) ||
                (typeof err?.response?.data?.error === 'string' && err.response.data.error) ||
                err?.message ||
                'Invalid email or password.';
            const detail = `${serverMsg}\nAPI: ${config.BASE_API}\nHTTP: ${status || 'network'}`;
            setLoginError(detail);
            Alert.alert('Sign-in failed', detail);
        } finally {
            setLoading(false);
        }
    };



    const sendPhoneOtp = async ({ isResend = false } = {}) => {
        if (!phone.trim()) {
            Alert.alert('Required', 'Enter the mobile number you used on the store link.');
            return;
        }
        if (isResend) {
            if (phoneResendCooldownSec > 0) return;
            if (phoneResendAttempts >= PHONE_OTP_MAX_RESENDS) {
                Alert.alert(
                    'Resend limit reached',
                    `You can request up to ${PHONE_OTP_MAX_RESENDS} codes. Change the number or try again later.`
                );
                return;
            }
        }
        setLoading(true);
        setLoginError('');
        try {
            await clearTokens();
            const data = await usersApi.sendPhoneLoginOtp(phone.trim());
            setPhoneOtpSent(true);
            setPhoneOtp('');
            setPhoneDevCode(data?.dev_code || null);
            if (data?.phone) {
                let normalized = String(data.phone).replace(/\D/g, '');
                if (normalized.startsWith('233') && normalized.length >= 12) {
                    normalized = `0${normalized.slice(3)}`;
                }
                setPhone(normalized.slice(0, 10));
            }
            const cooldown = Number(data?.resend_cooldown_seconds) || PHONE_OTP_RESEND_COOLDOWN_SEC;
            setPhoneResendCooldownSec(cooldown);
            setPhoneResendAttempts((n) => (isResend || phoneOtpSent ? n + 1 : 1));
            if (!isResend) {
                Alert.alert(
                    'Code sent',
                    data?.dev_code
                        ? `Dev code: ${data.dev_code}`
                        : 'Enter the SMS code we sent to your phone.'
                );
            }
        } catch (err) {
            const payload = err?.response?.data?.data || {};
            const retryAfter = Number(payload.retry_after_seconds);
            if (payload.code === 'OTP_COOLDOWN' || (Number.isFinite(retryAfter) && retryAfter > 0)) {
                setPhoneOtpSent(true);
                setPhoneResendCooldownSec(
                    Number.isFinite(retryAfter) && retryAfter > 0
                        ? retryAfter
                        : PHONE_OTP_RESEND_COOLDOWN_SEC
                );
            }
            const msg = err?.response?.data?.message || err?.message || 'Could not send code.';
            setLoginError(msg);
            Alert.alert('Could not send code', msg);
        } finally {
            setLoading(false);
        }
    };

    const verifyPhoneAndLogin = async () => {
        if (!phone.trim() || String(phoneOtp).trim().length < 6) {
            Alert.alert('Required', 'Enter your phone number and the 6-digit code.');
            return;
        }
        setLoading(true);
        setLoginError('');
        try {
            await clearTokens();
            const data = await usersApi.verifyPhoneLoginOtp(phone.trim(), String(phoneOtp).trim());
            const token = data?.token ?? data?.data?.token;
            if (!token) {
                Alert.alert('Login failed', 'Invalid response from server.');
                return;
            }
            await finishLoginWithToken(token, { skipBio: true });
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Invalid code.';
            setLoginError(msg);
            Alert.alert('Sign-in failed', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider) => {
        if (loading) return;
        setLoading(true);
        try {
            let userInfo;
            if (provider === 'Google') {
                userInfo = await signInWithGoogle();
            } else if (provider === 'Apple') {
                userInfo = await signInWithApple();
            } else if (provider === 'Facebook') {
                userInfo = await signInWithFacebook();
            } else {
                setLoading(false);
                return;
            }
            const payload = {
                name: userInfo.name,
                email: userInfo.email,
                role: 'Staff',
            };
            dispatch({ type: SET_USER, payload });
            dispatch({ type: SET_LOGGED_IN, payload: true });
        } catch (err) {
            const message = err?.message || `Sign in with ${provider} failed.`;
            if (!message.toLowerCase().includes('cancelled')) {
                Alert.alert('Sign-in failed', message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleBiometricLogin = async () => {
        if (!biometricAvailable || !biometricEnabled) return;
        setLoading(true);
        try {
            const credentials = await getCredentialsWithBiometric();
            if (!credentials) {
                return;
            }
            const e = (credentials.username || credentials.email || '').trim().toLowerCase();
            const p = credentials.password != null ? String(credentials.password) : '';
            if (!e || !p.trim()) {
                Alert.alert('Login failed', 'Saved credentials are missing. Sign in with your password.');
                return;
            }
            await signInWithPassword(e, p.trim());
        } catch (err) {
            const status = err?.response?.status;
            const apiPayload = err?.response?.data?.data ?? err?.response?.data;
            const passwordExpired =
                apiPayload?.passwordExpired === true ||
                String(apiPayload?.code || '').toUpperCase() === 'PASSWORD_EXPIRED';
            if (status === 403 && passwordExpired) {
                Alert.alert(
                    'Password expired',
                    'Your password has expired. Use Forgot password to receive a reset link by email.',
                    [{ text: 'Continue', onPress: () => navigation.navigate('ForgotPassword') }]
                );
                return;
            }
            if (status === 401) {
                Alert.alert('Login failed', 'Saved credentials are no longer valid. Sign in with your password.');
                return;
            }
            const msg = err?.response?.data?.message || err?.message || 'Could not sign in.';
            Alert.alert('Sign-in failed', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.keyboard, { backgroundColor: colors.background }]}>
            {isFocused ? (
                <StatusBar barStyle="light-content" backgroundColor={config.THEME_COLOR} />
            ) : null}
            {/* Theme-colored strip for status bar area (iOS: transparent status bar shows this; Android: StatusBar.setBackgroundColor in useFocusEffect) */}
            {insets.top > 0 && (
                <View style={[styles.statusBarFill, { height: insets.top, backgroundColor: config.THEME_COLOR }]} />
            )}
            <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}>
                    {/* Top brand strip */}
                    <View style={[styles.brandStrip, { backgroundColor: config.THEME_COLOR }]}>
                        <View style={styles.brandStripInner}>
                            <View style={styles.brandIconWrap}>
                                <Image source={require('../../assets/images/logo/ims-logo.png')} style={styles.brandLogoImage} resizeMode="contain" />
                            </View>
                            <AppText label="Shopynn" variant={1} fontSize={26} color="#fff" style={styles.brandTitle} />
                            <AppText label="Inventory · Orders · Sales · Reports" fontSize={13} color="rgba(255,255,255,0.85)" />
                        </View>
                    </View>

                    {/* Form area — no card, full width */}
                    <View style={[styles.formSection, { backgroundColor: colors.background }]}>
                        <AppText label="Welcome back" variant={1} fontSize={20} color={colors.text} style={styles.formTitle} />
                        <AppText
                            label="Choose how you signed up"
                            fontSize={14}
                            color={colors.textSecondary}
                            style={styles.formSubtitle}
                        />

                        <View
                            style={[styles.modeTabs, { borderBottomColor: colors.border }]}
                            onLayout={(e) => {
                                const w = e.nativeEvent.layout.width;
                                if (w > 0) setTabWidth(w / 2);
                            }}
                        >
                            {[
                                { id: 'email', label: 'Email', hint: 'Staff & Owners' },
                                { id: 'phone', label: 'Phone', hint: 'Customers' },
                            ].map((m) => {
                                const active = authMode === m.id;
                                return (
                                    <TouchableOpacity
                                        key={m.id}
                                        activeOpacity={0.7}
                                        onPress={() => switchAuthMode(m.id)}
                                        style={styles.modeTab}
                                        accessibilityRole="tab"
                                        accessibilityState={{ selected: active }}
                                        accessibilityLabel={`${m.label}, ${m.hint}`}
                                    >
                                        <AppText
                                            label={m.label}
                                            variant={1}
                                            fontSize={15}
                                            color={active ? config.THEME_COLOR : colors.textTertiary}
                                        />
                                        <AppText
                                            label={m.hint}
                                            fontSize={11}
                                            color={active ? config.THEME_COLOR : colors.textTertiary}
                                            style={styles.modeTabHint}
                                        />
                                    </TouchableOpacity>
                                );
                            })}
                            {tabWidth > 0 ? (
                                <Animated.View
                                    pointerEvents="none"
                                    style={[
                                        styles.modeUnderline,
                                        {
                                            width: tabWidth,
                                            backgroundColor: config.THEME_COLOR,
                                            transform: [{ translateX: tabUnderlineX }],
                                        },
                                    ]}
                                />
                            ) : null}
                        </View>

                        {authMode === 'email' ? (
                            <>
                        <View style={styles.fieldGroup}>
                            <AppText label="Email" fontSize={12} color={colors.textTertiary} style={styles.fieldLabel} />
                            <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
                                <Lucide name="mail" size={18} color={colors.placeholder} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="you@example.com"
                                    placeholderTextColor={colors.placeholder}
                                    value={email}
                                    onChangeText={(value) => {
                                        setEmail(value);
                                        if (loginError) setLoginError('');
                                    }}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="email"
                                    textContentType="username"
                                    keyboardType="email-address"
                                    editable={!loading}
                                />
                            </View>
                        </View>
                        <View style={styles.fieldGroup}>
                            <AppText label="Password" fontSize={12} color={colors.textTertiary} style={styles.fieldLabel} />
                            <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
                                <Lucide name="lock" size={18} color={colors.placeholder} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="••••••••"
                                    placeholderTextColor={colors.placeholder}
                                    value={password}
                                    onChangeText={(value) => {
                                        setPassword(value);
                                        if (loginError) setLoginError('');
                                    }}
                                    secureTextEntry={!showPassword}
                                    autoComplete="password"
                                    textContentType="password"
                                    editable={!loading}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeBtn}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Lucide name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.placeholder} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate('ForgotPassword')}
                            style={styles.forgotBtn}>
                            <AppText label="Forgot password?" fontSize={13} color={config.THEME_COLOR} />
                        </TouchableOpacity>
                        {!!loginError && (
                            <Text style={[styles.errorText, { color: colors.error || '#D32F2F' }]}>
                                {loginError}
                            </Text>
                        )}

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={validateAndLogin}
                            disabled={loading || !email.trim() || !password.trim()}
                            style={[
                                styles.primaryBtn,
                                { backgroundColor: config.THEME_COLOR },
                                (loading || !email.trim() || !password.trim()) && styles.primaryBtnDisabled,
                            ]}>
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <AppText label="Sign in" variant={1} fontSize={16} color="#fff" />
                            )}
                        </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <View style={styles.fieldGroup}>
                                    <View style={styles.phoneLabelRow}>
                                        <AppText label="Mobile number" fontSize={12} color={colors.textTertiary} style={styles.fieldLabel} />
                                        {phoneOtpSent ? (
                                            <TouchableOpacity
                                                onPress={resetPhoneOtpFlow}
                                                disabled={loading}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <AppText label="Change" fontSize={12} color={config.THEME_COLOR} />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                    <View
                                        style={[
                                            styles.inputRow,
                                            {
                                                borderBottomColor: colors.border,
                                                opacity: phoneOtpSent ? 0.72 : 1,
                                            },
                                        ]}
                                    >
                                        <Lucide name="smartphone" size={18} color={colors.placeholder} style={styles.inputIcon} />
                                        <TextInput
                                            style={[styles.input, { color: colors.text }]}
                                            placeholder="024 XXX XXXX"
                                            placeholderTextColor={colors.placeholder}
                                            value={phone}
                                            onChangeText={(value) => {
                                                const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
                                                setPhone(digits);
                                                if (loginError) setLoginError('');
                                            }}
                                            keyboardType="phone-pad"
                                            autoComplete="tel"
                                            textContentType="telephoneNumber"
                                            maxLength={10}
                                            editable={!loading && !phoneOtpSent}
                                        />
                                        {phoneOtpSent ? (
                                            <Lucide name="lock" size={16} color={colors.placeholder} />
                                        ) : null}
                                    </View>
                                </View>
                                {phoneOtpSent ? (
                                    <View style={styles.fieldGroup}>
                                        <AppText label="SMS code" fontSize={12} color={colors.textTertiary} style={styles.fieldLabel} />
                                        <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
                                            <Lucide name="shield-check" size={18} color={colors.placeholder} style={styles.inputIcon} />
                                            <TextInput
                                                style={[styles.input, { color: colors.text }]}
                                                placeholder="6-digit code"
                                                placeholderTextColor={colors.placeholder}
                                                value={phoneOtp}
                                                onChangeText={(value) =>
                                                    setPhoneOtp(String(value || '').replace(/\D/g, '').slice(0, 6))
                                                }
                                                keyboardType="number-pad"
                                                maxLength={6}
                                                editable={!loading}
                                                autoFocus
                                            />
                                        </View>
                                        {phoneDevCode ? (
                                            <AppText
                                                label={`Dev code: ${phoneDevCode}`}
                                                fontSize={12}
                                                color={colors.textTertiary}
                                                style={{ marginTop: 6 }}
                                            />
                                        ) : null}
                                    </View>
                                ) : null}
                                {!!loginError && (
                                    <Text style={[styles.errorText, { color: colors.error || '#D32F2F' }]}>
                                        {loginError}
                                    </Text>
                                )}
                                {!phoneOtpSent ? (
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={() => sendPhoneOtp({ isResend: false })}
                                        disabled={loading || !phone.trim()}
                                        style={[
                                            styles.primaryBtn,
                                            { backgroundColor: config.THEME_COLOR },
                                            (loading || !phone.trim()) && styles.primaryBtnDisabled,
                                        ]}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <AppText label="Send code" variant={1} fontSize={16} color="#fff" />
                                        )}
                                    </TouchableOpacity>
                                ) : (
                                    <>
                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={verifyPhoneAndLogin}
                                            disabled={loading || String(phoneOtp).trim().length < 6}
                                            style={[
                                                styles.primaryBtn,
                                                { backgroundColor: config.THEME_COLOR },
                                                (loading || String(phoneOtp).trim().length < 6) && styles.primaryBtnDisabled,
                                            ]}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color="#fff" />
                                            ) : (
                                                <AppText label="Verify & sign in" variant={1} fontSize={16} color="#fff" />
                                            )}
                                        </TouchableOpacity>
                                        <View style={styles.resendRow}>
                                            <AppText
                                                label={
                                                    phoneResendAttempts >= PHONE_OTP_MAX_RESENDS
                                                        ? `Resend limit reached (${PHONE_OTP_MAX_RESENDS}/${PHONE_OTP_MAX_RESENDS})`
                                                        : `${Math.max(0, PHONE_OTP_MAX_RESENDS - phoneResendAttempts)} resend${
                                                              PHONE_OTP_MAX_RESENDS - phoneResendAttempts === 1 ? '' : 's'
                                                          } left`
                                                }
                                                fontSize={12}
                                                color={colors.textTertiary}
                                            />
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={() => sendPhoneOtp({ isResend: true })}
                                                disabled={
                                                    loading ||
                                                    phoneResendCooldownSec > 0 ||
                                                    phoneResendAttempts >= PHONE_OTP_MAX_RESENDS
                                                }
                                                style={styles.resendLink}
                                            >
                                                <AppText
                                                    label={
                                                        phoneResendCooldownSec > 0
                                                            ? `Resend in ${formatCountdown(phoneResendCooldownSec)}`
                                                            : 'Resend code'
                                                    }
                                                    fontSize={13}
                                                    color={
                                                        phoneResendCooldownSec > 0 ||
                                                        phoneResendAttempts >= PHONE_OTP_MAX_RESENDS
                                                            ? colors.textTertiary
                                                            : config.THEME_COLOR
                                                    }
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}
                                {/* <AppText
                                    label="Staff can keep using the Email tab."
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 10 }}
                                /> */}
                            </>
                        )}

                        {biometricAvailable && biometricEnabled && (
                            <>
                                <View style={styles.dividerRow}>
                                    <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                                    <AppText label="or" fontSize={12} color={colors.textTertiary} style={styles.dividerText} />
                                    <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                                </View>
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={handleBiometricLogin}
                                    disabled={loading}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Sign in with ${biometricLabel}`}
                                    style={[
                                        styles.biometricBtn,
                                        {
                                            backgroundColor: isDark ? 'rgba(10,116,218,0.18)' : 'rgba(10,116,218,0.08)',
                                            borderColor: config.THEME_COLOR,
                                            opacity: loading ? 0.55 : 1,
                                        },
                                    ]}>
                                    <View style={[styles.biometricIconWrap, { backgroundColor: config.THEME_COLOR }]}>
                                        <Lucide
                                            name={
                                                biometricLabel === 'Face ID'
                                                    ? 'scan-face'
                                                    : biometricLabel === 'Touch ID'
                                                        ? 'fingerprint'
                                                        : 'fingerprint'
                                            }
                                            size={22}
                                            color="#fff"
                                        />
                                    </View>
                                    <View style={styles.biometricTextCol}>
                                        <AppText
                                            label={`Sign in with ${biometricLabel}`}
                                            variant={1}
                                            fontSize={16}
                                            color={colors.text}
                                        />
                                        <AppText
                                            label="Quick unlock with this device"
                                            fontSize={12}
                                            color={colors.textSecondary}
                                            style={styles.biometricSub}
                                        />
                                    </View>
                                    <Lucide name="chevron-right" size={20} color={config.THEME_COLOR} />
                                </TouchableOpacity>
                            </>
                        )}

                        {/* <View style={styles.dividerRow}>
                            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                            <AppText label="or continue with" fontSize={12} color={colors.textTertiary} style={styles.dividerText} />
                            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                        </View> */}

                        {/* <View style={styles.socialRow}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => handleSocialLogin('Google')}
                                disabled={loading}
                                style={[styles.socialBtn, { borderColor: colors.border }]}>
                                <View style={styles.googleBtnWrap}>
                                    <Text style={styles.googleG}>G</Text>
                                </View>
                            </TouchableOpacity>
                            {isAppleSignInAvailable() && (
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => handleSocialLogin('Apple')}
                                    disabled={loading}
                                    style={[styles.socialBtn, { borderColor: colors.border }]}>
                                    <Lucide name="apple" size={22} color={colors.text} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => handleSocialLogin('Facebook')}
                                disabled={loading}
                                style={[styles.socialBtn, { borderColor: colors.border }]}>
                                <Lucide name="facebook" size={22} color="#1877F2" />
                            </TouchableOpacity>
                        </View> */}
                    </View>

                    <View style={[styles.footerHint, { borderTopColor: colors.border }]}>
                        <Lucide name="badge-info" size={16} color={colors.textTertiary} />
                        <TouchableOpacity onPress={() => navigation.navigate('ChooseAccountType')} style={{ marginLeft: 8 }}>
                            <AppText label="Need an account? Create one" fontSize={15} color={config.THEME_COLOR} />
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
    keyboard: { flex: 1 },
    safeArea: { flex: 1 },
    statusBarFill: { width: '100%' },
    scrollContent: { paddingBottom: 24 },
    brandStrip: {
        width,
        paddingTop: 28,
        paddingBottom: 28,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    brandStripInner: { alignItems: 'center' },
    brandIconWrap: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    brandTitle: { marginBottom: 4 },
    brandLogoImage: {
        width: 44,
        height: 44,
    },
    formSection: {
        paddingHorizontal: 24,
        paddingTop: 28,
    },
    formTitle: { marginBottom: 4 },
    formSubtitle: { marginBottom: 16 },
    modeTabs: {
        flexDirection: 'row',
        position: 'relative',
        marginBottom: 22,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    modeTab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 10,
        paddingBottom: 12,
    },
    modeTabHint: {
        marginTop: 2,
        textAlign: 'center',
    },
    modeUnderline: {
        position: 'absolute',
        left: 0,
        bottom: -StyleSheet.hairlineWidth,
        height: 2.5,
        borderRadius: 2,
    },
    fieldGroup: { marginBottom: 20 },
    fieldLabel: { marginLeft: 2 },
    phoneLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 0,
    },
    resendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
        marginBottom: 12,
        gap: 8,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1.5,
        paddingBottom: 12,
        paddingHorizontal: 4,
    },
    inputIcon: { marginRight: 12 },
    input: {
        flex: 1,
        height: 44,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
        paddingVertical: 0,
    },
    eyeBtn: { padding: 8 },
    forgotBtn: { alignSelf: 'flex-end', marginBottom: 20 },
    resendLink: { paddingVertical: 4 },
    errorText: {
        fontFamily: 'FiraSans-Regular',
        fontSize: 13,
        marginBottom: 15,
    },
    primaryBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: 5,
        marginBottom: 16,
    },
    primaryBtnDisabled: { opacity: 0.5 },
    biometricBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 64,
        borderRadius: 5,
        borderWidth: 1.5,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 16,
    },
    biometricIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    biometricTextCol: {
        flex: 1,
        justifyContent: 'center',
    },
    biometricSub: {
        marginTop: 2,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    dividerLine: { flex: 1, height: 1 },
    dividerText: { marginHorizontal: 12 },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    socialBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    googleBtnWrap: {
        width: 30,
        height: 30,
        borderRadius: 30,
        backgroundColor: '#EA4335',
        justifyContent: 'center',
        alignItems: 'center',
    },
    googleG: {
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
        fontWeight: '700',
        color: '#fff'
    },
    footerHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 28,
        paddingTop: 20,
        marginHorizontal: 24,
        borderTopWidth: 1,
    },
});

export default Login;
