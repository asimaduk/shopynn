import React, { useState, useEffect, useCallback } from 'react';
import { View, TextInput, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import styles from './styles';
import { Lucide } from '@react-native-vector-icons/lucide';
import config from '../../config';
import AppModal from '../../components/app_modal';
import useTheme from '../../hooks/useTheme';
import { expenses as expensesApi, warehouses as warehousesApi, normalizeList } from '../../services/api';
import DateTimePicker from '@react-native-community/datetimepicker';

const InputField = ({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    multiline = false,
    icon,
    onPress,
    readOnly = false,
    colors,
}) => (
    <View style={{ marginBottom: 20 }}>
        <AppText label={label} fontSize={14} color={colors.textSecondary} style={{ marginBottom: 8 }} />
        <TouchableOpacity
            activeOpacity={readOnly ? 0.6 : 1}
            onPress={onPress}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.inputBackground,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                paddingHorizontal: 12,
            }}
        >
            <Lucide name={icon} size={18} color={colors.textTertiary} />
            {readOnly ? (
                <View
                    style={{
                        flex: 1,
                        paddingVertical: 12,
                        paddingHorizontal: 10,
                        height: multiline ? 100 : undefined,
                        justifyContent: 'center',
                    }}
                >
                    <AppText
                        label={value || placeholder}
                        color={value ? colors.text : colors.placeholder}
                        fontSize={16}
                    />
                </View>
            ) : (
                <TextInput
                    style={{
                        flex: 1,
                        paddingVertical: 12,
                        paddingHorizontal: 10,
                        fontSize: 16,
                        color: colors.text,
                        height: multiline ? 100 : undefined,
                        textAlignVertical: multiline ? 'top' : 'center',
                    }}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.placeholder}
                    keyboardType={keyboardType}
                    multiline={multiline}
                    editable={!readOnly}
                />
            )}
            {readOnly && <Lucide name="chevron-down" size={20} color={colors.border} />}
        </TouchableOpacity>
    </View>
);

const categories = [
    'General',
    'Logistics',
    'Utilities',
    'Maintenance',
    'Welfare',
    'Rent',
    'Salaries & Wages',
    'Taxes & Levies',
    'Marketing'
];

const paymentMethods = [
    'Cash',
    'Mobile Money',
    'Bank Transfer',
    'Cheque',
];

