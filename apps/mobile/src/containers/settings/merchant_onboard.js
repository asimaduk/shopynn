import React, { useState, useCallback } from 'react';
import {
    View,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
    StyleSheet,
    KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import { hasPermission } from '../../utils/permissions';
import config from '../../config';
import { merchants as merchantsApi, billing as billingApi } from '../../services/api';
import Toast from 'react-native-toast-message';
import { buildPlansFromCatalog, computeQuoteTotalFromSelection } from '../../utils/billingCatalog';

/** Fallback when catalog API unavailable */
const PLANS = [
    {
        v: 1,
        title: 'Free',
        amountBold: 'GHS 0.00',
        amountSub: '14-day trial',
        description: 'Try all core features. Up to 3 users and 1 warehouse. Upgrade when you are ready.',
    },
    {
        v: 2,
        title: 'Basic',
        amountBold: 'GHS 229.00',
        amountSub: 'per month',
        description: 'Single-store operations with core workflows. Up to 3 users and 1 warehouse.',
    },
    {
        v: 3,
        title: 'Standard',
        amountBold: 'GHS 429.00',
        amountSub: 'per month',
        description: 'Multi-store trading and scale. Up to 12 users and 5 warehouses.',
    },
    {
        v: 4,
        title: 'Premium',
        amountBold: 'GHS 799.00',
        amountSub: 'per month',
        description: 'Full feature access for larger teams. Up to 25 users and 10 warehouses. Accept online orders.',
    },
];

function navigateToClientsTab(navigation, user) {
    const operateOnly =
        hasPermission(user, ['merchants.operate']) && !hasPermission(user, ['merchants.view']);
    if (operateOnly) {
        navigation.navigate('Home', { screen: 'ClientsTab' });
    } else {
        navigation.navigate('MerchantPortal');
    }
}

const STEPS = [
    { key: 'business', label: 'Business', caption: 'Company & location' },
    { key: 'plan', label: 'Plan', caption: 'Subscription tier' },
    { key: 'owner', label: 'Owner', caption: 'Admin login' },
    { key: 'finish', label: 'Finish', caption: 'Review & submit' },
];

const STEP_COUNT = STEPS.length;

/** Card, inputs, buttons, step chrome — keep corners tight */
const BORDER_RADIUS = 5;

function toastError(title, message) {
    if (Toast && typeof Toast.show === 'function') {
        Toast.show({
            type: 'error',
            text1: title,
            text2: message,
            visibilityTime: 3500,
            position: 'bottom',
        });
    } else {
        Alert.alert(title, message);
    }
}

function SummaryLine({ label, value, colors, containerStyle }) {
    const display = value != null && String(value).trim() !== '' ? String(value).trim() : '—';
    return (
        <View style={[{ marginBottom: 12 }, containerStyle]}>
            <AppText label={label} fontSize={11} variant={2} color={colors.textTertiary} />
            <AppText label={display} fontSize={14} color={colors.text} style={{ marginTop: 3 }} />
        </View>
    );
}

const MerchantOnboard = ({ navigation }) => {
    const user = useSelector(({ user: u }) => u);
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [loadingMe, setLoadingMe] = useState(true);
    const [hasMerchant, setHasMerchant] = useState(false);
    const [busy, setBusy] = useState(false);
    const [plan, setPlan] = useState(1);
    const [name, setName] = useState('');
    const [organization, setOrganization] = useState('');
    const [phone, setPhone] = useState('');
    const [companyEmail, setCompanyEmail] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [stateProv, setStateProv] = useState('');
    const [country, setCountry] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [website, setWebsite] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [ownerEmail, setOwnerEmail] = useState('');
    const [ownerPhone, setOwnerPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [step, setStep] = useState(0);
    const [catalog, setCatalog] = useState(null);
    const [addonCodes, setAddonCodes] = useState([]);

    const bottomPad = 32 + insets.bottom;
    const footerReserve = 88 + insets.bottom;
    const scrollBottomPad = 24 + footerReserve;

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            (async () => {
                setLoadingMe(true);
                try {
                    const [me, cat] = await Promise.all([
                        merchantsApi.me(),
                        billingApi.catalog({ grouped: true }).catch(() => null),
                    ]);
                    if (!cancelled) {
                        setHasMerchant(!!me?.merchant?.id);
                        setCatalog(cat);
                    }
                } catch (_) {
                    if (!cancelled) {
                        setHasMerchant(false);
                    }
                } finally {
                    if (!cancelled) setLoadingMe(false);
                }
            })();
            return () => {
                cancelled = true;
            };
        }, []),
    );

    const inputStyle = {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: BORDER_RADIUS,
        padding: 14,
        marginTop: 10,
        color: colors.text,
        backgroundColor: colors.background,
        fontFamily: 'FiraSans-Regular',
    };

    const sectionCard = {
        marginBottom: 16,
        padding: 16,
        borderRadius: BORDER_RADIUS,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    };

    const validateBusinessStep = () => {
        if (!name.trim()) {
            toastError('Business', 'Business name is required.');
            return false;
        }
        if (!phone.trim()) {
            toastError('Business', 'Company phone is required.');
            return false;
        }
        if (!companyEmail.trim()) {
            toastError('Business', 'Company email is required.');
            return false;
        }
        if (!address.trim()) {
            toastError('Business', 'Street address is required.');
            return false;
        }
        return true;
    };

    const validateOwnerStep = () => {
        if (!firstName.trim() || !lastName.trim() || !ownerEmail.trim()) {
            toastError('Owner', 'Owner first name, last name and email are required.');
            return false;
        }
        return true;
    };

    const goNext = () => {
        if (step === 0 && !validateBusinessStep()) return;
        if (step === 2 && !validateOwnerStep()) return;
        if (step < STEP_COUNT - 1) setStep((s) => s + 1);
    };

    const goPreviousStep = () => {
        if (step > 0) setStep((s) => s - 1);
    };

    const buildOnboardPayload = () => ({
        name: name.trim(),
        phone: phone.trim(),
        email: companyEmail.trim(),
        address: address.trim(),
        city: city.trim() || undefined,
        state: stateProv.trim() || undefined,
        country: country.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        website: website.trim() || undefined,
        notes: notes.trim() || undefined,
        subscription_type: plan,
        addon_codes: addonCodes,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        owner_email: ownerEmail.trim().toLowerCase(),
        owner_phone: ownerPhone.trim() || undefined,
        registration_method: 'manual',
    });

    const performOnboard = async () => {
        setBusy(true);
        try {
            const result = await merchantsApi.onboard(buildOnboardPayload());
            const tenantId = result?.tenant?.id;
            if (result?.payment_required && tenantId) {
                navigation.navigate('MerchantCollect', { tenantId, ownerEmail: ownerEmail.trim() });
                return;
            }
            if (Toast && typeof Toast.show === 'function') {
                Toast.show({
                    type: 'success',
                    text1: 'Business onboarded',
                    text2: 'Taking you to Clients…',
                    visibilityTime: 1800,
                    position: 'bottom',
                    onHide: () => navigateToClientsTab(navigation, user),
                });
            } else {
                navigateToClientsTab(navigation, user);
            }
        } catch (e) {
            toastError(
                'Onboarding failed',
                e?.response?.data?.message || e?.message || 'Something went wrong. Try again.',
            );
        } finally {
            setBusy(false);
        }
    };

    const confirmAndSubmit = () => {
        if (!validateBusinessStep()) return;
        if (!validateOwnerStep()) return;

        Alert.alert(
            'Create tenant?',
            'This will register the new business and owner. Do you want to continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Submit',
                    onPress: () => {
                        void performOnboard();
                    },
                },
            ],
        );
    };

    const headerBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigateToClientsTab(navigation, user);
        }
    };

    if (loadingMe) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={headerBack} label="Onboard business" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={config.THEME_COLOR} size="large" />
                </View>
            </SafeAreaView>
        );
    }

    if (!hasMerchant) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={headerBack} label="Onboard business" />
                <View style={{ padding: 16, paddingBottom: bottomPad }}>
                    <View style={sectionCard}>
                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                            <View
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: BORDER_RADIUS,
                                    backgroundColor: config.THEME_COLOR + '22',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Lucide name="shield-alert" size={22} color={config.THEME_COLOR} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <AppText label="Merchant access required" variant={1} color={colors.text} fontSize={17} />
                                <AppText
                                    label="You must be registered as a merchant partner before you can onboard businesses."
                                    variant={2}
                                    color={colors.textSecondary}
                                    fontSize={14}
                                    style={{ marginTop: 8, lineHeight: 20 }}
                                />
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => navigateToClientsTab(navigation, user)}
                        style={{
                            marginTop: 8,
                            padding: 16,
                            borderRadius: BORDER_RADIUS,
                            backgroundColor: config.THEME_COLOR,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 8,
                        }}
                    >
                        <Lucide name="building-2" color="#fff" size={20} />
                        <AppText label="Back to Clients" color="#fff" variant={1} fontSize={16} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const stepMeta = STEPS[step];
    const displayPlans = buildPlansFromCatalog(catalog) || PLANS;
    const quoteTotal = catalog ? computeQuoteTotalFromSelection(catalog, plan, addonCodes) : 0;
    const toggleAddon = (code) => {
        setAddonCodes((prev) =>
            prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
        );
    };
    const selectedPlanSummary = displayPlans.find((p) => p.v === plan) ?? displayPlans[0];

    /** Header row (~46) below status bar — keeps inputs clear of keyboard on iOS */
    const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top + 52 : 0;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={headerBack} label="Onboard business" />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={keyboardVerticalOffset}
                enabled
            >
            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    {STEPS.map((s, i) => {
                        const done = i < step;
                        const active = i === step;
                        return (
                            <View key={s.key} style={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
                                <View
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 32,
                                        backgroundColor: active || done ? config.THEME_COLOR : colors.border,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: active ? 0 : 0,
                                    }}
                                >
                                    {done ? (
                                        <Lucide name="check" size={18} color="#fff" />
                                    ) : (
                                        <AppText
                                            label={String(i + 1)}
                                            variant={1}
                                            fontSize={14}
                                            color={active ? '#fff' : colors.textSecondary}
                                        />
                                    )}
                                </View>
                                <AppText
                                    label={s.label}
                                    fontSize={10}
                                    numberOfLines={1}
                                    color={active ? config.THEME_COLOR : colors.textTertiary}
                                    variant={active ? 1 : 2}
                                    style={{ marginTop: 4 }}
                                />
                            </View>
                        );
                    })}
                </View>
                <View style={{ flexDirection: 'row', height: 4, borderRadius: BORDER_RADIUS, overflow: 'hidden', backgroundColor: colors.border }}>
                    {STEPS.map((seg, i) => (
                        <View
                            key={seg.key}
                            style={{
                                flex: 1,
                                marginHorizontal: 2,
                                borderRadius: BORDER_RADIUS,
                                backgroundColor: i <= step ? config.THEME_COLOR : 'transparent',
                            }}
                        />
                    ))}
                </View>
                <AppText
                    label={`${step + 1} of ${STEP_COUNT} · ${stepMeta.caption}`}
                    variant={2}
                    color={colors.textSecondary}
                    fontSize={12}
                    style={{ marginTop: 10 }}
                />
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: scrollBottomPad }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
                showsVerticalScrollIndicator={false}
            >
                <View style={{ marginBottom: 14 }}>
                    <AppText label={stepMeta.label} variant={1} color={colors.text} fontSize={20} />
                    <AppText
                        label={
                            step === 0
                                ? 'Provide legal business identity and a reachable phone, email, and street address.'
                                : step === 1
                                  ? 'Prices are in GHS. The tenant can change plan later per your policy.'
                                  : step === 2
                                    ? 'This person becomes the first admin on the new business.'
                                    : 'Confirm details below, add optional notes, then submit.'
                        }
                        variant={2}
                        color={colors.textSecondary}
                        fontSize={14}
                        style={{ marginTop: 6, lineHeight: 20 }}
                    />
                </View>

                {step === 0 ? (
                <View style={sectionCard}>
                    <AppText
                        label="Business name, company phone, company email, and street address are required."
                        variant={2}
                        color={colors.textTertiary}
                        fontSize={12}
                    />
                    <TextInput
                        placeholder="Business name *"
                        placeholderTextColor={colors.placeholder}
                        value={name}
                        onChangeText={setName}
                        style={inputStyle}
                    />
                    {/* <TextInput
                        placeholder="Organization / trading name"
                        placeholderTextColor={colors.placeholder}
                        value={organization}
                        onChangeText={setOrganization}
                        style={inputStyle}
                    /> */}
                    <TextInput
                        placeholder="Company phone *"
                        placeholderTextColor={colors.placeholder}
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        style={inputStyle}
                    />
                    <TextInput
                        placeholder="Company email *"
                        placeholderTextColor={colors.placeholder}
                        value={companyEmail}
                        onChangeText={setCompanyEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={inputStyle}
                    />
                    <TextInput
                        placeholder="Street address *"
                        placeholderTextColor={colors.placeholder}
                        value={address}
                        onChangeText={setAddress}
                        style={inputStyle}
                    />
                    <TextInput
                        placeholder="City"
                        placeholderTextColor={colors.placeholder}
                        value={city}
                        onChangeText={setCity}
                        style={inputStyle}
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TextInput
                            placeholder="State / region"
                            placeholderTextColor={colors.placeholder}
                            value={stateProv}
                            onChangeText={setStateProv}
                            style={[inputStyle, { flex: 1, marginTop: 10 }]}
                        />
                        <TextInput
                            placeholder="Postal code"
                            placeholderTextColor={colors.placeholder}
                            value={postalCode}
                            onChangeText={setPostalCode}
                            style={[inputStyle, { flex: 1, marginTop: 10 }]}
                        />
                    </View>
                    <TextInput
                        placeholder="Country"
                        placeholderTextColor={colors.placeholder}
                        value={country}
                        onChangeText={setCountry}
                        style={inputStyle}
                    />
                    <TextInput
                        placeholder="Website (optional)"
                        placeholderTextColor={colors.placeholder}
                        value={website}
                        onChangeText={setWebsite}
                        keyboardType="url"
                        autoCapitalize="none"
                        style={inputStyle}
                    />
                </View>
                ) : step === 1 ? (
                <View style={sectionCard}>
                    <AppText
                        label="Choose the starting tier. Tap a card to select."
                        variant={2}
                        color={colors.textTertiary}
                        fontSize={12}
                        style={{ lineHeight: 18, marginBottom: 4 }}
                    />
                    <View style={{ marginTop: 10, gap: 12 }}>
                        {displayPlans.map((p) => {
                            const active = plan === p.v;
                            return (
                                <TouchableOpacity
                                    key={p.v}
                                    onPress={() => setPlan(p.v)}
                                    activeOpacity={0.85}
                                    style={{
                                        borderRadius: BORDER_RADIUS,
                                        borderWidth: active ? 3 : 1,
                                        borderColor: active ? config.THEME_COLOR : colors.border,
                                        backgroundColor: active ? config.THEME_COLOR + '14' : colors.background,
                                        paddingVertical: 16,
                                        paddingHorizontal: 16,
                                        ...(Platform.OS === 'ios' && active
                                            ? {
                                                  shadowColor: '#000',
                                                  shadowOffset: { width: 0, height: 3 },
                                                  shadowOpacity: 0.08,
                                                  shadowRadius: 6,
                                              }
                                            : {}),
                                        ...(Platform.OS === 'android' ? { elevation: active ? 3 : 0 } : {}),
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1, paddingRight: 10 }}>
                                            <AppText label={p.title} variant={1} fontSize={18} color={colors.text} />
                                            <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 10 }}>
                                                <AppText
                                                    label={p.amountBold}
                                                    variant={1}
                                                    fontSize={28}
                                                    color={active ? config.THEME_COLOR : colors.text}
                                                />
                                                <AppText
                                                    label={`  ${p.amountSub}`}
                                                    variant={2}
                                                    fontSize={15}
                                                    color={colors.textSecondary}
                                                    style={{ marginLeft: 4 }}
                                                />
                                            </View>
                                            <AppText
                                                label={p.description}
                                                variant={2}
                                                fontSize={13}
                                                color={colors.textSecondary}
                                                style={{ marginTop: 12, lineHeight: 19 }}
                                            />
                                        </View>
                                        <View
                                            style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: BORDER_RADIUS,
                                                borderWidth: 2,
                                                borderColor: active ? config.THEME_COLOR : colors.border,
                                                backgroundColor: active ? config.THEME_COLOR : 'transparent',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            {active ? <Lucide name="check" color="#fff" size={16} /> : null}
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    {(catalog?.addons?.length > 0) ? (
                        <View style={{ marginTop: 16 }}>
                            <AppText label="Optional add-ons" variant={1} fontSize={14} color={colors.text} />
                            {catalog.addons.map((a) => {
                                const on = addonCodes.includes(a.code);
                                return (
                                    <TouchableOpacity
                                        key={a.code}
                                        onPress={() => toggleAddon(a.code)}
                                        style={{
                                            marginTop: 8,
                                            padding: 12,
                                            borderRadius: BORDER_RADIUS,
                                            borderWidth: on ? 2 : 1,
                                            borderColor: on ? config.THEME_COLOR : colors.border,
                                        }}
                                    >
                                        <AppText label={`${a.label} — GHS ${Number(a.amount_ghs).toFixed(2)}`} fontSize={13} color={colors.text} />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ) : null}
                    {quoteTotal > 0 ? (
                        <AppText
                            label={`Total due at collection: GHS ${quoteTotal.toFixed(2)}`}
                            variant={1}
                            fontSize={16}
                            color={config.THEME_COLOR}
                            style={{ marginTop: 14 }}
                        />
                    ) : null}
                </View>
                ) : step === 2 ? (
                <View style={sectionCard}>
                    <AppText
                        label="Required fields are marked. A temporary password will be emailed to the owner."
                        variant={2}
                        color={colors.textTertiary}
                        fontSize={12}
                        style={{ marginBottom: 4 }}
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TextInput
                            placeholder="First name *"
                            placeholderTextColor={colors.placeholder}
                            value={firstName}
                            onChangeText={setFirstName}
                            style={[inputStyle, { flex: 1 }]}
                        />
                        <TextInput
                            placeholder="Last name *"
                            placeholderTextColor={colors.placeholder}
                            value={lastName}
                            onChangeText={setLastName}
                            style={[inputStyle, { flex: 1 }]}
                        />
                    </View>
                    <TextInput
                        placeholder="Owner email *"
                        placeholderTextColor={colors.placeholder}
                        value={ownerEmail}
                        onChangeText={setOwnerEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={inputStyle}
                    />
                    <TextInput
                        placeholder="Owner phone"
                        placeholderTextColor={colors.placeholder}
                        value={ownerPhone}
                        onChangeText={setOwnerPhone}
                        keyboardType="phone-pad"
                        style={inputStyle}
                    />
                </View>
                ) : (
                <>
                    <View style={[sectionCard, { marginBottom: 12 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <Lucide name="clipboard-list" size={18} color={config.THEME_COLOR} />
                            <AppText label="Business" variant={1} color={colors.text} fontSize={15} />
                        </View>
                        <SummaryLine label="Business name" value={name} colors={colors} containerStyle={{ marginBottom: 12 }} />
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <SummaryLine
                                    label="Company phone"
                                    value={phone}
                                    colors={colors}
                                    containerStyle={{ marginBottom: 0 }}
                                />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <SummaryLine
                                    label="Company email"
                                    value={companyEmail}
                                    colors={colors}
                                    containerStyle={{ marginBottom: 0 }}
                                />
                            </View>
                        </View>
                        <SummaryLine label="Street address" value={address} colors={colors} containerStyle={{ marginBottom: 12 }} />
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <SummaryLine label="City" value={city} colors={colors} containerStyle={{ marginBottom: 0 }} />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <SummaryLine
                                    label="State / region"
                                    value={stateProv}
                                    colors={colors}
                                    containerStyle={{ marginBottom: 0 }}
                                />
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <SummaryLine
                                    label="Postal code"
                                    value={postalCode}
                                    colors={colors}
                                    containerStyle={{ marginBottom: 0 }}
                                />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <SummaryLine label="Country" value={country} colors={colors} containerStyle={{ marginBottom: 0 }} />
                            </View>
                        </View>
                        <SummaryLine label="Website" value={website} colors={colors} containerStyle={{ marginBottom: 0 }} />
                    </View>

                    <View style={[sectionCard, { marginBottom: 12 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <Lucide name="layers" size={18} color={config.THEME_COLOR} />
                            <AppText label="Subscription" variant={1} color={colors.text} fontSize={15} />
                        </View>
                        <SummaryLine label="Plan" value={selectedPlanSummary.title} colors={colors} />
                        <SummaryLine
                            label="Pricing"
                            value={`${selectedPlanSummary.amountBold} ${selectedPlanSummary.amountSub}`}
                            colors={colors}
                        />
                    </View>

                    <View style={[sectionCard, { marginBottom: 12 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <Lucide name="circle-user" size={18} color={config.THEME_COLOR} />
                            <AppText label="Owner (admin)" variant={1} color={colors.text} fontSize={15} />
                        </View>
                        <SummaryLine label="Name" value={`${firstName} ${lastName}`.trim()} colors={colors} />
                        <SummaryLine label="Email" value={ownerEmail} colors={colors} />
                        <SummaryLine label="Phone" value={ownerPhone} colors={colors} />
                    </View>

                    <View style={sectionCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Lucide name="sticky-note" size={18} color={config.THEME_COLOR} />
                            <AppText label="Internal notes (optional)" variant={1} color={colors.text} fontSize={15} />
                        </View>
                        <AppText
                            label="Shown only to your team — not sent to the new tenant as a customer-facing message."
                            variant={2}
                            color={colors.textTertiary}
                            fontSize={11}
                            style={{ marginBottom: 8, lineHeight: 16 }}
                        />
                        <TextInput
                            placeholder="Notes for your team (optional)"
                            placeholderTextColor={colors.placeholder}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            style={[inputStyle, { marginTop: 0, minHeight: 100, textAlignVertical: 'top' }]}
                        />
                    </View>
                </>
                )}
            </ScrollView>

            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    paddingBottom: 12 + insets.bottom,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                    backgroundColor: colors.surface,
                }}
            >
                {step > 0 ? (
                    <TouchableOpacity
                        onPress={goPreviousStep}
                        activeOpacity={0.85}
                        style={{
                            flex: 1,
                            paddingVertical: 14,
                            borderRadius: BORDER_RADIUS,
                            borderWidth: 1,
                            borderColor: colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <AppText label="Back" variant={1} color={colors.text} fontSize={16} />
                    </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                    onPress={step === STEP_COUNT - 1 ? confirmAndSubmit : goNext}
                    disabled={busy}
                    activeOpacity={0.9}
                    style={{
                        flex: step > 0 ? 1 : undefined,
                        flexGrow: 1,
                        paddingVertical: 14,
                        borderRadius: BORDER_RADIUS,
                        backgroundColor: config.THEME_COLOR,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 8,
                        opacity: busy ? 0.75 : 1,
                    }}
                >
                    {busy ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <AppText
                                label={step === STEP_COUNT - 1 ? 'Submit & onboard' : 'Continue'}
                                color="#fff"
                                variant={1}
                                fontSize={16}
                            />

                            <Lucide
                                name={step === STEP_COUNT - 1 ? 'circle-check' : 'arrow-right'}
                                color="#fff"
                                size={20}
                            />
                        </>
                    )}
                </TouchableOpacity>
            </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default MerchantOnboard;
