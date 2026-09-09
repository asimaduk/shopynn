import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    StatusBar,
    TextInput,
    TouchableOpacity,
    View,
    Dimensions,
    Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { tenants as tenantsApi, users as usersApi, billing as billingApi } from '../../services/api';
import { SUBSCRIPTION_PLANS, getSubscriptionPlan } from '../../constants/subscriptionPlans';
import { buildSignupPlansFromCatalog } from '../../utils/billingCatalog';

const { width } = Dimensions.get('window');
const TABS = [
    { id: 'business', label: 'Business & plan' },
    { id: 'owner', label: 'Owner account' },
];

const ShopOwnerSignup = ({ navigation }) => {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('business');

    const [subscriptionType, setSubscriptionType] = useState(1);
    const [businessName, setBusinessName] = useState('');
    const [businessPhone, setBusinessPhone] = useState('');
    const [companyEmail, setCompanyEmail] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [stateRegion, setStateRegion] = useState('');
    const [country, setCountry] = useState('');

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [ownerEmail, setOwnerEmail] = useState('');
    const [ownerPhone, setOwnerPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [emailOtp, setEmailOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [ownerEmailVerified, setOwnerEmailVerified] = useState(false);
    const [verificationToken, setVerificationToken] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [signupPlans, setSignupPlans] = useState(SUBSCRIPTION_PLANS);

    const planOptions = signupPlans;
    const selectedPlan = useMemo(
        () => planOptions.find((p) => p.value === subscriptionType) || getSubscriptionPlan(subscriptionType),
        [subscriptionType, planOptions],
    );

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            billingApi
                .publicCatalog()
                .then((cat) => {
                    if (cancelled) return;
                    const built = buildSignupPlansFromCatalog(cat);
                    if (built?.length) setSignupPlans(built);
                })
                .catch(() => {});
            return () => {
                cancelled = true;
            };
        }, []),
    );

    const resetEmailVerification = useCallback(() => {
        setOtpSent(false);
        setOwnerEmailVerified(false);
        setVerificationToken('');
        setEmailOtp('');
    }, []);

    const onOwnerEmailChange = (value) => {
        setOwnerEmail(value);
        resetEmailVerification();
    };

    useFocusEffect(
        useCallback(() => {
            if (Platform.OS === 'android') StatusBar.setBackgroundColor(config.THEME_COLOR);
            StatusBar.setBarStyle('light-content');
            return undefined;
        }, [])
    );

    const canContinueBusiness = useMemo(
        () =>
            businessName.trim() &&
            businessPhone.trim() &&
            companyEmail.trim() &&
            address.trim(),
        [businessName, businessPhone, companyEmail, address]
    );

    const canSubmitOwner = useMemo(
        () =>
            firstName.trim() &&
            lastName.trim() &&
            ownerEmail.trim() &&
            ownerEmailVerified &&
            ownerPhone.trim() &&
            password.trim() &&
            confirmPassword.trim(),
        [firstName, lastName, ownerEmail, ownerEmailVerified, ownerPhone, password, confirmPassword]
    );

    const handlePhoneChange = (input, setter) => {
        const raw = String(input || '');
        const cleaned = raw.replace(/[^\d+]/g, '');
        const normalized = cleaned.startsWith('+')
            ? `+${cleaned.slice(1).replace(/\+/g, '')}`
            : cleaned.replace(/\+/g, '');
        if (normalized.startsWith('+')) {
            setter(normalized.slice(0, 13));
            return;
        }
        setter(normalized.slice(0, 10));
    };

    const isValidPhone = (value) => {
        const v = String(value || '').trim();
        return /^0\d{9}$/.test(v) || /^\+233\d{9}$/.test(v);
    };

    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

    const renderLineInput = ({
        icon,
        value,
        onChangeText,
        placeholder,
        keyboardType = 'default',
        autoCapitalize = 'none',
        secureTextEntry = false,
        rightElement = null,
        multiline = false,
        isLast = false,
    }) => (
        <View
            style={[
                styles.inputRow,
                { borderBottomColor: colors.border, borderBottomWidth: isLast ? 0 : 1 },
            ]}
        >
            <Lucide name={icon} size={18} color={colors.placeholder} style={styles.inputIcon} />
            <TextInput
                style={[
                    styles.input,
                    { color: colors.text },
                    multiline && styles.inputMultiline,
                ]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.placeholder}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                secureTextEntry={secureTextEntry}
                multiline={multiline}
                textAlignVertical={multiline ? 'top' : 'center'}
            />
            {rightElement}
        </View>
    );

    const validateBusinessTab = () => {
        if (!canContinueBusiness) {
            Alert.alert('Required', 'Complete business name, phone, company email, and address.');
            return false;
        }
        if (!isValidEmail(companyEmail)) {
            Alert.alert('Invalid email', 'Enter a valid company email.');
            return false;
        }
        if (!isValidPhone(businessPhone)) {
            Alert.alert('Invalid phone', 'Company phone: use 0XXXXXXXXX or +233XXXXXXXXX.');
            return false;
        }
        return true;
    };

    const goToOwnerTab = () => {
        if (!validateBusinessTab()) return;
        setActiveTab('owner');
    };

    const sendEmailOtp = async () => {
        if (!isValidEmail(ownerEmail)) {
            Alert.alert('Invalid email', 'Enter a valid login email first.');
            return;
        }
        setSendingOtp(true);
        try {
            await usersApi.sendShopOwnerSignupEmailOtp(ownerEmail.trim().toLowerCase());
            setOwnerEmailVerified(false);
            setVerificationToken('');
            setEmailOtp('');
            setOtpSent(true);
            Alert.alert('Code sent', 'Check your inbox for a 6-digit verification code (expires in 10 minutes).');
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || 'Could not send code.';
            Alert.alert('Send failed', msg);
        } finally {
            setSendingOtp(false);
        }
    };

    const verifyEmailOtp = async () => {
        if (!isValidEmail(ownerEmail)) {
            Alert.alert('Invalid email', 'Enter a valid login email first.');
            return;
        }
        if (!/^\d{6}$/.test(String(emailOtp).trim())) {
            Alert.alert('Invalid code', 'Enter the 6-digit code from your email.');
            return;
        }
        setVerifyingOtp(true);
        try {
            const result = await usersApi.verifyShopOwnerSignupEmailOtp(
                ownerEmail.trim().toLowerCase(),
                String(emailOtp).trim()
            );
            setOwnerEmailVerified(true);
            setVerificationToken(result?.verification_token || '');
            Alert.alert('Email verified', 'You can finish creating your account.');
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || 'Verification failed.';
            Alert.alert('Verification failed', msg);
        } finally {
            setVerifyingOtp(false);
        }
    };

    const submitSignup = async () => {
        if (!validateBusinessTab()) {
            setActiveTab('business');
            return;
        }
        if (!canSubmitOwner) {
            Alert.alert('Required', 'Please complete all owner account fields.');
            return;
        }
        if (firstName.trim().length < 2 || lastName.trim().length < 2) {
            Alert.alert('Required', 'Enter your first and last name (at least 2 characters each).');
            return;
        }
        if (!isValidEmail(ownerEmail)) {
            Alert.alert('Invalid email', 'Enter a valid login email for the owner account.');
            return;
        }
        if (!isValidPhone(ownerPhone)) {
            Alert.alert('Invalid phone', 'Owner phone: use 0XXXXXXXXX or +233XXXXXXXXX.');
            return;
        }
        if (password.length < 8) {
            Alert.alert('Invalid password', 'Password must be at least 8 characters.');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Password mismatch', 'Password and confirm password must match.');
            return;
        }
        if (!ownerEmailVerified || !verificationToken) {
            Alert.alert('Verify email', 'Verify your owner login email with the code we sent before creating your account.');
            return;
        }

        setLoading(true);
        try {
            await tenantsApi.setup({
                name: businessName.trim(),
                phone: businessPhone.trim(),
                email: companyEmail.trim().toLowerCase(),
                address: address.trim(),
                city: city.trim() || undefined,
                state: stateRegion.trim() || undefined,
                country: country.trim() || undefined,
                subscription_type: subscriptionType,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                owner_email: ownerEmail.trim().toLowerCase(),
                owner_phone: ownerPhone.trim(),
                verification_token: verificationToken,
                password,
                registration_method: 'mobile_app',
                notes: 'Signup from Shopynn mobile app',
            });

            const plan = getSubscriptionPlan(subscriptionType);
            const accessNote = plan.activatesImmediately
                ? 'Your subscription is active for 14 days. Sign in and start using the app.'
                : 'Your plan is reserved. Sign in, then open Subscription in the app to pay and activate.';

            Alert.alert('Account created', `Your shop account is ready on the ${plan.label} plan. ${accessNote}`, [
                {
                    text: 'Sign in',
                    onPress: () =>
                        navigation.navigate('Login', { prefillEmail: ownerEmail.trim().toLowerCase() }),
                },
            ]);
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || 'Could not create shop account.';
            Alert.alert('Signup failed', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.keyboard, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {isFocused ? (
                <StatusBar barStyle="light-content" backgroundColor={config.THEME_COLOR} />
            ) : null}
            {insets.top > 0 && (
                <View style={[styles.statusBarFill, { height: insets.top, backgroundColor: config.THEME_COLOR }]} />
            )}
            <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <View style={[styles.brandStrip, { backgroundColor: config.THEME_COLOR }]}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Lucide name="arrow-left" size={20} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.brandStripInner}>
                            <View style={styles.brandIconWrap}>
                                <Image
                                    source={require('../../assets/images/logo/ims-logo.png')}
                                    style={styles.brandLogoImage}
                                    resizeMode="contain"
                                />
                            </View>
                            <AppText label="Shopynn" variant={1} fontSize={26} color="#fff" style={styles.brandTitle} />
                            <AppText label="Create shop owner account" fontSize={13} color="rgba(255,255,255,0.85)" />
                        </View>
                    </View>

                    <View style={styles.formSection}>
                        <AppText
                            label="Set up your business, choose a plan, then create your owner login."
                            fontSize={14}
                            color={colors.textSecondary}
                            style={styles.formSubtitle}
                        />

                        <View style={styles.tabRow}>
                            {TABS.map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <TouchableOpacity
                                        key={tab.id}
                                        onPress={() => {
                                            if (tab.id === 'owner' && !validateBusinessTab()) return;
                                            setActiveTab(tab.id);
                                        }}
                                        style={[
                                            styles.tabBtn,
                                            {
                                                borderColor: isActive ? config.THEME_COLOR : colors.border,
                                                backgroundColor: isActive ? `${config.THEME_COLOR}14` : colors.surface,
                                            },
                                        ]}
                                    >
                                        <AppText
                                            label={tab.label}
                                            fontSize={13}
                                            variant={isActive ? 1 : 0}
                                            color={isActive ? config.THEME_COLOR : colors.textSecondary}
                                        />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {activeTab === 'business' ? (
                            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <AppText label="Plan" variant={1} fontSize={15} color={colors.text} style={styles.sectionLabel} />
                                {planOptions.map((plan) => {
                                    const selected = subscriptionType === plan.value;
                                    return (
                                        <TouchableOpacity
                                            key={plan.value}
                                            activeOpacity={0.85}
                                            onPress={() => setSubscriptionType(plan.value)}
                                            style={[
                                                styles.planCard,
                                                {
                                                    borderColor: selected ? config.THEME_COLOR : colors.border,
                                                    backgroundColor: selected
                                                        ? `${config.THEME_COLOR}10`
                                                        : colors.surfaceSecondary,
                                                },
                                            ]}
                                        >
                                            <View style={styles.planCardHeader}>
                                                <AppText
                                                    label={plan.label}
                                                    variant={selected ? 1 : 0}
                                                    color={colors.text}
                                                    fontSize={14}
                                                />
                                                {selected ? (
                                                    <Lucide name="circle-check" size={18} color={config.THEME_COLOR} />
                                                ) : (
                                                    <View
                                                        style={[styles.planRadio, { borderColor: colors.border }]}
                                                    />
                                                )}
                                            </View>
                                            <AppText
                                                label={plan.description}
                                                fontSize={11}
                                                color={colors.textSecondary}
                                                style={{ marginTop: 4 }}
                                            />
                                        </TouchableOpacity>
                                    );
                                })}
                                {!selectedPlan.activatesImmediately ? (
                                    <View
                                        style={[
                                            styles.planHint,
                                            { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                                        ]}
                                    >
                                        <Lucide name="info" size={14} color={colors.textSecondary} />
                                        <AppText
                                            label="Try Free — 14 days to sign in immediately, then upgrade from Subscription when ready."
                                            fontSize={11}
                                            color={colors.textSecondary}
                                            style={{ flex: 1, marginLeft: 8 }}
                                        />
                                    </View>
                                ) : null}

                                <AppText
                                    label="Business details"
                                    variant={1}
                                    fontSize={15}
                                    color={colors.text}
                                    style={[styles.sectionLabel, { marginTop: 16 }]}
                                />
                                {renderLineInput({
                                    icon: 'building-2',
                                    value: businessName,
                                    onChangeText: setBusinessName,
                                    placeholder: 'Business / store name',
                                    autoCapitalize: 'words',
                                })}
                                {renderLineInput({
                                    icon: 'phone',
                                    value: businessPhone,
                                    onChangeText: (t) => handlePhoneChange(t, setBusinessPhone),
                                    placeholder: 'Company phone (0XXXXXXXXX)',
                                    keyboardType: 'phone-pad',
                                })}
                                {renderLineInput({
                                    icon: 'mail',
                                    value: companyEmail,
                                    onChangeText: setCompanyEmail,
                                    placeholder: 'Company email',
                                    keyboardType: 'email-address',
                                })}
                                {renderLineInput({
                                    icon: 'map-pin',
                                    value: address,
                                    onChangeText: setAddress,
                                    placeholder: 'Street address',
                                    autoCapitalize: 'words',
                                    multiline: true,
                                })}
                                {renderLineInput({
                                    icon: 'map',
                                    value: city,
                                    onChangeText: setCity,
                                    placeholder: 'City',
                                    autoCapitalize: 'words',
                                })}
                                {renderLineInput({
                                    icon: 'map',
                                    value: stateRegion,
                                    onChangeText: setStateRegion,
                                    placeholder: 'State / region',
                                    autoCapitalize: 'words',
                                })}
                                {renderLineInput({
                                    icon: 'globe',
                                    value: country,
                                    onChangeText: setCountry,
                                    placeholder: 'Country',
                                    autoCapitalize: 'words',
                                    isLast: true,
                                })}

                                <TouchableOpacity
                                    onPress={goToOwnerTab}
                                    disabled={!canContinueBusiness}
                                    style={[styles.primaryBtn, !canContinueBusiness && { opacity: 0.6 }]}
                                >
                                    <AppText label="Continue to owner account" variant={1} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <AppText
                                    label="Account owner"
                                    variant={1}
                                    fontSize={15}
                                    color={colors.text}
                                    style={styles.sectionLabel}
                                />
                                <AppText
                                    label="This person signs in to manage inventory, sales, and orders."
                                    fontSize={12}
                                    color={colors.textSecondary}
                                    style={{ marginBottom: 10 }}
                                />
                                <View style={styles.rowFields}>
                                    <View style={styles.halfField}>
                                        {renderLineInput({
                                            icon: 'user',
                                            value: firstName,
                                            onChangeText: setFirstName,
                                            placeholder: 'First name',
                                            autoCapitalize: 'words',
                                        })}
                                    </View>
                                    <View style={styles.halfField}>
                                        {renderLineInput({
                                            icon: 'user',
                                            value: lastName,
                                            onChangeText: setLastName,
                                            placeholder: 'Last name',
                                            autoCapitalize: 'words',
                                        })}
                                    </View>
                                </View>
                                {renderLineInput({
                                    icon: 'mail',
                                    value: ownerEmail,
                                    onChangeText: onOwnerEmailChange,
                                    placeholder: 'Login email',
                                    keyboardType: 'email-address',
                                })}

                                <View style={styles.emailVerifyBlock}>
                                    <TouchableOpacity
                                        onPress={sendEmailOtp}
                                        disabled={sendingOtp || !ownerEmail.trim() || ownerEmailVerified}
                                        style={[
                                            styles.otpSendBtn,
                                            {
                                                borderColor: config.THEME_COLOR,
                                                opacity:
                                                    sendingOtp || !ownerEmail.trim() || ownerEmailVerified
                                                        ? 0.5
                                                        : 1,
                                            },
                                        ]}
                                    >
                                        {sendingOtp ? (
                                            <ActivityIndicator color={config.THEME_COLOR} size="small" />
                                        ) : (
                                            <AppText
                                                label={otpSent ? 'Resend code' : 'Send verification code'}
                                                color={config.THEME_COLOR}
                                                fontSize={13}
                                                variant={1}
                                            />
                                        )}
                                    </TouchableOpacity>

                                    {ownerEmailVerified ? (
                                        <View
                                            style={[
                                                styles.verifiedBanner,
                                                { backgroundColor: '#dcfce7', borderColor: '#86efac' },
                                            ]}
                                        >
                                            <Lucide name="check-circle" size={16} color="#16a34a" />
                                            <AppText
                                                label="Email verified"
                                                color="#16a34a"
                                                fontSize={13}
                                                variant={1}
                                                style={{ marginLeft: 6 }}
                                            />
                                        </View>
                                    ) : otpSent ? (
                                        <>
                                            <View style={[styles.otpRow, { borderBottomColor: colors.border }]}>
                                                <Lucide
                                                    name="key-round"
                                                    size={18}
                                                    color={colors.placeholder}
                                                    style={styles.inputIcon}
                                                />
                                                <TextInput
                                                    style={[styles.input, { color: colors.text }]}
                                                    value={emailOtp}
                                                    onChangeText={(t) =>
                                                        setEmailOtp(String(t).replace(/\D/g, '').slice(0, 6))
                                                    }
                                                    placeholder="6-digit code"
                                                    placeholderTextColor={colors.placeholder}
                                                    keyboardType="number-pad"
                                                    maxLength={6}
                                                />
                                            </View>
                                            <TouchableOpacity
                                                onPress={verifyEmailOtp}
                                                disabled={verifyingOtp || emailOtp.length !== 6}
                                                style={[
                                                    styles.primaryBtn,
                                                    styles.verifyOtpBtn,
                                                    (verifyingOtp || emailOtp.length !== 6) && { opacity: 0.6 },
                                                ]}
                                            >
                                                {verifyingOtp ? (
                                                    <ActivityIndicator color="#fff" />
                                                ) : (
                                                    <AppText label="Verify email" variant={1} color="#fff" />
                                                )}
                                            </TouchableOpacity>
                                        </>
                                    ) : (
                                        <AppText
                                            label="We will send a 6-digit code to confirm you own this email."
                                            fontSize={11}
                                            color={colors.textSecondary}
                                        />
                                    )}
                                </View>

                                {renderLineInput({
                                    icon: 'smartphone',
                                    value: ownerPhone,
                                    onChangeText: (t) => handlePhoneChange(t, setOwnerPhone),
                                    placeholder: 'Owner mobile (0XXXXXXXXX)',
                                    keyboardType: 'phone-pad',
                                })}
                                {renderLineInput({
                                    icon: 'lock',
                                    value: password,
                                    onChangeText: setPassword,
                                    placeholder: 'Password (min 8 characters)',
                                    secureTextEntry: !showPassword,
                                    rightElement: (
                                        <TouchableOpacity
                                            onPress={() => setShowPassword((p) => !p)}
                                            style={styles.eyeBtn}
                                        >
                                            <Lucide
                                                name={showPassword ? 'eye-off' : 'eye'}
                                                size={18}
                                                color={colors.placeholder}
                                            />
                                        </TouchableOpacity>
                                    ),
                                })}
                                {renderLineInput({
                                    icon: 'shield-check',
                                    value: confirmPassword,
                                    onChangeText: setConfirmPassword,
                                    placeholder: 'Confirm password',
                                    secureTextEntry: !showPassword,
                                    isLast: true,
                                })}

                                <TouchableOpacity
                                    onPress={() => setActiveTab('business')}
                                    style={styles.secondaryBtn}
                                >
                                    <AppText label="Back to business" color={config.THEME_COLOR} fontSize={14} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={submitSignup}
                                    disabled={!canSubmitOwner || loading}
                                    style={[styles.primaryBtn, (!canSubmitOwner || loading) && { opacity: 0.6 }]}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <AppText label="Create shop account" variant={1} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={() => navigation.navigate('ChooseAccountType')}
                            style={styles.switchTypeBtn}
                        >
                            <AppText label="Choose a different account type" color={config.THEME_COLOR} fontSize={13} />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.footerHint, { borderTopColor: colors.border }]}>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <AppText label="Already have an account? Sign in" fontSize={12} color={config.THEME_COLOR} />
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    keyboard: { flex: 1 },
    safeArea: { flex: 1 },
    statusBarFill: { width: '100%' },
    content: { paddingBottom: 30 },
    brandStrip: {
        width,
        paddingTop: 8,
        paddingBottom: 28,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    backBtn: {
        position: 'absolute',
        left: 16,
        top: 10,
        zIndex: 2,
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandStripInner: { alignItems: 'center' },
    brandIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    brandLogoImage: {
        width: 44,
        height: 44,
    },
    brandTitle: { marginBottom: 4 },
    formSection: { paddingHorizontal: 20, paddingTop: 20 },
    formSubtitle: { marginBottom: 14 },
    tabRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    tabBtn: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    card: { borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 14 },
    sectionLabel: { marginBottom: 8 },
    planCard: {
        borderWidth: 1.5,
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    planCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    planRadio: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
    },
    planHint: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        marginBottom: 4,
    },
    rowFields: { flexDirection: 'row', gap: 8 },
    halfField: { flex: 1 },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        marginBottom: 10,
        paddingTop: 4,
    },
    inputIcon: { marginRight: 12, marginTop: 12 },
    input: {
        flex: 1,
        minHeight: 44,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
        paddingVertical: 10,
    },
    inputMultiline: { minHeight: 56, paddingTop: 10 },
    eyeBtn: { padding: 8, marginTop: 4 },
    emailVerifyBlock: { marginBottom: 12, marginTop: 4 },
    otpSendBtn: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 10,
    },
    verifiedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    otpRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        marginBottom: 10,
    },
    verifyOtpBtn: { marginTop: 0 },
    primaryBtn: {
        height: 46,
        borderRadius: 8,
        backgroundColor: config.THEME_COLOR,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    secondaryBtn: {
        alignItems: 'center',
        paddingVertical: 10,
        marginTop: 4,
    },
    switchTypeBtn: { alignItems: 'center', paddingVertical: 8 },
    footerHint: {
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderTopWidth: 1,
        marginTop: 8,
    },
});

export default ShopOwnerSignup;
