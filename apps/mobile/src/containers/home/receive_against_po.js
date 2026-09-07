import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import config from '../../config';
import useTheme from '../../hooks/useTheme';

const ReceiveAgainstPO = ({ navigation, route }) => {
    const { colors } = useTheme();
    const { po, lines: poLines } = route.params || {};
    const [lines, setLines] = useState((poLines || []).map(l => ({ ...l, receivedQty: l.qty })));
    const [notes, setNotes] = useState('');

    const updateReceived = (id, value) => {
        const num = parseInt(value, 10) || 0;
        setLines(prev => prev.map(l => l.id === id ? { ...l, receivedQty: num } : l));
    };

    const totalReceived = lines.reduce((sum, l) => sum + (l.receivedQty || 0) * (l.unitCost || 0), 0);

    const submitReceive = () => {
        const received = lines.filter(l => (l.receivedQty || 0) > 0);
        if (received.length === 0) {
            Alert.alert('Enter quantities', 'Enter received quantity for at least one line.');
            return;
        }
        Alert.alert('Goods received', 'Receipt recorded against this purchase order.', [
            { text: 'OK', onPress: () => navigation.navigate('PurchaseOrders') },
        ]);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Receive against PO" />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 15 }}>
                {po && (
                    <View style={[styles.poCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <AppText label={po.id} variant={1} fontSize={16} color={colors.text} />
                        <AppText label={po.supplier} fontSize={14} color={colors.textSecondary} style={{ marginTop: 4 }} />
                    </View>
                )}
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <AppText label="Received quantities" variant={1} fontSize={14} color={colors.text} style={{ marginBottom: 12 }} />
                    {lines.map((line) => (
                        <View key={line.id} style={[styles.lineRow, { borderBottomColor: colors.borderLight }]}>
                            <View style={{ flex: 1 }}>
                                <AppText label={line.name} fontSize={14} color={colors.text} />
                                <AppText label={`Ordered: ${line.qty} · GHS ${(line.unitCost || 0).toFixed(2)} each`} fontSize={12} color={colors.textTertiary} />
                            </View>
                            <TextInput
                                style={[styles.qtyInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                                value={String(line.receivedQty ?? line.qty)}
                                onChangeText={(t) => updateReceived(line.id, t.replace(/[^0-9]/g, ''))}
                                keyboardType="number-pad"
                                placeholder="0"
                                placeholderTextColor={colors.placeholder}
                            />
                        </View>
                    ))}
                </View>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <AppText label="Notes (optional)" fontSize={14} color={colors.text} style={{ marginBottom: 8 }} />
                    <TextInput
                        style={[styles.notesInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                        placeholder="Condition, discrepancies..."
                        placeholderTextColor={colors.placeholder}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                    />
                </View>
                <View style={[styles.totalRow, { backgroundColor: colors.surface }]}>
                    <AppText label="Total received value" variant={1} fontSize={16} color={colors.text} />
                    <AppText label={`GHS ${totalReceived.toFixed(2)}`} variant={1} fontSize={18} color={config.THEME_COLOR} />
                </View>
                <TouchableOpacity activeOpacity={0.8} onPress={submitReceive} style={[styles.submitBtn, { backgroundColor: config.THEME_COLOR }]}>
                    <Lucide name="package-check" size={20} color="#fff" />
                    <AppText label="Confirm receipt" variant={1} fontSize={16} color="#fff" style={{ marginLeft: 10 }} />
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    poCard: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
    card: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
    lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
    qtyInput: { width: 70, padding: 10, borderRadius: 8, borderWidth: 1, fontSize: 15, textAlign: 'center' },
    notesInput: { padding: 12, borderRadius: 8, borderWidth: 1, minHeight: 80, textAlignVertical: 'top' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10, marginBottom: 16 },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 10 },
});

export default ReceiveAgainstPO;
