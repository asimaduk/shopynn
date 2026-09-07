import React, { useState, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import config from '../../config';
import ScreenHeader from '../../components/screen_header';
import AppModal from '../../components/app_modal';
import { FlashList } from '@shopify/flash-list';
import useTheme from '../../hooks/useTheme';
import { returnsApi } from '../../services/api';

const SAMPLE_CUSTOMERS = [
    { id: '1', name: 'Liam Mensah', phone: '+233 24 111 2233' },
    { id: '2', name: 'Ama Serwaa', phone: '+233 20 444 5566' },
    { id: '3', name: 'Walk-in', phone: '' },
];
const SAMPLE_SALES = [
    { id: '10888', customer: 'Liam Mensah', customerId: '1', amount: '2,450.50', date: 'Today' },
    { id: '10887', customer: 'Ama Serwaa', customerId: '2', amount: '890.00', date: 'Yesterday' },
    { id: '10886', customer: 'Walk-in', customerId: '3', amount: '1,200.00', date: 'Yesterday' },
];
const REASONS = ['Defective', 'Wrong item', 'Customer change of mind', 'Other'];

const NewSaleReturn = ({ navigation }) => {
    const { colors } = useTheme();
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const [selectedSale, setSelectedSale] = useState(null);
    const [showSalePicker, setShowSalePicker] = useState(false);
    const [reason, setReason] = useState('');
    const [showReasonPicker, setShowReasonPicker] = useState(false);
    const [notes, setNotes] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [saleSearch, setSaleSearch] = useState('');

    const salesFilteredByCustomer = useMemo(() => (
        selectedCustomer
            ? SAMPLE_SALES.filter((s) => s.customerId === selectedCustomer.id || s.customer === selectedCustomer.name)
            : SAMPLE_SALES
    ), [selectedCustomer]);

    const customersFiltered = useMemo(() => {
        if (!customerSearch.trim()) return SAMPLE_CUSTOMERS;
        const q = customerSearch.toLowerCase().trim();
        return SAMPLE_CUSTOMERS.filter(
            (c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
        );
    }, [customerSearch]);

    const salesFilteredBySearch = useMemo(() => {
        if (!saleSearch.trim()) return salesFilteredByCustomer;
        const q = saleSearch.toLowerCase().trim();
        return salesFilteredByCustomer.filter(
            (s) =>
                String(s.id).toLowerCase().includes(q) ||
                (s.customer && s.customer.toLowerCase().includes(q)) ||
                (s.amount && s.amount.replace(/,/g, '').includes(q))
        );
    }, [salesFilteredByCustomer, saleSearch]);

    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!selectedSale) { Alert.alert('Required', 'Please select a sale.'); return; }
        if (!reason.trim()) { Alert.alert('Required', 'Please select a reason.'); return; }
        setSaving(true);
        try {
            await returnsApi.create({
                type: 'sales',
                saleId: selectedSale.id,
                customerId: selectedCustomer?.id,
                reason: reason.trim(),
                notes: notes?.trim() || undefined,
            });
            Alert.alert('Return created', 'Sales return has been recorded.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to create return.';
            Alert.alert('Error', msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={() => navigation.goBack()} label="New sales return" />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <AppText label="Select customer" variant={1} fontSize={14} style={styles.label} color={colors.text} />
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setShowCustomerPicker(true)} style={[styles.picker, { borderColor: colors.border }]}>
                        <AppText label={selectedCustomer ? selectedCustomer.name : 'Tap to select customer'} color={selectedCustomer ? colors.text : colors.placeholder} numberOfLines={1} />
                        <Lucide name="chevron-down" color={colors.placeholder} size={20} />
                    </TouchableOpacity>
                </View>
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <AppText label="Select sale" variant={1} fontSize={14} style={styles.label} color={colors.text} />
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setShowSalePicker(true)} style={[styles.picker, { borderColor: colors.border }]}>
                        <AppText label={selectedSale ? `#${selectedSale.id} - ${selectedSale.customer}` : 'Tap to select sale'} color={selectedSale ? colors.text : colors.placeholder} numberOfLines={1} />
                        <Lucide name="chevron-down" color={colors.placeholder} size={20} />
                    </TouchableOpacity>
                    {selectedCustomer && salesFilteredByCustomer.length === 0 && (
                        <AppText label="No sales found for this customer" fontSize={12} color={colors.textTertiary} style={{ marginTop: 6 }} />
                    )}
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
            <AppModal title="Select customer" visible={showCustomerPicker} handleClose={() => { setShowCustomerPicker(false); setCustomerSearch(''); }} onRequestClose={() => { setShowCustomerPicker(false); setCustomerSearch(''); }}>
                <View style={[styles.modalSearchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="search" size={18} color={colors.textTertiary} style={{ marginLeft: 12 }} />
                    <TextInput
                        placeholder="Search by name or phone..."
                        placeholderTextColor={colors.placeholder}
                        value={customerSearch}
                        onChangeText={setCustomerSearch}
                        style={[styles.modalSearchInput, { color: colors.text }]}
                    />
                    {customerSearch.length > 0 && (
                        <TouchableOpacity onPress={() => setCustomerSearch('')} style={{ padding: 8, marginRight: 8 }}>
                            <Lucide name="x" size={16} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.modalList}>
                    {customersFiltered.length === 0 ? (
                        <View style={styles.modalEmpty}>
                            <AppText label="No customers match your search" fontSize={14} color={colors.textTertiary} />
                        </View>
                    ) : (
                        customersFiltered.map((c) => (
                            <TouchableOpacity key={c.id} activeOpacity={0.7} onPress={() => { setSelectedCustomer(c); setShowCustomerPicker(false); setSelectedSale(null); setCustomerSearch(''); }} style={[styles.modalRow, { borderBottomColor: colors.border }]}>
                                <View>
                                    <AppText label={c.name} variant={2} color={colors.text} />
                                    {c.phone ? <AppText label={c.phone} fontSize={12} color={colors.textTertiary} style={{ marginTop: 2 }} /> : null}
                                </View>
                                {selectedCustomer?.id === c.id && <Lucide name="check" size={20} color={config.THEME_COLOR} />}
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            </AppModal>
            <AppModal title="Select sale" visible={showSalePicker} handleClose={() => { setShowSalePicker(false); setSaleSearch(''); }} onRequestClose={() => { setShowSalePicker(false); setSaleSearch(''); }}>
                <View style={[styles.modalSearchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Lucide name="search" size={18} color={colors.textTertiary} style={{ marginLeft: 12 }} />
                    <TextInput
                        placeholder="Search by sale ID, customer or amount..."
                        placeholderTextColor={colors.placeholder}
                        value={saleSearch}
                        onChangeText={setSaleSearch}
                        style={[styles.modalSearchInput, { color: colors.text }]}
                    />
                    {saleSearch.length > 0 && (
                        <TouchableOpacity onPress={() => setSaleSearch('')} style={{ padding: 8, marginRight: 8 }}>
                            <Lucide name="x" size={16} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.modalList}>
                    <FlashList
                        data={salesFilteredBySearch}
                        estimatedItemSize={52}
                        keyExtractor={(item) => item.id}
                        ListEmptyComponent={() => (
                            <View style={styles.modalEmpty}>
                                <AppText label="No sales match your search" fontSize={14} color={colors.textTertiary} />
                            </View>
                        )}
                        renderItem={({ item }) => (
                            <TouchableOpacity activeOpacity={0.7} onPress={() => { setSelectedSale(item); setShowSalePicker(false); setSaleSearch(''); }} style={[styles.modalRow, { borderBottomColor: colors.border }]}>
                                <AppText label={`#${item.id} - ${item.customer}`} variant={2} color={colors.text} />
                                <AppText label={item.amount} fontSize={13} color={config.THEME_COLOR} />
                            </TouchableOpacity>
                        )}
                    />
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
    modalSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 12,
    },
    modalSearchInput: {
        flex: 1,
        height: 44,
        marginLeft: 8,
        marginRight: 8,
        fontSize: 15,
        paddingVertical: 0,
    },
    modalList: { maxHeight: 280 },
    modalEmpty: { padding: 24, alignItems: 'center' },
    modalRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

export default NewSaleReturn;
