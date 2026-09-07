import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useSelector, useDispatch } from 'react-redux';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import config from '../../config';
import { setInvoicePrefix, setInvoiceNext, setReceiptCompanyName, setCurrency, setExchangeRate, setValuationMethod } from '../../store/actions/appSettings';

const CURRENCIES = [
    { code: 'GHS', symbol: 'GH₵', name: 'Ghana Cedi' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
];

const VALUATION_METHODS = [
    { id: 'fifo', label: 'FIFO', description: 'First In, First Out' },
    { id: 'lifo', label: 'LIFO', description: 'Last In, First Out' },
    { id: 'weighted_average', label: 'Weighted average', description: 'Average cost per unit' },
];

const InvoiceReceiptSettings = ({ navigation }) => {
    const dispatch = useDispatch();
    const appSettings = useSelector((s) => s.appSettings) || {};
    const [invoicePrefix, setLocalPrefix] = useState(appSettings.invoicePrefix || 'INV');
    const [invoiceNext, setLocalNext] = useState(String(appSettings.invoiceNextNumber ?? 1001));
    const [companyName, setLocalCompanyName] = useState(appSettings.receiptCompanyName || 'Shopynn');
    const [currency, setLocalCurrency] = useState(appSettings.currency || 'GHS');
    const [exchangeRate, setLocalExchange] = useState(String(appSettings.exchangeRateToGHS ?? 1));
    const [valuationMethod, setLocalValuationMethod] = useState(appSettings.valuationMethod || 'fifo');

    useEffect(() => {
        setLocalPrefix(appSettings.invoicePrefix || 'INV');
        setLocalNext(String(appSettings.invoiceNextNumber ?? 1001));
        setLocalCompanyName(appSettings.receiptCompanyName || 'Shopynn');
        setLocalCurrency(appSettings.currency || 'GHS');
        setLocalExchange(String(appSettings.exchangeRateToGHS ?? 1));
        setLocalValuationMethod(appSettings.valuationMethod || 'fifo');
    }, [appSettings.invoicePrefix, appSettings.invoiceNextNumber, appSettings.receiptCompanyName, appSettings.currency, appSettings.exchangeRateToGHS, appSettings.valuationMethod]);

    const save = () => {
        dispatch(setInvoicePrefix(invoicePrefix.trim() || 'INV'));
        const num = parseInt(invoiceNext, 10);
        if (!isNaN(num) && num >= 0) dispatch(setInvoiceNext(num));
        dispatch(setReceiptCompanyName(companyName.trim() || 'Shopynn'));
        dispatch(setCurrency(currency));
        const rate = parseFloat(exchangeRate);
        if (!isNaN(rate) && rate > 0) dispatch(setExchangeRate(rate));
        if (valuationMethod) dispatch(setValuationMethod(valuationMethod));
        Alert.alert('Saved', 'Invoice & receipt settings updated.');
    };

    return (
        <SafeAreaView style={styles.safe}>
            <ScreenHeader onPress={() => navigation.goBack()} label="Invoice & Receipt" />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <View style={styles.card}>
                    <AppText label="Invoice number" variant={1} fontSize={14} style={styles.label} />
                    <View style={styles.row}>
                        <TextInput placeholder="INV" value={invoicePrefix} onChangeText={setLocalPrefix} style={[styles.input, { flex: 1, marginRight: 8 }]} />
                        <TextInput placeholder="1001" value={invoiceNext} onChangeText={(t) => setLocalNext(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={[styles.input, { width: 90 }]} />
                    </View>
                </View>
                <View style={styles.card}>
                    <AppText label="Company name on receipt" variant={1} fontSize={14} style={styles.label} />
                    <TextInput placeholder="Shopynn" value={companyName} onChangeText={setLocalCompanyName} style={styles.input} />
                </View>
                <View style={styles.card}>
                    <AppText label="Display currency" variant={1} fontSize={14} style={styles.label} />
                    <View style={styles.currencyRow}>
                        {CURRENCIES.map((c) => (
                            <TouchableOpacity key={c.code} activeOpacity={0.7} onPress={() => setLocalCurrency(c.code)} style={[styles.currencyBtn, currency === c.code && styles.currencyBtnActive]}>
                                <AppText label={c.symbol} variant={1} fontSize={16} color={currency === c.code ? '#fff' : '#333'} />
                            </TouchableOpacity>
                        ))}
                    </View>
                    {currency !== 'GHS' && (
                        <>
                            <AppText label="Exchange rate to GHS" fontSize={12} color="#666" style={{ marginTop: 12 }} />
                            <TextInput placeholder="1" value={exchangeRate} onChangeText={(t) => setLocalExchange(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" style={[styles.input, { marginTop: 6 }]} />
                        </>
                    )}
                </View>
                <View style={styles.card}>
                    <AppText label="Inventory valuation method" variant={1} fontSize={14} style={styles.label} />
                    <AppText label="Used for COGS report and stock value" fontSize={12} color="#666" style={{ marginBottom: 10 }} />
                    <View style={{ gap: 8 }}>
                        {VALUATION_METHODS.map((m) => (
                            <TouchableOpacity
                                key={m.id}
                                activeOpacity={0.7}
                                onPress={() => setLocalValuationMethod(m.id)}
                                style={[styles.valuationOption, valuationMethod === m.id && styles.currencyBtnActive]}
                            >
                                <AppText label={m.label} variant={1} fontSize={15} color={valuationMethod === m.id ? '#fff' : '#333'} />
                                <AppText label={m.description} fontSize={12} color={valuationMethod === m.id ? 'rgba(255,255,255,0.9)' : '#666'} style={{ marginTop: 2 }} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                <TouchableOpacity activeOpacity={0.8} onPress={save} style={styles.saveBtn}>
                    <Lucide name="check" color="#fff" size={20} />
                    <AppText label="Save settings" variant={1} color="#fff" fontSize={16} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#eee' },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 10, marginBottom: 12 },
    label: { marginBottom: 8 },
    row: { flexDirection: 'row' },
    input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontFamily: 'FiraSans-Regular', fontSize: 16 },
    currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    currencyBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f0f0f0' },
    currencyBtnActive: { backgroundColor: config.THEME_COLOR },
    valuationOption: { padding: 14, borderRadius: 8, backgroundColor: '#f0f0f0', borderWidth: 2, borderColor: 'transparent' },
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, backgroundColor: config.THEME_COLOR, borderRadius: 10, marginTop: 16 },
});

export default InvoiceReceiptSettings;
