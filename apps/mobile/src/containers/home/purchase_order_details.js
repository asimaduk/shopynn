import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import useTheme from '../../hooks/useTheme';

const mockLines = [
    { id: '1', name: 'Tampico Medium', sku: 'Tam500', qty: 50, unitCost: 62, received: 50 },
    { id: '2', name: 'Coca Cola 500ml', sku: 'CC500', qty: 24, unitCost: 65, received: 0 },
];

const PurchaseOrderDetails = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { po } = route.params || {};
    const [item, setItem] = useState(po || { id: 'PO-1001', supplier: 'Kasapreko', itemCount: 74, totalAmount: 12450, date: 'Feb 13, 2025', status: 'sent' });
    const [lines] = useState(mockLines);
    const status = item.status || 'draft';

    const backPress = () => navigation.goBack();

    const markAsSent = () => {
        setItem(prev => ({ ...prev, status: 'sent' }));
        Alert.alert('Updated', 'Purchase order marked as sent to supplier.');
    };

    const receiveAgainstPO = () => {
        navigation.navigate('ReceiveAgainstPO', { po: item, lines });
    };

    const DetailSection = ({ title, children }) => (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <AppText label={title} fontSize={16} variant={1} style={[styles.sectionTitle, { color: colors.text }]} />
            {children}
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={backPress} label="Purchase order" />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15 }}>
                <View style={[styles.statusHeader, { backgroundColor: status === 'received' ? config.GREEN_COLOR : status === 'sent' ? '#2563eb' : '#d97706' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <AppText label={item.id} fontSize={20} variant={2} color="#fff" />
                            <AppText label={status.toUpperCase()} fontSize={12} color="rgba(255,255,255,0.9)" style={{ marginTop: 2 }} />
                            <AppText label={item.date} fontSize={13} color="rgba(255,255,255,0.8)" />
                        </View>
                        <Lucide name={status === 'received' ? 'circle-check' : status === 'sent' ? 'send' : 'file-edit'} size={32} color="#fff" />
                    </View>
                    {(status === 'draft' || status === 'sent') && (
                        <View style={{ flexDirection: 'row', marginTop: 12, gap: 10 }}>
                            {status === 'draft' && (
                                <TouchableOpacity activeOpacity={0.8} onPress={markAsSent} style={[styles.poActionBtn, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                                    <Lucide name="send" size={16} color="#fff" />
                                    <AppText label="Mark as sent" fontSize={13} color="#fff" style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                            )}
                            {status === 'sent' && (
                                <TouchableOpacity activeOpacity={0.8} onPress={receiveAgainstPO} style={[styles.poActionBtn, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                                    <Lucide name="package-check" size={16} color="#fff" />
                                    <AppText label="Receive against PO" fontSize={13} color="#fff" style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                <DetailSection title="Supplier">
                    <View style={styles.detailRow}>
                        <Lucide name="building" size={18} color={colors.textSecondary} />
                        <AppText label={item.supplier} fontSize={15} color={colors.text} style={{ marginLeft: 10 }} />
                    </View>
                </DetailSection>

                <DetailSection title="Order summary">
                    <View style={styles.summaryBox}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <AppText label="Total items" fontSize={12} color={colors.textTertiary} />
                            <AppText label={String(item.itemCount || 0)} fontSize={14} color={colors.text} />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <AppText label="Total amount" fontSize={12} color={colors.textTertiary} />
                            <AppText label={`GHS ${Number(item.totalAmount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`} variant={1} fontSize={16} color={config.THEME_COLOR} />
                        </View>
                    </View>
                </DetailSection>

                <DetailSection title="Line items">
                    {lines.map((line) => (
                        <View key={line.id} style={[styles.lineRow, { borderBottomColor: colors.borderLight }]}>
                            <View style={{ flex: 1 }}>
                                <AppText label={line.name} fontSize={14} color={colors.text} />
                                <AppText label={`${line.sku} · Ordered: ${line.qty}${line.received != null ? ` · Received: ${line.received}` : ''}`} fontSize={12} color={colors.textTertiary} />
                            </View>
                            <AppText label={`GHS ${((line.unitCost || 0) * line.qty).toFixed(2)}`} fontSize={13} color={colors.text} />
                        </View>
                    ))}
                </DetailSection>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    statusHeader: { padding: 20, borderRadius: 10, marginBottom: 16 },
    poActionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
    section: { padding: 16, borderRadius: 10, marginBottom: 12 },
    sectionTitle: { marginBottom: 12 },
    detailRow: { flexDirection: 'row', alignItems: 'center' },
    summaryBox: { paddingVertical: 4 },
    lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
});

export default PurchaseOrderDetails;
