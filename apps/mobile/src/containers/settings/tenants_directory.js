import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    FlatList,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import styles from './styles';
import useTheme from '../../hooks/useTheme';
import { tenants as tenantsApi } from '../../services/api';

function haystack(parts) {
    return parts
        .filter((p) => p != null && p !== '')
        .map((p) => String(p))
        .join(' ')
        .toLowerCase();
}

function isSubscriptionActiveStatus(status) {
    const s = String(status || '').toLowerCase();
    return s.includes('active') && !s.includes('inact');
}

function subscriptionChipStyle(status) {
    if (isSubscriptionActiveStatus(status)) return { bg: '#dcfce7', color: '#16a34a' };
    const s = String(status || '').toLowerCase();
    if (s.includes('expir')) return { bg: '#fee2e2', color: '#dc2626' };
    if (s.includes('pending')) return { bg: '#fef3c7', color: '#d97706' };
    return { bg: '#f3f4f6', color: '#6b7280' };
}

function computeDirectoryStats(rows) {
    let totalUsers = 0;
    let totalStores = 0;
    let activeSubscriptions = 0;
    let withoutPlan = 0;
    let withPlan = 0;
    for (const r of rows) {
        totalUsers += r.user_count ?? 0;
        totalStores += r.warehouse_count ?? 0;
        if (isSubscriptionActiveStatus(r.subscription_status)) activeSubscriptions += 1;
        const hasPlan =
            r.subscription_id || (r.subscription_name && String(r.subscription_name).trim() !== '');
        if (hasPlan) withPlan += 1;
        else withoutPlan += 1;
    }
    return {
        totalBusinesses: rows.length,
        activeSubscriptions,
        withPlan,
        withoutPlan,
        totalUsers,
        totalStores,
    };
}

