import React, { useCallback, useState } from 'react';
import {
    View,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    TextInput,
    StyleSheet,
    Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { merchants as merchantsApi } from '../../services/api';
import AppAlert from '../../utils/appAlert';
import AppModal from '../../components/app_modal';
import { getMomoNetworkIcon } from '../../utils/momoNetworks';
import { MOMO_NETWORKS, PAYOUT_STATUS, StatusPill, apiErrorMessage, fmtDate, fmtMoney, momoNetworkLabel } from './merchant_shared';

const formatMomoNumber = (raw) => {
    const d = String(raw || '').replace(/\D/g, '');
    return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : String(raw || '');
};

/** Agent / manager: commission balances by stage, MoMo payout details and payout history. */
const MerchantEarnings = ({ navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const canGoBack = typeof navigation.canGoBack === 'function' && navigation.canGoBack();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [earnings, setEarnings] = useState(null);
    const [profile, setProfile] = useState(null);
    const [network, setNetwork] = useState('mtn');
    const [number, setNumber] = useState('');
    const [holder, setHolder] = useState('');
    const [saving, setSaving] = useState(false);
    const [editOpen, setEditOpen] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await merchantsApi.earnings();
            setEarnings(res?.earnings ?? null);
            setProfile(res?.payout_profile ?? null);
        } catch (e) {
            AppAlert.alert('Earnings', apiErrorMessage(e, 'Could not load your earnings.'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    const openEditor = () => {
        setNetwork(profile?.momo_network || 'mtn');
        setNumber(profile?.momo_number || '');
        setHolder(profile?.account_holder_name || '');
        setEditOpen(true);
    };

    const save = async () => {
        if (!number.trim() || !holder.trim()) {
            AppAlert.alert('Payout details', 'Enter your MoMo number and the name on the account.');
            return;
        }
        setSaving(true);
        try {
            const res = await merchantsApi.savePayoutProfile({
                momo_network: network,
                momo_number: number.trim(),
                account_holder_name: holder.trim(),
            });
            setProfile(res?.payout_profile ?? null);
            setEditOpen(false);
            AppAlert.alert('Saved', 'Your payout details were saved.');
        } catch (e) {
            AppAlert.alert('Payout details', apiErrorMessage(e, 'Could not save payout details.'));
        } finally {
            setSaving(false);
        }
    };

    const card = {
        padding: 14,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    };
    const input = {
        marginTop: 10,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        padding: 12,
        color: colors.text,
        backgroundColor: colors.background,
    };

    const stat = (label, value, hint, icon) => (
        <View style={[card, { flexBasis: '48%', flexGrow: 1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Lucide name={icon} size={15} color={config.THEME_COLOR} />
                <AppText label={label} variant={2} fontSize={11} color={colors.textTertiary} />
            </View>
            <AppText label={`GH₵ ${fmtMoney(value)}`} variant={1} fontSize={19} color={colors.text} style={{ marginTop: 6 }} />
            {hint ? <AppText label={hint} fontSize={10} color={colors.textTertiary} style={{ marginTop: 4 }} /> : null}
        </View>
    );

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader hideBack={!canGoBack} onPress={() => navigation.goBack()} label="My earnings" />
            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={config.THEME_COLOR} size="large" />
                </View>
            ) : (
                    <ScrollView
                        contentContainerStyle={{ padding: 16, paddingBottom: 28 + insets.bottom }}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => {
                                    setRefreshing(true);
                                    load();
                                }}
                            />
                        }
                        keyboardShouldPersistTaps="handled"
                    >
                        {earnings ? (
                            <>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                    {stat(
                                        'On hold',
                                        earnings.held_ghs,
                                        earnings.next_release_at ? `Next release ${fmtDate(earnings.next_release_at)}` : '30-day hold',
                                        'clock',
                                    )}
                                    {stat('Payable', earnings.payable_ghs, `Paid out from GH₵ ${earnings.payout_min_ghs}`, 'wallet')}
                                    {stat('In payout', earnings.in_payout_ghs, 'Awaiting Shopynn', 'send')}
                                    {stat('Paid', earnings.paid_ghs, null, 'circle-check')}
                                </View>
                                <AppText
                                    label={`${earnings.payout_schedule}. Commission is held for 30 days after the shop pays, then becomes payable. Payouts go to your mobile money number with no fee to you.`}
                                    fontSize={12}
                                    color={colors.textSecondary}
                                    style={{ marginTop: 14 }}
                                />
                            </>
                        ) : null}

                        <View style={[card, { marginTop: 18 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <AppText label="Mobile money payout details" variant={1} fontSize={15} color={colors.text} />
                                {profile ? (
                                    <TouchableOpacity
                                        onPress={openEditor}
                                        hitSlop={8}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    >
                                        <Lucide name="pencil" size={14} color={config.THEME_COLOR} />
                                        <AppText label="Edit" fontSize={13} color={config.THEME_COLOR} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                            {profile ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
                                    <Image source={getMomoNetworkIcon(profile.momo_network)} style={{ width: 40, height: 40, borderRadius: 8 }} resizeMode="contain" />
                                    <View style={{ flex: 1 }}>
                                        <AppText label={formatMomoNumber(profile.momo_number)} variant={1} fontSize={15} color={colors.text} />
                                        <AppText
                                            label={`${momoNetworkLabel(profile.momo_network)} · ${profile.account_holder_name || ''}`}
                                            fontSize={12}
                                            color={colors.textSecondary}
                                            style={{ marginTop: 2 }}
                                        />
                                    </View>
                                </View>
                            ) : (
                                <>
                                    <View
                                        style={{
                                            marginTop: 10,
                                            padding: 10,
                                            borderRadius: 8,
                                            backgroundColor: 'rgba(245,158,11,0.15)',
                                        }}
                                    >
                                        <AppText
                                            label="Add your MoMo details so your commission can be paid."
                                            fontSize={12}
                                            color={colors.text}
                                        />
                                    </View>
                                    <TouchableOpacity
                                        onPress={openEditor}
                                        style={{
                                            marginTop: 12,
                                            backgroundColor: config.THEME_COLOR,
                                            padding: 13,
                                            borderRadius: 999,
                                            alignItems: 'center',
                                        }}
                                    >
                                        <AppText label="Add payout details" color="#fff" variant={1} />
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>

                        <AppText label="Payouts" variant={1} fontSize={15} color={colors.text} style={{ marginTop: 22, marginBottom: 8 }} />
                        {(earnings?.payouts ?? []).length === 0 ? (
                            <AppText label="No payouts yet." fontSize={13} color={colors.textSecondary} />
                        ) : (
                            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' }}>
                                {earnings.payouts.map((p, idx) => (
                                    <View
                                        key={p.id}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 12,
                                            backgroundColor: colors.surface,
                                            borderBottomWidth: idx < earnings.payouts.length - 1 ? StyleSheet.hairlineWidth : 0,
                                            borderBottomColor: colors.border,
                                        }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <AppText label={`GH₵ ${fmtMoney(p.amount)}`} variant={1} fontSize={14} color={colors.text} />
                                            <AppText
                                                label={`${p.commission_count} commission${p.commission_count === 1 ? '' : 's'} · ${fmtDate(p.created_at)}${p.paid_at ? ` · paid ${fmtDate(p.paid_at)}` : ''}`}
                                                fontSize={11}
                                                color={colors.textTertiary}
                                                style={{ marginTop: 3 }}
                                            />
                                        </View>
                                        <StatusPill meta={PAYOUT_STATUS[p.status]} fallback={p.status} />
                                    </View>
                                ))}
                            </View>
                        )}
                    </ScrollView>
            )}
            <AppModal
                visible={editOpen}
                title="Payout details"
                handleClose={saving ? undefined : () => setEditOpen(false)}
                onRequestClose={saving ? undefined : () => setEditOpen(false)}
            >
                <View style={{ padding: 16 }}>
                    <AppText label="Network" fontSize={12} color={colors.textSecondary} />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        {MOMO_NETWORKS.map((n) => {
                            const active = n.value === network;
                            return (
                                <TouchableOpacity
                                    key={n.value}
                                    onPress={() => setNetwork(n.value)}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 10,
                                        paddingHorizontal: 4,
                                        borderRadius: 10,
                                        borderWidth: active ? 2 : 1,
                                        alignItems: 'center',
                                        gap: 6,
                                        borderColor: active ? config.THEME_COLOR : colors.border,
                                        backgroundColor: active ? config.THEME_COLOR + '14' : colors.background,
                                    }}
                                >
                                    <Image source={getMomoNetworkIcon(n.value)} style={{ width: 36, height: 36, borderRadius: 6 }} resizeMode="contain" />
                                    <AppText
                                        label={n.label}
                                        fontSize={11}
                                        color={active ? colors.text : colors.textSecondary}
                                        style={{ textAlign: 'center' }}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <TextInput
                        value={number}
                        onChangeText={setNumber}
                        placeholder="MoMo number (024xxxxxxx)"
                        placeholderTextColor={colors.placeholder}
                        keyboardType="phone-pad"
                        style={[input, { marginTop: 14 }]}
                    />
                    <TextInput
                        value={holder}
                        onChangeText={setHolder}
                        placeholder="Name on the MoMo account"
                        placeholderTextColor={colors.placeholder}
                        style={input}
                    />
                    <TouchableOpacity
                        onPress={save}
                        disabled={saving}
                        style={{
                            marginTop: 16,
                            backgroundColor: config.THEME_COLOR,
                            padding: 13,
                            borderRadius: 999,
                            alignItems: 'center',
                            opacity: saving ? 0.65 : 1,
                        }}
                    >
                        {saving ? <ActivityIndicator color="#fff" /> : <AppText label="Save details" color="#fff" variant={1} />}
                    </TouchableOpacity>
                </View>
            </AppModal>
        </SafeAreaView>
    );
};

export default MerchantEarnings;
