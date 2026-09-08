import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, StyleSheet, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import AppModal from '../../components/app_modal';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';
import { billing as billingApi } from '../../services/api';
import { canAccessScreen } from '../../utils/permissions';
import { isFoldedSetupAddon } from '../../utils/billingCatalog';

function formatItemType(type) {
    const t = String(type || '').replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatAmount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function commissionLabel(value) {
    const v = String(value || '').toLowerCase();
    if (v.includes('onboarding')) return 'Onboarding 15%';
    if (v.includes('residual') || v.includes('first_month')) return 'Residual 5%';
    if (v === 'none') return 'None';
    return value || '—';
}

function sectionTitleForType(type) {
    switch (String(type || '')) {
        case 'subscription_monthly':
            return 'Subscriptions';
        case 'onboarding':
            return 'Assisted go-live';
        case 'addon':
            return 'Add-ons';
        default:
            return formatItemType(type) || 'Other';
    }
}

function DetailRow({ label, value, colors }) {
    return (
        <View style={[styles.detailRow, { borderBottomColor: colors.borderLight }]}>
            <AppText label={label} fontSize={13} color={colors.textSecondary} style={styles.detailLabel} />
            <AppText label={value} fontSize={14} color={colors.text} style={styles.detailValue} />
        </View>
    );
}

const BillingCatalog = ({ navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const user = useSelector((state) => state.user);
    const subscriptionFeatures = useSelector((state) => state.appSettings?.subscriptionFeatures || []);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [detailItem, setDetailItem] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);

    const [editLabel, setEditLabel] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [editMinAmount, setEditMinAmount] = useState('');
    const [editMaxAmount, setEditMaxAmount] = useState('');
    const [editActive, setEditActive] = useState(true);

    const allowed = canAccessScreen(user, 'BillingCatalog', subscriptionFeatures);
    const isMigrationAddon = detailItem?.code === 'addon_data_migration';

    const sections = useMemo(() => {
        const sorted = [...items]
            .filter((row) => !isFoldedSetupAddon(row.code))
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        const order = ['subscription_monthly', 'onboarding', 'addon'];
        const map = new Map();
        sorted.forEach((row) => {
            const key = row.item_type || 'other';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        });
        const keys = [
            ...order.filter((k) => map.has(k)),
            ...[...map.keys()].filter((k) => !order.includes(k)),
        ];
        return keys.map((key) => ({ key, title: sectionTitleForType(key), rows: map.get(key) }));
    }, [items]);

    const loadCatalog = useCallback(async () => {
        try {
            const res = await billingApi.catalog({ grouped: 'false', active_only: 'false' });
            const list = Array.isArray(res?.items) ? res.items : [];
            setItems(list);
            setDetailItem((prev) => (prev ? list.find((r) => r.id === prev.id) || prev : null));
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

    const openDetail = (row) => {
        setDetailItem(row);
        setDetailOpen(true);
        setEditOpen(false);
    };

    const closeDetail = () => {
        setDetailOpen(false);
        setDetailItem(null);
    };

    const openEdit = () => {
        if (!detailItem) return;
        setEditLabel(detailItem.label ?? '');
        setEditDescription(detailItem.description ?? '');
        setEditAmount(String(detailItem.amount_ghs ?? ''));
        setEditMinAmount(detailItem.min_amount_ghs != null ? String(detailItem.min_amount_ghs) : '');
        setEditMaxAmount(detailItem.max_amount_ghs != null ? String(detailItem.max_amount_ghs) : '');
        setEditActive(Boolean(detailItem.is_active));
        setDetailOpen(false);
        setEditOpen(true);
    };

    const closeEdit = () => {
        setEditOpen(false);
        if (detailItem) setDetailOpen(true);
    };

    const handleSave = async () => {
        if (!detailItem) return;
        const amount_ghs = Number(editAmount);
        if (!Number.isFinite(amount_ghs) || amount_ghs < 0) {
            Alert.alert('Invalid amount', 'Enter a valid amount in GHS.');
            return;
        }
        if (!editLabel.trim()) {
            Alert.alert('Label required', 'Enter a label for this catalog item.');
            return;
        }

        const body = {
            label: editLabel.trim(),
            description: editDescription.trim() || null,
            amount_ghs,
            is_active: editActive,
        };

        if (isMigrationAddon) {
            if (editMinAmount !== '') {
                const min = Number(editMinAmount);
                if (!Number.isFinite(min) || min < 0) {
                    Alert.alert('Invalid minimum', 'Enter a valid minimum amount.');
                    return;
                }
                body.min_amount_ghs = min;
            }
            if (editMaxAmount !== '') {
                const max = Number(editMaxAmount);
                if (!Number.isFinite(max) || max < 0) {
                    Alert.alert('Invalid maximum', 'Enter a valid maximum amount.');
                    return;
                }
                body.max_amount_ghs = max;
            }
        }

        setSaving(true);
        try {
            await billingApi.updateCatalogItem(detailItem.id, body);
            await loadCatalog();
            setEditOpen(false);
            setDetailOpen(false);
            setDetailItem(null);
            Alert.alert('Saved', 'Catalog item updated.');
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                'Could not save.';
            Alert.alert('Save failed', msg);
        } finally {
            setSaving(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadCatalog();
    };

    if (!allowed) return null;

    return (
        <View style={[styles.safe, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 12) }]}>
            <ScreenHeader label="Billing catalog" onPress={() => navigation.goBack()} />
            <AppText
                label="Tap an item to review details, then edit. Changes apply to new quotes immediately."
                fontSize={13}
                color={colors.textSecondary}
                style={styles.intro}
            />

            {loading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={config.THEME_COLOR} />
                    <AppText label="Loading catalog..." fontSize={14} color={colors.textTertiary} style={{ marginTop: 12 }} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.THEME_COLOR} />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {sections.length === 0 ? (
                        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Lucide name="circle-dollar-sign" size={40} color={colors.border} />
                            <AppText label="No catalog items" fontSize={15} color={colors.textSecondary} style={{ marginTop: 12 }} />
                        </View>
                    ) : (
                        sections.map((section) => (
                            <View key={section.key} style={styles.section}>
                                <AppText
                                    label={section.title}
                                    variant={1}
                                    fontSize={13}
                                    color={colors.textSecondary}
                                    style={styles.sectionTitle}
                                />
                                <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                    {section.rows.map((row, index) => (
                                        <TouchableOpacity
                                            key={row.id}
                                            activeOpacity={0.7}
                                            onPress={() => openDetail(row)}
                                            style={[
                                                styles.row,
                                                index < section.rows.length - 1 && {
                                                    borderBottomWidth: StyleSheet.hairlineWidth,
                                                    borderBottomColor: colors.borderLight,
                                                },
                                            ]}
                                        >
                                            <View style={styles.rowMain}>
                                                <AppText
                                                    label={row.label || row.code}
                                                    variant={1}
                                                    fontSize={15}
                                                    color={colors.text}
                                                    numberOfLines={1}
                                                />
                                                <View style={styles.rowMeta}>
                                                    <View
                                                        style={[
                                                            styles.statusDot,
                                                            {
                                                                backgroundColor: row.is_active
                                                                    ? colors.success
                                                                    : colors.textTertiary,
                                                            },
                                                        ]}
                                                    />
                                                    <AppText
                                                        label={row.is_active ? 'Active' : 'Inactive'}
                                                        fontSize={11}
                                                        color={colors.textTertiary}
                                                    />
                                                    {row.plan_tier ? (
                                                        <AppText
                                                            label={` · ${row.plan_tier}`}
                                                            fontSize={11}
                                                            color={colors.textTertiary}
                                                        />
                                                    ) : null}
                                                </View>
                                            </View>
                                            <View style={styles.rowRight}>
                                                <AppText
                                                    label={`₵${formatAmount(row.amount_ghs)}`}
                                                    variant={1}
                                                    fontSize={15}
                                                    color={colors.text}
                                                />
                                                <Lucide name="chevron-right" size={18} color={colors.textTertiary} />
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            <AppModal
                title="Catalog item"
                visible={detailOpen}
                handleClose={closeDetail}
                onRequestClose={closeDetail}
            >
                {detailItem ? (
                    <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                        <View style={styles.detailHeader}>
                            <AppText
                                label={detailItem.label || detailItem.code}
                                variant={1}
                                fontSize={18}
                                color={colors.text}
                                style={{ flex: 1 }}
                            />
                            <View
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor: detailItem.is_active
                                            ? colors.successLight
                                            : colors.surfaceSecondary,
                                    },
                                ]}
                            >
                                <AppText
                                    label={detailItem.is_active ? 'Active' : 'Inactive'}
                                    fontSize={11}
                                    color={detailItem.is_active ? colors.success : colors.textSecondary}
                                    variant={1}
                                />
                            </View>
                        </View>
                        <View style={styles.chipRow}>
                            <View style={[styles.chip, { backgroundColor: colors.primaryShade }]}>
                                <AppText
                                    label={formatItemType(detailItem.item_type)}
                                    fontSize={11}
                                    color={config.THEME_COLOR}
                                    variant={1}
                                />
                            </View>
                            {detailItem.plan_tier ? (
                                <View style={[styles.chip, { backgroundColor: colors.surfaceSecondary }]}>
                                    <AppText label={detailItem.plan_tier} fontSize={11} color={colors.textSecondary} />
                                </View>
                            ) : null}
                        </View>

                        <DetailRow label="Amount" value={`₵${formatAmount(detailItem.amount_ghs)}`} colors={colors} />
                        {(detailItem.min_amount_ghs != null || detailItem.max_amount_ghs != null) && (
                            <DetailRow
                                label="Range"
                                value={`₵${formatAmount(detailItem.min_amount_ghs)} – ₵${formatAmount(detailItem.max_amount_ghs)}`}
                                colors={colors}
                            />
                        )}
                        <DetailRow
                            label="Commission"
                            value={commissionLabel(detailItem.commission_eligible)}
                            colors={colors}
                        />
                        <DetailRow
                            label="Description"
                            value={detailItem.description?.trim() ? detailItem.description : '—'}
                            colors={colors}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={closeDetail}
                                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                            >
                                <AppText label="Close" variant={1} fontSize={14} color={colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={openEdit}
                                style={[styles.primaryBtn, { backgroundColor: config.THEME_COLOR }]}
                            >
                                <AppText label="Edit" variant={1} fontSize={14} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                ) : null}
            </AppModal>

            <AppModal
                title="Edit catalog item"
                visible={editOpen}
                handleClose={saving ? () => {} : closeEdit}
                onRequestClose={saving ? () => {} : closeEdit}
            >
                {detailItem ? (
                    <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                        <View style={[styles.codeBox, { backgroundColor: colors.surfaceSecondary }]}>
                            <AppText
                                label={`${formatItemType(detailItem.item_type)}${detailItem.plan_tier ? ` · ${detailItem.plan_tier}` : ''}`}
                                fontSize={12}
                                color={colors.textSecondary}
                            />
                        </View>

                        <AppText label="Label" fontSize={12} color={colors.textTertiary} style={styles.fieldLabel} />
                        <TextInput
                            value={editLabel}
                            onChangeText={setEditLabel}
                            editable={!saving}
                            placeholder="Label"
                            placeholderTextColor={colors.placeholder}
                            style={[
                                styles.input,
                                {
                                    color: colors.text,
                                    borderColor: colors.border,
                                    backgroundColor: colors.inputBackground,
                                },
                            ]}
                        />

                        <AppText label="Description" fontSize={12} color={colors.textTertiary} style={styles.fieldLabel} />
                        <TextInput
                            value={editDescription}
                            onChangeText={setEditDescription}
                            editable={!saving}
                            placeholder="Optional description"
                            placeholderTextColor={colors.placeholder}
                            multiline
                            style={[
                                styles.input,
                                styles.inputMultiline,
                                {
                                    color: colors.text,
                                    borderColor: colors.border,
                                    backgroundColor: colors.inputBackground,
                                },
                            ]}
                        />

                        <AppText label="Amount (GHS)" fontSize={12} color={colors.textTertiary} style={styles.fieldLabel} />
                        <TextInput
                            value={editAmount}
                            onChangeText={setEditAmount}
                            editable={!saving}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor={colors.placeholder}
                            style={[
                                styles.input,
                                {
                                    color: colors.text,
                                    borderColor: colors.border,
                                    backgroundColor: colors.inputBackground,
                                },
                            ]}
                        />

                        {isMigrationAddon ? (
                            <View style={styles.rangeRow}>
                                <View style={{ flex: 1 }}>
                                    <AppText label="Min (GHS)" fontSize={12} color={colors.textTertiary} style={styles.fieldLabel} />
                                    <TextInput
                                        value={editMinAmount}
                                        onChangeText={setEditMinAmount}
                                        editable={!saving}
                                        keyboardType="decimal-pad"
                                        placeholder="Optional"
                                        placeholderTextColor={colors.placeholder}
                                        style={[
                                            styles.input,
                                            {
                                                color: colors.text,
                                                borderColor: colors.border,
                                                backgroundColor: colors.inputBackground,
                                            },
                                        ]}
                                    />
                                </View>
                                <View style={{ width: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <AppText label="Max (GHS)" fontSize={12} color={colors.textTertiary} style={styles.fieldLabel} />
                                    <TextInput
                                        value={editMaxAmount}
                                        onChangeText={setEditMaxAmount}
                                        editable={!saving}
                                        keyboardType="decimal-pad"
                                        placeholder="Optional"
                                        placeholderTextColor={colors.placeholder}
                                        style={[
                                            styles.input,
                                            {
                                                color: colors.text,
                                                borderColor: colors.border,
                                                backgroundColor: colors.inputBackground,
                                            },
                                        ]}
                                    />
                                </View>
                            </View>
                        ) : null}

                        <View style={[styles.switchRow, { borderColor: colors.border }]}>
                            <View style={{ flex: 1, paddingRight: 12 }}>
                                <AppText label="Active" variant={1} fontSize={14} color={colors.text} />
                                <AppText
                                    label="Inactive items are hidden from new onboard quotes."
                                    fontSize={12}
                                    color={colors.textTertiary}
                                    style={{ marginTop: 2 }}
                                />
                            </View>
                            <Switch
                                value={editActive}
                                onValueChange={setEditActive}
                                disabled={saving}
                                trackColor={{ false: colors.border, true: config.THEME_COLOR + '88' }}
                                thumbColor={editActive ? config.THEME_COLOR : colors.surfaceSecondary}
                            />
                        </View>

                        <AppText
                            label={`Commission: ${commissionLabel(detailItem.commission_eligible)} (fixed)`}
                            fontSize={12}
                            color={colors.textTertiary}
                            style={{ marginTop: 8 }}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                disabled={saving}
                                onPress={closeEdit}
                                style={[styles.secondaryBtn, { borderColor: colors.border }, saving && { opacity: 0.6 }]}
                            >
                                <AppText label="Cancel" variant={1} fontSize={14} color={colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                disabled={saving}
                                onPress={handleSave}
                                style={[
                                    styles.primaryBtn,
                                    { backgroundColor: config.THEME_COLOR },
                                    saving && { opacity: 0.7 },
                                ]}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <AppText label="Save" variant={1} fontSize={14} color="#fff" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                ) : null}
            </AppModal>
        </View>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    intro: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyCard: {
        padding: 32,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    section: { marginBottom: 18 },
    sectionTitle: {
        marginBottom: 8,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    listCard: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    rowMain: { flex: 1, paddingRight: 10, minWidth: 0 },
    rowMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    chip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    detailHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 10,
    },
    detailRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 12,
    },
    detailLabel: { width: 100 },
    detailValue: { flex: 1 },
    modalBody: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 20,
    },
    primaryBtn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 46,
    },
    secondaryBtn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        minHeight: 46,
        justifyContent: 'center',
    },
    codeBox: {
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
    },
    fieldLabel: { marginTop: 12, marginBottom: 6 },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
    },
    inputMultiline: {
        minHeight: 72,
        textAlignVertical: 'top',
    },
    rangeRow: { flexDirection: 'row' },
    switchRow: {
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
});

export default BillingCatalog;
