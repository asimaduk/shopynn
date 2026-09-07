import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    View,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import AppText from '../../components/text';
import ScreenHeader from '../../components/screen_header';
import config from '../../config';
import useTheme from '../../hooks/useTheme';
import { suppliers as suppliersApi } from '../../services/api';

const SupplierForm = ({ navigation, route }) => {
    const { colors } = useTheme();
    const item = route.params?.item;
    const isEditMode = !!item;

    const [formData, setFormData] = useState({
        name: '',
        location: '',
        phone: '',
        email: '',
        contactPerson: '',
    });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (isEditMode && item) {
            setFormData({
                name: item.name || '',
                location: item.address || '',
                phone: item.phone || '',
                email: item.email || '',
                contactPerson: item.manager || '',
            });
        }
    }, [isEditMode, item]);

    const backPress = () => {
        if (hasChanges) {
            Alert.alert(
                'Unsaved Changes',
                'You have unsaved changes. Are you sure you want to go back?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
                ]
            );
        } else {
            navigation.goBack();
        }
    };

    const updateFormData = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setHasChanges(true);
        if (errors[field]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) {
            newErrors.name = 'Supplier name is required';
        } else if (formData.name.trim().length < 2) {
            newErrors.name = 'Supplier name must be at least 2 characters';
        } else if (formData.name.trim().length > 80) {
            newErrors.name = 'Supplier name must be less than 80 characters';
        }
        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required';
        } else if (formData.phone.trim().length < 8) {
            newErrors.phone = 'Enter a valid phone number';
        }
        if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
            newErrors.email = 'Enter a valid email address';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            Alert.alert('Validation Error', 'Please fix the errors before saving');
            return;
        }
        setIsLoading(true);
        try {
            const body = {
                name: formData.name.trim(),
                address: formData.location?.trim() || undefined,
                phone: formData.phone.trim(),
                email: formData.email?.trim() || undefined,
                manager: formData.contactPerson?.trim() || undefined,
            };
            if (isEditMode) await suppliersApi.update(item.id, body);
            else await suppliersApi.create(body);
            Alert.alert('Success', `Supplier ${isEditMode ? 'updated' : 'created'} successfully`, [{ text: 'OK', onPress: () => { setHasChanges(false); navigation.goBack(); } }]);
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || `Failed to ${isEditMode ? 'update' : 'create'} supplier.`;
            Alert.alert('Error', msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <ScreenHeader onPress={backPress} label={isEditMode ? 'Edit Supplier' : 'Add Supplier'} />
                <View style={{ flex: 1 }}>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={{ flex: 1, padding: 10 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        keyboardShouldPersistTaps="handled">
                        {/* Info Banner */}
                        <View style={[styles.infoBanner, { backgroundColor: colors.primaryShade }]}>
                            <Lucide name="info" color={config.THEME_COLOR} size={18} />
                            <AppText
                                label={isEditMode
                                    ? 'Update the supplier information below.'
                                    : 'Fill in the details to add a new supplier.'}
                                fontSize={13}
                                color={colors.textSecondary}
                                style={{ flex: 1, marginLeft: 10 }}
                            />
                        </View>

                        {/* Supplier Name */}
                        <View style={[styles.viewContainer, { marginTop: 15, backgroundColor: colors.surface }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <AppText label="Supplier Name" variant={1} style={{ marginBottom: 0 }} color={colors.text} />
                                <AppText label=" *" color={colors.error} />
                            </View>
                            <TextInput
                                placeholder="e.g., Voltic Ghana Ltd"
                                placeholderTextColor={colors.placeholder}
                                value={formData.name}
                                onChangeText={(text) => updateFormData('name', text)}
                                style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, errors.name && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }]]}
                                maxLength={80}
                                autoCapitalize="words"
                            />
                            {errors.name && (
                                <View style={styles.errorContainer}>
                                    <Lucide name="alert-circle" color={colors.error} size={14} />
                                    <AppText label={errors.name} color={colors.error} fontSize={12} style={{ marginLeft: 6 }} />
                                </View>
                            )}
                            <AppText
                                label={`${formData.name.length}/80 characters`}
                                fontSize={11}
                                color={colors.textTertiary}
                                style={{ marginTop: 4, textAlign: 'right' }}
                            />
                        </View>

                        {/* Phone */}
                        <View style={[styles.viewContainer, { marginTop: 15, backgroundColor: colors.surface }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <AppText label="Phone Number" variant={1} style={{ marginBottom: 0 }} color={colors.text} />
                                <AppText label=" *" color={colors.error} />
                            </View>
                            <TextInput
                                placeholder="e.g., +233 24 123 4567"
                                placeholderTextColor={colors.placeholder}
                                value={formData.phone}
                                onChangeText={(text) => updateFormData('phone', text)}
                                style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, errors.phone && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }]]}
                                keyboardType="phone-pad"
                                maxLength={20}
                            />
                            {errors.phone && (
                                <View style={styles.errorContainer}>
                                    <Lucide name="alert-circle" color={colors.error} size={14} />
                                    <AppText label={errors.phone} color={colors.error} fontSize={12} style={{ marginLeft: 6 }} />
                                </View>
                            )}
                        </View>

                        {/* Email */}
                        {/* <View style={[styles.viewContainer, { marginTop: 15, backgroundColor: colors.surface }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <AppText label="Email" style={{ marginBottom: 0 }} color={colors.text} />
                                <AppText label=" (optional)" color={colors.textTertiary} fontSize={12} />
                            </View>
                            <TextInput
                                placeholder="supplier@example.com"
                                placeholderTextColor={colors.placeholder}
                                value={formData.email}
                                onChangeText={(text) => updateFormData('email', text)}
                                style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }, errors.email && [styles.inputError, { borderColor: colors.error, backgroundColor: colors.errorLight }]]}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                            {errors.email && (
                                <View style={styles.errorContainer}>
                                    <Lucide name="alert-circle" color={colors.error} size={14} />
                                    <AppText label={errors.email} color={colors.error} fontSize={12} style={{ marginLeft: 6 }} />
                                </View>
                            )}
                        </View> */}

                        {/* Location */}
                        <View style={[styles.viewContainer, { marginTop: 15, backgroundColor: colors.surface }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <AppText label="Location" style={{ marginBottom: 0 }} color={colors.text} />
                                <AppText label=" (optional)" color={colors.textTertiary} fontSize={12} />
                            </View>
                            <TextInput
                                placeholder="Address or area"
                                placeholderTextColor={colors.placeholder}
                                value={formData.location}
                                onChangeText={(text) => updateFormData('location', text)}
                                style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                            />
                        </View>

                        {/* Contact Person */}
                        <View style={[styles.viewContainer, { marginTop: 15, backgroundColor: colors.surface }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <AppText label="Contact Person" style={{ marginBottom: 0 }} color={colors.text} />
                                <AppText label=" (optional)" color={colors.textTertiary} fontSize={12} />
                            </View>
                            <TextInput
                                placeholder="Name of primary contact"
                                placeholderTextColor={colors.placeholder}
                                value={formData.contactPerson}
                                onChangeText={(text) => updateFormData('contactPerson', text)}
                                style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                                autoCapitalize="words"
                            />
                        </View>

                        {/* Preview */}
                        {formData.name.trim() && (
                            <View style={[styles.previewContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                    <Lucide name="eye" color={config.THEME_COLOR} size={16} />
                                    <AppText label="Preview" variant={1} fontSize={14} color={config.THEME_COLOR} style={{ marginLeft: 6 }} />
                                </View>
                                <View style={[styles.previewCard, { backgroundColor: colors.surface }]}>
                                    <View style={[styles.previewIconContainer, { backgroundColor: colors.primaryShade }]}>
                                        <Lucide name="truck" color={config.THEME_COLOR} size={22} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <AppText label={formData.name.trim()} fontSize={15} variant={1} numberOfLines={1} color={colors.text} />
                                        {formData.phone.trim() ? (
                                            <AppText label={formData.phone.trim()} fontSize={12} color={colors.textSecondary} style={{ marginTop: 4 }} />
                                        ) : null}
                                        {formData.contactPerson.trim() ? (
                                            <AppText label={`Contact: ${formData.contactPerson.trim()}`} fontSize={12} color={colors.textSecondary} style={{ marginTop: 2 }} />
                                        ) : null}
                                    </View>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Save Button */}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSave}
                        disabled={isLoading || !formData.name.trim() || !formData.phone.trim()}
                        style={[styles.saveButton, (isLoading || !formData.name.trim() || !formData.phone.trim()) && styles.saveButtonDisabled]}>
                        {isLoading ? (
                            <ActivityIndicator color={colors.textInverse} />
                        ) : (
                            <>
                                <Lucide
                                    name={isEditMode ? 'check' : 'plus'}
                                    color={colors.textInverse}
                                    size={18}
                                    style={{ marginRight: 8 }}
                                />
                                <AppText
                                    label={isEditMode ? 'Update Supplier' : 'Add Supplier'}
                                    variant={1}
                                    color={colors.textInverse}
                                    fontSize={16}
                                />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

export default SupplierForm;

const styles = StyleSheet.create({
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f7ff',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: config.THEME_COLOR,
    },
    viewContainer: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    textInput: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontFamily: 'FiraSans-Regular',
        borderRadius: 8,
        height: 50,
        color: '#4d4d4d',
        fontSize: 15,
        backgroundColor: '#f8f8f8',
        borderWidth: 1,
        borderColor: '#eee',
    },
    inputError: {
        borderColor: '#f00',
        backgroundColor: '#fff5f5',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    previewContainer: {
        marginTop: 20,
        padding: 15,
        backgroundColor: '#f8f8f8',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#eee',
    },
    previewCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
    },
    previewIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f0f7ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: 55,
        backgroundColor: config.THEME_COLOR,
        margin: 10,
        marginTop: 5,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
});