const CreateExpenditure = ({ navigation }) => {
    const { colors } = useTheme();
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [expenseDate, setExpenseDate] = useState('');
    const [expenseDateValue, setExpenseDateValue] = useState(new Date());
    const [notes, setNotes] = useState('');
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [warehouses, setWarehouses] = useState([]);
    const [showWarehouseModal, setShowWarehouseModal] = useState(false);
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    const [warehouseSearch, setWarehouseSearch] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);

    const backPress = () => {
        navigation.goBack();
    };

    const [saving, setSaving] = useState(false);

    const handleDescriptionChange = useCallback((text) => {
        setDescription(text);
    }, []);

    const handleAmountChange = useCallback((text) => {
        setAmount(text);
    }, []);

    const handleNotesChange = useCallback((text) => {
        setNotes(text);
    }, []);

    const handleSave = () => {
        if (!description?.trim() || !amount?.trim() || !category?.trim()) {
            Alert.alert('Error', 'Please fill in all required fields (Description, Amount, Category, Payment Method, Expense Date).');
            return;
        }

        const performSave = async () => {
            setSaving(true);
            try {
                const body = {
                    description: description.trim(),
                    amount: parseFloat(amount) || 0,
                    category: category.trim(),
                    payment_method: paymentMethod?.trim() || undefined,
                    note: notes?.trim() || undefined,
                };
                if (expenseDate.trim()) {
                    body.expense_date = expenseDate.trim();
                }
                if (selectedWarehouse?.id) {
                    body.warehouse_id = selectedWarehouse.id;
                }
                await expensesApi.create(body);
                Alert.alert('Success', 'Expenditure saved successfully.', [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            } catch (err) {
                const msg = err?.response?.data?.message || err?.message || 'Failed to save expenditure.';
                Alert.alert('Error', msg);
            } finally {
                setSaving(false);
            }
        };

        Alert.alert(
            'Save expenditure',
            'Are you sure you want to save this expenditure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Save',
                    onPress: performSave,
                },
            ],
        );
    };

    const handleExpenseDateChange = (event, selectedDate) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setExpenseDateValue(selectedDate);
            setExpenseDate(selectedDate.toISOString().slice(0, 10));
        }
    };

    useEffect(() => {
        let mounted = true;
        const loadWarehouses = async () => {
            try {
                const raw = await warehousesApi.list();
                const list = normalizeList(raw);
                if (!mounted) return;
                setWarehouses(Array.isArray(list) ? list : []);
            } catch (err) {
                if (!mounted) return;
                setWarehouses([]);
            }
        };
        loadWarehouses();
        return () => {
            mounted = false;
        };
    }, []);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader onPress={backPress} label={'New Expenditure'} />
            <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={{ padding: 20 }}>
                <View style={{ backgroundColor: colors.surface, padding: 20, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, marginBottom: 20 }}>
                    <InputField
                        label="Description *"
                        value={description}
                        onChangeText={handleDescriptionChange}
                        placeholder="e.g., Office Supplies"
                        icon="file-text"
                        colors={colors}
                    />
                    <InputField
                        label="Amount (GHS) *"
                        value={amount}
                        onChangeText={handleAmountChange}
                        placeholder="0.00"
                        keyboardType="numeric"
                        icon="wallet"
                        colors={colors}
                    />
                    <InputField
                        label="Category *"
                        value={category}
                        placeholder="Select Category"
                        icon="tag"
                        readOnly={true}
                        onPress={() => setShowCategoryModal(true)}
                        colors={colors}
                    />
                    <InputField
                        label="Payment Method *"
                        value={paymentMethod}
                        placeholder="Select payment method"
                        icon="credit-card"
                        readOnly={true}
                        onPress={() => setShowPaymentModal(true)}
                        colors={colors}
                    />
                    <InputField
                        label="Expense date *"
                        value={expenseDate}
                        placeholder="Select date"
                        icon="calendar"
                        readOnly={true}
                        onPress={() => setShowDatePicker(true)}
                        colors={colors}
                    />
                    <InputField
                        label="Warehouse / Branch"
                        value={selectedWarehouse?.name || ''}
                        placeholder="Optional: select warehouse"
                        icon="store"
                        readOnly={true}
                        onPress={() => setShowWarehouseModal(true)}
                        colors={colors}
                    />
                    <InputField
                        label="Notes"
                        value={notes}
                         onChangeText={handleNotesChange}
                        placeholder="Additional details..."
                        multiline={true}
                        icon="clipboard"
                        colors={colors}
                    />
                </View>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleSave}
                    style={{ backgroundColor: config.THEME_COLOR, paddingVertical: 16, borderRadius: 30, alignItems: 'center', elevation: 3, shadowColor: config.THEME_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
                >
                    <AppText label={saving ? 'Saving...' : 'Save Expenditure'} fontSize={18} fontFamily="FiraSans-Medium" color={colors.textInverse} />
                </TouchableOpacity>

            </ScrollView>

            <AppModal
                visible={showCategoryModal}
                handleClose={() => setShowCategoryModal(false)}
                title="Select Category"
                height="60%"
            >
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    {categories.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={{ paddingVertical: 15, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: category === item ? colors.primaryShade : colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                            onPress={() => {
                                setCategory(item);
                                setShowCategoryModal(false);
                            }}
                        >
                            <AppText label={item} fontSize={16} color={colors.text} />
                            {category === item && (
                                <Lucide name="check" size={20} color={config.THEME_COLOR} />
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </AppModal>

            <AppModal
                visible={showWarehouseModal}
                handleClose={() => setShowWarehouseModal(false)}
                title="Select Warehouse / Branch"
                height="60%"
            >
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    <TextInput
                        placeholder="Search warehouses..."
                        value={warehouseSearch}
                        onChangeText={setWarehouseSearch}
                        placeholderTextColor={colors.placeholder}
                        style={{
                            height: 40,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            fontFamily: 'FiraSans-Regular',
                            color: colors.text,
                            marginBottom: 12,
                        }}
                    />
                    {warehouses
                        .filter((w) =>
                            warehouseSearch.trim()
                                ? (w.name || '')
                                      .toLowerCase()
                                      .includes(warehouseSearch.toLowerCase())
                                : true,
                        )
                        .map((w) => (
                            <TouchableOpacity
                                key={w.id}
                                style={{
                                    paddingVertical: 14,
                                    paddingHorizontal: 12,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.border,
                                    backgroundColor:
                                        selectedWarehouse?.id === w.id
                                            ? colors.primaryShade
                                            : colors.surface,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }}
                                onPress={() => {
                                    setSelectedWarehouse({ id: w.id, name: w.name });
                                    setShowWarehouseModal(false);
                                }}
                            >
                                <AppText label={w.name} fontSize={16} color={colors.text} />
                                {selectedWarehouse?.id === w.id && (
                                    <Lucide name="check" size={20} color={config.THEME_COLOR} />
                                )}
                            </TouchableOpacity>
                        ))}
                </ScrollView>
            </AppModal>

            <AppModal
                visible={showPaymentModal}
                handleClose={() => setShowPaymentModal(false)}
                title="Select Payment Method"
                height="50%"
            >
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    {paymentMethods.map((method, index) => (
                        <TouchableOpacity
                            key={index}
                            style={{
                                paddingVertical: 15,
                                paddingHorizontal: 12,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.border,
                                backgroundColor: paymentMethod === method ? colors.primaryShade : colors.surface,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                            onPress={() => {
                                setPaymentMethod(method);
                                setShowPaymentModal(false);
                            }}
                        >
                            <AppText label={method} fontSize={16} color={colors.text} />
                            {paymentMethod === method && (
                                <Lucide name="check" size={20} color={config.THEME_COLOR} />
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </AppModal>

            {showDatePicker && (
                <DateTimePicker
                    value={expenseDateValue}
                    mode="date"
                    maximumDate={new Date()}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleExpenseDateChange}
                />
            )}
        </SafeAreaView>
    );
};

export default CreateExpenditure;
