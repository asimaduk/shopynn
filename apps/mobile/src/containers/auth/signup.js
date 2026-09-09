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
import { users as usersApi } from '../../services/api';
import {
    normalizeReferenceCodeInput,
    validateReferenceCode,
    REFERENCE_CODE_MIN_LENGTH,
} from '../../components/warehouse_reference_code_field';

const STEPS = ['Store verification', 'Account details'];
const { width } = Dimensions.get('window');

const CustomerSignup = ({ navigation }) => {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    const [referenceCode, setReferenceCode] = useState('');
    const [referenceData, setReferenceData] = useState(null);

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // useFocusEffect(
    //     useCallback(() => {
    //         if (Platform.OS === 'android') StatusBar.setBackgroundColor(config.THEME_COLOR);
    //         StatusBar.setBarStyle('light-content');
    //         return () => {
    //             if (Platform.OS === 'android') StatusBar.setBackgroundColor(colors.background);
    //             if (Platform.OS === 'android') StatusBar.setBarStyle('dark-content');
    //         };
    //     }, [colors.background])
    // );

    useFocusEffect(
        useCallback(() => {
            if (Platform.OS === 'android') StatusBar.setBackgroundColor(config.THEME_COLOR);
            StatusBar.setBarStyle('light-content');
            return undefined;
        }, [])
    );

    const canVerifyReference = useMemo(
        () => !validateReferenceCode(referenceCode),
        [referenceCode]
    );
    const canSubmitSignup = useMemo(() => {
        return (
            firstName.trim() &&
            lastName.trim() &&
            email.trim() &&
            phone.trim() &&
            password.trim() &&
            confirmPassword.trim()
        );
    }, [firstName, lastName, email, phone, password, confirmPassword]);

    const handlePhoneChange = (input) => {
        const raw = String(input || '');
        const cleaned = raw.replace(/[^\d+]/g, '');

        // Keep only one leading '+', if present
        const normalized = cleaned.startsWith('+')
            ? `+${cleaned.slice(1).replace(/\+/g, '')}`
            : cleaned.replace(/\+/g, '');

        if (normalized.startsWith('+')) {
            setPhone(normalized.slice(0, 13));
            return;
        }

        setPhone(normalized.slice(0, 10));
    };

    const isValidPhone = (value) => {
        const v = String(value || '').trim();
        return /^0\d{9}$/.test(v) || /^\+233\d{9}$/.test(v);
    };

    const isValidEmail = (value) => {
        const v = String(value || '').trim();
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    };

    const verifyReference = async () => {
        const refErr = validateReferenceCode(referenceCode);
        if (refErr) {
            Alert.alert('Invalid code', refErr);
            return;
        }
        setLoading(true);
        try {
            const data = await usersApi.verifyStoreReference(normalizeReferenceCodeInput(referenceCode));
            setReferenceData(data);
            setStep(1);
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || 'Could not verify reference code.';
            Alert.alert('Verification failed', msg);
        } finally {
            setLoading(false);
        }
    };

    const submitSignup = async () => {
        if (!canSubmitSignup) {
            Alert.alert('Required', 'Please complete all fields.');
            return;
        }
        if(firstName.trim().length < 2 || lastName.trim().length < 2) {
            Alert.alert('Required', 'Please enter your first and last name. Minimum 2 characters required.');
            return;
        }
        if(!isValidEmail(email)) {
            Alert.alert('Invalid email address', 'Please enter a valid email address.');
            return;
        }
        if (!isValidPhone(phone)) {
            Alert.alert('Invalid phone number', 'Use 0XXXXXXXXX (10 digits) or +233XXXXXXXXX (13 characters).');
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

        setLoading(true);
        try {
            await usersApi.customerSignup({
                reference_code: normalizeReferenceCodeInput(referenceCode),
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                email: email.trim().toLowerCase(),
                phone: phone.trim(),
                password,
            });
            Alert.alert('Success', 'Your account has been created. Please sign in to continue.', [
                { text: 'OK', onPress: () => navigation.navigate('Login', { prefillEmail: email.trim().toLowerCase() }) },
            ]);
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || 'Signup failed.';
            Alert.alert('Signup failed', msg);
        } finally {
            setLoading(false);
        }
    };

    const renderLineInput = ({ label, icon, value, onChangeText, placeholder, keyboardType = 'default', autoCapitalize = 'none', containerStyle }) => (
        <View style={[styles.fieldGroup, containerStyle]}>
            {/* <AppText label={label} fontSize={12} color={colors.textTertiary} style={styles.fieldLabel} /> */}
            <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
                <Lucide name={icon} size={18} color={colors.placeholder} style={styles.inputIcon} />
                <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.placeholder}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                />
            </View>
        </View>
    );

    return (
        <KeyboardAvoidingView style={[styles.keyboard, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {isFocused ? (
                <StatusBar barStyle="light-content" backgroundColor={config.THEME_COLOR} />
            ) : null}
            {insets.top > 0 && <View style={[styles.statusBarFill, { height: insets.top, backgroundColor: config.THEME_COLOR }]} />}
            <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <View style={[styles.brandStrip, { backgroundColor: config.THEME_COLOR }]}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBackBtn}>
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
                            <AppText label="Customer account" fontSize={13} color="rgba(255,255,255,0.85)" />
                        </View>
                    </View>

                    <View style={[styles.formSection, { backgroundColor: colors.background }]}>
                        {/* <View style={styles.headerRow}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { borderColor: colors.border }]}>
                                <Lucide name="arrow-left" size={16} color={colors.text} />
                            </TouchableOpacity>
                            <AppText label="Create customer account" variant={1} fontSize={20} color={colors.text} />
                        </View> */}
                        <AppText
                            label="Connect to a store with a reference code and create your customer login to browse and order."
                            fontSize={14}
                            color={colors.textSecondary}
                            style={styles.formSubtitle}
                        />

                        <View style={styles.stepRow}>
                            {STEPS.map((label, idx) => {
                                const isActive = idx === step;
                                const isComplete = idx < step;
                                return (
                                    <View key={label} style={styles.stepItem}>
                                        <View style={styles.stepTrackWrap}>
                                            <View
                                                style={[
                                                    styles.stepCircle,
                                                    {
                                                        backgroundColor: isActive || isComplete ? config.THEME_COLOR : colors.surfaceSecondary,
                                                        borderColor: isActive || isComplete ? config.THEME_COLOR : colors.border,
                                                    },
                                                ]}
                                            >
                                                {isComplete ? (
                                                    <Lucide name="check" size={13} color="#fff" />
                                                ) : (
                                                    <AppText
                                                        label={String(idx + 1)}
                                                        color={isActive ? '#fff' : colors.textSecondary}
                                                        fontSize={12}
                                                        variant={isActive ? 1 : 0}
                                                    />
                                                )}
                                            </View>
                                            {idx < STEPS.length - 1 && (
                                                <View
                                                    style={[
                                                        styles.stepConnector,
                                                        { backgroundColor: idx < step ? config.THEME_COLOR : colors.border },
                                                    ]}
                                                />
                                            )}
                                        </View>
                                        <AppText
                                            label={label}
                                            color={isActive ? colors.text : colors.textSecondary}
                                            fontSize={12}
                                            style={styles.stepLabel}
                                        />
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {step === 0 && (
                        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <AppText label="Enter store reference code" variant={1} fontSize={15} color={colors.text} style={{ marginBottom: 8 }} />
                            {renderLineInput({
                                label: 'Reference code',
                                icon: 'hash',
                                value: referenceCode,
                                onChangeText: (text) => setReferenceCode(normalizeReferenceCodeInput(text)),
                                placeholder: `e.g. MN-STORE-A1B2 (${REFERENCE_CODE_MIN_LENGTH}+ characters)`,
                                autoCapitalize: 'characters',
                            })}
                            <TouchableOpacity
                                onPress={verifyReference}
                                disabled={!canVerifyReference || loading}
                                style={[styles.primaryBtn, (!canVerifyReference || loading) && { opacity: 0.6 }]}
                            >
                                {loading ? <ActivityIndicator color="#fff" /> : <AppText label="Verify store" variant={1} color="#fff" />}
                            </TouchableOpacity>
                        </View>
                    )}

                    {step === 1 && (
                        <>
                            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <AppText label="Store confirmed" variant={1} fontSize={15} color={colors.text} />
                                <AppText label={`Store: ${referenceData?.store?.name || '—'}`} color={colors.textSecondary} style={styles.meta} />
                                <AppText label={`Address: ${referenceData?.store?.address || '—'}`} color={colors.textSecondary} style={styles.meta} />
                                <AppText label={`Company: ${referenceData?.company?.name || '—'}`} color={colors.textSecondary} style={styles.meta} />
                                <View style={{flexDirection:'row'}}>
                                    <TouchableOpacity onPress={() => setStep(0)} style={{ marginTop: 10 }}>
                                        <AppText label="Use another reference code" color={config.THEME_COLOR} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <View style={styles.rowFields}>
                                    {renderLineInput({
                                        label: 'First name',
                                        icon: 'user',
                                        value: firstName,
                                        onChangeText: setFirstName,
                                        placeholder: 'First name',
                                        autoCapitalize: 'words',
                                        containerStyle: styles.halfField,
                                    })}
                                    {renderLineInput({
                                        label: 'Last name',
                                        icon: 'user',
                                        value: lastName,
                                        onChangeText: setLastName,
                                        placeholder: 'Last name',
                                        autoCapitalize: 'words',
                                        containerStyle: styles.halfField,
                                    })}
                                </View>
                                {renderLineInput({
                                    label: 'Email',
                                    icon: 'mail',
                                    value: email,
                                    onChangeText: setEmail,
                                    placeholder: 'you@example.com',
                                    keyboardType: 'email-address',
                                    autoCapitalize: 'none',
                                })}
                                {renderLineInput({
                                    label: 'Phone',
                                    icon: 'phone',
                                    value: phone,
                                    onChangeText: handlePhoneChange,
                                    placeholder: '0XXXXXXXXX or +233XXXXXXXXX',
                                    keyboardType: 'phone-pad',
                                    autoCapitalize: 'none',
                                })}

                                <View style={styles.rowFields}>
                                    <View style={[styles.passwordWrap, styles.halfField]}>
                                        {/* <AppText label="Password" fontSize={12} color={colors.textTertiary} style={styles.fieldLabel} /> */}
                                        <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
                                            <Lucide name="lock" size={18} color={colors.placeholder} style={styles.inputIcon} />
                                            <TextInput
                                                value={password}
                                                onChangeText={setPassword}
                                                secureTextEntry={!showPassword}
                                                placeholder="Password"
                                                placeholderTextColor={colors.placeholder}
                                                style={[styles.input, { color: colors.text }]}
                                            />
                                            {/* <TouchableOpacity onPress={() => setShowPassword((p) => !p)} style={styles.eyeBtn}>
                                                <Lucide name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.placeholder} />
                                            </TouchableOpacity> */}
                                        </View>
                                    </View>

                                    <View style={[styles.passwordWrap, styles.halfField]}>
                                        {/* <AppText label="Confirm password" fontSize={12} color={colors.textTertiary} style={styles.fieldLabel} /> */}
                                        <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
                                            {/* <Lucide name="shield-check" size={18} color={colors.placeholder} style={styles.inputIcon} /> */}
                                            <TextInput
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                                secureTextEntry={!showConfirmPassword}
                                                placeholder="Confirm password"
                                                placeholderTextColor={colors.placeholder}
                                                style={[styles.input, { color: colors.text }]}
                                            />
                                            <TouchableOpacity onPress={() => { setShowPassword((p) => !p); setShowConfirmPassword((p) => !p); }} style={styles.eyeBtn}>
                                                <Lucide name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color={colors.placeholder} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={submitSignup}
                                    disabled={!canSubmitSignup || loading}
                                    style={[styles.primaryBtn, (!canSubmitSignup || loading) && { opacity: 0.6 }]}
                                >
                                    {loading ? <ActivityIndicator color="#fff" /> : <AppText label="Create account" variant={1} color="#fff" />}
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                    <TouchableOpacity
                        onPress={() => navigation.navigate('ChooseAccountType')}
                        style={{ alignItems: 'center', paddingVertical: 10 }}
                    >
                        <AppText label="Need a shop owner account instead?" color={config.THEME_COLOR} fontSize={13} />
                    </TouchableOpacity>
                    <View style={[styles.footerHint, { borderTopColor: colors.border }]}>
                        <Lucide name="badge-info" size={14} color={colors.textTertiary} />
                        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginLeft: 8 }}>
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
    footerHint: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, borderTopWidth: 1 }, 
    brandStrip: {
        width,
        paddingTop: 8,
        paddingBottom: 28,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    topBackBtn: {
        position: 'absolute',
        left: 16,
        top: 8,
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
    formSection: { paddingHorizontal: 20, paddingTop: 24 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    formSubtitle: { marginBottom: 16 },
    backBtn: { width: 34, height: 34, borderWidth: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    stepRow: { flexDirection: 'row', marginBottom: 16, justifyContent: 'space-between' },
    stepItem: { flex: 1, alignItems: 'center' },
    stepTrackWrap: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
    stepCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.2,
        zIndex: 2,
    },
    stepConnector: { flex: 1, height: 2, marginLeft: 8, marginRight: 2, borderRadius: 1 },
    stepLabel: { lineHeight: 16, marginTop: 8, textAlign: 'center', paddingHorizontal: 6 },
    card: { borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 14 },
    rowFields: { flexDirection: 'row', gap: 10 },
    halfField: { flex: 1 },
    fieldGroup: { marginBottom: 10 },
    fieldLabel: { marginLeft: 2, marginBottom: 2 },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1.5,
        // paddingVertical: 8,
        // backgroundColor: 'red',
    },
    inputIcon: { marginRight: 12 },
    input: {
        flex: 1,
        height: 44,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
        paddingVertical: 0,
    },
    passwordWrap: { position: 'relative', marginBottom: 10 },
    eyeBtn: { padding: 8 },
    meta: { marginTop: 6 },
    primaryBtn: { height: 46, borderRadius: 8, backgroundColor: config.THEME_COLOR, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
});

export default CustomerSignup;
