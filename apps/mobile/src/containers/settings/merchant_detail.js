import React, { useCallback, useState } from 'react';
import {
    View,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
} from 'react-native';
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

function fmtMoney(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : '—';
}

function userDisplayName(row) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    if (name) return name;
    if (row.email) return row.email;
    if (row.phone) return row.phone;
    return 'User';
}

function fmtDate(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
    } catch (_) {
        return '—';
    }
}

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
    const [revoking, setRevoking] = useState(false);
    /** @type {'businesses' | 'commissions'} */
    const [detailTab, setDetailTab] = useState('businesses');

    const load = useCallback(async () => {
        if (!merchantId) return;
        try {
            const data = await merchantsApi.adminDetail(merchantId);
            setDetailData(data);
        } catch (e) {
            setDetailData(null);
            Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not load merchant.');
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

    const handleMarkPaid = useCallback(
        (commissionId) => {
            Alert.alert('Mark paid', 'Confirm commission paid?', [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'OK',
                    onPress: async () => {
                        try {
                            await merchantsApi.markPaid(commissionId);
                            await load();
                        } catch (e) {
                            Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed');
                        }
                    },
                },
            ]);
        },
        [load],
    );

    const confirmRevoke = () => {
        const m = detailData?.merchant;
        if (!m?.id) return;
        const label = userDisplayName(m);
        Alert.alert(
            'Remove merchant partner?',
            `Remove merchant status for ${label}? Onboarded businesses will be unlinked and commission records for this merchant will be permanently deleted.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove merchant',
                    style: 'destructive',
                    onPress: async () => {
                        setRevoking(true);
                        try {
                            await merchantsApi.revoke(m.id);
                            Alert.alert('Done', 'User is no longer a merchant.', [
                                { text: 'OK', onPress: () => navigation.goBack() },
                            ]);
                        } catch (e) {
                            Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not remove merchant');
                        } finally {
                            setRevoking(false);
                        }
                    },
                },
            ],
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

    const tenantsList = detailData?.tenants ?? [];
    const commissionsList = detailData?.commissions ?? [];

    const tableWrapStyle = { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' };

    const renderBusinessesTable = () => {
        const rows = detailData?.tenants ?? [];
        if (rows.length === 0) {
            return (
                <AppText label="No businesses onboarded yet." fontSize={13} color={colors.textSecondary} style={{ paddingVertical: 16 }} />
            );
        }
        return (
            <View style={tableWrapStyle}>
                <View
                    style={{
                        flexDirection: 'row',
                        paddingVertical: 10,
                        paddingHorizontal: 10,
                        backgroundColor: colors.surfaceSecondary ?? colors.surface,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                    }}
                >
                    <View style={{ flex: 2.2, paddingRight: 6 }}>
                        <AppText label="Business" fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                    <View style={{ flex: 1.4, paddingRight: 6 }}>
                        <AppText label="Plan" fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                    <View style={{ flex: 1, paddingRight: 6 }}>
                        <AppText label="Amount" fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <AppText label="Onboarded" fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                </View>
                {rows.map((t, idx) => (
                    <View
                        key={t.id}
                        style={{
                            flexDirection: 'row',
                            paddingVertical: 12,
                            paddingHorizontal: 10,
                            borderBottomWidth: idx < rows.length - 1 ? StyleSheet.hairlineWidth : 0,
                            borderBottomColor: colors.border,
                            backgroundColor: colors.surface,
                        }}
                    >
                        <View style={{ flex: 2.2, paddingRight: 6 }}>
                            <AppText label={t.name || '—'} fontSize={13} color={colors.text} numberOfLines={2} />
                            <AppText
                                label={[t.organization, t.phone].filter(Boolean).join(' · ') || '—'}
                                fontSize={10}
                                color={colors.textTertiary}
                                numberOfLines={2}
                                style={{ marginTop: 4 }}
                            />
                        </View>
                        <View style={{ flex: 1.4, paddingRight: 6, justifyContent: 'center' }}>
                            <AppText label={t.subscription_name || '—'} fontSize={12} color={colors.textSecondary} numberOfLines={2} />
                        </View>
                        <View style={{ flex: 1, paddingRight: 6, justifyContent: 'center' }}>
                            <AppText label={`₵${fmtMoney(t.subscription_amount)}`} fontSize={12} color={colors.text} />
                        </View>
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            <AppText label={fmtDate(t.created_at)} fontSize={11} color={colors.textSecondary} />
                        </View>
                    </View>
                ))}
            </View>
        );
    };

    const renderCommissionsTable = () => {
        const rows = detailData?.commissions ?? [];
        if (rows.length === 0) {
            return (
                <AppText label="No commission rows yet." fontSize={13} color={colors.textSecondary} style={{ paddingVertical: 16 }} />
            );
        }
        return (
            <View style={tableWrapStyle}>
                <View
                    style={{
                        flexDirection: 'row',
                        paddingVertical: 10,
                        paddingHorizontal: 8,
                        backgroundColor: colors.surfaceSecondary ?? colors.surface,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                    }}
                >
                    <View style={{ flex: 1.8, paddingRight: 4 }}>
                        <AppText label="Tenant" fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                    <View style={{ flex: 1, paddingRight: 4 }}>
                        <AppText label="Base" fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                    <View style={{ flex: 0.65, paddingRight: 4 }}>
                        <AppText label="%" fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                    <View style={{ flex: 1, paddingRight: 4 }}>
                        <AppText label="Comm." fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                    <View style={{ flex: 0.85, paddingRight: 4 }}>
                        <AppText label="Status" fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                    {canManageMerchants ? (
                        <View style={{ flex: 1, minWidth: 56 }}>
                            <AppText label="Action" fontSize={11} color={colors.textTertiary} variant={1} />
                        </View>
                    ) : (
                        <View style={{ flex: 1 }}>
                            <AppText label="Created" fontSize={11} color={colors.textTertiary} variant={1} />
                        </View>
                    )}
                </View>
                {rows.map((c, idx) => (
                    <View
                        key={c.id}
                        style={{
                            flexDirection: 'row',
                            paddingVertical: 10,
                            paddingHorizontal: 8,
                            alignItems: 'center',
                            borderBottomWidth: idx < rows.length - 1 ? StyleSheet.hairlineWidth : 0,
                            borderBottomColor: colors.border,
                            backgroundColor: colors.surface,
                        }}
                    >
                        <View style={{ flex: 1.8, paddingRight: 4 }}>
                            <AppText label={c.tenant_name || String(c.tenant_id || '—')} fontSize={12} color={colors.text} numberOfLines={2} />
                        </View>
                        <View style={{ flex: 1, paddingRight: 4 }}>
                            <AppText label={`₵${fmtMoney(c.base_amount)}`} fontSize={11} color={colors.textSecondary} />
                        </View>
                        <View style={{ flex: 0.65, paddingRight: 4 }}>
                            <AppText label={`${fmtMoney(c.commission_percent)}`} fontSize={11} color={colors.textSecondary} />
                        </View>
                        <View style={{ flex: 1, paddingRight: 4 }}>
                            <AppText label={`₵${fmtMoney(c.commission_amount)}`} fontSize={11} color={colors.text} />
                        </View>
                        <View style={{ flex: 0.85, paddingRight: 4 }}>
                            <View
                                style={{
                                    paddingHorizontal: 6,
                                    paddingVertical: 3,
                                    borderRadius: 6,
                                    alignSelf: 'flex-start',
                                    backgroundColor:
                                        c.status === 'paid' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)',
                                }}
                            >
                                <AppText label={c.status || '—'} variant={1} fontSize={10} color={colors.text} />
                            </View>
                        </View>
                        {canManageMerchants ? (
                            <View style={{ flex: 1, minWidth: 56, justifyContent: 'center' }}>
                                {c.status === 'pending' ? (
                                    <TouchableOpacity onPress={() => handleMarkPaid(c.id)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                                        <AppText label="Pay" color={config.THEME_COLOR} variant={1} fontSize={11} />
                                    </TouchableOpacity>
                                ) : (
                                    <AppText label="—" fontSize={11} color={colors.textTertiary} />
                                )}
                            </View>
                        ) : (
                            <View style={{ flex: 1 }}>
                                <AppText label={fmtDate(c.created_at)} fontSize={10} color={colors.textTertiary} />
                            </View>
                        )}
                    </View>
                ))}
            </View>
        );
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

    const m = detailData?.merchant;

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
                                    <Lucide name="user" size={26} color={config.THEME_COLOR} />
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <AppText label={userDisplayName(m)} fontSize={18} color={colors.text} variant={1} />
                                    <AppText
                                        label={[m.phone, m.email].filter(Boolean).join(' · ') || '—'}
                                        fontSize={13}
                                        color={colors.textSecondary}
                                        style={{ marginTop: 6 }}
                                    />
                                </View>
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
                                    label={`Registered ${fmtDate(m.created_at)}`}
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 6 }}
                                />
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
                                <TouchableOpacity
                                    onPress={() => setDetailTab('businesses')}
                                    activeOpacity={0.75}
                                    style={{
                                        flex: 1,
                                        alignItems: 'center',
                                        paddingTop: 8,
                                        paddingBottom: 12,
                                        borderBottomWidth: 3,
                                        marginBottom: -StyleSheet.hairlineWidth,
                                        borderBottomColor:
                                            detailTab === 'businesses' ? config.THEME_COLOR : 'transparent',
                                    }}
                                >
                                    <Lucide
                                        name="building-2"
                                        size={18}
                                        color={detailTab === 'businesses' ? config.THEME_COLOR : colors.textTertiary}
                                    />
                                    <AppText
                                        label={`Businesses (${tenantsList.length})`}
                                        variant={1}
                                        fontSize={14}
                                        color={detailTab === 'businesses' ? colors.text : colors.textSecondary}
                                        style={{ marginTop: 6 }}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setDetailTab('commissions')}
                                    activeOpacity={0.75}
                                    style={{
                                        flex: 1,
                                        alignItems: 'center',
                                        paddingTop: 8,
                                        paddingBottom: 12,
                                        borderBottomWidth: 3,
                                        marginBottom: -StyleSheet.hairlineWidth,
                                        borderBottomColor:
                                            detailTab === 'commissions' ? config.THEME_COLOR : 'transparent',
                                    }}
                                >
                                    <Lucide
                                        name="coins"
                                        size={18}
                                        color={detailTab === 'commissions' ? config.THEME_COLOR : colors.textTertiary}
                                    />
                                    <AppText
                                        label={`Commissions (${commissionsList.length})`}
                                        variant={1}
                                        fontSize={14}
                                        color={detailTab === 'commissions' ? colors.text : colors.textSecondary}
                                        style={{ marginTop: 6 }}
                                    />
                                </TouchableOpacity>
                            </View>
                            <View style={{ marginTop: 14 }}>
                                {detailTab === 'businesses' ? renderBusinessesTable() : renderCommissionsTable()}
                            </View>
                        </View>

                        {canManageMerchants ? (
                            <TouchableOpacity
                                onPress={confirmRevoke}
                                disabled={revoking}
                                activeOpacity={0.85}
                                style={{
                                    marginTop: 28,
                                    paddingVertical: 16,
                                    borderRadius: 5,
                                    borderWidth: 1.5,
                                    borderColor: '#dc2626',
                                    backgroundColor: colors.surface,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'row',
                                    gap: 8,
                                    opacity: revoking ? 0.65 : 1,
                                }}
                            >
                                <Lucide name="user-x" size={20} color="#dc2626" />
                                <AppText label="Revoke merchant partner" variant={1} fontSize={15} color="#dc2626" />
                            </TouchableOpacity>
                        ) : null}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default MerchantDetail;
