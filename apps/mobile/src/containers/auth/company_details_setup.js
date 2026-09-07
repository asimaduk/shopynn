import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { setCompanyDetails } from '../../store/actions/appSettings';
import AppModal from '../../components/app_modal';
import { tenants as tenantsApi, industries as industriesApi, normalizeList } from '../../services/api';

// Form state lives here so only this block re-renders on input; parent header stays stable
const CompanyDetailsForm = React.memo(function CompanyDetailsForm({
    industries,
    initialValues,
    onSuccess,
    styles,
}) {
    const { colors } = useTheme();
    const savedIndustry = initialValues.companyIndustry || '';
    const [form, setForm] = useState({
        companyName: initialValues.companyName || '',
        companyAddress: initialValues.companyAddress || '',
        companyPhone: initialValues.companyPhone || '',
        companyEmail: initialValues.companyEmail || '',
        industry: '',
        industryOther: savedIndustry,
    });
    const [showIndustryPicker, setShowIndustryPicker] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [industrySearch, setIndustrySearch] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!industries.length || form.industry) return;
        if (!savedIndustry) return;
        const lower = savedIndustry.toLowerCase();
        const match = industries.find(
            (i) => i.id === savedIndustry || (i.label && i.label.toLowerCase() === lower)
        );
        if (match && match.id !== 'other') {
            setForm((f) => ({ ...f, industry: match.id, industryOther: '' }));
        } else if (savedIndustry) {
            setForm((f) => ({ ...f, industry: 'other', industryOther: savedIndustry }));
        }
    }, [industries, savedIndustry]);

    const selectedIndustryMeta = industries.find((i) => i.id === form.industry && i.id !== 'other');
    const displayIndustryLabel =
        form.industry === 'other'
            ? (form.industryOther || 'Specify other')
            : (selectedIndustryMeta?.label ?? 'Select industry or company type');

    const handleSelectIndustry = useCallback((item) => {
        if (item.id === 'other') {
            setForm((f) => ({ ...f, industry: 'other' }));
        } else {
            setForm((f) => ({ ...f, industry: item.id, industryOther: '' }));
        }
        setShowIndustryPicker(false);
    }, []);

    const validatedData = useMemo(() => {
        const name = (form.companyName || '').trim();
        const companyAddress = (form.companyAddress || '').trim();
        const companyPhone = (form.companyPhone || '').trim();
        const companyEmail = (form.companyEmail || '').trim();
        const companyIndustry =
            form.industry === 'other' ? (form.industryOther || '').trim() : (form.industry || '');
        return { name, companyAddress, companyPhone, companyEmail, companyIndustry };
    }, [form]);

    const handleContinue = useCallback(() => {
        const { name, companyAddress, companyPhone, companyEmail, companyIndustry } = validatedData;
        if (!name) {
            Alert.alert('Required', 'Please enter your company name.');
            return;
        }
        if (!companyAddress) {
            Alert.alert('Required', 'Please enter your company address.');
            return;
        }
        if (!companyPhone) {
            Alert.alert('Required', 'Please enter your company phone.');
            return;
        }
        if (!companyEmail) {
            Alert.alert('Required', 'Please enter your company email.');
            return;
        }
        if (!companyIndustry) {
            Alert.alert('Required', 'Please select your industry or company type.');
            return;
        }
        setShowConfirmModal(true);
    }, [validatedData]);

    const handleConfirmSave = useCallback(async () => {
        setShowConfirmModal(false);
        setSaving(true);
        try {
            await onSuccess(validatedData);
        } finally {
            setSaving(false);
        }
    }, [validatedData, onSuccess]);

    const updateField = useCallback((field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    }, []);

    const industryList = useMemo(
        // () => (industries.length ? [...industries, { id: 'other', label: 'Specify other', description: null }] : [{ id: 'other', label: 'Specify other', description: null }]),
        () => (industries),
        [industries]
    );
    const filteredIndustries = useMemo(() => {
        if (!industrySearch.trim()) return industryList;
        const q = industrySearch.toLowerCase();
        return industryList.filter(
            (item) =>
                (item.label && item.label.toLowerCase().includes(q)) ||
                (item.description && item.description.toLowerCase().includes(q))
        );
    }, [industryList, industrySearch]);

    const InputField = useCallback(
        ({ label, value, onChangeText, placeholder, icon, keyboardType = 'default' }) => (
            <View style={styles.inputGroup}>
                <AppText label={label} fontSize={14} variant={1} color={colors.text} style={{ marginBottom: 8 }} />
                <View style={[styles.inputWrap, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                    <Lucide name={icon} size={20} color={colors.placeholder} style={{ marginRight: 12 }} />
                    <TextInput
                        placeholder={placeholder}
                        placeholderTextColor={colors.placeholder}
                        style={[styles.input, { color: colors.text }]}
                        value={value}
                        onChangeText={onChangeText}
                        keyboardType={keyboardType}
                    />
                </View>
            </View>
        ),
        [colors, styles]
    );

    return (
        <>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <InputField
                    label="Company name *"
                    placeholder="e.g. Acme Trading Ltd"
                    value={form.companyName}
                    onChangeText={(val) => updateField('companyName', val)}
                    icon="building-2"
                />
                <View style={styles.inputGroup}>
                    <AppText label="Industry / Company type" fontSize={14} variant={1} color={colors.text} style={{ marginBottom: 8 }} />
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setShowIndustryPicker(true)}
                        style={[styles.inputWrap, styles.pickerWrap, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                        <Lucide name="briefcase" size={20} color={colors.placeholder} style={{ marginRight: 12 }} />
                        <AppText
                            label={displayIndustryLabel}
                            numberOfLines={1}
                            style={[styles.input, { color: form.industry || form.industryOther ? colors.text : colors.placeholder }]}
                        />
                        <Lucide name="chevron-down" size={20} color={colors.placeholder} />
                    </TouchableOpacity>
                    {selectedIndustryMeta?.description && (
                        <View style={[styles.industryBrief]}>
                            <AppText label={selectedIndustryMeta.description} fontSize={13} color={colors.textSecondary} />
                        </View>
                    )}
                    {form.industry === 'other' && (
                        <View style={{ marginTop: 10 }}>
                            <TextInput
                                placeholder="Type your industry or company type"
                                placeholderTextColor={colors.placeholder}
                                value={form.industryOther}
                                onChangeText={(val) => updateField('industryOther', val)}
                                style={[styles.inputWrap, styles.otherInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                            />
                        </View>
                    )}
                </View>
                <InputField
                    label="Address"
                    placeholder="Street, city, region"
                    value={form.companyAddress}
                    onChangeText={(val) => updateField('companyAddress', val)}
                    icon="map-pin"
                />
                <InputField
                    label="Phone"
                    placeholder="e.g. +233 24 888 2990"
                    value={form.companyPhone}
                    onChangeText={(val) => updateField('companyPhone', val)}
                    icon="phone"
                    keyboardType="phone-pad"
                />
                <InputField
                    label="Email"
                    placeholder="company@example.com"
                    value={form.companyEmail}
                    onChangeText={(val) => updateField('companyEmail', val)}
                    icon="mail"
                    keyboardType="email-address"
                />
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleContinue}
                    disabled={saving}
                    style={[styles.continueBtn, saving && { opacity: 0.8 }]}>
                    {saving ? (
                        <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                        <>
                            <AppText label="Continue" variant={1} fontSize={17} color={colors.textInverse} />
                            <Lucide name="arrow-right" color={colors.textInverse} size={20} style={{ marginLeft: 10 }} />
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <AppModal
                title="Select industry or company type"
                visible={showIndustryPicker}
                handleClose={() => setShowIndustryPicker(false)}
                onRequestClose={() => setShowIndustryPicker(false)}>
                <View style={styles.modalContentWrap}>
                    <View style={[styles.modalSearchWrap, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
                        <Lucide name="search" size={16} color={colors.textTertiary} style={{ marginHorizontal: 8 }} />
                        <TextInput
                            placeholder="Search industries..."
                            placeholderTextColor={colors.placeholder}
                            value={industrySearch}
                            onChangeText={setIndustrySearch}
                            style={[styles.modalSearchInput, { color: colors.text }]}
                        />
                        {industrySearch.length > 0 && (
                            <TouchableOpacity onPress={() => setIndustrySearch('')} style={{ padding: 6 }}>
                                <Lucide name="x" size={14} color={colors.textTertiary} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }} contentContainerStyle={styles.modalScrollContent}>
                    {filteredIndustries.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            activeOpacity={0.7}
                            onPress={() => handleSelectIndustry(item)}
                            style={[styles.modalOption, { borderBottomColor: colors.border }]}>
                            <Lucide
                                name={item.id === 'other' ? 'edit-3' : 'briefcase'}
                                size={18}
                                color={item.id === 'other' ? colors.textTertiary : config.THEME_COLOR}
                            />
                            <AppText
                                label={item.label}
                                fontSize={15}
                                color={colors.text}
                                style={{ flex: 1, marginLeft: 12 }}
                                numberOfLines={2}
                            />
                        </TouchableOpacity>
                    ))}
                    </ScrollView>
                </View>
            </AppModal>

            <AppModal
                title="Confirm company details"
                visible={showConfirmModal}
                handleClose={() => setShowConfirmModal(false)}
                onRequestClose={() => setShowConfirmModal(false)}>
                <View style={styles.modalContentWrap}>
                    <AppText
                        label="Please confirm the details below before saving."
                        fontSize={14}
                        color={colors.textSecondary}
                        style={styles.confirmIntro}
                    />
                    <View style={[styles.confirmSummary, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                        <ConfirmRow label="Company" value={validatedData.name} colors={colors} />
                        <ConfirmRow
                            label="Industry"
                            value={form.industry === 'other' ? validatedData.companyIndustry : (selectedIndustryMeta?.label ?? validatedData.companyIndustry)}
                            colors={colors}
                        />
                        <ConfirmRow label="Address" value={validatedData.companyAddress} colors={colors} />
                        <ConfirmRow label="Phone" value={validatedData.companyPhone} colors={colors} />
                        <ConfirmRow label="Email" value={validatedData.companyEmail} colors={colors} />
                    </View>
                    <View style={styles.confirmActions}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setShowConfirmModal(false)}
                            style={[styles.confirmBtnSecondary, { borderColor: colors.border }]}>
                            <AppText label="Cancel" fontSize={16} color={colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleConfirmSave}
                            style={[styles.confirmBtnPrimary, { backgroundColor: config.THEME_COLOR }]}>
                            <AppText label="Save" variant={1} fontSize={16} color={colors.textInverse} />
                        </TouchableOpacity>
                    </View>
                </View>
            </AppModal>
        </>
    );
});

function ConfirmRow({ label, value, colors }) {
    return (
        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
            <AppText label={label + ': '} fontSize={14} color={colors.textSecondary} style={{ width: 80 }} />
            <AppText label={value || '—'} fontSize={14} color={colors.text} style={{ flex: 1 }} numberOfLines={2} />
        </View>
    );
}

const CompanyDetailsSetup = ({ navigation }) => {
    const { colors } = useTheme();
    const dispatch = useDispatch();
    const appSettings = useSelector(({ appSettings }) => appSettings) || {};
    const [industries, setIndustries] = useState([]);

    useEffect(() => {
        let mounted = true;
        console.log('appSettings', appSettings);
        (async () => {
            try {
                const raw = await industriesApi.list();
                const list = normalizeList(raw) || [];
                const mapped = list.map((item) => ({
                    id: item.id || item.code || item.name,
                    label: item.name || item.code || 'Industry',
                    description: item.description || null,
                }));
                if (mounted) setIndustries(mapped);
            } catch (_) {}
        })();
        return () => { mounted = false; };
    }, []);

    const initialValues = useMemo(
        () => ({
            companyName: appSettings.companyName || '',
            companyAddress: appSettings.companyAddress || '',
            companyPhone: appSettings.companyPhone || '',
            companyEmail: appSettings.companyEmail || '',
            companyIndustry: appSettings.companyIndustry || '',
        }),
        [
            appSettings.companyName,
            appSettings.companyAddress,
            appSettings.companyPhone,
            appSettings.companyEmail,
            appSettings.companyIndustry,
        ]
    );

    const handleSuccess = useCallback(
        async ({ name, companyAddress, companyPhone, companyEmail, companyIndustry }) => {
            const body = {
                name,
                organization: name,
                phone: companyPhone,
                address: companyAddress,
                email: companyEmail,
                industry_id: companyIndustry,
            };
            try {
                console.log('body', body);
                // retåurn;
                await tenantsApi.updateMyCompanyInfo(body);
                dispatch(
                    setCompanyDetails({
                        companyName: name,
                        companyAddress,
                        companyPhone,
                        companyEmail,
                        companyIndustry,
                    })
                );


            // Check subscription status and handle accordingly
            // Assuming you have access to appSettings or an API to check subscription, e.g. appSettings.subscriptionActive
            if (appSettings.subscriptionActive !== false) {
                // Subscription is active, dispatch login (set logged in true)
                dispatch({ type: 'SET_LOGGED_IN', payload: true });
                // if (navigation?.reset) {
                //     navigation.reset({
                //         index: 0,
                //         routes: [{ name: 'Main' }],
                //     });
                // }
            } else {
                // Subscription is not active, navigate to subscription screen
                if (navigation?.navigate) {
                    navigation.navigate('Subscription', { requiredPayment: true });
                }
            }
            } catch (err) {
                const msg = err?.response?.data?.message || err?.message || 'Could not save company details.';
                Alert.alert('Error', msg);
                throw err;
            }
        },
        [dispatch]
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}>
            <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => navigation?.goBack?.()}
                            style={[styles.backButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                            <Lucide name="move-left" size={18} color={colors.text} />
                        </TouchableOpacity>
                        <View style={[styles.iconWrap, { backgroundColor: config.THEME_COLOR + '20' }]}>
                            <Lucide name="building-2" size={36} color={config.THEME_COLOR} />
                        </View>
                        <AppText label="Set up your company" variant={1} fontSize={24} color={colors.text} style={styles.title} />
                        <AppText label="We need a few details to personalize your experience." fontSize={15} color={colors.textSecondary} style={styles.subtitle} />
                    </View>
                    <CompanyDetailsForm
                        industries={industries}
                        initialValues={initialValues}
                        onSuccess={handleSuccess}
                        styles={styles}
                    />
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    scrollContent: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
    header: { alignItems: 'center', marginBottom: 28 },
    backButton: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    iconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: { textAlign: 'center', marginBottom: 8 },
    subtitle: { textAlign: 'center', paddingHorizontal: 16 },
    card: {
        borderRadius: 5,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    inputGroup: { marginBottom: 18 },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 5,
        borderWidth: 1,
        paddingHorizontal: 16,
        height: 52,
    },
    input: {
        flex: 1,
        fontFamily: 'FiraSans-Regular',
        fontSize: 16,
        paddingVertical: 0,
    },
    pickerWrap: { flexDirection: 'row', alignItems: 'center' },
    industryBrief: {
        marginTop: 2
    },
    otherInput: {
        height: 48,
        paddingHorizontal: 14,
        borderRadius: 10,
        fontFamily: 'FiraSans-Regular',
        fontSize: 15,
    },
    modalSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        marginHorizontal: 16,
        marginBottom: 8,
        paddingHorizontal: 4,
        height: 40,
        marginTop: 16,
    },
    modalSearchInput: {
        flex: 1,
        fontFamily: 'FiraSans-Regular',
        fontSize: 14,
        paddingVertical: 0,
    },
    modalContentWrap: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 24,
    },
    modalScrollContent: {
        paddingBottom: 20,
        paddingTop: 4,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    continueBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        backgroundColor: config.THEME_COLOR,
        borderRadius: 5,
        marginTop: 12,
    },
    confirmIntro: {
        marginBottom: 20,
    },
    confirmSummary: {
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 24,
    },
    confirmActions: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'flex-end',
    },
    confirmBtnSecondary: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1,
    },
    confirmBtnPrimary: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
});

export default CompanyDetailsSetup;
