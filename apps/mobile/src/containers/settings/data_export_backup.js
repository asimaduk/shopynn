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
import AsyncStorage from '@react-native-async-storage/async-storage';
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

    const [busy, setBusy] = useState(null); // 'csv' | 'prefs' | null
    const [lastExportCount, setLastExportCount] = useState(null);

    const handleExportProducts = async () => {
        if (!canRun) {
            Alert.alert(
                'Upgrade required',
                'Product export needs the Data export feature on your plan (or products.export permission).',
            );
            return;
        }
        setBusy('csv');
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
            setBusy(null);
        }
    };

    const handleBackupPrefs = async () => {
        if (!canRun) {
            Alert.alert('Not available', 'You need export permission on your plan to create a preferences backup.');
            return;
        }
        setBusy('prefs');
        try {
            const keys = await AsyncStorage.getAllKeys();
            const pairs = await AsyncStorage.multiGet(keys);
            const payload = {
                type: 'shopynn-app-preferences',
                version: 1,
                exported_at: new Date().toISOString(),
                note: 'Device app preferences only — not a full business data backup.',
                data: Object.fromEntries(pairs),
            };
            await Share.share({
                message: JSON.stringify(payload, null, 2),
                title: 'Shopynn app preferences backup',
            });
        } catch (e) {
            Alert.alert('Backup failed', e?.message || 'Could not create preferences backup.');
        } finally {
            setBusy(null);
        }
    };

    if (!canView) {
        return (
            <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={() => navigation.goBack()} label="Export & Backup" />
                <View style={styles.centered}>
                    <Lucide name="lock" color={colors.textTertiary} size={36} />
                    <AppText
                        label="You don’t have access to data export."
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
            <ScreenHeader onPress={() => navigation.goBack()} label="Export & Backup" />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <AppText
                    label="Export live product data from your Shopynn account, or save this device’s app preferences."
                    fontSize={13}
                    color={colors.textSecondary}
                    style={{ marginBottom: 14 }}
                />

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.iconWrap, { backgroundColor: `${config.THEME_COLOR}18` }]}>
                        <Lucide name="file-spreadsheet" color={config.THEME_COLOR} size={26} />
                    </View>
                    <AppText label="Export products" variant={1} fontSize={16} color={colors.text} />
                    <AppText
                        label="Download a CSV of all products (name, SKU, prices, stock, reorder levels)."
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
                        disabled={!!busy || !canRun}
                        style={[
                            styles.primaryBtn,
                            { backgroundColor: config.THEME_COLOR },
                            (!canRun || busy) && styles.disabledBtn,
                        ]}
                    >
                        {busy === 'csv' ? (
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
                            label="Requires Data export on your plan."
                            fontSize={12}
                            color={colors.textTertiary}
                            style={{ marginTop: 10 }}
                        />
                    ) : null}
                </View>

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.iconWrap, { backgroundColor: '#f59e0b18' }]}>
                        <Lucide name="smartphone" color="#f59e0b" size={26} />
                    </View>
                    <AppText label="App preferences" variant={1} fontSize={16} color={colors.text} />
                    <AppText
                        label="Share a JSON file of settings stored on this phone (theme, print agent, etc.). This is not a full inventory or sales backup."
                        fontSize={13}
                        color={colors.textSecondary}
                        style={{ marginTop: 6 }}
                    />
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleBackupPrefs}
                        disabled={!!busy || !canRun}
                        style={[
                            styles.primaryBtn,
                            { backgroundColor: '#f59e0b' },
                            (!canRun || busy) && styles.disabledBtn,
                        ]}
                    >
                        {busy === 'prefs' ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Lucide name="share-2" color="#fff" size={18} />
                                <AppText
                                    label="Share preferences"
                                    variant={1}
                                    color="#fff"
                                    fontSize={15}
                                    style={{ marginLeft: 8 }}
                                />
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={[styles.noteCard, { backgroundColor: colors.surfaceSecondary || colors.surface, borderColor: colors.border }]}>
                    <Lucide name="info" color={colors.textTertiary} size={18} />
                    <AppText
                        label="Full business restore (sales, purchases, stock) is not available on mobile yet. Use product export for analysis or archives."
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
