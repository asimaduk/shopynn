import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    StyleSheet,
    Platform,
    TextInput,
    Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { tenants as tenantsApi } from '../../services/api';
import { formatCurrency } from '../../utils/format';

function fmtDate(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (_) {
        return '—';
    }
}

function fmtDateTime(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString('en-GH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch (_) {
        return '—';
    }
}

function subscriptionStatusStyle(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('active') && !s.includes('inact')) return { bg: '#dcfce7', color: '#16a34a', label: 'Active' };
    if (s.includes('expir')) return { bg: '#fee2e2', color: '#dc2626', label: 'Expired' };
    if (s.includes('pending')) return { bg: '#fef3c7', color: '#d97706', label: 'Pending' };
    const label = String(status || '—')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    return { bg: '#f3f4f6', color: '#6b7280', label: label || '—' };
}

function paymentStatusStyle(status) {
    const s = String(status || '').toLowerCase();
    if (['paid', 'success', 'completed'].includes(s)) return { bg: '#dcfce7', color: '#16a34a' };
    if (['failed', 'cancelled', 'reversed', 'declined'].includes(s)) return { bg: '#fee2e2', color: '#dc2626' };
    if (s === 'pending') return { bg: '#fef3c7', color: '#d97706' };
    return { bg: '#f3f4f6', color: '#6b7280' };
}

function paymentMethodMeta(raw) {
    const v = String(raw || '').toLowerCase();
    if (v.includes('mobile') || v.includes('momo')) return { label: 'Mobile money', icon: 'smartphone' };
    if (v.includes('cash')) return { label: 'Cash', icon: 'banknote' };
    return { label: 'Card', icon: 'credit-card' };
}

function InfoRow({ icon, label, value, colors, last }) {
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingVertical: 10,
                borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
            }}>
            <Lucide name={icon} size={16} color={colors.textTertiary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
                <AppText label={label} fontSize={11} color={colors.textTertiary} />
                <AppText label={value || '—'} fontSize={14} color={colors.text} style={{ marginTop: 2 }} numberOfLines={3} />
            </View>
        </View>
    );
}

