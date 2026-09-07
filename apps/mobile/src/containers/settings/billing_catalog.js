import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    StyleSheet,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { billing as billingApi } from '../../services/api';
import { canAccessScreen } from '../../utils/permissions';

function formatItemType(type) {
    const t = String(type || '').replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
}

function commissionLabel(value) {
    const v = String(value || '').toLowerCase();
    if (v === 'onboarding') return 'Onboarding';
    if (v === 'first_month') return 'First month';
    if (v === 'none') return 'None';
    return value || '—';
}

const BillingCatalog = ({ navigation }) => {
    const { colors } = useTheme();
    const user = useSelector((state) => state.user);
    const subscriptionFeatures = useSelector((state) => state.appSettings?.subscriptionFeatures || []);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [savingId, setSavingId] = useState(null);
    const [edits, setEdits] = useState({});

    const allowed = canAccessScreen(user, 'BillingCatalog', subscriptionFeatures);

    const rows = useMemo(
        () => [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        [items]
    );

    const loadCatalog = useCallback(async () => {
        try {
            const res = await billingApi.catalog({ grouped: 'false' });
            const list = Array.isArray(res?.items) ? res.items : [];
            setItems(list);
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                'Failed to load billing catalog.';
            Alert.alert('Billing catalog', msg);
            setItems([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (!allowed) {
                navigation.goBack();
                return undefined;
            }
            setLoading(true);
            loadCatalog();
            return undefined;
        }, [allowed, loadCatalog, navigation])
    );

    const getEditAmount = (row) =>
        edits[row.id] !== undefined ? edits[row.id] : String(row.amount_ghs ?? '');

    const handleSave = async (row) => {
        const raw = getEditAmount(row);
        const amount_ghs = Number(raw);
        if (!Number.isFinite(amount_ghs) || amount_ghs < 0) {
            Alert.alert('Invalid amount', 'Enter a valid amount in GHS.');
            return;
        }
        setSavingId(row.id);
        try {
            await billingApi.updateCatalogItem(row.id, { amount_ghs });
            setEdits((prev) => {
                const next = { ...prev };
                delete next[row.id];
                return next;
            });
            await loadCatalog();
            Alert.alert('Saved', 'Catalog price updated.');
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                'Could not save.';
            Alert.alert('Save failed', msg);
        } finally {
            setSavingId(null);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadCatalog();
    };

    if (!allowed) {
        return null;
    }

    return (
        <SafeAreaView style={[localStyles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader label="Billing catalog" onPress={() => navigation.goBack()} />
            <AppText
                label="Subscription, onboarding, and add-on prices (GHS). Changes apply to new quotes immediately."
                fontSize={13}
                color={colors.textSecondary}
                style={localStyles.intro}
            />
            {loading && !refreshing ? (
                <View style={localStyles.centered}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading catalog..." fontSize={14} color={colors.textTertiary} style={{ marginTop: 12 }} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={localStyles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.THEME_COLOR} />
                    }
                    showsVerticalScrollIndicator={false}>
                    {rows.length === 0 ? (
                        <View style={[localStyles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Lucide name="circle-dollar-sign" size={40} color={colors.border} />
                            <AppText label="No catalog items" fontSize={15} color={colors.textSecondary} style={{ marginTop: 12 }} />
                        </View>
                    ) : (
                        rows.map((row) => (
                            <View
                                key={row.id}
                                style={[localStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <AppText label={row.label || row.code} variant={1} fontSize={16} color={colors.text} />
                                {/* <AppText
                                    label={row.code}
                                    fontSize={11}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
                                /> */}
                                <View style={localStyles.metaRow}>
                                    <View style={[localStyles.chip, { backgroundColor: colors.surfaceSecondary }]}>
                                        <AppText label={formatItemType(row.item_type)} fontSize={11} color={colors.textSecondary} />
                                    </View>
                                    {row.plan_tier ? (
                                        <View style={[localStyles.chip, { backgroundColor: colors.primaryShade }]}>
                                            <AppText label={row.plan_tier} fontSize={11} color={config.THEME_COLOR} variant={1} />
                                        </View>
                                    ) : null}
                                    {/* <View style={[localStyles.chip, { backgroundColor: colors.surfaceSecondary }]}>
                                        <AppText
                                            label={commissionLabel(row.commission_eligible)}
                                            fontSize={11}
                                            color={colors.textSecondary}
                                        />
                                    </View> */}
                                </View>
                                <AppText label="Amount (GHS)" fontSize={12} color={colors.textTertiary} style={{ marginTop: 12 }} />
                                <TextInput
                                    value={getEditAmount(row)}
                                    onChangeText={(text) => setEdits((prev) => ({ ...prev, [row.id]: text }))}
                                    keyboardType="decimal-pad"
                                    placeholder="0.00"
                                    placeholderTextColor={colors.placeholder}
                                    style={[
                                        localStyles.amountInput,
                                        {
                                            color: colors.text,
                                            borderColor: colors.border,
                                            backgroundColor: colors.surfaceSecondary,
                                        },
                                    ]}
                                />
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    disabled={savingId === row.id}
                                    onPress={() => handleSave(row)}
                                    style={[
                                        localStyles.saveBtn,
                                        { backgroundColor: config.THEME_COLOR },
                                        savingId === row.id && { opacity: 0.7 },
                                    ]}>
                                    {savingId === row.id ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <AppText label="Save" variant={1} fontSize={14} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

const localStyles = StyleSheet.create({
    safe: { flex: 1 },
    intro: { paddingHorizontal: 16, paddingBottom: 8 },
    scrollContent: { padding: 16, paddingBottom: 32 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyCard: {
        padding: 32,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    chip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    amountInput: {
        marginTop: 6,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
    },
    saveBtn: {
        marginTop: 12,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
});

export default BillingCatalog;
