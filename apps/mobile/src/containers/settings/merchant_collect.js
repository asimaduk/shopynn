import React, { useCallback, useState } from 'react';
import {
    View,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
    Share,
    Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import { merchants as merchantsApi } from '../../services/api';
import { MOMO_NETWORK_OPTIONS, getMomoNetworkIcon } from '../../utils/momoNetworks';

const MerchantCollect = ({ navigation, route }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const tenantId = route.params?.tenantId;
    const [quote, setQuote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [method, setMethod] = useState('momo');
    const [phone, setPhone] = useState('');
    const [network, setNetwork] = useState('mtn');
    const [busy, setBusy] = useState(false);
    const [ownerEmail, setOwnerEmail] = useState(route.params?.ownerEmail || '');
    const [cardUrl, setCardUrl] = useState(null);
    const [transactionRef, setTransactionRef] = useState(null);
    const [otp, setOtp] = useState('');

    const loadQuote = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const res = await merchantsApi.getQuote(tenantId);
            setQuote(res?.quote || null);
            if (res?.quote?.owner_email) setOwnerEmail(res.quote.owner_email);
        } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not load quote');
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useFocusEffect(
        useCallback(() => {
            loadQuote();
        }, [loadQuote]),
    );

    const initiate = async () => {
        if (!tenantId) return;
        setBusy(true);
        try {
            const body = {
                payment_method: method === 'momo' ? 'mobile_money' : 'card',
                phone: method === 'momo' ? phone.replace(/\D/g, '').slice(0, 10) : undefined,
                provider: method === 'momo' ? network : undefined,
            };
            const res = await merchantsApi.initiatePayment(tenantId, body);
            setOwnerEmail(res?.owner_email || ownerEmail);
            setTransactionRef(res?.transaction_ref || null);
            if (res?.redirect_url) {
                setCardUrl(res.redirect_url);
            } else {
                Alert.alert('MoMo', res?.display_text || 'Charge sent. Enter OTP if prompted.');
            }
            await loadQuote();
        } catch (e) {
            Alert.alert('Payment', e?.response?.data?.message || e?.message || 'Failed');
        } finally {
            setBusy(false);
        }
    };

    const submitOtp = async () => {
        if (!transactionRef) return;
        setBusy(true);
        try {
            await merchantsApi.submitOtp(tenantId, { reference: transactionRef, otp });
            Alert.alert('Success', 'Payment completed.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (e) {
            Alert.alert('OTP', e?.response?.data?.message || e?.message || 'Failed');
        } finally {
            setBusy(false);
        }
    };

    const copyEmail = () => {
        if (ownerEmail) Clipboard.setString(ownerEmail);
        Alert.alert('Copied', 'Owner email copied.');
    };

    const shareLink = async () => {
        if (!cardUrl) return;
        try {
            await Share.share({ message: `Pay Shopynn: ${cardUrl}\nUse email: ${ownerEmail}` });
        } catch (_) {}
    };

    if (loading) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
                <ActivityIndicator style={{ marginTop: 40 }} color={config.THEME_COLOR} />
            </SafeAreaView>
        );
    }

    if (!quote) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader title="Collect payment" navigation={navigation} />
                <AppText label="No pending quote." style={{ padding: 20 }} color={colors.textSecondary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader title="Collect payment" navigation={navigation} />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 + insets.bottom }}>
                <AppText label={`Total: GHS ${Number(quote.total_ghs).toFixed(2)}`} fontSize={22} variant={1} color={colors.text} />
                {(quote.lines || []).map((l) => (
                    <AppText
                        key={l.code}
                        label={`• ${l.label}: GHS ${Number(l.amount_ghs).toFixed(2)}`}
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginTop: 4 }}
                    />
                ))}

                <View style={{ flexDirection: 'row', marginTop: 20, gap: 8 }}>
                    {['momo', 'card'].map((m) => (
                        <TouchableOpacity
                            key={m}
                            onPress={() => setMethod(m)}
                            style={{
                                flex: 1,
                                padding: 12,
                                borderRadius: 6,
                                borderWidth: method === m ? 2 : 1,
                                borderColor: method === m ? config.THEME_COLOR : colors.border,
                            }}
                        >
                            <AppText label={m === 'momo' ? 'MoMo' : 'Card link'} fontSize={14} color={colors.text} />
                        </TouchableOpacity>
                    ))}
                </View>

                {method === 'momo' ? (
                    <>
                        <TextInput
                            placeholder="Owner phone (10 digits)"
                            placeholderTextColor={colors.placeholder}
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                            style={{
                                marginTop: 12,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 6,
                                padding: 12,
                                color: colors.text,
                            }}
                        />
                        <View style={{ flexDirection: 'row', marginTop: 8, gap: 6 }}>
                            {MOMO_NETWORK_OPTIONS.map((n) => (
                                <TouchableOpacity
                                    key={n.id}
                                    onPress={() => setNetwork(n.provider)}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 10,
                                        paddingHorizontal: 6,
                                        borderRadius: 6,
                                        borderWidth: network === n.provider ? 2 : 1,
                                        borderColor: network === n.provider ? config.THEME_COLOR : colors.border,
                                        alignItems: 'center',
                                        gap: 4,
                                    }}
                                >
                                    <Image
                                        source={getMomoNetworkIcon(n.id)}
                                        style={{ width: 28, height: 28 }}
                                        resizeMode="contain"
                                    />
                                    <AppText label={n.label} fontSize={11} color={colors.text} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                ) : null}

                <TouchableOpacity
                    onPress={initiate}
                    disabled={busy}
                    style={{
                        marginTop: 16,
                        backgroundColor: config.THEME_COLOR,
                        padding: 14,
                        borderRadius: 6,
                        alignItems: 'center',
                    }}
                >
                    {busy ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <AppText label="Start payment" color="#fff" fontSize={16} variant={1} />
                    )}
                </TouchableOpacity>

                {ownerEmail ? (
                    <TouchableOpacity onPress={copyEmail} style={{ marginTop: 16 }}>
                        <AppText label={`Owner email: ${ownerEmail} (tap to copy)`} fontSize={13} color={config.THEME_COLOR} />
                    </TouchableOpacity>
                ) : null}

                {cardUrl ? (
                    <>
                        <TouchableOpacity onPress={shareLink} style={{ marginTop: 12 }}>
                            <AppText label="Share payment link" fontSize={14} color={config.THEME_COLOR} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('PaymentWebView', { checkoutUrl: cardUrl })}
                            style={{ marginTop: 8 }}
                        >
                            <AppText label="Open checkout in app" fontSize={14} color={colors.text} />
                        </TouchableOpacity>
                    </>
                ) : null}

                {transactionRef && method === 'momo' ? (
                    <>
                        <TextInput
                            placeholder="OTP"
                            placeholderTextColor={colors.placeholder}
                            value={otp}
                            onChangeText={setOtp}
                            style={{
                                marginTop: 16,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 6,
                                padding: 12,
                                color: colors.text,
                            }}
                        />
                        <TouchableOpacity
                            onPress={submitOtp}
                            disabled={busy}
                            style={{
                                marginTop: 8,
                                borderWidth: 1,
                                borderColor: config.THEME_COLOR,
                                padding: 12,
                                borderRadius: 6,
                                alignItems: 'center',
                            }}
                        >
                            <AppText label="Submit OTP" color={config.THEME_COLOR} />
                        </TouchableOpacity>
                        <AppText
                            label="Retry creates a new reference; same quote total."
                            fontSize={11}
                            color={colors.textTertiary}
                            style={{ marginTop: 8 }}
                        />
                    </>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
};

export default MerchantCollect;
