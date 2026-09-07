import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import AppModal from '../../components/app_modal';

const defaultSuppliers = [{ id: '1', name: 'Kasapreko' }, { id: '2', name: 'CocaCola' }, { id: '3', name: 'FanMilk' }];
const defaultProducts = [
    { id: '1', name: 'Tampico Medium', sku: 'Tam500', unitCost: 62 },
    { id: '2', name: 'Coca Cola 500ml', sku: 'CC500', unitCost: 65 },
    { id: '3', name: 'Bel Aqua 1L', sku: 'BA1L', unitCost: 30 },
];

const CreatePurchaseOrder = ({ navigation, route }) => {
    const { colors } = useTheme();
    const [supplier, setSupplier] = useState(defaultSuppliers[0]);
    const [showSupplier, setShowSupplier] = useState(false);
    const [expectedDate, setExpectedDate] = useState('');
    const [notes, setNotes] = useState('');
    const [lines, setLines] = useState([]);
    const [showAddLine, setShowAddLine] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [qty, setQty] = useState('');

    const addLine = () => {
        if (!selectedProduct || !qty || parseInt(qty, 10) < 1) return;
        const numQty = parseInt(qty, 10);
        const existing = lines.find(l => l.id === selectedProduct.id);
        if (existing) {
            setLines(prev => prev.map(l => l.id === selectedProduct.id ? { ...l, qty: l.qty + numQty } : l));
        } else {
            setLines(prev => [...prev, { ...selectedProduct, qty: numQty }]);
        }
        setSelectedProduct(null);
        setQty('');
        setShowAddLine(false);
    };

    const removeLine = (id) => setLines(prev => prev.filter(l => l.id !== id));

    const totalAmount = lines.reduce((sum, l) => sum + (l.unitCost || 0) * l.qty, 0);

    const saveDraft = () => {
        const po = {
            id: `PO-${Date.now()}`,
            supplier: supplier.name,
            itemCount: lines.reduce((s, l) => s + l.qty, 0),
            totalAmount,
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            status: 'draft',
            lines,
        };
        Alert.alert('Saved', 'Purchase order saved as draft.', [
            { text: 'OK', onPress: () => navigation.navigate('PurchaseOrders') },
        ]);
    };

    const sendPO = () => {
        if (lines.length === 0) {
            Alert.alert('Add items', 'Add at least one line item to the purchase order.');
            return;
        }
        Alert.alert('Send PO', 'Mark this purchase order as sent to supplier?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Send', onPress: () => {
                Alert.alert('Sent', 'Purchase order sent to supplier.', [
                    { text: 'OK', onPress: () => navigation.navigate('PurchaseOrders') },
                ]);
            }},
        ]);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Create purchase order" />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <AppText label="Supplier" variant={1} fontSize={14} color={colors.text} style={styles.label} />
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowSupplier(true)}
                            style={[styles.select, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                        >
                            <AppText label={supplier.name} fontSize={15} color={colors.text} />
                            <Lucide name="chevron-down" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <AppText label="Expected delivery (optional)" fontSize={14} color={colors.text} style={styles.label} />
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                            placeholder="e.g. 2025-03-15"
                            placeholderTextColor={colors.placeholder}
                            value={expectedDate}
                            onChangeText={setExpectedDate}
                        />
                    </View>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <AppText label="Line items" variant={1} fontSize={14} color={colors.text} style={styles.label} />
                        {lines.map((line) => (
                            <View key={line.id} style={[styles.lineRow, { borderBottomColor: colors.borderLight }]}>
                                <View style={{ flex: 1 }}>
                                    <AppText label={line.name} fontSize={14} color={colors.text} />
                                    <AppText label={`${line.qty} × GHS ${(line.unitCost || 0).toFixed(2)} = GHS ${((line.unitCost || 0) * line.qty).toFixed(2)}`} fontSize={12} color={colors.textTertiary} />
                                </View>
                                <TouchableOpacity onPress={() => removeLine(line.id)} hitSlop={12}>
                                    <Lucide name="trash-2" size={18} color={colors.error} />
                                </TouchableOpacity>
                            </View>
                        ))}
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowAddLine(true)}
                            style={[styles.addLineBtn, { borderColor: config.THEME_COLOR }]}
                        >
                            <Lucide name="plus" size={18} color={config.THEME_COLOR} />
                            <AppText label="Add item" fontSize={14} color={config.THEME_COLOR} style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <AppText label="Notes (optional)" fontSize={14} color={colors.text} style={styles.label} />
                        <TextInput
                            style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                            placeholder="Instructions for supplier..."
                            placeholderTextColor={colors.placeholder}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                        />
                    </View>
                    <View style={[styles.totalRow, { backgroundColor: colors.surface }]}>
                        <AppText label="Total" variant={1} fontSize={16} color={colors.text} />
                        <AppText label={`GHS ${totalAmount.toFixed(2)}`} variant={1} fontSize={18} color={config.THEME_COLOR} />
                    </View>
                    <View style={styles.actions}>
                        <TouchableOpacity activeOpacity={0.8} onPress={saveDraft} style={[styles.btn, styles.btnSecondary, { backgroundColor: colors.surfaceSecondary }]}>
                            <AppText label="Save draft" variant={1} fontSize={15} color={colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity activeOpacity={0.8} onPress={sendPO} style={[styles.btn, { backgroundColor: config.THEME_COLOR }]}>
                            <Lucide name="send" size={18} color="#fff" />
                            <AppText label="Send to supplier" variant={1} fontSize={15} color="#fff" style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <AppModal visible={showSupplier} onClose={() => setShowSupplier(false)} title="Select supplier">
                {defaultSuppliers.map((s) => (
                    <TouchableOpacity
                        key={s.id}
                        activeOpacity={0.7}
                        onPress={() => { setSupplier(s); setShowSupplier(false); }}
                        style={[styles.modalItem, { borderBottomColor: colors.borderLight }]}
                    >
                        <AppText label={s.name} fontSize={16} color={colors.text} />
                    </TouchableOpacity>
                ))}
            </AppModal>

            <AppModal visible={showAddLine} onClose={() => setShowAddLine(false)} title="Add line item">
                <View style={{ marginBottom: 12 }}>
                    <AppText label="Product" fontSize={12} color={colors.textTertiary} style={{ marginBottom: 4 }} />
                    <ScrollView style={{ maxHeight: 200 }}>
                        {defaultProducts.map((p) => (
                            <TouchableOpacity
                                key={p.id}
                                activeOpacity={0.7}
                                onPress={() => setSelectedProduct(p)}
                                style={[styles.modalItem, { borderBottomColor: colors.borderLight, backgroundColor: selectedProduct?.id === p.id ? colors.surfaceSecondary : 'transparent' }]}
                            >
                                <AppText label={`${p.name} (${p.sku})`} fontSize={14} color={colors.text} />
                                <AppText label={`GHS ${(p.unitCost || 0).toFixed(2)}`} fontSize={12} color={colors.textTertiary} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
                <View style={{ marginBottom: 12 }}>
                    <AppText label="Quantity" fontSize={12} color={colors.textTertiary} style={{ marginBottom: 4 }} />
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                        placeholder="0"
                        placeholderTextColor={colors.placeholder}
                        value={qty}
                        onChangeText={(t) => setQty(t.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                    />
                </View>
                <TouchableOpacity activeOpacity={0.8} onPress={addLine} style={[styles.btn, { backgroundColor: config.THEME_COLOR }]}>
                    <AppText label="Add" variant={1} fontSize={15} color="#fff" />
                </TouchableOpacity>
            </AppModal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    card: { marginBottom: 12, padding: 14, borderRadius: 10, borderWidth: 1 },
    label: { marginBottom: 8 },
    select: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1 },
    input: { padding: 12, borderRadius: 8, borderWidth: 1, fontSize: 15 },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
    addLineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, borderWidth: 1, marginTop: 8 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10, marginBottom: 16 },
    actions: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 10 },
    btnSecondary: {},
    modalItem: { padding: 14, borderBottomWidth: 1 },
});

export default CreatePurchaseOrder;
