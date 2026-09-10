import React, { useState, useEffect, useCallback } from 'react';
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
        }
    }, [route?.params?.prefillEmail]);

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
        await setTokens(token);
        let profile = { email: e, role: '' };
        try {
            const me = await usersApi.me();
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
                profile = {
                    id: me.id,
                    name: `${me.first_name} ${me.last_name}`,
                    email: me.email || e,
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
                          name: sub.name ?? sub.planName ?? sub.plan?.name ?? 'Premium',
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
            processLogin(profile, e, p);
        } catch (_) {
            const status = _?.response?.status;
            const code = getResponseCode(_);
            if (status === 403 && SUBSCRIPTION_ERROR_CODES.has(code)) {
                dispatch(setSubscriptionActive(false));
                dispatch(setSubscriptionPlan(null));
                dispatch(setSubscriptionFeatures([]));
                processLogin(profile, e, p);
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
            const serverMsg = err?.response?.data?.message || err?.message || 'Invalid email or password.';
            // Always surface host/status while diagnosing Railway cutover (dev builds).
            const detail = `${serverMsg}\nAPI: ${config.BASE_API}\nHTTP: ${status || 'network'}`;
            setLoginError(detail);
            if (__DEV__) {
                Alert.alert('Sign-in failed', detail);
            }
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
                        <AppText label="Sign in with your account" fontSize={14} color={colors.textSecondary} style={styles.formSubtitle} />

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

                        {biometricAvailable && biometricEnabled && (
                            <>
                                <View style={styles.dividerRow}>
                                    <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                                    <AppText label="or" fontSize={12} color={colors.textTertiary} style={styles.dividerText} />
                                    <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                                </View>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={handleBiometricLogin}
                                    disabled={loading}
                                    style={[styles.outlineBtn, { borderColor: colors.border }]}>
                                    <Lucide name="scan-face" size={20} color={config.THEME_COLOR} />
                                    <AppText label={biometricLabel} variant={0} fontSize={14} color={colors.text} style={{ marginLeft: 8 }} />
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
        paddingTop: 5,
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
    formSubtitle: { marginBottom: 24 },
    fieldGroup: { marginBottom: 20 },
    fieldLabel: { marginLeft: 2 },
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
    outlineBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        borderRadius: 12,
        borderWidth: 1.5,
        marginBottom: 16,
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
