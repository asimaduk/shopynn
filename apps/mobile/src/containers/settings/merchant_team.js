import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    TextInput,
    StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import AppModal from '../../components/app_modal';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { merchants as merchantsApi } from '../../services/api';
import AppAlert from '../../utils/appAlert';
import { formatPhone } from '../../utils/format';
import {
    AGENT_STATUS,
    PickerModal,
    ReasonModal,
    StatusPill,
    apiErrorMessage,
    fmtMoney,
    userDisplayName,
} from './merchant_shared';

const EMPTY_RECRUIT = { first_name: '', last_name: '', email: '', phone: '' };

/** Agent manager: team members (recruit / deactivate) and the shops the team looks after (reassign). */
const MerchantTeam = ({ navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const user = useSelector(({ user: u }) => u);
    const canGoBack = typeof navigation.canGoBack === 'function' && navigation.canGoBack();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [me, setMe] = useState(null);
    const [members, setMembers] = useState([]);
    const [shops, setShops] = useState([]);
    const [tab, setTab] = useState('agents');

    const [recruitOpen, setRecruitOpen] = useState(false);
    const [recruit, setRecruit] = useState(EMPTY_RECRUIT);
    const [recruiting, setRecruiting] = useState(false);
    const [deactivateTarget, setDeactivateTarget] = useState(null);
    const [deactivating, setDeactivating] = useState(false);
    const [reassignShop, setReassignShop] = useState(null);

    const load = useCallback(async () => {
        try {
            const [meRes, teamRes, shopsRes] = await Promise.all([
                merchantsApi.me(),
                merchantsApi.team(),
                merchantsApi.teamTenants(),
            ]);
            setMe(meRes?.merchant ?? null);
            setMembers(Array.isArray(teamRes?.members) ? teamRes.members : []);
            setShops(Array.isArray(shopsRes?.tenants) ? shopsRes.tenants : []);
        } catch (e) {
            AppAlert.alert('My team', apiErrorMessage(e, 'Could not load your team.'));
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

    const myName = userDisplayName(user);
    const assignable = useMemo(
        () => [
            ...(me?.id ? [{ value: me.id, label: `${myName} (you)` }] : []),
            ...members.filter((m) => m.status === 'active').map((m) => ({ value: m.id, label: userDisplayName(m) })),
        ],
        [me?.id, myName, members],
    );

    const submitRecruit = async () => {
        const body = {
            first_name: recruit.first_name.trim(),
            last_name: recruit.last_name.trim(),
            email: recruit.email.trim(),
            phone: recruit.phone.trim(),
        };
        if (!body.first_name || !body.last_name || !body.email || !body.phone) {
            AppAlert.alert('Recruit agent', 'First name, last name, email and phone are all required.');
            return;
        }
        setRecruiting(true);
        try {
            await merchantsApi.recruit(body);
            setRecruitOpen(false);
            setRecruit(EMPTY_RECRUIT);
            AppAlert.alert('Recruit submitted', 'Shopynn will review this agent and email their login once approved.');
            load();
        } catch (e) {
            AppAlert.alert('Recruit agent', apiErrorMessage(e, 'Could not submit recruit.'));
        } finally {
            setRecruiting(false);
        }
    };

    const confirmDeactivate = async (reason) => {
        if (!deactivateTarget) return;
        setDeactivating(true);
        try {
            const res = await merchantsApi.deactivateTeamAgent(deactivateTarget.id, reason || undefined);
            setDeactivateTarget(null);
            AppAlert.alert('Agent deactivated', `${res?.shops_moved ?? 0} shop(s) moved to you.`);
            load();
        } catch (e) {
            AppAlert.alert('Deactivate agent', apiErrorMessage(e, 'Could not deactivate agent.'));
        } finally {
            setDeactivating(false);
        }
    };

    const doReassign = async (merchantId) => {
        const shop = reassignShop;
        if (!shop || !merchantId || merchantId === shop.agent_merchant_id) {
            setReassignShop(null);
            return;
        }
        setReassignShop(null);
        try {
            await merchantsApi.reassignTeamTenant(shop.id, merchantId);
            AppAlert.alert('Shop reassigned', `${shop.name || 'The shop'} now has a new agent.`);
            load();
        } catch (e) {
            AppAlert.alert('Reassign shop', apiErrorMessage(e, 'Could not reassign shop.'));
        }
    };

    const card = {
        padding: 14,
        marginBottom: 10,
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

    const tabButton = (key, icon, label, count) => {
        const active = tab === key;
        return (
            <TouchableOpacity
                onPress={() => setTab(key)}
                activeOpacity={0.75}
                style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingTop: 6,
                    paddingBottom: 12,
                    borderBottomWidth: 3,
                    marginBottom: -StyleSheet.hairlineWidth,
                    borderBottomColor: active ? config.THEME_COLOR : 'transparent',
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Lucide name={icon} size={18} color={active ? config.THEME_COLOR : colors.textTertiary} />
                    <AppText label={`${label} (${count})`} variant={1} fontSize={14} color={active ? colors.text : colors.textSecondary} />
                </View>
            </TouchableOpacity>
        );
    };

    const empty = (icon, text) => (
        <View
            style={{
                padding: 28,
                borderRadius: 14,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: colors.border,
                alignItems: 'center',
            }}
        >
            <Lucide name={icon} size={32} color={colors.textTertiary} />
            <AppText label={text} style={{ marginTop: 10, textAlign: 'center' }} color={colors.textSecondary} fontSize={14} />
        </View>
    );

    const renderMembers = () =>
        members.length === 0
            ? empty('users', 'No agents on your team yet. Recruit your first agent to get started.')
            : members.map((m) => (
                  <View key={m.id} style={card}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                              <AppText label={userDisplayName(m)} variant={1} fontSize={15} color={colors.text} />
                              <AppText
                                  label={[m.email, formatPhone(m.phone)].filter(Boolean).join(' · ') || '—'}
                                  fontSize={12}
                                  color={colors.textTertiary}
                                  style={{ marginTop: 3 }}
                              />
                          </View>
                          <StatusPill meta={AGENT_STATUS[m.status]} fallback={m.status} />
                      </View>
                      <AppText
                          label={`${m.serving_count ?? 0} ${Number(m.serving_count) === 1 ? 'shop' : 'shops'} · ${m.awaiting_payment_count ?? 0} awaiting payment`}
                          fontSize={12}
                          color={colors.textSecondary}
                          style={{ marginTop: 8 }}
                      />
                      <AppText
                          label={`Commission pending GH₵ ${fmtMoney(m.pending_commission_ghs)} · paid GH₵ ${fmtMoney(m.paid_commission_ghs)}`}
                          fontSize={12}
                          color={colors.textSecondary}
                          style={{ marginTop: 3 }}
                      />
                      {m.status === 'active' ? (
                          <TouchableOpacity
                              onPress={() => setDeactivateTarget(m)}
                              style={{ marginTop: 10, alignSelf: 'flex-start' }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                              <AppText label="Deactivate" variant={1} fontSize={13} color="#d97706" />
                          </TouchableOpacity>
                      ) : null}
                  </View>
              ));

    const renderShops = () =>
        shops.length === 0
            ? empty('store', 'Your team has no shops yet.')
            : shops.map((t) => {
                  const agentName =
                      t.agent_merchant_id === me?.id
                          ? 'You'
                          : [t.agent_first_name, t.agent_last_name].filter(Boolean).join(' ') || '—';
                  return (
                      <View key={t.id} style={card}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                  <AppText label={t.name || '—'} variant={1} fontSize={15} color={colors.text} />
                                  <AppText
                                      label={[formatPhone(t.phone), t.subscription_name].filter(Boolean).join(' · ') || '—'}
                                      fontSize={12}
                                      color={colors.textTertiary}
                                      style={{ marginTop: 3 }}
                                  />
                              </View>
                              {t.awaiting_first_payment ? (
                                  <StatusPill meta={{ label: 'Awaiting payment', tone: 'warning' }} />
                              ) : null}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                              <AppText label={`Agent: ${agentName}`} fontSize={12} color={colors.textSecondary} />
                              <TouchableOpacity
                                  onPress={() => setReassignShop(t)}
                                  style={{
                                      borderWidth: 1,
                                      borderColor: config.THEME_COLOR,
                                      paddingVertical: 5,
                                      paddingHorizontal: 10,
                                      borderRadius: 6,
                                  }}
                              >
                                  <AppText label="Reassign" fontSize={12} color={config.THEME_COLOR} />
                              </TouchableOpacity>
                          </View>
                      </View>
                  );
              });

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader hideBack={!canGoBack} onPress={() => navigation.goBack()} label="My team" />
            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={config.THEME_COLOR} size="large" />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={{ padding: 12, paddingBottom: 28 + insets.bottom }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                load();
                            }}
                        />
                    }
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, paddingHorizontal: 4 }}>
                        <AppText
                            label="You earn a 20% override on your agents' commission. New recruits need Shopynn approval before they can sign in."
                            fontSize={12}
                            color={colors.textSecondary}
                            style={{ flex: 1 }}
                        />
                        <TouchableOpacity
                            onPress={() => setRecruitOpen(true)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                backgroundColor: config.THEME_COLOR,
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 999,
                            }}
                        >
                            <Lucide name="user-plus" size={16} color="#fff" />
                            <AppText label="Recruit" fontSize={13} color="#fff" variant={1} />
                        </TouchableOpacity>
                    </View>
                    <View
                        style={{
                            flexDirection: 'row',
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: colors.border,
                            marginBottom: 14,
                            marginHorizontal: 4,
                        }}
                    >
                        {tabButton('agents', 'users', 'Agents', members.length)}
                        {tabButton('shops', 'store', 'Shops', shops.length)}
                    </View>
                    {tab === 'agents' ? renderMembers() : renderShops()}
                </ScrollView>
            )}

            <AppModal
                visible={recruitOpen}
                title="Recruit field agent"
                handleClose={recruiting ? undefined : () => setRecruitOpen(false)}
                onRequestClose={recruiting ? undefined : () => setRecruitOpen(false)}
            >
                <View style={{ padding: 16 }}>
                    <AppText
                        label="Shopynn reviews every recruit. Once approved they get a login by email and join your team."
                        fontSize={12}
                        color={colors.textSecondary}
                    />
                    {[
                        ['first_name', 'First name', 'default'],
                        ['last_name', 'Last name', 'default'],
                        ['email', 'Email', 'email-address'],
                        ['phone', 'Phone', 'phone-pad'],
                    ].map(([key, placeholder, keyboardType]) => (
                        <TextInput
                            key={key}
                            value={recruit[key]}
                            onChangeText={(v) => setRecruit((r) => ({ ...r, [key]: v }))}
                            placeholder={placeholder}
                            placeholderTextColor={colors.placeholder}
                            keyboardType={keyboardType}
                            autoCapitalize={key === 'email' ? 'none' : 'words'}
                            style={input}
                        />
                    ))}
                    <TouchableOpacity
                        onPress={submitRecruit}
                        disabled={recruiting}
                        style={{
                            marginTop: 14,
                            backgroundColor: config.THEME_COLOR,
                            padding: 14,
                            borderRadius: 999,
                            alignItems: 'center',
                            opacity: recruiting ? 0.65 : 1,
                        }}
                    >
                        {recruiting ? <ActivityIndicator color="#fff" /> : <AppText label="Submit for approval" color="#fff" variant={1} />}
                    </TouchableOpacity>
                </View>
            </AppModal>

            <ReasonModal
                visible={deactivateTarget != null}
                title={`Deactivate ${deactivateTarget ? userDisplayName(deactivateTarget) : 'agent'}?`}
                message="They can no longer sign in or onboard shops. Their shops move to you, and their commission already earned is still paid."
                confirmLabel="Deactivate"
                destructive
                busy={deactivating}
                onCancel={() => setDeactivateTarget(null)}
                onConfirm={confirmDeactivate}
            />

            <PickerModal
                visible={reassignShop != null}
                title={`Reassign ${reassignShop?.name || 'shop'}`}
                message={
                    reassignShop?.awaiting_first_payment
                        ? 'This shop has not paid yet. Whoever you choose is credited when it pays.'
                        : 'Future renewal commission for this shop goes to the agent you choose.'
                }
                options={assignable}
                selected={reassignShop?.agent_merchant_id}
                onSelect={doReassign}
                onClose={() => setReassignShop(null)}
            />
        </SafeAreaView>
    );
};

export default MerchantTeam;
