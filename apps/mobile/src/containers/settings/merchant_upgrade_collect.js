import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { merchants as merchantsApi, billing as billingApi } from '../../services/api';
import { buildPlansFromCatalog, computeQuoteTotalFromSelection, filterSellableAddons } from '../../utils/billingCatalog';

const BORDER_RADIUS = 5;

const MerchantUpgradeCollect = ({ navigation, route }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const tenantId = route.params?.tenantId;
    const businessName = route.params?.businessName || 'Business';
    const [ownerEmail, setOwnerEmail] = useState(route.params?.ownerEmail || '');
    const [catalog, setCatalog] = useState(null);
    const [plan, setPlan] = useState(3);
    const [addonCodes, setAddonCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const loadCatalog = useCallback(async () => {
        setLoading(true);
        try {
            const cat = await billingApi.catalog({ grouped: true });
            setCatalog(cat);
        } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not load plans');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadCatalog();
        }, [loadCatalog]),
    );

    const paidPlans = useMemo(() => {
        const plans = buildPlansFromCatalog(catalog) || [];
        return plans.filter((p) => p.v >= 2);
    }, [catalog]);

    const quoteTotal = useMemo(
        () => (catalog ? computeQuoteTotalFromSelection(catalog, plan, addonCodes) : 0),
        [catalog, plan, addonCodes],
    );

    const toggleAddon = (code) => {
        setAddonCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
    };

    const handleCreateQuote = async () => {
        if (!tenantId) return;
        if (plan < 2) {
            Alert.alert('Upgrade & collect', 'Choose Basic, Standard, or Premium.');
            return;
        }
        setBusy(true);
        try {
            await merchantsApi.createQuote(tenantId, {
                quote_kind: 'upgrade_collect',
                subscription_type: plan,
                addon_codes: addonCodes,
                owner_email: ownerEmail.trim() || undefined,
            });
            navigation.replace('MerchantCollect', {
                tenantId,
                ownerEmail: ownerEmail.trim(),
            });
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || 'Failed';
            if (String(msg).toLowerCase().includes('pending')) {
                Alert.alert('Payment pending', 'A quote is already awaiting payment.', [
                    { text: 'Collect now', onPress: () => navigation.replace('MerchantCollect', { tenantId }) },
                    { text: 'OK' },
                ]);
                return;
            }
            Alert.alert('Upgrade & collect', msg);
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <ActivityIndicator style={{ marginTop: 40 }} color={config.THEME_COLOR} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader title="Upgrade & collect" navigation={navigation} />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}>
                <AppText label={businessName} fontSize={18} variant={1} color={colors.text} />
                <AppText
                    label="After a Free trial demo, create a paid plan quote (onboarding + first month). You earn commission when payment succeeds."
                    fontSize={13}
                    color={colors.textSecondary}
                    style={{ marginTop: 6, marginBottom: 16, lineHeight: 19 }}
                />

                <AppText label="Owner email (for card checkout)" fontSize={12} color={colors.textTertiary} />
                <TextInput
                    value={ownerEmail}
                    onChangeText={setOwnerEmail}
                    placeholder="owner@example.com"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={{
                        marginTop: 6,
                        marginBottom: 16,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 6,
                        padding: 12,
                        color: colors.text,
                    }}
                />

                <AppText label="Choose plan" variant={1} fontSize={14} color={colors.text} style={{ marginBottom: 8 }} />
                {paidPlans.map((p) => {
                    const active = plan === p.v;
                    return (
                        <TouchableOpacity
                            key={p.v}
                            onPress={() => setPlan(p.v)}
                            style={{
                                marginBottom: 10,
                                padding: 14,
                                borderRadius: BORDER_RADIUS,
                                borderWidth: active ? 2 : 1,
                                borderColor: active ? config.THEME_COLOR : colors.border,
                                backgroundColor: active ? `${config.THEME_COLOR}12` : colors.surface,
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                <View style={{ flex: 1, paddingRight: 10 }}>
                                    <AppText label={p.title} variant={1} fontSize={16} color={colors.text} />
                                    <AppText
                                        label={`${p.amountBold} ${p.amountSub}`}
                                        fontSize={13}
                                        color={colors.textSecondary}
                                        style={{ marginTop: 4 }}
                                    />
                                    {p.onboardingGhs > 0 ? (
                                        <AppText
                                            label={`+ GHS ${Number(p.onboardingGhs).toFixed(2)} onboarding`}
                                            fontSize={12}
                                            color={colors.textTertiary}
                                            style={{ marginTop: 4 }}
                                        />
                                    ) : null}
                                </View>
                                <View
                                    style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: BORDER_RADIUS,
                                        borderWidth: 2,
                                        borderColor: active ? config.THEME_COLOR : colors.border,
                                        backgroundColor: active ? config.THEME_COLOR : 'transparent',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {active ? <Lucide name="check" color="#fff" size={14} /> : null}
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })}

                {(filterSellableAddons(catalog?.addons).length > 0) ? (
                    <View style={{ marginTop: 8 }}>
                        <AppText label="Optional add-ons" variant={1} fontSize={14} color={colors.text} />
                        {filterSellableAddons(catalog.addons).map((a) => {
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
                                    <AppText
                                        label={`${a.label} — GHS ${Number(a.amount_ghs).toFixed(2)}`}
                                        fontSize={13}
                                        color={colors.text}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ) : null}

                {quoteTotal > 0 ? (
                    <AppText
                        label={`Total: GHS ${quoteTotal.toFixed(2)}`}
                        fontSize={17}
                        variant={1}
                        color={config.THEME_COLOR}
                        style={{ marginTop: 14 }}
                    />
                ) : null}

                <TouchableOpacity
                    onPress={handleCreateQuote}
                    disabled={busy || quoteTotal <= 0}
                    style={{
                        marginTop: 20,
                        backgroundColor: quoteTotal > 0 ? config.THEME_COLOR : colors.border,
                        padding: 14,
                        borderRadius: 6,
                        alignItems: 'center',
                    }}
                >
                    {busy ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <AppText label="Create quote & collect payment" color="#fff" fontSize={15} variant={1} />
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

export default MerchantUpgradeCollect;
