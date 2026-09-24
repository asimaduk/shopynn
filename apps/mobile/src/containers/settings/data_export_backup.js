import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Share,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useSelector } from 'react-redux';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { products as productsApi } from '../../services/api';
import { hasFeature, hasPermission } from '../../utils/permissions';

function csvEscape(value) {
    const s = value == null ? '' : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function productsToCsv(rows) {
    const headers = ['Name', 'SKU', 'Unit', 'Unit price', 'Alt price', 'Cost', 'Stock', 'Reorder qty'];
    const lines = [headers.join(',')];
    for (const p of rows) {
        lines.push(
            [
                csvEscape(p.name),
                csvEscape(p.sku),
                csvEscape(p.unit),
                csvEscape(p.unit_price),
                csvEscape(p.alt_price),
                csvEscape(p.actual_cost),
                csvEscape(p.inventory),
                csvEscape(p.reorder_quantity),
            ].join(','),
        );
    }
    return lines.join('\n');
}

const DataExportBackup = ({ navigation }) => {
    const { colors } = useTheme();
    const user = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const canView = hasPermission(user, ['data_export.view', 'settings_manage', 'products.export']);
    const canRun =
        (hasPermission(user, ['data_export.run']) || hasPermission(user, ['products.export'])) &&
        (hasFeature(user, ['data_export.run'], subscriptionFeatures) ||
            hasFeature(user, ['products.export'], subscriptionFeatures) ||
            hasFeature(user, ['data_export.view'], subscriptionFeatures));

    const [busy, setBusy] = useState(false);
    const [lastExportCount, setLastExportCount] = useState(null);

    const handleExportProducts = async () => {
        if (!canRun) {
            Alert.alert(
                'Upgrade required',
                'Product export needs the Product export feature on your plan.',
            );
            return;
        }
        setBusy(true);
        try {
            const rows = await productsApi.export();
            if (!rows.length) {
                Alert.alert('No products', 'There are no products to export yet.');
                return;
            }
            const csv = productsToCsv(rows);
            const stamp = new Date().toISOString().slice(0, 10);
            await Share.share({
                message: csv,
                title: `Shopynn products ${stamp}.csv`,
            });
            setLastExportCount(rows.length);
        } catch (e) {
            Alert.alert(
                'Export failed',
                e?.response?.data?.message || e?.message || 'Could not export products. Check your connection and permissions.',
            );
        } finally {
            setBusy(false);
        }
    };

    if (!canView) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={() => navigation.goBack()} label="Export products" />
                <View style={styles.centered}>
                    <Lucide name="lock" color={colors.textTertiary} size={36} />
                    <AppText
                        label="You don’t have access to product export."
                        fontSize={15}
                        color={colors.textSecondary}
                        style={{ marginTop: 12, textAlign: 'center' }}
                    />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Export products" />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <AppText
                    label="Download your live product catalog as a spreadsheet you can open in Excel or Google Sheets."
                    fontSize={13}
                    color={colors.textSecondary}
                    style={{ marginBottom: 16 }}
                />

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.iconWrap, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                        <Lucide name="file-spreadsheet" color={config.THEME_COLOR} size={26} />
                    </View>
                    <AppText label="Product catalog CSV" variant={1} fontSize={16} color={colors.text} />
                    <AppText
                        label="Includes name, SKU, unit, prices, cost, stock on hand, and reorder levels for every product."
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginTop: 6 }}
                    />
                    {lastExportCount != null ? (
                        <AppText
                            label={`Last export: ${lastExportCount} products`}
                            fontSize={12}
                            color={colors.textTertiary}
                            style={{ marginTop: 8 }}
                        />
                    ) : null}
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleExportProducts}
                        disabled={busy || !canRun}
                        style={[
                            styles.primaryBtn,
                            { backgroundColor: config.THEME_COLOR },
                            (!canRun || busy) && styles.disabledBtn,
                        ]}
                    >
                        {busy ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Lucide name="download" color="#fff" size={18} />
                                <AppText label="Export CSV" variant={1} color="#fff" fontSize={15} style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>
                    {!canRun ? (
                        <AppText
                            label="Requires Product export on your plan."
                            fontSize={12}
                            color={colors.textTertiary}
                            style={{ marginTop: 10 }}
                        />
                    ) : null}
                </View>

                <View style={[styles.noteCard, { backgroundColor: colors.surfaceSecondary || colors.surface, borderColor: colors.border }]}>
                    <Lucide name="info" color={colors.textTertiary} size={18} />
                    <AppText
                        label="This exports your product catalog only. Sales, purchases, and a full business restore are not available yet."
                        fontSize={12}
                        color={colors.textSecondary}
                        style={{ marginLeft: 10, flex: 1 }}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 46,
        borderRadius: 10,
        marginTop: 14,
    },
    disabledBtn: { opacity: 0.5 },
    noteCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 14,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        marginTop: 4,
    },
});

export default DataExportBackup;
