import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    StyleSheet,
    TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import styles from './styles';
import useTheme from '../../hooks/useTheme';
import { merchants as merchantsApi } from '../../services/api';
import { isFreeTierTenant } from '../../utils/billingCatalog';
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

function haystack(parts) {
    return parts
        .filter((p) => p != null && p !== '')
        .map((p) => String(p))
        .join(' ')
        .toLowerCase();
}

const MerchantPortal = ({ navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const user = useSelector(({ user: u }) => u);
    const screenHeaderTitle = user?.merchant_id ? 'Clients / Shops' : 'Merchants';
    const canGoBack = typeof navigation.canGoBack === 'function' && navigation.canGoBack();
    const canManageMerchants = hasPermission(user, 'merchants.view');
    const canOperateMerchantPortal = hasPermission(user, ['merchants.operate', 'merchants.view']);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [merchant, setMerchant] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [commissions, setCommissions] = useState([]);
    const [adminMerchants, setAdminMerchants] = useState([]);
    const [tab, setTab] = useState('businesses');
    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    const load = useCallback(async () => {
        try {
            const me = await merchantsApi.me();
            const m = me?.merchant ?? null;
            setMerchant(m);

            let t = [];
            let c = [];
            if (m?.id && canOperateMerchantPortal) {
                const [tRes, cRes] = await Promise.all([
                    merchantsApi.onboardedTenants(),
                    merchantsApi.commissions(),
                ]);
                t = Array.isArray(tRes?.tenants) ? tRes.tenants : [];
                c = Array.isArray(cRes?.commissions) ? cRes.commissions : [];
            }
            setTenants(t);
            setCommissions(c);

            let admins = [];
            if (canManageMerchants) {
                const listRes = await merchantsApi.adminList();
                admins = Array.isArray(listRes?.merchants) ? listRes.merchants : [];
            }
            setAdminMerchants(admins);
        } catch (e) {
            setMerchant(null);
            setTenants([]);
            setCommissions([]);
            setAdminMerchants([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [canManageMerchants, canOperateMerchantPortal]);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            load();
        }, [load]),
    );

    const showPartnerTabs = Boolean(merchant?.id && canOperateMerchantPortal);
    const showAllMerchantsTab = canManageMerchants;

    const searchPlaceholder =
        tab === 'all' || (!showPartnerTabs && showAllMerchantsTab)
            ? 'Search partners by name, email, phone...'
            : tab === 'commissions'
              ? 'Search commissions by business, status...'
              : 'Search businesses by name, plan...';

    useEffect(() => {
        if (!showAllMerchantsTab && tab === 'all') {
            setTab('businesses');
        }
    }, [showAllMerchantsTab, tab]);

    const pendingCommissionsCount = useMemo(
        () => commissions.filter((c) => c.status === 'pending').length,
        [commissions],
    );

    const filteredAdminMerchants = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return adminMerchants;
        return adminMerchants.filter((row) =>
            haystack([
                userDisplayName(row),
                row.email,
                row.phone,
                row.default_commission_percent,
                row.onboarded_count,
            ]).includes(q),
        );
    }, [adminMerchants, search]);

    const filteredTenants = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return tenants;
        return tenants.filter((t) =>
            haystack([t.name, t.organization, t.phone, t.subscription_name, t.subscription_amount]).includes(q),
        );
    }, [tenants, search]);

    const filteredCommissions = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return commissions;
        return commissions.filter((c) =>
            haystack([
                c.tenant_name,
                c.tenant_id,
                c.status,
                c.base_amount,
                c.commission_amount,
                c.commission_percent,
            ]).includes(q),
        );
    }, [commissions, search]);

    const onRefresh = () => {
        setRefreshing(true);
        load();
    };

    const bottomInsetPad = 16 + insets.bottom;

    const cardStyle = {
        padding: 14,
        marginBottom: 10,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    };

    /** Tab bar in main.js uses `position: 'absolute'` and `height: 60 + insets.bottom` — keep in sync. */
    const TAB_BAR_CORE_HEIGHT = 60;
    const tabBarTotalHeight = TAB_BAR_CORE_HEIGHT + insets.bottom;
    const FAB_GAP_ABOVE_TAB = 16;
    const FAB_SIZE = 58;
    const fabBottomOffset = FAB_GAP_ABOVE_TAB + tabBarTotalHeight;
    const fabShadow =
        Platform.OS === 'ios'
            ? {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.22,
                  shadowRadius: 8,
              }
            : { elevation: 8 };

    const renderScreenHeader = () => (
        <ScreenHeader hideBack={!canGoBack} onPress={() => navigation.goBack()} label={screenHeaderTitle}>
            <View style={styles.headerActions}>
                <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={() => {
                        setShowSearch((prev) => {
                            const next = !prev;
                            if (!next) setSearch('');
                            return next;
                        });
                    }}
                    style={[styles.actionButton, { backgroundColor: colors.surface }]}>
                    <Lucide name={showSearch ? 'x' : 'search'} color={colors.text} size={20} />
                </TouchableOpacity>
            </View>
        </ScreenHeader>
    );

    const renderSearchBar = () =>
        showSearch ? (
            <View style={[styles.searchContainer, { backgroundColor: colors.surface, marginTop: 10, marginBottom: 10, marginHorizontal: 0, }]}>
                <Lucide name="search" color={colors.textTertiary} size={18} />
                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder={searchPlaceholder}
                    placeholderTextColor={colors.placeholder}
                    style={[styles.searchInput, { color: colors.text }]}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                />
                {search.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Lucide name="x" color={colors.textTertiary} size={18} />
                    </TouchableOpacity>
                ) : null}
            </View>
        ) : null;

    const renderMerchantItem = ({ item: row }) => (
        <TouchableOpacity
            style={[cardStyle, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
            onPress={() => navigation.navigate('MerchantDetail', { merchantId: row.id })}
            activeOpacity={0.72}
        >
            <View
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: config.THEME_COLOR + '18',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Lucide name="user" size={22} color={config.THEME_COLOR} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <AppText label={userDisplayName(row)} variant={1} color={colors.text} fontSize={16} />
                <AppText
                    label={[row.email, row.phone].filter(Boolean).join(' · ') || '—'}
                    variant={2}
                    color={colors.textTertiary}
                    fontSize={12}
                    style={{ marginTop: 4 }}
                />
                <AppText
                    label={`${row.onboarded_count ?? 0} businesses · Default ${
                        row.default_commission_percent != null && row.default_commission_percent !== ''
                            ? `${fmtMoney(row.default_commission_percent)}%`
                            : '—'
                    }`}
                    variant={2}
                    color={colors.textSecondary}
                    fontSize={12}
                    style={{ marginTop: 6 }}
                />
            </View>
            <Lucide name="chevron-right" size={22} color={colors.textTertiary} />
        </TouchableOpacity>
    );

    const portalTableWrap = { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' };

    const renderPortalTenantsTable = () => {
        if (tenants.length === 0) {
            return (
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
                    <Lucide name="store" size={32} color={colors.textTertiary} />
                    <AppText
                        label="No businesses onboarded yet"
                        style={{ marginTop: 10 }}
                        color={colors.textSecondary}
                        fontSize={14}
                    />
                    <AppText
                        label="Use Onboard new business when you are ready."
                        variant={2}
                        style={{ marginTop: 6, textAlign: 'center' }}
                        color={colors.textTertiary}
                        fontSize={12}
                    />
                </View>
            );
        }
        if (filteredTenants.length === 0) {
            return (
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
                    <Lucide name="search" size={32} color={colors.textTertiary} />
                    <AppText
                        label="No businesses match your search"
                        style={{ marginTop: 10 }}
                        color={colors.textSecondary}
                        fontSize={14}
                    />
                </View>
            );
        }
        return (
            <View style={portalTableWrap}>
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
                    <View style={{ flex: 1.1 }}>
                        <AppText label="Actions" fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                </View>
                {filteredTenants.map((t, idx) => (
                    <View
                        key={t.id}
                        style={{
                            flexDirection: 'row',
                            paddingVertical: 12,
                            paddingHorizontal: 10,
                            borderBottomWidth: idx < filteredTenants.length - 1 ? StyleSheet.hairlineWidth : 0,
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
                        <View style={{ flex: 1.1, justifyContent: 'center', gap: 6 }}>
                            {t.quote_status === 'pending_payment' ? (
                                <TouchableOpacity
                                    onPress={() =>
                                        navigation.navigate('MerchantCollect', {
                                            tenantId: t.id,
                                            ownerEmail: t.email || undefined,
                                        })
                                    }
                                    style={{
                                        backgroundColor: config.THEME_COLOR,
                                        paddingVertical: 6,
                                        paddingHorizontal: 8,
                                        borderRadius: 5,
                                    }}
                                >
                                    <AppText label="Collect" fontSize={11} color="#fff" />
                                </TouchableOpacity>
                            ) : (
                                <>
                                    {isFreeTierTenant(t) ? (
                                        <TouchableOpacity
                                            onPress={() =>
                                                navigation.navigate('MerchantUpgradeCollect', {
                                                    tenantId: t.id,
                                                    businessName: t.name || t.organization || 'Business',
                                                    ownerEmail: t.email || undefined,
                                                })
                                            }
                                            style={{
                                                backgroundColor: config.THEME_COLOR,
                                                paddingVertical: 6,
                                                paddingHorizontal: 8,
                                                borderRadius: 5,
                                            }}
                                        >
                                            <AppText label="Upgrade & collect" fontSize={10} color="#fff" />
                                        </TouchableOpacity>
                                    ) : null}
                                    <TouchableOpacity
                                        onPress={() =>
                                            navigation.navigate('MerchantAddServices', {
                                                tenantId: t.id,
                                                businessName: t.name || t.organization || 'Business',
                                                ownerEmail: t.email || undefined,
                                            })
                                        }
                                        style={{
                                            borderWidth: 1,
                                            borderColor: config.THEME_COLOR,
                                            paddingVertical: 5,
                                            paddingHorizontal: 6,
                                            borderRadius: 5,
                                        }}
                                    >
                                        <AppText label="Add services" fontSize={10} color={config.THEME_COLOR} />
                                    </TouchableOpacity>
                                </>
                            )}
                            <AppText label={fmtDate(t.created_at)} fontSize={9} color={colors.textTertiary} />
                        </View>
                    </View>
                ))}
            </View>
        );
    };

    const renderPortalCommissionsTable = () => {
        if (commissions.length === 0) {
            return (
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
                    <Lucide name="coins" size={32} color={colors.textTertiary} />
                    <AppText label="No commission records yet" style={{ marginTop: 10 }} color={colors.textSecondary} fontSize={14} />
                </View>
            );
        }
        if (filteredCommissions.length === 0) {
            return (
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
                    <Lucide name="search" size={32} color={colors.textTertiary} />
                    <AppText
                        label="No commissions match your search"
                        style={{ marginTop: 10 }}
                        color={colors.textSecondary}
                        fontSize={14}
                    />
                </View>
            );
        }
        return (
            <View style={portalTableWrap}>
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
                    <View style={{ flex: 1.7, paddingRight: 4 }}>
                        <AppText label="Tenant" fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                    <View style={{ flex: 1, paddingRight: 4 }}>
                        <AppText label="Base" fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                    <View style={{ flex: 0.6, paddingRight: 4 }}>
                        <AppText label="%" fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                    <View style={{ flex: 1, paddingRight: 4 }}>
                        <AppText label="Comm." fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                    <View style={{ flex: 0.85, paddingRight: 4 }}>
                        <AppText label="Status" fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <AppText label="Created" fontSize={11} color={colors.textTertiary} variant={1} />
                    </View>
                </View>
                {filteredCommissions.map((c, idx) => (
                    <View
                        key={c.id}
                        style={{
                            flexDirection: 'row',
                            paddingVertical: 10,
                            paddingHorizontal: 8,
                            alignItems: 'center',
                            borderBottomWidth: idx < filteredCommissions.length - 1 ? StyleSheet.hairlineWidth : 0,
                            borderBottomColor: colors.border,
                            backgroundColor: colors.surface,
                        }}
                    >
                        <View style={{ flex: 1.7, paddingRight: 4 }}>
                            <AppText label={c.tenant_name || String(c.tenant_id || '—')} fontSize={12} color={colors.text} numberOfLines={2} />
                        </View>
                        <View style={{ flex: 1, paddingRight: 4 }}>
                            <AppText label={`₵${fmtMoney(c.base_amount)}`} fontSize={11} color={colors.textSecondary} />
                        </View>
                        <View style={{ flex: 0.6, paddingRight: 4 }}>
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
                        <View style={{ flex: 1 }}>
                            <AppText label={fmtDate(c.created_at)} fontSize={10} color={colors.textTertiary} />
                        </View>
                    </View>
                ))}
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                {renderScreenHeader()}
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={config.THEME_COLOR} size="large" />
                </View>
            </SafeAreaView>
        );
    }

    if (!canOperateMerchantPortal && !canManageMerchants) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                {renderScreenHeader()}
                <ScrollView contentContainerStyle={{ padding: 16 }}>
                    <View style={cardStyle}>
                        <AppText
                            label="You do not have access to merchant partner tools."
                            variant={2}
                            color={colors.textSecondary}
                            fontSize={14}
                        />
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    if (!merchant && !canManageMerchants && canOperateMerchantPortal) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                {renderScreenHeader()}
                <ScrollView
                    contentContainerStyle={{ padding: 16 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    <View style={cardStyle}>
                        <AppText
                            label="You have merchant portal permission, but your account is not linked to a merchant record yet. Ask an administrator to register you as a merchant partner."
                            variant={2}
                            color={colors.text}
                            fontSize={14}
                        />
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    if (!merchant && canManageMerchants) {
        const adminOnlyListPad = fabBottomOffset + FAB_SIZE + 24;
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                {renderScreenHeader()}
                <View style={{ flex: 1 }}>
                    <View style={{ paddingHorizontal: 12 }}>{renderSearchBar()}</View>
                    <FlatList
                        data={filteredAdminMerchants}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMerchantItem}
                        contentContainerStyle={{
                            paddingHorizontal: 12,
                            paddingTop: 8,
                            paddingBottom: adminOnlyListPad,
                            flexGrow: 1,
                        }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        ListEmptyComponent={
                            <View
                                style={{
                                    padding: 28,
                                    marginTop: 24,
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderStyle: 'dashed',
                                    borderColor: colors.border,
                                    alignItems: 'center',
                                }}
                            >
                                <Lucide
                                    name={search.trim() ? 'search' : 'users'}
                                    size={36}
                                    color={colors.textTertiary}
                                />
                                <AppText
                                    label={
                                        search.trim()
                                            ? 'No partners match your search'
                                            : 'No merchant partners yet'
                                    }
                                    style={{ marginTop: 12 }}
                                    color={colors.textSecondary}
                                    fontSize={15}
                                    variant={1}
                                />
                                <AppText
                                    label={search.trim() ? 'Try another name or email.' : 'Tap + to add a partner'}
                                    variant={2}
                                    style={{ marginTop: 8 }}
                                    color={colors.textTertiary}
                                    fontSize={13}
                                />
                            </View>
                        }
                    />
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Add merchant partner"
                        onPress={() => navigation.navigate('MerchantAdd')}
                        activeOpacity={0.92}
                        style={[
                            {
                                position: 'absolute',
                                right: 20,
                                bottom: fabBottomOffset,
                                width: FAB_SIZE,
                                height: FAB_SIZE,
                                borderRadius: FAB_SIZE / 2,
                                backgroundColor: config.THEME_COLOR,
                                alignItems: 'center',
                                justifyContent: 'center',
                            },
                            fabShadow,
                        ]}
                    >
                        <Lucide name="user-plus" color="#fff" size={26} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const heroSubtitle = user?.merchant_id
        ? 'Track onboarded businesses, subscriptions, and commission payouts.'
        : 'Manage merchant partner activity from one place.';

    const statMini = {
        flex: 1,
        minWidth: 0,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 5,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    };

    const showOnboardFab = Boolean(showPartnerTabs && canOperateMerchantPortal && tab !== 'all');
    const showPromoteFab = Boolean(canManageMerchants && tab === 'all');
    const scrollBottomPad =
        showOnboardFab || showPromoteFab ? fabBottomOffset + FAB_SIZE + 12 : bottomInsetPad;

    const partnersListHeader = (
        <>
            <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 }}>
                <AppText label={heroSubtitle} variant={2} color={colors.textSecondary} fontSize={14} />
            </View>
            <View style={{ paddingHorizontal: 12 }}>{renderSearchBar()}</View>

            {showPartnerTabs && tab !== 'all' ? (
                <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 12, marginBottom: 14 }}>
                    <View style={statMini}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Lucide name="building-2" size={16} color={config.THEME_COLOR} />
                            <AppText label="Businesses" variant={2} color={colors.textTertiary} fontSize={11} />
                        </View>
                        <AppText
                            label={String(search.trim() ? filteredTenants.length : tenants.length)}
                            variant={1}
                            color={colors.text}
                            fontSize={22}
                            style={{ marginTop: 6 }}
                        />
                    </View>
                    <View style={statMini}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Lucide name="coins" size={16} color={config.THEME_COLOR} />
                            <AppText label="Commissions" variant={2} color={colors.textTertiary} fontSize={11} />
                        </View>
                        <AppText
                            label={String(search.trim() ? filteredCommissions.length : commissions.length)}
                            variant={1}
                            color={colors.text}
                            fontSize={22}
                            style={{ marginTop: 6 }}
                        />
                    </View>
                    <View style={statMini}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Lucide name="clock" size={16} color={config.THEME_COLOR} />
                            <AppText label="Pending" variant={2} color={colors.textTertiary} fontSize={11} />
                        </View>
                        <AppText
                            label={String(pendingCommissionsCount)}
                            variant={1}
                            color={colors.text}
                            fontSize={22}
                            style={{ marginTop: 6 }}
                        />
                    </View>
                </View>
            ) : null}

            {showAllMerchantsTab && tab === 'all' ? (
                <View style={{ paddingHorizontal: 12, marginBottom: 14 }}>
                    <View
                        style={{
                            padding: 16,
                            borderRadius: 14,
                            backgroundColor: colors.surface,
                            borderWidth: 1,
                            borderColor: colors.border,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <View style={{ flex: 1, paddingRight: 12 }}>
                            <AppText label="Partner merchants" variant={2} color={colors.textTertiary} fontSize={12} />
                            <AppText
                                label={`${search.trim() ? filteredAdminMerchants.length : adminMerchants.length} registered`}
                                variant={1}
                                color={colors.text}
                                fontSize={18}
                                style={{ marginTop: 4 }}
                            />
                        </View>
                        <Lucide name="users" size={36} color={config.THEME_COLOR + '55'} />
                    </View>
                </View>
            ) : null}

            {(showPartnerTabs || showAllMerchantsTab) && (
                <View style={{ marginHorizontal: 16, marginBottom: 18 }}>
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'stretch',
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: colors.border,
                        }}
                    >
                        {showPartnerTabs ? (
                            <>
                                <TouchableOpacity
                                    onPress={() => setTab('businesses')}
                                    activeOpacity={0.75}
                                    style={{
                                        flex: 1,
                                        alignItems: 'center',
                                        paddingTop: 6,
                                        paddingBottom: 12,
                                        borderBottomWidth: 3,
                                        marginBottom: -StyleSheet.hairlineWidth,
                                        borderBottomColor:
                                            tab === 'businesses' ? config.THEME_COLOR : 'transparent',
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Lucide
                                            name="building-2"
                                            size={18}
                                            color={tab === 'businesses' ? config.THEME_COLOR : colors.textTertiary}
                                        />
                                        <AppText
                                            label="Businesses"
                                            variant={1}
                                            fontSize={15}
                                            color={tab === 'businesses' ? colors.text : colors.textSecondary}
                                        />
                                    </View>
                                    <AppText
                                        label={`${search.trim() ? filteredTenants.length : tenants.length} onboarded`}
                                        variant={2}
                                        fontSize={11}
                                        color={tab === 'businesses' ? config.THEME_COLOR : colors.textTertiary}
                                        style={{ marginTop: 6 }}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setTab('commissions')}
                                    activeOpacity={0.75}
                                    style={{
                                        flex: 1,
                                        alignItems: 'center',
                                        paddingTop: 6,
                                        paddingBottom: 12,
                                        borderBottomWidth: 3,
                                        marginBottom: -StyleSheet.hairlineWidth,
                                        borderBottomColor:
                                            tab === 'commissions' ? config.THEME_COLOR : 'transparent',
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Lucide
                                            name="coins"
                                            size={18}
                                            color={tab === 'commissions' ? config.THEME_COLOR : colors.textTertiary}
                                        />
                                        <AppText
                                            label="Commissions"
                                            variant={1}
                                            fontSize={15}
                                            color={tab === 'commissions' ? colors.text : colors.textSecondary}
                                        />
                                    </View>
                                    <AppText
                                        label={`${search.trim() ? filteredCommissions.length : commissions.length} records`}
                                        variant={2}
                                        fontSize={11}
                                        color={tab === 'commissions' ? config.THEME_COLOR : colors.textTertiary}
                                        style={{ marginTop: 6 }}
                                    />
                                </TouchableOpacity>
                            </>
                        ) : null}
                        {showAllMerchantsTab ? (
                            <TouchableOpacity
                                onPress={() => setTab('all')}
                                activeOpacity={0.75}
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    alignItems: 'center',
                                    paddingTop: 6,
                                    paddingBottom: 12,
                                    borderBottomWidth: 3,
                                    marginBottom: -StyleSheet.hairlineWidth,
                                    borderBottomColor: tab === 'all' ? config.THEME_COLOR : 'transparent',
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Lucide
                                        name="users"
                                        size={18}
                                        color={tab === 'all' ? config.THEME_COLOR : colors.textTertiary}
                                    />
                                    <AppText
                                        label="Partners"
                                        variant={1}
                                        fontSize={15}
                                        color={tab === 'all' ? colors.text : colors.textSecondary}
                                    />
                                </View>
                                <AppText
                                    label={`${search.trim() ? filteredAdminMerchants.length : adminMerchants.length} total`}
                                    variant={2}
                                    fontSize={11}
                                    color={tab === 'all' ? config.THEME_COLOR : colors.textTertiary}
                                    style={{ marginTop: 6 }}
                                />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            )}
        </>
    );

    const showPartnersFlatList = canManageMerchants && tab === 'all';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            {renderScreenHeader()}
            <View style={{ flex: 1 }}>
            {showPartnersFlatList ? (
                <FlatList
                    data={filteredAdminMerchants}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMerchantItem}
                    ListHeaderComponent={partnersListHeader}
                    contentContainerStyle={{
                        paddingHorizontal: 12,
                        paddingBottom: scrollBottomPad,
                        flexGrow: 1,
                    }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View
                            style={{
                                padding: 28,
                                marginTop: 8,
                                borderRadius: 14,
                                borderWidth: 1,
                                borderStyle: 'dashed',
                                borderColor: colors.border,
                                alignItems: 'center',
                            }}
                        >
                            <Lucide
                                name={search.trim() ? 'search' : 'users'}
                                size={36}
                                color={colors.textTertiary}
                            />
                            <AppText
                                label={
                                    search.trim() ? 'No partners match your search' : 'No merchant partners yet'
                                }
                                style={{ marginTop: 12 }}
                                color={colors.textSecondary}
                                fontSize={15}
                                variant={1}
                            />
                            <AppText
                                label={search.trim() ? 'Try another name or email.' : 'Tap + to add a partner'}
                                variant={2}
                                style={{ marginTop: 8 }}
                                color={colors.textTertiary}
                                fontSize={13}
                            />
                        </View>
                    }
                />
            ) : (
            <ScrollView
                contentContainerStyle={{ paddingBottom: scrollBottomPad }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                keyboardShouldPersistTaps="handled"
            >
                {partnersListHeader}

                <View style={{ paddingHorizontal: 12 }}>
                    {tab === 'businesses' ? renderPortalTenantsTable() : tab === 'commissions' ? renderPortalCommissionsTable() : null}
                </View>
            </ScrollView>
            )}
            {showOnboardFab ? (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Onboard new business"
                    onPress={() => navigation.navigate('MerchantOnboard')}
                    activeOpacity={0.92}
                    style={[
                        {
                            position: 'absolute',
                            right: 20,
                            bottom: fabBottomOffset,
                            width: FAB_SIZE,
                            height: FAB_SIZE,
                            borderRadius: FAB_SIZE / 2,
                            backgroundColor: config.THEME_COLOR,
                            alignItems: 'center',
                            justifyContent: 'center',
                        },
                        fabShadow,
                    ]}
                >
                    <Lucide name="plus" color="#fff" size={28} />
                </TouchableOpacity>
            ) : null}
            {showPromoteFab ? (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Add merchant partner"
                    onPress={() => navigation.navigate('MerchantAdd')}
                    activeOpacity={0.92}
                    style={[
                        {
                            position: 'absolute',
                            right: 20,
                            bottom: fabBottomOffset,
                            width: FAB_SIZE,
                            height: FAB_SIZE,
                            borderRadius: FAB_SIZE / 2,
                            backgroundColor: config.THEME_COLOR,
                            alignItems: 'center',
                            justifyContent: 'center',
                        },
                        fabShadow,
                    ]}
                >
                    <Lucide name="user-plus" color="#fff" size={26} />
                </TouchableOpacity>
            ) : null}
        </View>

        </SafeAreaView>
    );
};

export default MerchantPortal;
