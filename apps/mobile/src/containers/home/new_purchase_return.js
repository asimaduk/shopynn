import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import useTheme from '../../hooks/useTheme';
import { returnsApi } from '../../services/api';

const SAMPLE_POS = [
    { id: 'PO-1002', supplier: 'Kasapreko', amount: '1,240.00', date: 'Feb 14, 2026' },
    { id: 'PO-1001', supplier: 'CocaCola', amount: '890.00', date: 'Feb 12, 2026' },
];
const REASONS = ['Damaged in transit', 'Wrong items', 'Quality issue', 'Over supplied', 'Other'];

const NewPurchaseReturn = ({ navigation }) => {
    const { colors } = useTheme();
    const [selectedPO, setSelectedPO] = useState(null);
    const [showPOPicker, setShowPOPicker] = useState(false);
    const [reason, setReason] = useState('');
    const [showReasonPicker, setShowReasonPicker] = useState(false);
    const [notes, setNotes] = useState('');

    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!selectedPO) { Alert.alert('Required', 'Please select a purchase order.'); return; }
        if (!reason.trim()) { Alert.alert('Required', 'Please select a reason.'); return; }
        setSaving(true);
        try {
            await returnsApi.create({
                type: 'purchase',
                purchaseId: selectedPO.id,
                reason: reason.trim(),
                notes: notes?.trim() || undefined,
            });
            Alert.alert('Return created', 'Purchase return has been recorded.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to create return.';
            Alert.alert('Error', msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label="New purchase return" />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <AppText label="Select purchase order" variant={1} fontSize={14} style={styles.label} color={colors.text} />
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setShowPOPicker(true)} style={[styles.picker, { borderColor: colors.border }]}>
                        <AppText label={selectedPO ? `${selectedPO.id} - ${selectedPO.supplier}` : 'Tap to select PO'} color={selectedPO ? colors.text : colors.placeholder} />
                        <Lucide name="chevron-down" color={colors.placeholder} size={20} />
                    </TouchableOpacity>
                </View>
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <AppText label="Reason" variant={1} fontSize={14} style={styles.label} color={colors.text} />
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setShowReasonPicker(true)} style={[styles.picker, { borderColor: colors.border }]}>
                        <AppText label={reason || 'Tap to select reason'} color={reason ? colors.text : colors.placeholder} />
                        <Lucide name="chevron-down" color={colors.placeholder} size={20} />
                    </TouchableOpacity>
                </View>
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <AppText label="Notes (optional)" variant={1} fontSize={14} style={styles.label} color={colors.text} />
                    <TextInput placeholder="Additional notes..." placeholderTextColor={colors.placeholder} value={notes} onChangeText={setNotes} multiline style={[styles.picker, styles.textArea, { borderColor: colors.border, color: colors.text }]} />
                </View>
                <TouchableOpacity activeOpacity={0.8} onPress={handleSubmit} style={styles.submitBtn}>
                    <AppText label="Create return" variant={1} color={colors.textInverse} fontSize={16} />
                </TouchableOpacity>
            </ScrollView>
            <AppModal title="Select PO" visible={showPOPicker} handleClose={() => setShowPOPicker(false)} onRequestClose={() => setShowPOPicker(false)}>
                <View style={styles.modalList}>
                    {SAMPLE_POS.map((po) => (
                        <TouchableOpacity key={po.id} activeOpacity={0.7} onPress={() => { setSelectedPO(po); setShowPOPicker(false); }} style={[styles.modalRow, { borderBottomColor: colors.border }]}>
                            <AppText label={`${po.id} - ${po.supplier}`} variant={2} color={colors.text} />
                            <AppText label={po.amount} fontSize={13} color={config.THEME_COLOR} />
                        </TouchableOpacity>
                    ))}
                </View>
            </AppModal>
            <AppModal title="Reason" visible={showReasonPicker} handleClose={() => setShowReasonPicker(false)} onRequestClose={() => setShowReasonPicker(false)}>
                <View style={styles.modalList}>
                    {REASONS.map((r) => (
                        <TouchableOpacity key={r} activeOpacity={0.7} onPress={() => { setReason(r); setShowReasonPicker(false); }} style={[styles.modalRow, { borderBottomColor: colors.border }]}>
                            <AppText label={r} variant={2} color={colors.text} />
                        </TouchableOpacity>
                    ))}
                </View>
            </AppModal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#eee' },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 10, marginBottom: 12 },
    label: { marginBottom: 8 },
    picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
    textArea: { minHeight: 80, alignItems: 'flex-start' },
    submitBtn: { height: 50, backgroundColor: config.THEME_COLOR, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
    modalList: { maxHeight: 300 },
    modalRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

export default NewPurchaseReturn;