function StatChip({ icon, label, value, tint, colors }) {
    return (
        <View
            style={{
                flex: 1,
                minWidth: 0,
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <Lucide name={icon} size={16} color={tint} />
                <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText
                        label={label}
                        fontSize={11}
                        color={colors.textTertiary}
                        numberOfLines={1}
                        style={{ flexShrink: 1 }}
                    />
                </View>
            </View>
            <AppText
                label={String(value)}
                variant={1}
                fontSize={18}
                color={colors.text}
                numberOfLines={1}
                style={{ marginTop: 6 }}
            />
        </View>
    );
}

const TenantDirectoryDetail = ({ navigation, route }) => {
    const tenantId = route?.params?.tenantId;
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [detail, setDetail] = useState(null);
    const [settlementSummary, setSettlementSummary] = useState(null);
    const [settlements, setSettlements] = useState([]);
    const [settlementAmount, setSettlementAmount] = useState('');
    const [settlementNote, setSettlementNote] = useState('');
    const [settlementBusy, setSettlementBusy] = useState(false);
    const [payoutRefs, setPayoutRefs] = useState({});
    const [rejectReasons, setRejectReasons] = useState({});

    const loadSettlements = useCallback(async () => {
        if (!tenantId) return;
        try {
            const [summaryData, listData] = await Promise.all([
                tenantsApi.adminSettlementSummary(tenantId),
                tenantsApi.adminSettlements(tenantId),
            ]);
            setSettlementSummary(summaryData || null);
            setSettlements(Array.isArray(listData) ? listData : []);
        } catch (_) {
            setSettlementSummary(null);
            setSettlements([]);
        }
    }, [tenantId]);

    const load = useCallback(async () => {
        if (!tenantId) return;
        try {
            const data = await tenantsApi.directoryDetail(tenantId);
            setDetail(data || null);
            await loadSettlements();
        } catch (_) {
            setDetail(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [tenantId, loadSettlements]);

    useFocusEffect(
        useCallback(() => {
            if (!tenantId) {
                navigation.goBack();
                return undefined;
            }
            setLoading(true);
            load();
            return undefined;
        }, [tenantId, load, navigation]),
    );

    const onRefresh = () => {
        setRefreshing(true);
        load();
    };

    const onCreateSettlement = () => {
        const parsed = Number(settlementAmount);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            Alert.alert('Invalid amount', 'Enter a valid payout amount.');
            return;
        }
        Alert.alert('Create settlement', `Reserve ${formatCurrency(parsed)} for payout?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Create',
                onPress: async () => {
                    setSettlementBusy(true);
                    try {
                        await tenantsApi.createAdminSettlement(tenantId, {
                            amount: parsed,
                            note: settlementNote.trim() || undefined,
                        });
                        setSettlementAmount('');
                        setSettlementNote('');
                        await loadSettlements();
                    } catch (error) {
                        Alert.alert(
                            'Could not create settlement',
                            error?.response?.data?.message || error?.response?.data?.error || 'Try again.',
                        );
                    } finally {
                        setSettlementBusy(false);
                    }
                },
            },
        ]);
    };

    const onMarkSettlementPaid = (row) => {
        Alert.alert('Mark paid', `Mark ${formatCurrency(row.amount)} as paid out?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Mark paid',
                onPress: async () => {
                    setSettlementBusy(true);
                    try {
                        await tenantsApi.markAdminSettlementPaid(row.id, {
                            payout_reference: payoutRefs[row.id]?.trim() || undefined,
                        });
                        await loadSettlements();
                    } catch (error) {
                        Alert.alert(
                            'Could not mark paid',
                            error?.response?.data?.message || error?.response?.data?.error || 'Try again.',
                        );
                    } finally {
                        setSettlementBusy(false);
                    }
                },
            },
        ]);
    };

    const onApproveSettlement = async (row) => {
        setSettlementBusy(true);
        try {
            await tenantsApi.approveAdminSettlement(row.id);
            await loadSettlements();
        } catch (error) {
            Alert.alert('Could not approve', error?.response?.data?.message || error?.response?.data?.error || 'Try again.');
        } finally {
            setSettlementBusy(false);
        }
    };

    const onRejectSettlement = (row) => {
        Alert.alert('Reject withdrawal', 'Reject this merchant withdrawal request?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Reject',
                style: 'destructive',
                onPress: async () => {
                    setSettlementBusy(true);
                    try {
                        await tenantsApi.rejectAdminSettlement(row.id, {
                            reason: rejectReasons[row.id]?.trim() || undefined,
                        });
                        await loadSettlements();
                    } catch (error) {
                        Alert.alert(
                            'Could not reject',
                            error?.response?.data?.message || error?.response?.data?.error || 'Try again.',
                        );
                    } finally {
                        setSettlementBusy(false);
                    }
                },
            },
        ]);
    };

    const formatPayoutSnapshot = (snapshot) => {
        if (!snapshot) return null;
        const method = String(snapshot.payout_method || '').toLowerCase();
        if (method === 'momo') {
            return `${String(snapshot.momo_network || '').toUpperCase()} MoMo · ${snapshot.momo_number || '—'}`;
        }
        if (method === 'bank') {
            return `${snapshot.bank_name || 'Bank'} · ${snapshot.bank_account_number || '—'}`;
        }
        return null;
    };

    const settlementStatusMeta = (status) => {
        const s = String(status || '').toLowerCase();
        if (s === 'paid') return { label: 'Paid', bg: '#dcfce7', color: '#16a34a' };
        if (s === 'pending') return { label: 'Processing', bg: '#fef3c7', color: '#d97706' };
        if (s === 'requested') return { label: 'Requested', bg: '#e0e7ff', color: '#4338ca' };
        if (s === 'rejected') return { label: 'Rejected', bg: '#fee2e2', color: '#dc2626' };
        return { label: status || '—', bg: '#f3f4f6', color: '#6b7280' };
    };

    const tenant = detail?.tenant;
    const subscription = detail?.subscription;
    const payments = useMemo(() => (Array.isArray(detail?.recentPayments) ? detail.recentPayments : []), [detail]);

    const subBadge = subscriptionStatusStyle(subscription?.status);
    const totalPaid = useMemo(
        () =>
            payments
                .filter((p) => ['paid', 'success', 'completed'].includes(String(p?.status || '').toLowerCase()))
                .reduce((sum, p) => sum + Number(p?.amount || 0), 0),
        [payments],
    );

    const cardStyle = {
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 12,
        overflow: 'hidden',
    };

    const headerShadow =
        Platform.OS === 'ios'
            ? {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
              }
            : { elevation: 2 };

    if (!tenantId) return null;

    if (loading && !detail) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={() => navigation.goBack()} label="Tenant" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={config.THEME_COLOR} size="large" />
                    <AppText label="Loading tenant..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Tenant detail" />
            <ScrollView
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 + insets.bottom }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[config.THEME_COLOR]} tintColor={config.THEME_COLOR} />
                }
                keyboardShouldPersistTaps="handled">
                {!tenant ? (
                    <View style={[cardStyle, { padding: 28, alignItems: 'center' }]}>
                        <Lucide name="alert-circle" size={40} color={colors.textTertiary} />
                        <AppText
                            label="Could not load this tenant."
                            color={colors.textSecondary}
                            fontSize={14}
                            style={{ marginTop: 12, textAlign: 'center' }}
                        />
                    </View>
                ) : (
                    <>
                        <View style={[cardStyle, headerShadow, { padding: 16, borderWidth: 0 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                                <View
                                    style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: 16,
                                        backgroundColor: '#6366f118',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                    <Lucide name="building-2" size={28} color="#6366f1" />
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <AppText label={tenant.name || '—'} fontSize={20} color={colors.text} variant={1} />
                                    {tenant.organization ? (
                                        <AppText
                                            label={tenant.organization}
                                            fontSize={14}
                                            color={colors.textSecondary}
                                            style={{ marginTop: 4 }}
                                        />
                                    ) : null}
                                    {tenant.industry_name ? (
                                        <View
                                            style={{
                                                alignSelf: 'flex-start',
                                                marginTop: 8,
                                                paddingHorizontal: 10,
                                                paddingVertical: 4,
                                                borderRadius: 8,
                                                backgroundColor: colors.primaryShade,
                                            }}>
                                            <AppText label={tenant.industry_name} fontSize={11} color={config.THEME_COLOR} />
                                        </View>
                                    ) : null}
                                </View>
                            </View>
                            <AppText
                                label={`Onboarded ${fmtDate(tenant.created_at)}`}
                                fontSize={12}
                                color={colors.textTertiary}
                                style={{ marginTop: 14 }}
                            />
                        </View>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                            <StatChip icon="users" label="Users" value={tenant.user_count ?? 0} tint="#8b5cf6" colors={colors} />
                            <StatChip icon="store" label="Stores" value={tenant.warehouse_count ?? 0} tint="#f59e0b" colors={colors} />
                            <StatChip
                                icon="receipt"
                                label="Recent payments"
                                value={payments.length}
                                tint="#0ea5e9"
                                colors={colors}
                            />
                        </View>

                        <View style={[cardStyle, { paddingHorizontal: 14 }]}>
                            <AppText label="Contact" variant={1} fontSize={15} color={colors.text} style={{ paddingTop: 14, paddingBottom: 4 }} />
                            <InfoRow icon="mail" label="Email" value={tenant.email} colors={colors} />
                            <InfoRow icon="phone" label="Phone" value={tenant.phone} colors={colors} />
                            {tenant.address ? (
                                <InfoRow icon="map-pin" label="Address" value={tenant.address} colors={colors} last />
                            ) : (
                                <InfoRow icon="map-pin" label="Address" value={null} colors={colors} last />
                            )}
                        </View>

                        <View style={[cardStyle, { padding: 14 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Lucide name="layers" size={18} color={config.THEME_COLOR} />
                                    <AppText label="Subscription" variant={1} fontSize={15} color={colors.text} />
                                </View>
                                {subscription ? (
                                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: subBadge.bg }}>
                                        <AppText label={subBadge.label} fontSize={11} color={subBadge.color} fontFamily="FiraSans-SemiBold" />
                                    </View>
                                ) : null}
                            </View>
                            {subscription ? (
                                <>
                                    <AppText label={subscription.name || '—'} fontSize={17} color={colors.text} variant={1} />
                                    <AppText
                                        label={formatCurrency(subscription.amount)}
                                        fontSize={22}
                                        color={config.THEME_COLOR}
                                        variant={1}
                                        style={{ marginTop: 8 }}
                                    />
                                    {subscription.billing_interval ? (
                                        <AppText
                                            label={`Billing: ${subscription.billing_interval}`}
                                            fontSize={12}
                                            color={colors.textSecondary}
                                            style={{ marginTop: 4 }}
                                        />
                                    ) : null}
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            marginTop: 12,
                                            paddingTop: 12,
                                            borderTopWidth: StyleSheet.hairlineWidth,
                                            borderTopColor: colors.border,
                                        }}>
                                        <Lucide name="calendar" size={14} color={colors.textTertiary} />
                                        <AppText
                                            label={`${fmtDate(subscription.start_at)} → ${fmtDate(subscription.end_at)}`}
                                            fontSize={12}
                                            color={colors.textSecondary}
                                            style={{ marginLeft: 8, flex: 1 }}
                                        />
                                    </View>
                                </>
                            ) : (
                                <AppText label="No subscription linked to this tenant." fontSize={13} color={colors.textSecondary} />
                            )}
                        </View>

                        <View style={[cardStyle, { padding: 14 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <Lucide name="landmark" size={18} color={config.THEME_COLOR} />
                                <AppText label="Order settlements" variant={1} fontSize={15} color={colors.text} />
                            </View>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                <StatChip
                                    icon="wallet"
                                    label="Digital"
                                    value={formatCurrency(settlementSummary?.digital_collected)}
                                    tint={config.THEME_COLOR}
                                    colors={colors}
                                />
                                <StatChip
                                    icon="circle-check"
                                    label="Paid out"
                                    value={formatCurrency(settlementSummary?.settled_paid)}
                                    tint="#16a34a"
                                    colors={colors}
                                />
                                <StatChip
                                    icon="clock"
                                    label="Pending"
                                    value={formatCurrency(settlementSummary?.pending_settlements)}
                                    tint="#d97706"
                                    colors={colors}
                                />
                                <StatChip
                                    icon="landmark"
                                    label="Available"
                                    value={formatCurrency(settlementSummary?.available_balance)}
                                    tint="#2563eb"
                                    colors={colors}
                                />
                            </View>
                            <TextInput
                                value={settlementAmount}
                                onChangeText={setSettlementAmount}
                                placeholder="Payout amount (GHS)"
                                placeholderTextColor={colors.textTertiary}
                                keyboardType="decimal-pad"
                                style={{
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    borderRadius: 10,
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                    color: colors.text,
                                    marginBottom: 8,
                                }}
                            />
                            <TextInput
                                value={settlementNote}
                                onChangeText={setSettlementNote}
                                placeholder="Note (optional)"
                                placeholderTextColor={colors.textTertiary}
                                style={{
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    borderRadius: 10,
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                    color: colors.text,
                                    marginBottom: 10,
                                }}
                            />
                            <TouchableOpacity
                                activeOpacity={0.7}
                                disabled={settlementBusy}
                                onPress={onCreateSettlement}
                                style={{
                                    backgroundColor: config.THEME_COLOR,
                                    borderRadius: 10,
                                    paddingVertical: 12,
                                    alignItems: 'center',
                                    opacity: settlementBusy ? 0.6 : 1,
                                }}>
                                <AppText label="Create settlement" color="#fff" fontFamily="FiraSans-SemiBold" />
                            </TouchableOpacity>
                            {settlements.length === 0 ? (
                                <AppText label="No settlements yet." fontSize={13} color={colors.textTertiary} style={{ marginTop: 14 }} />
                            ) : (
                                settlements.map((row, idx) => {
                                    const status = String(row.status || '').toLowerCase();
                                    const badge = settlementStatusMeta(status);
                                    const snapshotLabel = formatPayoutSnapshot(row.payout_snapshot);
                                    return (
                                        <View
                                            key={row.id}
                                            style={{
                                                marginTop: 12,
                                                paddingTop: 12,
                                                borderTopWidth: idx === 0 ? StyleSheet.hairlineWidth : 0,
                                                borderTopColor: colors.border,
                                                borderBottomWidth: idx < settlements.length - 1 ? StyleSheet.hairlineWidth : 0,
                                                borderBottomColor: colors.border,
                                                paddingBottom: idx < settlements.length - 1 ? 12 : 0,
                                            }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <View style={{ flex: 1, minWidth: 0 }}>
                                                    <AppText label={formatCurrency(row.amount)} variant={1} fontSize={15} color={colors.text} />
                                                    <AppText label={fmtDateTime(row.created_at)} fontSize={11} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                                    {row.source === 'merchant' ? (
                                                        <AppText label="Merchant request" fontSize={11} color={colors.textSecondary} style={{ marginTop: 2 }} />
                                                    ) : null}
                                                    {snapshotLabel ? (
                                                        <AppText label={`Pay to: ${snapshotLabel}`} fontSize={11} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                                    ) : null}
                                                    {row.rejection_reason ? (
                                                        <AppText label={`Rejected: ${row.rejection_reason}`} fontSize={11} color="#dc2626" style={{ marginTop: 2 }} />
                                                    ) : null}
                                                </View>
                                                <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: badge.bg }}>
                                                    <AppText label={badge.label} fontSize={10} color={badge.color} fontFamily="FiraSans-SemiBold" />
                                                </View>
                                            </View>
                                            {status === 'requested' ? (
                                                <View style={{ marginTop: 8, gap: 8 }}>
                                                    <TextInput
                                                        value={rejectReasons[row.id] || ''}
                                                        onChangeText={(v) => setRejectReasons((prev) => ({ ...prev, [row.id]: v }))}
                                                        placeholder="Rejection reason"
                                                        placeholderTextColor={colors.textTertiary}
                                                        style={{
                                                            borderWidth: 1,
                                                            borderColor: colors.border,
                                                            borderRadius: 8,
                                                            paddingHorizontal: 10,
                                                            paddingVertical: 8,
                                                            color: colors.text,
                                                        }}
                                                    />
                                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                                        <TouchableOpacity
                                                            activeOpacity={0.7}
                                                            disabled={settlementBusy}
                                                            onPress={() => onApproveSettlement(row)}
                                                            style={{
                                                                borderRadius: 8,
                                                                paddingHorizontal: 12,
                                                                paddingVertical: 8,
                                                                backgroundColor: config.THEME_COLOR,
                                                            }}>
                                                            <AppText label="Approve" fontSize={12} color="#fff" />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            activeOpacity={0.7}
                                                            disabled={settlementBusy}
                                                            onPress={() => onRejectSettlement(row)}
                                                            style={{
                                                                borderWidth: 1,
                                                                borderColor: colors.border,
                                                                borderRadius: 8,
                                                                paddingHorizontal: 12,
                                                                paddingVertical: 8,
                                                            }}>
                                                            <AppText label="Reject" fontSize={12} color={colors.text} />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ) : null}
                                            {status === 'pending' ? (
                                                <View style={{ marginTop: 8, gap: 8 }}>
                                                    <TextInput
                                                        value={payoutRefs[row.id] || ''}
                                                        onChangeText={(v) => setPayoutRefs((prev) => ({ ...prev, [row.id]: v }))}
                                                        placeholder="Payout reference"
                                                        placeholderTextColor={colors.textTertiary}
                                                        style={{
                                                            borderWidth: 1,
                                                            borderColor: colors.border,
                                                            borderRadius: 8,
                                                            paddingHorizontal: 10,
                                                            paddingVertical: 8,
                                                            color: colors.text,
                                                        }}
                                                    />
                                                    <TouchableOpacity
                                                        activeOpacity={0.7}
                                                        disabled={settlementBusy}
                                                        onPress={() => onMarkSettlementPaid(row)}
                                                        style={{
                                                            alignSelf: 'flex-start',
                                                            borderWidth: 1,
                                                            borderColor: colors.border,
                                                            borderRadius: 8,
                                                            paddingHorizontal: 12,
                                                            paddingVertical: 8,
                                                        }}>
                                                        <AppText label="Mark paid" fontSize={12} color={colors.text} />
                                                    </TouchableOpacity>
                                                </View>
                                            ) : status === 'paid' && row.payout_reference ? (
                                                <AppText label={`Ref: ${row.payout_reference}`} fontSize={11} color={colors.textTertiary} style={{ marginTop: 4 }} />
                                            ) : null}
                                        </View>
                                    );
                                })
                            )}
                        </View>

                        <View style={[cardStyle, { padding: 14 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Lucide name="banknote" size={18} color={config.THEME_COLOR} />
                                    <AppText label="Recent payments" variant={1} fontSize={15} color={colors.text} />
                                </View>
                                <AppText label={`${payments.length}`} fontSize={12} color={colors.textTertiary} />
                            </View>
                            {payments.length > 0 ? (
                                <AppText
                                    label={`Successful total (shown): ${formatCurrency(totalPaid)}`}
                                    fontSize={12}
                                    color={colors.textSecondary}
                                    style={{ marginBottom: 10 }}
                                />
                            ) : null}
                            {payments.length === 0 ? (
                                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                                    <Lucide name="receipt" size={32} color={colors.border} />
                                    <AppText label="No payment records yet" fontSize={13} color={colors.textTertiary} style={{ marginTop: 8 }} />
                                </View>
                            ) : (
                                payments.map((p, idx) => {
                                    const method = paymentMethodMeta(p.payment_method_type);
                                    const payBadge = paymentStatusStyle(p.status);
                                    return (
                                        <View
                                            key={p.id}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                paddingVertical: 12,
                                                borderBottomWidth: idx < payments.length - 1 ? StyleSheet.hairlineWidth : 0,
                                                borderBottomColor: colors.border,
                                            }}>
                                            <View
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 10,
                                                    backgroundColor: colors.primaryShade,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginRight: 10,
                                                }}>
                                                <Lucide name={method.icon} size={18} color={config.THEME_COLOR} />
                                            </View>
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                                <AppText label={formatCurrency(p.amount)} variant={1} fontSize={15} color={colors.text} />
                                                <AppText label={method.label} fontSize={12} color={colors.textSecondary} style={{ marginTop: 2 }} />
                                                <AppText
                                                    label={p.transaction_ref || 'No reference'}
                                                    fontSize={11}
                                                    color={colors.textTertiary}
                                                    numberOfLines={1}
                                                    style={{ marginTop: 2 }}
                                                />
                                                <AppText label={fmtDateTime(p.created_at)} fontSize={11} color={colors.textTertiary} style={{ marginTop: 2 }} />
                                            </View>
                                            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: payBadge.bg }}>
                                                <AppText
                                                    label={String(p.status || '—').toUpperCase()}
                                                    fontSize={10}
                                                    color={payBadge.color}
                                                    fontFamily="FiraSans-SemiBold"
                                                />
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default TenantDirectoryDetail;
