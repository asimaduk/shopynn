import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from 'react-redux';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import config from '../../config';
import { hasFeature, hasPermission } from '../../utils/permissions';

const sampleProductsCsv = () => {
    const headers = 'Name,SKU,Barcode,Price,Stock,Reorder Level\n';
    const rows = ['Tampico Medium,Tam500,,62,21,30', '5star 350ml,5S350,,46,264,', 'Squeeze,SQZ,,38,70,'];
    return headers + rows.join('\n');
};

const DataExportBackup = ({ navigation }) => {
    const [exporting, setExporting] = useState(false);
    const user = useSelector(({ user }) => user);
    const subscriptionFeatures = useSelector(({ appSettings }) => appSettings?.subscriptionFeatures || []);
    const canRunExport = hasPermission(user, ['data_export.run']) && hasFeature(user, ['data_export.run'], subscriptionFeatures);

    const handleExportCSV = async () => {
        setExporting(true);
        try {
            await Share.share({ message: sampleProductsCsv(), title: 'Shopynn Products Export' });
        } catch (e) { Alert.alert('Export', 'Could not share export file.'); }
        setExporting(false);
    };

    const handleBackup = async () => {
        setExporting(true);
        try {
            const keys = await AsyncStorage.getAllKeys();
            const pairs = await AsyncStorage.multiGet(keys);
            await Share.share({ message: JSON.stringify(pairs), title: 'Shopynn Backup' });
        } catch (e) { Alert.alert('Backup', 'Could not create backup.'); }
        setExporting(false);
    };

    const handleRestore = () => {
        Alert.alert('Restore', 'Restore from a backup file? This will overwrite current app data.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Restore', onPress: () => Alert.alert('Restore', 'Paste your backup JSON or use a file shared from this app.') },
        ]);
    };

    return (
        <SafeAreaView style={styles.safe}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Data & Backup" />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <View style={styles.card}>
                    <View style={styles.iconWrap}><Lucide name="file-spreadsheet" color={config.THEME_COLOR} size={28} /></View>
                    <AppText label="Export data" variant={1} fontSize={16} style={styles.cardTitle} />
                    <TouchableOpacity activeOpacity={0.8} onPress={handleExportCSV} disabled={exporting || !canRunExport} style={[styles.primaryBtn, (!canRunExport || exporting) && styles.disabledBtn]}>
                        <Lucide name="download" color="#fff" size={18} />
                        <AppText label="Export CSV" variant={1} color="#fff" fontSize={15} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                </View>
                <View style={styles.card}>
                    <View style={[styles.iconWrap, { backgroundColor: '#fef3c7' }]}><Lucide name="database" color="#f59e0b" size={28} /></View>
                    <AppText label="Backup" variant={1} fontSize={16} style={styles.cardTitle} />
                    <TouchableOpacity activeOpacity={0.8} onPress={handleBackup} disabled={exporting || !canRunExport} style={[styles.primaryBtn, (!canRunExport || exporting) && styles.disabledBtn]}>
                        <Lucide name="copy" color="#fff" size={18} />
                        <AppText label="Create backup" variant={1} color="#fff" fontSize={15} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                </View>
                {/* <View style={styles.card}>
                    <View style={[styles.iconWrap, { backgroundColor: '#fef2f2' }]}><Lucide name="rotate-ccw" color="#ef4444" size={28} /></View>
                    <AppText label="Restore" variant={1} fontSize={16} style={styles.cardTitle} />
                    <TouchableOpacity activeOpacity={0.8} onPress={handleRestore} style={[styles.primaryBtn, { backgroundColor: '#ef4444' }]}>
                        <Lucide name="upload" color="#fff" size={18} />
                        <AppText label="Restore from backup" variant={1} color="#fff" fontSize={15} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                </View> */}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#eee' },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12 },
    iconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f0f7ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    cardTitle: { marginBottom: 4 },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, backgroundColor: config.THEME_COLOR, borderRadius: 10, marginTop: 14 },
    disabledBtn: { opacity: 0.5 },
});

export default DataExportBackup;
