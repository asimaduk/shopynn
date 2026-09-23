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

const STEPS = ['Store', 'Phone', 'Name'];
const { width } = Dimensions.get('window');

const CustomerSignup = ({ navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    const [referenceCode, setReferenceCode] = useState('');
    const [referenceData, setReferenceData] = useState(null);

    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [devCode, setDevCode] = useState(null);
    const [sessionToken, setSessionToken] = useState(null);
    const [existingCustomer, setExistingCustomer] = useState(false);

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    useFocusEffect(
        useCallback(() => {
            if (Platform.OS === 'android') StatusBar.setBackgroundColor(config.THEME_COLOR);
            StatusBar.setBarStyle('light-content');
            return undefined;
        }, [])
    );

    const canVerifyReference = useMemo(() => !validateReferenceCode(referenceCode), [referenceCode]);

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
            setOtpSent(false);
            setOtp('');
            setSessionToken(null);
            setDevCode(null);
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || 'Could not verify reference code.';
            Alert.alert('Verification failed', msg);
        } finally {
            setLoading(false);
        }
    };

    const sendOtp = async () => {
        if (phone.length !== 10) {
            Alert.alert('Invalid phone', 'Enter a 10-digit mobile number (e.g. 024XXXXXXX).');
            return;
        }
        setLoading(true);
        try {
            const data = await usersApi.sendCustomerSignupOtp({
                phone,
                reference_code: normalizeReferenceCodeInput(referenceCode),
            });
            setOtpSent(true);
            setDevCode(data?.dev_code || null);
            if (data?.phone) {
                let n = String(data.phone).replace(/\D/g, '');
                if (n.startsWith('233') && n.length >= 12) n = `0${n.slice(3)}`;
                setPhone(n.slice(0, 10));
            }
            Alert.alert(
                'Code sent',
                data?.dev_code ? `Dev code: ${data.dev_code}` : 'Enter the SMS code we sent to your phone.'
            );
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || 'Could not send code.';
            Alert.alert('Could not send code', msg);
        } finally {
            setLoading(false);
        }
    };

    const verifyOtp = async () => {
        if (String(otp).trim().length < 6) {
            Alert.alert('Required', 'Enter the 6-digit code.');
            return;
        }
        setLoading(true);
        try {
            const data = await usersApi.verifyCustomerSignupOtp({
                phone,
                otp: String(otp).trim(),
                reference_code: normalizeReferenceCodeInput(referenceCode),
            });
            setSessionToken(data?.session_token);
            setExistingCustomer(Boolean(data?.existing_customer));
            if (data?.first_name) setFirstName(String(data.first_name));
            if (data?.last_name) setLastName(String(data.last_name));
            setStep(2);
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || 'Invalid code.';
            Alert.alert('Verification failed', msg);
        } finally {
            setLoading(false);
        }
    };

    const completeSignup = async () => {
        if (!sessionToken) {
            Alert.alert('Required', 'Verify your phone first.');
            setStep(1);
            return;
        }
        if (!existingCustomer && (firstName.trim().length < 2 || lastName.trim().length < 2)) {
            Alert.alert('Required', 'Enter your first and last name (min 2 characters each).');
            return;
        }
        setLoading(true);
        try {
            await usersApi.customerSignup({
                reference_code: normalizeReferenceCodeInput(referenceCode),
                phone,
                session_token: sessionToken,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
            });
            Alert.alert(
                'You\'re set',
                'Your customer account is ready. Sign in with Phone using the same number.',
                [
                    {
                        text: 'Sign in',
                        onPress: () =>
                            navigation.navigate('Login', {
                                authMode: 'phone',
                                prefillPhone: phone,
                            }),
                    },
                ]
            );
        } catch (error) {
            const msg = error?.response?.data?.message || error?.message || 'Signup failed.';
            Alert.alert('Signup failed', msg);
        } finally {
            setLoading(false);
        }
    };

    const renderLineInput = ({
        icon,
        value,
        onChangeText,
        placeholder,
        keyboardType = 'default',
        autoCapitalize = 'none',
        maxLength,
        containerStyle,
    }) => (
        <View style={[styles.fieldGroup, containerStyle]}>
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
                    maxLength={maxLength}
                />
            </View>
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={[styles.keyboard, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {isFocused ? <StatusBar barStyle="light-content" backgroundColor={config.THEME_COLOR} /> : null}
            {insets.top > 0 && (
                <View style={[styles.statusBarFill, { height: insets.top, backgroundColor: config.THEME_COLOR }]} />
            )}
            <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
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
                        <AppText
                            label="Same as WhatsApp ordering: link a store, verify your phone, then you can sign in with Phone anytime."
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
                                                        backgroundColor:
                                                            isActive || isComplete ? config.THEME_COLOR : colors.surfaceSecondary,
                                                        borderColor:
                                                            isActive || isComplete ? config.THEME_COLOR : colors.border,
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
                            <AppText
                                label="Enter store reference code"
                                variant={1}
                                fontSize={15}
                                color={colors.text}
                                style={{ marginBottom: 8 }}
                            />
                            {renderLineInput({
                                icon: 'hash',
                                value: referenceCode,
                                onChangeText: (text) => setReferenceCode(normalizeReferenceCodeInput(text)),
                                placeholder: `e.g. mn-store-a1b2 (${REFERENCE_CODE_MIN_LENGTH}+ characters)`,
                                autoCapitalize: 'characters',
                            })}
                            <TouchableOpacity
                                onPress={verifyReference}
                                disabled={!canVerifyReference || loading}
                                style={[styles.primaryBtn, (!canVerifyReference || loading) && { opacity: 0.6 }]}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <AppText label="Continue" variant={1} color="#fff" />
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {step === 1 && (
                        <>
                            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <AppText label="Store confirmed" variant={1} fontSize={15} color={colors.text} />
                                <AppText
                                    label={`Store: ${referenceData?.store?.name || '—'}`}
                                    color={colors.textSecondary}
                                    style={styles.meta}
                                />
                                <TouchableOpacity onPress={() => setStep(0)} style={{ marginTop: 10 }}>
                                    <AppText label="Use another code" color={config.THEME_COLOR} />
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <AppText
                                    label="Verify mobile number"
                                    variant={1}
                                    fontSize={15}
                                    color={colors.text}
                                    style={{ marginBottom: 8 }}
                                />
                                {renderLineInput({
                                    icon: 'smartphone',
                                    value: phone,
                                    onChangeText: (v) => {
                                        setPhone(String(v || '').replace(/\D/g, '').slice(0, 10));
                                        setOtpSent(false);
                                        setSessionToken(null);
                                    },
                                    placeholder: '024 XXX XXXX',
                                    keyboardType: 'phone-pad',
                                    maxLength: 10,
                                })}
                                {otpSent ? (
                                    <>
                                        {renderLineInput({
                                            icon: 'shield-check',
                                            value: otp,
                                            onChangeText: (v) => setOtp(String(v || '').replace(/\D/g, '').slice(0, 6)),
                                            placeholder: '6-digit code',
                                            keyboardType: 'number-pad',
                                            maxLength: 6,
                                        })}
                                        {devCode ? (
                                            <AppText
                                                label={`Dev code: ${devCode}`}
                                                fontSize={12}
                                                color={colors.textTertiary}
                                                style={{ marginBottom: 8 }}
                                            />
                                        ) : null}
                                        <TouchableOpacity
                                            onPress={verifyOtp}
                                            disabled={loading || String(otp).trim().length < 6}
                                            style={[
                                                styles.primaryBtn,
                                                (loading || String(otp).trim().length < 6) && { opacity: 0.6 },
                                            ]}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color="#fff" />
                                            ) : (
                                                <AppText label="Verify code" variant={1} color="#fff" />
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={sendOtp} disabled={loading} style={{ marginTop: 10 }}>
                                            <AppText label="Resend code" color={config.THEME_COLOR} />
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <TouchableOpacity
                                        onPress={sendOtp}
                                        disabled={loading || phone.length !== 10}
                                        style={[styles.primaryBtn, (loading || phone.length !== 10) && { opacity: 0.6 }]}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <AppText label="Send code" variant={1} color="#fff" />
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        </>
                    )}

                    {step === 2 && (
                        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <AppText
                                label={existingCustomer ? 'Confirm your name' : 'Your name'}
                                variant={1}
                                fontSize={15}
                                color={colors.text}
                                style={{ marginBottom: 8 }}
                            />
                            <AppText
                                label={`Phone verified: ${phone}`}
                                fontSize={12}
                                color={colors.textTertiary}
                                style={{ marginBottom: 10 }}
                            />
                            <View style={styles.rowFields}>
                                {renderLineInput({
                                    icon: 'user',
                                    value: firstName,
                                    onChangeText: setFirstName,
                                    placeholder: 'First name',
                                    autoCapitalize: 'words',
                                    containerStyle: styles.halfField,
                                })}
                                {renderLineInput({
                                    icon: 'user',
                                    value: lastName,
                                    onChangeText: setLastName,
                                    placeholder: 'Last name',
                                    autoCapitalize: 'words',
                                    containerStyle: styles.halfField,
                                })}
                            </View>
                            <TouchableOpacity
                                onPress={completeSignup}
                                disabled={loading}
                                style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <AppText label="Create account" variant={1} color="#fff" />
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setStep(1)} style={{ marginTop: 10 }}>
                                <AppText label="Change phone" color={config.THEME_COLOR} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity
                        onPress={() => navigation.navigate('ChooseAccountType')}
                        style={{ alignItems: 'center', paddingVertical: 10 }}
                    >
                        <AppText label="Need a shop owner account instead?" color={config.THEME_COLOR} fontSize={13} />
                    </TouchableOpacity>
                    <View style={[styles.footerHint, { borderTopColor: colors.border }]}>
                        <Lucide name="badge-info" size={14} color={colors.textTertiary} />
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Login', { authMode: 'phone' })}
                            style={{ marginLeft: 8 }}
                        >
                            <AppText label="Already ordered online? Sign in with Phone" fontSize={12} color={config.THEME_COLOR} />
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
    footerHint: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderTopWidth: 1,
    },
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
    brandLogoImage: { width: 44, height: 44 },
    brandTitle: { marginBottom: 4 },
    formSection: { paddingHorizontal: 20, paddingTop: 24 },
    formSubtitle: { marginBottom: 16 },
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
    card: { borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 14, marginHorizontal: 20 },
    rowFields: { flexDirection: 'row', gap: 10 },
    halfField: { flex: 1 },
    fieldGroup: { marginBottom: 10 },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1.5,
    },
    inputIcon: { marginRight: 12 },
    input: {
        flex: 1,
        height: 44,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
        paddingVertical: 0,
    },
    meta: { marginTop: 6 },
    primaryBtn: {
        marginTop: 8,
        height: 48,
        borderRadius: 10,
        backgroundColor: config.THEME_COLOR,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default CustomerSignup;