function DirectoryStatTile({ label, value, icon, iconColor, colors }) {
    return (
        <View
            style={{
                flexGrow: 1,
                flexBasis: '30%',
                maxWidth: '33%',
                minWidth: 0,
                paddingVertical: 8,
                paddingHorizontal: 8,
                borderRadius: 10,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <View
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        backgroundColor: colors.surfaceSecondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                    <Lucide name={icon} size={14} color={iconColor} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText
                        label={String(value)}
                        fontSize={15}
                        color={colors.text}
                        variant={1}
                        numberOfLines={1}
                        style={{ fontWeight: '700', lineHeight: 18 }}
                    />
                    <AppText
                        label={label}
                        fontSize={9}
                        color={colors.textTertiary}
                        numberOfLines={1}
                        style={{ marginTop: 1, fontWeight: '600' }}
                    />
                </View>
            </View>
        </View>
    );
}

const TenantsDirectory = ({ navigation }) => {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [list, setList] = useState([]);
    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    const stats = useMemo(() => computeDirectoryStats(list), [list]);

    const filteredList = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return list;
        return list.filter((t) =>
            haystack([
                t.name,
                t.organization,
                t.phone,
                t.email,
                t.subscription_name,
                t.subscription_status,
                t.user_count,
                t.warehouse_count,
                t.merchant_count,
            ]).includes(q),
        );
    }, [list, search]);

    const filteredStats = useMemo(() => computeDirectoryStats(filteredList), [filteredList]);
    const showingFiltered = search.trim().length > 0;
    const displayStats = showingFiltered ? filteredStats : stats;

    const load = useCallback(async () => {
        try {
            const res = await tenantsApi.directoryList();
            const tenants = Array.isArray(res?.tenants) ? res.tenants : [];
            setList(tenants);
        } catch (_) {
            setList([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            load();
        }, [load]),
    );

    const cardStyle = {
        padding: 14,
        marginBottom: 10,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        marginHorizontal: 10,
    };

    const backPress = () => navigation.goBack();

    const renderScreenHeader = () => (
        <ScreenHeader onPress={backPress} label="Tenant directory">
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
            <View style={[styles.searchContainer, { backgroundColor: colors.surface, marginBottom: 15, marginHorizontal: 0, marginTop: 0 }]}>
                <Lucide name="search" color={colors.textTertiary} size={18} />
                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search by business, plan, phone, status..."
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

    const renderTenantRow = ({ item: t }) => {
        const chip = subscriptionChipStyle(t.subscription_status);
        const statusLabel = isSubscriptionActiveStatus(t.subscription_status)
            ? 'Active'
            : String(t.subscription_status || 'No plan')
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (c) => c.toUpperCase());

        return (
            <TouchableOpacity
                onPress={() => navigation.navigate('TenantDirectoryDetail', { tenantId: t.id })}
                activeOpacity={0.75}
                style={cardStyle}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            backgroundColor: '#6366f118',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                        }}>
                        <Lucide name="building-2" size={22} color="#6366f1" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <AppText label={t.name || '—'} variant={1} color={colors.text} fontSize={16} numberOfLines={1} style={{ flex: 1 }} />
                            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: chip.bg }}>
                                <AppText label={statusLabel} fontSize={10} color={chip.color} fontFamily="FiraSans-SemiBold" />
                            </View>
                        </View>
                        <AppText
                            label={[t.organization, t.phone].filter(Boolean).join(' · ') || '—'}
                            variant={2}
                            color={colors.textTertiary}
                            fontSize={12}
                            numberOfLines={1}
                            style={{ marginTop: 4 }}
                        />
                        <AppText
                            label={`${t.subscription_name || '—'} · Users ${t.user_count ?? 0} · Stores ${t.warehouse_count ?? 0}`}
                            variant={2}
                            color={colors.textSecondary}
                            fontSize={11}
                            style={{ marginTop: 4 }}
                        />
                    </View>
                    <Lucide name="chevron-right" size={20} color={colors.textTertiary} style={{ marginLeft: 8 }} />
                </View>
            </TouchableOpacity>
        );
    };

    const listHeader = (
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
            <AppText
                label={
                    showingFiltered
                        ? `Summary for ${filteredList.length} matching tenant${filteredList.length === 1 ? '' : 's'}.`
                        : 'Platform-wide tenant overview from your latest load.'
                }
                fontSize={12}
                color={colors.textSecondary}
                style={{ marginBottom: 12 }}
            />
            {renderSearchBar()}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                <DirectoryStatTile label="Businesses" value={displayStats.totalBusinesses} icon="building-2" iconColor="#6366f1" colors={colors} />
                <DirectoryStatTile label="Active plans" value={displayStats.activeSubscriptions} icon="circle-check" iconColor="#22c55e" colors={colors} />
                <DirectoryStatTile label="With subscription" value={displayStats.withPlan} icon="layers" iconColor="#0ea5e9" colors={colors} />
                <DirectoryStatTile label="Users (all)" value={displayStats.totalUsers} icon="users" iconColor="#8b5cf6" colors={colors} />
                <DirectoryStatTile label="Stores (all)" value={displayStats.totalStores} icon="store" iconColor="#f59e0b" colors={colors} />
                <DirectoryStatTile
                    label="Without plan"
                    value={displayStats.withoutPlan}
                    icon="circle-off"
                    iconColor="#ef4444"
                    colors={colors}
                />
            </View>
            <AppText
                label={showingFiltered ? `Directory · ${filteredList.length} of ${list.length}` : `Directory · ${list.length} tenants`}
                fontSize={13}
                color={colors.textTertiary}
                style={{ marginBottom: 8, marginTop: 4, fontWeight: '600' }}
            />
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                {renderScreenHeader()}
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={config.THEME_COLOR} size="large" />
                    <AppText label="Loading directory..." fontSize={14} color={colors.textSecondary} style={{ marginTop: 12 }} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            {renderScreenHeader()}
            <FlatList
                data={filteredList}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderTenantRow}
                ListHeaderComponent={listHeader}
                contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[config.THEME_COLOR]} tintColor={config.THEME_COLOR} />
                }
                ListEmptyComponent={
                    <View style={{ padding: 28, alignItems: 'center', marginHorizontal: 12 }}>
                        <Lucide name={showingFiltered ? 'search' : 'building-2'} size={40} color={colors.textTertiary} />
                        <AppText
                            label={
                                list.length === 0
                                    ? 'No tenants loaded or no access.'
                                    : 'No tenants match your search'
                            }
                            color={colors.textSecondary}
                            fontSize={15}
                            variant={1}
                            style={{ marginTop: 12, textAlign: 'center' }}
                        />
                        {showingFiltered ? (
                            <AppText label="Try another business name, plan, or phone." fontSize={13} color={colors.textTertiary} style={{ marginTop: 6 }} />
                        ) : null}
                    </View>
                }
            />
        </SafeAreaView>
    );
};

export default TenantsDirectory;
