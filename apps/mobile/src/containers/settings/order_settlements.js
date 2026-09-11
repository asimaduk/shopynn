import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import useTheme from '../../hooks/useTheme';
import config from '../../config';
import styles from './styles';
import { tenants } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { getMomoNetworkIcon } from '../../utils/momoNetworks';

const formatAmount = (amount) => formatCurrency(amount);

const fmtDateTime = (raw) => {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString('en-GH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const formatPayoutSnapshot = (snapshot) => {
    if (!snapshot) return '—';
    const method = String(snapshot.payout_method || '').toLowerCase();
    if (method === 'momo') {
        return `${String(snapshot.momo_network || '').toUpperCase()} MoMo · ${snapshot.momo_number || '—'}`;
    }
    if (method === 'bank') {
        return `${snapshot.bank_name || 'Bank'} · ${snapshot.bank_account_number || '—'}`;
    }
    return '—';
};

const statusMeta = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'paid') return { label: 'Paid', bg: '#dcfce7', color: '#16a34a' };
    if (s === 'processing' || s === 'pending') return { label: 'Processing', bg: '#fef3c7', color: '#d97706' };
    if (s === 'requested') return { label: 'Requested', bg: '#e0e7ff', color: '#4338ca' };
    if (s === 'failed' || s === 'rejected') return { label: s === 'failed' ? 'Failed' : 'Rejected', bg: '#fee2e2', color: '#dc2626' };
    return { label: status || '—', bg: '#f3f4f6', color: '#6b7280' };
};

function MethodChip({ label, active, onPress, colors, iconSource }) {
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: active ? config.THEME_COLOR : colors.border,
                backgroundColor: active ? colors.primaryShade : colors.surface,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
            }}>
            {iconSource ? (
                <Image source={iconSource} style={{ width: 18, height: 18 }} resizeMode="contain" />
            ) : null}
            <AppText label={label} fontSize={12} color={active ? config.THEME_COLOR : colors.text} fontFamily={active ? 'FiraSans-SemiBold' : undefined} />
        </TouchableOpacity>
    );
}

