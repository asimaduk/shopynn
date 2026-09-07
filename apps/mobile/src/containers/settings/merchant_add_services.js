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

const MerchantAddServices = ({ navigation, route }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const tenantId = route.params?.tenantId;
    const businessName = route.params?.businessName || 'Business';
    const [ownerEmail, setOwnerEmail] = useState(route.params?.ownerEmail || '');
    const [catalog, setCatalog] = useState(null);
    const [addonCodes, setAddonCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const loadCatalog = useCallback(async () => {
        setLoading(true);
        try {
            const cat = await billingApi.catalog({ grouped: true });
            setCatalog(cat);
        } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not load services');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadCatalog();
        }, [loadCatalog]),
    );

    const total = useMemo(() => {
        if (!catalog?.addons) return 0;
        return (catalog.addons || [])
            .filter((a) => addonCodes.includes(a.code))
            .reduce((s, a) => s + (Number(a.amount_ghs) || 0), 0);
    }, [catalog, addonCodes]);

    const toggleAddon = (code) => {
        setAddonCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
    };

    const handleCreateQuote = async () => {
        if (!tenantId) return;
        if (addonCodes.length === 0) {
            Alert.alert('Add services', 'Select at least one paid service.');
            return;
        }
        setBusy(true);
        try {
            await merchantsApi.createQuote(tenantId, {
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
            Alert.alert('Add services', msg);
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

    const addons = catalog?.addons || [];

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader title="Add services" navigation={navigation} />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}>
                <AppText label={businessName} fontSize={18} variant={1} color={colors.text} />
                <AppText
                    label="Create a quote for paid setup help (migration, training, import, etc.)."
                    fontSize={13}
                    color={colors.textSecondary}
                    style={{ marginTop: 6, marginBottom: 16 }}
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

                {addons.length === 0 ? (
                    <AppText label="No add-on services configured." color={colors.textSecondary} />
                ) : (
                    addons.map((a) => {
                        const on = addonCodes.includes(a.code);
                        return (
                            <TouchableOpacity
                                key={a.code}
                                onPress={() => toggleAddon(a.code)}
                                style={{
                                    marginBottom: 10,
                                    padding: 14,
                                    borderRadius: 6,
                                    borderWidth: on ? 2 : 1,
                                    borderColor: on ? config.THEME_COLOR : colors.border,
                                    backgroundColor: on ? `${config.THEME_COLOR}12` : colors.surface,
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Lucide
                                        name={on ? 'square-check-big' : 'square'}
                                        size={20}
                                        color={on ? config.THEME_COLOR : colors.textTertiary}
                                    />
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <AppText label={a.label} fontSize={14} color={colors.text} />
                                        <AppText
                                            label={`GHS ${Number(a.amount_ghs).toFixed(2)}`}
                                            fontSize={13}
                                            color={colors.textSecondary}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}

                {total > 0 ? (
                    <AppText
                        label={`Total: GHS ${total.toFixed(2)}`}
                        fontSize={17}
                        variant={1}
                        color={config.THEME_COLOR}
                        style={{ marginTop: 8 }}
                    />
                ) : null}

                <TouchableOpacity
                    onPress={handleCreateQuote}
                    disabled={busy || addonCodes.length === 0}
                    style={{
                        marginTop: 20,
                        backgroundColor: addonCodes.length ? config.THEME_COLOR : colors.border,
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

export default MerchantAddServices;
