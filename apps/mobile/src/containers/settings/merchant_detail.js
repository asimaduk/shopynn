import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { merchants as merchantsApi } from '../../services/api';
import { hasPermission } from '../../utils/permissions';
import { formatPhone } from '../../utils/format';
import AppAlert from '../../utils/appAlert';
import {
    AGENT_STATUS,
    CommissionPill,
    PickerModal,
    ReasonModal,
    StatusPill,
    agentTypeLabel,
    apiErrorMessage,
    commissionKindLabel,
    fmtDate,
    fmtMoney,
    managerDisplayName,
    userDisplayName,
} from './merchant_shared';

const ROLE_OPTIONS = [
    { value: 'agent', label: 'Field agent', hint: 'Onboards and serves shops.' },
    { value: 'manager', label: 'Agent manager', hint: 'Recruits and runs a team; earns a 20% override on their agents.' },
];

/**
 * Admin merchant partner detail — opened from Merchant portal list.
 * Params: merchantId (merchant row id from admin list).
 */
const MerchantDetail = ({ navigation, route }) => {
    const merchantId = route?.params?.merchantId;
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const user = useSelector(({ user: u }) => u);
    const canManageMerchants = hasPermission(user, 'merchants.view');

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [detailData, setDetailData] = useState(null);
    const [busy, setBusy] = useState(false);
    /** @type {'businesses' | 'commissions' | 'team'} */
    const [detailTab, setDetailTab] = useState('businesses');
    /** @type {null | 'reject' | 'deactivate' | 'cancelCommission'} */
    const [reasonAction, setReasonAction] = useState(null);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [rolePickerOpen, setRolePickerOpen] = useState(false);
    const [managerOptions, setManagerOptions] = useState(null);

    const load = useCallback(async () => {
        if (!merchantId) return;
        try {
            const data = await merchantsApi.adminDetail(merchantId);
            setDetailData(data);
        } catch (e) {
            setDetailData(null);
            AppAlert.alert('Error', apiErrorMessage(e, 'Could not load merchant.'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [merchantId]);

    useFocusEffect(
        useCallback(() => {
            if (!merchantId) {
                navigation.goBack();
                return undefined;
            }
            setLoading(true);
            load();
            return undefined;
        }, [merchantId, load, navigation]),
    );

    const onRefresh = () => {
        setRefreshing(true);
        load();
    };

    const m = detailData?.merchant;
    const tenantsList = detailData?.tenants ?? [];
    const commissionsList = detailData?.commissions ?? [];
    const teamList = detailData?.team ?? [];
    const isManager = m?.agent_type === 'manager';

    const run = async (fn, successTitle, successMessage) => {
        setBusy(true);
        try {
            const res = await fn();
            if (successTitle) AppAlert.alert(successTitle, typeof successMessage === 'function' ? successMessage(res) : successMessage);
            await load();
        } catch (e) {
            AppAlert.alert('Error', apiErrorMessage(e, 'Something went wrong.'));
        } finally {
            setBusy(false);
        }
    };

    const handleMarkPaid = (commissionId) => {
        AppAlert.alert('Mark paid', 'Record this commission as paid outside the app?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Mark paid', onPress: () => run(() => merchantsApi.markPaid(commissionId)) },
        ]);
    };

    const approve = () => {
        AppAlert.alert('Approve agent?', `${userDisplayName(m)} gets a login by email and can start onboarding shops.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Approve',
                onPress: () => run(() => merchantsApi.approveRecruit(m.id), 'Approved', 'A temporary password was emailed to them.'),
            },
        ]);
    };

    const reactivate = () => {
        AppAlert.alert('Reactivate agent?', `${userDisplayName(m)} can sign in and onboard shops again.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reactivate', onPress: () => run(() => merchantsApi.reactivate(m.id), 'Reactivated', 'The agent is active again.') },
        ]);
    };

    const onReasonConfirm = (reason) => {
        const action = reasonAction;
        setReasonAction(null);
        const r = reason || undefined;
        if (action === 'reject') {
            run(() => merchantsApi.rejectRecruit(m.id, r), 'Rejected', 'The recruit was rejected.');
        } else if (action === 'deactivate') {
            run(
                () => merchantsApi.deactivate(m.id, r),
                'Agent deactivated',
                (res) =>
                    res?.handed_to
                        ? `${res.shops_moved ?? 0} shop(s) moved to their manager.`
                        : `${res?.shops_moved ?? 0} shop(s) are now unassigned.`,
            );
        } else if (action === 'cancelCommission' && cancelTarget) {
            run(() => merchantsApi.cancelCommission(cancelTarget.id, r), 'Commission cancelled', 'Any manager override on it was cancelled too.');
        }
        setCancelTarget(null);
    };

    const openManagerPicker = async () => {
        setBusy(true);
        try {
            const res = await merchantsApi.adminList();
            const rows = Array.isArray(res?.merchants) ? res.merchants : [];
            setManagerOptions([
                { value: '', label: 'No manager', hint: 'Reports directly to Shopynn.' },
                ...rows
                    .filter((r) => r.agent_type === 'manager' && r.status === 'active' && r.id !== m.id)
                    .map((r) => ({ value: r.id, label: userDisplayName(r), hint: `${r.team_size ?? 0} agents` })),
            ]);
        } catch (e) {
            AppAlert.alert('Error', apiErrorMessage(e, 'Could not load managers.'));
        } finally {
            setBusy(false);
        }
    };

    const chooseRole = (agentType) => {
        setRolePickerOpen(false);
        if (agentType === m.agent_type) return;
        run(
            () => merchantsApi.updateAdmin(m.id, { agent_type: agentType, manager_id: agentType === 'manager' ? null : m.manager_id ?? null }),
            'Role updated',
            `${userDisplayName(m)} is now a ${agentTypeLabel(agentType).toLowerCase()}.`,
        );
    };

    const chooseManager = (managerId) => {
        setManagerOptions(null);
        if ((managerId || null) === (m.manager_id || null)) return;
        run(
            () => merchantsApi.updateAdmin(m.id, { agent_type: 'agent', manager_id: managerId || null }),
            'Team updated',
            managerId ? 'The agent moved to the new team.' : 'The agent no longer has a manager.',
        );
    };

    const cardStyle = {
        padding: 14,
        marginBottom: 10,
        marginTop: 5,
        borderRadius: 5,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    };

    const headerShadow =
        Platform.OS === 'ios'
            ? {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.06,
                  shadowRadius: 6,
              }
            : { elevation: 2 };

    const canGoBack = typeof navigation.canGoBack === 'function' && navigation.canGoBack();

    const tableWrapStyle = { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' };
    const headRowStyle = {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 8,
        backgroundColor: colors.surfaceSecondary ?? colors.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    };
    const rowStyle = (idx, count) => ({
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 8,
        alignItems: 'center',
        borderBottomWidth: idx < count - 1 ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    });
    const headCell = (label, flex) => (
        <View style={{ flex, paddingRight: 4 }}>
            <AppText label={label} fontSize={11} color={colors.textTertiary} variant={1} />
        </View>
    );

    const renderBusinessesTable = () => {
        if (tenantsList.length === 0) {
            return <AppText label="No businesses yet." fontSize={13} color={colors.textSecondary} style={{ paddingVertical: 16 }} />;
        }
        return (
            <View style={tableWrapStyle}>
                <View style={headRowStyle}>
                    {headCell('Business', 2.2)}
                    {headCell('Plan', 1.4)}
                    {headCell('Amount', 1)}
                    {headCell('Created', 1)}
                </View>
                {tenantsList.map((t, idx) => (
                    <View key={t.id} style={rowStyle(idx, tenantsList.length)}>
                        <View style={{ flex: 2.2, paddingRight: 6 }}>
                            <AppText label={t.name || '—'} fontSize={13} color={colors.text} numberOfLines={2} />
                            <AppText
                                label={[t.organization, formatPhone(t.phone)].filter(Boolean).join(' · ') || '—'}
                                fontSize={10}
                                color={colors.textTertiary}
                                numberOfLines={2}
                                style={{ marginTop: 4 }}
                            />
                            {t.awaiting_first_payment ? (
                                <AppText label="Awaiting first payment" fontSize={10} color="#d97706" style={{ marginTop: 3 }} />
                            ) : null}
                        </View>
                        <View style={{ flex: 1.4, paddingRight: 6 }}>
                            <AppText label={t.subscription_name || '—'} fontSize={12} color={colors.textSecondary} numberOfLines={2} />
                        </View>
                        <View style={{ flex: 1, paddingRight: 6 }}>
                            <AppText label={`GH₵ ${fmtMoney(t.subscription_amount)}`} fontSize={12} color={colors.text} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <AppText label={fmtDate(t.created_at)} fontSize={11} color={colors.textSecondary} />
                        </View>
                    </View>
                ))}
            </View>
        );
    };

    const renderCommissionsTable = () => {
        if (commissionsList.length === 0) {
            return <AppText label="No commission rows yet." fontSize={13} color={colors.textSecondary} style={{ paddingVertical: 16 }} />;
        }
        return (
            <View style={tableWrapStyle}>
                <View style={headRowStyle}>
                    {headCell('Business', 1.9)}
                    {headCell('Comm.', 1.1)}
                    {headCell('Status', 1.1)}
                    {canManageMerchants ? headCell('Action', 0.9) : headCell('Created', 0.9)}
                </View>
                {commissionsList.map((c, idx) => (
                    <View key={c.id} style={rowStyle(idx, commissionsList.length)}>
                        <View style={{ flex: 1.9, paddingRight: 4 }}>
                            <AppText label={c.tenant_name || String(c.tenant_id || '—')} fontSize={12} color={colors.text} numberOfLines={2} />
                            <AppText label={commissionKindLabel(c)} fontSize={10} color={colors.textTertiary} numberOfLines={1} style={{ marginTop: 2 }} />
                            {c.cancel_reason ? (
                                <AppText label={c.cancel_reason} fontSize={10} color="#dc2626" numberOfLines={2} style={{ marginTop: 2 }} />
                            ) : null}
                        </View>
                        <View style={{ flex: 1.1, paddingRight: 4 }}>
                            <AppText label={`GH₵ ${fmtMoney(c.commission_amount)}`} fontSize={11} color={colors.text} />
                            <AppText
                                label={`${fmtMoney(c.commission_percent)}% of ${fmtMoney(c.base_amount)}`}
                                fontSize={9}
                                color={colors.textTertiary}
                                style={{ marginTop: 2 }}
                            />
                        </View>
                        <View style={{ flex: 1.1, paddingRight: 4 }}>
                            <CommissionPill commission={c} />
                        </View>
                        {canManageMerchants ? (
                            <View style={{ flex: 0.9, gap: 8 }}>
                                {c.status === 'pending' ? (
                                    <>
                                        <TouchableOpacity
                                            onPress={() => handleMarkPaid(c.id)}
                                            disabled={busy}
                                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                                        >
                                            <AppText label="Mark paid" color={config.THEME_COLOR} variant={1} fontSize={11} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setCancelTarget(c);
                                                setReasonAction('cancelCommission');
                                            }}
                                            disabled={busy}
                                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                                        >
                                            <AppText label="Cancel" color="#d97706" variant={1} fontSize={11} />
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <AppText label="—" fontSize={11} color={colors.textTertiary} />
                                )}
                            </View>
                        ) : (
                            <View style={{ flex: 0.9 }}>
                                <AppText label={fmtDate(c.created_at)} fontSize={10} color={colors.textTertiary} />
                            </View>
                        )}
                    </View>
                ))}
            </View>
        );
    };

    const renderTeamTable = () => {
        if (teamList.length === 0) {
            return <AppText label="No agents on this team yet." fontSize={13} color={colors.textSecondary} style={{ paddingVertical: 16 }} />;
        }
        return (
            <View style={tableWrapStyle}>
                {teamList.map((a, idx) => (
                    <TouchableOpacity
                        key={a.id}
                        onPress={() => navigation.push('MerchantDetail', { merchantId: a.id })}
                        style={rowStyle(idx, teamList.length)}
                        activeOpacity={0.75}
                    >
                        <View style={{ flex: 1, paddingRight: 8 }}>
                            <AppText label={userDisplayName(a)} fontSize={13} color={colors.text} variant={1} />
                            <AppText
                                label={`${a.serving_count ?? 0} shops · pending GH₵ ${fmtMoney(a.pending_commission_ghs)} · paid GH₵ ${fmtMoney(a.paid_commission_ghs)}`}
                                fontSize={10}
                                color={colors.textTertiary}
                                style={{ marginTop: 3 }}
                            />
                        </View>
                        <StatusPill meta={AGENT_STATUS[a.status]} fallback={a.status} />
                        <Lucide name="chevron-right" size={18} color={colors.textTertiary} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const tabButton = (key, icon, label) => (
        <TouchableOpacity
            key={key}
            onPress={() => setDetailTab(key)}
            activeOpacity={0.75}
            style={{
                flex: 1,
                alignItems: 'center',
                paddingTop: 8,
                paddingBottom: 12,
                borderBottomWidth: 3,
                marginBottom: -StyleSheet.hairlineWidth,
                borderBottomColor: detailTab === key ? config.THEME_COLOR : 'transparent',
            }}
        >
            <Lucide name={icon} size={18} color={detailTab === key ? config.THEME_COLOR : colors.textTertiary} />
            <AppText
                label={label}
                variant={1}
                fontSize={13}
                color={detailTab === key ? colors.text : colors.textSecondary}
                style={{ marginTop: 6 }}
            />
        </TouchableOpacity>
    );

    const actionButton = (icon, label, onPress, color = config.THEME_COLOR) => (
        <TouchableOpacity
            key={label}
            onPress={onPress}
            disabled={busy}
            activeOpacity={0.85}
            style={{
                flexGrow: 1,
                flexBasis: '45%',
                paddingVertical: 12,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: color,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
                opacity: busy ? 0.6 : 1,
            }}
        >
            <Lucide name={icon} size={17} color={color} />
            <AppText label={label} variant={1} fontSize={13} color={color} />
        </TouchableOpacity>
    );

    const renderAdminActions = () => {
        if (!canManageMerchants || !m) return null;
        const buttons = [];
        if (m.status === 'pending_approval') {
            buttons.push(actionButton('user-check', 'Approve', approve, '#16a34a'));
            buttons.push(actionButton('user-x', 'Reject', () => setReasonAction('reject'), '#dc2626'));
        } else if (m.status === 'deactivated') {
            buttons.push(actionButton('rotate-ccw', 'Reactivate', reactivate));
        } else if (m.status !== 'rejected') {
            buttons.push(actionButton('shield-check', 'Change role', () => setRolePickerOpen(true)));
            if (!isManager) buttons.push(actionButton('users', m.manager_id ? 'Change manager' : 'Assign manager', openManagerPicker));
            buttons.push(actionButton('user-x', 'Deactivate', () => setReasonAction('deactivate'), '#dc2626'));
        }
        if (!buttons.length) return null;
        return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>{buttons}</View>;
    };

    if (!merchantId) {
        return null;
    }

    if (loading && !detailData) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader hideBack={!canGoBack} onPress={() => navigation.goBack()} label="Merchant" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={config.THEME_COLOR} size="large" />
                </View>
            </SafeAreaView>
        );
    }

    const managerName = m ? managerDisplayName(m) : '';
    const recruitedBy = m ? [m.recruited_by_first_name, m.recruited_by_last_name].filter(Boolean).join(' ') : '';

    const reasonCopy = {
        reject: {
            title: 'Reject recruit?',
            message: 'They will not get a login. Their manager will see them as Rejected.',
            confirmLabel: 'Reject',
        },
        deactivate: {
            title: `Deactivate ${m ? userDisplayName(m) : 'agent'}?`,
            message: isManager
                ? 'They can no longer sign in. Their agents stay active but no longer have a manager, and their own shops become unassigned. Commission already earned is still paid.'
                : 'They can no longer sign in or onboard shops. Their shops move to their manager, or become unassigned if they have none. Commission already earned is still paid.',
            confirmLabel: 'Deactivate',
        },
        cancelCommission: {
            title: 'Cancel commission?',
            message: `Use this when the payment for ${cancelTarget?.tenant_name || 'this shop'} was refunded. Any manager override on it is cancelled too.`,
            confirmLabel: 'Cancel commission',
        },
    }[reasonAction] ?? { title: '', message: '', confirmLabel: 'Confirm' };

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader hideBack={!canGoBack} onPress={() => navigation.goBack()} label="Merchant" />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 + insets.bottom }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                keyboardShouldPersistTaps="handled"
            >
                {!m ? (
                    <View style={[cardStyle, { alignItems: 'center', paddingVertical: 28 }]}>
                        <Lucide name="alert-circle" size={36} color={colors.textTertiary} />
                        <AppText
                            label="Could not load this merchant."
                            color={colors.textSecondary}
                            style={{ marginTop: 12, textAlign: 'center' }}
                            fontSize={14}
                        />
                    </View>
                ) : (
                    <>
                        <View style={[cardStyle, headerShadow, { borderWidth: 0 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                                <View
                                    style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: 16,
                                        backgroundColor: config.THEME_COLOR + '22',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Lucide name={isManager ? 'users' : 'user'} size={26} color={config.THEME_COLOR} />
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <AppText
                                        label={`${agentTypeLabel(m.agent_type)}${!isManager && managerName ? ` · Team of ${managerName}` : ''}`}
                                        fontSize={11}
                                        color={config.THEME_COLOR}
                                        variant={1}
                                    />
                                    <AppText label={userDisplayName(m)} fontSize={18} color={colors.text} variant={1} style={{ marginTop: 2 }} />
                                    <AppText
                                        label={[formatPhone(m.phone), m.email].filter(Boolean).join(' · ') || '—'}
                                        fontSize={13}
                                        color={colors.textSecondary}
                                        style={{ marginTop: 4 }}
                                    />
                                </View>
                                {m.status ? <StatusPill meta={AGENT_STATUS[m.status]} fallback={m.status} fontSize={11} /> : null}
                            </View>
                            <View
                                style={{
                                    marginTop: 16,
                                    paddingTop: 14,
                                    borderTopWidth: StyleSheet.hairlineWidth,
                                    borderTopColor: colors.border,
                                }}
                            >
                                <AppText
                                    label={`Default commission: ${
                                        m.default_commission_percent != null && m.default_commission_percent !== ''
                                            ? `${fmtMoney(m.default_commission_percent)}%`
                                            : '—'
                                    }`}
                                    fontSize={13}
                                    color={colors.text}
                                />
                                <AppText
                                    label={`Registered ${fmtDate(m.created_at)}${recruitedBy ? ` · Recruited by ${recruitedBy}` : ''}`}
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 6 }}
                                />
                                {m.status_reason ? (
                                    <AppText label={`Reason: ${m.status_reason}`} fontSize={12} color={colors.textTertiary} style={{ marginTop: 4 }} />
                                ) : null}
                            </View>
                        </View>

                        <View style={{ marginTop: 18 }}>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    borderBottomWidth: StyleSheet.hairlineWidth,
                                    borderBottomColor: colors.border,
                                }}
                            >
                                {tabButton('businesses', 'building-2', `Businesses (${tenantsList.length})`)}
                                {tabButton('commissions', 'coins', `Commissions (${commissionsList.length})`)}
                                {isManager ? tabButton('team', 'users', `Team (${teamList.length})`) : null}
                            </View>
                            <View style={{ marginTop: 14 }}>
                                {detailTab === 'commissions'
                                    ? renderCommissionsTable()
                                    : detailTab === 'team' && isManager
                                      ? renderTeamTable()
                                      : renderBusinessesTable()}
                            </View>
                        </View>

                        {renderAdminActions()}
                    </>
                )}
            </ScrollView>

            <ReasonModal
                visible={reasonAction != null}
                title={reasonCopy.title}
                message={reasonCopy.message}
                confirmLabel={reasonCopy.confirmLabel}
                destructive
                onCancel={() => {
                    setReasonAction(null);
                    setCancelTarget(null);
                }}
                onConfirm={onReasonConfirm}
            />

            <PickerModal
                visible={rolePickerOpen}
                title="Change role"
                message={isManager ? "Move this manager's team to another manager before making them a field agent." : undefined}
                options={ROLE_OPTIONS}
                selected={m?.agent_type ?? 'agent'}
                onSelect={chooseRole}
                onClose={() => setRolePickerOpen(false)}
            />

            <PickerModal
                visible={managerOptions != null}
                title="Assign manager"
                message="The manager earns a 20% override on this agent's commission from now on."
                options={managerOptions ?? []}
                selected={m?.manager_id ?? ''}
                onSelect={chooseManager}
                onClose={() => setManagerOptions(null)}
            />
        </SafeAreaView>
    );
};

export default MerchantDetail;