const OrderSettlements = ({ navigation }) => {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [summary, setSummary] = useState(null);
    const [rows, setRows] = useState([]);
    const [profile, setProfile] = useState(null);
    const [ghBanks, setGhBanks] = useState([]);
    const [payoutMethod, setPayoutMethod] = useState('momo');
    const [momoNetwork, setMomoNetwork] = useState('mtn');
    const [momoNumber, setMomoNumber] = useState('');
    const [paystackBankCode, setPaystackBankCode] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankAccountNumber, setBankAccountNumber] = useState('');
    const [bankAccountName, setBankAccountName] = useState('');
    const [accountHolderName, setAccountHolderName] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawNote, setWithdrawNote] = useState('');
    const [showBankPicker, setShowBankPicker] = useState(false);
    const [bankSearch, setBankSearch] = useState('');

    const filteredBanks = useMemo(() => {
        const q = bankSearch.trim().toLowerCase();
        if (!q) return ghBanks;
        return ghBanks.filter((b) => String(b.name || '').toLowerCase().includes(q));
    }, [ghBanks, bankSearch]);

    const applyProfile = (data) => {
        setProfile(data || null);
        if (!data) return;
        setPayoutMethod(String(data.payout_method || 'momo').toLowerCase());
        setMomoNetwork(String(data.momo_network || 'mtn').toLowerCase());
        setMomoNumber(String(data.momo_number || ''));
        setPaystackBankCode(String(data.paystack_bank_code || ''));
        setBankName(String(data.bank_name || ''));
        setBankAccountNumber(String(data.bank_account_number || ''));
        setBankAccountName(String(data.bank_account_name || ''));
        setAccountHolderName(String(data.account_holder_name || ''));
    };

    const load = useCallback(async () => {
        try {
            const [summaryData, listData, profileData, banksData] = await Promise.all([
                tenants.mySettlementSummary(),
                tenants.mySettlements(),
                tenants.myPayoutProfile().catch(() => null),
                tenants.payoutBanks({ type: 'ghipss' }).catch(() => []),
            ]);
            setSummary(summaryData || null);
            setRows(Array.isArray(listData) ? listData : []);
            setGhBanks(Array.isArray(banksData) ? banksData : []);
            applyProfile(profileData);
        } catch (_) {
            setSummary(null);
            setRows([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            load();
            return undefined;
        }, [load]),
    );

    const onRefresh = () => {
        setRefreshing(true);
        load();
    };

    const inputStyle = {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: colors.text,
        marginBottom: 8,
    };

    const onSaveProfile = async () => {
        setBusy(true);
        try {
            const saved = await tenants.updateMyPayoutProfile({
                payout_method: payoutMethod,
                momo_network: payoutMethod === 'momo' ? momoNetwork : undefined,
                momo_number: payoutMethod === 'momo' ? momoNumber : undefined,
                bank_name: payoutMethod === 'bank' ? bankName : undefined,
                paystack_bank_code: payoutMethod === 'bank' ? paystackBankCode : undefined,
                bank_account_number: payoutMethod === 'bank' ? bankAccountNumber : undefined,
                bank_account_name: payoutMethod === 'bank' ? bankAccountName : undefined,
                account_holder_name: accountHolderName,
            });
            applyProfile(saved);
            Alert.alert('Saved', 'Payout details updated.');
        } catch (error) {
            Alert.alert(
                'Could not save',
                error?.response?.data?.message || error?.response?.data?.error || 'Try again.',
            );
        } finally {
            setBusy(false);
        }
    };

    const onRequestWithdrawal = () => {
        const parsed = Number(withdrawAmount);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            Alert.alert('Invalid amount', 'Enter a valid withdrawal amount.');
            return;
        }
        Alert.alert('Request withdrawal', `Request ${formatAmount(parsed)} from your available balance?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Request',
                onPress: async () => {
                    setBusy(true);
                    try {
                        const result = await tenants.requestWithdrawal({
                            amount: parsed,
                            note: withdrawNote.trim() || undefined,
                        });
                        setWithdrawAmount('');
                        setWithdrawNote('');
                        await load();
                        const status = String(result?.status || '').toLowerCase();
                        if (status === 'paid') {
                            Alert.alert('Withdrawal sent', 'Paystack completed your payout.');
                        } else if (status === 'failed') {
                            Alert.alert(
                                'Withdrawal failed',
                                result?.rejection_reason || 'Paystack could not complete this payout.',
                            );
                        } else {
                            Alert.alert('Withdrawal submitted', 'Paystack is processing your payout.');
                        }
                    } catch (error) {
                        Alert.alert(
                            'Could not request withdrawal',
                            error?.response?.data?.message || error?.response?.data?.error || 'Try again.',
                        );
                    } finally {
                        setBusy(false);
                    }
                },
            },
        ]);
    };

    const onRetryWithdrawal = (row) => {
        Alert.alert('Retry payout', `Retry Paystack payout of ${formatAmount(row.amount)}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Retry',
                onPress: async () => {
                    setBusy(true);
                    try {
                        const result = await tenants.retryWithdrawal(row.id);
                        await load();
                        const status = String(result?.status || '').toLowerCase();
                        if (status === 'paid') {
                            Alert.alert('Withdrawal sent', 'Paystack completed your payout.');
                        } else if (status === 'failed') {
                            Alert.alert(
                                'Withdrawal failed',
                                result?.rejection_reason || 'Paystack could not complete this payout.',
                            );
                        } else {
                            Alert.alert('Retry submitted', 'Paystack is processing your payout.');
                        }
                    } catch (error) {
                        Alert.alert(
                            'Could not retry',
                            error?.response?.data?.message || error?.response?.data?.error || 'Try again.',
                        );
                    } finally {
                        setBusy(false);
                    }
                },
            },
        ]);
    };

    const cardStyle = {
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    };

    const localStyles = StyleSheet.create({
        summaryRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            paddingHorizontal: 16,
            marginBottom: 8,
        },
        statCard: {
            flex: 1,
            minWidth: '46%',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
        },
        statIcon: {
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
        },
        section: {
            marginHorizontal: 16,
            marginBottom: 12,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        rowItem: {
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: StyleSheet.hairlineWidth,
        },
    });

    if (loading && !summary) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={() => navigation.goBack()} label="Order settlements" />
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Order settlements">
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={() => navigation.navigate('OrderPayments')}
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                        <Lucide name="banknote" color={config.THEME_COLOR} size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={onRefresh}
                        disabled={refreshing}
                        style={[styles.actionButton, { backgroundColor: colors.surface }, refreshing && { opacity: 0.5 }]}>
                        {refreshing ? (
                            <ActivityIndicator size="small" color={config.THEME_COLOR} />
                        ) : (
                            <Lucide name="refresh-cw" color={config.THEME_COLOR} size={20} />
                        )}
                    </TouchableOpacity>
                </View>
            </ScreenHeader>

            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[config.THEME_COLOR]} tintColor={config.THEME_COLOR} />
                }
                contentContainerStyle={{ paddingBottom: 24 }}>
                <View style={[localStyles.summaryRow, { marginTop: 12 }]}>
                    <View style={[localStyles.statCard, cardStyle]}>
                        <View style={[localStyles.statIcon, { backgroundColor: colors.primaryShade }]}>
                            <Lucide name="wallet" size={16} color={config.THEME_COLOR} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <AppText label="Digital collected" fontSize={11} color={colors.textTertiary} />
                            <AppText label={formatAmount(summary?.digital_collected)} variant={1} fontSize={16} color={colors.text} style={{ marginTop: 2 }} />
                        </View>
                    </View>
                    <View style={[localStyles.statCard, cardStyle]}>
                        <View style={[localStyles.statIcon, { backgroundColor: '#dcfce7' }]}>
                            <Lucide name="circle-check" size={16} color="#16a34a" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <AppText label="Paid out" fontSize={11} color={colors.textTertiary} />
                            <AppText label={formatAmount(summary?.settled_paid)} variant={1} fontSize={16} color="#16a34a" style={{ marginTop: 2 }} />
                        </View>
                    </View>
                </View>

                <View style={localStyles.summaryRow}>
                    <View style={[localStyles.statCard, cardStyle]}>
                        <View style={[localStyles.statIcon, { backgroundColor: '#fef3c7' }]}>
                            <Lucide name="clock" size={16} color="#d97706" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <AppText label="Pending payout" fontSize={11} color={colors.textTertiary} />
                            <AppText label={formatAmount(summary?.pending_settlements)} variant={1} fontSize={16} color="#d97706" style={{ marginTop: 2 }} />
                        </View>
                    </View>
                    <View style={[localStyles.statCard, cardStyle]}>
                        <View style={[localStyles.statIcon, { backgroundColor: '#dbeafe' }]}>
                            <Lucide name="landmark" size={16} color="#2563eb" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <AppText label="Available balance" fontSize={11} color={colors.textTertiary} />
                            <AppText label={formatAmount(summary?.available_balance)} variant={1} fontSize={16} color="#2563eb" style={{ marginTop: 2 }} />
                        </View>
                    </View>
                </View>

                <View style={localStyles.section}>
                    <AppText label="Payout details" variant={1} fontSize={16} color={colors.text} />
                    <AppText label="Withdrawals are sent automatically via Paystack to your saved account." fontSize={12} color={colors.textSecondary} style={{ marginTop: 4, marginBottom: 12 }} />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                        <MethodChip label="Mobile money" active={payoutMethod === 'momo'} onPress={() => setPayoutMethod('momo')} colors={colors} />
                        <MethodChip label="Bank transfer" active={payoutMethod === 'bank'} onPress={() => setPayoutMethod('bank')} colors={colors} />
                    </View>
                    <TextInput value={accountHolderName} onChangeText={setAccountHolderName} placeholder="Account holder name" placeholderTextColor={colors.textTertiary} style={inputStyle} />
                    {payoutMethod === 'momo' ? (
                        <>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                                {['mtn', 'vodafone', 'airteltigo'].map((net) => (
                                    <MethodChip
                                        key={net}
                                        label={net === 'vodafone' ? 'Telecel' : net === 'airteltigo' ? 'AT' : 'MTN'}
                                        active={momoNetwork === net}
                                        onPress={() => setMomoNetwork(net)}
                                        colors={colors}
                                        iconSource={getMomoNetworkIcon(net)}
                                    />
                                ))}
                            </View>
                            <TextInput value={momoNumber} onChangeText={setMomoNumber} placeholder="MoMo number" keyboardType="phone-pad" placeholderTextColor={colors.textTertiary} style={inputStyle} />
                        </>
                    ) : (
                        <>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                    setBankSearch('');
                                    setShowBankPicker(true);
                                }}
                                style={{
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    borderRadius: 10,
                                    paddingHorizontal: 12,
                                    paddingVertical: 12,
                                    marginBottom: 8,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }}>
                                <AppText
                                    label={bankName || 'Select bank'}
                                    fontSize={14}
                                    color={bankName ? colors.text : colors.textTertiary}
                                    numberOfLines={1}
                                    style={{ flex: 1, marginRight: 8 }}
                                />
                                <Lucide name="chevron-down" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                            <TextInput value={bankAccountNumber} onChangeText={setBankAccountNumber} placeholder="Account number" placeholderTextColor={colors.textTertiary} style={inputStyle} />
                            <TextInput value={bankAccountName} onChangeText={setBankAccountName} placeholder="Account name" placeholderTextColor={colors.textTertiary} style={inputStyle} />
                        </>
                    )}
                    <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={busy}
                        onPress={onSaveProfile}
                        style={{ backgroundColor: config.THEME_COLOR, borderRadius: 10, paddingVertical: 12, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
                        <AppText label="Save payout details" color="#fff" fontFamily="FiraSans-SemiBold" />
                    </TouchableOpacity>
                    {profile ? (
                        <AppText label={`Saved: ${formatPayoutSnapshot(profile)}`} fontSize={11} color={colors.textTertiary} style={{ marginTop: 10 }} />
                    ) : null}
                </View>

                <View style={localStyles.section}>
                    <AppText label="Withdraw funds" variant={1} fontSize={16} color={colors.text} />
                    <AppText
                        label={`Available: ${formatAmount(summary?.available_balance)}. Balance is checked and payout is sent via Paystack.`}
                        fontSize={12}
                        color={colors.textSecondary}
                        style={{ marginTop: 4, marginBottom: 12 }}
                    />
                    <TextInput value={withdrawAmount} onChangeText={setWithdrawAmount} placeholder="Amount (GHS)" keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} style={inputStyle} />
                    <TextInput value={withdrawNote} onChangeText={setWithdrawNote} placeholder="Note (optional)" placeholderTextColor={colors.textTertiary} style={inputStyle} />
                    <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={busy || !profile}
                        onPress={onRequestWithdrawal}
                        style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 10,
                            paddingVertical: 12,
                            alignItems: 'center',
                            opacity: busy || !profile ? 0.6 : 1,
                        }}>
                        <AppText label="Withdraw funds" color={colors.text} fontFamily="FiraSans-SemiBold" />
                    </TouchableOpacity>
                </View>

                <View style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <AppText label="Withdrawal history" variant={1} fontSize={16} color={colors.text} />
                    <AppText label={`${rows.length}`} fontSize={12} color={colors.textTertiary} />
                </View>

                <View style={[cardStyle, { marginHorizontal: 16, overflow: 'hidden' }]}>
                    {rows.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                            <Lucide name="landmark" size={36} color={colors.border} />
                            <AppText label="No withdrawals yet" fontSize={14} color={colors.textTertiary} style={{ marginTop: 10 }} />
                        </View>
                    ) : (
                        rows.map((row, idx) => {
                            const badge = statusMeta(row.status);
                            return (
                                <View
                                    key={row.id}
                                    style={[
                                        localStyles.rowItem,
                                        {
                                            borderBottomColor: colors.border,
                                            borderBottomWidth: idx < rows.length - 1 ? StyleSheet.hairlineWidth : 0,
                                        },
                                    ]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <AppText label={formatAmount(row.amount)} variant={1} fontSize={16} color={colors.text} />
                                            <AppText label={fmtDateTime(row.created_at)} fontSize={12} color={colors.textSecondary} style={{ marginTop: 4 }} />
                                            {row.payout_snapshot ? (
                                                <AppText label={`To: ${formatPayoutSnapshot(row.payout_snapshot)}`} fontSize={11} color={colors.textTertiary} style={{ marginTop: 2 }} numberOfLines={2} />
                                            ) : null}
                                            {row.rejection_reason ? (
                                                <AppText label={row.rejection_reason} fontSize={11} color="#dc2626" style={{ marginTop: 2 }} />
                                            ) : null}
                                            {row.paystack_transfer_reference ? (
                                                <AppText label={`Ref: ${row.paystack_transfer_reference}`} fontSize={11} color={colors.textTertiary} style={{ marginTop: 2 }} numberOfLines={1} />
                                            ) : null}
                                        </View>
                                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: badge.bg }}>
                                                <AppText label={badge.label} fontSize={11} color={badge.color} fontFamily="FiraSans-SemiBold" />
                                            </View>
                                            {String(row.status || '').toLowerCase() === 'failed' && row.source === 'merchant' ? (
                                                <TouchableOpacity
                                                    activeOpacity={0.7}
                                                    disabled={busy}
                                                    onPress={() => onRetryWithdrawal(row)}
                                                    style={{
                                                        borderWidth: 1,
                                                        borderColor: colors.border,
                                                        borderRadius: 8,
                                                        paddingHorizontal: 10,
                                                        paddingVertical: 6,
                                                    }}>
                                                    <AppText label="Retry" fontSize={11} color={colors.text} />
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            <Modal visible={showBankPicker} animationType="slide" onRequestClose={() => setShowBankPicker(false)}>
                <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                        <AppText label="Select bank" variant={1} fontSize={17} color={colors.text} style={{ flex: 1 }} />
                        <TouchableOpacity onPress={() => setShowBankPicker(false)}>
                            <Lucide name="x" size={22} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    <View style={{ padding: 16 }}>
                        <TextInput
                            value={bankSearch}
                            onChangeText={setBankSearch}
                            placeholder="Search banks..."
                            placeholderTextColor={colors.textTertiary}
                            style={inputStyle}
                        />
                    </View>
                    <FlatList
                        data={filteredBanks}
                        keyExtractor={(item) => String(item.code)}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                    setPaystackBankCode(item.code);
                                    setBankName(item.name);
                                    setShowBankPicker(false);
                                }}
                                style={{
                                    paddingHorizontal: 16,
                                    paddingVertical: 14,
                                    borderBottomWidth: StyleSheet.hairlineWidth,
                                    borderBottomColor: colors.border,
                                    backgroundColor: paystackBankCode === item.code ? colors.primaryShade : colors.background,
                                }}>
                                <AppText label={item.name} fontSize={15} color={colors.text} />
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <View style={{ padding: 24, alignItems: 'center' }}>
                                <AppText label="No banks found" color={colors.textTertiary} />
                            </View>
                        }
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

export default OrderSettlements;
