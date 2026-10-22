import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { merchants as merchantsApi } from '../../services/api';
import AppAlert from '../../utils/appAlert';
import {
    PAYOUT_STATUS,
    ReasonModal,
    StatusPill,
    agentTypeLabel,
    apiErrorMessage,
    fmtDate,
    fmtMoney,
    momoNetworkLabel,
    userDisplayName,
} from './merchant_shared';

const FILTERS = [{ value: '', label: 'All' }, ...Object.entries(PAYOUT_STATUS).map(([value, m]) => ({ value, label: m.label }))];

function momoLine(p) {
    const s = p.payout_snapshot;
    return s ? `${momoNetworkLabel(s.momo_network)} · ${s.momo_number}` : '—';
}

/** Platform admin: weekly agent payout queue — approving sends MoMo via Paystack. */
const AgentPayouts = ({ navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const canGoBack = typeof navigation.canGoBack === 'function' && navigation.canGoBack();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [status, setStatus] = useState('');
    const [payouts, setPayouts] = useState([]);
    const [liveBlocked, setLiveBlocked] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [preparing, setPreparing] = useState(false);
    const [rejectTarget, setRejectTarget] = useState(null);

    const load = useCallback(async (filter) => {
        try {
            const res = await merchantsApi.adminPayouts(filter || undefined);
            setPayouts(Array.isArray(res?.payouts) ? res.payouts : []);
            setLiveBlocked(Boolean(res?.live_transfers_blocked));
        } catch (e) {
            AppAlert.alert('Agent payouts', apiErrorMessage(e, 'Could not load payouts.'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            load(status);
        }, [load, status]),
    );

    const awaiting = useMemo(() => payouts.filter((p) => p.status === 'pending_approval'), [payouts]);
    const awaitingTotal = awaiting.reduce((s, p) => s + Number(p.amount || 0), 0);

    const prepare = async () => {
        setPreparing(true);
        try {
            const res = await merchantsApi.preparePayouts();
            const created = res?.created ?? [];
            const skipped = res?.skipped_no_profile ?? [];
            const skippedText = skipped.length
                ? `\n\n${skipped.length} agent(s) skipped because they have no MoMo details: ${skipped.map((s) => s.name).join(', ')}.`
                : '';
            AppAlert.alert('Payouts prepared', `${created.length} payout(s) ready for approval.${skippedText}`);
            load(status);
        } catch (e) {
            AppAlert.alert('Prepare payouts', apiErrorMessage(e, 'Could not prepare payouts.'));
        } finally {
            setPreparing(false);
        }
    };

    const runAction = async (p, fn, onDone) => {
        setBusyId(p.id);
        try {
            const res = await fn();
            onDone?.(res);
            load(status);
        } catch (e) {
            AppAlert.alert('Agent payout', apiErrorMessage(e, 'Could not update payout.'));
        } finally {
            setBusyId(null);
        }
    };

    const approve = (p) => {
        AppAlert.alert(
            p.status === 'failed' ? 'Retry payout?' : 'Send payout?',
            `Send GH₵ ${fmtMoney(p.amount)} to ${userDisplayName(p)} (${momoLine(p)})?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send',
                    onPress: () =>
                        runAction(p, () => merchantsApi.approvePayout(p.id), (res) => {
                            const s = res?.payout?.status;
                            if (s === 'paid') AppAlert.alert('Payout sent', 'The agent has been paid.');
                            else if (s === 'failed')
                                AppAlert.alert('Payout failed', res?.payout?.failure_reason || 'Unknown error. You can retry or reject it.');
                            else AppAlert.alert('Sent to Paystack', 'Waiting for Paystack to confirm the transfer.');
                        }),
                },
            ],
        );
    };

    const markFailed = (p) => {
        AppAlert.alert(
            'Mark payout failed?',
            'Only do this after confirming on the Paystack dashboard that this transfer did not go through.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark failed',
                    style: 'destructive',
                    onPress: () => runAction(p, () => merchantsApi.markPayoutFailed(p.id)),
                },
            ],
        );
    };

    const confirmReject = (reason) => {
        const p = rejectTarget;
        setRejectTarget(null);
        if (p) runAction(p, () => merchantsApi.rejectPayout(p.id, reason || undefined));
    };

    const card = {
        padding: 14,
        marginBottom: 10,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    };

    const actionButton = (label, onPress, variant, disabled) => (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={{
                paddingVertical: 7,
                paddingHorizontal: 12,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: variant === 'primary' ? config.THEME_COLOR : variant === 'warning' ? '#d97706' : colors.border,
                backgroundColor: variant === 'primary' ? config.THEME_COLOR : 'transparent',
                opacity: disabled ? 0.5 : 1,
            }}
        >
            <AppText
                label={label}
                fontSize={12}
                variant={1}
                color={variant === 'primary' ? '#fff' : variant === 'warning' ? '#d97706' : colors.text}
            />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader hideBack={!canGoBack} onPress={() => navigation.goBack()} label="Agent payouts" />
            <ScrollView
                contentContainerStyle={{ padding: 12, paddingBottom: 28 + insets.bottom }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            load(status);
                        }}
                    />
                }
            >
                {liveBlocked ? (
                    <View style={{ padding: 12, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.15)', marginBottom: 12 }}>
                        <AppText
                            label="Real agent payouts are switched off. Set AGENT_PAYOUTS_ENABLED=true on the API when you are ready to send money."
                            fontSize={12}
                            color={colors.text}
                        />
                    </View>
                ) : null}

                <AppText
                    label={`Payouts are prepared every Monday for agents with at least GH₵ 50 payable and MoMo details on file.${
                        awaiting.length ? ` ${awaiting.length} awaiting approval (GH₵ ${fmtMoney(awaitingTotal)}).` : ''
                    }`}
                    fontSize={12}
                    color={colors.textSecondary}
                />

                <TouchableOpacity
                    onPress={prepare}
                    disabled={preparing || busyId != null}
                    style={{
                        marginTop: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: 12,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: config.THEME_COLOR,
                        opacity: preparing ? 0.6 : 1,
                    }}
                >
                    {preparing ? (
                        <ActivityIndicator color={config.THEME_COLOR} />
                    ) : (
                        <>
                            <Lucide name="refresh-cw" size={16} color={config.THEME_COLOR} />
                            <AppText label="Prepare payouts now" variant={1} fontSize={14} color={config.THEME_COLOR} />
                        </>
                    )}
                </TouchableOpacity>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, marginBottom: 12 }}>
                    {FILTERS.map((f) => {
                        const active = f.value === status;
                        return (
                            <TouchableOpacity
                                key={f.value || 'all'}
                                onPress={() => {
                                    setLoading(true);
                                    setStatus(f.value);
                                }}
                                style={{
                                    marginRight: 8,
                                    paddingVertical: 6,
                                    paddingHorizontal: 12,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: active ? config.THEME_COLOR : colors.border,
                                    backgroundColor: active ? config.THEME_COLOR + '22' : colors.surface,
                                }}
                            >
                                <AppText label={f.label} fontSize={12} color={active ? colors.text : colors.textSecondary} />
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {loading ? (
                    <ActivityIndicator color={config.THEME_COLOR} style={{ marginTop: 24 }} />
                ) : payouts.length === 0 ? (
                    <AppText
                        label={`No payouts${status ? ' with this status' : ''}.`}
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginTop: 8 }}
                    />
                ) : (
                    payouts.map((p) => {
                        const busy = busyId === p.id;
                        return (
                            <View key={p.id} style={card}>
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <AppText label={userDisplayName(p)} variant={1} fontSize={15} color={colors.text} />
                                        <AppText label={agentTypeLabel(p.agent_type)} fontSize={11} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                    </View>
                                    <AppText label={`GH₵ ${fmtMoney(p.amount)}`} variant={1} fontSize={16} color={colors.text} />
                                </View>
                                <AppText label={momoLine(p)} fontSize={12} color={colors.textSecondary} style={{ marginTop: 8 }} />
                                {p.payout_snapshot?.account_holder_name ? (
                                    <AppText label={p.payout_snapshot.account_holder_name} fontSize={12} color={colors.textSecondary} />
                                ) : null}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                    <StatusPill meta={PAYOUT_STATUS[p.status]} fallback={p.status} />
                                    <AppText
                                        label={`${p.commission_count} commission${p.commission_count === 1 ? '' : 's'} · ${fmtDate(p.created_at)}`}
                                        fontSize={11}
                                        color={colors.textTertiary}
                                    />
                                </View>
                                {p.failure_reason ? (
                                    <AppText label={p.failure_reason} fontSize={11} color="#dc2626" style={{ marginTop: 6 }} />
                                ) : null}
                                {p.status === 'pending_approval' || p.status === 'failed' || p.status === 'processing' ? (
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                                        {p.status === 'processing'
                                            ? actionButton('Mark failed', () => markFailed(p), 'warning', busy)
                                            : (
                                                  <>
                                                      {actionButton(p.status === 'failed' ? 'Retry' : 'Approve & send', () => approve(p), 'primary', busy)}
                                                      {actionButton('Reject', () => setRejectTarget(p), 'default', busy)}
                                                  </>
                                              )}
                                        {busy ? <ActivityIndicator color={config.THEME_COLOR} /> : null}
                                    </View>
                                ) : null}
                            </View>
                        );
                    })
                )}
            </ScrollView>

            <ReasonModal
                visible={rejectTarget != null}
                title="Reject payout?"
                message="Its commissions become payable again and go into the next batch."
                confirmLabel="Reject payout"
                destructive
                onCancel={() => setRejectTarget(null)}
                onConfirm={confirmReject}
            />
        </SafeAreaView>
    );
};

export default AgentPayouts;
