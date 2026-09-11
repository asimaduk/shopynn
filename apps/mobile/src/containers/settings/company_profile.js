import React, { useState, useCallback, useMemo } from 'react';
import {
    Image,
    TouchableOpacity,
    ScrollView,
    View,
    Dimensions,
    Alert,
    ActivityIndicator,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import useTheme from '../../hooks/useTheme';
import { users as usersApi, tenants as tenantsApi, industries as industriesApi, images as imagesApi, normalizeList } from '../../services/api';
import { setCompanyDetails } from '../../store/actions/appSettings';

const { width } = Dimensions.get('screen');

function logoUri(logoKey) {
    if (!logoKey || !String(logoKey).trim()) return null;
    const s = String(logoKey).trim();
    if (/^https?:\/\//i.test(s)) return s;
    return `${config.BASE_API}/images?id=${encodeURIComponent(s)}`;
}

const OTHER_INDUSTRY = { id: 'other', label: 'Specify other', description: null };

const CompanyProfile = ({ navigation }) => {
    const { colors } = useTheme();
    const dispatch = useDispatch();
    const appSettings = useSelector((s) => s.appSettings) || {};

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [industries, setIndustries] = useState([]);

    const [companyName, setCompanyName] = useState('');
    const [organization, setOrganization] = useState('');
    const [companyPhone, setCompanyPhone] = useState('');
    const [companyEmail, setCompanyEmail] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [industryId, setIndustryId] = useState('');
    const [industryOther, setIndustryOther] = useState('');

    const [serverLogoKey, setServerLogoKey] = useState(null);
    const [localLogoAsset, setLocalLogoAsset] = useState(null);

    const [showFullImage, setShowFullImage] = useState(false);
    const [showIndustryPicker, setShowIndustryPicker] = useState(false);
    const [industrySearch, setIndustrySearch] = useState('');

    const industryOptions = useMemo(
        () => (industries.length ? [...industries, OTHER_INDUSTRY] : [OTHER_INDUSTRY]),
        [industries],
    );

    const filteredIndustries = useMemo(() => {
        if (!industrySearch.trim()) return industryOptions;
        const q = industrySearch.toLowerCase();
        return industryOptions.filter(
            (item) =>
                (item.label && item.label.toLowerCase().includes(q)) ||
                (item.description && item.description.toLowerCase().includes(q)),
        );
    }, [industryOptions, industrySearch]);

    const selectedIndustryMeta = industries.find((i) => i.id === industryId && i.id !== 'other');
    const displayIndustryLabel =
        industryId === 'other'
            ? industryOther || 'Specify other'
            : selectedIndustryMeta?.label || (!industryId ? 'Select industry' : industryOther || '—');

    const avatarSource = useMemo(() => {
        if (localLogoAsset?.uri) return { uri: localLogoAsset.uri };
        const u = logoUri(serverLogoKey);
        if (u) return { uri: u };
        return null;
    }, [localLogoAsset, serverLogoKey]);

    const syncIndustryFromCompany = useCallback((company, list) => {
        const safeList = Array.isArray(list) ? list : [];
        if (!company) {
            setIndustryId('');
            setIndustryOther('');
            return;
        }
        const savedId = company.industry_id != null ? String(company.industry_id) : '';
        const savedLabel = company.industry || '';

        if (savedId && safeList.length) {
            const match = safeList.find((i) => String(i.id) === savedId);
            if (match && match.id !== 'other') {
                setIndustryId(match.id);
                setIndustryOther('');
                return;
            }
        }
        if (savedLabel && safeList.length) {
            const byName = safeList.find((i) => (i.label || '').toLowerCase() === String(savedLabel).toLowerCase());
            if (byName && byName.id !== 'other') {
                setIndustryId(byName.id);
                setIndustryOther('');
                return;
            }
        }
        if (savedLabel) {
            setIndustryId('other');
            setIndustryOther(savedLabel);
            return;
        }
        setIndustryId('');
        setIndustryOther('');
    }, []);

    const loadIndustries = useCallback(async () => {
        try {
            const raw = await industriesApi.list();
            const list = normalizeList(raw) || [];
            const mapped = list.map((item) => ({
                id: item.id || item.code || item.name,
                label: item.name || item.code || 'Industry',
                description: item.description || null,
            }));
            setIndustries(mapped);
            return mapped;
        } catch (_) {
            setIndustries([]);
            return [];
        }
    }, []);

    const applyMeToForm = useCallback(
        (me, list) => {
            const c = me?.company;
            const name = c?.name || appSettings.companyName || '';
            setCompanyName(name);
            setOrganization((c?.organization || name || '').trim());
            setCompanyPhone(c?.phone || appSettings.companyPhone || '');
            setCompanyEmail(c?.email || appSettings.companyEmail || '');
            setCompanyAddress(c?.address || appSettings.companyAddress || '');
            setServerLogoKey(c?.logo ?? null);
            setLocalLogoAsset(null);
            syncIndustryFromCompany(c, list);
        },
        [appSettings, syncIndustryFromCompany],
    );

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const list = await loadIndustries();
            const me = await usersApi.me();
            applyMeToForm(me, list);
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Could not load company profile.';
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    }, [loadIndustries, applyMeToForm]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    const backPress = () => navigation.goBack();

    const handleRemoveImage = () => {
        if (localLogoAsset) {
            setLocalLogoAsset(null);
            setShowFullImage(false);
            return;
        }
        Alert.alert('Remove logo', 'Remove the company logo from your account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        setSaving(true);
                        await tenantsApi.updateMyCompanyInfo({ logo: null });
                        setServerLogoKey(null);
                        setShowFullImage(false);
                    } catch (err) {
                        const msg = err?.response?.data?.message || err?.message || 'Could not remove logo.';
                        Alert.alert('Error', msg);
                    } finally {
                        setSaving(false);
                    }
                },
            },
        ]);
    };

    const handleOpenGallery = async () => {
        const result = await launchImageLibrary({ mediaType: 'photo', maxHeight: 800, maxWidth: 800, quality: 0.85 });
        if (result.assets && result.assets.length > 0) {
            setLocalLogoAsset({ ...result.assets[0] });
            setTimeout(() => setShowFullImage(true), 100);
        }
    };

    const handleOpenCamera = async () => {
        const result = await launchCamera({
            mediaType: 'photo',
            maxHeight: 800,
            maxWidth: 800,
            quality: 0.8,
            cameraType: 'back',
        });
        if (result.assets && result.assets.length > 0) {
            setLocalLogoAsset({ ...result.assets[0] });
            setTimeout(() => setShowFullImage(true), 100);
        }
    };

    const handleAddImage = () => {
        Alert.alert('Company logo', 'Choose an option', [
            { text: 'Gallery', onPress: handleOpenGallery },
            { text: 'Camera', onPress: handleOpenCamera },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const resolveIndustryForApi = () => {
        const trimmedOther = (industryOther || '').trim();
        return industryId === 'other' ? trimmedOther : industryId || '';
    };

    const resolveIndustryLabelForRedux = () => {
        if (industryId === 'other') return (industryOther || '').trim();
        return selectedIndustryMeta?.label || '';
    };

    const handleSave = async () => {
        const name = (companyName || '').trim();
        const phone = (companyPhone || '').trim();
        const email = (companyEmail || '').trim();
        const address = (companyAddress || '').trim();
        const industryForApi = resolveIndustryForApi();

        if (!name) {
            Alert.alert('Required', 'Please enter your company name.');
            return;
        }
        if (!phone) {
            Alert.alert('Required', 'Please enter your company phone.');
            return;
        }
        if (!email) {
            Alert.alert('Required', 'Please enter your company email.');
            return;
        }
        if (!address) {
            Alert.alert('Required', 'Please enter your company address.');
            return;
        }
        if (!industryForApi) {
            Alert.alert('Required', 'Please select your industry or company type.');
            return;
        }

        setSaving(true);
        try {
            const org = (organization || '').trim() || name;
            const body = {
                name,
                organization: org,
                phone,
                address,
                email,
                industry_id: industryForApi,
            };

            if (localLogoAsset?.uri) {
                const uploaded = await imagesApi.upload(localLogoAsset);
                const ids = uploaded?.ids;
                const newKey = Array.isArray(ids) && ids[0] ? ids[0] : null;
                if (!newKey) {
                    throw new Error('Upload did not return an image reference.');
                }
                body.logo = newKey;
            }

            const updated = await tenantsApi.updateMyCompanyInfo(body);
            const nextLogo =
                updated?.logo != null
                    ? updated.logo
                    : body.logo !== undefined
                      ? body.logo
                      : serverLogoKey;
            setServerLogoKey(nextLogo);
            setLocalLogoAsset(null);

            const industryLabel = resolveIndustryLabelForRedux();
            dispatch(
                setCompanyDetails({
                    companyName: name,
                    companyAddress: address,
                    companyPhone: phone,
                    companyEmail: email,
                    companyIndustry: industryLabel || appSettings.companyIndustry || '',
                }),
            );
            Alert.alert('Saved', 'Company profile was updated.');
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Could not save company profile.';
            Alert.alert('Error', msg);
        } finally {
            setSaving(false);
        }
    };

    const modalImageSource = localLogoAsset?.uri
        ? { uri: localLogoAsset.uri }
        : avatarSource || null;

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={config.THEME_COLOR} />
                <AppText label="Loading company..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
            </SafeAreaView>
        );
    }

    const inputWrapStyle = {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.inputBackground || colors.surfaceTertiary,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.inputBorder || colors.border,
        paddingHorizontal: 12,
        minHeight: 48,
    };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScreenHeader onPress={backPress} label="Company Profile">
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleSave}
                        disabled={saving}
                        style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            marginRight: 8,
                            borderRadius: 8,
                            backgroundColor: config.THEME_COLOR,
                            opacity: saving ? 0.6 : 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}>
                        {saving ? (
                            <>
                                <ActivityIndicator color={colors.textInverse} size="small" style={{ marginRight: 8 }} />
                                <AppText label="Saving…" variant={1} color={colors.textInverse} />
                            </>
                        ) : (
                            <AppText label="Save" variant={1} color={colors.textInverse} />
                        )}
                    </TouchableOpacity>
                </ScreenHeader>
                <View
                    style={{
                        backgroundColor: colors.surface,
                        elevation: 2,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                    }}>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => setShowFullImage(true)}
                        style={{
                            width: 90,
                            height: 90,
                            borderRadius: 45,
                            backgroundColor: colors.surfaceTertiary,
                            marginBottom: -45,
                            justifyContent: 'center',
                            alignSelf: 'center',
                            overflow: 'hidden',
                        }}>
                        {avatarSource ? (
                            <Image source={avatarSource} style={{ width: 90, height: 90 }} resizeMode="cover" />
                        ) : (
                            <Image
                                source={require('../../assets/images/product-image-placeholder.png')}
                                style={{ width: 90, height: 90, opacity: 0.7 }}
                                resizeMode="cover"
                            />
                        )}
                    </TouchableOpacity>
                </View>
                <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={handleAddImage}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: colors.surface,
                        alignSelf: 'center',
                        marginLeft: 120,
                        marginTop: 10,
                        elevation: 3,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 3,
                    }}>
                    <Lucide name="camera" color={colors.text} size={15} />
                </TouchableOpacity>
                <AppText label={companyName || 'Company name'} variant={1} style={{ marginTop: 10, textAlign: 'center', fontSize: 22 }} color={colors.text} />
                <AppText
                    label={organization ? `[${organization}]` : ''}
                    style={{ textAlign: 'center', paddingBottom: 10, minHeight: 20 }}
                    color={colors.textSecondary}
                />
                <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
                    <View
                        style={{
                            padding: 16,
                            backgroundColor: colors.surface,
                            marginTop: 10,
                            borderRadius: 8,
                            elevation: 2,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 2,
                        }}>
                        <AppText label="Company name" fontSize={12} color={colors.textSecondary} style={{ marginBottom: 6 }} />
                        <View style={inputWrapStyle}>
                            <Lucide name="building-2" color={colors.textSecondary} size={18} style={{ marginRight: 10 }} />
                            <TextInput
                                value={companyName}
                                onChangeText={setCompanyName}
                                placeholder="Company name"
                                placeholderTextColor={colors.placeholder}
                                style={{ flex: 1, color: colors.text, paddingVertical: 10, fontFamily: 'FiraSans-Regular' }}
                            />
                        </View>
                        <AppText label="Organization / display name" fontSize={12} color={colors.textSecondary} style={{ marginTop: 14, marginBottom: 6 }} />
                        <View style={inputWrapStyle}>
                            <Lucide name="layers" color={colors.textSecondary} size={18} style={{ marginRight: 10 }} />
                            <TextInput
                                value={organization}
                                onChangeText={setOrganization}
                                placeholder="Shown on receipts (optional)"
                                placeholderTextColor={colors.placeholder}
                                style={{ flex: 1, color: colors.text, paddingVertical: 10, fontFamily: 'FiraSans-Regular' }}
                            />
                        </View>
                        <AppText label="Industry" fontSize={12} color={colors.textSecondary} style={{ marginTop: 14, marginBottom: 6 }} />
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                setIndustrySearch('');
                                setShowIndustryPicker(true);
                            }}
                            style={[inputWrapStyle, { minHeight: 48 }]}>
                            <Lucide name="briefcase" color={colors.textSecondary} size={18} style={{ marginRight: 10 }} />
                            <AppText
                                label={displayIndustryLabel}
                                numberOfLines={1}
                                style={{ flex: 1, color: industryId || industryOther ? colors.text : colors.placeholder }}
                            />
                            <Lucide name="chevron-down" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                        {industryId === 'other' ? (
                            <TextInput
                                value={industryOther}
                                onChangeText={setIndustryOther}
                                placeholder="Type your industry"
                                placeholderTextColor={colors.placeholder}
                                style={{
                                    marginTop: 10,
                                    borderWidth: 1,
                                    borderColor: colors.inputBorder || colors.border,
                                    borderRadius: 8,
                                    padding: 12,
                                    color: colors.text,
                                    backgroundColor: colors.inputBackground || colors.surfaceTertiary,
                                    fontFamily: 'FiraSans-Regular',
                                }}
                            />
                        ) : null}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
                            <Lucide name="hash" color={colors.textSecondary} size={20} />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <AppText label="Phone" fontSize={12} color={colors.textSecondary} style={{ marginBottom: 6 }} />
                                <View style={inputWrapStyle}>
                                    <TextInput
                                        value={companyPhone}
                                        onChangeText={setCompanyPhone}
                                        placeholder="Phone"
                                        keyboardType="phone-pad"
                                        placeholderTextColor={colors.placeholder}
                                        style={{ flex: 1, color: colors.text, paddingVertical: 10, fontFamily: 'FiraSans-Regular' }}
                                    />
                                </View>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 16 }}>
                            <Lucide name="mail" color={colors.textSecondary} size={20} style={{ marginTop: 22 }} />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <AppText label="Email" fontSize={12} color={colors.textSecondary} style={{ marginBottom: 6 }} />
                                <View style={inputWrapStyle}>
                                    <TextInput
                                        value={companyEmail}
                                        onChangeText={setCompanyEmail}
                                        placeholder="Email"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        placeholderTextColor={colors.placeholder}
                                        style={{ flex: 1, color: colors.text, paddingVertical: 10, fontFamily: 'FiraSans-Regular' }}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                    <View
                        style={{
                            padding: 16,
                            backgroundColor: colors.surface,
                            marginTop: 20,
                            marginBottom: 32,
                            borderRadius: 8,
                            elevation: 2,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.1,
                            shadowRadius: 2,
                        }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                            <Lucide name="store" color={colors.textSecondary} size={20} style={{ marginTop: 14 }} />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <AppText label="Address" fontSize={12} color={colors.textSecondary} style={{ marginBottom: 6 }} />
                                <View style={[inputWrapStyle, { alignItems: 'flex-start', minHeight: 88 }]}>
                                    <TextInput
                                        value={companyAddress}
                                        onChangeText={setCompanyAddress}
                                        placeholder="Business address"
                                        multiline
                                        placeholderTextColor={colors.placeholder}
                                        style={{
                                            flex: 1,
                                            color: colors.text,
                                            paddingVertical: 10,
                                            minHeight: 72,
                                            textAlignVertical: 'top',
                                            fontFamily: 'FiraSans-Regular',
                                        }}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>
                <AppModal title="Industry" handleClose={() => setShowIndustryPicker(false)} onRequestClose={() => setShowIndustryPicker(false)} visible={showIndustryPicker}>
                    <View style={{ paddingHorizontal: 12 }}>
                        <View style={[inputWrapStyle, { marginBottom: 10 }]}>
                            <Lucide name="search" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                            <TextInput
                                value={industrySearch}
                                onChangeText={setIndustrySearch}
                                placeholder="Search"
                                placeholderTextColor={colors.placeholder}
                                style={{ flex: 1, color: colors.text, paddingVertical: 8, fontFamily: 'FiraSans-Regular' }}
                            />
                        </View>
                        <ScrollView style={{ maxHeight: width * 0.5 }}>
                            {filteredIndustries.map((item) => (
                                <TouchableOpacity
                                    key={String(item.id)}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        if (item.id === 'other') setIndustryId('other');
                                        else {
                                            setIndustryId(item.id);
                                            setIndustryOther('');
                                        }
                                        setShowIndustryPicker(false);
                                    }}
                                    style={{
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: colors.border,
                                    }}>
                                    <AppText label={item.label} color={colors.text} />
                                    {item.description ? (
                                        <AppText label={item.description} fontSize={12} color={colors.textSecondary} style={{ marginTop: 4 }} />
                                    ) : null}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </AppModal>
                <AppModal title="Logo" handleClose={() => setShowFullImage(false)} onRequestClose={() => setShowFullImage(false)} visible={showFullImage}>
                    <View style={{ padding: 10, alignItems: 'center' }}>
                        {modalImageSource ? (
                            <Image
                                source={modalImageSource}
                                style={{ width: width / 1.5, height: width / 1.5, borderRadius: 5, marginTop: 10 }}
                                resizeMode="cover"
                            />
                        ) : (
                            <Image
                                source={require('../../assets/images/product-image-placeholder.png')}
                                style={{ width: width / 1.5, height: width / 1.5, borderRadius: 5, marginTop: 10, opacity: 0.7 }}
                                resizeMode="cover"
                            />
                        )}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 15 }}>
                            {localLogoAsset ? (
                                <TouchableOpacity
                                    activeOpacity={0.6}
                                    onPress={handleRemoveImage}
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 20,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        backgroundColor: colors.surfaceSecondary,
                                    }}>
                                    <Lucide name="x" size={20} color={colors.text} />
                                </TouchableOpacity>
                            ) : serverLogoKey ? (
                                <TouchableOpacity
                                    activeOpacity={0.6}
                                    onPress={handleRemoveImage}
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 20,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        backgroundColor: colors.surfaceSecondary,
                                    }}>
                                    <Lucide name="trash-2" size={20} color={colors.error} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>
                </AppModal>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default CompanyProfile;
