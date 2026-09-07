import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import ScreenHeader from '../../components/screen_header';
import AppText from '../../components/text';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { customers as customersApi } from '../../services/api';

const InputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false, icon, colors }) => (
    <View style={styles.inputContainer}>
        <AppText label={label} fontSize={14} variant={1} style={[styles.inputLabel, { color: colors.text }]} />
        <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }, multiline && { height: 100, alignItems: 'flex-start', paddingTop: 10 }]}>
            {icon && <Lucide name={icon} size={18} color={colors.textTertiary} style={{ marginRight: 10 }} />}
            <TextInput
                style={[styles.input, { color: colors.text }, multiline && { textAlignVertical: 'top' }]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.placeholder}
                keyboardType={keyboardType}
                multiline={multiline}
            />
        </View>
    </View>
);

const CustomerForm = ({ navigation, route }) => {
    const { colors } = useTheme();
    const editItem = route.params?.item;
    const isEdit = !!editItem;

    const [form, setForm] = useState({
        name: '',
        phone: '',
        email: '',
        location: '',
        contactPerson: '',
        address: '',
        notes: ''
    });

    useEffect(() => {
        if (isEdit) {
            setForm({
                name: editItem.name || '',
                phone: editItem.phone || '',
                email: editItem.email || '',
                location: editItem.location || '',
                contactPerson: editItem.contactPerson || '',
                address: editItem.address || '',
                notes: editItem.notes || ''
            });
        }
    }, [editItem]);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const [saving, setSaving] = useState(false);

    const handleSave = () => {
        if (!form.name?.trim() || !form.phone?.trim()) {
            Alert.alert('Error', 'Please fill in Name and Phone number');
            return;
        }

        const performSave = async () => {
            setSaving(true);
            try {
                const body = {
                    name: form.name.trim(),
                    phone: form.phone.trim(),
                    email: form.email?.trim() || undefined,
                    // address: form.location?.trim() || undefined,
                    // contactPerson: form.contactPerson?.trim() || undefined,
                    address: form.address?.trim() || undefined,
                    notes: form.notes?.trim() || undefined,
                };
                if (isEdit) {
                    await customersApi.update(editItem.id, { ...body, id: editItem.id });
                } else {
                    await customersApi.create(body);
                }
                Alert.alert('Success', `Customer ${isEdit ? 'updated' : 'created'} successfully`, [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            } catch (err) {
                const msg =
                    err?.response?.data?.message || err?.message || 'Failed to save customer.';
                Alert.alert('Error', msg);
            } finally {
                setSaving(false);
            }
        };

        Alert.alert(
            isEdit ? 'Update customer' : 'Create customer',
            isEdit
                ? 'Are you sure you want to update this customer?'
                : 'Are you sure you want to create this customer?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isEdit ? 'Update' : 'Create',
                    onPress: performSave,
                },
            ],
        );
    };

    if (isEdit && editItem?.source === 'account') {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader onPress={() => navigation.goBack()} label="Edit Customer" />
                <View style={{ padding: 24 }}>
                    <AppText
                        label="This customer signed up in the app (store reference). Edit them as a user with the customer role, not as a POS customer record."
                        fontSize={15}
                        color={colors.textSecondary}
                        style={{ lineHeight: 22, marginBottom: 20 }}
                    />
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.saveButton} activeOpacity={0.85}>
                        <AppText label="Go back" fontSize={16} variant={1} color={colors.textInverse} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader
                onPress={() => navigation.goBack()}
                label={isEdit ? 'Edit Customer' : 'Add New Customer'}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[styles.formSection, { backgroundColor: colors.surface }]}>
                        <InputField
                            label="Business/Customer Name *"
                            value={form.name}
                            onChangeText={(val) => handleChange('name', val)}
                            placeholder="e.g. Accra Mall Ltd"
                            icon="user"
                            colors={colors}
                        />

                        <InputField
                            label="Phone Number *"
                            value={form.phone}
                            onChangeText={(val) => handleChange('phone', val)}
                            placeholder="e.g. +233 24 123 4567"
                            keyboardType="phone-pad"
                            icon="phone"
                            colors={colors}
                        />

                        <InputField
                            label="Email Address"
                            value={form.email}
                            onChangeText={(val) => handleChange('email', val)}
                            placeholder="customer@example.com"
                            keyboardType="email-address"
                            icon="mail"
                            colors={colors}
                        />

                        {/* <InputField
                            label="Contact Person"
                            value={form.contactPerson}
                            onChangeText={(val) => handleChange('contactPerson', val)}
                            placeholder="Who to contact"
                            icon="user-check"
                            colors={colors}
                        />

                        <InputField
                            label="Location/City"
                            value={form.location}
                            onChangeText={(val) => handleChange('location', val)}
                            placeholder="e.g. East Legon"
                            icon="map-pin"
                            colors={colors}
                        /> */}

                        <InputField
                            label="Full Address"
                            value={form.address}
                            onChangeText={(val) => handleChange('address', val)}
                            placeholder="Plot number, Street name..."
                            multiline
                            icon="map"
                            colors={colors}
                        />

                        <InputField
                            label="Notes/Observations"
                            value={form.notes}
                            onChangeText={(val) => handleChange('notes', val)}
                            placeholder="Additional details..."
                            multiline
                            icon="sticky-note"
                            colors={colors}
                        />
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSave}
                        disabled={saving}
                        style={styles.saveButton}
                    >
                        <Lucide name="save" color={colors.textInverse} size={20} />
                        <AppText
                            label={isEdit ? 'Update Customer' : 'Save Customer'}
                            fontSize={16}
                            variant={1}
                            color={colors.textInverse}
                            style={{ marginLeft: 10 }}
                        />
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    formSection: {
        backgroundColor: '#fff',
        borderRadius: 5,
        padding: 15,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    inputContainer: {
        marginBottom: 15,
    },
    inputLabel: {
        marginBottom: 8,
        color: '#444',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        paddingHorizontal: 15,
        height: 50,
        backgroundColor: '#f9f9f9',
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        height: '100%',
        fontFamily: 'FiraSans-Regular',
    },
    saveButton: {
        flexDirection: 'row',
        backgroundColor: config.THEME_COLOR,
        height: 55,
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
});

export default CustomerForm;
